const db = require('./hrms-system/server/config/db');

async function test() {
  try {
    const [cRows] = await db.query(`SELECT * FROM candidates LIMIT 1`);
    console.log(cRows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();
