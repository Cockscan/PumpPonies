/**
 * Payout Service - Handles sending SOL to winners
 */

const { 
    Connection, 
    Keypair, 
    PublicKey, 
    Transaction, 
    SystemProgram, 
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction
} = require('@solana/web3.js');
const bs58 = require('bs58');

class PayoutService {
    constructor(connection, db, masterWalletPrivateKey, houseWalletAddress = null, houseEdgePercent = 5) {
        this.connection = connection;
        this.db = db;
        this.masterWallet = this.loadMasterWallet(masterWalletPrivateKey);
        this.houseWalletAddress = houseWalletAddress;
        this.houseEdgePercent = houseEdgePercent / 100;
        this.isProcessing = false;
        
        if (this.houseWalletAddress) {
            console.log(`House wallet configured: ${this.houseWalletAddress}`);
        }
    }

    /**
     * Load master wallet from private key
     */
    loadMasterWallet(privateKeyBase58) {
        if (!privateKeyBase58) {
            console.warn('No master wallet private key provided - payouts disabled');
            return null;
        }
        try {
            const secretKey = bs58.decode(privateKeyBase58);
            return Keypair.fromSecretKey(secretKey);
        } catch (error) {
            console.error('Invalid master wallet private key:', error);
            return null;
        }
    }

