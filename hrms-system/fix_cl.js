const pool = require('./server/config/db');
(async()=>{
  try {
    const q = " UPDATE candidates SET documents_checklist_json=NULL WHERE documents_checklist_json=[object Object]\;
 const [r]=await pool.query(q);
 console.log('Fixed rows:',r.affectedRows);
 } catch(e){ console.error(e.message); }
 process.exit(0);
})();
