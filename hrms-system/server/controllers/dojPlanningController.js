const pool = require('../config/db');
const { errorRes } = require('../utils/response');
const { normalizeDepartment, normalizeDesignation, normalizeSection } = require('../utils/normalization');

const fmtDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

class DOJPlanningController {
  async getOverview(req, res) {
    try {
      // Query all candidates with potential offer/joining information
      const [rows] = await pool.query(`
        SELECT c.id,
               c.app_no,
               c.name,
               c.phone,
               c.email,
               c.gender,
               c.department,
               c.section,
               c.designation,
               c.offered_doj,
               c.photo_url,
               c.status AS candidate_status,
               so.est_doj AS offer_est_doj,
               so.actual_doj AS offer_actual_doj,
               so.status AS offer_status,
               d.call_status,
               d.doj_confirmation,
               d.notes,
               d.follow_up_date,
               d.last_call_date,
               d.updated_by,
               d.updated_at AS desk_updated_at
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN joining_call_desk d ON c.app_no COLLATE utf8mb4_unicode_ci = d.app_no COLLATE utf8mb4_unicode_ci
        GROUP BY c.app_no
        ORDER BY c.name ASC
      `);

      const todayStr = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      // Current week range
      const curr = new Date();
      const firstDayOfWeek = new Date(curr.setDate(curr.getDate() - curr.getDay()));
      const lastDayOfWeek = new Date(curr.setDate(curr.getDate() - curr.getDay() + 6));
      const weekStartStr = firstDayOfWeek.toISOString().slice(0, 10);
      const weekEndStr = lastDayOfWeek.toISOString().slice(0, 10);

      // Next 30 days range
      const next30 = new Date();
      next30.setDate(next30.getDate() + 30);
      const next30Str = next30.toISOString().slice(0, 10);

      const records = rows.map(r => {
        const rawDoj = r.offered_doj || r.offer_est_doj || r.offer_actual_doj;
        const doj = fmtDate(rawDoj);
        const dept = normalizeDepartment(r.department);
        const desig = normalizeDesignation(r.designation);
        const sec = normalizeSection(r.section);
        const gender = (r.gender && r.gender.trim()) ? (r.gender.charAt(0).toUpperCase() + r.gender.slice(1).toLowerCase()) : 'Unspecified';

        return {
          appNo: r.app_no,
          name: r.name || 'Unnamed Candidate',
          phone: r.phone || '',
          email: r.email || '',
          gender: gender,
          department: dept,
          section: sec,
          designation: desig,
          offeredDoj: doj,
          currentDoj: doj,
          photoUrl: r.photo_url || '',
          callStatus: r.call_status || 'Pending',
          dojConfirmation: r.doj_confirmation || 'Pending confirmation',
          notes: r.notes || '',
          followUpDate: fmtDate(r.follow_up_date),
          lastCallDate: fmtDate(r.last_call_date),
          updatedBy: r.updated_by || '',
          updatedAt: r.desk_updated_at || null,
          candidateStatus: r.candidate_status || 'Applied',
          offerStatus: r.offer_status || '',
          joiningStatus: (r.candidate_status === 'Joined' || r.offer_status === 'Joined') ? 'Joined' : (r.candidate_status === 'Hired' || r.offer_status === 'Hired') ? 'Hired' : 'Pending Joining'
        };
      });

      // Filter employees with DOJ vs unassigned
      const withDoj = records.filter(r => Boolean(r.offeredDoj));
      const unassigned = records.filter(r => !r.offeredDoj);

      // Top KPI calculations
      const totalWithDoj = withDoj.length;
      const dojConfirmed = withDoj.filter(r => r.dojConfirmation === 'Confirmed').length;
      const dojPendingConfirmation = withDoj.filter(r => r.dojConfirmation === 'Pending confirmation' || !r.dojConfirmation).length;
      const joiningToday = withDoj.filter(r => r.offeredDoj === todayStr).length;
      const joiningTomorrow = withDoj.filter(r => r.offeredDoj === tomorrowStr).length;
      const joiningThisWeek = withDoj.filter(r => r.offeredDoj >= weekStartStr && r.offeredDoj <= weekEndStr).length;
      const joiningNext30Days = withDoj.filter(r => r.offeredDoj >= todayStr && r.offeredDoj <= next30Str).length;
      const overdue = withDoj.filter(r => r.offeredDoj < todayStr && r.joiningStatus !== 'Joined' && r.dojConfirmation !== 'Confirmed').length;

      const kpis = {
        totalWithDoj,
        dojConfirmed,
        dojPendingConfirmation,
        joiningToday,
        joiningTomorrow,
        joiningThisWeek,
        joiningNext30Days,
        overdue,
        unassignedCount: unassigned.length
      };

      return res.json({
        success: true,
        kpis,
        records: withDoj,
        unassigned,
        total: records.length
      });
    } catch (err) {
      console.error('[DOJPlanning.getOverview]', err);
      return errorRes(res, 'Failed to fetch DOJ Planning overview: ' + err.message, [err.message], 500);
    }
  }
}

module.exports = new DOJPlanningController();