    /**
     * Get master wallet balance
     */
    async getMasterWalletBalance() {
        if (!this.masterWallet) return 0;
        try {
            const balance = await this.connection.getBalance(this.masterWallet.publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting master wallet balance:', error);
            return 0;
        }
    }

    /**
     * Process all pending payouts
     */
    async processAllPayouts() {
        if (this.isProcessing) {
            console.log('Payout processing already in progress');
            return { processed: 0, failed: 0 };
        }

        if (!this.masterWallet) {
            console.error('Master wallet not configured - cannot process payouts');
            return { processed: 0, failed: 0, error: 'Master wallet not configured' };
        }

        this.isProcessing = true;
        let processed = 0;
        let failed = 0;

        try {
            const pendingPayouts = await this.db.getPendingPayouts();
            console.log(`Processing ${pendingPayouts.length} pending payouts...`);

            // Check master wallet balance
            const balance = await this.getMasterWalletBalance();
            const totalRequired = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

            if (balance < totalRequired) {
                console.warn(`Insufficient master wallet balance: ${balance} SOL, need ${totalRequired} SOL`);
            }

            for (const payout of pendingPayouts) {
                try {
                    await this.processSinglePayout(payout);
                    processed++;
                } catch (error) {
                    console.error(`Failed to process payout ${payout.id}:`, error);
                    await this.db.updatePayoutStatus(payout.id, 'failed', null, error.message);
                    failed++;
                }
            }

        } finally {
            this.isProcessing = false;
        }

        console.log(`Payout processing complete: ${processed} processed, ${failed} failed`);
        return { processed, failed };
    }

    /**
     * Process a single payout
     */
    async processSinglePayout(payout) {
        console.log(`Processing payout ${payout.id}: ${payout.amount} SOL to ${payout.user_wallet.slice(0, 8)}...`);

        // Mark as processing
        await this.db.updatePayoutStatus(payout.id, 'processing');

        // Validate recipient address
        let recipientPubkey;
        try {
            recipientPubkey = new PublicKey(payout.user_wallet);
        } catch (error) {
            throw new Error(`Invalid recipient address: ${payout.user_wallet}`);
        }

        // Create transfer transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: this.masterWallet.publicKey,
                toPubkey: recipientPubkey,
                lamports: Math.floor(payout.amount * LAMPORTS_PER_SOL)
            })
        );

        // Get recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.masterWallet.publicKey;

        // Sign and send
        const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [this.masterWallet],
            { commitment: 'confirmed' }
        );

        console.log(`Payout ${payout.id} sent: ${signature}`);

        // Update payout status
        await this.db.updatePayoutStatus(payout.id, 'completed', signature);

        // Update bet payout status
        await this.db.query(
            'UPDATE bets SET payout_status = $1, payout_signature = $2 WHERE id = $3',
            ['paid', signature, payout.bet_id]
        );

        return signature;
    }

    /**
     * Collect funds from deposit addresses - splits between master wallet and house wallet
     */
    async collectFromDepositAddress(depositAddress, privateKey) {
        if (!this.masterWallet) {
            throw new Error('Master wallet not configured');
        }

        // Restore deposit keypair
        const secretKey = bs58.decode(privateKey);
        const depositKeypair = Keypair.fromSecretKey(secretKey);

        // Get balance
        const balance = await this.connection.getBalance(depositKeypair.publicKey);
        
        if (balance <= 0) {
            console.log(`No funds to collect from ${depositAddress}`);
            return null;
        }

        // Calculate amounts
        const fee = 10000; // 0.00001 SOL for transaction fees (extra for potential 2 transfers)
        const amountToSend = balance - fee;

        if (amountToSend <= 0) {
            console.log(`Balance too low to collect from ${depositAddress}`);
            return null;
        }

        // Calculate house cut and master wallet amount
        const houseCut = this.houseWalletAddress ? Math.floor(amountToSend * this.houseEdgePercent) : 0;
        const masterAmount = amountToSend - houseCut;

        // Create transaction
        const transaction = new Transaction();

        // Add transfer to master wallet
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: depositKeypair.publicKey,
                toPubkey: this.masterWallet.publicKey,
                lamports: masterAmount
            })
        );

        // Add transfer to house wallet if configured
        if (this.houseWalletAddress && houseCut > 0) {
            try {
                const houseWalletPubkey = new PublicKey(this.houseWalletAddress);
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: depositKeypair.publicKey,
                        toPubkey: houseWalletPubkey,
                        lamports: houseCut
                    })
                );
                console.log(`House cut: ${houseCut / LAMPORTS_PER_SOL} SOL to ${this.houseWalletAddress.slice(0, 8)}...`);
            } catch (error) {
                console.error('Invalid house wallet address:', error);
                // If house wallet is invalid, send everything to master
            }
        }

        // Get recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = depositKeypair.publicKey;

        // Sign and send
        const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [depositKeypair],
            { commitment: 'confirmed' }
        );

        console.log(`Collected ${amountToSend / LAMPORTS_PER_SOL} SOL from ${depositAddress}: ${signature}`);
        console.log(`  Master: ${masterAmount / LAMPORTS_PER_SOL} SOL, House: ${houseCut / LAMPORTS_PER_SOL} SOL`);

        return {
            signature,
            amount: amountToSend / LAMPORTS_PER_SOL,
            masterAmount: masterAmount / LAMPORTS_PER_SOL,
            houseCut: houseCut / LAMPORTS_PER_SOL
        };
    }

    /**
     * Collect funds from all confirmed deposit addresses
     */
    async collectAllDeposits() {
        if (!this.masterWallet) {
            console.error('Master wallet not configured - cannot collect deposits');
            return { totalCollected: 0, collected: 0, error: 'Master wallet not configured' };
        }
        
        const confirmedDepositsResult = await this.db.query(
            "SELECT id FROM deposit_addresses WHERE status = 'confirmed'"
        );

        console.log(`Found ${confirmedDepositsResult.rows.length} confirmed deposits to collect`);

        let totalCollected = 0;
        let collected = 0;
        let errors = [];

        for (const { id } of confirmedDepositsResult.rows) {
            try {
                // Use method that decrypts private key
                const deposit = await this.db.getDepositAddressWithKey(id);
                if (!deposit) {
                    console.error(`Deposit ${id} not found`);
                    errors.push(`Deposit ${id} not found`);
                    continue;
                }
                if (!deposit.private_key) {
                    console.error(`Cannot decrypt private key for deposit ${id} - check ENCRYPTION_SECRET`);
                    errors.push(`Cannot decrypt key for ${id}`);
                    continue;
                }
                
                console.log(`Collecting from ${deposit.address}...`);
                const result = await this.collectFromDepositAddress(
                    deposit.address,
                    deposit.private_key
                );
                if (result) {
                    totalCollected += result.amount;
                    collected++;
                    console.log(`Successfully collected ${result.amount} SOL from ${deposit.address}`);
                } else {
                    console.log(`No funds to collect from ${deposit.address}`);
                }
            } catch (error) {
                console.error(`Failed to collect from deposit ${id}:`, error.message);
                errors.push(`${id}: ${error.message}`);
            }
        }

        console.log(`Collection complete: ${totalCollected} SOL from ${collected} addresses`);
        return { totalCollected, collected, errors: errors.length > 0 ? errors : undefined };
    }

    /**
     * Process all pending refunds (send SOL back to users from deposit addresses)
     */
    async processAllRefunds() {
        const pendingRefundsResult = await this.db.query(
            "SELECT r.*, d.address as deposit_address FROM refunds r JOIN deposit_addresses d ON r.deposit_id = d.id WHERE r.status = 'pending' ORDER BY r.created_at"
        );

        console.log(`Processing ${pendingRefundsResult.rows.length} pending refunds...`);

        let processed = 0;
        let failed = 0;

        for (const refund of pendingRefundsResult.rows) {
            try {
                // Get decrypted private key
                const deposit = await this.db.getDepositAddressWithKey(refund.deposit_id);
                if (!deposit || !deposit.private_key) {
                    throw new Error('Cannot decrypt private key for refund');
                }
                refund.private_key = deposit.private_key;
                
                const result = await this.processRefund(refund);
                if (result) {
                    processed++;
                }
            } catch (error) {
                console.error(`Failed to process refund ${refund.id}:`, error);
                await this.db.query(
                    "UPDATE refunds SET status = 'failed', error_message = $1, processed_at = $2 WHERE id = $3",
                    [error.message, Math.floor(Date.now() / 1000), refund.id]
                );
                failed++;
            }
        }

        console.log(`Refund processing complete: ${processed} processed, ${failed} failed`);
        return { processed, failed };
    }

    /**
     * Process a single refund
     */
    async processRefund(refund) {
        console.log(`Processing refund ${refund.id}: ${refund.amount} SOL to ${refund.user_wallet.slice(0, 8)}...`);

        // Mark as processing
        await this.db.query("UPDATE refunds SET status = 'processing' WHERE id = $1", [refund.id]);

        // Validate recipient address
        let recipientPubkey;
        try {
            recipientPubkey = new PublicKey(refund.user_wallet);
        } catch (error) {
            throw new Error(`Invalid recipient address: ${refund.user_wallet}`);
        }

        // Validate private key exists
        if (!refund.private_key) {
            throw new Error('Private key not available for refund');
        }

        // Restore deposit keypair
        const secretKey = bs58.decode(refund.private_key);
        const depositKeypair = Keypair.fromSecretKey(secretKey);

        // Get balance
        const balance = await this.connection.getBalance(depositKeypair.publicKey);
        
        if (balance <= 0) {
            throw new Error('No funds in deposit address');
        }

        // Calculate amount to send (balance minus tx fee)
        const fee = 5000; // 0.000005 SOL for transaction fee
        const amountToSend = balance - fee;

        if (amountToSend <= 0) {
            throw new Error('Balance too low to refund (not enough for fees)');
        }

        // Create transfer transaction back to user
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: depositKeypair.publicKey,
                toPubkey: recipientPubkey,
                lamports: amountToSend
            })
        );

        // Get recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = depositKeypair.publicKey;

        // Sign and send
        const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [depositKeypair],
            { commitment: 'confirmed' }
        );

        console.log(`Refund ${refund.id} sent: ${signature}`);

        // Update refund status
        await this.db.query(
            "UPDATE refunds SET status = 'completed', transaction_signature = $1, processed_at = $2 WHERE id = $3",
            [signature, Math.floor(Date.now() / 1000), refund.id]
        );

        return signature;
    }

    /**
     * Get pending refunds count
     */
    async getPendingRefundsCount() {
        const result = await this.db.query(
            "SELECT COUNT(*) as count FROM refunds WHERE status = 'pending'"
        );
        return parseInt(result.rows[0].count);
    }
}

module.exports = PayoutService;
