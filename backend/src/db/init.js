/**
 * Database Initialization Script
 * Run with: npm run init-db
 */

require('dotenv').config();
const path = require('path');
const PumpPoniesDB = require('./schema');

const dbPath = process.env.DATABASE_PATH || './data/pump_ponies.db';

console.log('Initializing database at:', dbPath);

const db = new PumpPoniesDB(dbPath);
db.initialize();

// Add default horses if needed
const DEFAULT_HORSES = [
    'Neighkamoto', 'Stablecolt', 'Whalehinny', 'Hoofproof',
    'Gallopchain', 'Mareketcap', 'Stalloshi', 'Trothereum',
    'Neighonce', 'Foalment'
];

console.log('Default horse names:', DEFAULT_HORSES);
console.log('\nDatabase initialized successfully!');
console.log('You can now start the server with: npm start');

db.close();
