/**
 * LOCAL DEVELOPMENT ENTRY POINT
 * Run: node server/index.js
 *
 * On Hostinger (Passenger), use hrms-system/index.js instead.
 * Passenger does NOT use this file.
 */

const app = require('../index.js');

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Dev] Server running at http://127.0.0.1:${PORT}`);
});

server.on('error', (err) => {
  console.error('[Dev Server Error]', err.code, err.message);
  process.exit(1);
});
