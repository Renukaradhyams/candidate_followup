const path = require('path');
const bcrypt = require('bcrypt');

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
        \`icon\` VARCHAR(20) DEFAULT '📋',
        \`label\` VARCHAR(255) NOT NULL,
        \`score\` INT DEFAULT 0,
        \`max_score\` INT DEFAULT 60,
        \`remarks\` TEXT NULL,
        \`assigned_by\` VARCHAR(150) NULL,
        \`by_user\` VARCHAR(150) NULL,
        \`color\` VARCHAR(50) DEFAULT 'navy',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        action VARCHAR(100),
        module VARCHAR(100),
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

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
      "ALTER TABLE candidates ADD COLUMN religion VARCHAR(100) NULL",
      "ALTER TABLE candidates ADD COLUMN caste VARCHAR(100) NULL",
      "ALTER TABLE candidates ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN department VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN branch VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN branch VARCHAR(150) NULL",
      "ALTER TABLE candidates ADD COLUMN reporting_manager VARCHAR(150) NULL",
      "ALTER TABLE selection_offers ADD COLUMN reporting_manager VARCHAR(150) NULL",
      
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

    // Seed default interview questions if empty
    const [qRows] = await connection.query(`SELECT COUNT(*) as cnt FROM interview_questions`);
    if (qRows[0].cnt === 0) {
      await connection.query(
        `INSERT INTO interview_questions (round, designation, question, max_score) VALUES
         ('HR', 'All', 'Communication & Professional Demeanor', 15),
         ('HR', 'All', 'Relevant Work Experience & Technical Skills', 15),
         ('HR', 'All', 'Job Stability & Career Growth Intent', 15),
         ('HR', 'All', 'Cultural Fit & Team Alignment', 15),
         ('Round 2', 'All', 'Problem Solving & Domain Knowledge', 15),
         ('Round 2', 'All', 'Leadership & Work Ownership', 15)`
      );
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
