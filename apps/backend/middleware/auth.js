const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production' && !process.env.JWT_SECRET) {
      try {
        return jwt.verify(token, 'dev-secret-change-me');
      } catch (fallbackErr) {
        // Fallback also failed, propagate original error
      }
    }
    throw err;
  }
}

// Admin-portal auth. Rejects resident-scoped tokens so a resident login
// can never be used to reach admin-only routes.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }

  try {
    const payload = verifyToken(token);
    if (payload.scope === 'resident') {
      return res.status(403).json({ message: 'This account does not have administrative access.' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

const pool = require('../db/pool');

// Resident-portal auth. Only accepts tokens issued by resident login/register.
// Immediately rejects and logs out the resident if their account has been deleted by an admin.
async function requireResidentAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }

  try {
    const payload = verifyToken(token);
    if (payload.scope !== 'resident') {
      return res.status(403).json({ message: 'This route is for resident accounts only.' });
    }

    // Verify resident record still exists in the database
    const { rows } = await pool.query(
      'SELECT id, status, password_hash FROM residents WHERE id = $1',
      [payload.id]
    );

    if (rows.length === 0 || !rows[0].password_hash || rows[0].status === 'Rejected') {
      return res.status(401).json({
        message: 'Your resident account is no longer active or has been removed. You have been logged out.',
        code: 'ACCOUNT_DELETED',
      });
    }

    req.resident = payload;
    req.residentRecord = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = { requireAuth, requireResidentAuth, JWT_SECRET };
