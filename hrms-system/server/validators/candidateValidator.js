const { errorRes } = require('../utils/response');

const validateAddCandidate = (req, res, next) => {
  const d = req.body.data || req.body;
  const errors = [];

  const name = d.name || d.candidateName;
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Full candidate name is required');
  }

  const phone = d.phone || d.mobile;
  if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
    errors.push('Valid 10-digit mobile number is required');
  }

  const desig = d.desig || d.designation;
  if (!desig || typeof desig !== 'string' || !desig.trim()) {
    errors.push('Designation position is required');
  }

  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) {
    errors.push('Invalid email address format');
  }

  const expSal = parseFloat(d.expectedSalary || d.salary || 0);
  if (isNaN(expSal) || expSal < 8000) {
    errors.push('Expected salary must be a valid number of at least ₹8,000');
  }

  if (errors.length > 0) {
    return errorRes(res, 'Validation Failed', errors, 400);
  }

  next();
};

const validateUpdateCandidate = (req, res, next) => {
  const { appNo, updates } = req.body;
  const errors = [];

  if (!appNo || typeof appNo !== 'string') {
    errors.push('App Number (appNo) is required');
  }

  if (!updates || typeof updates !== 'object') {
    errors.push('Updates payload object is required');
  }

  if (errors.length > 0) {
    return errorRes(res, 'Validation Failed', errors, 400);
  }

  next();
};

module.exports = {
  validateAddCandidate,
  validateUpdateCandidate
};
