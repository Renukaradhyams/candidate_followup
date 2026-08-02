const candidateService = require('../services/candidateService');
const { successRes, errorRes } = require('../utils/response');

class CandidateController {
  async getCandidates(req, res) {
    try {
      const result = await candidateService.getCandidates(req.query);
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to fetch candidates', [err.message], 500);
    }
  }

  async addCandidate(req, res) {
    try {
      const d = req.body.data || req.body;
      const result = await candidateService.addCandidate(d);
      return res.json({ success: true, appNo: result.appNo, candidateCode: result.candidateCode });
    } catch (err) {
      return errorRes(res, \`Failed to add candidate: \${err.message}\`, [err.message], 500);
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
      if (req.files) {
        if (req.files['resume'] && req.files['resume'][0]) {
          result.resumeUrl = `/uploads/candidate-resumes/${req.files['resume'][0].filename}`;
        }
        if (req.files['photo'] && req.files['photo'][0]) {
          result.photoUrl = `/uploads/candidate-photos/${req.files['photo'][0].filename}`;
        }
        if (req.files['aadhar'] && req.files['aadhar'][0]) {
          result.aadhaarUrl = `/uploads/employee-documents/${req.files['aadhar'][0].filename}`;
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
      reqRows.forEach(r => reqMap[r.designation] = r.required_count);

      const [hiredRows] = await db.query(`SELECT designation, COUNT(*) as cnt FROM candidates WHERE status IN ('Selected', 'Offer Sent', 'Offer Accepted', 'Joined') GROUP BY designation`);
      const hiredMap = {};
      hiredRows.forEach(r => hiredMap[r.designation] = r.cnt);

      const [desigRows] = await db.query(`SELECT name FROM designations WHERE active = TRUE`);
      
      const openings = desigRows.map(d => ({
        designation: d.name,
        required: reqMap[d.name] || 0,
        hired: hiredMap[d.name] || 0,
        remaining: Math.max(0, (reqMap[d.name] || 0) - (hiredMap[d.name] || 0))
      }));

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
}

module.exports = new CandidateController();
