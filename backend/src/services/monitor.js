/**
 * Deposit Monitor Service
 * Watches all active deposit addresses for incoming SOL transfers
 */

const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { v4: uuidv4 } = require('uuid');

class DepositMonitor {
    constructor(db, walletService, config = {}) {
        this.db = db;
        this.walletService = walletService;
        this.intervalMs = config.intervalMs || 5000;
        this.minBet = config.minBet || 0.01;
        this.maxBet = config.maxBet || 20;
        this.isRunning = false;
        this.intervalHandle = null;
        
        // Track processed signatures to avoid duplicates
        this.processedSignatures = new Set();
        
        // Refund queue - deposits that need refunds
        this.refundQueue = [];
        
        // Event callbacks
        this.onDepositConfirmed = null;
        this.onBetCreated = null;
        this.onRefundNeeded = null;  // Callback when refund is needed
    }

    /**
     * Queue a refund for a rejected deposit
     */
    async queueRefund(deposit, transfer, reason) {
        const refund = {
            deposit_id: deposit.id,
            deposit_address: deposit.address,
            private_key: deposit.private_key,
            user_wallet: transfer.fromAddress,
            amount: transfer.amount,
            reason: reason,
            status: 'pending',
            created_at: Date.now()
        };

        this.refundQueue.push(refund);
        console.log(`Refund queued: ${transfer.amount} SOL to ${transfer.fromAddress?.slice(0, 8)}... - Reason: ${reason}`);

        // Store refund in database for persistence
        this.db.db.prepare(`
            INSERT INTO refunds (id, deposit_id, user_wallet, amount, reason, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `).run(
            uuidv4(),
            deposit.id,
            transfer.fromAddress,
            transfer.amount,
            reason,
            Math.floor(Date.now() / 1000)
        );

        // Trigger callback if set
        if (this.onRefundNeeded) {
            this.onRefundNeeded(refund);
        }

        return refund;
    }

    /**
     * Get all pending refunds
     */
    getPendingRefunds() {
        return this.db.db.prepare(
            "SELECT * FROM refunds WHERE status = 'pending' ORDER BY created_at"
        ).all();
    }

    /**
     * Start monitoring deposit addresses
     */
    start() {
        if (this.isRunning) {
            console.log('Monitor already running');
            return;
        }

        console.log(`Starting deposit monitor (interval: ${this.intervalMs}ms)`);
        this.isRunning = true;
        
        // Run immediately, then on interval
        this.checkDeposits();
        this.intervalHandle = setInterval(() => this.checkDeposits(), this.intervalMs);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.isRunning) return;
        
