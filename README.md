# PUMP PONIES

AI Horse Racing Betting Platform on Solana

## Project Structure

```
ARENAI/
├── index.html          # Main betting interface
├── admin.html          # Admin dashboard
├── terms.html          # Terms and conditions
├── privacy.html        # Privacy policy
├── js/
│   ├── config.js       # Frontend configuration
│   ├── api.js          # API client
│   └── betting-ui.js   # Betting interface logic
├── css/                # Stylesheets
├── images/             # Images and icons
├── fonts/              # Custom fonts
└── backend/            # Node.js backend server
    ├── src/
    │   ├── server.js   # Main Express server
    │   ├── db/         # Database schema and queries
    │   ├── services/   # Business logic
    │   └── middleware/ # Security middleware
    ├── package.json
    └── .env.example    # Environment variables template
```

## Deployment

### Admin Panel (Local Only)

The `admin.html` file is excluded from git and should NOT be deployed. Keep it on your local machine only.

To use it:
1. Open `admin.html` in a text editor
2. Change `API_BASE` to your Railway backend URL (e.g., `https://your-app.up.railway.app`)
3. Open `admin.html` in your browser
4. Enter your admin token to log in
5. Control the live races from your local machine

### Backend (Railway)

1. Create a new Railway project
2. Connect your GitHub repository
3. Set the root directory to `/backend`
4. Add environment variables from `.env.example`
5. Deploy

Required environment variables:
- `PORT` - Set automatically by Railway
- `NODE_ENV` - Set to `production`
- `ADMIN_TOKEN` - Secure admin token
- `ENCRYPTION_SECRET` - 32+ character secret for encrypting wallet keys
- `SOLANA_RPC_URL` - Solana RPC endpoint
- `MASTER_WALLET_PRIVATE_KEY` - Base58 private key for payouts
- `ALLOWED_ORIGINS` - Your frontend domain(s)

### Frontend (Static Hosting)

The frontend is static HTML/CSS/JS. Deploy to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting

Update `js/config.js` with your Railway backend URL before deploying.

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your values
npm install
npm run dev
```

### Frontend

Open `index.html` in a browser or use a local server:
```bash
npx serve .
```

## Features

- 10 AI horses with unique colors
- Real-time betting updates via WebSocket
- Automatic deposit monitoring
- Pari-mutuel odds calculation
- Admin dashboard for race management
- Solana blockchain integration

## Horses

1. **Neighkamoto** - Red
2. **Stablecolt** - White
3. **Whalehinny** - Navy Blue
4. **Hoofproof** - Yellow
5. **Gallopchain** - Forest Green
6. **Mareketcap** - Black & Gold
7. **Stalloshi** - Orange
8. **Trothereum** - Pink
9. **Neighonce** - Pastel Blue
10. **Foalment** - Purple
