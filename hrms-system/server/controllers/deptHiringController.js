const pool = require('../config/db');

class DeptHiringController {
  // GET /api/dept-hiring/targets
  async getHiringTargets(req, res) {
    try {
      let targets = [];
      try {
        const [rows] = await pool.query('SELECT * FROM department_hiring_targets ORDER BY department, section');
        targets = rows || [];
      } catch (e) {
        targets = [];
      }

      // Also calculate actual joined counts per dept, section, designation from candidates/employees
      let joinedCounts = {};
      try {
        const [candRows] = await pool.query(`
          SELECT designation, COUNT(*) as cnt 
          FROM candidates 
          WHERE status = 'Joined' 
          GROUP BY designation
        `);
        (candRows || []).forEach(r => {
          if (r.designation) {
            joinedCounts[r.designation.toLowerCase()] = r.cnt;
          }
        });
      } catch (e) {}

      return res.json({
        success: true,
        targets,
        joinedCounts
      });
    } catch (err) {
      console.error('[getHiringTargets Error]', err);
      return res.json({ success: false, targets: [], joinedCounts: {} });
    }
  }

  // POST /api/dept-hiring/targets
  async saveHiringTarget(req, res) {
    try {
      const { department, section, designation, requiredOpenings, hiringTarget, remarks } = req.body;
      if (!department || !section || !designation) {
        return res.status(400).json({ success: false, error: 'Department, section and designation are required' });
      }

      const reqCount = parseInt(requiredOpenings, 10) || 0;
      const targetCount = parseInt(hiringTarget, 10) || reqCount;

      await pool.query(`
        INSERT INTO department_hiring_targets (department, section, designation, required_openings, hiring_target, remarks)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          required_openings = VALUES(required_openings),
          hiring_target = VALUES(hiring_target),
          remarks = VALUES(remarks),
          updated_at = CURRENT_TIMESTAMP
      `, [department, section, designation, reqCount, targetCount, remarks || '']);

      return res.json({ success: true, message: 'Hiring target updated successfully' });
    } catch (err) {
      console.error('[saveHiringTarget Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/section-allocations
  async getSectionAllocations(req, res) {
    try {
      let allocations = [];
      try {
        const [rows] = await pool.query('SELECT * FROM section_allocations');
        allocations = rows || [];
      } catch (e) {
        allocations = [];
      }
      return res.json({ success: true, allocations });
    } catch (err) {
      console.error('[getSectionAllocations Error]', err);
      return res.json({ success: false, allocations: [] });
    }
  }

  // POST /api/section-allocations
  async saveSectionAllocation(req, res) {
    try {
      const { employeeId, appNo, employeeName, department, section, assignedBy, notes } = req.body;
      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee ID is required' });
      }

      await pool.query(`
        INSERT INTO section_allocations (employee_id, app_no, employee_name, department, section, assigned_by, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          department = VALUES(department),
          section = VALUES(section),
          assigned_by = VALUES(assigned_by),
          notes = VALUES(notes),
          updated_at = CURRENT_TIMESTAMP
      `, [employeeId, appNo || '', employeeName || '', department || '', section || '', assignedBy || 'HR', notes || '']);

      return res.json({ success: true, message: 'Section allocation saved successfully' });
    } catch (err) {
      console.error('[saveSectionAllocation Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/section-allocations/bulk
  async bulkSaveSectionAllocation(req, res) {
    try {
      const { employees, section, action, assignedBy } = req.body;
      if (!Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({ success: false, error: 'No employees selected' });
      }

      const targetSection = action === 'remove' ? '' : (section || '');

      for (const emp of employees) {
        const empId = emp.employeeId || emp.id || emp.appNo;
        if (!empId) continue;

        await pool.query(`
          INSERT INTO section_allocations (employee_id, app_no, employee_name, department, section, assigned_by)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            section = VALUES(section),
            assigned_by = VALUES(assigned_by),
            updated_at = CURRENT_TIMESTAMP
        `, [
          String(empId), 
          emp.appNo || '', 
          emp.employeeName || emp.name || '', 
          emp.department || '', 
          targetSection, 
          assignedBy || 'HR'
        ]);
      }

      return res.json({ success: true, message: `Bulk updated section for ${employees.length} employees` });
    } catch (err) {
      console.error('[bulkSaveSectionAllocation Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new DeptHiringController();
