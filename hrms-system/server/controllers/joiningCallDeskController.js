const pool = require('../config/db');
const { errorRes } = require('../utils/response');
const { normalizeDepartment, normalizeDesignation, normalizeSection } = require('../utils/normalization');

// ── Auto-create & migrate tables ─────────────────────────────────────────────
async function ensureTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS joining_call_desk (
        id INT AUTO_INCREMENT PRIMARY KEY,
        app_no VARCHAR(50) NOT NULL UNIQUE,
        call_status ENUM('Pending','Call done','Call not received','Wrong number','Rescheduled') DEFAULT 'Pending',
        doj_confirmation ENUM('Pending confirmation','Confirmed','Not confirmed') DEFAULT 'Pending confirmation',
        notes TEXT,
        follow_up_date DATE,
        last_call_date DATE,
        updated_by VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Convert table collations to utf8mb4_unicode_ci to prevent collation mismatch on MySQL 8.4+
    try {
      await pool.query(`ALTER TABLE joining_call_desk CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } catch (e) {}
    try {
      await pool.query(`ALTER TABLE joining_call_history CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } catch (e) {}
    // Migrate ENUM to add new statuses if table already existed with smaller ENUM
    try {
      await pool.query(`
        ALTER TABLE joining_call_desk 
        MODIFY COLUMN call_status 
        ENUM('Pending','Call done','Call not received','Wrong number','Rescheduled') 
        DEFAULT 'Pending'
      `);
    } catch (e) {
      // Ignore — table may already have correct enum or not exist yet
    }
  } catch (e) {
    console.warn('[JoiningCallDesk] Table init warning:', e.message);
  }
}
ensureTables();

// ── Helper ───────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const TERMINAL_STATUSES = ['Call done', 'Call not received', 'Wrong number', 'Rescheduled'];

class JoiningCallDeskController {

  // ─── GET /api/joining-call-desk/summary ────────────────────────────────────
  async getSummary(req, res) {
    try {
      await ensureTables();

      const [rows] = await pool.query(`
        SELECT
          c.designation,
          COUNT(DISTINCT c.app_no) AS total,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Call done'         THEN 1 ELSE 0 END) AS call_done,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Pending'            THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Call not received'  THEN 1 ELSE 0 END) AS not_received,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Wrong number'       THEN 1 ELSE 0 END) AS wrong_number,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Rescheduled'        THEN 1 ELSE 0 END) AS rescheduled,
          SUM(CASE WHEN COALESCE(d.doj_confirmation,'Pending confirmation') = 'Confirmed'     THEN 1 ELSE 0 END) AS doj_confirmed,
          SUM(CASE WHEN COALESCE(d.doj_confirmation,'Pending confirmation') = 'Not confirmed' THEN 1 ELSE 0 END) AS doj_not_confirmed
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN joining_call_desk d ON c.app_no COLLATE utf8mb4_unicode_ci = d.app_no COLLATE utf8mb4_unicode_ci
        WHERE (LOWER(TRIM(c.status)) IN ('joined','hired','successfully joined store','joined store') OR LOWER(TRIM(so.status)) IN ('joined','successfully joined store','joined store'))
          AND (c.offered_doj IS NOT NULL OR so.est_doj IS NOT NULL OR so.actual_doj IS NOT NULL)
        GROUP BY c.designation
      `);

      // Merge raw DB variations into normalized designation keys
      const sumMap = new Map();
      rows.forEach(r => {
        const normDesig = normalizeDesignation(r.designation);
        if (!sumMap.has(normDesig)) {
          sumMap.set(normDesig, {
            designation: normDesig,
            total: 0,
            callDone: 0,
            pending: 0,
            notReceived: 0,
            wrongNumber: 0,
            rescheduled: 0,
            dojConfirmed: 0,
            dojNotConfirmed: 0,
          });
        }
        const obj = sumMap.get(normDesig);
        obj.total += Number(r.total);
        obj.callDone += Number(r.call_done);
        obj.pending += Number(r.pending);
        obj.notReceived += Number(r.not_received);
        obj.wrongNumber += Number(r.wrong_number);
        obj.rescheduled += Number(r.rescheduled);
        obj.dojConfirmed += Number(r.doj_confirmed);
        obj.dojNotConfirmed += Number(r.doj_not_confirmed);
      });

      const summaries = Array.from(sumMap.values()).sort((a, b) => a.designation.localeCompare(b.designation));

      return res.json({ success: true, summaries, total: summaries.reduce((a, s) => a + s.total, 0) });
    } catch (err) {
      console.error('[JoiningCallDesk.getSummary]', err);
      return errorRes(res, 'Failed to load summaries: ' + err.message, [err.message], 500);
    }
  }

