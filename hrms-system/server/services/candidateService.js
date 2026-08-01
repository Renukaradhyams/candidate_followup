const pool = require('../config/db');

class CandidateService {
  async generateCandidateCode() {
    const year = new Date().getFullYear();
    const [rows] = await pool.query(`SELECT COUNT(*) as cnt FROM Candidate`);
    const nextNum = (rows[0].cnt + 1).toString().padStart(4, '0');
    return {
      candidateCode: `CAND-${year}-${nextNum}`,
      appNo: `BSC-${year}-${nextNum}`
    };
  }

  async getCandidates(filters = {}) {
    const { 
      status, desig, source, gender, cityState, 
      minSalary, maxSalary, minExp, maxExp,
      fromDate, toDate, q, page = 1, limit = 500, sortDir = 'asc' 
    } = filters;

    let query = `SELECT * FROM Candidate WHERE deletedAt IS NULL`;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND LOWER(status) = LOWER(?)`;
      params.push(status);
    }
    if (desig) {
      query += ` AND designation = ?`;
      params.push(desig);
    }
    if (source) {
      query += ` AND source = ?`;
      params.push(source);
    }
    if (gender) {
      query += ` AND LOWER(gender) = LOWER(?)`;
      params.push(gender);
    }
    if (cityState) {
      query += ` AND LOWER(cityState) LIKE ?`;
      params.push(`%${cityState.toLowerCase()}%`);
    }
    if (minSalary) {
      query += ` AND expectedSalary >= ?`;
      params.push(parseFloat(minSalary));
    }
    if (maxSalary) {
      query += ` AND expectedSalary <= ?`;
      params.push(parseFloat(maxSalary));
    }
    if (fromDate) {
      query += ` AND createdAt >= ?`;
      params.push(new Date(fromDate));
    }
    if (toDate) {
      query += ` AND createdAt <= ?`;
      params.push(new Date(new Date(toDate).setHours(23, 59, 59)));
    }
    if (q) {
      query += ` AND (LOWER(candidateName) LIKE ? OR LOWER(appNo) LIKE ? OR LOWER(candidateCode) LIKE ? OR mobile LIKE ? OR LOWER(email) LIKE ?)`;
      const term = `%${q.toLowerCase()}%`;
      params.push(term, term, term, term, term);
    }

    const order = sortDir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY createdAt ${order}`;

    const [allRows] = await pool.query(query, params);
    const total = allRows.length;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = allRows.slice(startIndex, startIndex + limitNum);

    const candidates = paginated.map((r) => {
      const initials = r.candidateName
        ? r.candidateName
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0] || '')
            .join('')
            .toUpperCase()
        : 'C';

      const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];
      const colorIndex = ((r.candidateName ? r.candidateName.charCodeAt(0) : 0) + (r.candidateName ? r.candidateName.charCodeAt(1) || 0 : 0)) % colors.length;

