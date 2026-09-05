const pool = require('../config/db');

class BatchPlanController {
  // GET /api/batch-plan/data
  async getBatchPlanData(req, res) {
    try {
      // 1. Fetch Batches
      let batches = [];
      try {
        const [rows] = await pool.query(`SELECT * FROM batch_plans ORDER BY id ASC`);
        batches = rows || [];
      } catch (e) {
        batches = [];
      }

      // 2. Fetch Groups
      let groups = [];
      try {
        const [rows] = await pool.query(`SELECT * FROM batch_groups ORDER BY batch_id ASC, id ASC`);
        groups = rows || [];
      } catch (e) {
        groups = [];
      }

      // 3. Fetch Group Members Allocations
      let groupMembers = [];
      try {
        const [rows] = await pool.query(`SELECT * FROM batch_group_members`);
        groupMembers = rows || [];
      } catch (e) {
        groupMembers = [];
      }

      // 4. Fetch Candidates/Employees (all joined or available employees)
      let candidates = [];
      try {
        const [rows] = await pool.query(`
          SELECT c.id, c.app_no, c.name, c.phone, c.email, c.department, c.designation, 
                 c.photo_url, c.status, c.created_at,
                 COALESCE(sa.section, '') as section,
                 so.status as offer_status
          FROM candidates c
          LEFT JOIN selection_offers so ON c.app_no = so.app_no
          LEFT JOIN section_allocations sa ON c.app_no = sa.app_no
          ORDER BY LOWER(c.name) ASC
        `);
        candidates = rows || [];
      } catch (e) {
        candidates = [];
      }

      // 5. Fetch Recent Activities
      let activities = [];
      try {
        const [rows] = await pool.query(`
          SELECT * FROM batch_activity_logs 
          ORDER BY id DESC LIMIT 50
        `);
        activities = rows || [];
      } catch (e) {
        activities = [];
      }

      // Process Joined Store status tag for candidates
      const candidateList = candidates.map(c => {
        const st = (c.status || '').toLowerCase().trim();
        const ost = (c.offer_status || '').toLowerCase().trim();
        const isJoinedStore = st.includes('joined store') || ost.includes('joined store') || st === 'joined' || st === 'hired';
        return {
          ...c,
          isJoinedStore,
          storeStatusLabel: isJoinedStore ? 'Joined Store' : (c.status || 'Active')
        };
      });

      return res.json({
        success: true,
        batches,
        groups,
        groupMembers,
        candidates: candidateList,
        activities
      });
    } catch (err) {
      console.error('[getBatchPlanData Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/batch-plan/batches
  async createBatch(req, res) {
    try {
      const { batchCode, name, type, description, capacity, batchLeaderAppNo, status } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: 'Batch Name is required' });
      }

      const code = batchCode || `B-${name.replace(/\s+/g, '-').toUpperCase()}`;
      const cap = parseInt(capacity, 10) || 80;
      const byUser = req.user?.fullName || req.user?.username || 'Admin';

      const [result] = await pool.query(`
        INSERT INTO batch_plans (batch_code, name, type, description, capacity, batch_leader_app_no, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [code, name, type || 'Regular', description || '', cap, batchLeaderAppNo || null, status || 'Active']);

      await pool.query(`
        INSERT INTO batch_activity_logs (action_type, description, by_user)
        VALUES (?, ?, ?)
      `, ['Create Batch', `Batch "${name}" (${code}) created with capacity ${cap}`, byUser]);

      return res.json({ success: true, message: 'Batch created successfully', batchId: result.insertId });
    } catch (err) {
      console.error('[createBatch Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // PUT /api/batch-plan/batches/:id
  async updateBatch(req, res) {
    try {
      const batchId = req.params.id;
      const { name, type, description, capacity, batchLeaderAppNo, status } = req.body;
      const byUser = req.user?.fullName || req.user?.username || 'Admin';

      await pool.query(`
        UPDATE batch_plans 
        SET name = COALESCE(?, name),
            type = COALESCE(?, type),
            description = COALESCE(?, description),
            capacity = COALESCE(?, capacity),
            batch_leader_app_no = ?,
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [name, type, description, capacity, batchLeaderAppNo !== undefined ? batchLeaderAppNo : null, status, batchId]);

      await pool.query(`
        INSERT INTO batch_activity_logs (action_type, description, by_user)
        VALUES (?, ?, ?)
      `, ['Update Batch', `Batch ID ${batchId} details updated`, byUser]);

      return res.json({ success: true, message: 'Batch updated successfully' });
    } catch (err) {
      console.error('[updateBatch Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/batch-plan/assign-batch-leader
  async assignBatchLeader(req, res) {
    try {
      const { batchId, batchLeaderAppNo, leaderName } = req.body;
      if (!batchId) {
        return res.status(400).json({ success: false, error: 'Batch ID is required' });
      }

      const byUser = req.user?.fullName || req.user?.username || 'Admin';

      await pool.query(`
        UPDATE batch_plans 
        SET batch_leader_app_no = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [batchLeaderAppNo || null, batchId]);

      const actionText = batchLeaderAppNo ? `assigned as Batch Leader for Batch #${batchId}` : `removed as Batch Leader for Batch #${batchId}`;
      await pool.query(`
        INSERT INTO batch_activity_logs (action_type, description, by_user)
        VALUES (?, ?, ?)
      `, ['Batch Leader Assignment', `${leaderName || 'Leader'} ${actionText}`, byUser]);

      return res.json({ success: true, message: 'Batch Leader updated successfully' });
    } catch (err) {
      console.error('[assignBatchLeader Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/batch-plan/groups
  async createGroup(req, res) {
    try {
      const { batchId, name, groupCode, groupLeaderAppNo, maxMembers, description, status } = req.body;
      if (!batchId || !name) {
        return res.status(400).json({ success: false, error: 'Batch ID and Group Name are required' });
      }

      const code = groupCode || `GRP-${name.replace(/\s+/g, '-').toUpperCase()}`;
      const maxM = parseInt(maxMembers, 10) || 9;
      const byUser = req.user?.fullName || req.user?.username || 'Admin';

      const [result] = await pool.query(`
        INSERT INTO batch_groups (batch_id, group_code, name, group_leader_app_no, max_members, description, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [batchId, code, name, groupLeaderAppNo || null, maxM, description || '', status || 'Active']);

      await pool.query(`
        INSERT INTO batch_activity_logs (action_type, description, by_user)
        VALUES (?, ?, ?)
      `, ['Create Group', `Group "${name}" created under Batch #${batchId} with max ${maxM} members`, byUser]);

      return res.json({ success: true, message: 'Group created successfully', groupId: result.insertId });
    } catch (err) {
      console.error('[createGroup Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // PUT /api/batch-plan/groups/:id
  async updateGroup(req, res) {
    try {
      const groupId = req.params.id;
      const { name, groupLeaderAppNo, maxMembers, description, status } = req.body;
      const byUser = req.user?.fullName || req.user?.username || 'Admin';

      await pool.query(`
        UPDATE batch_groups
        SET name = COALESCE(?, name),
            group_leader_app_no = ?,
            max_members = COALESCE(?, max_members),
            description = COALESCE(?, description),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [name, groupLeaderAppNo !== undefined ? groupLeaderAppNo : null, maxMembers, description, status, groupId]);

      await pool.query(`
        INSERT INTO batch_activity_logs (action_type, description, by_user)
        VALUES (?, ?, ?)
      `, ['Update Group', `Group ID ${groupId} details updated`, byUser]);

      return res.json({ success: true, message: 'Group updated successfully' });
    } catch (err) {
      console.error('[updateGroup Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/batch-plan/assign-group-leader
  async assignGroupLeader(req, res) {
    try {
      const { groupId, groupLeaderAppNo, leaderName } = req.body;
      if (!groupId) {
        return res.status(400).json({ success: false, error: 'Group ID is required' });
      }

      const byUser = req.user?.fullName || req.user?.username || 'Admin';

      await pool.query(`
        UPDATE batch_groups
        SET group_leader_app_no = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [groupLeaderAppNo || null, groupId]);

      const actionText = groupLeaderAppNo ? `assigned as Group Leader for Group #${groupId}` : `removed as Group Leader for Group #${groupId}`;
      await pool.query(`
        INSERT INTO batch_activity_logs (action_type, description, by_user)
        VALUES (?, ?, ?)
      `, ['Group Leader Assignment', `${leaderName || 'Leader'} ${actionText}`, byUser]);

      return res.json({ success: true, message: 'Group Leader updated successfully' });
    } catch (err) {
      console.error('[assignGroupLeader Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/batch-plan/add-member
  async addMemberToGroup(req, res) {
    try {
      const { candidateAppNo, batchId, groupId, memberName, groupName } = req.body;
      if (!candidateAppNo || !batchId) {
        return res.status(400).json({ success: false, error: 'Candidate App No and Batch ID are required' });
      }

      const byUser = req.user?.fullName || req.user?.username || 'Admin';

      await pool.query(`
        INSERT INTO batch_group_members (candidate_app_no, batch_id, group_id, assigned_by)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          batch_id = VALUES(batch_id),
          group_id = VALUES(group_id),
          assigned_by = VALUES(assigned_by),
          assigned_at = CURRENT_TIMESTAMP
      `, [candidateAppNo, batchId, groupId || null, byUser]);

      await pool.query(`
        INSERT INTO batch_activity_logs (action_type, description, by_user)
        VALUES (?, ?, ?)
      `, ['Add Member', `${memberName || candidateAppNo} added to ${groupName || 'Group'}`, byUser]);

      return res.json({ success: true, message: 'Member added to group successfully' });
    } catch (err) {
      console.error('[addMemberToGroup Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/batch-plan/move-member
  async moveMemberGroup(req, res) {
    try {
      const { candidateAppNo, targetBatchId, targetGroupId, memberName, fromGroupName, toGroupName } = req.body;
      if (!candidateAppNo || !targetBatchId || !targetGroupId) {
        return res.status(400).json({ success: false, error: 'Candidate App No, Target Batch and Target Group are required' });
      }

      const byUser = req.user?.fullName || req.user?.username || 'Admin';

      await pool.query(`
        INSERT INTO batch_group_members (candidate_app_no, batch_id, group_id, assigned_by)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          batch_id = VALUES(batch_id),
          group_id = VALUES(group_id),
          assigned_by = VALUES(assigned_by),
          assigned_at = CURRENT_TIMESTAMP
      `, [candidateAppNo, targetBatchId, targetGroupId, byUser]);

      await pool.query(`
        INSERT INTO batch_activity_logs (action_type, description, by_user)
        VALUES (?, ?, ?)
      `, ['Move Member', `${memberName || candidateAppNo} moved from ${fromGroupName || 'Group'} → ${toGroupName || 'Target Group'}`, byUser]);

      return res.json({ success: true, message: 'Member moved successfully' });
    } catch (err) {
      console.error('[moveMemberGroup Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/batch-plan/remove-member
  async removeMemberFromGroup(req, res) {
    try {
      const { candidateAppNo, memberName, groupName } = req.body;
      if (!candidateAppNo) {
        return res.status(400).json({ success: false, error: 'Candidate App No is required' });
      }

      const byUser = req.user?.fullName || req.user?.username || 'Admin';

      // IMPORTANT: Removes row from batch_group_members table ONLY.
      // NEVER deletes employee from candidates or employees master table!
      await pool.query(`
        DELETE FROM batch_group_members WHERE candidate_app_no = ?
      `, [candidateAppNo]);

      await pool.query(`
        INSERT INTO batch_activity_logs (action_type, description, by_user)
        VALUES (?, ?, ?)
      `, ['Remove Member', `${memberName || candidateAppNo} removed from ${groupName || 'Group'} (now UNASSIGNED)`, byUser]);

      return res.json({ success: true, message: 'Member removed from group successfully' });
    } catch (err) {
      console.error('[removeMemberFromGroup Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new BatchPlanController();
