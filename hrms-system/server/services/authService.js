const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthService {
  async login(username, password, ipAddress, userAgent) {
    // Prepared statement
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.password, u.fullName, u.role, u.status, u.failedLogins, u.lockedUntil, r.roleName
       FROM User u
       LEFT JOIN Role r ON u.roleId = r.id
       WHERE (LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)) AND u.deletedAt IS NULL`,
      [username.trim(), username.trim()]
    );

    if (rows.length === 0) {
      throw new Error('Incorrect username or password');
    }

    const user = rows[0];

    if (user.status !== 'Active') {
      throw new Error('Your account has been deactivated. Please contact administrator.');
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw new Error('Account locked due to consecutive failed login attempts. Try again later.');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const failed = user.failedLogins + 1;
      let lockTime = null;
      if (failed >= 5) {
        lockTime = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
      }
      await pool.query(
        `UPDATE User SET failedLogins = ?, lockedUntil = ? WHERE id = ?`,
        [failed, lockTime, user.id]
      );
      throw new Error('Incorrect username or password');
    }

    // Reset failed logins
    await pool.query(
      `UPDATE User SET failedLogins = 0, lockedUntil = NULL WHERE id = ?`,
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role || user.roleName, fullName: user.fullName },
      process.env.JWT_SECRET || 'bsc_hrms_super_secret_jwt_key_2026',
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_REFRESH_SECRET || 'bsc_hrms_super_secret_refresh_key_2026',
      { expiresIn: '7d' }
    );

    // Save UserSession
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO UserSession (userId, token, refreshToken, ipAddress, userAgent, expiresAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, token, refreshToken, ipAddress || null, userAgent || null, expiresAt]
    );

    // Log Audit
    await pool.query(
      `INSERT INTO AuditLog (userId, username, action, module, details, ipAddress, browser)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, 'LOGIN_SUCCESS', 'AUTH', JSON.stringify({ role: user.role }), ipAddress, userAgent]
    );

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || user.roleName,
        fullName: user.fullName,
        displayName: user.fullName || user.role
      }
    };
  }

  async verifyUser(username, password) {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.password, u.fullName, u.role, u.status
       FROM User u
       WHERE LOWER(u.username) = LOWER(?) AND u.status = 'Active' AND u.deletedAt IS NULL`,
      [username.trim()]
    );

    if (rows.length === 0) return { success: false };

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return { success: false };

    return {
      success: true,
      role: user.role,
      displayName: user.fullName || user.role
    };
  }

  async logout(token, userId) {
    if (token) {
      await pool.query(`UPDATE UserSession SET deletedAt = CURRENT_TIMESTAMP WHERE token = ?`, [token]);
    }
    if (userId) {
      await pool.query(
        `INSERT INTO AuditLog (userId, username, action, module) VALUES (?, 'USER', 'LOGOUT', 'AUTH')`,
        [userId]
      );
    }
    return true;
  }
}

module.exports = new AuthService();
