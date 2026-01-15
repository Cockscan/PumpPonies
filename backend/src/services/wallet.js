/**
 * Wallet Service - Generates unique Solana deposit addresses
 */

const { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58');

class WalletService {
    constructor(connection) {
        this.connection = connection;
    }

    /**
     * Generate a new unique deposit address (keypair)
     * @returns {Object} { publicKey, privateKey } - both as base58 strings
     */
    generateDepositAddress() {
        const keypair = Keypair.generate();
        return {
            publicKey: keypair.publicKey.toBase58(),
            privateKey: bs58.encode(keypair.secretKey)
        };
    }

    /**
     * Restore a keypair from private key
     * @param {string} privateKeyBase58 - Base58 encoded private key
     * @returns {Keypair}
     */
    getKeypairFromPrivateKey(privateKeyBase58) {
        const secretKey = bs58.decode(privateKeyBase58);
        return Keypair.fromSecretKey(secretKey);
    }

    /**
     * Get balance of an address in SOL
     * @param {string} address - Public key as base58 string
     * @returns {Promise<number>} Balance in SOL
     */
    async getBalance(address) {
        try {
            const publicKey = new PublicKey(address);
            const balance = await this.connection.getBalance(publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }

    /**
     * Get recent transactions for an address
     * @param {string} address - Public key as base58 string
     * @param {number} limit - Number of transactions to fetch
     * @returns {Promise<Array>}
     */
    async getRecentTransactions(address, limit = 10) {
        try {
            const publicKey = new PublicKey(address);
            const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit });
            return signatures;
        } catch (error) {
            console.error('Error getting transactions:', error);
            return [];
        }
    }

    /**
     * Get transaction details
     * @param {string} signature - Transaction signature
     * @returns {Promise<Object|null>}
     */
    async getTransaction(signature) {
        try {
            const tx = await this.connection.getParsedTransaction(signature, {
                maxSupportedTransactionVersion: 0
            });
            return tx;
        } catch (error) {
            console.error('Error getting transaction:', error);
            return null;
        }
    }

    /**
     * Check if a transaction is a SOL transfer to this address
     * @param {Object} tx - Parsed transaction
     * @param {string} toAddress - Expected recipient address
     * @returns {Object|null} { fromAddress, amount } or null if not a transfer
     */
    parseSOLTransfer(tx, toAddress) {
        if (!tx || !tx.meta || tx.meta.err) return null;

        try {
            const accountKeys = tx.transaction.message.accountKeys;
            const preBalances = tx.meta.preBalances;
            const postBalances = tx.meta.postBalances;

            // Find the index of our deposit address
            const toIndex = accountKeys.findIndex(
                acc => acc.pubkey.toBase58() === toAddress
            );

            if (toIndex === -1) return null;

            // Calculate amount received
            const amountLamports = postBalances[toIndex] - preBalances[toIndex];
            
            if (amountLamports <= 0) return null;

            // Find sender (first account with decreased balance, excluding fee payer logic)
            let fromAddress = null;
            for (let i = 0; i < accountKeys.length; i++) {
                if (i === toIndex) continue;
                const diff = postBalances[i] - preBalances[i];
                if (diff < 0) {
                    fromAddress = accountKeys[i].pubkey.toBase58();
                    break;
                }
            }

            return {
                fromAddress,
                amount: amountLamports / LAMPORTS_PER_SOL,
                signature: tx.transaction.signatures[0]
            };
        } catch (error) {
            console.error('Error parsing transfer:', error);
            return null;
        }
    }

    /**
     * Validate a Solana public key
     * @param {string} address 
     * @returns {boolean}
     */
    isValidAddress(address) {
        try {
            new PublicKey(address);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = WalletService;
