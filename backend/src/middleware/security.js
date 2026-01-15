/**
 * Security Middleware for Pump Ponies Backend
 * Comprehensive protection against common attack vectors
 */

// In-memory rate limiting store
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMITS = {
    public: 120,     // 120 requests per minute for public endpoints
    betting: 60,     // 60 deposit address requests per minute per IP
    admin: 60        // 60 admin requests per minute
};

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.windowStart > RATE_LIMIT_WINDOW * 2) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware
 */
function rateLimit(type = 'public') {
    const limit = RATE_LIMITS[type] || RATE_LIMITS.public;
    
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const key = `${type}:${ip}`;
        const now = Date.now();
        
        let data = rateLimitStore.get(key);
        
        if (!data || now - data.windowStart > RATE_LIMIT_WINDOW) {
            data = { count: 1, windowStart: now };
            rateLimitStore.set(key, data);
        } else {
            data.count++;
        }
        
        // Add rate limit headers
        res.set('X-RateLimit-Limit', limit);
        res.set('X-RateLimit-Remaining', Math.max(0, limit - data.count));
        res.set('X-RateLimit-Reset', Math.ceil((data.windowStart + RATE_LIMIT_WINDOW) / 1000));
        
        if (data.count > limit) {
            console.warn(`[SECURITY] Rate limit exceeded: ${ip} (${type})`);
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.',
                retry_after: Math.ceil((data.windowStart + RATE_LIMIT_WINDOW - now) / 1000)
            });
        }
        
        next();
    };
}

/**
 * Input sanitization - removes dangerous characters and validates types
 */
function sanitizeInput(req, res, next) {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Remove null bytes and control characters (except newlines/tabs)
            return obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                      .trim()
                      .slice(0, 10000); // Max 10KB per string field
        }
        if (Array.isArray(obj)) {
            return obj.slice(0, 100).map(sanitize); // Max 100 items
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                // Only allow alphanumeric keys with underscores
                if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) && key.length <= 50) {
                    sanitized[key] = sanitize(value);
                }
            }
            return sanitized;
        }
        return obj;
    };
    
    if (req.body && typeof req.body === 'object') {
        req.body = sanitize(req.body);
    }
    
    next();
}

/**
 * Audit logging - logs all requests for security review
 */
const auditLog = [];
const MAX_AUDIT_LOG = 10000;

function auditLogger(req, res, next) {
    const entry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')?.slice(0, 200),
        isAdmin: req.path.startsWith('/admin'),
        body: req.method === 'POST' ? { ...req.body, private_key: '[REDACTED]' } : undefined
    };
    
    // Add to in-memory log
    auditLog.push(entry);
    if (auditLog.length > MAX_AUDIT_LOG) {
        auditLog.shift();
    }
    
    // Log admin actions to console
    if (entry.isAdmin) {
        console.log(`[AUDIT] ${entry.timestamp} ${entry.method} ${entry.path} from ${entry.ip}`);
    }
    
    // Track response status
    const originalSend = res.send;
    res.send = function(body) {
        entry.status = res.statusCode;
        entry.success = res.statusCode < 400;
        return originalSend.call(this, body);
    };
    
    next();
}

/**
 * Get audit logs (for admin review)
 */
function getAuditLogs(limit = 100) {
    return auditLog.slice(-limit).reverse();
}

/**
 * Security headers
 */
function securityHeaders(req, res, next) {
    // Prevent clickjacking
    res.set('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.set('X-Content-Type-Options', 'nosniff');
    
    // XSS Protection
    res.set('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Cache control for sensitive endpoints
    if (req.path.startsWith('/admin')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    
    next();
}

/**
 * Validate Solana address format
 */
function isValidSolanaAddress(address) {
    if (!address || typeof address !== 'string') return false;
    // Base58 characters only, 32-44 chars
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validate race ID format
 */
function isValidRaceId(id) {
    if (!id || typeof id !== 'string') return false;
    // race_[base36 timestamp]
    return /^race_[a-z0-9]{6,12}$/.test(id);
}

/**
 * Validate horse number
 */
function isValidHorseNumber(num) {
    const n = parseInt(num);
    return !isNaN(n) && n >= 1 && n <= 10;
}

/**
 * Request validation middleware generator
 */
function validateRequest(schema) {
    return (req, res, next) => {
        const errors = [];
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];
            
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }
            
            if (value !== undefined && value !== null) {
                if (rules.type === 'string' && typeof value !== 'string') {
                    errors.push(`${field} must be a string`);
                }
                if (rules.type === 'number') {
                    const num = parseFloat(value);
                    if (isNaN(num)) {
                        errors.push(`${field} must be a number`);
                    } else if (rules.min !== undefined && num < rules.min) {
                        errors.push(`${field} must be at least ${rules.min}`);
                    } else if (rules.max !== undefined && num > rules.max) {
                        errors.push(`${field} must be at most ${rules.max}`);
                    }
                }
                if (rules.type === 'race_id' && !isValidRaceId(value)) {
                    errors.push(`${field} is not a valid race ID`);
                }
                if (rules.type === 'solana_address' && !isValidSolanaAddress(value)) {
                    errors.push(`${field} is not a valid Solana address`);
                }
                if (rules.type === 'horse_number' && !isValidHorseNumber(value)) {
                    errors.push(`${field} must be a valid horse number (1-10)`);
                }
                if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
                    errors.push(`${field} must be at most ${rules.maxLength} characters`);
                }
                if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
                    errors.push(`${field} format is invalid`);
                }
            }
        }
        
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }
        
        next();
    };
}

/**
 * Nonce tracking for replay protection
 */
const processedNonces = new Set();
const MAX_NONCES = 100000;

function checkNonce(nonce) {
    if (!nonce) return true; // Nonce optional
    if (processedNonces.has(nonce)) return false;
    
    processedNonces.add(nonce);
    
    // Cleanup old nonces
    if (processedNonces.size > MAX_NONCES) {
        const iterator = processedNonces.values();
        for (let i = 0; i < MAX_NONCES / 2; i++) {
            processedNonces.delete(iterator.next().value);
        }
    }
    
    return true;
}

/**
 * Transaction signature tracking (prevent double processing)
 */
const processedSignatures = new Set();

function isSignatureProcessed(signature) {
    return processedSignatures.has(signature);
}

function markSignatureProcessed(signature) {
    processedSignatures.add(signature);
    
    // Keep only last 50k signatures
    if (processedSignatures.size > 50000) {
        const iterator = processedSignatures.values();
        for (let i = 0; i < 10000; i++) {
            processedSignatures.delete(iterator.next().value);
        }
    }
}

module.exports = {
    rateLimit,
    sanitizeInput,
    auditLogger,
    getAuditLogs,
    securityHeaders,
    validateRequest,
    isValidSolanaAddress,
    isValidRaceId,
    isValidHorseNumber,
    checkNonce,
    isSignatureProcessed,
    markSignatureProcessed
};
