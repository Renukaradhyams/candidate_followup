const pool = require('../config/db');

class CandidateService {
  async generateCandidateCode() {
    const year = new Date().getFullYear();
    const [rows] = await pool.query(`SELECT id, app_no FROM candidates`);

    if (!rows || rows.length === 0) {
      return {
        appNo: `BSC-${year}-0001`
      };
    }

    let maxNum = 0;
    const existing = new Set();

    for (const r of rows) {
      if (!r.app_no) continue;
      existing.add(r.app_no);

      const matches = r.app_no.match(/\d+/g);
      if (matches && matches.length > 0) {
        const lastNum = parseInt(matches[matches.length - 1], 10);
        if (!isNaN(lastNum) && lastNum > maxNum) {
          maxNum = lastNum;
        }
      }
    }

    let nextNum = maxNum > 0 ? maxNum + 1 : 1;
    let candidateCode = `BSC-${year}-${String(nextNum).padStart(4, '0')}`;

    while (existing.has(candidateCode)) {
      nextNum++;
      candidateCode = `BSC-${year}-${String(nextNum).padStart(4, '0')}`;
    }

    return {
      appNo: candidateCode
    };
  }

  async getCandidates(filters = {}) {
    const { 
      status, desig, source, gender, cityState, 
      minSalary, maxSalary, minExp, maxExp,
      fromDate, toDate, q, page = 1, limit = 500, sortDir = 'asc' 
    } = filters;

    let query = `SELECT * FROM candidates WHERE 1=1`;
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
      query += ` AND LOWER(city_state) LIKE ?`;
      params.push(`%${cityState.toLowerCase()}%`);
    }
    if (minSalary) {
      query += ` AND expected_salary >= ?`;
      params.push(parseFloat(minSalary));
    }
    if (maxSalary) {
      query += ` AND expected_salary <= ?`;
      params.push(parseFloat(maxSalary));
    }
    if (fromDate) {
      query += ` AND created_at >= ?`;
      params.push(new Date(fromDate));
    }
    if (toDate) {
      query += ` AND created_at <= ?`;
      params.push(new Date(new Date(toDate).setHours(23, 59, 59)));
    }
    if (q) {
      query += ` AND (LOWER(name) LIKE ? OR LOWER(app_no) LIKE ? OR phone LIKE ? OR LOWER(email) LIKE ?)`;
      const term = `%${q.toLowerCase()}%`;
      params.push(term, term, term, term);
    }

