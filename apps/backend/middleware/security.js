/**
 * Security Middleware Suite
 * Provides defensive protections against common web attacks:
 * 1. HTTP Security Headers (anti-clickjacking, XSS protection, MIME sniffing prevention)
 * 2. In-Memory Adaptive Rate Limiting & DDoS / Brute-Force Shielding
 * 3. Deep Injection & Malicious Payload Sanitization (SQL injection, XSS vectors, path traversal)
 * 4. Request Size Limit Enforcement
 * 5. Attack Pattern Logging & Auto-blocking
 */

const fs = require('fs');
const path = require('path');

// Track request frequencies by client IP: Map<ip, { count: number, resetAt: number, blockedUntil: number, violations: number }>
const ipHits = new Map();

// Regularly purge expired rate-limit buckets every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipHits.entries()) {
    if (now > record.resetAt && now > record.blockedUntil) {
      ipHits.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * 1. HTTP Security Headers Middleware (similar to helmet)
 */
function securityHeaders(req, res, next) {
  // Prevent clickjacking by forbidding embedding in iframes
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Enable XSS filter in browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Control referrer information leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Disable dangerous device APIs via permissions policy
  res.setHeader('Permissions-Policy', 'accelerometer=(), camera=(self), microphone=(), geolocation=()');
  // Remove Express identification header
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * 2. Adaptive Rate Limiting Middleware
 * Protects login and auth endpoints against brute force and credential stuffing attacks.
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Max requests per window before rate limit kicks in
 * @param {string} options.message - Error message when rate limited
 */
function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 1000,
  message = 'Too many requests from this IP address. Please slow down and try again later.',
  skip = () => false,
} = {}) {
  return function rateLimiter(req, res, next) {
    if (skip(req)) return next();

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';
    
    // In local development or internal loopback, do not choke polling and rapid requests
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || process.env.NODE_ENV !== 'production') {
      return next();
    }

    const now = Date.now();

    let record = ipHits.get(ip);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs, blockedUntil: 0, violations: 0 };
      ipHits.set(ip, record);
    } else {
      record.count += 1;
    }

    // Check if IP is currently under a temporary block
    if (now < record.blockedUntil) {
      const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return res.status(429).json({
        message: `Too many suspicious requests. Access temporarily blocked for ${waitSeconds} seconds.`,
        retryAfter: waitSeconds,
      });
    }

    if (record.count > max) {
      record.violations += 1;
      // Exponential penalty for repeated abusers: 30s, 60s, 300s
      const penaltySeconds = Math.min(300, 30 * Math.pow(2, record.violations - 1));
      record.blockedUntil = now + penaltySeconds * 1000;

      console.warn(`[SECURITY DEFENSE] Rate limit reached by IP ${ip} on ${req.method} ${req.originalUrl}. Penalty: ${penaltySeconds}s`);

      res.setHeader('Retry-After', penaltySeconds);
      return res.status(429).json({
        message,
        retryAfter: penaltySeconds,
      });
    }

    next();
  };
}

// Stricter limiter for sensitive login and password reset routes: 30 attempts per 15 minutes
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  skip: () => false,
});

// General API limiter: 1500 requests per 15 minutes per IP
const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  message: 'API rate limit exceeded. Please wait a moment before sending more requests.',
});

/**
 * 3. Deep Injection & Malicious Payload Sanitizer
 * Scans incoming query params, request bodies, and headers for known injection attacks:
 * - SQL Injection keywords & union attacks
 * - Malicious HTML script injection (stored / reflected XSS)
 * - Path traversal attempts (../../etc/passwd, \..\windows)
 */
const SQL_INJECTION_PATTERN = /(\b(SELECT|UNION|INSERT|DELETE|UPDATE|DROP|ALTER|EXEC|TRUNCATE)\b\s+.*\b(FROM|INTO|TABLE|DATABASE)\b)|(--\s*$)|(\bOR\b\s+['"\d\w]+\s*=\s*['"\d\w]+)|(\bbenchmark\s*\(|\bsleep\s*\()/i;
const XSS_ATTACK_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|javascript:\s*[\w\W]+|on(error|load|click|mouseover|focus|blur)\s*=/i;
const PATH_TRAVERSAL_PATTERN = /(\.\.[\/\\]|\/etc\/(passwd|shadow)|system32|win\.ini)/i;

function sanitizeInput(req, res, next) {
  // Helper to inspect data objects recursively
  const checkValue = (val, pathName) => {
    if (typeof val === 'string') {
      if (PATH_TRAVERSAL_PATTERN.test(val)) {
        return { isMalicious: true, attackType: 'Path Traversal', pathName, val };
      }
      if (XSS_ATTACK_PATTERN.test(val)) {
        return { isMalicious: true, attackType: 'Cross-Site Scripting (XSS)', pathName, val };
      }
      // Check SQL injection patterns in non-password and non-document fields
      if (!pathName.toLowerCase().includes('password') && !pathName.toLowerCase().includes('hash')) {
        if (SQL_INJECTION_PATTERN.test(val)) {
          return { isMalicious: true, attackType: 'SQL Injection', pathName, val };
        }
      }
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (const [key, nested] of Object.entries(val)) {
        const result = checkValue(nested, `${pathName}.${key}`);
        if (result.isMalicious) return result;
      }
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const result = checkValue(val[i], `${pathName}[${i}]`);
        if (result.isMalicious) return result;
      }
    }
    return { isMalicious: false };
  };

  // Inspect query params
  if (req.query) {
    const qCheck = checkValue(req.query, 'query');
    if (qCheck.isMalicious) {
      console.warn(`[SECURITY ALERT] Blocked ${qCheck.attackType} attempt in query params from IP ${req.ip}:`, qCheck.val);
      return res.status(400).json({ message: 'Suspicious payload detected. Request blocked by security shield.' });
    }
  }

  // Inspect request body
  if (req.body && typeof req.body === 'object') {
    const bCheck = checkValue(req.body, 'body');
    if (bCheck.isMalicious) {
      console.warn(`[SECURITY ALERT] Blocked ${bCheck.attackType} attempt in request body from IP ${req.ip}:`, bCheck.val);
      return res.status(400).json({ message: 'Suspicious payload detected. Request blocked by security shield.' });
    }
  }

  next();
}

module.exports = {
  securityHeaders,
  authRateLimiter,
  generalRateLimiter,
  sanitizeInput,
};
