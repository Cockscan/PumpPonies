// PUMP PONIES API Layer
// Handles both mock and real API calls with WebSocket support

class PumpPoniesAPI {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
        this.wsUrl = CONFIG.WS_URL;
        this.useMock = CONFIG.USE_MOCK;
        
        // WebSocket connection
        this.ws = null;
        this.wsReconnectAttempts = 0;
        this.wsMaxReconnectAttempts = 5;
        this.wsReconnectDelay = 3000;
        
        // Event callbacks
        this.onBetPlaced = null;
        this.onRaceUpdate = null;
        this.onConnected = null;
        
        // Mock data storage
        this.mockData = {
            races: [],
            deposits: [],
            payouts: [],
            masterWallet: ''
        };
        
        if (this.useMock) {
            this.initMockData();
        } else {
            // Connect to WebSocket for real-time updates
            this.connectWebSocket();
        }
    }
    
    // ===================
    // WEBSOCKET
    // ===================
    
    connectWebSocket() {
        if (this.useMock) return;
        
        try {
            console.log('Connecting to WebSocket:', this.wsUrl);
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.wsReconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWsMessage(message);
                } catch (err) {
                    console.error('WebSocket message parse error:', err);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
        } catch (err) {
            console.error('WebSocket connection error:', err);
            this.attemptReconnect();
        }
    }
    
    attemptReconnect() {
        if (this.wsReconnectAttempts >= this.wsMaxReconnectAttempts) {
            console.log('Max WebSocket reconnect attempts reached');
            return;
        }
        
        this.wsReconnectAttempts++;
        console.log(`WebSocket reconnecting (attempt ${this.wsReconnectAttempts})...`);
        
        setTimeout(() => {
            this.connectWebSocket();
        }, this.wsReconnectDelay);
    }
    
    handleWsMessage(message) {
        console.log('WebSocket message:', message.type);
        
        switch (message.type) {
            case 'connected':
                if (this.onConnected) {
                    this.onConnected(message.race);
                }
                break;
                
            case 'bet_placed':
                if (this.onBetPlaced) {
                    this.onBetPlaced(message.bet, message.pools);
                }
                break;
                
            case 'race_created':
            case 'race_opened':
            case 'race_closed':
            case 'race_ended':
                if (this.onRaceUpdate) {
                    this.onRaceUpdate(message.type, message.race, message.results);
                }
                break;
        }
    }
    
    // Initialize mock data
    initMockData() {
        // Create a sample active race with 10 horses
        this.mockData.races = [
            {
                id: 'race_' + Date.now().toString(36),
                title: 'The Pump Stakes - Race #1',
                status: 'open',
                start_time: Date.now() + 15 * 60 * 1000,
                winner: null,
                predetermined_winner: 3,
                horses: [
                    { id: 1, name: 'Neighkamoto', jockey: 'Nexus' },
                    { id: 2, name: 'Stablecolt', jockey: 'Axiom' },
                    { id: 3, name: 'Whalehinny', jockey: 'Helix' },
                    { id: 4, name: 'Hoofproof', jockey: 'Vector' },
                    { id: 5, name: 'Gallopchain', jockey: 'Cortex' },
                    { id: 6, name: 'Mareketcap', jockey: 'Sigma' },
                    { id: 7, name: 'Stalloshi', jockey: 'Logic' },
                    { id: 8, name: 'Trothereum', jockey: 'Prime' },
                    { id: 9, name: 'Neighonce', jockey: 'Atlas' },
                    { id: 10, name: 'Foalment', jockey: 'Neural' }
                ],
                pools: {
                    1: { amount: 0, bets: 0 },
                    2: { amount: 0, bets: 0 },
                    3: { amount: 0, bets: 0 },
                    4: { amount: 0, bets: 0 },
                    5: { amount: 0, bets: 0 },
                    6: { amount: 0, bets: 0 },
                    7: { amount: 0, bets: 0 },
                    8: { amount: 0, bets: 0 },
                    9: { amount: 0, bets: 0 },
                    10: { amount: 0, bets: 0 }
                },
                created_at: Date.now()
            }
        ];
    }
    
    // ===================
    // RACE ENDPOINTS
    // ===================
    
    // Get active race (open for betting)
    async getActiveRace() {
        if (this.useMock) {
            const race = this.mockData.races.find(r => r.status === 'open' || r.status === 'closed');
            return { success: true, data: race || null };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/race/active`);
            return await response.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    
    // Get all races
    async getRaces() {
        if (this.useMock) {
            return { success: true, data: this.mockData.races };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/races`);
            return await response.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    
    // Get completed races
    async getCompletedRaces() {
        if (this.useMock) {
            const completed = this.mockData.races.filter(r => r.status === 'completed');
            return { success: true, data: completed };
        }
        
        try {
            // Get all races and filter completed ones
            const response = await fetch(`${this.baseUrl}/races`);
            const result = await response.json();
            if (result.success && result.data) {
                const completed = result.data.filter(r => r.status === 'completed');
                return { success: true, data: completed };
            }
            return result;
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    
    // Get race pools (betting stats)
    async getRacePools(raceId) {
        if (this.useMock) {
            const race = this.mockData.races.find(r => r.id === raceId);
            if (race) {
                return { success: true, data: race.pools };
            }
            return { success: false, error: 'Race not found' };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/race/${raceId}/pools`);
            return await response.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    
    // ===================
    // BETTING ENDPOINTS
    // ===================
    
    // Generate deposit address for a bet
    async generateDepositAddress(raceId, horseId) {
        if (this.useMock) {
            // Generate mock Solana-like address
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
            let address = '';
            for (let i = 0; i < 44; i++) {
                address += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            const deposit = {
                id: 'dep_' + Date.now().toString(36),
                deposit_address: address,
                race_id: raceId,
                horse_id: horseId,
                expires_at: Date.now() + CONFIG.DEPOSIT_EXPIRY_MS,
                status: 'waiting',
                created_at: Date.now()
            };
            
            this.mockData.deposits.push(deposit);
            
            return {
                success: true,
                data: {
                    deposit_address: address,
                    expires_at: deposit.expires_at,
                    min_bet: CONFIG.MIN_BET,
                    max_bet: CONFIG.MAX_BET,
                    race_id: raceId,
                    horse_id: horseId
                }
            };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/bet/deposit-address`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ race_id: raceId, horse_number: horseId })
            });
            return await response.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    
    // Check deposit status by ID
    async checkDepositStatusById(depositId) {
        if (this.useMock) {
            const deposit = this.mockData.deposits.find(d => d.id === depositId);
            if (deposit) {
                return { success: true, data: deposit };
            }
            return { success: false, error: 'Deposit not found' };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/bet/status/${depositId}`);
            return await response.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    
    // Check deposit status
    async checkDepositStatus(depositAddress) {
        if (this.useMock) {
            const deposit = this.mockData.deposits.find(d => d.deposit_address === depositAddress);
            if (deposit) {
                return { success: true, data: deposit };
            }
            return { success: false, error: 'Deposit not found' };
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/bet/status/${depositAddress}`);
            return await response.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
    
    // ===================
    // MOCK HELPERS
    // ===================
    
    // Simulate deposit received (for testing)
    mockReceiveDeposit(depositAddress, amount, fromWallet) {
        if (!this.useMock) return;
        
        const deposit = this.mockData.deposits.find(d => d.deposit_address === depositAddress);
        if (deposit && deposit.status === 'waiting') {
            deposit.status = 'confirmed';
            deposit.amount = amount;
            deposit.from_wallet = fromWallet;
            deposit.confirmed_at = Date.now();
            
            // Update race pool
            const race = this.mockData.races.find(r => r.id === deposit.race_id);
            if (race && race.pools[deposit.horse_id]) {
                race.pools[deposit.horse_id].amount += amount;
                race.pools[deposit.horse_id].bets += 1;
            }
            
            return { success: true, data: deposit };
        }
        return { success: false, error: 'Deposit not found or already confirmed' };
    }
    
    // Calculate odds for a horse
    calculateOdds(race, horseId) {
        if (!race || !race.pools) return null;
        
        const totalPool = Object.values(race.pools).reduce((sum, p) => sum + p.amount, 0);
        const horsePool = race.pools[horseId]?.amount || 0;
        
        if (horsePool === 0 || totalPool === 0) return null;
        
        return totalPool / horsePool;
    }
    
    // Get total pool for a race
    getTotalPool(race) {
        if (!race || !race.pools) return 0;
        return Object.values(race.pools).reduce((sum, p) => sum + p.amount, 0);
    }
    
    // Get total bets for a race
    getTotalBets(race) {
        if (!race || !race.pools) return 0;
        return Object.values(race.pools).reduce((sum, p) => sum + p.bets, 0);
    }
}

// Create global API instance
const api = new PumpPoniesAPI();
