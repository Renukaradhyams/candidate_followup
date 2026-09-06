const path = require('path');
const fs = require('fs');
let bcrypt;
try { bcrypt = require('bcryptjs'); } catch(e) { bcrypt = require('bcrypt'); }

// Log only to console (no file writing to avoid permission issues on Hostinger)
function logDebug(msg, extra = '') {
  const formatted = typeof extra === 'object' ? JSON.stringify(extra).slice(0, 200) : extra;
  console.log(msg, formatted || '');
}

async function autoInitializeDatabase(pool) {
  logDebug('[Auto DB Initializer] autoInitializeDatabase started');
  try {
    const connection = await pool.getConnection();
    logDebug(`[Auto DB Initializer] Checking database schema...`);

    // Check existing tables
    const [tables] = await connection.query(`SHOW TABLES`);
    const tableNames = tables.map(t => Object.values(t)[0]);
    logDebug(`[Auto DB Initializer] Found ${tableNames.length} existing tables:`, tableNames);

    const hasCandidateTable = tableNames.some(t => t.toLowerCase() === 'candidate' || t.toLowerCase() === 'candidates');

    if (!hasCandidateTable || tableNames.length < 5) {
      logDebug(`[Auto DB Initializer] Database tables missing. Running schema migration scripts...`);

      const possibleDbDirs = [
        path.join(__dirname, '../database'),
        path.join(__dirname, '../../database'),
        path.join(process.cwd(), 'hrms-system/database'),
        path.join(process.cwd(), 'database'),
        path.join(__dirname, 'database')
      ];

      let dbDir = possibleDbDirs.find(d => fs.existsSync(path.join(d, 'schema.sql')));
      if (!dbDir) {
        dbDir = possibleDbDirs[0];
      }

      logDebug(`[Auto DB Initializer] Using database SQL directory: ${dbDir}`);

      const sqlFiles = ['schema.sql', 'default_data.sql', 'roles.sql', 'permissions.sql', 'indexes.sql'];

      for (const fileName of sqlFiles) {
        const filePath = path.join(dbDir, fileName);
        if (fs.existsSync(filePath)) {
          logDebug(`[Auto DB Initializer] Executing ${fileName}...`);
          let rawSql = fs.readFileSync(filePath, 'utf8');

          // Strip out CREATE DATABASE and USE statements
          rawSql = rawSql
            .replace(/CREATE DATABASE[\s\S]*?;/gi, '')
            .replace(/USE `?[\w_]+`?;/gi, '');

          // Split statements by semicolon
          const statements = rawSql
            .split(/;\s*$/m)
            .map(s => s.trim())
            .filter(s => s.length > 0);

          for (const stmt of statements) {
            try {
              await connection.query(stmt);
            } catch (err) {
              logDebug(`[Auto DB Initializer Warning on ${fileName}]:`, err.message);
            }
          }
        }
      }
    }

    // Ensure Legacy Table Compatibility Views/Tables exist for smooth operational queries
    const compatibilityScripts = [
      `CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`username\` VARCHAR(100) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`full_name\` VARCHAR(150) NULL,
        \`email\` VARCHAR(150) NULL,
        \`phone\` VARCHAR(20) NULL,
        \`department\` VARCHAR(150) NULL,
        \`designation\` VARCHAR(150) NULL,
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'HR',
        \`active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`candidates\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`app_no\` VARCHAR(50) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`phone\` VARCHAR(20) NOT NULL,
        \`email\` VARCHAR(150) NULL,
        \`dob\` DATE NULL,
        \`gender\` VARCHAR(20) NULL,
        \`city_state\` VARCHAR(150) NULL,
        \`address\` TEXT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`occupation\` VARCHAR(150) NULL,
        \`qualification\` VARCHAR(150) NULL,
        \`experience\` VARCHAR(100) NULL,
        \`current_salary\` VARCHAR(100) NULL,
        \`expected_salary\` VARCHAR(100) NULL,
        \`notice_period\` VARCHAR(50) NULL,
        \`own_vehicle\` VARCHAR(10) DEFAULT 'No',
        \`source\` VARCHAR(100) DEFAULT 'Walk-in',
        \`referrer\` VARCHAR(150) NULL,
        \`referrer_emp_no\` VARCHAR(50) NULL,
        \`source_detail\` VARCHAR(255) NULL,
        \`q1\` TEXT NULL,
        \`q2\` TEXT NULL,
        \`q3\` TEXT NULL,
        \`q4\` TEXT NULL,
        \`status\` VARCHAR(50) DEFAULT 'New',
        \`salary\` VARCHAR(100) NULL,
        \`remarks\` TEXT NULL,
        \`is_duplicate_phone\` VARCHAR(10) DEFAULT 'No',
        \`resume_url\` TEXT NULL,
        \`blood_group\` VARCHAR(20) NULL,
        \`offered_doj\` DATE NULL,
        \`retail_experience\` VARCHAR(150) NULL,
        \`previous_company\` VARCHAR(150) NULL,
        \`previous_designation\` VARCHAR(150) NULL,
        \`aadhaar_number\` VARCHAR(50) NULL,
        \`father_details\` VARCHAR(255) NULL,
        \`mother_details\` VARCHAR(255) NULL,
        \`religion_caste\` VARCHAR(150) NULL,
        \`religion\` VARCHAR(100) NULL,
        \`caste\` VARCHAR(100) NULL,
        \`languages_known\` VARCHAR(255) NULL,
        \`photo_url\` TEXT NULL,
        \`aadhaar_url\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`interview_schedules\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`candidate_name\` VARCHAR(255) NOT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`step\` INT DEFAULT 1,
        \`status\` VARCHAR(50) DEFAULT 'Scheduled',
        \`call1_date\` DATETIME NULL,
        \`call1_remarks\` TEXT NULL,
        \`call2_date\` DATETIME NULL,
        \`call2_remarks\` TEXT NULL,
        \`interview_date\` DATETIME NULL,
        \`interview_remarks\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`interview_tokens\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`token\` VARCHAR(100) NOT NULL UNIQUE,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`candidate_name\` VARCHAR(255) NOT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`assigned_name\` VARCHAR(150) NOT NULL,
        \`assigned_designation\` VARCHAR(150) NOT NULL,
        \`status\` VARCHAR(50) DEFAULT 'pending',
        \`scores_json\` LONGTEXT NULL,
        \`remarks\` TEXT NULL,
        \`completed_at\` DATETIME NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`hr_evaluations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`hr_score_json\` LONGTEXT NULL,
        \`assigned_score_json\` LONGTEXT NULL,
        \`is_new_role\` BOOLEAN DEFAULT FALSE,
        \`suggested_designation\` VARCHAR(150) NULL,
        \`suggestion_reason\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`selected_candidates\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`phone\` VARCHAR(20) NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`source\` VARCHAR(100) NULL,
        \`hr_score\` INT DEFAULT 0,
        \`assigned_score\` INT DEFAULT 0,
        \`total_score\` INT DEFAULT 0,
        \`decision_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`decision_by\` VARCHAR(150) NULL,
        \`is_probation\` BOOLEAN DEFAULT FALSE,
        \`remarks\` TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`rejected_candidates\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`phone\` VARCHAR(20) NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`source\` VARCHAR(100) NULL,
        \`stage\` VARCHAR(100) NULL,
        \`rejection_date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`rejected_by\` VARCHAR(150) NULL,
        \`remarks\` TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`selection_offers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`status\` VARCHAR(50) DEFAULT 'Pending Accept',
        \`call_date\` DATETIME NULL,
        \`remarks\` TEXT NULL,
        \`joining_date\` DATE NULL,
        \`accepted_date\` DATE NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`candidate_activities\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`candidate_id\` INT NULL,
        \`app_no\` VARCHAR(50) NOT NULL,
        \`action_type\` VARCHAR(100) NOT NULL,
        \`icon\` VARCHAR(20) DEFAULT 'dY"<',
        \`label\` VARCHAR(255) NOT NULL,
        \`score\` INT DEFAULT 0,
        \`max_score\` INT DEFAULT 60,
        \`remarks\` TEXT NULL,
        \`assigned_by\` VARCHAR(150) NULL,
        \`by_user\` VARCHAR(150) NULL,
        \`color\` VARCHAR(50) DEFAULT 'navy',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`employees\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`employee_id\` VARCHAR(100) NULL UNIQUE,
        \`app_no\` VARCHAR(50) NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(150) NULL,
        \`phone\` VARCHAR(20) NULL,
        \`department\` VARCHAR(150) NULL,
        \`designation\` VARCHAR(150) NULL,
        \`section\` VARCHAR(150) NULL,
        \`branch\` VARCHAR(150) NULL,
        \`status\` VARCHAR(50) DEFAULT 'Joined',
        \`joining_date\` DATE NULL,
        \`salary\` DECIMAL(10,2) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`interview_questions\` (
        \`q_id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`round\` VARCHAR(50) DEFAULT 'HR',
        \`designation\` VARCHAR(150) DEFAULT 'All',
        \`question\` TEXT NOT NULL,
        \`type\` VARCHAR(50) DEFAULT 'score',
        \`max_score\` INT DEFAULT 10,
        \`options\` TEXT NULL,
        \`active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`page_visibility_settings\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`page_key\` VARCHAR(100) NOT NULL UNIQUE,
        \`hr_visible\` BOOLEAN DEFAULT TRUE,
        \`manager_visible\` BOOLEAN DEFAULT TRUE,
        \`admin_visible\` BOOLEAN DEFAULT TRUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // page_visibility table: used by settingsController.getPageSettings / savePageSettings
      `CREATE TABLE IF NOT EXISTS \`page_visibility\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`role_page_key\` VARCHAR(200) NOT NULL UNIQUE,
        \`role\` VARCHAR(100) NOT NULL,
        \`page_key\` VARCHAR(100) NOT NULL,
        \`allowed\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`broadcast_messages\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(255) NOT NULL,
        \`subject\` VARCHAR(255) NULL,
        \`message\` TEXT NOT NULL,
        \`priority\` VARCHAR(50) DEFAULT 'normal',
        \`category\` VARCHAR(100) DEFAULT 'General',
        \`target_role\` VARCHAR(255) DEFAULT 'Everyone',
        \`sender_name\` VARCHAR(255) NOT NULL,
        \`status\` VARCHAR(50) DEFAULT 'Sent',
        \`require_ack\` BOOLEAN DEFAULT FALSE,
        \`pinned\` BOOLEAN DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`designations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`role_scope\` VARCHAR(50) DEFAULT 'All',
        \`name\` VARCHAR(150) NOT NULL UNIQUE,
        \`active\` BOOLEAN DEFAULT TRUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`onboarding_records\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`record_id\` VARCHAR(50) NOT NULL UNIQUE,
        \`emp_name\` VARCHAR(255) NOT NULL,
        \`designation\` VARCHAR(150) NOT NULL,
        \`joining_date\` DATE NULL,
        \`progress\` INT DEFAULT 0,
        \`status\` VARCHAR(50) DEFAULT 'On Track',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS \`onboarding_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`onboarding_id\` INT NULL,
        \`record_id\` VARCHAR(50) NOT NULL,
        \`section\` VARCHAR(100) NOT NULL,
        \`item_id\` VARCHAR(100) NOT NULL,
        \`item\` VARCHAR(255) NOT NULL,
        \`mandatory\` BOOLEAN DEFAULT FALSE,
        \`status\` VARCHAR(50) DEFAULT 'Pending',
        \`remarks\` TEXT NULL,
        \`done_by\` VARCHAR(150) NULL,
        \`done_at\` DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    ];

    for (const sql of compatibilityScripts) {
      try {
        await connection.query(sql);
      } catch (err) {
        logDebug(`[Auto DB Compatibility Warning]:`, err.message);
      }
    }

    // --- MIGRATIONS ---
    const migrations = [
      "ALTER TABLE candidates ADD COLUMN is_duplicate_phone VARCHAR(10) DEFAULT 'No'",
      "ALTER TABLE candidates ADD COLUMN resume_url TEXT NULL",
      "ALTER TABLE candidates ADD COLUMN blood_group VARCHAR(20) NULL",
      "ALTER TABLE candidates ADD COLUMN photo_url TEXT NULL",
      "ALTER TABLE candidates ADD COLUMN aadhaar_url TEXT NULL",
      "ALTER TABLE candidates ADD COLUMN salary VARCHAR(100) NULL",
      "ALTER TABLE candidates ADD COLUMN offered_doj DATE NULL",
      "ALTER TABLE candidates ADD COLUMN retail_experience VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN previous_company VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN previous_designation VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN aadhaar_number VARCHAR(50) NULL",
      "ALTER TABLE candidates ADD COLUMN father_details VARCHAR(255) NULL",
      "ALTER TABLE candidates ADD COLUMN mother_details VARCHAR(255) NULL",
      "ALTER TABLE candidates ADD COLUMN religion_caste VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN languages_known VARCHAR(255) NULL",
      "ALTER TABLE candidate_activities ADD COLUMN assigned_by VARCHAR(150) NULL",
      "ALTER TABLE candidate_activities ADD COLUMN by_user VARCHAR(150) NULL",
      "ALTER TABLE candidate_activities ADD COLUMN color VARCHAR(50) DEFAULT 'navy'",
      "ALTER TABLE hr_evaluations ADD COLUMN is_new_role BOOLEAN DEFAULT FALSE",
      "ALTER TABLE hr_evaluations ADD COLUMN suggested_designation VARCHAR(150) NULL",
      "ALTER TABLE hr_evaluations ADD COLUMN suggestion_reason TEXT NULL",
      `CREATE TABLE IF NOT EXISTS manpower_requisitions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        designation VARCHAR(150) NOT NULL UNIQUE,
        department VARCHAR(150) NULL,
        branch VARCHAR(150) NULL,
        required_count INT DEFAULT 0,
        priority VARCHAR(50) DEFAULT 'Normal',
        status VARCHAR(50) DEFAULT 'Open',
        opening_date DATE NULL,
        closing_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      `CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      `CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL,
        module VARCHAR(100) NOT NULL,
        can_view BOOLEAN DEFAULT FALSE,
        can_create BOOLEAN DEFAULT FALSE,
        can_edit BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        UNIQUE KEY \`role_module_idx\` (\`role_name\`, \`module\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(150),
        user_role VARCHAR(50) NULL,
        user_phone VARCHAR(50) NULL,
        candidate_app_no VARCHAR(50) NULL,
        candidate_name VARCHAR(255) NULL,
        candidate_phone VARCHAR(50) NULL,
        action VARCHAR(100),
        module VARCHAR(100),
        details TEXT,
        ip_address VARCHAR(50),
        device_info VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // audit_logs schema extensions
      "ALTER TABLE audit_logs ADD COLUMN user_role VARCHAR(50) NULL",
      "ALTER TABLE audit_logs ADD COLUMN user_phone VARCHAR(50) NULL",
      "ALTER TABLE audit_logs ADD COLUMN candidate_app_no VARCHAR(50) NULL",
      "ALTER TABLE audit_logs ADD COLUMN candidate_name VARCHAR(255) NULL",
      "ALTER TABLE audit_logs ADD COLUMN candidate_phone VARCHAR(50) NULL",
      "ALTER TABLE audit_logs ADD COLUMN device_info VARCHAR(255) NULL",

      // selection_offers missing columns needed by offerController
      "ALTER TABLE selection_offers ADD COLUMN call1_date DATETIME NULL",
      "ALTER TABLE selection_offers ADD COLUMN call1_remarks TEXT NULL",
      "ALTER TABLE selection_offers ADD COLUMN call2_date DATETIME NULL",
      "ALTER TABLE selection_offers ADD COLUMN call2_remarks TEXT NULL",
      "ALTER TABLE selection_offers ADD COLUMN confirm_date DATETIME NULL",
      "ALTER TABLE selection_offers ADD COLUMN confirm_remarks TEXT NULL",
      "ALTER TABLE selection_offers ADD COLUMN notice_period VARCHAR(100) NULL",
      "ALTER TABLE selection_offers ADD COLUMN est_doj DATE NULL",
      "ALTER TABLE selection_offers ADD COLUMN actual_doj DATE NULL",
      "ALTER TABLE selection_offers ADD COLUMN updated_at DATETIME NULL",
      "ALTER TABLE selection_offers ADD COLUMN salary VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN religion VARCHAR(100) NULL",
      "ALTER TABLE candidates ADD COLUMN caste VARCHAR(100) NULL",
      "ALTER TABLE candidates ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN section VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN section VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN branch VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN branch VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN reporting_manager VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN reporting_manager VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN pan_number VARCHAR(20) NULL",
      "ALTER TABLE candidates ADD COLUMN bank_name VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN bank_account_no VARCHAR(50) NULL",
      "ALTER TABLE candidates ADD COLUMN bank_ifsc VARCHAR(30) NULL",
      "ALTER TABLE candidates ADD COLUMN uan_number VARCHAR(50) NULL",
      "ALTER TABLE candidates ADD COLUMN esi_number VARCHAR(50) NULL",
      "ALTER TABLE candidates ADD COLUMN marital_status VARCHAR(50) NULL",
      "ALTER TABLE candidates ADD COLUMN emergency_contact VARCHAR(100) NULL",
      "ALTER TABLE candidates ADD COLUMN emergency_phone VARCHAR(30) NULL",
      "ALTER TABLE candidates ADD COLUMN permanent_address TEXT NULL",
      "ALTER TABLE candidates ADD COLUMN documents_checklist_json TEXT NULL",
      "ALTER TABLE candidates ADD COLUMN greythr_synced BOOLEAN DEFAULT FALSE",
      "ALTER TABLE candidates ADD COLUMN greythr_ready TINYINT(1) DEFAULT 0",
      
      "ALTER TABLE users ADD COLUMN email VARCHAR(150) NULL",
      "ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL",
      "ALTER TABLE users ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE users ADD COLUMN designation VARCHAR(150) NULL",
      
      "ALTER TABLE manpower_requisitions ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE manpower_requisitions ADD COLUMN branch VARCHAR(150) NULL",
      "ALTER TABLE manpower_requisitions ADD COLUMN priority VARCHAR(50) DEFAULT 'Normal'",
      "ALTER TABLE manpower_requisitions ADD COLUMN status VARCHAR(50) DEFAULT 'Open'",
      "ALTER TABLE manpower_requisitions ADD COLUMN opening_date DATE NULL",
      "ALTER TABLE manpower_requisitions ADD COLUMN closing_date DATE NULL"
    ];

    for (const sql of migrations) {
      try {
        await connection.query(sql);
      } catch (err) {
        // Ignore duplicate column errors
        if (err.code !== 'ER_DUP_FIELDNAME') {
          logDebug(`[Migration Warning]:`, err.message);
        }
      }
    }
    // ------------------

    // Seed default admin users if `users` table is empty
    const [uRows] = await connection.query(`SELECT COUNT(*) as cnt FROM users`);
    if (uRows[0].cnt === 0) {
      const hashedPass = await bcrypt.hash('admin123', 10);
      await connection.query(
        `INSERT INTO users (username, password, full_name, role, active) VALUES
         ('admin', ?, 'System Administrator', 'Admin', TRUE),
         ('hr', ?, 'HR Manager', 'HR', TRUE),
         ('manager', ?, 'Store Manager', 'Manager', TRUE)`,
        [hashedPass, hashedPass, hashedPass]
      );
      logDebug(`[Auto DB Initializer] Default admin users created (admin / hr / manager - Password: admin123)`);
    }

    // Seed default designations if empty or missing
    const defaultRoles = [
      'Store Head', 'Operations Manager', 'Department Manager', 'Floor Manager',
      'Section Supervisor', 'Senior Sales Staff', 'Junior Sales Staff', 'Helpers / Trainees',
      'Cashiers', 'Customer Care / Help Desk', 'Reception', 'Gift Wrapping',
      'Warehouse (Receiving, Bundling, Replenishment)', 'Receiving & GRN', 'Dispatch (Online/B2B, if any)',
      'Stock Audit / Loss Prevention', 'Visual Merchandising', 'HR', 'Admin', 'Accounts',
      'IT / CCTV / POS Support', 'Maintenance (Electrician, Plumbing, Lift AMC liaison)',
      'Housekeeping', 'Security', 'Cafeteria Staff', 'Parking Attendants', 'Drivers'
    ];
    for (const r of defaultRoles) {
      try {
        await connection.query(`INSERT IGNORE INTO designations (name) VALUES (?)`, [r]);
      } catch(e) {}
    }

    // Seed default page_visibility rows (allow all by default for all roles)
    try {
      const defaultVisibility = [
        ['HR_dashboard', 'HR', 'dashboard', true],
        ['HR_candidates', 'HR', 'candidates', true],
        ['HR_interview', 'HR', 'interview', true],
        ['HR_offer', 'HR', 'offer', true],
        ['HR_onboarding', 'HR', 'onboarding', true],
        ['HR_exit', 'HR', 'exit', true],
        ['HR_employees', 'HR', 'employees', true],
        ['HR_settings', 'HR', 'settings', false],
        ['HR_dept-hiring', 'HR', 'dept-hiring', true],
        ['Manager_dashboard', 'Manager', 'dashboard', true],
        ['Manager_candidates', 'Manager', 'candidates', true],
        ['Manager_interview', 'Manager', 'interview', true],
        ['Manager_offer', 'Manager', 'offer', false],
        ['Manager_onboarding', 'Manager', 'onboarding', true],
        ['Manager_exit', 'Manager', 'exit', true],
        ['Manager_employees', 'Manager', 'employees', true],
        ['Manager_settings', 'Manager', 'settings', false],
        ['Manager_dept-hiring', 'Manager', 'dept-hiring', true],
        ['Admin_dashboard', 'Admin', 'dashboard', true],
        ['Admin_candidates', 'Admin', 'candidates', true],
        ['Admin_interview', 'Admin', 'interview', true],
        ['Admin_offer', 'Admin', 'offer', true],
        ['Admin_onboarding', 'Admin', 'onboarding', true],
        ['Admin_exit', 'Admin', 'exit', true],
        ['Admin_employees', 'Admin', 'employees', true],
        ['Admin_settings', 'Admin', 'settings', true],
        ['Admin_dept-hiring', 'Admin', 'dept-hiring', true]
      ];
      for (const [key, role, page, allowed] of defaultVisibility) {
        await connection.query(
          `INSERT INTO page_visibility (role_page_key, role, page_key, allowed)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE allowed = allowed`,
          [key, role, page, allowed ? 1 : 0]
        );
      }
      logDebug(`[Auto DB Initializer] page_visibility seeded with defaults`);
    } catch(e) {
      logDebug(`[Auto DB Initializer] page_visibility seed warning:`, e.message);
    }

    // ------------------
    // Module 1 & 2 Tables Initialization (Non-Breaking)
    // ------------------
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS department_hiring_targets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          department VARCHAR(100) NOT NULL,
          section VARCHAR(100) NOT NULL,
          designation VARCHAR(100) NOT NULL,
          required_openings INT DEFAULT 10,
          hiring_target INT DEFAULT 10,
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY dept_sec_desig (department, section, designation)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS section_allocations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          employee_id VARCHAR(100) NOT NULL UNIQUE,
          app_no VARCHAR(100),
          employee_name VARCHAR(200),
          department VARCHAR(100),
          section VARCHAR(100),
          assigned_by VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS department_sections (
          id INT AUTO_INCREMENT PRIMARY KEY,
          department VARCHAR(100) NOT NULL,
          section_name VARCHAR(100) NOT NULL,
          description VARCHAR(255),
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY dept_sec (department, section_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const [secRows] = await connection.query(`SELECT COUNT(*) as cnt FROM department_sections`);
      if (secRows[0].cnt === 0) {
        const initialSections = [
          ['Mens', 'Ethnic Wear'], ['Mens', 'Brands'], ['Mens', 'Mid'], ['Mens', 'Economic'], ['Mens', 'Undergarments'], ['Mens', 'Watch & Accessories'], ['Mens', 'Suiting & Shirting'], ['Mens', 'Luggage'],
          ['Ladies', 'Ethnic Wear'], ['Ladies', 'Mix & Match'], ['Ladies', 'Western'], ['Ladies', 'Undergarments & Nightwear'], ['Ladies', 'Jewellery Set'], ['Ladies', 'Bridal Wear'], ['Ladies', 'Accessories'], ['Ladies', 'Dress Material'], ['Ladies', 'Blouses'],
          ['Kids', 'Boys'], ['Kids', 'Girls'], ['Kids', 'Newborn'], ['Kids', 'Infants'], ['Kids', 'Boys Accessories'], ['Kids', 'Undergarments'],
          ['First Floor Saree', 'Silk'], ['First Floor Saree', 'Art & Mix'], ['First Floor Saree', 'Designer'], ['First Floor Saree', 'Cotton'],
          ['Ground Floor Saree', 'Synthetic'], ['Ground Floor Saree', 'Cotton'], ['Ground Floor Saree', 'Silk'], ['Ground Floor Saree', 'Art & Raw'], ['Ground Floor Saree', 'Fancy'], ['Ground Floor Saree', 'Others / Remaining'],
          ['Home Furnishing', 'Full Home Furnishing'],
          ['Others', 'General']
        ];

        for (const [dept, sec] of initialSections) {
          await connection.query(
            `INSERT IGNORE INTO department_sections (department, section_name) VALUES (?, ?)`,
            [dept, sec]
          );
        }
        logDebug(`[Auto DB Initializer] Seeded initial BSC Textiles department sections`);
      }

      logDebug(`[Auto DB Initializer] Verified department_hiring_targets, section_allocations and department_sections tables`);
    } catch (e) {
      logDebug(`[Auto DB Initializer Warning for new modules]:`, e.message);
    }

    // ------------------
    // BSC Batch Plan Tables Initialization
    // ------------------
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS batch_plans (
          id INT AUTO_INCREMENT PRIMARY KEY,
          batch_code VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(150) NOT NULL,
          type VARCHAR(50) DEFAULT 'Regular',
          description TEXT,
          capacity INT DEFAULT 80,
          batch_leader_app_no VARCHAR(50) NULL,
          status VARCHAR(50) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS batch_groups (
          id INT AUTO_INCREMENT PRIMARY KEY,
          group_code VARCHAR(50) NOT NULL,
          batch_id INT NOT NULL,
          name VARCHAR(150) NOT NULL,
          group_leader_app_no VARCHAR(50) NULL,
          max_members INT DEFAULT 9,
          description TEXT,
          status VARCHAR(50) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_bg_batch (batch_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS batch_group_members (
          id INT AUTO_INCREMENT PRIMARY KEY,
          candidate_app_no VARCHAR(50) NOT NULL UNIQUE,
          batch_id INT NOT NULL,
          group_id INT NULL,
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          assigned_by VARCHAR(150),
          INDEX idx_bgm_batch (batch_id),
          INDEX idx_bgm_group (group_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS batch_activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          action_type VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          by_user VARCHAR(150) DEFAULT 'System',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS batch_attendance (
          id INT AUTO_INCREMENT PRIMARY KEY,
          batch_id INT NOT NULL,
          candidate_app_no VARCHAR(50) NOT NULL,
          day_number INT NOT NULL DEFAULT 1,
          attendance_date DATE NOT NULL,
          morning_status VARCHAR(30) DEFAULT 'Present',
          morning_remarks TEXT NULL,
          afternoon_status VARCHAR(30) DEFAULT 'Present',
          afternoon_remarks TEXT NULL,
          marked_by VARCHAR(150) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_batch_cand_day (batch_id, candidate_app_no, day_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Seed Initial Batches if batch_plans is empty
      const [bpRows] = await connection.query(`SELECT COUNT(*) as cnt FROM batch_plans`);
      if (bpRows[0].cnt === 0) {
        const initialBatches = [
          ['B-STAR', 'B*', 'Senior', 'BSC Senior Management & Store Operations Core Batch', 80, 'Active'],
          ['B-ALPHA', 'B-Alpha', 'Regular', 'BSC Showroom Alpha Batch (8 Groups)', 80, 'Active'],
          ['B-BETA', 'B-Beta', 'Regular', 'BSC Showroom Beta Batch (8 Groups)', 80, 'Active']
        ];

        for (const [code, name, type, desc, cap, stat] of initialBatches) {
          await connection.query(
            `INSERT INTO batch_plans (batch_code, name, type, description, capacity, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [code, name, type, desc, cap, stat]
          );
        }

        // Get Batch IDs for Alpha & Beta
        const [alphaBatch] = await connection.query(`SELECT id FROM batch_plans WHERE batch_code = 'B-ALPHA'`);
        const [betaBatch] = await connection.query(`SELECT id FROM batch_plans WHERE batch_code = 'B-BETA'`);

        if (alphaBatch.length > 0) {
          const alphaId = alphaBatch[0].id;
          for (let i = 1; i <= 8; i++) {
            const gNum = String(i).padStart(2, '0');
            await connection.query(
              `INSERT INTO batch_groups (group_code, batch_id, name, max_members, status) VALUES (?, ?, ?, ?, ?)`,
              [`ALPHA-G${gNum}`, alphaId, `Group ${gNum}`, 9, 'Active']
            );
          }
        }

        if (betaBatch.length > 0) {
          const betaId = betaBatch[0].id;
          for (let i = 1; i <= 8; i++) {
            const gNum = String(i).padStart(2, '0');
            await connection.query(
              `INSERT INTO batch_groups (group_code, batch_id, name, max_members, status) VALUES (?, ?, ?, ?, ?)`,
              [`BETA-G${gNum}`, betaId, `Group ${gNum}`, 9, 'Active']
            );
          }
        }

        await connection.query(
          `INSERT INTO batch_activity_logs (action_type, description, by_user) VALUES (?, ?, ?)`,
          ['Initial Seed', 'Initial B*, B-Alpha, B-Beta batches and 16 groups initialized in BSC Batch Plan system', 'System Admin']
        );

        logDebug(`[Auto DB Initializer] Seeded BSC Batch Plan initial batches (B*, B-Alpha, B-Beta) and 16 groups`);
      }

      // Add default page visibility for batch_plan and batch_attendance
      const bpVisibility = [
        ['HR_batch-plan', 'HR', 'batch_plan', true],
        ['Manager_batch-plan', 'Manager', 'batch_plan', true],
        ['Admin_batch-plan', 'Admin', 'batch_plan', true],
        ['Super Admin_batch-plan', 'Super Admin', 'batch_plan', true],
        ['Batch Leader_batch-plan', 'Batch Leader', 'batch_plan', true],

        ['HR_batch-attendance', 'HR', 'batch_attendance', true],
        ['Manager_batch-attendance', 'Manager', 'batch_attendance', true],
        ['Admin_batch-attendance', 'Admin', 'batch_attendance', true],
        ['Super Admin_batch-attendance', 'Super Admin', 'batch_attendance', true],
        ['Batch Leader_batch-attendance', 'Batch Leader', 'batch_attendance', true]
      ];
      for (const [key, role, page, allowed] of bpVisibility) {
        await connection.query(
          `INSERT INTO page_visibility (role_page_key, role, page_key, allowed)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE allowed = allowed`,
          [key, role, page, allowed ? 1 : 0]
        );
      }

      // Seed default Batch Leader user account if missing
      const [blCheck] = await connection.query(`SELECT id FROM users WHERE username = 'batchleader'`);
      if (blCheck.length === 0) {
        const hashedPass = await bcrypt.hash('admin123', 10);
        await connection.query(
          `INSERT INTO users (username, password, full_name, role, active) VALUES (?, ?, ?, ?, TRUE)`,
          ['batchleader', hashedPass, 'Batch Leader Admin', 'Batch Leader']
        );
        logDebug(`[Auto DB Initializer] Seeded demo Batch Leader user account (batchleader / Password: admin123)`);
      }

      logDebug(`[Auto DB Initializer] Verified BSC Batch Plan database tables and attendance system`);
    } catch (e) {
      logDebug(`[Auto DB Initializer Warning for Batch Plan]:`, e.message);
    }

    // ------------------
    // Performance Indexes & Table Collation Standardization
    // ------------------
    try {
      // 1. Ensure joining_call_desk and joining_call_history tables exist
      await connection.query(`
        CREATE TABLE IF NOT EXISTS joining_call_desk (
          id INT AUTO_INCREMENT PRIMARY KEY,
          app_no VARCHAR(50) NOT NULL UNIQUE,
          call_status ENUM('Pending','Call done','Call not received','Wrong number','Rescheduled') DEFAULT 'Pending',
          doj_confirmation ENUM('Pending confirmation','Confirmed','Not confirmed') DEFAULT 'Pending confirmation',
          notes TEXT,
          follow_up_date DATE,
          last_call_date DATE,
          updated_by VARCHAR(100),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS joining_call_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          app_no VARCHAR(50) NOT NULL,
          action_type VARCHAR(80),
          old_value TEXT,
          new_value TEXT,
          notes TEXT,
          done_by VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_jch_app_no (app_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 2. Align collations and create indexes ONCE if not already present (prevents table lock on process restarts)
      const [existingIndexes] = await connection.query(`SHOW INDEX FROM candidates WHERE Key_name = 'idx_cand_app_no'`);
      if (!existingIndexes || existingIndexes.length === 0) {
        logDebug(`[Auto DB Initializer] Applying performance indexes and table collations...`);
        const collateTables = ['candidates', 'selection_offers', 'section_allocations', 'joining_call_desk', 'employees'];
        for (const tbl of collateTables) {
          try {
            await connection.query(`ALTER TABLE \`${tbl}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
          } catch (e) {}
        }

        const indexStatements = [
          "CREATE INDEX idx_cand_app_no ON candidates (app_no)",
          "CREATE INDEX idx_cand_status ON candidates (status)",
          "CREATE INDEX idx_cand_created_at ON candidates (created_at)",
          "CREATE INDEX idx_cand_phone ON candidates (phone)",
          "CREATE INDEX idx_cand_desig ON candidates (designation)",
          "CREATE INDEX idx_cand_dept ON candidates (department)",
          "CREATE INDEX idx_so_app_no ON selection_offers (app_no)",
          "CREATE INDEX idx_so_status ON selection_offers (status)",
          "CREATE INDEX idx_sa_app_no ON section_allocations (app_no)",
          "CREATE INDEX idx_jcd_app_no ON joining_call_desk (app_no)",
          "CREATE INDEX idx_emp_app_no ON employees (app_no)",
          "CREATE INDEX idx_emp_status ON employees (status)",
          "CREATE INDEX idx_emp_phone ON employees (phone)",
          "CREATE INDEX idx_ca_app_no ON candidate_activities (app_no)",
          "CREATE INDEX idx_isch_app_no ON interview_schedules (app_no)",
          "CREATE INDEX idx_mr_desig ON manpower_requisitions (designation)"
        ];

        for (const idxSql of indexStatements) {
          try {
            await connection.query(idxSql);
          } catch (e) {}
        }
        logDebug(`[Auto DB Initializer] Performance indexes applied successfully`);
      } else {
        logDebug(`[Auto DB Initializer] Performance indexes already present. Skipped DDL table lock execution.`);
      }
    } catch (idxErr) {
      logDebug(`[Auto DB Indexing Warning]:`, idxErr.message);
    }

    const [finalTables] = await connection.query(`SHOW TABLES`);
    logDebug(`====================================================`);
    logDebug(`  [Auto DB Initializer] DATABASE FULLY INITIALIZED!`);
    logDebug(`  Total Active Tables: ${finalTables.length}`);
    logDebug(`====================================================`);

    connection.release();
  } catch (err) {
    logDebug(`[Auto DB Initializer ERROR]:`, err.message);
  }
}

module.exports = { autoInitializeDatabase };
