const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { isCloudinaryConfigured, uploadToCloudinary, deleteLocalUpload } = require('../utils/cloudinary');

const router = express.Router();
// GET is public: announcements are shown on the resident dashboard
// before/without login context in the original portal design (see README
// API table: Auth "—"). Writes require an authenticated admin — applied
// per-route below rather than with router.use(), so GET stays public.

// ---- Upload setup: optional announcement image ----
const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'announcements');
fs.mkdirSync(IMAGE_DIR, { recursive: true });

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, IMAGE_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `announcement-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
});

function toAnnouncement(a) {
  return {
    id: a.id,
    title: a.title,
    tag: a.tag,
    body: a.body,
    eventDate: a.event_date,
    imageUrl: a.image_url,
    createdAt: a.created_at,
  };
}

function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  const filePath = path.join(__dirname, '..', imageUrl.replace(/^\//, ''));
  fs.unlink(filePath, () => {}); // best-effort; fine if it's already gone
}

// GET /api/announcements
router.get('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload && payload.scope === 'resident') {
          const { rows } = await pool.query('SELECT status FROM residents WHERE id = $1', [payload.id]);
          if (rows.length > 0 && rows[0].status !== 'Verified') {
            return res.json([]);
          }
        }
      } catch {
        // invalid or expired token, ignore
      }
    }

    const { rows } = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(rows.map(toAnnouncement));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading announcements.' });
  }
});

// GET /api/announcements/:id
router.get('/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload && payload.scope === 'resident') {
          const { rows } = await pool.query('SELECT status FROM residents WHERE id = $1', [payload.id]);
          if (rows.length > 0 && rows[0].status !== 'Verified') {
            return res.status(403).json({ message: 'Verified resident account required.' });
          }
        }
      } catch {
        // ignore invalid token for public read
      }
    }

    const { rows } = await pool.query('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    res.json(toAnnouncement(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error retrieving announcement.' });
  }
});

function getTodayManilaDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

// POST /api/announcements  (admin only, multipart — optional "image" file)
router.post('/', requireAuth, (req, res) => {
  imageUpload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'Unable to upload image.' });
    }
    try {
      const { title, tag, body, eventDate } = req.body;
      if (!title || !title.trim()) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: 'Title is required.' });
      }

      if (eventDate) {
        const cleanEventDate = String(eventDate).split('T')[0];
        const todayManila = getTodayManilaDateString();
        if (cleanEventDate < todayManila) {
          if (req.file) fs.unlink(req.file.path, () => {});
          return res.status(400).json({ message: 'Event date cannot be in the past. Please select today or a future date.' });
        }
      }

      const id = `ann-${uuidv4().slice(0, 8)}`;
      let imageUrl = null;
      if (req.file) {
        if (isCloudinaryConfigured()) {
          imageUrl = await uploadToCloudinary(req.file, 'barangay/announcements');
          await deleteLocalUpload(req.file);
        } else {
          imageUrl = `/uploads/announcements/${req.file.filename}`;
        }
      }

      const { rows } = await pool.query(
        `INSERT INTO announcements (id, title, tag, body, event_date, image_url)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, title.trim(), tag || null, body || null, eventDate || null, imageUrl]
      );

      res.status(201).json(toAnnouncement(rows[0]));
    } catch (err) {
      console.error(err);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ message: 'Database error creating announcement.' });
    }
  });
});

// PUT /api/announcements/:id  (admin only, multipart — optional new "image" file)
router.put('/:id', requireAuth, (req, res) => {
  imageUpload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'Unable to upload image.' });
    }
    try {
      const { rows: existingRows } = await pool.query('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
      if (existingRows.length === 0) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(404).json({ message: 'Announcement not found.' });
      }

      const existing = toAnnouncement(existingRows[0]);
      const merged = { ...existing, ...req.body };
      if (!merged.title || !merged.title.trim()) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: 'Title is required.' });
      }

      // Check if eventDate was updated to a past date
      if (merged.eventDate) {
        const cleanEventDate = String(merged.eventDate).split('T')[0];
        const existingEventDate = existing.eventDate ? String(existing.eventDate).split('T')[0] : '';
        const todayManila = getTodayManilaDateString();

        // If the date is being changed or newly set, prevent past dates
        if (cleanEventDate !== existingEventDate && cleanEventDate < todayManila) {
          if (req.file) fs.unlink(req.file.path, () => {});
          return res.status(400).json({ message: 'Event date cannot be in the past. Please select today or a future date.' });
        }
      }

      let imageUrl = existing.imageUrl;
      if (req.file) {
        deleteImageFile(existing.imageUrl);
        if (isCloudinaryConfigured()) {
          const uploadedUrl = await uploadToCloudinary(req.file, 'barangay/announcements');
          imageUrl = uploadedUrl || `/uploads/announcements/${req.file.filename}`;
          await deleteLocalUpload(req.file);
        } else {
          imageUrl = `/uploads/announcements/${req.file.filename}`;
        }
      } else if (req.body.removeImage === 'true') {
        deleteImageFile(existing.imageUrl);
        imageUrl = null;
      }

      const { rows } = await pool.query(
        `UPDATE announcements SET title=$1, tag=$2, body=$3, event_date=$4, image_url=$5 WHERE id=$6 RETURNING *`,
        [merged.title.trim(), merged.tag || null, merged.body || null, merged.eventDate || null, imageUrl, req.params.id]
      );

      res.json(toAnnouncement(rows[0]));
    } catch (err) {
      console.error(err);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ message: 'Database error updating announcement.' });
    }
  });
});

// DELETE /api/announcements/:id  (admin only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING *', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Announcement not found.' });
    deleteImageFile(rows[0].image_url);
    res.json(toAnnouncement(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error deleting announcement.' });
  }
});

module.exports = router;
