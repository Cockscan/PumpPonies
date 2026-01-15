/**
 * Database Schema for Pump Ponies
 * Uses SQLite for simplicity - can be migrated to PostgreSQL for production
 * 
 * SECURITY: Private keys are encrypted at rest using AES-256-GCM
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { encryptPrivateKey, decryptPrivateKey, isEncrypted } = require('../utils/encryption');

class PumpPoniesDB {
    constructor(dbPath, encryptionSecret) {
        // Ensure data directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        
        // Store encryption secret for private key encryption
        this.encryptionSecret = encryptionSecret;
        if (!encryptionSecret || encryptionSecret.length < 32) {
            console.warn('[SECURITY WARNING] ENCRYPTION_SECRET not set or too short! Private keys will be stored unencrypted.');
        }
    }

    /**
     * Initialize all database tables
     */
    initialize() {
        // Races table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS races (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                winner INTEGER,
                predetermined_winner INTEGER,
                start_time INTEGER,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                closed_at INTEGER,
                completed_at INTEGER
            )
        `);

        // Horses table (linked to races)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS horses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                race_id TEXT NOT NULL,
                horse_number INTEGER NOT NULL,
                name TEXT NOT NULL,
                FOREIGN KEY (race_id) REFERENCES races(id),
                UNIQUE(race_id, horse_number)
            )
        `);

        // Deposit addresses table (unique per bet request)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS deposit_addresses (
                id TEXT PRIMARY KEY,
                address TEXT NOT NULL UNIQUE,
                private_key TEXT NOT NULL,
                race_id TEXT NOT NULL,
                horse_number INTEGER NOT NULL,
                user_wallet TEXT,
                status TEXT NOT NULL DEFAULT 'waiting',
                amount_received REAL DEFAULT 0,
                transaction_signature TEXT,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                confirmed_at INTEGER,
                FOREIGN KEY (race_id) REFERENCES races(id)
            )
        `);

        // Bets table (confirmed deposits become bets)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS bets (
                id TEXT PRIMARY KEY,
                race_id TEXT NOT NULL,
                horse_number INTEGER NOT NULL,
                deposit_address_id TEXT NOT NULL,
                user_wallet TEXT NOT NULL,
                amount REAL NOT NULL,
                transaction_signature TEXT NOT NULL,
                odds_at_placement REAL,
                winnings REAL,
                payout_status TEXT DEFAULT 'pending',
                payout_signature TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (race_id) REFERENCES races(id),
                FOREIGN KEY (deposit_address_id) REFERENCES deposit_addresses(id)
            )
        `);

        // Payouts table (track all outgoing payments)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS payouts (
                id TEXT PRIMARY KEY,
                bet_id TEXT NOT NULL,
                user_wallet TEXT NOT NULL,
                amount REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                transaction_signature TEXT,
                error_message TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                processed_at INTEGER,
                FOREIGN KEY (bet_id) REFERENCES bets(id)
            )
        `);

        // Refunds table (track rejected deposits that need refunds)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS refunds (
                id TEXT PRIMARY KEY,
                deposit_id TEXT NOT NULL,
                user_wallet TEXT NOT NULL,
                amount REAL NOT NULL,
                reason TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                transaction_signature TEXT,
                error_message TEXT,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                processed_at INTEGER,
                FOREIGN KEY (deposit_id) REFERENCES deposit_addresses(id)
            )
        `);

        // Config table (store runtime config like master wallet)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Create indexes for performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_deposit_status ON deposit_addresses(status);
            CREATE INDEX IF NOT EXISTS idx_deposit_address ON deposit_addresses(address);
            CREATE INDEX IF NOT EXISTS idx_bets_race ON bets(race_id);
            CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_wallet);
            CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
            CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
        `);

        console.log('Database initialized successfully');
    }

    // ===================
    // RACE OPERATIONS
    // ===================

    createRace(id, title, horses, startTime, predeterminedWinner = null) {
        const insertRace = this.db.prepare(`
            INSERT INTO races (id, title, status, start_time, predetermined_winner)
            VALUES (?, ?, 'pending', ?, ?)
        `);

        const insertHorse = this.db.prepare(`
            INSERT INTO horses (race_id, horse_number, name)
            VALUES (?, ?, ?)
        `);

        const transaction = this.db.transaction(() => {
            insertRace.run(id, title, startTime, predeterminedWinner);
            horses.forEach((name, index) => {
                insertHorse.run(id, index + 1, name);
            });
        });

        transaction();
        return this.getRace(id);
    }

    getRace(id) {
        const race = this.db.prepare('SELECT * FROM races WHERE id = ?').get(id);
        if (!race) return null;

        const horses = this.db.prepare(
            'SELECT horse_number, name FROM horses WHERE race_id = ? ORDER BY horse_number'
        ).all(id);

        return { ...race, horses };
    }

    getActiveRace() {
        const race = this.db.prepare(
            "SELECT * FROM races WHERE status IN ('pending', 'open', 'closed') ORDER BY created_at DESC LIMIT 1"
        ).get();
        
        if (!race) return null;
        return this.getRace(race.id);
    }

    getAllRaces() {
        return this.db.prepare('SELECT * FROM races ORDER BY created_at DESC').all();
    }

    updateRaceStatus(id, status) {
        const updates = { status };
        if (status === 'closed') updates.closed_at = Math.floor(Date.now() / 1000);
        if (status === 'completed') updates.completed_at = Math.floor(Date.now() / 1000);

        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        this.db.prepare(`UPDATE races SET ${setClauses} WHERE id = ?`).run(...values);
        return this.getRace(id);
    }

    setRaceWinner(id, winner) {
        this.db.prepare(
            'UPDATE races SET winner = ?, status = ?, completed_at = ? WHERE id = ?'
        ).run(winner, 'completed', Math.floor(Date.now() / 1000), id);
        return this.getRace(id);
    }

    // ===================
    // DEPOSIT ADDRESS OPERATIONS
    // ===================

    createDepositAddress(id, address, privateKey, raceId, horseNumber, expiresAt, userWallet = null) {
        // Encrypt the private key before storing
        let storedKey = privateKey;
        if (this.encryptionSecret) {
            try {
                storedKey = encryptPrivateKey(privateKey, this.encryptionSecret);
                console.log(`[SECURITY] Private key encrypted for deposit ${id}`);
            } catch (error) {
                console.error('[SECURITY ERROR] Failed to encrypt private key:', error.message);
                // Fall back to unencrypted (not recommended in production)
            }
        }
        
        this.db.prepare(`
            INSERT INTO deposit_addresses (id, address, private_key, race_id, horse_number, user_wallet, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, address, storedKey, raceId, horseNumber, userWallet, expiresAt);
        
        return this.getDepositAddress(id);
    }

    getDepositAddress(id) {
        return this.db.prepare('SELECT * FROM deposit_addresses WHERE id = ?').get(id);
    }
    
    /**
     * Get deposit address with decrypted private key (for use in transactions)
     * @param {string} id - Deposit ID
     * @returns {object} Deposit with decrypted private_key
     */
    getDepositAddressWithKey(id) {
        const deposit = this.db.prepare('SELECT * FROM deposit_addresses WHERE id = ?').get(id);
        if (!deposit) return null;
        
        // Decrypt the private key if it's encrypted
        if (this.encryptionSecret && deposit.private_key && isEncrypted(deposit.private_key)) {
            try {
                deposit.private_key = decryptPrivateKey(deposit.private_key, this.encryptionSecret);
            } catch (error) {
                console.error(`[SECURITY ERROR] Failed to decrypt private key for deposit ${id}:`, error.message);
                deposit.private_key = null; // Don't expose corrupted/wrong key
            }
        }
        
        return deposit;
    }
    
    /**
     * Get deposit by address with decrypted private key
     */
    getDepositByAddressWithKey(address) {
        const deposit = this.db.prepare('SELECT * FROM deposit_addresses WHERE address = ?').get(address);
        if (!deposit) return null;
        
        if (this.encryptionSecret && deposit.private_key && isEncrypted(deposit.private_key)) {
            try {
                deposit.private_key = decryptPrivateKey(deposit.private_key, this.encryptionSecret);
            } catch (error) {
                console.error(`[SECURITY ERROR] Failed to decrypt private key:`, error.message);
                deposit.private_key = null;
            }
        }
        
        return deposit;
    }

    getDepositByAddress(address) {
        return this.db.prepare('SELECT * FROM deposit_addresses WHERE address = ?').get(address);
    }

    getWaitingDeposits() {
        return this.db.prepare(
            "SELECT * FROM deposit_addresses WHERE status = 'waiting' AND expires_at > ?"
        ).all(Math.floor(Date.now() / 1000));
    }

    getExpiredDeposits() {
        return this.db.prepare(
            "SELECT * FROM deposit_addresses WHERE status = 'waiting' AND expires_at <= ?"
        ).all(Math.floor(Date.now() / 1000));
    }

    updateDepositStatus(id, status, amountReceived = null, txSignature = null, userWallet = null) {
        const updates = { status };
        if (amountReceived !== null) updates.amount_received = amountReceived;
        if (txSignature !== null) updates.transaction_signature = txSignature;
        if (userWallet !== null) updates.user_wallet = userWallet;
        if (status === 'confirmed') updates.confirmed_at = Math.floor(Date.now() / 1000);

        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        this.db.prepare(`UPDATE deposit_addresses SET ${setClauses} WHERE id = ?`).run(...values);
        return this.getDepositAddress(id);
    }

    // ===================
    // BET OPERATIONS
    // ===================

    createBet(id, raceId, horseNumber, depositAddressId, userWallet, amount, txSignature, oddsAtPlacement) {
        this.db.prepare(`
            INSERT INTO bets (id, race_id, horse_number, deposit_address_id, user_wallet, amount, transaction_signature, odds_at_placement)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, raceId, horseNumber, depositAddressId, userWallet, amount, txSignature, oddsAtPlacement);
        
        return this.getBet(id);
    }

    getBet(id) {
        return this.db.prepare('SELECT * FROM bets WHERE id = ?').get(id);
    }

    getBetsForRace(raceId) {
        return this.db.prepare('SELECT * FROM bets WHERE race_id = ? ORDER BY created_at').all(raceId);
    }

    getBetsForUser(userWallet) {
        return this.db.prepare('SELECT * FROM bets WHERE user_wallet = ? ORDER BY created_at DESC').all(userWallet);
    }

    getRacePoolStats(raceId) {
        const stats = this.db.prepare(`
            SELECT 
                horse_number,
                COUNT(*) as bet_count,
                SUM(amount) as total_amount
            FROM bets 
            WHERE race_id = ?
            GROUP BY horse_number
        `).all(raceId);

        const pools = {};
        stats.forEach(s => {
            pools[s.horse_number] = {
                bets: s.bet_count,
                amount: s.total_amount || 0
            };
        });

        // Fill in zeros for horses with no bets
        const race = this.getRace(raceId);
        if (race && race.horses) {
            race.horses.forEach(h => {
                if (!pools[h.horse_number]) {
                    pools[h.horse_number] = { bets: 0, amount: 0 };
                }
            });
        }

        return pools;
    }

    updateBetWinnings(betId, winnings) {
        this.db.prepare('UPDATE bets SET winnings = ? WHERE id = ?').run(winnings, betId);
    }

    getWinningBets(raceId, winningHorse) {
        return this.db.prepare(
            'SELECT * FROM bets WHERE race_id = ? AND horse_number = ?'
        ).all(raceId, winningHorse);
    }

    // ===================
    // PAYOUT OPERATIONS
    // ===================

    createPayout(id, betId, userWallet, amount) {
        this.db.prepare(`
            INSERT INTO payouts (id, bet_id, user_wallet, amount)
            VALUES (?, ?, ?, ?)
        `).run(id, betId, userWallet, amount);
        
        return this.getPayout(id);
    }

    getPayout(id) {
        return this.db.prepare('SELECT * FROM payouts WHERE id = ?').get(id);
    }

    getPendingPayouts() {
        return this.db.prepare("SELECT * FROM payouts WHERE status = 'pending' ORDER BY created_at").all();
    }

    updatePayoutStatus(id, status, txSignature = null, errorMessage = null) {
        const updates = { status };
        if (txSignature) updates.transaction_signature = txSignature;
        if (errorMessage) updates.error_message = errorMessage;
        if (status === 'completed' || status === 'failed') {
            updates.processed_at = Math.floor(Date.now() / 1000);
        }

        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), id];

        this.db.prepare(`UPDATE payouts SET ${setClauses} WHERE id = ?`).run(...values);
        return this.getPayout(id);
    }

    // ===================
    // CONFIG OPERATIONS
    // ===================

    setConfig(key, value) {
        this.db.prepare(`
            INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
        `).run(key, value, Math.floor(Date.now() / 1000), value, Math.floor(Date.now() / 1000));
    }

    getConfig(key) {
        const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key);
        return row ? row.value : null;
    }

    // ===================
    // CLEANUP
    // ===================

    close() {
        this.db.close();
    }
}

module.exports = PumpPoniesDB;
