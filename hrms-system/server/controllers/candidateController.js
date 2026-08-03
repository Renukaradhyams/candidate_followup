const candidateService = require('../services/candidateService');
const { successRes, errorRes } = require('../utils/response');

class CandidateController {
  async getCandidates(req, res) {
    try {
      const result = await candidateService.getCandidates(req.query);
      return res.json(result);
    } catch (err) {
      console.error('getCandidates ERROR:', err);
      return errorRes(res, 'DB_ERR: ' + err.message, [err.message], 500);
    }
  }

  async addCandidate(req, res) {
    try {
      const d = req.body.data || req.body;
      const result = await candidateService.addCandidate(d);
      return res.json({ success: true, appNo: result.appNo, candidateCode: result.candidateCode });
    } catch (err) {
      return errorRes(res, `Failed to add candidate: ${err.message}`, [err.message], 500);
    }
  }

  async updateCandidate(req, res) {
    try {
      const { appNo, updates, doneBy } = req.body;
      const user = doneBy || (req.user ? req.user.username : 'HR');
      let result;
      if (updates.isFullEdit) {
        result = await candidateService.updateCandidateFull(appNo, updates, user);
      } else {
        result = await candidateService.updateCandidate(appNo, updates, user);
      }
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to update candidate', [err.message], 500);
    }
  }

  async deleteCandidate(req, res) {
    try {
      const { appNo } = req.params;
      const result = await candidateService.deleteCandidate(appNo);
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to delete candidate', [err.message], 500);
    }
  }

  async checkDuplicate(req, res) {
    try {
      const phone = req.query.phone || req.body.phone;
      const result = await candidateService.checkDuplicate(phone);
      return res.json(result);
    } catch (err) {
      return res.json({ exists: false });
    }
  }

  async getNextAppNo(req, res) {
    try {
      const result = await candidateService.generateCandidateCode();
      return res.json({ appNo: result.appNo });
    } catch (err) {
      return res.json({ appNo: 'BSC-2026-0001' });
    }
  }

  async getKPIs(req, res) {
    try {
      const result = await candidateService.getKPIs();
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to fetch KPIs', [err.message], 500);
    }
  }

  async getActivityFull(req, res) {
    try {
      const appNo = req.query.appNo || req.body.appNo;
      const result = await candidateService.getActivityFull(appNo);
      return res.json(result);
    } catch (err) {
      return res.json({ success: false, error: err.message });
    }
  }

  async getSystemActivity(req, res) {
    try {
      const limit = req.query.limit || 10;
      const result = await candidateService.getSystemActivity(limit);
      return res.json(result);
    } catch (err) {
      return res.json({ success: false, error: err.message });
    }
  }

  async uploadResume(req, res) {
    try {
      if (!req.file) {
        return errorRes(res, 'No file uploaded', [], 400);
      }
      const fileUrl = `/uploads/candidate-resumes/${req.file.filename}`;
      if (req.body.appNo) {
        await candidateService.updateCandidate(req.body.appNo, { resumeUrl: fileUrl });
      }
      return res.json({
        success: true,
        fileUrl,
        fileName: req.file.filename
      });
    } catch (err) {
      return errorRes(res, 'File upload failed', [err.message], 500);
    }
  }

  async uploadDocuments(req, res) {
    try {
      const result = {};
      const appNo = req.headers['x-app-no'] || req.body.appNo || req.query.appNo;
      
      if (req.files) {
        if (req.files['resume'] && req.files['resume'][0]) {
          result.resumeUrl = appNo 
            ? `uploads/applicants/${appNo}/${req.files['resume'][0].filename}` 
            : `uploads/candidate-resumes/${req.files['resume'][0].filename}`;
        }
        if (req.files['photo'] && req.files['photo'][0]) {
          result.photoUrl = appNo 
            ? `uploads/applicants/${appNo}/${req.files['photo'][0].filename}` 
            : `uploads/candidate-photos/${req.files['photo'][0].filename}`;
        }
        if (req.files['aadhar'] && req.files['aadhar'][0]) {
          result.aadhaarUrl = appNo 
            ? `uploads/applicants/${appNo}/${req.files['aadhar'][0].filename}` 
            : `uploads/employee-documents/${req.files['aadhar'][0].filename}`;
        }
      }
      return res.json({ success: true, ...result });
    } catch (err) {
      return errorRes(res, 'File upload failed', [err.message], 500);
    }
  }

