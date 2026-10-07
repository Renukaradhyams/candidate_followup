/**
 * BSC Enterprise HRMS - Root Hostinger / Phusion Passenger Entry Point
 * Automatically delegates to hrms-system/index.js
 */
const path = require('path');
const fs = require('fs');

const hrmsSystemEntry = path.join(__dirname, 'hrms-system', 'index.js');

if (fs.existsSync(hrmsSystemEntry)) {
  module.exports = require(hrmsSystemEntry);
} else {
  console.error('[CRITICAL] hrms-system/index.js not found at:', hrmsSystemEntry);
  process.exit(1);
}
