/**
 * Encryption utilities for sensitive data (private keys)
 * Uses AES-256-GCM for authenticated encryption
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Derives an encryption key from the master secret
 * Uses PBKDF2 with 100,000 iterations
 */
function deriveKey(secret, salt) {
    return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
}

/**
 * Encrypts a private key
 * @param {string} privateKey - The private key to encrypt (base58)
 * @param {string} encryptionSecret - Secret from environment variable
 * @returns {string} - Encrypted data as base64 (salt:iv:authTag:ciphertext)
 */
function encryptPrivateKey(privateKey, encryptionSecret) {
    if (!encryptionSecret || encryptionSecret.length < 32) {
        throw new Error('ENCRYPTION_SECRET must be at least 32 characters');
    }
    
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from secret
    const key = deriveKey(encryptionSecret, salt);
    
    // Encrypt
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    
    // Combine: salt:iv:authTag:ciphertext
    return [
        salt.toString('base64'),
        iv.toString('base64'),
        authTag.toString('base64'),
        encrypted
    ].join(':');
}

/**
 * Decrypts a private key
 * @param {string} encryptedData - Encrypted data from database
 * @param {string} encryptionSecret - Secret from environment variable
 * @returns {string} - Decrypted private key (base58)
 */
function decryptPrivateKey(encryptedData, encryptionSecret) {
    if (!encryptionSecret || encryptionSecret.length < 32) {
        throw new Error('ENCRYPTION_SECRET must be at least 32 characters');
    }
    
    // Parse components
    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
    }
    
    const [saltB64, ivB64, authTagB64, ciphertext] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    
    // Derive key from secret
    const key = deriveKey(encryptionSecret, salt);
    
    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

/**
 * Checks if data appears to be encrypted (has the salt:iv:tag:cipher format)
 */
function isEncrypted(data) {
    if (!data || typeof data !== 'string') return false;
    const parts = data.split(':');
    return parts.length === 4 && parts.every(p => p.length > 0);
}

module.exports = {
    encryptPrivateKey,
    decryptPrivateKey,
    isEncrypted
};
