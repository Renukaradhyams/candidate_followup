const db = require('../config/db');

const logAction = async (username, action, module, details = null, ipAddress = null) => {
  try {
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
    await db.query(
      `INSERT INTO audit_logs (username, action, module, details, ip_address) VALUES (?, ?, ?, ?, ?)`,
      [username || 'SYSTEM', action, module, detailsStr, ipAddress || null]
    );
  } catch (err) {
    console.error('Audit Log Error:', err.message);
  }
};

module.exports = {
  logAction
};
