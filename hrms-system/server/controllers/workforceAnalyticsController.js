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

class WorkforceAnalyticsController {

  // GET /api/workforce-analytics
  async getAnalytics(req, res) {
    try {
      // 1. Fetch all employees in Employee Directory (Joined/Hired)
      const [empRows] = await pool.query(`
        SELECT 
          c.app_no,
          c.name,
          c.gender,
          c.department,
          COALESCE(sa.section, 'General') AS section,
          c.designation,
          c.status,
          COALESCE(c.offered_doj, so.est_doj, so.actual_doj, c.created_at) AS doj,
          c.created_at
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no COLLATE utf8mb4_unicode_ci = so.app_no COLLATE utf8mb4_unicode_ci
        LEFT JOIN section_allocations sa ON c.app_no COLLATE utf8mb4_unicode_ci = sa.app_no COLLATE utf8mb4_unicode_ci
        WHERE LOWER(TRIM(c.status)) IN ('joined', 'hired')
           OR LOWER(TRIM(so.status)) = 'joined'
        GROUP BY c.app_no
        ORDER BY c.name ASC
      `);

      // Track Data Quality Audit variations
      const deptAuditMap = new Map();  // Normalized Dept -> Set of raw variations
      const desigAuditMap = new Map(); // Normalized Desig -> Set of raw variations

      const employees = empRows.map(r => {
        const rawGender = (r.gender || '').trim().toLowerCase();
        let gender = 'Male';
        if (rawGender.startsWith('f') || rawGender.includes('female')) gender = 'Female';
        else if (rawGender.startsWith('m') || rawGender.includes('male')) gender = 'Male';
        else gender = 'Male';

        const rawDept = r.department || 'Unassigned';
        const rawDesig = r.designation || 'Unassigned';
        const rawSec = r.section || 'General';

        const normDept = normalizeDepartment(rawDept);
        const normDesig = normalizeDesignation(rawDesig);
        const normSec = normalizeSection(rawSec);

        // Audit collection
        if (!deptAuditMap.has(normDept)) deptAuditMap.set(normDept, new Set());
        deptAuditMap.get(normDept).add(rawDept);

        if (!desigAuditMap.has(normDesig)) desigAuditMap.set(normDesig, new Set());
        desigAuditMap.get(normDesig).add(rawDesig);

        return {
          appNo: r.app_no,
          name: r.name || 'Unnamed',
          gender,
          department: normDept,
          section: normSec,
          designation: normDesig,
          doj: fmtDate(r.doj),
        };
      });

      const totalEmployees = employees.length;

      // 2. Gender totals
      let maleCount = 0;
      let femaleCount = 0;
      employees.forEach(e => {
        if (e.gender === 'Female') femaleCount++;
        else maleCount++;
      });

      const malePct = totalEmployees > 0 ? Math.round((maleCount / totalEmployees) * 1000) / 10 : 0;
      const femalePct = totalEmployees > 0 ? Math.round((femaleCount / totalEmployees) * 1000) / 10 : 0;

      // 3. Department aggregation
      const deptMap = new Map();
      // Designation aggregation
      const desigMap = new Map();
      // Dept -> Designation tree map
      const treeMap = new Map();
      // Hiring trends timeline map (YYYY-MM)
      const trendMap = new Map();

      // Sort employees by DOJ for newest employee calculations
      const sortedByDoj = [...employees].sort((a, b) => (b.doj || '').localeCompare(a.doj || ''));
      const lastJoinedEmployee = sortedByDoj[0] || null;

      let newestDeptHiring = 'N/A';
      if (lastJoinedEmployee && lastJoinedEmployee.department) {
        newestDeptHiring = lastJoinedEmployee.department;
      }

      employees.forEach(e => {
        // Department map
        if (!deptMap.has(e.department)) {
          deptMap.set(e.department, { department: e.department, total: 0, male: 0, female: 0, dojs: [] });
        }
        const dObj = deptMap.get(e.department);
        dObj.total++;
        if (e.gender === 'Female') dObj.female++;
        else dObj.male++;
        if (e.doj) dObj.dojs.push(e.doj);

        // Designation map
        if (!desigMap.has(e.designation)) {
          desigMap.set(e.designation, { designation: e.designation, total: 0, male: 0, female: 0, depts: new Map() });
        }
        const desObj = desigMap.get(e.designation);
        desObj.total++;
        if (e.gender === 'Female') desObj.female++;
        else desObj.male++;
        desObj.depts.set(e.department, (desObj.depts.get(e.department) || 0) + 1);

        // Tree map (Dept -> Desig)
        if (!treeMap.has(e.department)) {
          treeMap.set(e.department, new Map());
        }
        const deptDesigMap = treeMap.get(e.department);
        if (!deptDesigMap.has(e.designation)) {
          deptDesigMap.set(e.designation, { designation: e.designation, total: 0, male: 0, female: 0 });
        }
        const subObj = deptDesigMap.get(e.designation);
        subObj.total++;
        if (e.gender === 'Female') subObj.female++;
        else subObj.male++;

        // Timeline (YYYY-MM)
        if (e.doj) {
          const ym = e.doj.slice(0, 7); // e.g. "2026-07"
          if (!trendMap.has(ym)) {
            trendMap.set(ym, { ym, total: 0, male: 0, female: 0 });
          }
          const tObj = trendMap.get(ym);
          tObj.total++;
          if (e.gender === 'Female') tObj.female++;
          else tObj.male++;
        }
      });

      // Format Department Analytics
      const departmentAnalytics = Array.from(deptMap.values()).map(d => {
        const mPct = d.total > 0 ? Math.round((d.male / d.total) * 1000) / 10 : 0;
        const fPct = d.total > 0 ? Math.round((d.female / d.total) * 1000) / 10 : 0;
        const wfPct = totalEmployees > 0 ? Math.round((d.total / totalEmployees) * 1000) / 10 : 0;
        return {
          department: d.department,
          total: d.total,
          male: d.male,
          female: d.female,
          malePct: mPct,
          femalePct: fPct,
          companyWorkforcePct: wfPct,
        };
      }).sort((a, b) => b.total - a.total);

      // Format Designation Analytics
      const designationAnalytics = Array.from(desigMap.values()).map(des => {
        const mPct = des.total > 0 ? Math.round((des.male / des.total) * 1000) / 10 : 0;
        const fPct = des.total > 0 ? Math.round((des.female / des.total) * 1000) / 10 : 0;
        const wfPct = totalEmployees > 0 ? Math.round((des.total / totalEmployees) * 1000) / 10 : 0;
        const deptBreakdown = Array.from(des.depts.entries()).map(([dept, count]) => ({ department: dept, count }));
        return {
          designation: des.designation,
          total: des.total,
          male: des.male,
          female: des.female,
          malePct: mPct,
          femalePct: fPct,
          companyWorkforcePct: wfPct,
          departments: deptBreakdown,
        };
      }).sort((a, b) => b.total - a.total);

      // Format Tree View
      const treeView = Array.from(treeMap.entries()).map(([dept, desigMapVal]) => {
        const desigs = Array.from(desigMapVal.values()).sort((a, b) => b.total - a.total);
        const deptTotal = desigs.reduce((a, x) => a + x.total, 0);
        const deptMale = desigs.reduce((a, x) => a + x.male, 0);
        const deptFemale = desigs.reduce((a, x) => a + x.female, 0);
        return {
          department: dept,
          total: deptTotal,
          male: deptMale,
          female: deptFemale,
          designations: desigs,
        };
      }).sort((a, b) => b.total - a.total);

      // Format Heatmap Matrix
      const departmentHeatmap = departmentAnalytics.map(d => ({
        department: d.department,
        male: d.male,
        female: d.female,
        total: d.total,
      }));

      // Format Hiring Trends Timeline
      const hiringTrends = Array.from(trendMap.values()).sort((a, b) => a.ym.localeCompare(b.ym)).map(t => {
        let label = t.ym;
        try {
          const [yr, mo] = t.ym.split('-');
          const dt = new Date(parseInt(yr), parseInt(mo) - 1, 1);
          label = dt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        } catch { }
        return {
          ym: t.ym,
          label,
          total: t.total,
          male: t.male,
          female: t.female,
        };
      });

      // Format Workforce Composition Categories
      const compMap = new Map();
      employees.forEach(e => {
        const deptLower = e.department.toLowerCase();
        const desigLower = e.designation.toLowerCase();
        let cat = 'Others';
        if (deptLower.includes('sale') || desigLower.includes('sales') || desigLower.includes('executive') || desigLower.includes('greeter')) cat = 'Sales & Frontline';
        else if (deptLower.includes('support') || desigLower.includes('cashier') || desigLower.includes('billing')) cat = 'Billing & Operations';
        else if (deptLower.includes('account') || desigLower.includes('account')) cat = 'Accounts & Finance';
        else if (deptLower.includes('hr') || desigLower.includes('hr') || desigLower.includes('recruiter')) cat = 'Human Resources';
        else if (desigLower.includes('manager') || desigLower.includes('supervisor') || desigLower.includes('lead')) cat = 'Management & Leads';
        else if (deptLower.includes('mens') || deptLower.includes('womens') || deptLower.includes('kids') || deptLower.includes('sarees')) cat = 'Retail Sections';

        compMap.set(cat, (compMap.get(cat) || 0) + 1);
      });

      const workforceComposition = Array.from(compMap.entries()).map(([category, count]) => ({
        category,
        count,
        pct: totalEmployees > 0 ? Math.round((count / totalEmployees) * 1000) / 10 : 0,
      })).sort((a, b) => b.count - a.count);

      // Executive Insights
      const insights = [];

      if (departmentAnalytics.length > 0) {
        const topDept = departmentAnalytics[0];
        insights.push(`Largest department is **${topDept.department}** with **${topDept.total}** employees (${topDept.companyWorkforcePct}% of company).`);
      }

      if (designationAnalytics.length > 0) {
        const topDesig = designationAnalytics[0];
        insights.push(`Largest designation is **${topDesig.designation}** with **${topDesig.total}** employees.`);
      }

      const femaleMajDept = departmentAnalytics.find(d => d.femalePct > 55 && d.total >= 5);
      if (femaleMajDept) {
        insights.push(`Female majority department: **${femaleMajDept.department}** (${femaleMajDept.femalePct}% female).`);
      }

      const maleMajDept = departmentAnalytics.find(d => d.malePct > 55 && d.total >= 5);
      if (maleMajDept) {
        insights.push(`Male majority department: **${maleMajDept.department}** (${maleMajDept.malePct}% male).`);
      }

      insights.push(`Overall company gender ratio: **${malePct}% male / ${femalePct}% female** (${maleCount} M / ${femaleCount} F).`);

      if (hiringTrends.length > 0) {
        const topTrend = [...hiringTrends].sort((a, b) => b.total - a.total)[0];
        insights.push(`Top hiring period was **${topTrend.label}** with **${topTrend.total}** joins.`);
      }

      const dataQualityAudit = {
        departmentVariations: Array.from(deptAuditMap.entries()).map(([canonical, variations]) => ({
          canonical,
          variations: Array.from(variations),
        })),
        designationVariations: Array.from(desigAuditMap.entries()).map(([canonical, variations]) => ({
          canonical,
          variations: Array.from(variations),
        })),
      };

      return res.json({
        success: true,
        overview: {
          totalEmployees,
          totalDepartments: deptMap.size,
          totalDesignations: desigMap.size,
          totalMale: maleCount,
          totalFemale: femaleCount,
          malePct,
          femalePct,
          newestDeptHiring,
          lastJoinedEmployee,
        },
        departmentAnalytics,
        designationAnalytics,
        treeView,
        departmentHeatmap,
        hiringTrends,
        workforceComposition,
        executiveInsights: insights,
        dataQualityAudit,
        rawEmployees: employees,
      });

    } catch (err) {
      console.error('[WorkforceAnalyticsController.getAnalytics]', err);
      return errorRes(res, 'Failed to calculate workforce analytics: ' + err.message, [err.message], 500);
    }
  }
}

module.exports = new WorkforceAnalyticsController();
