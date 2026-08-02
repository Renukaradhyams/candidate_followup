const jwt = require('jsonwebtoken');
const { errorRes } = require('../utils/response');

const authenticate = (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return errorRes(res, 'Authentication token required', [], 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bsc_hrms_super_secret_jwt_key_2026');
    req.user = decoded;
    next();
  } catch (err) {
    return errorRes(res, 'Invalid or expired authentication token', [err.message], 401);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return errorRes(res, 'Forbidden: insufficient permissions', [], 403);
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorize
};
