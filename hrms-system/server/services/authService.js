const pool = require('../config/db');
let bcrypt;
try { bcrypt = require('bcryptjs'); } catch(e) { bcrypt = require('bcrypt'); }
const jwt = require('jsonwebtoken');

class AuthService {
  async login(username, password, ipAddress, userAgent) {
    const rawUser = (username || '').trim();
    const rawPass = (password || '').trim();

    if (!rawUser || !rawPass) {
      throw new Error('Username and password are required');
    }

    const aliases = [
      rawUser.toLowerCase(),
      rawUser.toLowerCase().replace(/@bsctextiles\.com$/i, ''),
      `${rawUser.toLowerCase()}@bsctextiles.com`
    ];

    // 1. Query database first for exact username, stripped username, or email
    const [rows] = await pool.query(
      `SELECT id, username, password, full_name as fullName, role, active as status, email
       FROM users
       WHERE LOWER(TRIM(username)) IN (?) 
          OR (email IS NOT NULL AND LOWER(TRIM(email)) IN (?))`,
      [aliases, aliases]
    );

    if (rows.length > 0) {
      const user = rows[0];

      if (!user.status) {
        throw new Error('Your account has been deactivated. Please contact administrator.');
      }

      let isMatch = false;
      const isHashed = typeof user.password === 'string' && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));

      if (isHashed) {
        try {
          isMatch = await bcrypt.compare(rawPass, user.password);
        } catch (e) {
          isMatch = false;
        }
      } else {
        // Legacy plaintext comparison only if password in database was stored in unhashed format
        if (user.password === rawPass) {
          isMatch = true;
          // Auto-upgrade legacy plaintext password to bcrypt hash on successful login
          try {
            const upgradedHash = await bcrypt.hash(rawPass, 10);
            await pool.query('UPDATE users SET password = ? WHERE id = ?', [upgradedHash, user.id]);
          } catch (e) {}
        }
      }

      if (!isMatch) {
        throw new Error('Incorrect username or password');
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role || user.roleName, fullName: user.fullName },
        process.env.JWT_SECRET || 'bsc_hrms_super_secret_jwt_key_2026',
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_REFRESH_SECRET || 'bsc_hrms_super_secret_refresh_key_2026',
        { expiresIn: '1h' }
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

    // 2. Fallback for hardcoded demo accounts when password is bsc@2026
    if (rawPass === 'bsc@2026') {
      const demoUsers = {
        'admin@bsctextiles.com': { id: 999, username: 'Admin', role: 'Admin', fullName: 'System Admin' },
        'admin': { id: 999, username: 'Admin', role: 'Admin', fullName: 'System Admin' },
        'hr@bsctextiles.com': { id: 998, username: 'HR Admin', role: 'HR', fullName: 'HR Admin' },
        'hr': { id: 998, username: 'HR Admin', role: 'HR', fullName: 'HR Admin' },
        'manager@bsctextiles.com': { id: 997, username: 'Store Manager', role: 'Manager', fullName: 'Store Manager' },
        'manager': { id: 997, username: 'Store Manager', role: 'Manager', fullName: 'Store Manager' }
      };
      const demoUser = demoUsers[rawUser.toLowerCase()];
      if (demoUser) {
        const token = jwt.sign(
          { id: demoUser.id, username: demoUser.username, role: demoUser.role, fullName: demoUser.fullName },
          process.env.JWT_SECRET || 'bsc_hrms_super_secret_jwt_key_2026',
          { expiresIn: '1h' }
        );
        return {
          token,
          refreshToken: token,
          user: {
            ...demoUser,
            displayName: demoUser.fullName
          }
        };
      }
    }

    throw new Error('Incorrect username or password');
  }

  async verifyUser(username, password) {
    try {
      const res = await this.login(username, password, '', '');
      return {
        success: true,
        role: res.user.role,
        displayName: res.user.displayName,
        data: res
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async logout(token, userId) {
    return true;
  }
}

module.exports = new AuthService();
