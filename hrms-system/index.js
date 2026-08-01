/**
 * BSC Enterprise HRMS - Root Entry Point
 * 
 * Hostinger/Passenger calls THIS file (Entry file = index.js).
 * We set __dirname-based paths correctly and delegate to server/index.js.
 */

const path = require('path');

// Ensure process.cwd() resolves correctly for all relative requires inside server/
process.chdir(path.join(__dirname, 'server'));

// Load the actual server
require('./server/index.js');
