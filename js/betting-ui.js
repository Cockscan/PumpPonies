// PUMP PONIES - Betting UI Controller

// Robot Jockey SVG Generator - creates cute robot icons with jockey silk patterns
function getRobotJockeySVG(number) {
    const robots = {
        1: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 1: Neighkamoto - Red -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#dc2626"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#333"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#dc2626"/>
            <text x="25" y="45" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold" font-family="Arial">1</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#dc2626"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#dc2626"/>
        </svg>`,
        
        2: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 2: Stablecolt - White -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#f5f5f5" stroke="#ccc" stroke-width="1"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#333"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#333"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#333"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#f5f5f5" stroke="#ccc" stroke-width="1"/>
            <text x="25" y="45" text-anchor="middle" fill="#333" font-size="14" font-weight="bold" font-family="Arial">2</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#f5f5f5" stroke="#ccc" stroke-width="1"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#f5f5f5" stroke="#ccc" stroke-width="1"/>
        </svg>`,
        
        3: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 3: Whalehinny - Navy Blue -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#1e3a5f"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#333"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#1e3a5f"/>
            <text x="25" y="45" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold" font-family="Arial">3</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#1e3a5f"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#1e3a5f"/>
        </svg>`,
        
        4: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 4: Hoofproof - Yellow -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#facc15"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#333"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#333"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#333"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#facc15"/>
            <text x="25" y="45" text-anchor="middle" fill="#333" font-size="14" font-weight="bold" font-family="Arial">4</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#facc15"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#facc15"/>
        </svg>`,
        
        5: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 5: Gallopchain - Forest Green -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#1a472a"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#90EE90"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#90EE90"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#333"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#1a472a"/>
            <text x="25" y="45" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold" font-family="Arial">5</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#1a472a"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#1a472a"/>
        </svg>`,
        
        6: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 6: Mareketcap - Black and Gold -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#1a1a1a"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#d4af37"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#d4af37"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#d4af37"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#1a1a1a"/>
            <rect x="12" y="30" width="26" height="4" fill="#d4af37"/>
            <rect x="12" y="38" width="26" height="4" fill="#d4af37"/>
            <rect x="12" y="46" width="26" height="4" fill="#d4af37"/>
            <text x="25" y="45" text-anchor="middle" fill="#d4af37" font-size="12" font-weight="bold" font-family="Arial">6</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#1a1a1a" stroke="#d4af37" stroke-width="1"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#1a1a1a" stroke="#d4af37" stroke-width="1"/>
        </svg>`,
        
        7: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 7: Stalloshi - Orange -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#f97316"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#333"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#f97316"/>
            <text x="25" y="45" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold" font-family="Arial">7</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#f97316"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#f97316"/>
        </svg>`,
        
        8: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 8: Trothereum - Pink -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#ec4899"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#333"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#ec4899"/>
            <text x="25" y="45" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold" font-family="Arial">8</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#ec4899"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#ec4899"/>
        </svg>`,
        
        9: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 9: Neighonce - Pastel Blue -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#93c5fd"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#1e40af"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#1e40af"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#333"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#93c5fd"/>
            <text x="25" y="45" text-anchor="middle" fill="#1e40af" font-size="14" font-weight="bold" font-family="Arial">9</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#93c5fd"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#93c5fd"/>
        </svg>`,
        
        10: `<svg viewBox="0 0 50 60" xmlns="http://www.w3.org/2000/svg">
            <!-- Robot 10: Foalment - Purple -->
            <rect x="10" y="2" width="30" height="22" rx="8" fill="#a855f7"/>
            <rect x="15" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="27" y="8" width="8" height="6" rx="2" fill="#fff"/>
            <rect x="20" y="16" width="10" height="3" rx="1" fill="#333"/>
            <rect x="8" y="26" width="34" height="28" rx="4" fill="#a855f7"/>
            <text x="25" y="45" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold" font-family="Arial">10</text>
            <rect x="3" y="30" width="8" height="18" rx="3" fill="#a855f7"/>
            <rect x="39" y="30" width="8" height="18" rx="3" fill="#a855f7"/>
        </svg>`
    };
    
    return robots[number] || robots[1];
}

class BettingUI {
    constructor() {
        this.activeRace = null;
        this.completedRaces = [];
        this.selectedHorse = null;
        this.currentDepositAddress = null;
        this.countdownInterval = null;
        
        this.init();
    }
    
    async init() {
        console.log('🏇 Pump Ponies UI initialized');
        
        // Set stream URL links
        this.updateStreamLinks();
        
        // Load race data
        await this.loadRaceData();
        
        // Render UI
        this.render();
        
        // Start countdown
        this.startCountdown();
        
        // Start polling for updates (fallback)
        this.startPolling();
        
        // Setup WebSocket for real-time updates
        this.setupWebSocket();
        
        // Setup modal handlers
        this.setupModalHandlers();
    }
    
    updateStreamLinks() {
        const watchLiveLink = document.getElementById('watch-live-link');
        const buyPumpLink = document.getElementById('buy-pump-link');
        
        if (watchLiveLink && CONFIG.STREAM_URL) {
            watchLiveLink.href = CONFIG.STREAM_URL;
        }
        if (buyPumpLink && CONFIG.STREAM_URL) {
            buyPumpLink.href = CONFIG.STREAM_URL;
        }
    }
    
    async loadRaceData() {
        // Get active race
        const activeResp = await api.getActiveRace();
        if (activeResp.success && activeResp.data) {
            this.activeRace = activeResp.data;
        }
        
        // Get completed races
        const completedResp = await api.getCompletedRaces();
        if (completedResp.success) {
            this.completedRaces = completedResp.data;
        }
    }
    
    render() {
        this.renderRaceBanner();
        this.renderHorses();
        this.renderTotals();
        this.renderHistory();
    }
    
    renderRaceBanner() {
        const statusEl = document.getElementById('race-status');
        const titleEl = document.getElementById('race-title');
        const infoEl = document.getElementById('race-info');
        
        if (!this.activeRace) {
            statusEl.textContent = 'NO ACTIVE RACE';
            statusEl.classList.add('closed');
            titleEl.textContent = 'Next Race Coming Soon';
            infoEl.textContent = '10 Runners • Check back for race times';
            return;
        }
        
        // Update status badge
        if (this.activeRace.status === 'open') {
            statusEl.textContent = 'BETTING OPEN';
            statusEl.classList.remove('closed');
        } else if (this.activeRace.status === 'closed') {
            statusEl.textContent = 'BETTING CLOSED';
            statusEl.classList.add('closed');
        } else if (this.activeRace.status === 'pending') {
            statusEl.textContent = 'COMING SOON';
            statusEl.classList.add('closed');
        }
        
        titleEl.textContent = this.activeRace.title;
        infoEl.textContent = `10 Runners • Streaming Live on Pump.fun`;
    }
    
    renderHorses(updatedHorseId = null) {
        const container = document.getElementById('horses-container');
        if (!container) return;
        
        // Default horses to show when no race is active
        const defaultHorses = [
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
        ];
        
        // Use race horses if available, otherwise default
        const horses = this.activeRace?.horses || defaultHorses;
        const canBet = this.activeRace?.status === 'open';
        const hasRace = !!this.activeRace;
        
        container.innerHTML = horses.map((horse, index) => {
            const horseId = horse.id || index + 1;
            const pool = hasRace ? (this.activeRace.pools[horseId] || { amount: 0, bets: 0 }) : { amount: 0, bets: 0 };
            const odds = hasRace ? api.calculateOdds(this.activeRace, horseId) : null;
            const oddsDisplay = odds ? odds.toFixed(2) + 'x' : '--';
            const isUpdated = updatedHorseId === horseId;
            
            return `
                <div class="horse-row ${isUpdated ? 'updated' : ''} ${!hasRace ? 'no-race' : ''}" ${canBet ? `onclick="bettingUI.openBetModal(${horseId})"` : ''}>
                    <div class="horse-number">
                        <div class="robot-jockey">${getRobotJockeySVG(horseId)}</div>
                    </div>
                    <div class="horse-info">
                        <div class="horse-name">${horse.name}</div>
                        <div class="horse-jockey">${horse.jockey}</div>
                    </div>
                    <div class="horse-odds ${isUpdated ? 'updated' : ''}">${oddsDisplay}</div>
                    <div class="horse-pool">
                        ${pool.amount.toFixed(2)} SOL
                        <span>${pool.bets} bets</span>
                    </div>
                    ${canBet ? `
                        <button class="bet-btn">Place Bet</button>
                    ` : `
                        <button class="bet-btn" disabled style="opacity: 0.5; cursor: not-allowed;">${hasRace ? 'Closed' : 'No Race'}</button>
                    `}
                </div>
            `;
        }).join('');
    }
    
    renderTotals(animate = false) {
        if (!this.activeRace) {
            document.getElementById('total-pool').innerHTML = '0.00 <span>SOL</span>';
            document.getElementById('total-bets').textContent = '0';
            return;
        }
        
        const totalPool = api.getTotalPool(this.activeRace);
        const totalBets = api.getTotalBets(this.activeRace);
        
        const totalPoolEl = document.getElementById('total-pool');
        const totalBetsEl = document.getElementById('total-bets');

        if (totalPoolEl) {
            totalPoolEl.innerHTML = `${totalPool.toFixed(2)} <span>SOL</span>`;
            if (animate) {
                totalPoolEl.classList.add('updated');
                setTimeout(() => totalPoolEl.classList.remove('updated'), 1000);
            }
        }
        
        if (totalBetsEl) {
            totalBetsEl.textContent = totalBets;
        }
        
        // Update next race time
        const nextRaceEl = document.getElementById('next-race-time');
        if (nextRaceEl && this.activeRace.start_time) {
            const raceTime = new Date(this.activeRace.start_time);
            nextRaceEl.textContent = raceTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }
    
    renderHistory() {
        const container = document.getElementById('race-history');
        if (!container) return;
        
        if (this.completedRaces.length === 0) {
            container.innerHTML = `
                <div class="race-history-card">
                    <div class="race-history-info">
                        <h4>No completed races yet</h4>
                        <p>Check back after the first race!</p>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.completedRaces.slice(0, 5).map(race => {
            const winnerHorse = race.horses.find(h => h.id === race.winner);
            const winnerName = winnerHorse ? winnerHorse.name : `Horse #${race.winner}`;
            const totalPool = api.getTotalPool(race);
            
            return `
                <div class="race-history-card">
                    <div class="race-history-info">
                        <h4>${race.title}</h4>
                        <p>Total Pool: ${totalPool.toFixed(2)} SOL</p>
                    </div>
                    <div class="race-winner">
                        <div class="winner-badge">🏆 #${race.winner} - ${winnerName}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // ===================
    // COUNTDOWN
    // ===================
    
    startCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
        
        this.updateCountdown();
    }
    
    updateCountdown() {
        if (!this.activeRace || !this.activeRace.start_time) {
            document.getElementById('countdown-hours').textContent = '00';
            document.getElementById('countdown-minutes').textContent = '00';
            document.getElementById('countdown-seconds').textContent = '00';
            return;
        }
        
        const now = Date.now();
        const diff = this.activeRace.start_time - now;
        
        if (diff <= 0) {
            document.getElementById('countdown-hours').textContent = '00';
            document.getElementById('countdown-minutes').textContent = '00';
            document.getElementById('countdown-seconds').textContent = '00';
            
            // Race has started
            const statusEl = document.getElementById('race-status');
            statusEl.textContent = 'RACE IN PROGRESS';
            statusEl.classList.add('closed');
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('countdown-hours').textContent = hours.toString().padStart(2, '0');
        document.getElementById('countdown-minutes').textContent = minutes.toString().padStart(2, '0');
        document.getElementById('countdown-seconds').textContent = seconds.toString().padStart(2, '0');
    }
    
    // ===================
    // POLLING
    // ===================
    
    startPolling() {
        // Fallback polling for when WebSocket isn't available
        setInterval(async () => {
            await this.loadRaceData();
            this.renderHorses();
            this.renderTotals();
        }, CONFIG.POLL_INTERVAL_MS);
    }
    
    /**
     * Setup WebSocket for real-time updates (when backend is live)
     */
    setupWebSocket() {
        // Real-time bet updates
        api.onBetPlaced = (bet, pools) => {
            console.log('🎰 New bet received via WebSocket:', bet);
            if (this.activeRace && pools) {
                this.activeRace.pools = pools;
                this.renderHorses(bet.horse_number); // Animate specific horse
                this.renderTotals(true); // Animate totals
            }
        };
        
        // Race status updates
        api.onRaceUpdate = (type, race, results) => {
            console.log('🏇 Race update:', type);
            if (race) {
                this.activeRace = race;
                this.render();
            }
        };
        
        // Initial connection
        api.onConnected = (race) => {
            console.log('📡 WebSocket connected, race:', race?.id);
            if (race) {
                this.activeRace = race;
                this.render();
            }
        };
    }
    
    // ===================
    // BET MODAL
    // ===================
    
    setupModalHandlers() {
        const modal = document.getElementById('bet-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    this.closeBetModal();
                }
            });
        }
    }
    
    async openBetModal(horseId) {
        if (!this.activeRace || this.activeRace.status !== 'open') {
            alert('Betting is currently closed!');
            return;
        }
        
        this.selectedHorse = this.activeRace.horses.find(h => h.id === horseId) || 
                            this.activeRace.horses[horseId - 1];
        
        if (!this.selectedHorse) {
            alert('Horse not found!');
            return;
        }
        
        // Render selected horse info
        const selectedHorseDiv = document.getElementById('selected-horse');
        const odds = api.calculateOdds(this.activeRace, horseId);
        const oddsDisplay = odds ? odds.toFixed(2) + 'x' : 'N/A';
        
        selectedHorseDiv.innerHTML = `
            <div class="horse-number">
                <div class="robot-jockey">${getRobotJockeySVG(horseId)}</div>
            </div>
            <div class="selected-horse-info">
                <h3>${this.selectedHorse.name}</h3>
                <p>Current Odds: ${oddsDisplay}</p>
            </div>
        `;
        
        // Generate deposit address
        const addressEl = document.getElementById('deposit-address');
        addressEl.textContent = 'Generating address...';
        
        const resp = await api.generateDepositAddress(this.activeRace.id, horseId);
        
        if (resp.success) {
            this.currentDepositAddress = resp.data.deposit_address;
            addressEl.textContent = this.currentDepositAddress;
        } else {
            addressEl.textContent = 'Error generating address. Please try again.';
        }
        
        // Show modal
        document.getElementById('bet-modal').classList.add('active');
    }
    
    closeBetModal() {
        document.getElementById('bet-modal').classList.remove('active');
        this.selectedHorse = null;
        this.currentDepositAddress = null;
    }
    
    copyAddress() {
        if (!this.currentDepositAddress) return;
        
        navigator.clipboard.writeText(this.currentDepositAddress).then(() => {
            const btn = document.querySelector('.copy-btn');
            btn.textContent = '✓ Copied!';
            setTimeout(() => {
                btn.textContent = '📋 Copy Address';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.currentDepositAddress;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const btn = document.querySelector('.copy-btn');
            btn.textContent = '✓ Copied!';
            setTimeout(() => {
                btn.textContent = '📋 Copy Address';
            }, 2000);
        });
    }
}

// Global functions for HTML onclick handlers
function closeBetModal() {
    bettingUI.closeBetModal();
}

function copyAddress() {
    bettingUI.copyAddress();
}

// Initialize on DOM ready
let bettingUI;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bettingUI = new BettingUI();
    });
} else {
    bettingUI = new BettingUI();
}