      const createdDate = new Date(r.createdAt);
      const daysIn = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000));

      return {
        id: r.id,
        candidateCode: r.candidateCode || r.appNo,
        appNo: r.appNo,
        name: r.candidateName,
        initials,
        color: colors[colorIndex],
        phone: r.mobile,
        email: r.email || '',
        dob: r.dob ? new Date(r.dob).toISOString().split('T')[0] : '',
        gender: r.gender || '',
        cityState: r.cityState || '',
        address: r.address || '',
        desig: r.designation,
        occupation: r.occupation || '',
        qualification: r.qualification || '',
        experience: r.experience || '',
        currentSalary: r.currentSalary || '',
        salary: r.salary || (r.expectedSalary ? r.expectedSalary.toString() : ''),
        expectedSalary: r.expectedSalary,
        noticePeriod: r.noticePeriod || '',
        ownVehicle: r.ownVehicle || 'No',
        source: r.source,
        referrer: r.referrer || '',
        referrerEmpNo: r.referrerEmpNo || '',
        sourceDetail: r.sourceDetail || '',
        date: createdDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        rawDate: createdDate.getTime(),
        status: r.status,
        daysIn,
        resumeUrl: r.resumeUrl || '',
        photoUrl: r.photoUrl || '',
        aadharUrl: r.aadharUrl || '',
        q1: r.q1 || '',
        q2: r.q2 || '',
        q3: r.q3 || '',
        q4: r.q4 || '',
        remarks: r.remarks || ''
      };
    });

    return { candidates, total, page: pageNum };
  }

  async addCandidate(data) {
    const codes = await this.generateCandidateCode();
    const appNo = data.appNo || codes.appNo;
    const candidateCode = codes.candidateCode;

    const [res] = await pool.query(
      `INSERT INTO Candidate (
        candidateCode, appNo, candidateName, mobile, email, dob, gender, cityState, address, designation,
        occupation, qualification, experience, currentSalary, expectedSalary,
        noticePeriod, ownVehicle, source, referrer, referrerEmpNo, sourceDetail,
        q1, q2, q3, q4, status, salary, remarks, isDuplicatePhone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        candidateCode,
        appNo,
        data.name || data.candidateName,
        data.phone || data.mobile,
        data.email || null,
        data.dob || null,
        data.gender || null,
        data.cityState || null,
        data.address || null,
        data.desig || data.designation,
        data.occupation || null,
        data.qualification || null,
        data.experience || null,
        data.currentSalary || null,
        data.expectedSalary || data.salary || 0.0,
        data.noticePeriod || null,
        data.ownVehicle || 'No',
        data.source || 'Walk-in',
        data.referrer || null,
        data.referrerEmpNo || null,
        data.sourceDetail || null,
        data.q1 || null,
        data.q2 || null,
        data.q3 || null,
        data.q4 || null,
        'New',
        data.salary || null,
        data.remarks || null,
        data.isDuplicatePhone || 'No'
      ]
    );

    const candidateId = res.insertId;

    await pool.query(
      `INSERT INTO CandidateHistory (candidateId, appNo, actionType, icon, label, byUser, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [candidateId, appNo, 'applied', '📋', 'Candidate Registered', 'Public', 'navy']
    );

    return { success: true, appNo, candidateCode, candidateId };
  }

  async updateCandidate(appNo, updates, doneBy = 'HR') {
    const fields = [];
    const values = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.remarks !== undefined) {
      fields.push('remarks = ?');
      values.push(updates.remarks);
    }
    if (updates.resumeUrl) {
      fields.push('resumeUrl = ?');
      values.push(updates.resumeUrl);
    }

    values.push(appNo);
    await pool.query(`UPDATE Candidate SET ${fields.join(', ')} WHERE appNo = ? AND deletedAt IS NULL`, values);

    const [cand] = await pool.query(`SELECT id FROM Candidate WHERE appNo = ?`, [appNo]);
    if (cand.length > 0) {
      await pool.query(
        `INSERT INTO CandidateHistory (candidateId, appNo, actionType, icon, label, remarks, byUser, color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cand[0].id, appNo, 'status_change', '🔄', `Status changed to ${updates.status || 'Updated'}`, updates.remarks || '', doneBy, 'gold']
      );
    }

    return { success: true };
  }

  async checkDuplicate(phone, email) {
    let exists = false;
    let name = '';
    let appNo = '';
    let appliedOn = '';

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const [rows] = await pool.query(
        `SELECT appNo, candidateName, createdAt FROM Candidate WHERE REPLACE(mobile, ' ', '') LIKE ? AND deletedAt IS NULL`,
        [`%${cleanPhone.slice(-10)}%`]
      );
      if (rows.length > 0) {
        exists = true;
        name = rows[0].candidateName;
        appNo = rows[0].appNo;
        appliedOn = new Date(rows[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    if (!exists && email) {
      const [rows] = await pool.query(
        `SELECT appNo, candidateName, createdAt FROM Candidate WHERE LOWER(email) = LOWER(?) AND deletedAt IS NULL`,
        [email.trim()]
      );
      if (rows.length > 0) {
        exists = true;
        name = rows[0].candidateName;
        appNo = rows[0].appNo;
        appliedOn = new Date(rows[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    return { exists, name, appNo, appliedOn };
  }

  async addDocument(candidateId, docType, fileName, filePath, fileSize, fileExt, userId) {
    const [res] = await pool.query(
      `INSERT INTO CandidateDocument (candidateId, documentType, fileName, filePath, fileSize, fileExtension, uploadedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [candidateId, docType, fileName, filePath, fileSize || 0, fileExt || '', userId || null]
    );

    return { id: res.insertId, filePath };
  }

  async getCandidateDocuments(candidateId) {
    const [rows] = await pool.query(
      `SELECT * FROM CandidateDocument WHERE candidateId = ? AND deletedAt IS NULL ORDER BY createdAt DESC`,
      [candidateId]
    );
    return rows;
  }

  async getKPIs() {
    const [candRows] = await pool.query(`SELECT status, createdAt FROM Candidate WHERE deletedAt IS NULL`);
    const total = candRows.length;

    const todayStr = new Date().toDateString();
    const todayCandidates = candRows.filter(r => new Date(r.createdAt).toDateString() === todayStr).length;
    const pendingReview = candRows.filter(r => r.status === 'New').length;
    const shortlisted = candRows.filter((r) =>
      ['Shortlisted', '1st Call Done', '2nd Call Done', 'Interview Scheduled', 'Interviewed'].includes(r.status)
    ).length;
    const selected = candRows.filter((r) => r.status === 'Selected').length;
    const joined = candRows.filter((r) => r.status === 'Joined').length;
    const offerAccepted = candRows.filter((r) => r.status === 'Offer Accepted').length;
    const rejected = candRows.filter((r) => r.status === 'Rejected').length;
    const hold = candRows.filter((r) => r.status === 'Hold').length;

    const [offerRows] = await pool.query(`SELECT offerStatus FROM Offer WHERE deletedAt IS NULL`);
    const offerPending = offerRows.filter(r => r.offerStatus === 'Pending Accept').length;
    const acceptedOffers = offerRows.filter((r) => r.offerStatus === 'Accepted').length;
    const offerDeclined = offerRows.filter(r => r.offerStatus === 'Offer Rejected' || r.offerStatus === 'Declined').length;
    const acceptanceRate = offerRows.length > 0 ? Math.round((acceptedOffers / offerRows.length) * 100) : 0;

    const [schedRows] = await pool.query(`SELECT interviewDate FROM InterviewSchedule WHERE interviewDate IS NOT NULL AND deletedAt IS NULL`);
    const interviewsToday = schedRows.filter((r) => new Date(r.interviewDate).toDateString() === todayStr).length;

    const [obRows] = await pool.query(`SELECT status FROM Onboarding WHERE deletedAt IS NULL`);
    const completedOnboarding = obRows.filter(r => r.status === 'Completed').length;

    const [exitRows] = await pool.query(`SELECT status FROM ExitRequest WHERE deletedAt IS NULL`);
    const exitPending = exitRows.filter(r => r.status === 'Pending' || r.status === 'In Progress').length;
    const completedExit = exitRows.filter(r => r.status === 'Completed').length;

    const [empRows] = await pool.query(`SELECT id FROM Employee WHERE status = 'Active' AND deletedAt IS NULL`);
    const activeEmployees = empRows.length;

    return {
      totalCandidates: total,
      todayCandidates,
      pendingReview,
      interviewScheduled: interviewsToday,
      interviewCompleted: shortlisted,
      round1Cleared: shortlisted,
      round2Cleared: selected,
      selected,
      rejected,
      offerPending,
      offerAccepted,
      offerDeclined,
      joiningPending: offerAccepted,
      employeesJoined: joined,
      exitPending,
      completedExit,
      activeEmployees,
      acceptanceRate,
      avgDays: 5,
      total,
      shortlisted,
      joined,
      onboarding: offerAccepted,
      interviewsToday,
      newCandidates: pendingReview,
      hold
    };
  }

  async getActivityFull(appNo) {
    const [acts] = await pool.query(`SELECT * FROM CandidateHistory WHERE appNo = ? AND deletedAt IS NULL ORDER BY createdAt ASC`, [appNo]);
    const activity = acts.map((a) => ({
      type: a.actionType,
      icon: a.icon || '📋',
      label: a.label,
      score: a.score,
      maxScore: a.maxScore,
      remarks: a.remarks || '',
      assignedBy: a.assignedBy || '',
      by: a.byUser || '',
      date: new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      color: a.color || 'navy'
    }));

    return { success: true, activity };
  }
}

module.exports = new CandidateService();
