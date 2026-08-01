const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthService {
  async login(username, password, ipAddress, userAgent) {
    // Prepared statement
    const [rows] = await pool.query(
      `SELECT id, username, password, full_name as fullName, role, active as status
       FROM users
       WHERE LOWER(username) = LOWER(?)`,
      [username.trim()]
    );

    if (rows.length === 0) {
      throw new Error('Incorrect username or password');
    }

    const user = rows[0];

    if (!user.status) {
      throw new Error('Your account has been deactivated. Please contact administrator.');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new Error('Incorrect username or password');
    }

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
      `SELECT id, username, password, full_name as fullName, role, active as status
       FROM users
       WHERE LOWER(username) = LOWER(?) AND active = TRUE`,
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
    // Session cleanup logic removed as we don't have a sessions table in the new schema yet.
    return true;
  }
}

module.exports = new AuthService();
