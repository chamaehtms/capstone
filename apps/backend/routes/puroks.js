const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireResidentAuth } = require('../middleware/auth');

const router = express.Router();

// Helper to authenticate either admin or resident (or public read for registered puroks)
// GET /api/puroks - List all official puroks with coordinates, boundaries, landmarks
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, center_lat, center_lng, zoom_level, boundary_geojson, landmarks, created_at, updated_at
       FROM puroks_zones
       ORDER BY name ASC`
    );

    const puroks = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      centerLat: Number(r.center_lat),
      centerLng: Number(r.center_lng),
      zoomLevel: r.zoom_level || 16,
      boundaryGeojson: r.boundary_geojson,
      landmarks: typeof r.landmarks === 'string' ? JSON.parse(r.landmarks || '[]') : (r.landmarks || []),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json(puroks);
  } catch (err) {
    console.error('[puroks] Error fetching puroks:', err);
    res.status(500).json({ message: 'Database error loading purok zones.' });
  }
});

// GET /api/puroks/:id - Single purok/zone by ID or Name
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT id, name, description, center_lat, center_lng, zoom_level, boundary_geojson, landmarks, created_at, updated_at
       FROM puroks_zones
       WHERE id = $1 OR LOWER(name) = LOWER($1)
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Purok/Zone not found.' });
    }

    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      description: r.description || '',
      centerLat: Number(r.center_lat),
      centerLng: Number(r.center_lng),
      zoomLevel: r.zoom_level || 16,
      boundaryGeojson: r.boundary_geojson,
      landmarks: typeof r.landmarks === 'string' ? JSON.parse(r.landmarks || '[]') : (r.landmarks || []),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (err) {
    console.error('[puroks] Error fetching single purok:', err);
    res.status(500).json({ message: 'Database error loading purok details.' });
  }
});

// Admin-only management endpoints:

// POST /api/puroks - Create new official Purok/Zone
router.post('/', requireAuth, async (req, res) => {
  try {
    const { id, name, description, centerLat, centerLng, zoomLevel, boundaryGeojson, landmarks } = req.body;
    if (!name || centerLat == null || centerLng == null) {
      return res.status(400).json({ message: 'Name, center latitude, and center longitude are required.' });
    }

    const zoneId = id || `pz-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const { rows } = await pool.query(
      `INSERT INTO puroks_zones (id, name, description, center_lat, center_lng, zoom_level, boundary_geojson, landmarks, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         center_lat = EXCLUDED.center_lat,
         center_lng = EXCLUDED.center_lng,
         zoom_level = EXCLUDED.zoom_level,
         boundary_geojson = EXCLUDED.boundary_geojson,
         landmarks = EXCLUDED.landmarks,
         updated_at = now()
       RETURNING *`,
      [
        zoneId,
        name.trim(),
        description || '',
        Number(centerLat),
        Number(centerLng),
        zoomLevel || 16,
        boundaryGeojson ? JSON.stringify(boundaryGeojson) : null,
        JSON.stringify(landmarks || []),
      ]
    );

    const r = rows[0];
    res.status(201).json({
      id: r.id,
      name: r.name,
      description: r.description,
      centerLat: Number(r.center_lat),
      centerLng: Number(r.center_lng),
      zoomLevel: r.zoom_level,
      boundaryGeojson: r.boundary_geojson,
      landmarks: r.landmarks,
    });
  } catch (err) {
    console.error('[puroks] Error creating purok:', err);
    res.status(500).json({ message: 'Database error saving purok.' });
  }
});

// PUT /api/puroks/:id - Update existing Purok/Zone
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, centerLat, centerLng, zoomLevel, boundaryGeojson, landmarks } = req.body;

    const { rows } = await pool.query(
      `UPDATE puroks_zones
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           center_lat = COALESCE($3, center_lat),
           center_lng = COALESCE($4, center_lng),
           zoom_level = COALESCE($5, zoom_level),
           boundary_geojson = COALESCE($6, boundary_geojson),
           landmarks = COALESCE($7, landmarks),
           updated_at = now()
       WHERE id = $8 OR LOWER(name) = LOWER($8)
       RETURNING *`,
      [
        name ? name.trim() : null,
        description !== undefined ? description : null,
        centerLat != null ? Number(centerLat) : null,
        centerLng != null ? Number(centerLng) : null,
        zoomLevel != null ? Number(zoomLevel) : null,
        boundaryGeojson ? JSON.stringify(boundaryGeojson) : null,
        landmarks ? JSON.stringify(landmarks) : null,
        id,
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Purok/Zone not found.' });
    }

    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      description: r.description,
      centerLat: Number(r.center_lat),
      centerLng: Number(r.center_lng),
      zoomLevel: r.zoom_level,
      boundaryGeojson: r.boundary_geojson,
      landmarks: r.landmarks,
    });
  } catch (err) {
    console.error('[puroks] Error updating purok:', err);
    res.status(500).json({ message: 'Database error updating purok.' });
  }
});

// DELETE /api/puroks/:id - Delete Purok/Zone
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      `DELETE FROM puroks_zones WHERE id = $1 OR LOWER(name) = LOWER($1)`,
      [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: 'Purok/Zone not found.' });
    }
    res.json({ success: true, message: 'Purok deleted successfully.' });
  } catch (err) {
    console.error('[puroks] Error deleting purok:', err);
    res.status(500).json({ message: 'Database error deleting purok.' });
  }
});

module.exports = router;