    const order = sortDir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY created_at ${order}`;

    const [allRows] = await pool.query(query, params);
    const total = allRows.length;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = allRows.slice(startIndex, startIndex + limitNum);

    const candidates = paginated.map((r) => {
      const initials = r.name
        ? r.name
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0] || '')
            .join('')
            .toUpperCase()
        : 'C';

      const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];
      const colorIndex = ((r.name ? r.name.charCodeAt(0) : 0) + (r.name ? r.name.charCodeAt(1) || 0 : 0)) % colors.length;

      const createdDate = new Date(r.created_at);
      const daysIn = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000));

      return {
        id: r.id,
        candidateCode: r.app_no,
        appNo: r.app_no,
        name: r.name,
        initials,
        color: colors[colorIndex],
        phone: r.phone,
        email: r.email || '',
        dob: r.dob ? new Date(r.dob).toISOString().split('T')[0] : '',
        gender: r.gender || '',
        cityState: r.city_state || '',
        address: r.address || '',
        desig: r.designation,
        occupation: r.occupation || '',
        qualification: r.qualification || '',
        experience: r.experience || '',
        currentSalary: r.current_salary || '',
        salary: r.salary || (r.expected_salary ? r.expected_salary.toString() : ''),
        expectedSalary: r.expected_salary,
        noticePeriod: r.notice_period || '',
        ownVehicle: r.own_vehicle || 'No',
        source: r.source,
        referrer: r.referrer || '',
        referrerEmpNo: r.referrer_emp_no || '',
        sourceDetail: r.source_detail || '',
        date: createdDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        rawDate: createdDate.getTime(),
        status: r.status,
        daysIn,
        resumeUrl: r.resume_url || '',
        bloodGroup: r.blood_group || '',
        offeredDoj: r.offered_doj ? new Date(r.offered_doj).toISOString().split('T')[0] : '',
        retailExperience: r.retail_experience || '',
        previousCompany: r.previous_company || '',
        previousDesignation: r.previous_designation || '',
        aadhaarNumber: r.aadhaar_number || '',
        fatherDetails: r.father_details || '',
        motherDetails: r.mother_details || '',
        religionCaste: r.religion_caste || '',
        religion: r.religion || '',
        caste: r.caste || '',
        languagesKnown: r.languages_known ? JSON.parse(r.languages_known) : [],
        photoUrl: r.photo_url || '',
        aadharUrl: r.aadhaar_url || '',
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
    let appNo = data.appNo;
    if (!appNo) {
      const codes = await this.generateCandidateCode();
      appNo = codes.appNo;
    } else {
      const [existing] = await pool.query(`SELECT id FROM candidates WHERE app_no = ?`, [appNo]);
      if (existing.length > 0) {
        const codes = await this.generateCandidateCode();
        appNo = codes.appNo;
      }
    }

    const [res] = await pool.query(
      `INSERT INTO candidates (
        app_no, name, phone, email, dob, gender, city_state, address, designation,
        occupation, qualification, experience, current_salary, expected_salary,
        notice_period, own_vehicle, source, referrer, referrer_emp_no, source_detail,
        q1, q2, q3, q4, status, salary, remarks, is_duplicate_phone, resume_url,
        blood_group, offered_doj, retail_experience, previous_company, previous_designation,
        aadhaar_number, father_details, mother_details, religion_caste, religion, caste, languages_known,
        photo_url, aadhaar_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
        data.previousSalary || data.currentSalary || null,
        data.expectedSalary || data.salary || null,
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
        data.isDuplicatePhone || 'No',
        data.resumeUrl || null,
        data.bloodGroup || null,
        data.offeredDoj || null,
        data.retailExperience || null,
        data.previousCompany || null,
        data.previousDesignation || null,
        data.aadhaarNumber || null,
        data.fatherDetails || null,
        data.motherDetails || null,
        data.religionCaste || null,
        data.religion || null,
        data.caste || null,
        data.languagesKnown ? JSON.stringify(data.languagesKnown) : null,
        data.photoUrl || null,
        data.aadhaarUrl || null
      ]
    );

    const candidateId = res.insertId;

    await pool.query(
      `INSERT INTO candidate_activities (candidate_id, app_no, action_type, icon, label, by_user, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [candidateId, appNo, 'applied', '📋', 'Candidate Registered', 'Public', 'navy']
    );

    return { success: true, appNo, candidateId };
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
      fields.push('resume_url = ?');
      values.push(updates.resumeUrl);
    }

    if (fields.length > 0) {
      values.push(appNo);
      await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE app_no = ?`, values);
    }

    const [cand] = await pool.query(`SELECT id FROM candidates WHERE app_no = ?`, [appNo]);
    if (cand.length > 0) {
      await pool.query(
        `INSERT INTO candidate_activities (candidate_id, app_no, action_type, icon, label, remarks, by_user, color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cand[0].id, appNo, 'status_change', '📝', `Status changed to ${updates.status || 'Updated'}`, updates.remarks || '', doneBy, 'gold']
      );
    }

    return { success: true };
  }

  async updateCandidateFull(appNo, data, doneBy = 'HR') {
    const fields = [];
    const values = [];
    const allowed = ['name','email','phone','address','gender','blood_group','dob','offered_doj','designation','qualification','experience','retail_experience','previous_company','previous_designation','aadhaar_number','father_details','mother_details','religion_caste','languages_known', 'resume_url', 'photo_url', 'aadhaar_url', 'current_salary', 'expected_salary'];
    
    const map = {
      blood_group: 'bloodGroup',
      offered_doj: 'offeredDoj',
      designation: 'desig',
      retail_experience: 'retailExperience',
      previous_company: 'previousCompany',
      previous_designation: 'previousDesignation',
      aadhaar_number: 'aadhaarNumber',
      father_details: 'fatherDetails',
      mother_details: 'motherDetails',
      religion_caste: 'religionCaste',
      languages_known: 'languagesKnown',
      resume_url: 'resumeUrl',
      photo_url: 'photoUrl',
      aadhaar_url: 'aadhaarUrl',
      current_salary: 'previousSalary',
      expected_salary: 'expectedSalary'
    };

    for (const key of allowed) {
      const dataKey = map[key] || key;
      if (data[dataKey] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(Array.isArray(data[dataKey]) ? JSON.stringify(data[dataKey]) : data[dataKey]);
      }
    }

    if (fields.length > 0) {
      values.push(appNo);
      await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE app_no = ?`, values);
    }

    return { success: true };
  }

  async deleteCandidate(appNo) {
    // Delete from candidates and all related tables
    const tables = [
      'candidates',
      'selection_offers',
      'selected_candidates',
      'rejected_candidates',
      'candidate_activities',
      'interview_schedules',
      'hr_evaluations',
      'interview_tokens',
      'onboarding_records'
    ];
    for (const t of tables) {
      try {
        await pool.query(`DELETE FROM \`${t}\` WHERE app_no = ?`, [appNo]);
      } catch (e) {}
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
        `SELECT app_no, name, created_at FROM candidates WHERE REPLACE(phone, ' ', '') LIKE ?`,
        [`%${cleanPhone.slice(-10)}%`]
      );
      if (rows.length > 0) {
        exists = true;
        name = rows[0].name;
        appNo = rows[0].app_no;
        appliedOn = new Date(rows[0].created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    if (!exists && email) {
      const [rows] = await pool.query(
        `SELECT app_no, name, created_at FROM candidates WHERE LOWER(email) = LOWER(?)`,
        [email.trim()]
      );
      if (rows.length > 0) {
        exists = true;
        name = rows[0].name;
        appNo = rows[0].app_no;
        appliedOn = new Date(rows[0].created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    return { exists, name, appNo, appliedOn };
  }

  async addDocument(candidateId, docType, fileName, filePath, fileSize, fileExt, userId) {
    // Left empty or we can just return success as we don't have candidate_documents table in dbInitializer yet.
    return { id: 1, filePath };
  }

  async getCandidateDocuments(candidateId) {
    return [];
  }

  async getKPIs() {
    const [candRows] = await pool.query(`SELECT status, created_at FROM candidates`);
    const total = candRows.length;

    const todayStr = new Date().toDateString();
    const todayCandidates = candRows.filter(r => new Date(r.created_at).toDateString() === todayStr).length;
    const pendingReview = candRows.filter(r => r.status === 'New').length;
    const shortlisted = candRows.filter((r) =>
      ['Shortlisted', '1st Call Done', '2nd Call Done', 'Interview Scheduled', 'Interviewed'].includes(r.status)
    ).length;
    const selected = candRows.filter((r) => r.status === 'Selected').length;
    const joined = candRows.filter((r) => r.status === 'Joined').length;
    const offerAccepted = candRows.filter((r) => r.status === 'Offer Accepted').length;
    const rejected = candRows.filter((r) => r.status === 'Rejected').length;
    const hold = candRows.filter((r) => r.status === 'Hold').length;

    const [offerRows] = await pool.query(`SELECT status FROM selection_offers`);
    const offerPending = offerRows.filter(r => r.status === 'Pending').length;
    const acceptedOffers = offerRows.filter((r) => r.status === 'Accepted').length;
    const offerDeclined = offerRows.filter(r => r.status === 'Rejected').length;
    const acceptanceRate = offerRows.length > 0 ? Math.round((acceptedOffers / offerRows.length) * 100) : 0;

    const [schedRows] = await pool.query(`SELECT interview_date FROM interview_schedules WHERE interview_date IS NOT NULL`);
    const interviewsToday = schedRows.filter((r) => new Date(r.interview_date).toDateString() === todayStr).length;

    const [obRows] = await pool.query(`SELECT status FROM onboarding_records`);
    const completedOnboarding = obRows.filter(r => r.status === 'Completed').length;

    const exitPending = 0; // Deprecated
    const completedExit = 0; // Deprecated

    const [empRows] = await pool.query(`SELECT id FROM users WHERE active = TRUE`);
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
    const [acts] = await pool.query(`SELECT * FROM candidate_activities WHERE app_no = ? ORDER BY created_at ASC`, [appNo]);
    const activity = acts.map((a) => ({
      type: a.action_type,
      icon: a.icon || '📋',
      label: a.label,
      score: 0,
      maxScore: 100,
      remarks: a.remarks || '',
      assignedBy: '',
      by: a.by_user || '',
      date: new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      color: a.color || 'navy'
    }));

    return { success: true, activity };
  }

  async getPendingActions() {
    try {
      const [rows] = await pool.query(
        `SELECT app_no, name, designation as desig, status, created_at 
         FROM candidates 
         WHERE status IN ('New', 'Shortlisted', '1st Call Done', '2nd Call Done', 'Interview Scheduled')
         ORDER BY created_at DESC LIMIT 10`
      );
      const actions = rows.map(r => ({
        appNo: r.app_no,
        candidate: r.name,
        desig: r.desig,
        actionNeeded: r.status === 'New' ? 'Screen Candidate' : r.status === 'Interview Scheduled' ? 'Conduct Interview' : 'Follow-up Call',
        badgeColor: r.status === 'New' ? 'amber' : 'navy',
        urgency: 'High'
      }));
      return { actions };
    } catch (err) {
      return { actions: [] };
    }
  }

  async getSourceBreakdown() {
    try {
      const [rows] = await pool.query(
        `SELECT source, COUNT(*) as cnt FROM candidates GROUP BY source`
      );
      const breakdown = rows.map(r => ({
        source: r.source || 'Other',
        count: r.cnt
      }));
      return { breakdown };
    } catch (err) {
      return { breakdown: [] };
    }
  }
}

module.exports = new CandidateService();
