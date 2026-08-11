const jwt = require('jsonwebtoken');
const { errorRes } = require('../utils/response');

// Rolling memory log buffer for 403 audit logs (max 200 entries)
const auditLogBuffer = [];
const MAX_AUDIT_LOGS = 200;

function parseUserAgent(ua = '') {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';
  else if (/msie|trident/i.test(ua)) browser = 'Internet Explorer';

  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  return { browser, os, raw: ua };
}

function log403(req, reason, details = {}) {
  const ua = parseUserAgent(req ? (req.headers ? req.headers['user-agent'] : '') : '');
  const ip = req ? (req.ip || (req.headers ? req.headers['x-forwarded-for'] : null) || (req.connection && req.connection.remoteAddress) || 'Unknown IP') : 'Unknown IP';
  const timestamp = new Date().toISOString();

  const auditEntry = {
    id: `403-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    event: '403_FORBIDDEN_DENIED',
    timestamp,
    userId: req && req.user ? req.user.id : null,
    username: req && req.user ? req.user.username : null,
    role: req && req.user ? req.user.role : 'Unauthenticated / Guest',
    ip,
    browser: ua.browser,
    os: ua.os,
    userAgent: ua.raw,
    requestedUrl: req ? (req.originalUrl || req.url) : 'N/A',
    apiEndpoint: req ? ((req.baseUrl || '') + (req.path || '')) : 'N/A',
    method: req ? req.method : 'N/A',
    authStatus: req && req.user ? 'AUTHENTICATED' : 'UNAUTHENTICATED',
    permissionCheck: details.requiredRoles ? `Required: [${details.requiredRoles.join(', ')}], Given: '${req && req.user ? req.user.role : 'None'}'` : 'N/A',
    serverReason: reason,
    extraDetails: details
  };

  auditLogBuffer.unshift(auditEntry);
  if (auditLogBuffer.length > MAX_AUDIT_LOGS) {
    auditLogBuffer.pop();
  }

  console.error('[SECURITY AUDIT 403 REJECTION]', JSON.stringify(auditEntry, null, 2));
  return auditEntry;
}

function get403Logs(limit = 50) {
  return auditLogBuffer.slice(0, limit);
}

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return '';
  const clean = role.trim().toLowerCase();
  if (clean === 'admin' || clean === 'administrator' || clean === 'super admin' || clean === 'superadmin') return 'admin';
  if (clean === 'hr' || clean === 'hr manager' || clean === 'hr executive' || clean === 'hr specialist') return 'hr';
  if (clean === 'manager' || clean === 'store manager' || clean === 'floor manager') return 'manager';
  if (clean === 'recruiter') return 'recruiter';
  if (clean === 'interviewer') return 'interviewer';
  return clean;
};

const authenticate = (req, res, next) => {
  try {
    let token = null;
    if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers && req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      log403(req, 'Authentication token missing from headers/cookies', { requiredRoles: [] });
      return errorRes(res, 'Authentication token required', ['No valid authentication token provided in Authorization header or x-auth-token'], 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bsc_hrms_super_secret_jwt_key_2026');
    req.user = decoded;
    next();
  } catch (err) {
    log403(req, `JWT Verification Failed: ${err.message}`);
    return errorRes(res, 'Invalid or expired authentication token', [err.message], 401);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      log403(req, 'Authorization failed: No authenticated user session found', { requiredRoles: roles });
      return errorRes(res, 'Forbidden: User session missing', [{ reason: 'Unauthenticated request to protected endpoint', requiredRoles: roles }], 403);
    }

    const userRoleNorm = normalizeRole(req.user.role);
    const allowedRolesNorm = roles.map(normalizeRole);

    const isAuthorized = allowedRolesNorm.includes(userRoleNorm) || allowedRolesNorm.includes(req.user.role) || roles.includes(req.user.role);

    if (!isAuthorized) {
      const reason = `Forbidden: Role '${req.user.role}' is not authorized to access endpoint '${req.originalUrl}'`;
      log403(req, reason, { requiredRoles: roles });
      return errorRes(res, reason, [{
        reason: 'Insufficient role permissions',
        requiredRoles: roles,
        userRole: req.user.role,
        requestedUrl: req.originalUrl
      }], 403);
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  log403,
  get403Logs
};


