/**
 * Pump Ponies Backend Server
 * Main API server with Solana wallet monitoring
 * 
 * SECURITY: All admin endpoints require Bearer token authentication
 * All inputs are sanitized and rate limited
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Connection } = require('@solana/web3.js');
const WebSocket = require('ws');

// Import services
const PumpPoniesDB = require('./db/schema');
const WalletService = require('./services/wallet');
const DepositMonitor = require('./services/monitor');
const PayoutService = require('./services/payout');

// Import security middleware
const {
    rateLimit,
    sanitizeInput,
    auditLogger,
    getAuditLogs,
    securityHeaders,
    validateRequest,
    isValidRaceId,
    isSignatureProcessed,
    markSignatureProcessed
} = require('./middleware/security');

// Configuration
const PORT = process.env.PORT || 20101;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-admin-token';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/pump_ponies';
const MIN_BET = parseFloat(process.env.MIN_BET_SOL || 0.01);
const MAX_BET = parseFloat(process.env.MAX_BET_SOL || 20);
const DEPOSIT_EXPIRY_MINUTES = parseInt(process.env.DEPOSIT_EXPIRY_MINUTES || 30);
const MONITOR_INTERVAL = parseInt(process.env.MONITOR_INTERVAL_MS || 5000);
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET; // For encrypting private keys in DB

// Default horse names
const DEFAULT_HORSES = [
    'Neighkamoto', 'Stablecolt', 'Whalehinny', 'Hoofproof',
    'Gallopchain', 'Mareketcap', 'Stalloshi', 'Trothereum',
    'Neighonce', 'Foalment'
];

// Initialize services
console.log('Initializing Pump Ponies Backend...');
console.log(`Solana RPC: ${SOLANA_RPC}`);
console.log(`Database: PostgreSQL`);

const connection = new Connection(SOLANA_RPC, 'confirmed');
const db = new PumpPoniesDB(DATABASE_URL, ENCRYPTION_SECRET);

// Security check for encryption
if (!ENCRYPTION_SECRET || ENCRYPTION_SECRET.length < 32) {
    console.warn('\n⚠️  WARNING: ENCRYPTION_SECRET not set or too short!');
    console.warn('⚠️  Private keys will be stored UNENCRYPTED in the database.');
    console.warn('⚠️  Set ENCRYPTION_SECRET in .env (minimum 32 characters)\n');
}

const walletService = new WalletService(connection);
const depositMonitor = new DepositMonitor(db, walletService, {
    intervalMs: MONITOR_INTERVAL,
    minBet: MIN_BET,
    maxBet: MAX_BET
});
const payoutService = new PayoutService(
    connection, 
    db, 
    process.env.MASTER_WALLET_PRIVATE_KEY
);

// Express app
const app = express();

// SECURITY: Configure CORS with specific origins in production
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
        : true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// SECURITY: Limit request body size
app.use(express.json({ limit: '100kb' }));

// SECURITY: Apply security headers to all requests
app.use(securityHeaders);

// SECURITY: Sanitize all inputs
app.use(sanitizeInput);

// SECURITY: Audit log all requests
app.use(auditLogger);

// WebSocket clients for real-time updates
const wsClients = new Set();

// ===================
// MIDDLEWARE
// ===================

// Admin authentication middleware with timing-safe comparison
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Log failed auth attempts
        console.warn(`[SECURITY] Missing auth header from ${req.ip}`);
        return res.status(401).json({ success: false, error: 'Missing authorization header' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Timing-safe comparison to prevent timing attacks
    if (!token || token.length !== ADMIN_TOKEN.length) {
        console.warn(`[SECURITY] Invalid token length from ${req.ip}`);
        return res.status(401).json({ success: false, error: 'Invalid admin token' });
    }
    
    let valid = true;
    for (let i = 0; i < token.length; i++) {
        if (token[i] !== ADMIN_TOKEN[i]) valid = false;
    }
    
    if (!valid) {
        console.warn(`[SECURITY] Invalid admin token from ${req.ip}`);
        return res.status(401).json({ success: false, error: 'Invalid admin token' });
    }
    
    next();
};

// Response helper
const respond = (res, data, error = null) => {
    res.json({
        success: !error,
        data: error ? null : data,
        error: error
    });
};

// ===================
// PUBLIC ENDPOINTS
// ===================

// Apply public rate limiting
app.use('/health', rateLimit('public'));
app.use('/race', rateLimit('public'));
app.use('/races', rateLimit('public'));
app.use('/user', rateLimit('public'));

// Apply stricter rate limiting for betting
app.use('/bet', rateLimit('betting'));

// Apply admin rate limiting
app.use('/admin', rateLimit('admin'));

// Health check
app.get('/health', (req, res) => {
    respond(res, { status: 'ok', timestamp: Date.now() });
});

// Get active race
app.get('/race/active', async (req, res) => {
    try {
        const race = await db.getActiveRace();
        if (!race) {
            return respond(res, null, 'No active race');
        }
        
        // Add pool stats
        const pools = await db.getRacePoolStats(race.id);
        respond(res, { ...race, pools });
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get all races
app.get('/races', async (req, res) => {
    try {
        const races = await db.getAllRaces();
        respond(res, races);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get specific race
app.get('/race/:id', async (req, res) => {
    try {
        const race = await db.getRace(req.params.id);
        if (!race) {
            return respond(res, null, 'Race not found');
        }
        
        const pools = await db.getRacePoolStats(race.id);
        respond(res, { ...race, pools });
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get race pool stats
app.get('/race/:id/pools', async (req, res) => {
    try {
        const pools = await db.getRacePoolStats(req.params.id);
        const totalPool = Object.values(pools).reduce((sum, p) => sum + p.amount, 0);
        const totalBets = Object.values(pools).reduce((sum, p) => sum + p.bets, 0);
        
        // Calculate odds for each horse
        const odds = {};
        for (const [horse, data] of Object.entries(pools)) {
            if (data.amount > 0 && totalPool > 0) {
                odds[horse] = totalPool / data.amount;
            } else {
                odds[horse] = null;
            }
        }
        
        respond(res, { pools, odds, totalPool, totalBets });
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Generate deposit address for betting
app.post('/bet/deposit-address', 
    validateRequest({
        race_id: { required: true, type: 'race_id' },
        horse_number: { required: true, type: 'horse_number' },
        user_wallet: { required: false, type: 'solana_address' }
    }),
    async (req, res) => {
    try {
        const { race_id, horse_number, user_wallet } = req.body;
        
        // Validate race exists and is open
        const race = await db.getRace(race_id);
        if (!race) {
            return respond(res, null, 'Race not found');
        }
        if (race.status !== 'open') {
            return respond(res, null, `Race is not open for betting (status: ${race.status})`);
        }
        
        // Double check race hasn't started
        const now = Math.floor(Date.now() / 1000);
        if (race.start_time && now >= race.start_time) {
            return respond(res, null, 'Race has already started');
        }
        
        // Validate horse number against actual horse count
        if (horse_number < 1 || horse_number > race.horses.length) {
            return respond(res, null, `Invalid horse number. Must be 1-${race.horses.length}`);
        }
        
        // Generate unique deposit address
        const { publicKey, privateKey } = walletService.generateDepositAddress();
        const depositId = uuidv4();
        const expiresAt = Math.floor(Date.now() / 1000) + (DEPOSIT_EXPIRY_MINUTES * 60);
        
        // Store in database
        const deposit = await db.createDepositAddress(
            depositId,
            publicKey,
            privateKey,
            race_id,
            horse_number,
            expiresAt,
            user_wallet || null
        );
        
        console.log(`Generated deposit address for race ${race_id}, horse #${horse_number}: ${publicKey.slice(0, 8)}...`);
        
        respond(res, {
            deposit_id: depositId,
            deposit_address: publicKey,
            race_id,
            horse_number,
            horse_name: race.horses.find(h => h.horse_number === horse_number)?.name,
            min_bet: MIN_BET,
            max_bet: MAX_BET,
            expires_at: expiresAt,
            expires_in_seconds: DEPOSIT_EXPIRY_MINUTES * 60
        });
        
    } catch (error) {
        console.error('Error generating deposit address:', error);
        respond(res, null, error.message);
    }
});

// Check deposit status
app.get('/bet/status/:deposit_id', async (req, res) => {
    try {
        const deposit = await db.getDepositAddress(req.params.deposit_id);
        if (!deposit) {
            return respond(res, null, 'Deposit not found');
        }
        
        // Don't expose private key
        const { private_key, ...safeDeposit } = deposit;
        
        // If confirmed, include bet details
        if (deposit.status === 'confirmed') {
            const betResult = await db.query(
                'SELECT * FROM bets WHERE deposit_address_id = $1',
                [deposit.id]
            );
            
            respond(res, { ...safeDeposit, bet: betResult.rows[0] });
        } else {
            respond(res, safeDeposit);
        }
        
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Check deposit by address
app.get('/bet/address/:address', async (req, res) => {
    try {
        const deposit = await db.getDepositByAddress(req.params.address);
        if (!deposit) {
            return respond(res, null, 'Deposit address not found');
        }
        
        // Also check current balance
        const balance = await walletService.getBalance(req.params.address);
        
        const { private_key, ...safeDeposit } = deposit;
        respond(res, { ...safeDeposit, current_balance: balance });
        
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get bets for a race
app.get('/race/:id/bets', async (req, res) => {
    try {
        const bets = await db.getBetsForRace(req.params.id);
        respond(res, bets);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get bets for a user
app.get('/user/:wallet/bets', async (req, res) => {
    try {
        if (!walletService.isValidAddress(req.params.wallet)) {
            return respond(res, null, 'Invalid wallet address');
        }
        
        const bets = await db.getBetsForUser(req.params.wallet);
        respond(res, bets);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// ===================
// ADMIN ENDPOINTS
// ===================

// Create a new race
app.post('/admin/race/create', adminAuth, async (req, res) => {
    try {
        const { title, horses, start_time, predetermined_winner } = req.body;
        
        if (!title) {
            return respond(res, null, 'Missing title');
        }
        
        const horseNames = horses || DEFAULT_HORSES;
        if (horseNames.length !== 10) {
            return respond(res, null, 'Must have exactly 10 horses');
        }
        
        const raceId = 'race_' + Date.now().toString(36);
        const startTime = start_time || Math.floor(Date.now() / 1000) + 1800; // 30 min from now
        
        const race = await db.createRace(
            raceId,
            title,
            horseNames,
            startTime,
            predetermined_winner || null
        );
        
        console.log(`Race created: ${raceId} - ${title}`);
        
        // Broadcast to WebSocket clients
        broadcastToClients({ type: 'race_created', race });
        
        respond(res, race);
        
    } catch (error) {
        console.error('Error creating race:', error);
        respond(res, null, error.message);
    }
});

// Open race for betting
app.post('/admin/race/open', adminAuth, async (req, res) => {
    try {
        const { race_id } = req.body;
        
        if (!race_id) {
            return respond(res, null, 'Missing race_id');
        }
        
        const race = await db.updateRaceStatus(race_id, 'open');
        if (!race) {
            return respond(res, null, 'Race not found');
        }
        
        console.log(`Race opened for betting: ${race_id}`);
        broadcastToClients({ type: 'race_opened', race });
        
        respond(res, race);
        
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Close race betting
app.post('/admin/race/close', adminAuth, async (req, res) => {
    try {
        const { race_id } = req.body;
        
        if (!race_id) {
            return respond(res, null, 'Missing race_id');
        }
        
        const race = await db.updateRaceStatus(race_id, 'closed');
        if (!race) {
            return respond(res, null, 'Race not found');
        }
        
        // Get all bets for the race
        const bets = await db.getBetsForRace(race_id);
        
        console.log(`Race betting closed: ${race_id} (${bets.length} bets)`);
        broadcastToClients({ type: 'race_closed', race, total_bets: bets.length });
        
        respond(res, { race, bets });
        
    } catch (error) {
        respond(res, null, error.message);
    }
});

// End race and declare winner
app.post('/admin/race/end', adminAuth, async (req, res) => {
    try {
        const { race_id, winner } = req.body;
        
        if (!race_id || !winner) {
            return respond(res, null, 'Missing race_id or winner');
        }
        
        // Validate race exists
        const race = await db.getRace(race_id);
        if (!race) {
            return respond(res, null, 'Race not found');
        }
        
        // Validate winner
        if (winner < 1 || winner > race.horses.length) {
            return respond(res, null, `Invalid winner. Must be 1-${race.horses.length}`);
        }
        
        // Calculate winnings
        const results = await depositMonitor.calculateWinnings(race_id, winner);
        
        // Update race
        const updatedRace = await db.setRaceWinner(race_id, winner);
        
        console.log(`Race ended: ${race_id}, Winner: Horse #${winner}`);
        console.log(`Total pool: ${results.total_pool} SOL, ${results.winners.length} winners`);
        
        broadcastToClients({ type: 'race_ended', race: updatedRace, results });
        
        respond(res, { race: updatedRace, results });
        
    } catch (error) {
        console.error('Error ending race:', error);
        respond(res, null, error.message);
    }
});

// Process payouts
app.post('/admin/payouts/process', adminAuth, async (req, res) => {
    try {
        const result = await payoutService.processAllPayouts();
        respond(res, result);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get pending payouts
app.get('/admin/payouts/pending', adminAuth, async (req, res) => {
    try {
        const payouts = await db.getPendingPayouts();
        respond(res, payouts);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Process refunds (rejected deposits sent back to users)
app.post('/admin/refunds/process', adminAuth, async (req, res) => {
    try {
        const result = await payoutService.processAllRefunds();
        respond(res, result);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get pending refunds
app.get('/admin/refunds/pending', adminAuth, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM refunds WHERE status = 'pending' ORDER BY created_at"
        );
        respond(res, result.rows);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Collect deposits to master wallet
app.post('/admin/collect-deposits', adminAuth, async (req, res) => {
    try {
        const result = await payoutService.collectAllDeposits();
        respond(res, result);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get master wallet balance
app.get('/admin/wallet/balance', adminAuth, async (req, res) => {
    try {
        const balance = await payoutService.getMasterWalletBalance();
        respond(res, { 
            balance,
            address: payoutService.masterWallet?.publicKey.toBase58() || 'Not configured'
        });
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Set config value
app.post('/admin/config', adminAuth, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || value === undefined) {
            return respond(res, null, 'Missing key or value');
        }
        
        await db.setConfig(key, value);
        respond(res, { key, value });
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get config value
app.get('/admin/config/:key', adminAuth, async (req, res) => {
    try {
        const value = await db.getConfig(req.params.key);
        respond(res, { key: req.params.key, value });
    } catch (error) {
        respond(res, null, error.message);
    }
});

// ===================
// ADMIN DASHBOARD ENDPOINTS
// ===================

// Get dashboard statistics
app.get('/admin/stats', adminAuth, async (req, res) => {
    try {
        const races = await db.getAllRaces();
        const activeRaces = races.filter(r => r.status === 'open' || r.status === 'closed');
        const completedRaces = races.filter(r => r.status === 'completed');
        
        // Calculate total pool across active races
        let totalPool = 0;
        let totalBets = 0;
        for (const race of activeRaces) {
            const pools = await db.getRacePoolStats(race.id);
            totalPool += Object.values(pools).reduce((sum, p) => sum + (p.amount || 0), 0);
            totalBets += Object.values(pools).reduce((sum, p) => sum + (p.bets || 0), 0);
        }
        
        // Get pending payouts
        const pendingPayouts = await db.getPendingPayouts();
        const pendingPayoutTotal = pendingPayouts.reduce((sum, p) => sum + (p.winnings || 0), 0);
        
        // Get pending refunds
        const pendingRefundsResult = await db.query(
            "SELECT SUM(amount) as total FROM refunds WHERE status = 'pending'"
        );
        const pendingRefunds = pendingRefundsResult.rows[0];
        
        // Get master wallet balance
        let masterBalance = 0;
        try {
            masterBalance = await payoutService.getMasterWalletBalance();
        } catch (e) {
            console.error('Could not get master wallet balance:', e.message);
        }
        
        respond(res, {
            active_races: activeRaces.length,
            completed_races: completedRaces.length,
            total_pool: totalPool,
            total_bets: totalBets,
            pending_payouts: pendingPayouts.length,
            pending_payout_total: pendingPayoutTotal,
            pending_refunds_total: pendingRefunds?.total || 0,
            master_wallet_balance: masterBalance
        });
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get all deposits for admin
app.get('/admin/deposits', adminAuth, async (req, res) => {
    try {
        const status = req.query.status; // Optional filter
        let result;
        
        if (status) {
            result = await db.query(
                'SELECT d.*, r.title as race_title FROM deposit_addresses d LEFT JOIN races r ON d.race_id = r.id WHERE d.status = $1 ORDER BY d.created_at DESC LIMIT 100',
                [status]
            );
        } else {
            result = await db.query(
                'SELECT d.*, r.title as race_title FROM deposit_addresses d LEFT JOIN races r ON d.race_id = r.id ORDER BY d.created_at DESC LIMIT 100'
            );
        }
        
        // Don't expose private keys
        const safeDeposits = result.rows.map(({ private_key, ...d }) => d);
        respond(res, safeDeposits);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get all bets for admin
app.get('/admin/bets', adminAuth, async (req, res) => {
    try {
        const race_id = req.query.race_id;
        let result;
        
        if (race_id) {
            result = await db.query(
                'SELECT b.*, r.title as race_title FROM bets b LEFT JOIN races r ON b.race_id = r.id WHERE b.race_id = $1 ORDER BY b.created_at DESC',
                [race_id]
            );
        } else {
            result = await db.query(
                'SELECT b.*, r.title as race_title FROM bets b LEFT JOIN races r ON b.race_id = r.id ORDER BY b.created_at DESC LIMIT 200'
            );
        }
        
        respond(res, result.rows);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Get audit logs
app.get('/admin/audit-logs', adminAuth, (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const logs = getAuditLogs(limit);
        respond(res, logs);
    } catch (error) {
        respond(res, null, error.message);
    }
});

// Delete a race (only if no bets placed)
app.delete('/admin/race/:id', adminAuth, async (req, res) => {
    try {
        const raceId = req.params.id;
        const race = await db.getRace(raceId);
        
        if (!race) {
            return respond(res, null, 'Race not found');
        }
        
        // Check if any bets exist
        const bets = await db.getBetsForRace(raceId);
        if (bets.length > 0) {
            return respond(res, null, 'Cannot delete race with existing bets. Complete or refund bets first.');
        }
        
        // Delete race
        await db.query('DELETE FROM horses WHERE race_id = $1', [raceId]);
        await db.query('DELETE FROM races WHERE id = $1', [raceId]);
        
        console.log(`[ADMIN] Race deleted: ${raceId}`);
        respond(res, { deleted: raceId });
    } catch (error) {
        respond(res, null, error.message);
    }
});

// ===================
// WEBSOCKET SERVER
// ===================

function broadcastToClients(message) {
    const data = JSON.stringify(message);
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// Set up WebSocket on same server after HTTP starts
let wss;

// ===================
// MONITOR CALLBACKS
// ===================

depositMonitor.onBetCreated = async (bet, race) => {
    console.log(`[WS] Broadcasting new bet: ${bet.amount} SOL on horse #${bet.horse_number}`);
    
    // Get updated pool stats
    const pools = await db.getRacePoolStats(race.id);
    
    broadcastToClients({
        type: 'bet_placed',
        bet: {
            race_id: bet.race_id,
            horse_number: bet.horse_number,
            amount: bet.amount,
            user_wallet: bet.user_wallet.slice(0, 8) + '...'
        },
        pools
    });
};

// ===================
// START SERVER
// ===================

// Start server with async database initialization
async function startServer() {
    try {
        // Initialize database
        await db.initialize();
        console.log('Database connected and initialized');
        
        const server = app.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(`  PUMP PONIES BACKEND`);
            console.log(`========================================`);
            console.log(`  Server running on port ${PORT}`);
            console.log(`  Solana RPC: ${SOLANA_RPC}`);
            console.log(`  Database: PostgreSQL`);
            console.log(`  Min bet: ${MIN_BET} SOL`);
            console.log(`  Max bet: ${MAX_BET} SOL`);
            console.log(`  Deposit expiry: ${DEPOSIT_EXPIRY_MINUTES} minutes`);
            console.log(`  Monitor interval: ${MONITOR_INTERVAL}ms`);
            console.log(`========================================\n`);
            
            // Start deposit monitor
            depositMonitor.start();
        });
        
        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

const serverPromise = startServer();
let server;

// WebSocket server setup after server starts
serverPromise.then((srv) => {
    server = srv;
    wss = new WebSocket.Server({ server: srv, path: '/ws' });

    wss.on('connection', async (ws) => {
        console.log('WebSocket client connected');
        wsClients.add(ws);
        
        // Send current active race on connect
        try {
            const race = await db.getActiveRace();
            if (race) {
                const pools = await db.getRacePoolStats(race.id);
                ws.send(JSON.stringify({ type: 'connected', race: { ...race, pools } }));
            } else {
                ws.send(JSON.stringify({ type: 'connected', race: null }));
            }
        } catch (error) {
            console.error('Error sending initial race data:', error);
            ws.send(JSON.stringify({ type: 'connected', race: null }));
        }
        
        ws.on('close', () => {
            console.log('WebSocket client disconnected');
            wsClients.delete(ws);
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            wsClients.delete(ws);
        });
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    depositMonitor.stop();
    await db.close();
    if (server) server.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    depositMonitor.stop();
    await db.close();
    if (server) server.close();
    process.exit(0);
});

module.exports = app;