  async getPendingActions(req, res) {
    try {
      const result = await candidateService.getPendingActions();
      return res.json(result);
    } catch (err) {
      return res.json({ actions: [] });
    }
  }

  async getSourceBreakdown(req, res) {
    try {
      const result = await candidateService.getSourceBreakdown();
      return res.json(result);
    } catch (err) {
      return res.json({ breakdown: [] });
    }
  }

  async getOpenings(req, res) {
    try {
      const db = require('../config/db');
      
      const [reqRows] = await db.query(`SELECT designation, required_count FROM manpower_requisitions`);
      const reqMap = {};
      reqRows.forEach(r => {
        if (r.designation) reqMap[r.designation.trim().toLowerCase()] = r.required_count;
      });

      // Count hired candidates (status: Offer Accepted, Joined, Hired OR Offer Accepted/Joined in offer desk)
      const [hiredRows] = await db.query(
        `SELECT c.designation, COUNT(*) as cnt 
         FROM candidates c
         LEFT JOIN selection_offers so ON c.app_no = so.app_no
         WHERE LOWER(TRIM(c.status)) IN ('offer accepted', 'joined', 'hired') 
            OR LOWER(TRIM(so.status)) IN ('accepted', 'joined')
         GROUP BY c.designation`
      );
      const hiredMap = {};
      hiredRows.forEach(r => {
        if (r.designation) {
          const key = r.designation.trim().toLowerCase();
          hiredMap[key] = (hiredMap[key] || 0) + r.cnt;
        }
      });

      const [desigRows] = await db.query(`SELECT name FROM designations WHERE active = TRUE`);
      const desigSet = new Set([...desigRows.map(d => d.name)]);
      
      // Also include any designations that exist in manpower_requisitions or candidates
      reqRows.forEach(r => { if (r.designation) desigSet.add(r.designation); });
      hiredRows.forEach(r => { if (r.designation) desigSet.add(r.designation); });

      const openings = Array.from(desigSet).map(desigName => {
        const key = desigName.trim().toLowerCase();
        const required = reqMap[key] || 0;
        const hired = hiredMap[key] || 0;
        return {
          designation: desigName,
          required,
          hired,
          remaining: Math.max(0, required - hired)
        };
      });

      return res.json({ success: true, openings });
    } catch (err) {
      return errorRes(res, 'Failed to fetch openings', [err.message], 500);
    }
  }

  async updateOpening(req, res) {
    try {
      const db = require('../config/db');
      const { designation, required_count } = req.body;
      
      const [rows] = await db.query(`SELECT id FROM manpower_requisitions WHERE designation = ?`, [designation]);
      if (rows.length > 0) {
        await db.query(`UPDATE manpower_requisitions SET required_count = ? WHERE designation = ?`, [required_count, designation]);
      } else {
        await db.query(`INSERT INTO manpower_requisitions (designation, required_count) VALUES (?, ?)`, [designation, required_count]);
      }
      
      return res.json({ success: true });
    } catch (err) {
      return errorRes(res, 'Failed to update opening', [err.message], 500);
    }
  }

