const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

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

// Strict Out-of-Domain Filter
const OUT_OF_DOMAIN_PATTERNS = [
  /\b(write|generate|debug|code|program|python|javascript|java|c\+\+|html|css|sql|script)\b/i,
  /\b(homework|assignment|algebra|solve this equation|math problem|calculus)\b/i,
  /\b(movie|celebrity|hollywood|netflix|actor|actress|singer|song|album|rap|nba|football|premier league|gaming|fortnite|minecraft)\b/i,
  /\b(joke|riddle|poem|story|fairy tale|weather in (new york|paris|london|tokyo)|capital of)\b/i,
  /\b(crypto|bitcoin|forex|stock market|trading|ethereum)\b/i,
  /\b(who is the president of (the united states|america|france|russia|china))\b/i,
];

const STRICT_OUT_OF_DOMAIN_REPLY =
  "I'm the Barangay AI Assistant. I can only assist with barangay services, complaints, announcements, and other barangay-related concerns. How can I help you with your barangay concern?";

// POST /api/chatbot/ask - Main interactive AI assistant endpoint
router.post('/ask', async (req, res) => {
  try {
    const { query, language = 'en', caseId } = req.body;
    const cleanQuery = String(query || '').trim();

    if (!cleanQuery) {
      return res.status(400).json({ message: 'Query is required.' });
    }

    const resident = getOptionalResident(req);

    // 1. Strict Out-of-Domain Check
    const isOutOfDomain = OUT_OF_DOMAIN_PATTERNS.some((pattern) => pattern.test(cleanQuery));
    if (isOutOfDomain) {
      return res.json({
        reply: STRICT_OUT_OF_DOMAIN_REPLY,
        isBarangayDomain: false,
        source: 'guardrail',
      });
    }

    const lowerQuery = cleanQuery.toLowerCase();

    // 2. Complaint Tracking Check
    const isComplaintTrackingQuery =
      lowerQuery.includes('complaint') ||
      lowerQuery.includes('reklamo') ||
      lowerQuery.includes('case') ||
      lowerQuery.includes('status') ||
      lowerQuery.includes('blotter') ||
      lowerQuery.includes('hearing') ||
      lowerQuery.includes('mediation') ||
      caseId;

    if (isComplaintTrackingQuery && (lowerQuery.includes('my') || lowerQuery.includes('status') || lowerQuery.includes('how is') || caseId)) {
      if (!resident) {
        return res.json({
          reply:
            language === 'fil'
              ? 'Maaari kitang tulungang suriin ang estado ng iyong reklamo. Mangyaring mag-sign in muna sa iyong account upang ligtas at opisyal kong makuha ang pinakabagong update.'
              : language === 'ceb'
              ? 'Makatabang ko nimo sa pagsusi sa kahimtang sa imong reklamo. Palihog pag-sign in una sa imong account aron opisyal nako makuha ang pinakabag-ong update.'
              : 'I can help you check your complaint status. Please sign in to your account and select your complaint so I can retrieve its latest status.',
          requireAuth: true,
          source: 'complaint_tracking',
        });
      }

      // Authenticated resident: retrieve REAL complaint records only
      let complaintsQuery = `
        SELECT id, category, status, filing_date, description, narrative,
               hearing_stage, mediation_date, mediation_time, mediation_venue,
               under_review_at, in_progress_at, resolved_at, created_at
        FROM complaints
        WHERE filed_by_resident_id = $1 OR LOWER(resident) = LOWER($2)
      `;
      const queryParams = [resident.id, resident.fullName || resident.name || ''];

      // If specific case number was provided or extracted
      const caseMatch = cleanQuery.match(/(CASE-[0-9]{4}-[0-9]{3}|#?[0-9]{3,6})/i);
      const targetCaseId = caseId || (caseMatch ? caseMatch[0].replace('#', '') : null);

      if (targetCaseId) {
        complaintsQuery += ` AND (LOWER(id) = LOWER($3) OR id LIKE '%' || $3 || '%')`;
        queryParams.push(targetCaseId);
      }

      complaintsQuery += ` ORDER BY created_at DESC LIMIT 3`;

      const { rows: complaints } = await pool.query(complaintsQuery, queryParams);

      if (complaints.length > 0) {
        const primary = complaints[0];
        const updateDate = primary.resolved_at || primary.in_progress_at || primary.under_review_at || primary.created_at || primary.filing_date;
        const formattedDate = updateDate ? new Date(updateDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'recently';

        let replyText = `Your complaint #${primary.id} (${primary.category || 'General Concern'}) is currently ${primary.status}. The last status update was on ${formattedDate}.`;
        
        if (primary.mediation_date) {
          replyText += ` A mediation hearing is scheduled on ${primary.mediation_date} at ${primary.mediation_venue || 'Barangay Poblacion Session Hall'}.`;
        }

        replyText += ` For additional information or follow-up questions, you can message the barangay admin directly here.`;

        if (language === 'fil') {
          replyText = `Ang iyong reklamo #${primary.id} (${primary.category || 'Pangkalahatang Reklamo'}) ay kasalukuyang ${primary.status}. Ang huling update ay noong ${formattedDate}. Para sa karagdagang impormasyon o follow-up, maaari kang mag-iwan ng mensahe sa barangay admin dito.`;
        } else if (language === 'ceb') {
          replyText = `Ang imong reklamo #${primary.id} (${primary.category || 'Reklamo'}) anaa karon sa estado nga ${primary.status}. Ang pinakabag-ong update natala niadtong ${formattedDate}. Alang sa dugang impormasyon, pwede ka magpadala og mensahe sa barangay admin dinhi.`;
        }

        return res.json({
          reply: replyText,
          complaints: complaints.map((c) => ({
            id: c.id,
            category: c.category,
            status: c.status,
            filingDate: c.filing_date,
            hearingStage: c.hearing_stage,
            mediationDate: c.mediation_date,
            mediationVenue: c.mediation_venue,
          })),
          canMessageAdmin: true,
          caseId: primary.id,
          source: 'complaint_tracking',
        });
      } else {
        const notFoundText = targetCaseId
          ? `I could not locate complaint #${targetCaseId} under your verified resident records. Please check the reference number or message the barangay admin for assistance.`
          : `I could not find an active complaint registered under your account. If you believe this is an error or recently filed in person at the Barangay Hall, you may message the barangay admin here.`;

        return res.json({
          reply: notFoundText,
          canMessageAdmin: true,
          source: 'complaint_tracking',
        });
      }
    }

    // 3. Live Community Announcements Query
    if (lowerQuery.includes('announcement') || lowerQuery.includes('event') || lowerQuery.includes('clean-up') || lowerQuery.includes('activity')) {
      const { rows: announcements } = await pool.query(
        `SELECT id, title, tag, body, event_date, created_at
         FROM announcements
         ORDER BY created_at DESC
         LIMIT 3`
      );

      if (announcements.length > 0) {
        const latest = announcements[0];
        let reply = `Here is the latest official announcement from Barangay Poblacion:
• ${latest.title} [${latest.tag || 'Community'}]: ${latest.body}`;
        if (latest.event_date) {
          reply += ` (Scheduled Date: ${latest.event_date})`;
        }
        return res.json({
          reply,
          announcements,
          source: 'announcements',
        });
      }
    }

    // 4. Knowledge Base Match
    const { rows: knowledgeList } = await pool.query(
      `SELECT id, category, title, keywords, answer_en, answer_fil, answer_ceb
       FROM chatbot_knowledge
       WHERE is_active = true`
    );

    let bestMatch = null;
    let highestScore = 0;

    for (const kb of knowledgeList) {
      let score = 0;
      const kwArray = Array.isArray(kb.keywords)
        ? kb.keywords
        : typeof kb.keywords === 'string'
        ? JSON.parse(kb.keywords || '[]')
        : [];

      for (const kw of kwArray) {
        if (lowerQuery.includes(String(kw).toLowerCase())) {
          score += 3;
        }
      }

      if (lowerQuery.includes(kb.category.toLowerCase())) {
        score += 2;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = kb;
      }
    }

    if (bestMatch && highestScore >= 3) {
      let chosenAnswer = bestMatch.answer_en;
      if (language === 'fil' && bestMatch.answer_fil) chosenAnswer = bestMatch.answer_fil;
      if (language === 'ceb' && bestMatch.answer_ceb) chosenAnswer = bestMatch.answer_ceb;

      return res.json({
        reply: chosenAnswer,
        category: bestMatch.category,
        title: bestMatch.title,
        source: 'knowledge_base',
      });
    }

    // 5. Fallback & Log Unanswered Question
    await pool.query(
      `INSERT INTO chatbot_unanswered_logs (id, resident_id, resident_name, query, language, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending_review', now())`,
      [
        `unans-${Date.now()}`,
        resident ? resident.id : null,
        resident ? (resident.fullName || resident.name) : 'Guest Resident',
        cleanQuery,
        language,
      ]
    );

    const fallbackReply =
      language === 'fil'
        ? 'Paumanhin, wala pa akong beripikadong impormasyon sa rekord ng barangay ukol sa partikular na katanungang ito. Maaari kang magpadala ng direktang mensahe sa Barangay Admin dito o bumisita sa Barangay Poblacion Hall (Lunes hanggang Biyernes, 8:00 AM - 5:00 PM).'
        : language === 'ceb'
        ? 'Pasayloa, wala pa koy opisyal nga rekord sa barangay mahitungod niini nga pangutana. Pwede ka magbilin og direktang mensahe sa Barangay Admin dinhi o mobisita sa Barangay Poblacion Hall (Lunes hangtod Biyernes, 8:00 AM - 5:00 PM).'
        : "I don't have verified records regarding that specific inquiry in our barangay database. For official guidance, you may message the barangay admin directly here or visit the Barangay Poblacion Hall (Mon-Fri 8:00 AM - 5:00 PM).";

    return res.json({
      reply: fallbackReply,
      canMessageAdmin: true,
      source: 'unanswered_fallback',
    });
  } catch (err) {
    console.error('[chatbot] Error handling ask request:', err);
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
