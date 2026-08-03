const mysql = require('mysql2/promise');
const path = require('path');

// NOTE: Do NOT call dotenv.config() here.
// server/index.js handles all env loading BEFORE this module is required.
// Calling dotenv here would use process.cwd() which is unreliable on Hostinger.

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'hrms_db';

console.log(`[DB Config] Initializing MySQL pool: Host=${dbHost}, Port=${dbPort}, User=${dbUser}, DB=${dbName}`);

const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  connectTimeout: 10000,
});

// Verify connection at startup (non-blocking)
pool.getConnection()
  .then(conn => {
    console.log(`====================================================`);
    console.log(`  [MySQL DB] CONNECTED SUCCESSFULLY!`);
    console.log(`  Host: ${dbHost}:${dbPort} | User: ${dbUser} | Database: ${dbName}`);
    console.log(`====================================================`);
    return conn.query('SHOW TABLES').then(([tables]) => {
      console.log(`  [MySQL DB Audit] Total Tables Found in '${dbName}': ${tables.length}`);
      conn.release();
    });
  })
  .catch(err => {
    console.error(`====================================================`);
    console.error(`  [MySQL DB CONNECTION ERROR] Failed to connect!`);
    console.error(`  Host: ${dbHost}:${dbPort} | User: ${dbUser} | Database: ${dbName}`);
    console.error(`  Error Code: ${err.code || 'UNKNOWN'}`);
    console.error(`  Error Message: ${err.message}`);
    console.error(`====================================================`);
  });

module.exports = pool;
