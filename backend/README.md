# Pump Ponies Backend

Backend server for the Pump Ponies horse racing betting platform with Solana blockchain integration.

## Features

- **Unique Deposit Addresses**: Each bet request generates a unique Solana wallet address
- **Automatic Monitoring**: Continuously watches for incoming SOL transfers
- **Real-time Updates**: WebSocket support for live bet notifications
- **Automatic Winnings Calculation**: Proportional payout distribution with configurable house edge
- **Secure Payouts**: Automated winner payouts from master wallet

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Server    │
│   (Browser)     │◀────│   (Express)     │
└─────────────────┘     └────────┬────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Database    │      │  Wallet Service │      │ Deposit Monitor │
│   (SQLite)    │      │  (Generation)   │      │ (RPC Polling)   │
└───────────────┘      └─────────────────┘      └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  Solana Chain   │
                                                │  (RPC/Devnet)   │
                                                └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy the example config and edit it:

```bash
# Copy example config
cp env.example.txt .env

# Edit .env with your settings:
# - ADMIN_TOKEN: Secure token for admin endpoints
# - SOLANA_RPC_URL: Your Solana RPC endpoint
# - MASTER_WALLET_PRIVATE_KEY: For processing payouts
```

### 3. Initialize Database

```bash
npm run init-db
```

### 4. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:20101`

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/race/active` | Get current active race |
| GET | `/races` | Get all races |
| GET | `/race/:id` | Get specific race details |
| GET | `/race/:id/pools` | Get betting pools and odds |
| POST | `/bet/deposit-address` | Generate deposit address |
| GET | `/bet/status/:deposit_id` | Check deposit/bet status |
| GET | `/race/:id/bets` | Get all bets for a race |
| GET | `/user/:wallet/bets` | Get user's bet history |

### Admin Endpoints (require Bearer token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/race/create` | Create new race |
| POST | `/admin/race/open` | Open betting |
| POST | `/admin/race/close` | Close betting |
| POST | `/admin/race/end` | End race & declare winner |
| POST | `/admin/payouts/process` | Process all pending payouts |
| GET | `/admin/payouts/pending` | List pending payouts |
| POST | `/admin/collect-deposits` | Collect deposits to master |
| GET | `/admin/wallet/balance` | Get master wallet balance |

## Betting Flow

### 1. User Requests Deposit Address

```javascript
POST /bet/deposit-address
{
  "race_id": "race_abc123",
  "horse_number": 3,
  "user_wallet": "UserWallet123..." // optional
}

// Response
{
  "success": true,
  "data": {
    "deposit_id": "uuid-xxx",
    "deposit_address": "SoLaNA123...",
    "horse_number": 3,
    "horse_name": "Whalehinny",
    "min_bet": 0.01,
    "max_bet": 20,
    "expires_at": 1704070800,
    "expires_in_seconds": 1800
  }
}
```

### 2. User Sends SOL to Deposit Address

User transfers SOL directly to the unique deposit address from their wallet.

### 3. Monitor Detects Transfer

The backend continuously polls all active deposit addresses. When a transfer is detected:

1. Validates amount (min/max)
2. Verifies race is still open
3. Creates bet record
4. Broadcasts update via WebSocket

### 4. Admin Ends Race

```javascript
POST /admin/race/end
{
  "race_id": "race_abc123",
  "winner": 3
}

// Response includes calculated winnings for all bets
```

### 5. Payouts Processed

```javascript
POST /admin/payouts/process

// Automatically sends SOL to all winners
```

## WebSocket Events

Connect to `ws://localhost:20101/ws` for real-time updates:

```javascript
// On connect - receive current race state
{ "type": "connected", "race": {...} }

// When bet is placed
{ "type": "bet_placed", "bet": {...}, "pools": {...} }

// When race status changes
{ "type": "race_opened", "race": {...} }
{ "type": "race_closed", "race": {...} }
{ "type": "race_ended", "race": {...}, "results": {...} }
```

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 20101 | Server port |
| `ADMIN_TOKEN` | - | Bearer token for admin endpoints |
| `SOLANA_RPC_URL` | devnet | Solana RPC endpoint |
| `MASTER_WALLET_PRIVATE_KEY` | - | For payouts (base58) |
| `MIN_BET_SOL` | 0.01 | Minimum bet amount |
| `MAX_BET_SOL` | 100 | Maximum bet amount |
| `HOUSE_EDGE_PERCENT` | 5 | House take percentage |
| `DEPOSIT_EXPIRY_MINUTES` | 30 | Address expiration |
| `MONITOR_INTERVAL_MS` | 5000 | Polling frequency |

## Database Schema

- **races**: Race definitions (id, title, status, winner, etc.)
- **horses**: Horse names per race
- **deposit_addresses**: Generated addresses with private keys
- **bets**: Confirmed bets with amounts and odds
- **payouts**: Payout records and status
- **config**: Runtime configuration

## Security Considerations

1. **Private Keys**: Deposit address private keys are stored encrypted in the database. Only use a secure database location.

2. **Master Wallet**: The master wallet private key should be stored securely (environment variable or secrets manager).

3. **Admin Token**: Use a strong, random admin token. Consider rotating periodically.

4. **RPC Rate Limits**: If using public RPC endpoints, be aware of rate limits. Consider a paid RPC provider for production.

5. **Database Backups**: Regularly backup the SQLite database file.

## Development

### Testing on Devnet

1. Set `SOLANA_RPC_URL=https://api.devnet.solana.com`
2. Create a devnet wallet and airdrop SOL: `solana airdrop 2`
3. Use devnet SOL for testing bets

### Debugging

Set `LOG_LEVEL=debug` for verbose logging.

### Mock Mode

The frontend can run in mock mode without the backend by setting `USE_MOCK: true` in the config.

## Production Deployment

1. Use mainnet RPC: `https://api.mainnet-beta.solana.com` or a paid provider
2. Set strong `ADMIN_TOKEN`
3. Configure master wallet with sufficient SOL for payouts
4. Use PM2 or similar for process management
5. Set up database backups
6. Consider using PostgreSQL for larger scale

## License

MIT
