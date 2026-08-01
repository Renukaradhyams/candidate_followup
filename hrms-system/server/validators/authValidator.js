const { errorRes } = require('../utils/response');

const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  if (!username || typeof username !== 'string' || !username.trim()) {
    errors.push('Username or email is required');
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return errorRes(res, 'Validation Failed', errors, 400);
  }

  next();
};

module.exports = {
  validateLogin
};