  // ─── GET /api/joining-call-desk/by-designation/:designation ───────────────
  async getByDesignation(req, res) {
    try {
      await ensureTables();
      const { designation } = req.params;
      const desig = decodeURIComponent(designation || '');
      if (!desig) return errorRes(res, 'designation is required', [], 400);

      const targetNorm = normalizeDesignation(desig);

      const [empRows] = await pool.query(`
        SELECT c.*,
               so.est_doj  AS offer_est_doj,
               so.actual_doj AS offer_actual_doj,
               so.status   AS offer_status,
               d.call_status, d.doj_confirmation, d.notes,
               d.follow_up_date, d.last_call_date, d.updated_by, d.updated_at AS desk_updated_at
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN joining_call_desk d ON c.app_no COLLATE utf8mb4_unicode_ci = d.app_no COLLATE utf8mb4_unicode_ci
        WHERE (LOWER(TRIM(c.status)) IN ('joined','hired','successfully joined store','joined store') OR LOWER(TRIM(so.status)) IN ('joined','successfully joined store','joined store'))
          AND (c.offered_doj IS NOT NULL OR so.est_doj IS NOT NULL OR so.actual_doj IS NOT NULL)
        GROUP BY c.app_no
        ORDER BY c.name ASC
      `);

      const employees = empRows
        .filter(r => normalizeDesignation(r.designation) === targetNorm)
        .map(r => ({
          appNo:           r.app_no,
          name:            r.name || '',
          phone:           r.phone || '',
          email:           r.email || '',
          gender:          r.gender || '',
          department:      normalizeDepartment(r.department),
          section:         normalizeSection(r.section),
          designation:     normalizeDesignation(r.designation),
          offeredDoj:      fmtDate(r.offered_doj || r.offer_est_doj || r.offer_actual_doj),
          photoUrl:        r.photo_url || '',
          callStatus:      r.call_status || 'Pending',
          dojConfirmation: r.doj_confirmation || 'Pending confirmation',
          notes:           r.notes || '',
          followUpDate:    fmtDate(r.follow_up_date),
          lastCallDate:    fmtDate(r.last_call_date),
          updatedBy:       r.updated_by || '',
          updatedAt:       r.desk_updated_at || null,
        }));

      return res.json({ success: true, employees });
    } catch (err) {
      console.error('[JoiningCallDesk.getByDesignation]', err);
      return errorRes(res, 'Failed to load employees: ' + err.message, [err.message], 500);
    }
  }

