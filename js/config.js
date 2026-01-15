// PUMP PONIES Configuration
const CONFIG = {
    // API Mode - set to false when real backend is deployed
    // true = use mock data (frontend only, for testing)
    // false = use real backend API
    USE_MOCK: false,
    
    // Backend API URL - Always use Railway backend
    // Change to 'http://localhost:20101' only if running local backend
    API_BASE_URL: 'https://pumpponies-production.up.railway.app',
    
    // WebSocket URL for real-time updates
    WS_URL: 'wss://pumpponies-production.up.railway.app/ws',
    
    // Solana Configuration
    SOLANA_NETWORK: 'mainnet-beta',
    HELIUS_RPC_URL: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
    
    // Master wallet (where forwarded bets go)
    MASTER_WALLET: '',
    
    // Betting limits (in SOL)
    MIN_BET: 0.01,
    MAX_BET: 20,
    
    // House cut percentage - applied silently on payouts (not shown in UI)
    // Winners receive: (their_share_of_pool) * (1 - HOUSE_CUT)
    HOUSE_CUT: 0.05,
    
    // Deposit address expiry (30 minutes in ms)
    DEPOSIT_EXPIRY_MS: 30 * 60 * 1000,
    
    // UI Update intervals
    POLL_INTERVAL_MS: 5000,
    COUNTDOWN_INTERVAL_MS: 1000,
    
    // Horse colors for UI (10 horses)
    HORSE_COLORS: [
        '#dc2626', // 1 - Neighkamoto - Red
        '#f5f5f5', // 2 - Stablecolt - White
        '#1e3a5f', // 3 - Whalehinny - Navy Blue
        '#facc15', // 4 - Hoofproof - Yellow
        '#1a472a', // 5 - Gallopchain - Forest Green
        '#1a1a1a', // 6 - Mareketcap - Black
        '#f97316', // 7 - Stalloshi - Orange
        '#ec4899', // 8 - Trothereum - Pink
        '#93c5fd', // 9 - Neighonce - Pastel Blue
        '#a855f7'  // 10 - Foalment - Purple
    ],
    
    // Master Stream URL (Pump.fun) - set via admin panel
    STREAM_URL: 'https://pump.fun',
    
    // Admin token (should match backend ADMIN_TOKEN in .env)
    ADMIN_TOKEN: 'pumpPonies_admin_secret_token_2024'
};
