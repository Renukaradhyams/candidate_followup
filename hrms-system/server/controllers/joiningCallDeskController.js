const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');

// ── Auto-create tables on startup ────────────────────────────────────────────
async function ensureTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS joining_call_desk (
        id INT AUTO_INCREMENT PRIMARY KEY,
        app_no VARCHAR(50) NOT NULL UNIQUE,
        call_status ENUM('Pending','Call done','Call not received') DEFAULT 'Pending',
        doj_confirmation ENUM('Pending confirmation','Confirmed','Not confirmed') DEFAULT 'Pending confirmation',
        notes TEXT,
        follow_up_date DATE,
        last_call_date DATE,
        updated_by VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS joining_call_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        app_no VARCHAR(50) NOT NULL,
        action_type VARCHAR(80),
        old_value TEXT,
        new_value TEXT,
        notes TEXT,
        done_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_jch_app_no (app_no)
      )
    `);
  } catch (e) {
    console.warn('[JoiningCallDesk] Table init warning:', e.message);
  }
}
ensureTables();

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

class JoiningCallDeskController {

  // GET /api/joining-call-desk
  // Returns all employees with a DOJ, merged with call desk state
  async getAll(req, res) {
    try {
      await ensureTables();

      // Fetch employees (Joined/Hired status) — same query as getEmployees
      const [empRows] = await pool.query(`
        SELECT c.*,
               so.est_doj as offer_est_doj,
               so.actual_doj as offer_actual_doj,
               so.status as offer_status
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no = so.app_no
        WHERE LOWER(TRIM(c.status)) IN ('joined', 'hired')
           OR LOWER(TRIM(so.status)) = 'joined'
        GROUP BY c.app_no
        ORDER BY LOWER(c.name) ASC
      `);

      // Fetch all desk records in one query
      const [deskRows] = await pool.query(`SELECT * FROM joining_call_desk`);
      const deskMap = {};
      for (const row of deskRows) {
        deskMap[row.app_no] = row;
      }

      const employees = empRows.map(r => {
        const desk = deskMap[r.app_no] || {};
        const offeredDoj = formatDate(r.offered_doj || r.offer_est_doj || r.offer_actual_doj);
        return {
          appNo: r.app_no,
          name: r.name || '',
          phone: r.phone || '',
          email: r.email || '',
          gender: r.gender || '',
          department: r.department || '',
          section: r.section || '',
          designation: r.designation || '',
          offeredDoj,
          photoUrl: r.photo_url || '',
          // Call desk state
          callStatus: desk.call_status || 'Pending',
          dojConfirmation: desk.doj_confirmation || 'Pending confirmation',
          notes: desk.notes || '',
          followUpDate: formatDate(desk.follow_up_date),
          lastCallDate: formatDate(desk.last_call_date),
          updatedBy: desk.updated_by || '',
          updatedAt: desk.updated_at || null,
        };
      });

      // Only include employees who have a DOJ set
      const withDoj = employees.filter(e => e.offeredDoj);

      return res.json({ success: true, employees: withDoj, total: withDoj.length });
    } catch (err) {
      console.error('[JoiningCallDesk.getAll]', err);
      return errorRes(res, 'Failed to load joining call desk data: ' + err.message, [err.message], 500);
    }
  }

  // POST /api/joining-call-desk/update-status
  // Body: { appNo, callStatus, dojConfirmation, notes, followUpDate, doneBy }
  async updateStatus(req, res) {
    try {
      await ensureTables();
      const { appNo, callStatus, dojConfirmation, notes, followUpDate, doneBy } = req.body;
      const user = doneBy || (req.user ? req.user.username : 'HR');

      if (!appNo) return errorRes(res, 'appNo is required', [], 400);

      // Fetch existing record for audit trail
      const [existing] = await pool.query(`SELECT * FROM joining_call_desk WHERE app_no = ?`, [appNo]);
      const old = existing[0] || {};

      const lastCallDate = (callStatus === 'Call done' || callStatus === 'Call not received')
        ? new Date().toISOString().slice(0, 10)
        : (old.last_call_date ? formatDate(old.last_call_date) : null);

      // Upsert
      await pool.query(`
        INSERT INTO joining_call_desk
          (app_no, call_status, doj_confirmation, notes, follow_up_date, last_call_date, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          call_status = VALUES(call_status),
          doj_confirmation = VALUES(doj_confirmation),
          notes = VALUES(notes),
          follow_up_date = VALUES(follow_up_date),
          last_call_date = VALUES(last_call_date),
          updated_by = VALUES(updated_by),
          updated_at = CURRENT_TIMESTAMP
      `, [
        appNo,
        callStatus || old.call_status || 'Pending',
        dojConfirmation || old.doj_confirmation || 'Pending confirmation',
        notes !== undefined ? notes : (old.notes || ''),
        followUpDate || null,
        lastCallDate || null,
        user
      ]);

      // History entries
      const historyEntries = [];
      if (callStatus && callStatus !== old.call_status) {
        historyEntries.push([appNo, 'call_status', old.call_status || 'Pending', callStatus, notes || '', user]);
      }
      if (dojConfirmation && dojConfirmation !== old.doj_confirmation) {
        historyEntries.push([appNo, 'doj_confirmation', old.doj_confirmation || 'Pending confirmation', dojConfirmation, notes || '', user]);
      }
      if (notes && notes !== old.notes) {
        historyEntries.push([appNo, 'note_added', '', notes, notes, user]);
      }

      for (const entry of historyEntries) {
        await pool.query(
          `INSERT INTO joining_call_history (app_no, action_type, old_value, new_value, notes, done_by) VALUES (?, ?, ?, ?, ?, ?)`,
          entry
        );
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('[JoiningCallDesk.updateStatus]', err);
      return errorRes(res, 'Failed to update call status: ' + err.message, [err.message], 500);
    }
  }

  // GET /api/joining-call-desk/history/:appNo
  async getHistory(req, res) {
    try {
      await ensureTables();
      const { appNo } = req.params;
      if (!appNo) return errorRes(res, 'appNo is required', [], 400);

      const [rows] = await pool.query(
        `SELECT * FROM joining_call_history WHERE app_no = ? ORDER BY created_at DESC LIMIT 100`,
        [appNo]
      );

      return res.json({ success: true, history: rows });
    } catch (err) {
      return errorRes(res, 'Failed to load history: ' + err.message, [err.message], 500);
    }
  }

  // POST /api/joining-call-desk/update-doj
  // Body: { appNo, newDoj, doneBy }
  // Updates offered_doj in candidates table (same as Employee Directory does) + records audit trail
  async updateDoj(req, res) {
    try {
      await ensureTables();
      const { appNo, newDoj, doneBy } = req.body;
      const user = doneBy || (req.user ? req.user.username : 'HR');

      if (!appNo || !newDoj) return errorRes(res, 'appNo and newDoj are required', [], 400);

      // Get current DOJ for audit
      const [rows] = await pool.query(`SELECT offered_doj FROM candidates WHERE app_no = ?`, [appNo]);
      const oldDoj = rows[0] ? formatDate(rows[0].offered_doj) : '';

      // Update offered_doj in candidates table
      await pool.query(`UPDATE candidates SET offered_doj = ?, updated_at = NOW() WHERE app_no = ?`, [newDoj, appNo]);

      // Audit trail in call history
      await pool.query(
        `INSERT INTO joining_call_history (app_no, action_type, old_value, new_value, notes, done_by)
         VALUES (?, 'doj_changed', ?, ?, ?, ?)`,
        [appNo, oldDoj, newDoj, `DOJ changed from ${oldDoj} to ${newDoj}`, user]
      );

      // Update updated_at in desk record if exists
      await pool.query(
        `INSERT INTO joining_call_desk (app_no, updated_by) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
        [appNo, user]
      );

      return res.json({ success: true, oldDoj, newDoj });
    } catch (err) {
      console.error('[JoiningCallDesk.updateDoj]', err);
      return errorRes(res, 'Failed to update DOJ: ' + err.message, [err.message], 500);
    }
  }
}

module.exports = new JoiningCallDeskController();
