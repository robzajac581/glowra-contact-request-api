/**
 * Admin API key middleware (GLO-119).
 *
 * Requires the X-API-Key header to match CONTACT_ADMIN_API_KEY. Fails closed:
 * if the env var is unset, every request is refused with 503. Same pattern as
 * glowra-search-api clinic-management/middleware/auth.js (GLO-93).
 */

const crypto = require('crypto');

const ENV_VAR = 'CONTACT_ADMIN_API_KEY';

function keysMatch(provided, expected) {
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdminApiKey(req, res, next) {
  const expectedKey = process.env[ENV_VAR];

  if (!expectedKey) {
    // Log the reason server-side; don't tell the caller how we're misconfigured.
    console.error(`${ENV_VAR} not configured - refusing ${req.method} ${req.originalUrl}`);
    return res.status(503).json({
      success: false,
      error: 'Service unavailable'
    });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !keysMatch(apiKey, expectedKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API key'
    });
  }

  next();
}

module.exports = { requireAdminApiKey, ENV_VAR };