        console.log('Stopping deposit monitor');
        this.isRunning = false;
        
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }

    /**
     * Check all waiting deposit addresses for new transfers
     */
    async checkDeposits() {
        try {
            // Get all waiting deposits
            const waitingDeposits = this.db.getWaitingDeposits();
            
            if (waitingDeposits.length === 0) {
                return;
            }

            console.log(`Checking ${waitingDeposits.length} waiting deposit addresses...`);

            for (const deposit of waitingDeposits) {
                await this.checkSingleDeposit(deposit);
            }

            // Clean up expired deposits
            await this.cleanupExpiredDeposits();

        } catch (error) {
            console.error('Error in deposit check cycle:', error);
        }
    }

    /**
     * Check a single deposit address for new transfers
     */
    async checkSingleDeposit(deposit) {
        try {
            // Get balance
            const balance = await this.walletService.getBalance(deposit.address);
            
            if (balance <= 0) {
                return; // No funds yet
            }

            console.log(`Found ${balance} SOL at deposit address ${deposit.address.slice(0, 8)}...`);

            // Get recent transactions to find the deposit
            const transactions = await this.walletService.getRecentTransactions(deposit.address, 5);
            
            for (const txInfo of transactions) {
                // Skip if already processed
                if (this.processedSignatures.has(txInfo.signature)) {
                    continue;
                }

                // Get full transaction details
                const tx = await this.walletService.getTransaction(txInfo.signature);
                const transfer = this.walletService.parseSOLTransfer(tx, deposit.address);

                if (transfer && transfer.amount > 0) {
                    await this.processDeposit(deposit, transfer);
                    this.processedSignatures.add(txInfo.signature);
                    break; // Process only first valid transfer
                }
            }

        } catch (error) {
            console.error(`Error checking deposit ${deposit.id}:`, error);
        }
    }

    /**
     * Process a confirmed deposit
     */
    async processDeposit(deposit, transfer) {
        console.log(`Processing deposit: ${transfer.amount} SOL from ${transfer.fromAddress?.slice(0, 8)}...`);

        // Validate minimum amount
        if (transfer.amount < this.minBet) {
            console.log(`Deposit too small: ${transfer.amount} SOL (min: ${this.minBet})`);
            this.db.updateDepositStatus(deposit.id, 'rejected_too_small', transfer.amount, transfer.signature, transfer.fromAddress);
            // Queue refund
            await this.queueRefund(deposit, transfer, 'Amount below minimum bet');
            return;
        }

        // Validate maximum amount - REJECT and refund if over max
        if (transfer.amount > this.maxBet) {
            console.log(`Deposit too large: ${transfer.amount} SOL (max: ${this.maxBet}) - REJECTING`);
            this.db.updateDepositStatus(deposit.id, 'rejected_over_max', transfer.amount, transfer.signature, transfer.fromAddress);
            // Queue refund
            await this.queueRefund(deposit, transfer, `Amount exceeds maximum bet of ${this.maxBet} SOL`);
            return;
        }

        // Check if race is still open for betting
        const race = this.db.getRace(deposit.race_id);
        if (!race || race.status !== 'open') {
            console.log(`Race ${deposit.race_id} not open for betting. Status: ${race?.status}`);
            this.db.updateDepositStatus(deposit.id, 'rejected_race_closed', transfer.amount, transfer.signature, transfer.fromAddress);
            // Queue refund
            await this.queueRefund(deposit, transfer, 'Race is not open for betting');
            return;
        }

        // Update deposit status
        this.db.updateDepositStatus(
            deposit.id, 
            'confirmed', 
            transfer.amount, 
            transfer.signature, 
            transfer.fromAddress
        );

        // Calculate odds at time of placement
        const pools = this.db.getRacePoolStats(deposit.race_id);
        const totalPool = Object.values(pools).reduce((sum, p) => sum + p.amount, 0) + transfer.amount;
        const horsePool = (pools[deposit.horse_number]?.amount || 0) + transfer.amount;
        const odds = totalPool / horsePool;

        // Create the bet record
        const betId = uuidv4();
        const bet = this.db.createBet(
            betId,
            deposit.race_id,
            deposit.horse_number,
            deposit.id,
            transfer.fromAddress,
            transfer.amount,
            transfer.signature,
            odds
        );

        console.log(`Bet created: ${betId} - ${transfer.amount} SOL on horse #${deposit.horse_number}`);

        // Trigger callbacks
        if (this.onDepositConfirmed) {
            this.onDepositConfirmed(deposit, transfer);
        }
        if (this.onBetCreated) {
            this.onBetCreated(bet, race);
        }

        return bet;
    }

    /**
     * Mark expired deposits
     */
    async cleanupExpiredDeposits() {
        const expired = this.db.getExpiredDeposits();
        
        for (const deposit of expired) {
            // Check one more time if there's actually money there
            const balance = await this.walletService.getBalance(deposit.address);
            
            if (balance > 0) {
                // Someone deposited after expiry - still process it
                console.log(`Late deposit found at expired address ${deposit.address.slice(0, 8)}`);
                continue;
            }
            
            // Mark as expired
            this.db.updateDepositStatus(deposit.id, 'expired');
        }
    }

    /**
     * Calculate winnings for all bets when race ends
     */
    calculateWinnings(raceId, winningHorse) {
        const bets = this.db.getBetsForRace(raceId);
        const pools = this.db.getRacePoolStats(raceId);
        
        const totalPool = Object.values(pools).reduce((sum, p) => sum + p.amount, 0);
        const winningPool = pools[winningHorse]?.amount || 0;
        const losingPool = totalPool - winningPool;
        
        const houseEdge = parseFloat(process.env.HOUSE_EDGE_PERCENT || 5) / 100;
        const distributablePool = losingPool * (1 - houseEdge);

        console.log(`Race ${raceId} ended. Winner: Horse #${winningHorse}`);
        console.log(`Total pool: ${totalPool} SOL, Winning pool: ${winningPool} SOL, Losing pool: ${losingPool} SOL`);

        const winners = [];

        for (const bet of bets) {
            if (bet.horse_number === winningHorse) {
                // Winner - calculate proportional share
                const share = bet.amount / winningPool;
                const winnings = distributablePool * share;
                const totalPayout = bet.amount + winnings;

                this.db.updateBetWinnings(bet.id, winnings);

                winners.push({
                    bet_id: bet.id,
                    user_wallet: bet.user_wallet,
                    bet_amount: bet.amount,
                    winnings: winnings,
                    total_payout: totalPayout
                });

                // Create payout record
                const payoutId = uuidv4();
                this.db.createPayout(payoutId, bet.id, bet.user_wallet, totalPayout);

                console.log(`Winner: ${bet.user_wallet.slice(0, 8)}... bet ${bet.amount} SOL, wins ${winnings.toFixed(4)} SOL`);
            } else {
                // Loser
                this.db.updateBetWinnings(bet.id, 0);
            }
        }

        return {
            race_id: raceId,
            winning_horse: winningHorse,
            total_pool: totalPool,
            winning_pool: winningPool,
            losing_pool: losingPool,
            house_cut: losingPool * houseEdge,
            distributed: distributablePool,
            winners: winners
        };
    }
}

module.exports = DepositMonitor;
