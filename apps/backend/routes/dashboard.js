const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard/overview
router.get('/overview', async (req, res) => {
  try {
    const { rows: complaintStatRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status <> 'Resolved')::int AS pending,
        COUNT(*) FILTER (WHERE priority = 'High')::int AS high_priority
      FROM complaints
    `);
    // Matches the same exclusion as GET /api/residents: self-registered
    // accounts still awaiting approval aren't "enrolled" yet.
    const { rows: residentCountRows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM residents WHERE NOT (self_registered = true AND status = 'Pending')`
    );

    const { rows: recentComplaints } = await pool.query(
      'SELECT * FROM complaints ORDER BY created_at DESC LIMIT 10'
    );
    const { rows: recentMeetings } = await pool.query(
      'SELECT * FROM meetings ORDER BY date DESC, created_at DESC LIMIT 1'
    );
    const { rows: pendingResidents } = await pool.query(
      `SELECT id, full_name, email, created_at FROM residents 
       WHERE self_registered = true AND status = 'Pending' 
       ORDER BY created_at DESC LIMIT 10`
    );
    const { rows: pendingAccess } = await pool.query(
      `SELECT id, full_name, email, department, requested_at FROM access_requests 
       WHERE status = 'pending' AND (email_verified = true OR email_verified IS NULL)
       ORDER BY requested_at DESC LIMIT 10`
    );

    const recentActivity = [
      ...pendingResidents.map((r) => ({
        type: 'pending_resident',
        id: `pending-resident-${r.id}`,
        createdAt: r.created_at,
        title: 'New Resident Registration',
        detail: `${r.full_name || 'A new resident'} submitted an account registration with ID for verification.`,
        when: 'Recently',
        link: '/pending-requests',
      })),
      ...pendingAccess.map((a) => ({
        type: 'pending_access',
        id: `pending-access-${a.id}`,
        createdAt: a.requested_at,
        title: 'New Staff Access Request',
        detail: `${a.full_name || 'Staff member'} requested administrative access (${a.department || 'Barangay Staff'}).`,
        when: 'Recently',
        link: '/pending-requests',
      })),
      ...recentComplaints.map((c) => ({
        type: 'case',
        id: c.id,
        filedByResidentId: c.filed_by_resident_id,
        createdAt: c.created_at,
        title: `New Case Filed: #${c.id}`,
        detail: `Resident ${c.resident || 'Resident'} registered a ${(c.category || 'formal').toLowerCase()} complaint.`,
        when: 'Recently',
        link: `/complaints/${c.id}`,
      })),
      ...recentMeetings.map((m) => ({
        type: 'meeting',
        title: 'Session Adjourned',
        detail: `${m.title || 'Barangay Session'} concluded. Minutes and proposed resolutions have been uploaded to the archives.`,
        when: 'Yesterday',
        link: '/meetings',
      })),
    ];

    res.json({
      totalPopulation: 12482,
      totalEnrolledResidents: residentCountRows[0].count,
      pendingComplaints: complaintStatRows[0].pending,
      highPriorityComplaints: complaintStatRows[0].high_priority,
      activeProjects: 8,
      activeProjectsCompletionPct: 75,
      recentActivity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading dashboard.' });
  }
});

// GET /api/dashboard/notifications
// Retrieves admin-targeted notifications
router.get('/notifications', async (req, res) => {
  try {
    const adminId = req.user?.id || req.user?.userId || null;
    const { rows } = await pool.query(
      `SELECT id, target_role, admin_id, resident_id, case_id, title, message, type, link, read,
              actor_name, actor_avatar, created_at
       FROM notifications
       WHERE target_role = 'admin' OR admin_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [adminId]
    );

    // If notifications table has few or no records yet, synthesize recent activity so admins see pending items
    let notifs = rows.map((n) => ({
      id: n.id,
      targetRole: n.target_role,
      adminId: n.admin_id,
      residentId: n.resident_id,
      caseId: n.case_id,
      title: n.title,
      message: n.message,
      type: n.type,
      link: n.link,
      read: !!n.read,
      actorName: n.actor_name,
      actorAvatar: n.actor_avatar,
      createdAt: n.created_at,
    }));

    if (notifs.length === 0) {
      const { rows: pendingResidents } = await pool.query(
        `SELECT id, full_name, email, photo_url, selfie_id_url, created_at FROM residents 
         WHERE self_registered = true AND status = 'Pending' 
         ORDER BY created_at DESC LIMIT 15`
      );
      const { rows: pendingAccess } = await pool.query(
        `SELECT id, full_name, email, department, selfie_id_url, requested_at FROM access_requests 
         WHERE status = 'pending' AND (email_verified = true OR email_verified IS NULL)
         ORDER BY requested_at DESC LIMIT 15`
      );
      const { rows: recentComplaints } = await pool.query(
        `SELECT id, resident, category, created_at FROM complaints ORDER BY created_at DESC LIMIT 15`
      );

      const synthesized = [
        ...pendingResidents.map((r) => ({
          id: `syn-res-${r.id}`,
          title: 'New Resident Registration',
          message: `${r.full_name || 'A resident'} submitted an account registration with ID for verification.`,
          type: 'pending_resident',
          link: '/pending-requests',
          read: false,
          actorName: r.full_name || 'Resident Applicant',
          actorAvatar: r.selfie_id_url || r.photo_url || null,
          createdAt: r.created_at,
        })),
        ...pendingAccess.map((a) => ({
          id: `syn-acc-${a.id}`,
          title: 'New Staff Access Request',
          message: `${a.full_name || 'Staff member'} requested administrative access (${a.department || 'Barangay Staff'}).`,
          type: 'pending_access',
          link: '/pending-requests',
          read: false,
          actorName: a.full_name || 'Staff Applicant',
          actorAvatar: a.selfie_id_url || null,
          createdAt: a.requested_at,
        })),
        ...recentComplaints.map((c) => ({
          id: `syn-case-${c.id}`,
          title: `New Case Filed: #${c.id}`,
          message: `${c.resident || 'Resident'} filed a ${String(c.category || 'formal').toLowerCase()} complaint.`,
          type: 'case',
          link: `/complaints/${c.id}`,
          read: false,
          actorName: c.resident || 'Barangay Citizen',
          actorAvatar: null,
          createdAt: c.created_at,
        })),
      ];

      synthesized.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      notifs = synthesized;
    }

    res.json(notifs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading admin notifications.' });
  }
});

// POST /api/dashboard/notifications/mark-read
// Marks specific or all admin notifications as read
router.post('/notifications/mark-read', async (req, res) => {
  try {
    const { id } = req.body || {};
    const adminId = req.user?.id || req.user?.userId || null;

    if (id) {
      await pool.query(
        `UPDATE notifications SET read = true
         WHERE id = $1 AND (target_role = 'admin' OR admin_id = $2)`,
        [id, adminId]
      );
    } else {
      await pool.query(
        `UPDATE notifications SET read = true
         WHERE target_role = 'admin' OR admin_id = $1`,
        [adminId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating notifications.' });
  }
});

module.exports = router;