  async getEmployees(req, res) {
    try {
      const db = require('../config/db');
      
      const [rows] = await db.query(
        `SELECT c.*, 
                so.notice_period as offer_notice_pd, 
                so.est_doj as offer_est_doj, 
                so.actual_doj as offer_actual_doj,
                so.status as offer_status,
                so.remarks as offer_remarks
         FROM candidates c
         LEFT JOIN selection_offers so ON c.app_no = so.app_no
         WHERE LOWER(TRIM(c.status)) IN ('offer accepted', 'joined', 'hired')
            OR LOWER(TRIM(so.status)) IN ('accepted', 'joined')
         ORDER BY LOWER(c.name) ASC`
      );

      const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];

      const employees = rows.map(r => {
        const initials = r.name
          ? r.name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
          : 'E';
        const colorIndex = ((r.name ? r.name.charCodeAt(0) : 0) + (r.name ? r.name.charCodeAt(1) || 0 : 0)) % colors.length;
        
        const createdDate = new Date(r.created_at || Date.now());

        const offeredDoj = r.offered_doj 
          ? new Date(r.offered_doj).toISOString().split('T')[0] 
          : (r.offer_est_doj ? new Date(r.offer_est_doj).toISOString().split('T')[0] : (r.offer_actual_doj ? new Date(r.offer_actual_doj).toISOString().split('T')[0] : ''));

        const salaryOffered = r.salary || r.expected_salary || '—';

        return {
          id: r.id,
          appNo: r.app_no,
          name: r.name,
          initials,
          color: colors[colorIndex],
          phone: r.phone || '',
          email: r.email || '',
          dob: r.dob ? new Date(r.dob).toISOString().split('T')[0] : '',
          gender: r.gender || '',
          cityState: r.city_state || '',
          address: r.address || '',
          desig: r.designation,
          designation: r.designation,
          department: r.department || '',
          branch: r.branch || '',
          reportingManager: r.reporting_manager || '',
          status: r.status || r.offer_status || 'Joined',
          salary: salaryOffered,
          expectedSalary: r.expected_salary || '',
          previousSalary: r.current_salary || r.previous_salary || '',
          currentSalary: r.current_salary || '',
          offeredDoj,
          actualDoj: r.offer_actual_doj ? new Date(r.offer_actual_doj).toISOString().split('T')[0] : '',
          estDoj: r.offer_est_doj ? new Date(r.offer_est_doj).toISOString().split('T')[0] : '',
          noticePeriod: r.notice_period || r.offer_notice_pd || '',
          experience: r.experience || '',
          qualification: r.qualification || '',
          retailExperience: r.retail_experience || '',
          previousCompany: r.previous_company || '',
          previousDesignation: r.previous_designation || '',
          bloodGroup: r.blood_group || '',
          aadhaarNumber: r.aadhaar_number || '',
          fatherDetails: r.father_details || '',
          motherDetails: r.mother_details || '',
          religionCaste: r.religion_caste || '',
          religion: r.religion || '',
          caste: r.caste || '',
          languagesKnown: r.languages_known ? (typeof r.languages_known === 'string' ? (r.languages_known.startsWith('[') ? JSON.parse(r.languages_known) : [r.languages_known]) : r.languages_known) : [],
          photoUrl: r.photo_url || '',
          aadhaarUrl: r.aadhaar_url || '',
          aadharUrl: r.aadhaar_url || '',
          resumeUrl: r.resume_url || '',
          source: r.source || '',
          referrer: r.referrer || '',
          referrerEmpNo: r.referrer_emp_no || '',
          sourceDetail: r.source_detail || '',
          q1: r.q1 || '',
          q2: r.q2 || '',
          q3: r.q3 || '',
          q4: r.q4 || '',
          remarks: r.remarks || r.offer_remarks || '',
          date: createdDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        };
      });

      return res.json({ success: true, employees, total: employees.length });
    } catch (err) {
      return errorRes(res, 'DB_ERR: ' + err.message, [err.message], 500);
    }
  }

  async bulkAddEmployees(req, res) {
    try {
      const { employees } = req.body;
      if (!employees || !Array.isArray(employees)) {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }
      
      const user = req.user ? req.user.username : 'HR';
      const result = await candidateService.bulkAddEmployees(employees, user);
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to bulk import employees', [err.message], 500);
    }
  }
}

module.exports = new CandidateController();