  // ─── GET /api/joining-call-desk/analytics ──────────────────────────────────
  // Returns analytics for the dashboard header
  async getAnalytics(req, res) {
    try {
      await ensureTables();
      const today = new Date().toISOString().slice(0, 10);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      const [[overall]] = await pool.query(`
        SELECT
          COUNT(DISTINCT c.app_no) AS total,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Call done'         THEN 1 ELSE 0 END) AS call_done,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Pending'            THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Call not received'  THEN 1 ELSE 0 END) AS not_received,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Wrong number'       THEN 1 ELSE 0 END) AS wrong_number,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Rescheduled'        THEN 1 ELSE 0 END) AS rescheduled,
          SUM(CASE WHEN COALESCE(d.doj_confirmation,'Pending confirmation') = 'Confirmed'     THEN 1 ELSE 0 END) AS doj_confirmed,
          SUM(CASE WHEN COALESCE(d.doj_confirmation,'Pending confirmation') = 'Not confirmed' THEN 1 ELSE 0 END) AS doj_not_confirmed,
          SUM(CASE WHEN COALESCE(c.offered_doj, so.est_doj) BETWEEN ? AND ?     THEN 1 ELSE 0 END) AS joining_this_week,
          SUM(CASE WHEN COALESCE(d.follow_up_date, NULL) < ? AND COALESCE(d.call_status,'Pending') != 'Call done' THEN 1 ELSE 0 END) AS overdue_followups
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN joining_call_desk d ON c.app_no COLLATE utf8mb4_unicode_ci = d.app_no COLLATE utf8mb4_unicode_ci
        WHERE (LOWER(TRIM(c.status)) IN ('joined','hired','successfully joined store','joined store') OR LOWER(TRIM(so.status)) IN ('joined','successfully joined store','joined store'))
          AND (c.offered_doj IS NOT NULL OR so.est_doj IS NOT NULL OR so.actual_doj IS NOT NULL)
      `, [today, weekEndStr, today]);

      // Today's activity from history
      const [todayHistory] = await pool.query(`
        SELECT action_type, COUNT(*) AS cnt
        FROM joining_call_history
        WHERE DATE(created_at) = ?
        GROUP BY action_type
      `, [today]);

      const todayMap = {};
      for (const h of todayHistory) { todayMap[h.action_type] = Number(h.cnt); }

      return res.json({
        success: true,
        total:          Number(overall.total),
        callDone:       Number(overall.call_done),
        pending:        Number(overall.pending),
        notReceived:    Number(overall.not_received),
        wrongNumber:    Number(overall.wrong_number),
        rescheduled:    Number(overall.rescheduled),
        dojConfirmed:   Number(overall.doj_confirmed),
        dojNotConfirmed:Number(overall.doj_not_confirmed),
        joiningThisWeek:Number(overall.joining_this_week),
        overdueFollowUps:Number(overall.overdue_followups),
        today: {
          callsDone:         (todayMap['call_status'] || 0),
          dojConfirmed:      (todayMap['doj_confirmation'] || 0),
          dojChanged:        (todayMap['doj_changed'] || 0),
          notesAdded:        (todayMap['note_added'] || 0),
          followupsScheduled: 0, // will be derived from follow_up_date set today
        }
      });
    } catch (err) {
      console.error('[JoiningCallDesk.getAnalytics]', err);
      return errorRes(res, 'Failed to load analytics: ' + err.message, [err.message], 500);
    }
  }

  // ─── GET /api/joining-call-desk (backward compat — used by V1 references) ─
  async getAll(req, res) {
    try {
      await ensureTables();
      const [empRows] = await pool.query(`
        SELECT c.*,
               so.est_doj AS offer_est_doj,
               so.actual_doj AS offer_actual_doj,
               so.status AS offer_status
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        WHERE LOWER(TRIM(c.status)) IN ('joined','hired','successfully joined store','joined store')
           OR LOWER(TRIM(so.status)) IN ('joined','successfully joined store','joined store')
        GROUP BY c.app_no
        ORDER BY LOWER(c.name) ASC
      `);
      const [deskRows] = await pool.query(`SELECT * FROM joining_call_desk`);
      const deskMap = {};
      for (const row of deskRows) { deskMap[row.app_no] = row; }

      const employees = empRows.map(r => {
        const d = deskMap[r.app_no] || {};
        const offeredDoj = fmtDate(r.offered_doj || r.offer_est_doj || r.offer_actual_doj);
        return {
          appNo: r.app_no, name: r.name || '', phone: r.phone || '', email: r.email || '',
          gender: r.gender || '', department: r.department || '', section: r.section || '',
          designation: r.designation || '', offeredDoj, photoUrl: r.photo_url || '',
          callStatus: d.call_status || 'Pending',
          dojConfirmation: d.doj_confirmation || 'Pending confirmation',
          notes: d.notes || '', followUpDate: fmtDate(d.follow_up_date),
          lastCallDate: fmtDate(d.last_call_date), updatedBy: d.updated_by || '', updatedAt: d.updated_at || null,
        };
      });
      const withDoj = employees.filter(e => e.offeredDoj);
      return res.json({ success: true, employees: withDoj, total: withDoj.length });
    } catch (err) {
      return errorRes(res, 'Failed to load data: ' + err.message, [err.message], 500);
    }
  }

