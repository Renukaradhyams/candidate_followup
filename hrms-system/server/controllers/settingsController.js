const db = require('../config/db');
const bcrypt = require('bcrypt');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');

const getUsers = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT username, role, active, full_name as fullName FROM users ORDER BY created_at ASC`);
    const users = rows.map((r) => ({
      username: r.username,
      role: r.role,
      active: !!r.active,
      fullName: r.fullName || r.role
    }));
    return res.json({ users });
  } catch (err) {
    return res.json({ users: [] });
  }
};

const addUser = async (req, res) => {
  try {
    const { username, password, role, fullName } = req.body;
    if (!username || !password || !role) {
      return errorRes(res, 'Username, password, and role are required', [], 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO users (username, password, role, full_name, active) VALUES (?, ?, ?, ?, TRUE)`,
      [username.trim(), hashedPassword, role, fullName || role]
    );

    await logAction(req.user ? req.user.username : 'Admin', 'ADD_USER', 'SETTINGS', { username, role });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to add user', [err.message], 500);
  }
};

const updateUser = async (req, res) => {
  try {
    const { username, active, password, role } = req.body;
    if (!username) return errorRes(res, 'Username is required', [], 400);

    const updFields = [];
    const params = [];

    if (active !== undefined) {
      updFields.push('active = ?');
      params.push(active ? 1 : 0);
    }
    if (role) {
      updFields.push('role = ?');
      params.push(role);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updFields.push('password = ?');
      params.push(hashedPassword);
    }

    params.push(username);
    await db.query(`UPDATE users SET ${updFields.join(', ')} WHERE username = ?`, params);

    await logAction(req.user ? req.user.username : 'Admin', 'UPDATE_USER', 'SETTINGS', { username, active, role });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to update user', [err.message], 500);
  }
};

const getPageSettings = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT role_page_key, allowed FROM page_visibility`);
    const settings = {};
    rows.forEach((r) => {
      settings[r.role_page_key] = !!r.allowed;
    });
    return res.json(settings);
  } catch (err) {
    return res.json({});
  }
};

const savePageSettings = async (req, res) => {
  try {
    const settings = req.body.settings || req.body;
    for (const key of Object.keys(settings)) {
      const [role, pageKey] = key.split('_');
      if (role && pageKey) {
        await db.query(
          `INSERT INTO page_visibility (role_page_key, role, page_key, allowed)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)`,
          [key, role, pageKey, settings[key] ? 1 : 0]
        );
      }
    }

    await logAction(req.user ? req.user.username : 'Admin', 'SAVE_PAGE_SETTINGS', 'SETTINGS', settings);

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to save page settings', [err.message], 500);
  }
};

const getDesignations = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT name FROM designations WHERE active = TRUE ORDER BY id ASC`);
    const designations = rows.map((r) => r.name);
    return res.json({ designations });
  } catch (err) {
    return res.json({ designations: ['Sales Executive', 'Floor Manager', 'Cashier', 'Billing Executive', 'Store Keeper'] });
  }
};

const addDesignation = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return errorRes(res, 'Designation name is required', [], 400);

    await db.query(
      `INSERT INTO designations (role_scope, name, active) VALUES ('All', ?, TRUE) ON DUPLICATE KEY UPDATE active = TRUE`,
      [name.trim()]
    );

    await logAction(req.user ? req.user.username : 'Admin', 'ADD_DESIGNATION', 'SETTINGS', { name });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to add designation', [err.message], 500);
  }
};

const deleteDesignation = async (req, res) => {
  try {
    const { name } = req.body;
    await db.query(`UPDATE designations SET active = FALSE WHERE name = ?`, [name]);

    await logAction(req.user ? req.user.username : 'Admin', 'DELETE_DESIGNATION', 'SETTINGS', { name });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to delete designation', [err.message], 500);
  }
};

const getAllInterviewQuestions = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM interview_questions WHERE active = TRUE ORDER BY designation, round, q_id ASC`);
    const questions = rows.map((r) => ({
      desig: r.designation,
      round: r.round,
      qId: r.q_id,
      text: r.question,
      type: r.type,
      max: r.max_score,
      options: r.options || ''
    }));
    return res.json({ questions });
  } catch (err) {
    return res.json({ questions: [] });
  }
};

const addInterviewQuestion = async (req, res) => {
  try {
    const { desig, round, text, max } = req.body;
    if (!desig || !round || !text) {
      return errorRes(res, 'Designation, round, and question text are required', [], 400);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) as cnt FROM interview_questions WHERE designation = ? AND round = ?`,
      [desig, round]
    );
    const nextQId = countRows[0].cnt + 1;

    await db.query(
      `INSERT INTO interview_questions (designation, round, q_id, question, type, max_score, active)
       VALUES (?, ?, ?, ?, 'score', ?, TRUE)`,
      [desig, round, nextQId, text.trim(), parseInt(max) || 10]
    );

    await logAction(req.user ? req.user.username : 'Admin', 'ADD_INTERVIEW_QUESTION', 'SETTINGS', { desig, round, text });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to add interview question', [err.message], 500);
  }
};

const deleteInterviewQuestion = async (req, res) => {
  try {
    const { desig, round, text } = req.body;
    await db.query(
      `UPDATE interview_questions SET active = FALSE WHERE designation = ? AND round = ? AND question = ?`,
      [desig, round, text]
    );

    await logAction(req.user ? req.user.username : 'Admin', 'DELETE_INTERVIEW_QUESTION', 'SETTINGS', { desig, round, text });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to delete interview question', [err.message], 500);
  }
};

module.exports = {
  getUsers,
  addUser,
  updateUser,
  getPageSettings,
  savePageSettings,
  getDesignations,
  addDesignation,
  deleteDesignation,
  getAllInterviewQuestions,
  addInterviewQuestion,
  deleteInterviewQuestion
};
