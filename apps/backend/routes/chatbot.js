const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { generateRAGAnswer } = require('../utils/ragEngine');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'its-secret-lang';

// Helper to authenticate optional resident token
function getOptionalResident(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && (decoded.role === 'resident' || decoded.role === 'citizen')) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

// POST /api/chatbot/ask - RAG-powered interactive AI assistant endpoint
router.post('/ask', async (req, res) => {
  try {
    const { query, language = 'en', conversationHistory = [] } = req.body;
    const cleanQuery = String(query || '').trim();

    if (!cleanQuery) {
      return res.status(400).json({ message: 'Query is required.' });
    }

    const resident = getOptionalResident(req);

    // Run Retrieval-Augmented Generation
    const ragResult = await generateRAGAnswer({
      query: cleanQuery,
      language,
      resident,
      conversationHistory,
    });

    res.json(ragResult);
  } catch (err) {
    console.error('[chatbot] Error handling RAG ask request:', err);
    res.status(500).json({ message: 'Internal chatbot server error.' });
  }
});
// Resident-to-Admin Messaging Endpoints:

// GET /api/chatbot/messages - Get message history
router.get('/messages', async (req, res) => {
  try {
    const resident = getOptionalResident(req);
    const authHeader = req.headers.authorization;
    let isAdmin = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        if (decoded && (decoded.role === 'admin' || decoded.role === 'Administrator' || decoded.role === 'SuperAdmin')) {
          isAdmin = true;
        }
      } catch {
        // Not admin
      }
    }

    if (isAdmin) {
      const { residentId } = req.query;
      let q = `SELECT * FROM admin_messages`;
      const params = [];
      if (residentId) {
        q += ` WHERE resident_id = $1`;
        params.push(residentId);
      }
      q += ` ORDER BY created_at ASC`;
      const { rows } = await pool.query(q, params);
      return res.json(rows);
    }

    if (!resident) {
      return res.status(401).json({ message: 'Authentication required to view messages.' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM admin_messages
       WHERE resident_id = $1
       ORDER BY created_at ASC`,
      [resident.id]
    );

    // Mark as read by resident
    await pool.query(
      `UPDATE admin_messages
       SET read_by_resident = true
       WHERE resident_id = $1 AND read_by_resident = false`,
      [resident.id]
    );

    res.json(rows);
  } catch (err) {
    console.error('[chatbot] Error fetching messages:', err);
    res.status(500).json({ message: 'Database error retrieving messages.' });
  }
});

// POST /api/chatbot/messages - Resident sends message to admin
router.post('/messages', async (req, res) => {
  try {
    const resident = getOptionalResident(req);
    if (!resident) {
      return res.status(401).json({ message: 'Please sign in to send a message to the barangay admin.' });
    }

    const { message, caseId } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message content is required.' });
    }

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const { rows } = await pool.query(
      `INSERT INTO admin_messages (id, resident_id, resident_name, resident_email, case_id, sender_role, message, read_by_resident, read_by_admin, created_at)
       VALUES ($1, $2, $3, $4, $5, 'resident', $6, true, false, now())
       RETURNING *`,
      [
        msgId,
        resident.id,
        resident.fullName || resident.name || 'Resident',
        resident.email || '',
        caseId || null,
        message.trim(),
      ]
    );

    // Notify admins in notifications table
    await pool.query(
      `INSERT INTO notifications (id, target_role, title, message, type, link, created_at)
       VALUES ($1, 'admin', $2, $3, 'inquiry', '/chatbot-inquiries', now())`,
      [
        `notif-${Date.now()}`,
        `New Resident Inquiry from ${resident.fullName || 'Resident'}`,
        message.trim().substring(0, 140),
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[chatbot] Error sending resident message:', err);
    res.status(500).json({ message: 'Failed to dispatch message.' });
  }
});

// POST /api/chatbot/admin-reply - Admin replies to resident
router.post('/admin-reply', requireAuth, async (req, res) => {
  try {
    const { residentId, message, caseId } = req.body;
    if (!residentId || !message || !message.trim()) {
      return res.status(400).json({ message: 'Resident ID and message content are required.' });
    }

    // Get resident details
    const { rows: resRows } = await pool.query(`SELECT id, full_name, email FROM residents WHERE id = $1`, [residentId]);
    const resident = resRows[0] || { id: residentId, full_name: 'Resident', email: '' };

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const { rows } = await pool.query(
      `INSERT INTO admin_messages (id, resident_id, resident_name, resident_email, case_id, sender_role, message, read_by_resident, read_by_admin, created_at)
       VALUES ($1, $2, $3, $4, $5, 'admin', $6, false, true, now())
       RETURNING *`,
      [
        msgId,
        residentId,
        resident.full_name,
        resident.email,
        caseId || null,
        message.trim(),
      ]
    );

    // Notify resident in notifications table
    await pool.query(
      `INSERT INTO notifications (id, target_role, resident_id, resident_email, title, message, type, link, created_at)
       VALUES ($1, 'resident', $2, $3, 'Official Barangay Admin Reply', $4, 'admin_reply', '/profile', now())`,
      [
        `notif-${Date.now()}`,
        residentId,
        resident.email,
        `Barangay Poblacion Admin replied: "${message.trim().substring(0, 100)}..."`,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[chatbot] Error sending admin reply:', err);
    res.status(500).json({ message: 'Failed to send admin reply.' });
  }
});

// Admin Knowledge Management:

// GET /api/chatbot/knowledge - View all knowledge entries
router.get('/knowledge', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM chatbot_knowledge ORDER BY category ASC, title ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[chatbot] Error fetching knowledge base:', err);
    res.status(500).json({ message: 'Failed to load knowledge base.' });
  }
});

// POST /api/chatbot/knowledge - Add new knowledge entry (admin only)
router.post('/knowledge', requireAuth, async (req, res) => {
  try {
    const { category, title, keywords, answerEn, answerFil, answerCeb } = req.body;
    if (!category || !title || !answerEn) {
      return res.status(400).json({ message: 'Category, title, and English answer are required.' });
    }

    const id = `kb-${Date.now()}`;
    const kw = Array.isArray(keywords)
      ? keywords
      : typeof keywords === 'string'
      ? keywords.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const { rows } = await pool.query(
      `INSERT INTO chatbot_knowledge (id, category, title, keywords, answer_en, answer_fil, answer_ceb, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       RETURNING *`,
      [id, category.trim(), title.trim(), JSON.stringify(kw), answerEn.trim(), answerFil || null, answerCeb || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[chatbot] Error creating knowledge item:', err);
    res.status(500).json({ message: 'Failed to create knowledge entry.' });
  }
});

// PUT /api/chatbot/knowledge/:id - Update knowledge entry (admin only)
router.put('/knowledge/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, title, keywords, answerEn, answerFil, answerCeb, isActive } = req.body;

    const kw = keywords !== undefined
      ? Array.isArray(keywords)
        ? keywords
        : typeof keywords === 'string'
        ? keywords.split(',').map((s) => s.trim()).filter(Boolean)
        : []
      : null;

    const { rows } = await pool.query(
      `UPDATE chatbot_knowledge
       SET category = COALESCE($1, category),
           title = COALESCE($2, title),
           keywords = CASE WHEN $3::jsonb IS NOT NULL THEN $3::jsonb ELSE keywords END,
           answer_en = COALESCE($4, answer_en),
           answer_fil = COALESCE($5, answer_fil),
           answer_ceb = COALESCE($6, answer_ceb),
           is_active = COALESCE($7, is_active),
           updated_at = now()
       WHERE id = $8
       RETURNING *`,
      [
        category ? category.trim() : null,
        title ? title.trim() : null,
        kw ? JSON.stringify(kw) : null,
        answerEn ? answerEn.trim() : null,
        answerFil !== undefined ? answerFil : null,
        answerCeb !== undefined ? answerCeb : null,
        isActive !== undefined ? isActive : null,
        id,
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Knowledge entry not found.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[chatbot] Error updating knowledge item:', err);
    res.status(500).json({ message: 'Failed to update knowledge entry.' });
  }
});

// DELETE /api/chatbot/knowledge/:id - Delete knowledge entry (admin only)
router.delete('/knowledge/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(`DELETE FROM chatbot_knowledge WHERE id = $1`, [id]);
    if (rowCount === 0) {
      return res.status(404).json({ message: 'Knowledge entry not found.' });
    }
    res.json({ success: true, message: 'Knowledge entry deleted.' });
  } catch (err) {
    console.error('[chatbot] Error deleting knowledge item:', err);
    res.status(500).json({ message: 'Failed to delete knowledge entry.' });
  }
});

// GET /api/chatbot/unanswered - Admin view of logged unanswered resident queries
router.get('/unanswered', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM chatbot_unanswered_logs
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    console.error('[chatbot] Error fetching unanswered logs:', err);
    res.status(500).json({ message: 'Failed to load unanswered query logs.' });
  }
});

// PUT /api/chatbot/unanswered/:id - Resolve or add admin notes
router.put('/unanswered/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const { rows } = await pool.query(
      `UPDATE chatbot_unanswered_logs
       SET status = COALESCE($1, status),
           admin_notes = COALESCE($2, admin_notes)
       WHERE id = $3
       RETURNING *`,
      [status, adminNotes, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Log not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[chatbot] Error updating unanswered log:', err);
    res.status(500).json({ message: 'Failed to update log.' });
  }
});

module.exports = router;