  // ─── POST /api/joining-call-desk/update-status ────────────────────────────
  async updateStatus(req, res) {
    try {
      await ensureTables();
      const { appNo, callStatus, dojConfirmation, notes, followUpDate, doneBy } = req.body;
      const user = doneBy || (req.user ? req.user.username : 'HR');
      if (!appNo) return errorRes(res, 'appNo is required', [], 400);

      const [existing] = await pool.query(`SELECT * FROM joining_call_desk WHERE app_no = ?`, [appNo]);
      const old = existing[0] || {};

      const isTerminal = TERMINAL_STATUSES.includes(callStatus);
      const lastCallDate = isTerminal
        ? new Date().toISOString().slice(0, 10)
        : (old.last_call_date ? fmtDate(old.last_call_date) : null);

      await pool.query(`
        INSERT INTO joining_call_desk
          (app_no, call_status, doj_confirmation, notes, follow_up_date, last_call_date, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          call_status      = VALUES(call_status),
          doj_confirmation = VALUES(doj_confirmation),
          notes            = VALUES(notes),
          follow_up_date   = VALUES(follow_up_date),
          last_call_date   = VALUES(last_call_date),
          updated_by       = VALUES(updated_by),
          updated_at       = CURRENT_TIMESTAMP
      `, [
        appNo,
        callStatus      || old.call_status      || 'Pending',
        dojConfirmation || old.doj_confirmation || 'Pending confirmation',
        notes !== undefined ? notes : (old.notes || ''),
        followUpDate || null,
        lastCallDate || null,
        user
      ]);

      // Audit trail
      const inserts = [];
      if (callStatus && callStatus !== old.call_status) {
        inserts.push([appNo, 'call_status', old.call_status || 'Pending', callStatus, notes || '', user]);
      }
      if (dojConfirmation && dojConfirmation !== old.doj_confirmation) {
        inserts.push([appNo, 'doj_confirmation', old.doj_confirmation || 'Pending confirmation', dojConfirmation, notes || '', user]);
      }
      if (notes && notes.trim() && notes !== old.notes) {
        inserts.push([appNo, 'note_added', '', notes, notes, user]);
      }
      if (followUpDate && followUpDate !== fmtDate(old.follow_up_date)) {
        inserts.push([appNo, 'followup_set', fmtDate(old.follow_up_date) || '', followUpDate, `Follow-up set to ${followUpDate}`, user]);
      }
      for (const entry of inserts) {
        await pool.query(
          `INSERT INTO joining_call_history (app_no, action_type, old_value, new_value, notes, done_by) VALUES (?, ?, ?, ?, ?, ?)`,
          entry
        );
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('[JoiningCallDesk.updateStatus]', err);
      return errorRes(res, 'Failed to update: ' + err.message, [err.message], 500);
    }
  }

  // ─── GET /api/joining-call-desk/history/:appNo ────────────────────────────
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

  // ─── POST /api/joining-call-desk/update-doj ───────────────────────────────
  // V2 FIX: Updates BOTH candidates.offered_doj AND selection_offers.est_doj in transaction
  async updateDoj(req, res) {
    const conn = await pool.getConnection();
    try {
      await ensureTables();
      const { appNo, newDoj, doneBy } = req.body;
      const user = doneBy || (req.user ? req.user.username : 'HR');
      if (!appNo || !newDoj) return errorRes(res, 'appNo and newDoj are required', [], 400);

      await conn.beginTransaction();

      // Get old DOJ for audit
      const [[candRow]] = await conn.query(`SELECT offered_doj FROM candidates WHERE app_no = ?`, [appNo]);
      const oldDoj = candRow ? fmtDate(candRow.offered_doj) : '';

      // Update candidates table (primary source of truth)
      await conn.query(`UPDATE candidates SET offered_doj = ?, updated_at = NOW() WHERE app_no = ?`, [newDoj, appNo]);

      // Update selection_offers.est_doj (keeps Offer Desk in sync)
      await conn.query(
        `UPDATE selection_offers SET est_doj = ?, updated_at = NOW() WHERE app_no = ?`,
        [newDoj, appNo]
      );

      // Audit trail
      await conn.query(
        `INSERT INTO joining_call_history (app_no, action_type, old_value, new_value, notes, done_by)
         VALUES (?, 'doj_changed', ?, ?, ?, ?)`,
        [appNo, oldDoj, newDoj, `DOJ changed from ${oldDoj || '—'} to ${newDoj}`, user]
      );

      // Touch desk record (for updated_at tracking)
      await conn.query(
        `INSERT INTO joining_call_desk (app_no, updated_by) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
        [appNo, user]
      );

      await conn.commit();
      return res.json({ success: true, oldDoj, newDoj });
    } catch (err) {
      await conn.rollback();
      console.error('[JoiningCallDesk.updateDoj]', err);
      return errorRes(res, 'Failed to update DOJ: ' + err.message, [err.message], 500);
    } finally {
      conn.release();
    }
  }

  // ─── GET /api/not-joined-desk/summary ──────────────────────────────────────
  async getNotJoinedSummary(req, res) {
    try {
      await ensureTables();

      const [rows] = await pool.query(`
        SELECT
          c.designation,
          COUNT(DISTINCT c.app_no) AS total,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Call done'         THEN 1 ELSE 0 END) AS call_done,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Pending'            THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Call not received'  THEN 1 ELSE 0 END) AS not_received,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Wrong number'       THEN 1 ELSE 0 END) AS wrong_number,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Rescheduled'        THEN 1 ELSE 0 END) AS rescheduled,
          SUM(CASE WHEN COALESCE(d.doj_confirmation,'Pending confirmation') = 'Confirmed'     THEN 1 ELSE 0 END) AS doj_confirmed,
          SUM(CASE WHEN COALESCE(d.doj_confirmation,'Pending confirmation') = 'Not confirmed' THEN 1 ELSE 0 END) AS doj_not_confirmed
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN employees emp ON c.app_no COLLATE utf8mb4_unicode_ci = emp.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN joining_call_desk d ON c.app_no COLLATE utf8mb4_unicode_ci = d.app_no COLLATE utf8mb4_unicode_ci
        WHERE (
          LOWER(TRIM(COALESCE(c.status, ''))) IN ('joined', 'hired', 'offer accepted', 'accepted', 'selected')
          OR LOWER(TRIM(COALESCE(so.status, ''))) IN ('joined', 'hired', 'offer accepted', 'accepted', 'selected')
        )
        AND (
          LOWER(TRIM(COALESCE(c.status, ''))) NOT IN ('successfully joined store', 'joined store')
          AND LOWER(TRIM(COALESCE(c.status, ''))) NOT LIKE '%joined store%'
          AND LOWER(TRIM(COALESCE(so.status, ''))) NOT IN ('successfully joined store', 'joined store')
          AND LOWER(TRIM(COALESCE(so.status, ''))) NOT LIKE '%joined store%'
          AND (emp.id IS NULL OR (
            LOWER(TRIM(COALESCE(emp.status, ''))) NOT IN ('successfully joined store', 'joined store')
            AND LOWER(TRIM(COALESCE(emp.status, ''))) NOT LIKE '%joined store%'
          ))
        )
        GROUP BY c.designation
      `);

      const sumMap = new Map();
      rows.forEach(r => {
        const normDesig = normalizeDesignation(r.designation);
        if (!sumMap.has(normDesig)) {
          sumMap.set(normDesig, {
            designation: normDesig,
            total: 0,
            callDone: 0,
            pending: 0,
            notReceived: 0,
            wrongNumber: 0,
            rescheduled: 0,
            dojConfirmed: 0,
            dojNotConfirmed: 0,
          });
        }
        const obj = sumMap.get(normDesig);
        obj.total += Number(r.total);
        obj.callDone += Number(r.call_done);
        obj.pending += Number(r.pending);
        obj.notReceived += Number(r.not_received);
        obj.wrongNumber += Number(r.wrong_number);
        obj.rescheduled += Number(r.rescheduled);
        obj.dojConfirmed += Number(r.doj_confirmed);
        obj.dojNotConfirmed += Number(r.doj_not_confirmed);
      });

      const summaries = Array.from(sumMap.values()).sort((a, b) => a.designation.localeCompare(b.designation));

      return res.json({ success: true, summaries, total: summaries.reduce((a, s) => a + s.total, 0) });
    } catch (err) {
      console.error('[JoiningCallDesk.getNotJoinedSummary]', err);
      return errorRes(res, 'Failed to load not-joined summaries: ' + err.message, [err.message], 500);
    }
  }

  // ─── GET /api/not-joined-desk/by-designation/:designation ─────────────────
  async getNotJoinedByDesignation(req, res) {
    try {
      await ensureTables();
      const { designation } = req.params;
      const desig = decodeURIComponent(designation || '');
      if (!desig) return errorRes(res, 'designation is required', [], 400);

      const targetNorm = normalizeDesignation(desig);

      const [empRows] = await pool.query(`
        SELECT c.*,
               COALESCE(sa.section, '') AS sa_section,
               so.est_doj  AS offer_est_doj,
               so.actual_doj AS offer_actual_doj,
               so.status   AS offer_status,
               d.call_status, d.doj_confirmation, d.notes,
               d.follow_up_date, d.last_call_date, d.updated_by, d.updated_at AS desk_updated_at
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN employees emp ON c.app_no COLLATE utf8mb4_unicode_ci = emp.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN section_allocations sa ON c.app_no COLLATE utf8mb4_unicode_ci = sa.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN joining_call_desk d ON c.app_no COLLATE utf8mb4_unicode_ci = d.app_no COLLATE utf8mb4_unicode_ci
        WHERE (
          LOWER(TRIM(COALESCE(c.status, ''))) IN ('joined', 'hired', 'offer accepted', 'accepted', 'selected')
          OR LOWER(TRIM(COALESCE(so.status, ''))) IN ('joined', 'hired', 'offer accepted', 'accepted', 'selected')
        )
        AND (
          LOWER(TRIM(COALESCE(c.status, ''))) NOT IN ('successfully joined store', 'joined store')
          AND LOWER(TRIM(COALESCE(c.status, ''))) NOT LIKE '%joined store%'
          AND LOWER(TRIM(COALESCE(so.status, ''))) NOT IN ('successfully joined store', 'joined store')
          AND LOWER(TRIM(COALESCE(so.status, ''))) NOT LIKE '%joined store%'
          AND (emp.id IS NULL OR (
            LOWER(TRIM(COALESCE(emp.status, ''))) NOT IN ('successfully joined store', 'joined store')
            AND LOWER(TRIM(COALESCE(emp.status, ''))) NOT LIKE '%joined store%'
          ))
        )
        GROUP BY c.app_no
        ORDER BY c.name ASC
      `);

      const employees = empRows
        .filter(r => normalizeDesignation(r.designation) === targetNorm)
        .map(r => ({
          appNo:           r.app_no,
          name:            r.name || '',
          phone:           r.phone || '',
          email:           r.email || '',
          gender:          r.gender || '',
          department:      normalizeDepartment(r.department),
          section:         normalizeSection(r.sa_section || r.section),
          designation:     normalizeDesignation(r.designation),
          candidateStatus: r.status || r.offer_status || 'Selected',
          offeredDoj:      fmtDate(r.offered_doj || r.offer_est_doj || r.offer_actual_doj),
          photoUrl:        r.photo_url || '',
          callStatus:      r.call_status || 'Pending',
          dojConfirmation: r.doj_confirmation || 'Pending confirmation',
          notes:           r.notes || '',
          followUpDate:    fmtDate(r.follow_up_date),
          lastCallDate:    fmtDate(r.last_call_date),
          updatedBy:       r.updated_by || '',
          updatedAt:       r.desk_updated_at || null,
        }));

      return res.json({ success: true, employees });
    } catch (err) {
      console.error('[JoiningCallDesk.getNotJoinedByDesignation]', err);
      return errorRes(res, 'Failed to load not-joined employees: ' + err.message, [err.message], 500);
    }
  }

  // ─── GET /api/not-joined-desk/all ──────────────────────────────────────────
  async getNotJoinedAll(req, res) {
    try {
      await ensureTables();
      const [empRows] = await pool.query(`
        SELECT c.*,
               COALESCE(sa.section, '') AS sa_section,
               so.est_doj AS offer_est_doj,
               so.actual_doj AS offer_actual_doj,
               so.status AS offer_status
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN employees emp ON c.app_no COLLATE utf8mb4_unicode_ci = emp.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN section_allocations sa ON c.app_no COLLATE utf8mb4_unicode_ci = sa.app_no COLLATE utf8mb4_unicode_ci
        WHERE (
          LOWER(TRIM(COALESCE(c.status, ''))) IN ('joined', 'hired', 'offer accepted', 'accepted', 'selected')
          OR LOWER(TRIM(COALESCE(so.status, ''))) IN ('joined', 'hired', 'offer accepted', 'accepted', 'selected')
        )
        AND (
          LOWER(TRIM(COALESCE(c.status, ''))) NOT IN ('successfully joined store', 'joined store')
          AND LOWER(TRIM(COALESCE(c.status, ''))) NOT LIKE '%joined store%'
          AND LOWER(TRIM(COALESCE(so.status, ''))) NOT IN ('successfully joined store', 'joined store')
          AND LOWER(TRIM(COALESCE(so.status, ''))) NOT LIKE '%joined store%'
          AND (emp.id IS NULL OR (
            LOWER(TRIM(COALESCE(emp.status, ''))) NOT IN ('successfully joined store', 'joined store')
            AND LOWER(TRIM(COALESCE(emp.status, ''))) NOT LIKE '%joined store%'
          ))
        )
        GROUP BY c.app_no
        ORDER BY LOWER(c.name) ASC
      `);
      const [deskRows] = await pool.query(`SELECT * FROM joining_call_desk`);
      const deskMap = {};
      for (const row of deskRows) { deskMap[row.app_no] = row; }

      const employees = empRows.map(r => {
        const d = deskMap[r.app_no] || {};
        const offeredDoj = fmtDate(r.offered_doj || r.offer_est_doj || r.offer_actual_doj);
        return {
          appNo:           r.app_no,
          name:            r.name || '',
          phone:           r.phone || '',
          email:           r.email || '',
          gender:          r.gender || '',
          department:      normalizeDepartment(r.department),
          section:         normalizeSection(r.sa_section || r.section),
          designation:     normalizeDesignation(r.designation),
          candidateStatus: r.status || r.offer_status || 'Selected',
          offeredDoj,
          photoUrl:        r.photo_url || '',
          callStatus:      d.call_status || 'Pending',
          dojConfirmation: d.doj_confirmation || 'Pending confirmation',
          notes:           d.notes || '',
          followUpDate:    fmtDate(d.follow_up_date),
          lastCallDate:    fmtDate(d.last_call_date),
          updatedBy:       d.updated_by || '',
          updatedAt:       d.updated_at || null,
        };
      });
      return res.json({ success: true, employees, total: employees.length });
    } catch (err) {
      return errorRes(res, 'Failed to load not-joined data: ' + err.message, [err.message], 500);
    }
  }

  // ─── GET /api/not-joined-desk/analytics ───────────────────────────────────
  async getNotJoinedAnalytics(req, res) {
    try {
      await ensureTables();
      const today = new Date().toISOString().slice(0, 10);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      const [[overall]] = await pool.query(`
        SELECT
          COUNT(DISTINCT c.app_no) AS total,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Call done'         THEN 1 ELSE 0 END) AS call_done,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Pending'            THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Call not received'  THEN 1 ELSE 0 END) AS not_received,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Wrong number'       THEN 1 ELSE 0 END) AS wrong_number,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Rescheduled'        THEN 1 ELSE 0 END) AS rescheduled,
          SUM(CASE WHEN COALESCE(d.doj_confirmation,'Pending confirmation') = 'Confirmed'     THEN 1 ELSE 0 END) AS doj_confirmed,
          SUM(CASE WHEN COALESCE(d.doj_confirmation,'Pending confirmation') = 'Not confirmed' THEN 1 ELSE 0 END) AS doj_not_confirmed,
          SUM(CASE WHEN COALESCE(c.offered_doj, so.est_doj) < ? THEN 1 ELSE 0 END) AS overdue_doj,
          SUM(CASE WHEN COALESCE(c.offered_doj, so.est_doj) = ? THEN 1 ELSE 0 END) AS joining_today,
          SUM(CASE WHEN COALESCE(c.offered_doj, so.est_doj) > ? THEN 1 ELSE 0 END) AS upcoming_doj,
          SUM(CASE WHEN COALESCE(c.offered_doj, so.est_doj) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS joining_this_week,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') = 'Pending' OR (d.follow_up_date IS NOT NULL AND d.follow_up_date <= ?) THEN 1 ELSE 0 END) AS follow_up_required,
          SUM(CASE WHEN COALESCE(d.call_status,'Pending') IN ('Call not received', 'Wrong number') THEN 1 ELSE 0 END) AS no_answer
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN employees emp ON c.app_no COLLATE utf8mb4_unicode_ci = emp.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN joining_call_desk d ON c.app_no COLLATE utf8mb4_unicode_ci = d.app_no COLLATE utf8mb4_unicode_ci
        WHERE (
          LOWER(TRIM(COALESCE(c.status, ''))) IN ('joined', 'hired', 'offer accepted', 'accepted', 'selected')
          OR LOWER(TRIM(COALESCE(so.status, ''))) IN ('joined', 'hired', 'offer accepted', 'accepted', 'selected')
        )
        AND (
          LOWER(TRIM(COALESCE(c.status, ''))) NOT IN ('successfully joined store', 'joined store')
          AND LOWER(TRIM(COALESCE(c.status, ''))) NOT LIKE '%joined store%'
          AND LOWER(TRIM(COALESCE(so.status, ''))) NOT IN ('successfully joined store', 'joined store')
          AND LOWER(TRIM(COALESCE(so.status, ''))) NOT LIKE '%joined store%'
          AND (emp.id IS NULL OR (
            LOWER(TRIM(COALESCE(emp.status, ''))) NOT IN ('successfully joined store', 'joined store')
            AND LOWER(TRIM(COALESCE(emp.status, ''))) NOT LIKE '%joined store%'
          ))
        )
      `, [today, today, today, today, weekEndStr, today]);

      const [todayHistory] = await pool.query(`
        SELECT action_type, COUNT(*) AS cnt
        FROM joining_call_history
        WHERE DATE(created_at) = ?
        GROUP BY action_type
      `, [today]);

      const todayMap = {};
      for (const h of todayHistory) { todayMap[h.action_type] = Number(h.cnt); }

      return res.json({
        success: true,
        total:            Number(overall.total || 0),
        callDone:         Number(overall.call_done || 0),
        pending:          Number(overall.pending || 0),
        notReceived:      Number(overall.not_received || 0),
        wrongNumber:      Number(overall.wrong_number || 0),
        rescheduled:      Number(overall.rescheduled || 0),
        dojConfirmed:     Number(overall.doj_confirmed || 0),
        dojNotConfirmed:  Number(overall.doj_not_confirmed || 0),
        overdueDoj:       Number(overall.overdue_doj || 0),
        joiningToday:     Number(overall.joining_today || 0),
        upcomingDoj:      Number(overall.upcoming_doj || 0),
        joiningThisWeek:  Number(overall.joining_this_week || 0),
        followUpRequired: Number(overall.follow_up_required || 0),
        noAnswer:         Number(overall.no_answer || 0),
        today: {
          callsDone:      (todayMap['call_status'] || 0),
          dojConfirmed:   (todayMap['doj_confirmation'] || 0),
          dojChanged:     (todayMap['doj_changed'] || 0),
          notesAdded:     (todayMap['note_added'] || 0),
        }
      });
    } catch (err) {
      console.error('[JoiningCallDesk.getNotJoinedAnalytics]', err);
      return errorRes(res, 'Failed to load not-joined analytics: ' + err.message, [err.message], 500);
    }
  }
}

module.exports = new JoiningCallDeskController();
