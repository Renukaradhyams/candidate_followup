const authService = require('../services/authService');
const { successRes, errorRes } = require('../utils/response');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password, req.ip, req.headers['user-agent']);
      return successRes(res, result, 'Login successful');
    } catch (err) {
      return errorRes(res, err.message, [err.message], 401);
    }
  }

  async verifyUser(req, res) {
    try {
      const { username, password } = req.body;
      const result = await authService.verifyUser(username, password);
      return res.json(result);
    } catch (err) {
      return res.json({ success: false, error: err.message });
    }
  }

  async logout(req, res) {
    try {
      let token = null;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      }
      await authService.logout(token, req.user ? req.user.id : null);
      return successRes(res, {}, 'Logged out successfully');
    } catch (err) {
      return errorRes(res, 'Logout failed', [err.message], 500);
    }
  }

  async getMe(req, res) {
    return successRes(res, { user: req.user }, 'User profile retrieved');
  }
}

module.exports = new AuthController();
