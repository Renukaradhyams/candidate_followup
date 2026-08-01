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
      return errorRes(res, 'Failed to add candidate', [err.message], 500);
    }
  }

  async updateCandidate(req, res) {
    try {
      const { appNo, updates, doneBy } = req.body;
      const user = doneBy || (req.user ? req.user.username : 'HR');
      const result = await candidateService.updateCandidate(appNo, updates, user);
      return res.json(result);
    } catch (err) {
      return errorRes(res, 'Failed to update candidate', [err.message], 500);
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
}

module.exports = new CandidateController();
