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

module.exports = router;
