// ARENAI - Main Application Logic
class ArenAIApp {
    constructor() {
        this.wallet = null;
        this.walletAddress = null;
        this.activeFight = null;
        this.fightStats = null;
        this.completedFights = [];
        this.userBets = [];
        this.tokenPrice = null;
        
        // Initialize
        this.init();
    }
    
    async init() {
        console.log('Initializing ArenAI...');
        
        // Wait for mock API to initialize
        if (CONFIG.USE_MOCK) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check for existing wallet connection
        this.checkWalletConnection();
        
        // Start update loops
        this.startUpdateLoops();
        
        // Load initial data
        await this.loadFights();
        await this.loadTokenPrice();
    }
    
    setupEventListeners() {
        // Wallet connection
        const walletBtn = document.querySelector('.wallet');
        if (walletBtn) {
            walletBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleWalletClick();
            });
        }
        
        // Betting buttons (will be created dynamically)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('bet-left')) {
                e.preventDefault();
                this.placeBet('Left');
            } else if (e.target.classList.contains('bet-right')) {
                e.preventDefault();
                this.placeBet('Right');
            }
        });
        
        // Audio toggle
        const audioBtn = document.querySelector('.audio');
        if (audioBtn) {
            let audioEnabled = true;
            audioBtn.addEventListener('click', (e) => {
                e.preventDefault();
                audioEnabled = !audioEnabled;
                audioBtn.style.opacity = audioEnabled ? '1' : '0.5';
                // Add actual audio control logic here
            });
        }
    }
    
    async checkWalletConnection() {
        if (window.solana && window.solana.isPhantom) {
            try {
                // Check if already connected
                const response = await window.solana.connect({ onlyIfTrusted: true });
                this.handleWalletConnected(response.publicKey.toString());
            } catch (err) {
                // Not connected, that's okay
                console.log('Wallet not auto-connected');
            }
        }
    }
    
    async handleWalletClick() {
        if (this.wallet) {
            // Already connected, show disconnect option or wallet info
            this.showWalletMenu();
        } else {
            await this.connectWallet();
        }
    }
    
    async connectWallet() {
        if (!window.solana || !window.solana.isPhantom) {
            alert('Please install Phantom wallet to use this app!\n\nVisit: https://phantom.app');
            window.open('https://phantom.app', '_blank');
            return;
        }
        
        try {
            const response = await window.solana.connect();
            this.handleWalletConnected(response.publicKey.toString());
        } catch (err) {
            console.error('Wallet connection failed:', err);
            alert('Failed to connect wallet. Please try again.');
        }
    }
    
    handleWalletConnected(address) {
        this.wallet = window.solana;
        this.walletAddress = address;
        
        // Update UI
        const walletBtn = document.querySelector('.wallet');
        if (walletBtn) {
            walletBtn.textContent = this.formatAddress(address);
            walletBtn.classList.add('connected');
        }
        
        // Load user data
        this.loadUserData();
        
        console.log('Wallet connected:', address);
    }
    
    async disconnectWallet() {
        if (this.wallet) {
            try {
                await this.wallet.disconnect();
                this.wallet = null;
                this.walletAddress = null;
                this.userCredits = 0;
                this.userBets = [];
                
                // Update UI
                const walletBtn = document.querySelector('.wallet');
                if (walletBtn) {
                    walletBtn.textContent = 'Connect Wallet';
                    walletBtn.classList.remove('connected');
                }
                
                // Hide user info section
                const userInfoSection = document.getElementById('user-info-section');
                if (userInfoSection) {
                    userInfoSection.style.display = 'none';
                }
                
                // Reload fight display to remove bet buttons
                if (this.activeFight) {
                    this.updateFightDisplay();
                }
                
                console.log('Wallet disconnected');
            } catch (err) {
                console.error('Disconnect failed:', err);
            }
        }
    }
    
    showWalletMenu() {
        // Simple menu for now
        const disconnect = confirm('Disconnect wallet?');
        if (disconnect) {
            this.disconnectWallet();
        }
    }
    
    formatAddress(address) {
        return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
    }
    
    async loadUserData() {
        if (!this.walletAddress) return;
        
        // Load user credits
        const credits = await this.apiCall('getCredits', this.walletAddress);
        if (credits.success) {
            this.userCredits = credits.data.credits;
            this.updateCreditsDisplay();
            
            // Show user info section if wallet is connected
            const userInfoSection = document.getElementById('user-info-section');
            if (userInfoSection) {
                userInfoSection.style.display = 'block';
            }
        }
        
        // Load user bets for active fight
        if (this.activeFight) {
            await this.loadUserBets(this.activeFight.fight_id);
        }
    }
    
    async loadFights() {
        const response = await this.apiCall('getFights');
        if (response.success) {
            const fights = response.data;
            
            // Find active fight
            this.activeFight = fights.find(f => f.status === 'Open' || f.status === 'Closed');
            
            // Get completed fights
            this.completedFights = fights.filter(f => f.status === 'Completed');
            
            if (this.activeFight) {
                await this.loadFightStats(this.activeFight.fight_id);
                this.updateFightDisplay();
            }
            
            this.updateHistoryDisplay();
        }
    }
    
    async loadFightStats(fightId) {
        const response = await this.apiCall('getBetStats', fightId);
        if (response.success) {
            this.fightStats = response.data;
            this.updateStatsDisplay();
        }
    }
    
    async loadUserBets(fightId) {
        const response = await this.apiCall('getBets', fightId);
        if (response.success && this.walletAddress) {
            this.userBets = response.data.filter(b => b.wallet === this.walletAddress);
            this.updateUserBetsDisplay();
        }
    }
    
    async loadTokenPrice() {
        const response = await this.apiCall('getTokenPrice');
        if (response.success) {
            this.tokenPrice = response.data;
            this.updatePriceDisplay();
        }
    }
    
    updatePriceDisplay() {
        if (!this.tokenPrice) return;
        
        const priceSolEl = document.getElementById('priceSol');
        const priceUsdEl = document.getElementById('priceUsd');
        const marketCapEl = document.getElementById('marketCapUsd');
        const lastUpdateEl = document.getElementById('lastUpdate');
        
        if (priceSolEl) {
            priceSolEl.textContent = this.tokenPrice.price_sol.toFixed(8);
        }
        
        if (priceUsdEl) {
            priceUsdEl.textContent = this.tokenPrice.price_usd ? '$' + this.tokenPrice.price_usd.toFixed(6) : '--';
        }
        
        if (marketCapEl) {
            // Mock market cap calculation (you can get this from backend if available)
            const mockSupply = 1000000000; // 1 billion tokens
            const marketCap = this.tokenPrice.price_usd * mockSupply;
            const mcapFormatted = marketCap >= 1000000 
                ? '$' + (marketCap / 1000000).toFixed(2) + 'M'
                : '$' + (marketCap / 1000).toFixed(2) + 'K';
            marketCapEl.textContent = mcapFormatted;
        }
        
        if (lastUpdateEl) {
            const date = new Date(this.tokenPrice.last_updated * 1000);
            lastUpdateEl.textContent = 'Last update: ' + date.toLocaleTimeString();
        }
    }
    
    startUpdateLoops() {
        // Update countdown every second
        setInterval(() => {
            this.updateCountdown();
        }, CONFIG.COUNTDOWN_INTERVAL_MS);
        
        // Update stats and price every 5 seconds
        setInterval(() => {
            if (this.activeFight) {
                this.loadFightStats(this.activeFight.fight_id);
                this.loadFights(); // Check for status changes
            }
            this.loadTokenPrice(); // Update price regularly
        }, CONFIG.UPDATE_INTERVAL_MS);
    }
    
    updateCountdown() {
        if (!this.activeFight) return;
        
        const now = Math.floor(Date.now() / 1000);
        const countdownEl = document.getElementById('fight-countdown');
        
        if (!countdownEl) return;
        
        let targetTime, label;
        
        if (this.activeFight.status === 'Open') {
            // Show countdown to when fight begins
            targetTime = this.activeFight.scheduled_start;
            label = 'FIGHT BEGINS IN:';
        } else if (this.activeFight.status === 'Closed') {
            targetTime = this.activeFight.scheduled_complete;
            label = 'FIGHT ENDS IN:';
        } else {
            countdownEl.innerHTML = '<div class="countdown-label">Fight Completed!</div>';
            return;
        }
        
        const remaining = targetTime - now;
        
        if (remaining <= 0) {
            countdownEl.innerHTML = '<div class="countdown-label">Starting now...</div>';
            return;
        }
        
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        
        countdownEl.innerHTML = `
            <div class="countdown-label">${label}</div>
            <div class="countdown-time">${minutes}:${seconds.toString().padStart(2, '0')}</div>
        `;
    }
    
    updateFightDisplay() {
        if (!this.activeFight) return;
        
        const container = document.getElementById('active-fight');
        if (!container) return;
        
        const canBet = this.activeFight.status === 'Open' && this.walletAddress;
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; flex-wrap: wrap; gap: 20px;">
                <div style="font-family: Orbitron, sans-serif; font-size: 28px; font-weight: 700; color: #3ceda1; text-transform: uppercase; letter-spacing: 2px;">
                    ACTIVE<br/>FIGHT
                </div>
                <div class="fight-status status-${this.activeFight.status.toLowerCase()}">${this.activeFight.status}</div>
            </div>
            
            <div id="fight-countdown" class="fight-countdown"></div>
            
            <div class="fighters-container">
                <div class="fighter-side left">
                    <div class="fighter-name">${this.activeFight.left_fighter}</div>
                    <div class="fighter-pool" id="left-pool">0 tokens</div>
                    <div class="fighter-odds" id="left-odds">1.00x</div>
                    ${canBet ? '<button class="bet-button bet-left">BET LEFT</button>' : ''}
                </div>
                
                <div class="fight-vs">VS</div>
                
                <div class="fighter-side right">
                    <div class="fighter-name">${this.activeFight.right_fighter}</div>
                    <div class="fighter-pool" id="right-pool">0 tokens</div>
                    <div class="fighter-odds" id="right-odds">1.00x</div>
                    ${canBet ? '<button class="bet-button bet-right">BET RIGHT</button>' : ''}
                </div>
            </div>
            
            ${!this.walletAddress ? '<div class="connect-prompt">Connect your wallet to place bets</div>' : ''}
        `;
        
        this.updateCountdown();
    }
    
    updateStatsDisplay() {
        if (!this.fightStats) return;
        
        const leftPoolEl = document.getElementById('left-pool');
        const rightPoolEl = document.getElementById('right-pool');
        const leftOddsEl = document.getElementById('left-odds');
        const rightOddsEl = document.getElementById('right-odds');
        
        if (leftPoolEl) {
            const leftTokens = (this.fightStats.total_left_amount / 1000000).toFixed(2);
            leftPoolEl.textContent = `${leftTokens} tokens`;
        }
        
        if (rightPoolEl) {
            const rightTokens = (this.fightStats.total_right_amount / 1000000).toFixed(2);
            rightPoolEl.textContent = `${rightTokens} tokens`;
        }
        
        // Calculate odds
        const totalPool = this.fightStats.total_pool;
        if (totalPool > 0) {
            const leftOdds = this.fightStats.total_left_amount > 0 
                ? (totalPool / this.fightStats.total_left_amount).toFixed(2)
                : '0.00';
            const rightOdds = this.fightStats.total_right_amount > 0
                ? (totalPool / this.fightStats.total_right_amount).toFixed(2)
                : '0.00';
            
            if (leftOddsEl) leftOddsEl.textContent = `${leftOdds}x`;
            if (rightOddsEl) rightOddsEl.textContent = `${rightOdds}x`;
        }
    }
    
    updateHistoryDisplay() {
        const container = document.getElementById('fight-history');
        if (!container) return;
        
        if (this.completedFights.length === 0) {
            container.innerHTML = '<div class="no-history">No completed fights yet</div>';
            return;
        }
        
        const historyHTML = this.completedFights.map(fight => {
            const winnerName = fight.winner === 'Left' ? fight.left_fighter : fight.right_fighter;
            const loserName = fight.winner === 'Left' ? fight.right_fighter : fight.left_fighter;
            
            return `
                <div class="history-item">
                    <div class="history-fighters">
                        <span class="winner">${winnerName}</span> defeated <span class="loser">${loserName}</span>
                    </div>
                    <div class="history-date">${this.formatDate(fight.completed_at)}</div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = historyHTML;
    }
    
    updateCreditsDisplay() {
        const creditsEl = document.getElementById('user-credits');
        if (creditsEl && this.userCredits !== undefined) {
            const tokens = (this.userCredits / 1000000).toFixed(2);
            creditsEl.textContent = `Credits: ${tokens} tokens`;
        }
    }
    
    updateUserBetsDisplay() {
        const container = document.getElementById('user-bets');
        if (!container) return;
        
        if (this.userBets.length === 0) {
            container.innerHTML = '<div class="no-bets">No bets placed yet</div>';
            return;
        }
        
        const betsHTML = this.userBets.map(bet => {
            const amount = (bet.token_amount / 1000000).toFixed(2);
            const side = bet.side;
            
            return `
                <div class="user-bet">
                    <span class="bet-side ${side.toLowerCase()}">${side}</span>
                    <span class="bet-amount">${amount} tokens</span>
                    ${bet.verified ? '<span class="bet-verified">✓</span>' : '<span class="bet-pending">⏱</span>'}
                </div>
            `;
        }).join('');
        
        container.innerHTML = betsHTML;
    }
    
    async placeBet(side) {
        if (!this.walletAddress) {
            alert('Please connect your wallet first!');
            return;
        }
        
        if (!this.activeFight || this.activeFight.status !== 'Open') {
            alert('No active fight to bet on!');
            return;
        }
        
        // Get nickname
        let nickname = localStorage.getItem('arenai_nickname');
        if (!nickname) {
            nickname = prompt('Enter your nickname:');
            if (!nickname) return;
            localStorage.setItem('arenai_nickname', nickname);
        }
        
        try {
            // In production, this would send actual tokens
            // For mock, we just simulate it
            let signature = null;
            
            if (CONFIG.USE_MOCK) {
                signature = 'mock_tx_' + Date.now();
            } else {
                // TODO: Implement actual Solana token transfer
                // const transaction = await this.createBetTransaction();
                // signature = await this.wallet.signAndSendTransaction(transaction);
            }
            
            // Place bet via API
            const response = await this.apiCall('placeBet', 
                this.activeFight.fight_id, 
                signature, 
                this.walletAddress, 
                nickname, 
                side
            );
            
            if (response.success) {
                if (response.data.status === 'bet_placed') {
                    alert(`Bet placed successfully!\nSide: ${side}\nAmount: 1.0 token`);
                    // Reload data
                    await this.loadFightStats(this.activeFight.fight_id);
                    await this.loadUserBets(this.activeFight.fight_id);
                } else if (response.data.status === 'credited') {
                    alert(response.data.message);
                }
            } else {
                alert('Bet failed: ' + response.error);
            }
        } catch (err) {
            console.error('Bet error:', err);
            alert('Failed to place bet. Please try again.');
        }
    }
    
    formatDate(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }
    
    // API wrapper - switches between mock and real API
    async apiCall(method, ...args) {
        if (CONFIG.USE_MOCK) {
            // Use mock API
            return await mockAPI[method](...args);
        } else {
            // Use real API
            return await this.realAPICall(method, ...args);
        }
    }
    
    async realAPICall(method, ...args) {
        // Map method names to actual API endpoints
        const endpoints = {
            getFights: { url: '/fights', method: 'GET' },
            getFight: { url: '/fight', method: 'GET', params: ['fight_id'] },
            getBets: { url: '/bets', method: 'GET', params: ['fight_id'] },
            getBetStats: { url: '/bet/stats', method: 'GET', params: ['fight_id'] },
            placeBet: { url: '/bet/place', method: 'POST', body: ['fight_id', 'signature', 'wallet', 'nickname', 'side'] },
            getCredits: { url: '/credits', method: 'GET', params: ['wallet'] },
            getTokenPrice: { url: '/token/price', method: 'GET' }
        };
        
        const endpoint = endpoints[method];
        if (!endpoint) {
            console.error('Unknown API method:', method);
            return { success: false, error: 'Unknown method' };
        }
        
        try {
            let url = CONFIG.API_BASE_URL + endpoint.url;
            let options = { method: endpoint.method };
            
            if (endpoint.method === 'GET' && endpoint.params) {
                const params = new URLSearchParams();
                endpoint.params.forEach((param, i) => {
                    params.append(param, args[i]);
                });
                url += '?' + params.toString();
            }
            
            if (endpoint.method === 'POST') {
                const body = {};
                endpoint.body.forEach((field, i) => {
                    body[field] = args[i];
                });
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(body);
            }
            
            const response = await fetch(url, options);
            return await response.json();
        } catch (err) {
            console.error('API call failed:', err);
            return { success: false, error: err.message };
        }
    }
}

// Initialize app when DOM is ready
let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new ArenAIApp();
    });
} else {
    app = new ArenAIApp();
}

