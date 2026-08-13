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
      const { APPROVED_DEPARTMENTS } = require('../utils/normalization');

      // 1. Fetch all employees in Employee Directory (Joined/Hired)
      const [empRows] = await pool.query(`
        SELECT 
          c.app_no,
          c.name,
          c.phone,
          c.photo_url,
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

      // Audit maps
      const deptAuditMap = new Map();
      const desigAuditMap = new Map();

      const allEmployees = empRows.map(r => {
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

        if (!deptAuditMap.has(normDept)) deptAuditMap.set(normDept, new Set());
        deptAuditMap.get(normDept).add(rawDept);

        if (!desigAuditMap.has(normDesig)) desigAuditMap.set(normDesig, new Set());
        desigAuditMap.get(normDesig).add(rawDesig);

        return {
          appNo: r.app_no,
          empId: r.app_no,
          name: r.name || 'Unnamed',
          phone: r.phone || '',
          photoUrl: r.photo_url || '',
          gender,
          department: normDept,
          rawDepartment: rawDept,
          section: normSec,
          designation: normDesig,
          doj: fmtDate(r.doj),
          status: r.status || 'Joined',
        };
      });

      // Filter into Approved workforce vs Unverified data
      const approvedEmployees = allEmployees.filter(e => APPROVED_DEPARTMENTS.includes(e.department));
      const unverifiedEmployees = allEmployees.filter(e => !APPROVED_DEPARTMENTS.includes(e.department) || e.department === 'Unassigned');

      const totalEmployees = approvedEmployees.length;

      // 2. Gender totals (Approved workforce)
      let maleCount = 0;
      let femaleCount = 0;
      approvedEmployees.forEach(e => {
        if (e.gender === 'Female') femaleCount++;
        else maleCount++;
      });

      const malePct = totalEmployees > 0 ? Math.round((maleCount / totalEmployees) * 1000) / 10 : 0;
      const femalePct = totalEmployees > 0 ? Math.round((femaleCount / totalEmployees) * 1000) / 10 : 0;

      // 3. Department aggregation (Approved taxonomy)
      const deptMap = new Map();
      APPROVED_DEPARTMENTS.forEach(dept => {
        deptMap.set(dept, { department: dept, total: 0, male: 0, female: 0, dojs: [] });
      });

      // Designation aggregation
      const desigMap = new Map();
      // Dept -> Designation tree map
      const treeMap = new Map();
      // Hiring trends timeline map (YYYY-MM)
      const trendMap = new Map();

      approvedEmployees.forEach(e => {
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
          const ym = e.doj.slice(0, 7);
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
      const departmentAnalytics = Array.from(deptMap.values())
        .map(d => {
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
        })
        .sort((a, b) => b.total - a.total);

      // Active approved depts count (depts with > 0 employees)
      const activeDepts = departmentAnalytics.filter(d => d.total > 0);
      const totalDepartments = activeDepts.length;

      // Avg employees per department
      const avgEmployeesPerDept = totalDepartments > 0 ? Math.round((totalEmployees / totalDepartments) * 10) / 10 : 0;

      // Largest Department
      const largestDeptObj = departmentAnalytics[0] || { department: 'N/A', total: 0, male: 0, female: 0 };
      const largestDept = {
        name: largestDeptObj.department,
        total: largestDeptObj.total,
        male: largestDeptObj.male,
        female: largestDeptObj.female,
      };

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

      const totalDesignations = designationAnalytics.length;
      const largestDesigObj = designationAnalytics[0] || { designation: 'N/A', total: 0 };
      const largestDesignation = {
        name: largestDesigObj.designation,
        total: largestDesigObj.total,
      };

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

      // Executive Insights
      const insights = [];
      if (departmentAnalytics.length > 0 && departmentAnalytics[0].total > 0) {
        insights.push(`Largest department is **${largestDept.name}** with **${largestDept.total}** employees (${departmentAnalytics[0].companyWorkforcePct}% of workforce).`);
      }
      if (designationAnalytics.length > 0) {
        insights.push(`Largest designation is **${largestDesignation.name}** with **${largestDesignation.total}** employees.`);
      }
      insights.push(`Overall gender balance: **${malePct}% Male** (${maleCount}) / **${femalePct}% Female** (${femaleCount}).`);
      if (unverifiedEmployees.length > 0) {
        insights.push(`⚠ **${unverifiedEmployees.length}** records require department verification in the Data Verification Panel.`);
      } else {
        insights.push(`✅ 100% of workforce assigned to approved departments.`);
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
          totalDepartments,
          totalDesignations,
          totalMale: maleCount,
          totalFemale: femaleCount,
          malePct,
          femalePct,
          avgEmployeesPerDept,
          largestDepartment: largestDept,
          largestDesignation,
          allRecordsCount: allEmployees.length,
          unverifiedCount: unverifiedEmployees.length,
        },
        departmentAnalytics,
        designationAnalytics,
        treeView,
        executiveInsights: insights,
        dataQualityAudit,
        rawEmployees: approvedEmployees,
        unverifiedEmployees,
        dataVerificationSummary: {
          totalUnverified: unverifiedEmployees.length,
          unverifiedEmployees,
        },
      });

    } catch (err) {
      console.error('[WorkforceAnalyticsController.getAnalytics]', err);
      return errorRes(res, 'Failed to calculate workforce analytics: ' + err.message, [err.message], 500);
    }
  }
}

module.exports = new WorkforceAnalyticsController();

