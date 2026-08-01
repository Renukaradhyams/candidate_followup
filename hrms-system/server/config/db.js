const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const DEBUG_LOG_PATH = path.join(process.cwd(), 'init-debug.log');
function logDebug(msg) {
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
  console.log(msg);
}

// Load env from multiple paths to be safe in Passenger
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306');
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'hrms_db';

logDebug(`[DB Config] Initializing MySQL pool: Host=${dbHost}, Port=${dbPort}, User=${dbUser}, DB=${dbName}`);

const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  dateStrings: true,
  connectTimeout: 10000
});

// Immediate Runtime Connection Verification
(async () => {
  try {
    const connection = await pool.getConnection();
    logDebug(`====================================================`);
    logDebug(`  [MySQL DB] CONNECTED SUCCESSFULLY!`);
    logDebug(`  Host: ${dbHost}:${dbPort} | User: ${dbUser} | Database: ${dbName}`);
    logDebug(`====================================================`);
    
    // Quick Table Count Audit
    const [tables] = await connection.query(`SHOW TABLES`);
    logDebug(`  [MySQL DB Audit] Total Tables Found in '${dbName}': ${tables.length}`);
    connection.release();
  } catch (err) {
    logDebug(`====================================================`);
    logDebug(`  [MySQL DB CONNECTION ERROR] Failed to connect!`);
    logDebug(`  Host: ${dbHost}:${dbPort} | User: ${dbUser} | Database: ${dbName}`);
    logDebug(`  Error Code: ${err.code || 'UNKNOWN'}`);
    logDebug(`  Error Message: ${err.message}`);
    logDebug(`====================================================`);
  }
})();

module.exports = pool;
