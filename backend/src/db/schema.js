/**
 * Database Schema for Pump Ponies
 * Uses PostgreSQL for production
 * 
 * SECURITY: Private keys are encrypted at rest using AES-256-GCM
 */

const { Pool } = require('pg');
const { encryptPrivateKey, decryptPrivateKey, isEncrypted } = require('../utils/encryption');

class PumpPoniesDB {
    constructor(connectionString, encryptionSecret) {
        this.pool = new Pool({
            connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        this.encryptionSecret = encryptionSecret;
        if (!encryptionSecret || encryptionSecret.length < 32) {
            console.warn('[SECURITY WARNING] ENCRYPTION_SECRET not set or too short! Private keys will be stored unencrypted.');
        }
    }

    async query(text, params) {
        const result = await this.pool.query(text, params);
        return result;
    }

    /**
     * Initialize all database tables
     */
    async initialize() {
        // Races table
        await this.query(`
            CREATE TABLE IF NOT EXISTS races (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                winner INTEGER,
                predetermined_winner INTEGER,
                start_time BIGINT,
                created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
                closed_at BIGINT,
                completed_at BIGINT
            )
        `);

        // Horses table (linked to races)
        await this.query(`
            CREATE TABLE IF NOT EXISTS horses (
                id SERIAL PRIMARY KEY,
                race_id TEXT NOT NULL REFERENCES races(id),
                horse_number INTEGER NOT NULL,
                name TEXT NOT NULL,
                UNIQUE(race_id, horse_number)
            )
        `);

        // Deposit addresses table (unique per bet request)
        await this.query(`
            CREATE TABLE IF NOT EXISTS deposit_addresses (
                id TEXT PRIMARY KEY,
                address TEXT NOT NULL UNIQUE,
                private_key TEXT NOT NULL,
                race_id TEXT NOT NULL REFERENCES races(id),
                horse_number INTEGER NOT NULL,
                user_wallet TEXT,
                status TEXT NOT NULL DEFAULT 'waiting',
                amount_received REAL DEFAULT 0,
                transaction_signature TEXT,
                expires_at BIGINT NOT NULL,
                created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
                confirmed_at BIGINT
            )
        `);

        // Bets table (confirmed deposits become bets)
        await this.query(`
            CREATE TABLE IF NOT EXISTS bets (
                id TEXT PRIMARY KEY,
                race_id TEXT NOT NULL REFERENCES races(id),
                horse_number INTEGER NOT NULL,
                deposit_address_id TEXT NOT NULL REFERENCES deposit_addresses(id),
                user_wallet TEXT NOT NULL,
                amount REAL NOT NULL,
                transaction_signature TEXT NOT NULL,
                odds_at_placement REAL,
                winnings REAL,
                payout_status TEXT DEFAULT 'pending',
                payout_signature TEXT,
                created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
            )
        `);

        // Payouts table (track all outgoing payments)
        await this.query(`
            CREATE TABLE IF NOT EXISTS payouts (
                id TEXT PRIMARY KEY,
                bet_id TEXT NOT NULL REFERENCES bets(id),
                user_wallet TEXT NOT NULL,
                amount REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                transaction_signature TEXT,
                error_message TEXT,
                created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
                processed_at BIGINT
            )
        `);

        // Refunds table (track rejected deposits that need refunds)
        await this.query(`
            CREATE TABLE IF NOT EXISTS refunds (
                id TEXT PRIMARY KEY,
                deposit_id TEXT NOT NULL REFERENCES deposit_addresses(id),
                user_wallet TEXT NOT NULL,
                amount REAL NOT NULL,
                reason TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                transaction_signature TEXT,
                error_message TEXT,
                created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
                processed_at BIGINT
            )
        `);

        // Config table (store runtime config like master wallet)
        await this.query(`
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
            )
        `);

        // Create indexes for performance
        await this.query(`CREATE INDEX IF NOT EXISTS idx_deposit_status ON deposit_addresses(status)`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_deposit_address ON deposit_addresses(address)`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_bets_race ON bets(race_id)`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_wallet)`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status)`);
        await this.query(`CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status)`);

        console.log('Database initialized successfully');
    }

    // ===================
    // RACE OPERATIONS
    // ===================

    async createRace(id, title, horses, startTime, predeterminedWinner = null) {
        await this.query(
            `INSERT INTO races (id, title, status, start_time, predetermined_winner) VALUES ($1, $2, 'pending', $3, $4)`,
            [id, title, startTime, predeterminedWinner]
        );

        for (let i = 0; i < horses.length; i++) {
            await this.query(
                `INSERT INTO horses (race_id, horse_number, name) VALUES ($1, $2, $3)`,
                [id, i + 1, horses[i]]
            );
        }

        return await this.getRace(id);
    }

    async getRace(id) {
        const raceResult = await this.query('SELECT * FROM races WHERE id = $1', [id]);
        if (raceResult.rows.length === 0) return null;

        const race = raceResult.rows[0];
        const horsesResult = await this.query(
            'SELECT horse_number, name FROM horses WHERE race_id = $1 ORDER BY horse_number',
            [id]
        );

        return { ...race, horses: horsesResult.rows };
    }

    async getActiveRace() {
        const result = await this.query(
            "SELECT * FROM races WHERE status IN ('pending', 'open', 'closed') ORDER BY created_at DESC LIMIT 1"
        );
        
        if (result.rows.length === 0) return null;
        return await this.getRace(result.rows[0].id);
    }

    async getAllRaces() {
        const result = await this.query('SELECT * FROM races ORDER BY created_at DESC');
        return result.rows;
    }

    async updateRaceStatus(id, status) {
        const now = Math.floor(Date.now() / 1000);
        let query, params;
        
        if (status === 'closed') {
            query = 'UPDATE races SET status = $1, closed_at = $2 WHERE id = $3';
            params = [status, now, id];
        } else if (status === 'completed') {
            query = 'UPDATE races SET status = $1, completed_at = $2 WHERE id = $3';
            params = [status, now, id];
        } else {
            query = 'UPDATE races SET status = $1 WHERE id = $2';
            params = [status, id];
        }
        
        await this.query(query, params);
        return await this.getRace(id);
    }

    async setRaceWinner(id, winner) {
        const now = Math.floor(Date.now() / 1000);
        await this.query(
            'UPDATE races SET winner = $1, status = $2, completed_at = $3 WHERE id = $4',
            [winner, 'completed', now, id]
        );
        return await this.getRace(id);
    }

    // ===================
    // DEPOSIT ADDRESS OPERATIONS
    // ===================

    async createDepositAddress(id, address, privateKey, raceId, horseNumber, expiresAt, userWallet = null) {
        let storedKey = privateKey;
        if (this.encryptionSecret) {
            try {
                storedKey = encryptPrivateKey(privateKey, this.encryptionSecret);
                console.log(`[SECURITY] Private key encrypted for deposit ${id}`);
            } catch (error) {
                console.error('[SECURITY ERROR] Failed to encrypt private key:', error.message);
            }
        }
        
        await this.query(
            `INSERT INTO deposit_addresses (id, address, private_key, race_id, horse_number, user_wallet, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, address, storedKey, raceId, horseNumber, userWallet, expiresAt]
        );
        
        return await this.getDepositAddress(id);
    }

    async getDepositAddress(id) {
        const result = await this.query('SELECT * FROM deposit_addresses WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    
    async getDepositAddressWithKey(id) {
        const deposit = await this.getDepositAddress(id);
        if (!deposit) return null;
        
        if (this.encryptionSecret && deposit.private_key && isEncrypted(deposit.private_key)) {
            try {
                deposit.private_key = decryptPrivateKey(deposit.private_key, this.encryptionSecret);
            } catch (error) {
                console.error(`[SECURITY ERROR] Failed to decrypt private key for deposit ${id}:`, error.message);
                deposit.private_key = null;
            }
        }
        
        return deposit;
    }
    
    async getDepositByAddressWithKey(address) {
        const result = await this.query('SELECT * FROM deposit_addresses WHERE address = $1', [address]);
        const deposit = result.rows[0];
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

    async getDepositByAddress(address) {
        const result = await this.query('SELECT * FROM deposit_addresses WHERE address = $1', [address]);
        return result.rows[0] || null;
    }

    async getWaitingDeposits() {
        const now = Math.floor(Date.now() / 1000);
        const result = await this.query(
            "SELECT * FROM deposit_addresses WHERE status = 'waiting' AND expires_at > $1",
            [now]
        );
        return result.rows;
    }

    async getExpiredDeposits() {
        const now = Math.floor(Date.now() / 1000);
        const result = await this.query(
            "SELECT * FROM deposit_addresses WHERE status = 'waiting' AND expires_at <= $1",
            [now]
        );
        return result.rows;
    }

    async updateDepositStatus(id, status, amountReceived = null, txSignature = null, userWallet = null) {
        const now = Math.floor(Date.now() / 1000);
        let query = 'UPDATE deposit_addresses SET status = $1';
        let params = [status];
        let paramIndex = 2;
        
        if (amountReceived !== null) {
            query += `, amount_received = $${paramIndex++}`;
            params.push(amountReceived);
        }
        if (txSignature !== null) {
            query += `, transaction_signature = $${paramIndex++}`;
            params.push(txSignature);
        }
        if (userWallet !== null) {
            query += `, user_wallet = $${paramIndex++}`;
            params.push(userWallet);
        }
        if (status === 'confirmed') {
            query += `, confirmed_at = $${paramIndex++}`;
            params.push(now);
        }
        
        query += ` WHERE id = $${paramIndex}`;
        params.push(id);
        
        await this.query(query, params);
        return await this.getDepositAddress(id);
    }

    // ===================
    // BET OPERATIONS
    // ===================

    async createBet(id, raceId, horseNumber, depositAddressId, userWallet, amount, txSignature, oddsAtPlacement) {
        await this.query(
            `INSERT INTO bets (id, race_id, horse_number, deposit_address_id, user_wallet, amount, transaction_signature, odds_at_placement) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [id, raceId, horseNumber, depositAddressId, userWallet, amount, txSignature, oddsAtPlacement]
        );
        
        return await this.getBet(id);
    }

    async getBet(id) {
        const result = await this.query('SELECT * FROM bets WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    async getBetsForRace(raceId) {
        const result = await this.query('SELECT * FROM bets WHERE race_id = $1 ORDER BY created_at', [raceId]);
        return result.rows;
    }

    async getBetsForUser(userWallet) {
        const result = await this.query('SELECT * FROM bets WHERE user_wallet = $1 ORDER BY created_at DESC', [userWallet]);
        return result.rows;
    }

    async getRacePoolStats(raceId) {
        const result = await this.query(`
            SELECT 
                horse_number,
                COUNT(*) as bet_count,
                COALESCE(SUM(amount), 0) as total_amount
            FROM bets 
            WHERE race_id = $1
            GROUP BY horse_number
        `, [raceId]);

        const pools = {};
        result.rows.forEach(s => {
            pools[s.horse_number] = {
                bets: parseInt(s.bet_count),
                amount: parseFloat(s.total_amount) || 0
            };
        });

        // Fill in zeros for horses with no bets
        const race = await this.getRace(raceId);
        if (race && race.horses) {
            race.horses.forEach(h => {
                if (!pools[h.horse_number]) {
                    pools[h.horse_number] = { bets: 0, amount: 0 };
                }
            });
        }

        return pools;
    }

    async updateBetWinnings(betId, winnings) {
        await this.query('UPDATE bets SET winnings = $1 WHERE id = $2', [winnings, betId]);
    }

    async getWinningBets(raceId, winningHorse) {
        const result = await this.query(
            'SELECT * FROM bets WHERE race_id = $1 AND horse_number = $2',
            [raceId, winningHorse]
        );
        return result.rows;
    }

    // ===================
    // PAYOUT OPERATIONS
    // ===================

    async createPayout(id, betId, userWallet, amount) {
        await this.query(
            `INSERT INTO payouts (id, bet_id, user_wallet, amount) VALUES ($1, $2, $3, $4)`,
            [id, betId, userWallet, amount]
        );
        
        return await this.getPayout(id);
    }

    async getPayout(id) {
        const result = await this.query('SELECT * FROM payouts WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    async getPendingPayouts() {
        const result = await this.query("SELECT * FROM payouts WHERE status = 'pending' ORDER BY created_at");
        return result.rows;
    }

    async updatePayoutStatus(id, status, txSignature = null, errorMessage = null) {
        const now = Math.floor(Date.now() / 1000);
        let query = 'UPDATE payouts SET status = $1';
        let params = [status];
        let paramIndex = 2;
        
        if (txSignature) {
            query += `, transaction_signature = $${paramIndex++}`;
            params.push(txSignature);
        }
        if (errorMessage) {
            query += `, error_message = $${paramIndex++}`;
            params.push(errorMessage);
        }
        if (status === 'completed' || status === 'failed') {
            query += `, processed_at = $${paramIndex++}`;
            params.push(now);
        }
        
        query += ` WHERE id = $${paramIndex}`;
        params.push(id);
        
        await this.query(query, params);
        return await this.getPayout(id);
    }

    // ===================
    // CONFIG OPERATIONS
    // ===================

    async setConfig(key, value) {
        const now = Math.floor(Date.now() / 1000);
        await this.query(`
            INSERT INTO config (key, value, updated_at) VALUES ($1, $2, $3)
            ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3
        `, [key, value, now]);
    }

    async getConfig(key) {
        const result = await this.query('SELECT value FROM config WHERE key = $1', [key]);
        return result.rows[0]?.value || null;
    }

    // ===================
    // DIRECT QUERY ACCESS (for admin endpoints)
    // ===================
    
    get db() {
        // Compatibility layer for direct query access
        return {
            prepare: (sql) => ({
                all: async (...params) => {
                    const result = await this.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), params);
                    return result.rows;
                },
                get: async (...params) => {
                    const result = await this.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), params);
                    return result.rows[0];
                },
                run: async (...params) => {
                    await this.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), params);
                }
            })
        };
    }

    // ===================
    // CLEANUP
    // ===================

    async close() {
        await this.pool.end();
    }
}

module.exports = PumpPoniesDB;
