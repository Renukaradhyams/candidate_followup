const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: 'Password123!', database: 'hrms_db' });
  const [rows] = await pool.query('SELECT app_no, created_at, status FROM candidates ORDER BY app_no ASC LIMIT 30');
  console.log(rows);
  process.exit(0);
}
run();
