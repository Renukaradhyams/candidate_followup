const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const { formatISTDate, getISTDateRange, isDateInRange, getBusinessDate } = require('../utils/dateUtils');
const { normalizeDepartment, normalizeDesignation } = require('../utils/normalization');

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
      fromDate, toDate, q, page = 1, limit = 50000, sortDir = 'desc' 
    } = filters;

    // Auto-synchronize candidate status to 'Joined' if offer status is 'Joined' and candidate not in store joined status
    try {
      await pool.query(`
        UPDATE candidates c
        JOIN selection_offers so ON c.app_no = so.app_no
        SET c.status = 'Joined'
        WHERE LOWER(TRIM(so.status)) = 'joined' 
          AND LOWER(TRIM(c.status)) NOT IN ('joined', 'successfully joined store', 'joined store')
          AND LOWER(TRIM(c.status)) NOT LIKE '%joined store%'
      `);
      await pool.query(`
        UPDATE selection_offers so
        JOIN candidates c ON TRIM(so.app_no) = TRIM(c.app_no)
        SET so.status = c.status
        WHERE LOWER(TRIM(c.status)) IN ('successfully joined store', 'joined store')
          AND LOWER(TRIM(so.status)) != LOWER(TRIM(c.status))
      `);
    } catch (e) {}

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS employees (
          id INT AUTO_INCREMENT PRIMARY KEY,
          employee_id VARCHAR(100) NULL UNIQUE,
          app_no VARCHAR(50) NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(150) NULL,
          phone VARCHAR(20) NULL,
          department VARCHAR(150) NULL,
          designation VARCHAR(150) NULL,
          section VARCHAR(150) NULL,
          branch VARCHAR(150) NULL,
          status VARCHAR(50) DEFAULT 'Joined',
          joining_date DATE NULL,
          salary DECIMAL(10,2) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (e) {}

    let query = `
      SELECT c.*, 
             so.status as offer_status,
             emp.id as employee_id
      FROM candidates c 
      LEFT JOIN selection_offers so ON c.app_no = so.app_no 
      LEFT JOIN employees emp ON (c.app_no = emp.app_no OR (c.phone IS NOT NULL AND c.phone != '' AND c.phone = emp.phone))
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND (LOWER(c.status) = LOWER(?) OR LOWER(so.status) = LOWER(?))`;
      params.push(status, status);
    }
    if (desig) {
      query += ` AND c.designation = ?`;
      params.push(desig);
    }
    if (source) {
      query += ` AND c.source = ?`;
      params.push(source);
    }
    if (gender) {
      query += ` AND LOWER(c.gender) = LOWER(?)`;
      params.push(gender);
    }
    if (cityState) {
      query += ` AND LOWER(c.city_state) LIKE ?`;
      params.push(`%${cityState.toLowerCase()}%`);
    }
    if (minSalary) {
      query += ` AND c.expected_salary >= ?`;
      params.push(parseFloat(minSalary));
    }
    if (maxSalary) {
      query += ` AND c.expected_salary <= ?`;
      params.push(parseFloat(maxSalary));
    }
    if (fromDate) {
      query += ` AND c.created_at >= ?`;
      params.push(new Date(fromDate));
    }
    if (toDate) {
      query += ` AND c.created_at <= ?`;
      params.push(new Date(new Date(toDate).setHours(23, 59, 59)));
    }
    if (q) {
      query += ` AND (LOWER(c.name) LIKE ? OR LOWER(c.app_no) LIKE ? OR c.phone LIKE ? OR LOWER(c.email) LIKE ?)`;
      const term = `%${q.toLowerCase()}%`;
      params.push(term, term, term, term);
    }
    if (filters.appNo) {
      query += ` AND c.app_no = ?`;
      params.push(filters.appNo);
    }

    const order = sortDir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY c.created_at ${order}`;

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
      
      const isEmp = Boolean(r.employee_id);
      const osLower = (r.offer_status || '').toLowerCase().trim();
      const csLower = (r.status || '').toLowerCase().trim();

      let computedStatus = r.status;
      if (isEmp || osLower === 'joined' || osLower === 'accepted' || csLower === 'joined' || csLower === 'hired' || csLower === 'already selected') {
        computedStatus = 'Already Selected';
      } else if (csLower === 'selected') {
        computedStatus = 'Already Selected';
      }

      return {
        id: r.id,
        candidateCode: r.app_no,
        appNo: r.app_no,
        name: r.name,
        initials,
        color: colors[colorIndex],
        phone: r.phone,
        email: r.email || '',
        dob: (r.dob && !isNaN(new Date(r.dob).getTime())) ? new Date(r.dob).toISOString().split('T')[0] : '',
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
        status: computedStatus,
        daysIn,
        resumeUrl: r.resume_url || '',
        bloodGroup: r.blood_group || '',
        offeredDoj: (r.offered_doj && !isNaN(new Date(r.offered_doj).getTime())) ? new Date(r.offered_doj).toISOString().split('T')[0] : '',
        retailExperience: r.retail_experience || '',
        previousCompany: r.previous_company || '',
        previousDesignation: r.previous_designation || '',
        aadhaarNumber: r.aadhaar_number || '',
        fatherDetails: r.father_details || '',
        motherDetails: r.mother_details || '',
        religionCaste: r.religion_caste || '',
        religion: r.religion || '',
        caste: r.caste || '',
        languagesKnown: (() => { try { return r.languages_known ? JSON.parse(r.languages_known) : []; } catch(e) { return typeof r.languages_known === 'string' ? r.languages_known.split(',') : []; } })(),
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
    if (data.department) data.department = normalizeDepartment(data.department);
    if (data.designation) data.designation = normalizeDesignation(data.designation);
    if (data.desig) data.desig = normalizeDesignation(data.desig);
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
    if (updates.greythrReady !== undefined) {
      fields.push('greythr_ready = ?');
      const isReady = updates.greythrReady === true || updates.greythrReady === 1 || updates.greythrReady === '1' || String(updates.greythrReady).toLowerCase() === 'true';
      values.push(isReady ? 1 : 0);
    }
    if (updates.greythrSynced !== undefined) {
      fields.push('greythr_synced = ?');
      const isSynced = updates.greythrSynced === true || updates.greythrSynced === 1 || updates.greythrSynced === '1' || String(updates.greythrSynced).toLowerCase() === 'true';
      values.push(isSynced ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(appNo);
      await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE app_no = ?`, values);
    }

    if (updates.status) {
      try {
        await pool.query(`UPDATE selection_offers SET status = ?, updated_at = NOW() WHERE app_no = ?`, [updates.status, appNo]);
      } catch (e) {}
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
    const allowed = [
      'name','email','phone','address','gender','blood_group','dob','offered_doj','designation',
      'department','section','branch','reporting_manager','remarks','qualification','experience',
      'retail_experience','previous_company','previous_designation','aadhaar_number','father_details',
      'mother_details','religion_caste','religion','caste','languages_known','resume_url','photo_url',
      'aadhaar_url','current_salary','expected_salary','salary','status','pan_number','bank_name',
      'bank_account_no','bank_ifsc','uan_number','esi_number','marital_status','emergency_contact',
      'emergency_phone','permanent_address','documents_checklist_json','greythr_synced','greythr_ready'
    ];
    
    const map = {
      blood_group: 'bloodGroup',
      offered_doj: 'offeredDoj',
      designation: 'desig',
      reporting_manager: 'reportingManager',
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
      expected_salary: 'expectedSalary',
      pan_number: 'panNumber',
      bank_name: 'bankName',
      bank_account_no: 'bankAccountNo',
      bank_ifsc: 'bankIfsc',
      uan_number: 'uanNumber',
      esi_number: 'esiNumber',
      marital_status: 'maritalStatus',
      emergency_contact: 'emergencyContact',
      emergency_phone: 'emergencyPhone',
      permanent_address: 'permanentAddress',
      documents_checklist_json: 'documentsChecklist',
      greythr_synced: 'greythrSynced',
      greythr_ready: 'greythrReady'
    };

    for (const key of allowed) {
      const dataKey = map[key] || key;
      if (data[dataKey] !== undefined) {
        fields.push(`${key} = ?`);
        const v = data[dataKey];
        if (key === 'greythr_ready' || key === 'greythr_synced') {
          const isTrue = v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
          values.push(isTrue ? 1 : 0);
        } else {
          // Always serialize arrays and plain objects to JSON string for MySQL TEXT/JSON columns
          const shouldSerialize = Array.isArray(v) || (v !== null && typeof v === 'object');
          values.push(shouldSerialize ? JSON.stringify(v) : v);
        }
      }
    }

    if (fields.length > 0) {
      values.push(appNo);
      try {
        await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE app_no = ?`, values);
      } catch (err) {
        // If unknown column error on live production DB, automatically add missing column and retry
        if (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && err.message.includes('Unknown column'))) {
          try {
            const match = (err.message || '').match(/Unknown column '([^']+)'/) || (err.sqlMessage || '').match(/Unknown column '([^']+)'/);
            const missingCol = match ? match[1] : null;
            if (missingCol) {
              const colType = (missingCol.includes('json') || missingCol.includes('address')) ? 'TEXT' 
                            : (missingCol.includes('ready') || missingCol.includes('synced')) ? 'TINYINT(1) DEFAULT 0'
                            : 'VARCHAR(150)';
              await pool.query(`ALTER TABLE candidates ADD COLUMN \`${missingCol}\` ${colType} NULL`);
              await pool.query(`UPDATE candidates SET ${fields.join(', ')} WHERE app_no = ?`, values);
            } else {
              throw err;
            }
          } catch (e2) {
            console.error('[Candidate Update Auto-Recovery Error]', e2.message);
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    // Also sync selection_offers table if existing
    if (data.department || data.desig || data.status || data.remarks || data.offeredDoj || data.salary || data.noticePeriod) {
      try {
        await pool.query(
          `UPDATE selection_offers SET department = COALESCE(?, department), designation = COALESCE(?, designation), status = COALESCE(?, status), remarks = COALESCE(?, remarks), est_doj = COALESCE(?, est_doj), salary = COALESCE(?, salary), notice_period = COALESCE(?, notice_period), updated_at = NOW() WHERE app_no = ?`,
          [data.department || null, data.desig || null, data.status || null, data.remarks || null, data.offeredDoj || null, data.salary || null, data.noticePeriod || null, appNo]
        );
      } catch (e) {
        try {
          await pool.query(
            `UPDATE selection_offers SET department = COALESCE(?, department), designation = COALESCE(?, designation), status = COALESCE(?, status), remarks = COALESCE(?, remarks), est_doj = COALESCE(?, est_doj), updated_at = NOW() WHERE app_no = ?`,
            [data.department || null, data.desig || null, data.status || null, data.remarks || null, data.offeredDoj || null, appNo]
          );
        } catch (e2) {}
      }
    }

    // Also sync section_allocations table if section is provided
    if (data.section !== undefined) {
      try {
        const [cand] = await pool.query('SELECT id, name, department, designation FROM candidates WHERE app_no = ?', [appNo]);
        if (cand && cand.length > 0) {
          await pool.query(
            `INSERT INTO section_allocations (candidate_id, employee_id, app_no, candidate_name, department, designation, section, allocated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE section = VALUES(section), department = VALUES(department), designation = VALUES(designation), updated_at = NOW()`,
            [cand[0].id, cand[0].id, appNo, cand[0].name, data.department || cand[0].department, data.desig || cand[0].designation, data.section, doneBy]
          );
        }
      } catch (e) {}
    }

    return { success: true };
  }

  async deleteCandidate(appNo, userContext = {}) {
    if (!appNo) return { success: false, error: 'App Number is required' };

    // 1. Fetch candidate information & file URLs before DB deletion for audit logging
    let candidateInfo = null;
    let fileUrls = [];
    try {
      const [rows] = await pool.query(`SELECT app_no, name, phone, designation, status, created_at, resume_url, photo_url, aadhaar_url FROM candidates WHERE app_no = ?`, [appNo]);
      if (rows && rows.length > 0) {
        candidateInfo = rows[0];
        fileUrls = [rows[0].resume_url, rows[0].photo_url, rows[0].aadhaar_url].filter(Boolean);
      }
    } catch (e) {
      console.warn(`[DeleteCandidate] Could not fetch candidate info for ${appNo}:`, e.message);
    }

    // Record Deletion Audit Log BEFORE purging DB rows
    try {
      const username = userContext.username || userContext.user || 'System User';
      const userRole = userContext.userRole || userContext.role || 'Admin';
      const userPhone = userContext.userPhone || userContext.phone || '';
      const ipAddress = userContext.ipAddress || userContext.ip || '';
      const deviceInfo = userContext.deviceInfo || userContext.userAgent || '';
      
      const candidateName = candidateInfo ? candidateInfo.name : 'Unknown Candidate';
      const candidatePhone = candidateInfo ? candidateInfo.phone : '';

      const detailsObj = {
        candidate: {
          app_no: appNo,
          name: candidateName,
          phone: candidatePhone,
          designation: candidateInfo ? candidateInfo.designation : '',
          status: candidateInfo ? candidateInfo.status : ''
        },
        deletedBy: {
          username,
          userRole,
          userPhone,
          ipAddress,
          deviceInfo
        },
        deletedAt: new Date().toISOString()
      };

      await pool.query(
        `INSERT INTO audit_logs (
          username, user_role, user_phone, candidate_app_no, candidate_name, candidate_phone,
          action, module, details, ip_address, device_info
        ) VALUES (?, ?, ?, ?, ?, ?, 'DELETE_CANDIDATE', 'Candidates', ?, ?, ?)`,
        [
          username,
          userRole,
          userPhone,
          appNo,
          candidateName,
          candidatePhone,
          JSON.stringify(detailsObj),
          ipAddress,
          deviceInfo
        ]
      );
    } catch (auditErr) {
      console.error(`[DeleteCandidate] Failed to insert audit log for ${appNo}:`, auditErr.message);
    }

    // 2. Perform DB deletion in a transaction
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const tables = [
        'candidates',
        'selection_offers',
        'selected_candidates',
        'rejected_candidates',
        'candidate_activities',
        'interview_schedules',
        'hr_evaluations',
        'interview_tokens'
      ];
      for (const t of tables) {
        await conn.query(`DELETE FROM \`${t}\` WHERE app_no = ?`, [appNo]);
      }

      // Handle onboarding_records separately because it uses record_id instead of app_no
      await conn.query(`DELETE FROM \`onboarding_records\` WHERE record_id = ?`, [appNo]);

      await conn.commit();
    } catch (dbError) {
      await conn.rollback();
      throw dbError;
    } finally {
      conn.release();
    }

    // 3. Physical file & folder cleanup AFTER successful DB commit
    try {
      let uploadDir = process.env.UPLOAD_DIR;
      if (!uploadDir) {
        uploadDir = path.join(__dirname, '../../../uploads');
        if (!fs.existsSync(uploadDir)) {
          uploadDir = path.join(__dirname, '../../uploads');
        }
      }

      // 3a. Delete dedicated applicant directory: uploads/applicants/BSC-2026-0001
      const applicantFolder = path.join(uploadDir, 'applicants', appNo);
      if (fs.existsSync(applicantFolder)) {
        fs.rmSync(applicantFolder, { recursive: true, force: true });
        console.log(`[DeleteCandidate] Successfully removed applicant directory: ${applicantFolder}`);
      }

      // 3b. Delete any legacy flat files linked in DB columns
      for (const rawUrl of fileUrls) {
        if (!rawUrl || typeof rawUrl !== 'string') continue;
        const cleanPath = rawUrl.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
        const targetPath = path.join(uploadDir, cleanPath);
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
          console.log(`[DeleteCandidate] Deleted file: ${targetPath}`);
        }
      }
    } catch (fsError) {
      console.warn(`[DeleteCandidate] File cleanup notice for ${appNo}:`, fsError.message);
    }

    return { success: true };
  }

  async getDeletionLogs(limit = 200) {
    try {
      const [rows] = await pool.query(
        `SELECT id, username, user_role, user_phone, candidate_app_no, candidate_name, candidate_phone, action, module, details, ip_address, device_info, created_at 
         FROM audit_logs 
         WHERE action = 'DELETE_CANDIDATE' 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [parseInt(limit, 10) || 200]
      );

      const logs = rows.map(r => {
        let parsedDetails = {};
        try {
          if (r.details) parsedDetails = JSON.parse(r.details);
        } catch (e) {}

        return {
          id: r.id,
          username: r.username || parsedDetails?.deletedBy?.username || 'Unknown User',
          userRole: r.user_role || parsedDetails?.deletedBy?.userRole || 'Admin',
          userPhone: r.user_phone || parsedDetails?.deletedBy?.userPhone || '',
          candidateAppNo: r.candidate_app_no || parsedDetails?.candidate?.app_no || 'N/A',
          candidateName: r.candidate_name || parsedDetails?.candidate?.name || 'Unknown Candidate',
          candidatePhone: r.candidate_phone || parsedDetails?.candidate?.phone || '',
          ipAddress: r.ip_address || parsedDetails?.deletedBy?.ipAddress || 'N/A',
          deviceInfo: r.device_info || parsedDetails?.deletedBy?.deviceInfo || 'N/A',
          createdAt: r.created_at
        };
      });

      return { success: true, logs };
    } catch (err) {
      console.error('[getDeletionLogs ERROR]:', err.message);
      return { success: false, logs: [], error: err.message };
    }
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

  async getKPIs(range, fromDate, toDate) {
    try {
      const todayStr = new Date().toDateString();

      // Auto-synchronize candidate status to Joined for any candidates marked Joined in selection_offers (if not already joined store)
      try {
        await pool.query(`
          UPDATE candidates c
          JOIN selection_offers so ON c.app_no = so.app_no
          SET c.status = 'Joined'
          WHERE LOWER(TRIM(so.status)) = 'joined' 
            AND LOWER(TRIM(c.status)) NOT IN ('joined', 'successfully joined store', 'joined store')
            AND LOWER(TRIM(c.status)) NOT LIKE '%joined store%'
        `);
        await pool.query(`
          UPDATE selection_offers so
          JOIN candidates c ON TRIM(so.app_no) = TRIM(c.app_no)
          SET so.status = c.status
          WHERE LOWER(TRIM(c.status)) IN ('successfully joined store', 'joined store')
            AND LOWER(TRIM(so.status)) != LOWER(TRIM(c.status))
        `);
      } catch (e) {}

      const [candRows] = await pool.query(`
        SELECT c.id, c.app_no, c.gender, c.status, c.created_at, c.updated_at, so.actual_doj, so.status as offer_status
        FROM candidates c
        LEFT JOIN selection_offers so ON c.app_no = so.app_no
      `);

      const filteredRows = candRows.filter(r => isDateInRange(getBusinessDate(r, 'CRM'), range, fromDate, toDate));

      // 1. Total Pipeline = Total registered candidates in selected range (created_at)
      const total = filteredRows.length;
      const totalCandidatesAll = candRows.length;

      let offerRows = [];
      try {
        const [oRows] = await pool.query(`SELECT app_no, status, created_at, actual_doj FROM selection_offers`);
        offerRows = oRows || [];
      } catch (e) {}

      let selectedCandRows = [];
      try {
        const [scRows] = await pool.query(`SELECT app_no, candidate_id FROM selected_candidates`);
        selectedCandRows = scRows || [];
      } catch (e) {}

      const offerAppNos = new Set(offerRows.map(o => o.app_no).filter(Boolean));
      const selectedAppNos = new Set(selectedCandRows.map(sc => sc.app_no).filter(Boolean));

      // 2. Shortlisted = Candidates in Offer Desk OR selected_candidates OR in shortlisted/interviewed/selected/joined stages
      const shortlisted = filteredRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const isInOfferDesk = r.app_no && offerAppNos.has(r.app_no);
        const isInSelected = r.app_no && selectedAppNos.has(r.app_no);
        const isShortlistedStatus = [
          'shortlisted', '1st call done', '2nd call done', 'interview scheduled', 
          'interviewed', 'selected', 'offer accepted', 'joined', 'hired'
        ].includes(s);
        return isInOfferDesk || isInSelected || isShortlistedStatus;
      }).length;

      // 3. Selected Pool = Candidates marked Selected OR present in selection_offers OR present in selected_candidates
      const selected = filteredRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const isInOfferDesk = r.app_no && offerAppNos.has(r.app_no);
        const isInSelected = r.app_no && selectedAppNos.has(r.app_no);
        return s === 'selected' || s === 'shortlisted' || isInOfferDesk || isInSelected;
      }).length;

      // 4. Joined Staff = Employees in Employee Directory (status = Joined or Hired)
      // For date filtering: uses actual joining date (actual_doj / updated_at / created_at)
      const joined = candRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const os = (r.offer_status || '').toLowerCase().trim();
        const isJoined = ['joined', 'hired', 'successfully joined store', 'joined store'].includes(s) || ['joined', 'successfully joined store', 'joined store'].includes(os);
        if (!isJoined) return false;
        return isDateInRange(getBusinessDate(r, 'JOINED'), range, fromDate, toDate);
      }).length;

      // 5. Acceptance Rate = (Shortlisted / Total Registered Candidates) * 100
      const acceptanceRate = total > 0 ? Math.round((shortlisted / total) * 100) : 0;

      // 6. Awaiting Joining = Candidates inside Offer Desk whose status is Pending Accept, Pending, Accepted, Offer Sent, etc. (not Joined or Rejected)
      const awaitingJoining = offerRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        if (!s) return true;
        const isNotJoinedOrRejected = !['joined', 'hired', 'rejected', 'declined', 'withdrawn', 'cancelled'].includes(s);
        return isNotJoinedOrRejected;
      }).length;

      // 7. Interviews Today = Show interviews scheduled for today only
      let interviewsToday = 0;
      try {
        const [schedRows] = await pool.query(`SELECT interview_date FROM interview_schedules WHERE interview_date IS NOT NULL`);
        interviewsToday = (schedRows || []).filter(r => isDateInRange(getBusinessDate(r, 'INTERVIEW'), 'today')).length;
      } catch (e) {}

      // 9. Drop-off Metrics: Rejected & Hold
      const rejected = filteredRows.filter(r => (r.status || '').toLowerCase().trim() === 'rejected').length;
      const hold = filteredRows.filter(r => (r.status || '').toLowerCase().trim() === 'hold').length;

      let activeEmployees = 0;
      try {
        const [empRows] = await pool.query(`SELECT id FROM users WHERE active = TRUE`);
        activeEmployees = (empRows || []).length;
      } catch (e) {}

      const pendingReview = filteredRows.filter(r => (r.status || '').toLowerCase().trim() === 'new').length;
      const todayCandidates = candRows.filter(r => r.created_at && new Date(r.created_at).toDateString() === todayStr).length;

      // Gender Breakdown: Girls / Female and Mens / Male
      const femaleRegistered = filteredRows.filter(r => {
        const g = (r.gender || '').toLowerCase().trim();
        return ['f', 'female', 'girl', 'women', 'woman'].includes(g);
      }).length;

      const femaleJoined = candRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const os = (r.offer_status || '').toLowerCase().trim();
        const isJoined = ['joined', 'hired', 'successfully joined store', 'joined store'].includes(s) || ['joined', 'successfully joined store', 'joined store'].includes(os);
        if (!isJoined) return false;
        const g = (r.gender || '').toLowerCase().trim();
        const isFemale = ['f', 'female', 'girl', 'women', 'woman'].includes(g);
        if (!isFemale) return false;
        return isDateInRange(getBusinessDate(r, 'JOINED'), range, fromDate, toDate);
      }).length;

      const maleRegistered = filteredRows.filter(r => {
        const g = (r.gender || '').toLowerCase().trim();
        return ['m', 'male', 'boy', 'men', 'man'].includes(g);
      }).length;

      const maleJoined = candRows.filter(r => {
        const s = (r.status || '').toLowerCase().trim();
        const os = (r.offer_status || '').toLowerCase().trim();
        const isJoined = ['joined', 'hired', 'successfully joined store', 'joined store'].includes(s) || ['joined', 'successfully joined store', 'joined store'].includes(os);
        if (!isJoined) return false;
        const g = (r.gender || '').toLowerCase().trim();
        const isMale = ['m', 'male', 'boy', 'men', 'man'].includes(g);
        if (!isMale) return false;
        return isDateInRange(getBusinessDate(r, 'JOINED'), range, fromDate, toDate);
      }).length;

      // Date-wise breakdown map
      const dailyMap = {};
      filteredRows.forEach(r => {
        if (!r.created_at) return;
        const d = new Date(r.created_at);
        if (isNaN(d.getTime())) return;

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;

        if (!dailyMap[dateKey]) {
          const formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          dailyMap[dateKey] = {
            date: dateKey,
            formattedDate,
            rawTimestamp: new Date(yyyy, d.getMonth(), d.getDate()).getTime(),
            total: 0,
            shortlisted: 0,
            selected: 0,
            joined: 0,
            rejected: 0,
            hold: 0,
            new: 0
          };
        }

        dailyMap[dateKey].total += 1;
        const s = (r.status || '').toLowerCase().trim();
        const isInOffer = r.app_no && offerAppNos.has(r.app_no);
        if (isInOffer || ['shortlisted', '1st call done', '2nd call done', 'interview scheduled', 'interviewed', 'selected', 'joined', 'hired'].includes(s)) {
          dailyMap[dateKey].shortlisted += 1;
        }
        if (s === 'selected') dailyMap[dateKey].selected += 1;
        if (s === 'joined' || s === 'hired') dailyMap[dateKey].joined += 1;
        if (s === 'rejected') dailyMap[dateKey].rejected += 1;
        if (s === 'hold') dailyMap[dateKey].hold += 1;
        if (s === 'new') dailyMap[dateKey].new += 1;
      });

      const dailyBreakdown = Object.values(dailyMap).sort((a, b) => b.rawTimestamp - a.rawTimestamp);

      return {
        totalCandidates: total,
        totalCandidatesAll,
        todayCandidates,
        pendingReview,
        interviewScheduled: interviewsToday,
        interviewCompleted: shortlisted,
        round1Cleared: shortlisted,
        round2Cleared: selected,
        selected,
        rejected,
        offerPending: awaitingJoining,
        offerAccepted: awaitingJoining,
        offerDeclined: 0,
        joiningPending: awaitingJoining,
        employeesJoined: joined,
        activeEmployees,
        acceptanceRate,
        avgDays: 5,
        total,
        shortlisted,
        joined,
        onboarding: awaitingJoining,
        awaitingJoining,
        interviewsToday,
        newCandidates: pendingReview,
        hold,
        femaleRegistered,
        femaleJoined,
        maleRegistered,
        maleJoined,
        dailyBreakdown
      };
    } catch (err) {
      return {
        totalCandidates: 0,
        todayCandidates: 0,
        pendingReview: 0,
        interviewScheduled: 0,
        interviewCompleted: 0,
        round1Cleared: 0,
        round2Cleared: 0,
        selected: 0,
        rejected: 0,
        offerPending: 0,
        offerAccepted: 0,
        offerDeclined: 0,
        joiningPending: 0,
        employeesJoined: 0,
        exitPending: 0,
        completedExit: 0,
        activeEmployees: 0,
        acceptanceRate: 0,
        avgDays: 0,
        total: 0,
        shortlisted: 0,
        joined: 0,
        onboarding: 0,
        interviewsToday: 0,
        newCandidates: 0,
        hold: 0,
        femaleRegistered: 0,
        femaleJoined: 0,
        maleRegistered: 0,
        maleJoined: 0
      };
    }
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

  async getSystemActivity(limit = 10) {
    const [acts] = await pool.query(`SELECT * FROM candidate_activities ORDER BY created_at DESC LIMIT ?`, [parseInt(limit, 10)]);
    return { success: true, activity: acts };
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
        text: `${r.name || 'Candidate'} (${r.desig || 'General'}) - ${r.status === 'New' ? 'Screening Required' : 'Follow-up Needed'}`,
        desig: r.desig,
        actionNeeded: r.status === 'New' ? 'Screen Candidate' : r.status === 'Interview Scheduled' ? 'Conduct Interview' : 'Follow-up Call',
        badgeColor: r.status === 'New' ? 'amber' : 'navy',
        priority: r.status === 'New' ? 'urgent' : 'normal',
        urgency: 'High'
      }));
      return { actions, items: actions };
    } catch (err) {
      return { actions: [], items: [] };
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

  async bulkAddEmployees(employees, user) {
    let addedCount = 0;
    const errors = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      try {
        const codes = await this.generateCandidateCode();
        const appNo = codes.appNo;
        
        await pool.query(
          `INSERT INTO candidates (
            app_no, name, phone, email, dob, gender, designation, 
            salary, blood_group, religion, caste, religion_caste, 
            status, offered_doj, source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Joined', ?, 'Bulk Import')`,
          [
            appNo,
            emp.Name || 'Unknown Employee',
            emp.Phone || null,
            emp.Email || null,
            emp.DOB ? new Date(emp.DOB).toISOString().split('T')[0] : null,
            emp.Gender || null,
            emp.Designation || null,
            emp.Salary || null,
            emp.BloodGroup || null,
            emp.Religion || null,
            emp.Caste || null,
            (emp.Religion && emp.Caste) ? `${emp.Religion} / ${emp.Caste}` : (emp.Religion || emp.Caste || null),
            emp.DOJ ? new Date(emp.DOJ).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          ]
        );
        
        await this.logActivity(appNo, 'Joined', `Employee bulk imported by ${user}`, user);
        addedCount++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }
    
    return { success: true, addedCount, errors };
  }
}

module.exports = new CandidateService();
