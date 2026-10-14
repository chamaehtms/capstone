const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function toHousehold(h) {
  let members = [];
  try {
    members = typeof h.members === 'string' ? JSON.parse(h.members) : h.members || [];
  } catch {
    members = [];
  }

  return {
    id: h.id,
    householdNo: h.household_no,
    headResidentId: h.head_resident_id,
    headName: h.head_name,
    purokZone: h.purok_zone,
    address: h.address,
    incomeClass: h.income_class,
    housingType: h.housing_type,
    toiletFacility: h.toilet_facility,
    waterSource: h.water_source,
    wasteManagement: h.waste_management,
    is4psBeneficiary: Boolean(h.is_4ps_beneficiary),
    isIndigent: Boolean(h.is_indigent),
    members,
    remarks: h.remarks || '',
    createdAt: h.created_at,
    updatedAt: h.updated_at,
  };
}

// GET /api/households - List all households with filtering and search
router.get('/', async (req, res) => {
  try {
    const { search, zone, incomeClass, is4ps } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(household_no) LIKE $${params.length} OR LOWER(head_name) LIKE $${params.length} OR LOWER(address) LIKE $${params.length})`);
    }

    if (zone && zone !== 'all') {
      params.push(zone);
      conditions.push(`purok_zone = $${params.length}`);
    }

    if (incomeClass && incomeClass !== 'all') {
      params.push(incomeClass);
      conditions.push(`income_class = $${params.length}`);
    }

    if (is4ps === 'true') {
      conditions.push(`is_4ps_beneficiary = true`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM households ${whereClause} ORDER BY created_at DESC`;
    const { rows } = await pool.query(query, params);

    // Compute summary statistics
    const { rows: statsRows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total_households,
        COUNT(*) FILTER (WHERE is_4ps_beneficiary = true)::int AS total_4ps,
        COUNT(*) FILTER (WHERE is_indigent = true)::int AS total_indigent
      FROM households
    `);

    // Calculate total individuals across all households
    const totalMembers = rows.reduce((acc, h) => {
      const mList = Array.isArray(h.members) ? h.members : [];
      // Head is 1 + other members
      return acc + 1 + mList.length;
    }, 0);

    res.json({
      households: rows.map(toHousehold),
      stats: {
        totalHouseholds: statsRows[0]?.total_households || 0,
        totalMembers: totalMembers,
        total4ps: statsRows[0]?.total_4ps || 0,
        totalIndigent: statsRows[0]?.total_indigent || 0,
      },
    });
  } catch (err) {
    console.error('[HOUSEHOLDS GET] Error:', err);
    res.status(500).json({ message: 'Database error fetching households.' });
  }
});

// GET /api/households/:id - Get single household detail
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM households WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Household not found.' });
    }
    res.json(toHousehold(rows[0]));
  } catch (err) {
    console.error('[HOUSEHOLDS GET BY ID] Error:', err);
    res.status(500).json({ message: 'Database error retrieving household.' });
  }
});

// POST /api/households - Create new household record
router.post('/', async (req, res) => {
  try {
    const {
      householdNo,
      headResidentId,
      headName,
      purokZone,
      address,
      incomeClass = 'Low Income',
      housingType = 'Concrete / Permanent',
      toiletFacility = 'Water-sealed / Flush',
      waterSource = 'Piped Water Connection',
      wasteManagement = 'Barangay Collection',
      is4psBeneficiary = false,
      isIndigent = false,
      members = [],
      remarks = '',
    } = req.body;

    if (!headName?.trim() || !purokZone?.trim() || !address?.trim()) {
      return res.status(400).json({ message: 'Head of household name, Purok/Zone, and Address are required.' });
    }

    // Auto-generate household number if not provided: HH-YYYY-XXXX
    let finalHouseholdNo = (householdNo || '').trim();
    if (!finalHouseholdNo) {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      finalHouseholdNo = `HH-${year}-${rand}`;
    }

    // Check if household number already exists
    const { rows: existingRows } = await pool.query(
      'SELECT id FROM households WHERE LOWER(household_no) = LOWER($1)',
      [finalHouseholdNo]
    );
    if (existingRows.length > 0) {
      return res.status(400).json({ message: `Household number "${finalHouseholdNo}" is already in use.` });
    }

    const id = `hh-${uuidv4().slice(0, 8)}`;
    const { rows } = await pool.query(
      `INSERT INTO households
        (id, household_no, head_resident_id, head_name, purok_zone, address, income_class,
         housing_type, toilet_facility, water_source, waste_management, is_4ps_beneficiary,
         is_indigent, members, remarks, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now())
       RETURNING *`,
      [
        id,
        finalHouseholdNo,
        headResidentId || null,
        headName.trim(),
        purokZone.trim(),
        address.trim(),
        incomeClass,
        housingType,
        toiletFacility,
        waterSource,
        wasteManagement,
        Boolean(is4psBeneficiary),
        Boolean(isIndigent),
        JSON.stringify(members || []),
        remarks.trim(),
      ]
    );

    res.status(201).json(toHousehold(rows[0]));
  } catch (err) {
    console.error('[HOUSEHOLDS POST] Error:', err);
    res.status(500).json({ message: 'Database error creating household: ' + (err.message || 'Server error') });
  }
});

// PUT /api/households/:id - Update household record
router.put('/:id', async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM households WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Household not found.' });
    }

    const current = existingRows[0];
    const {
      householdNo = current.household_no,
      headResidentId = current.head_resident_id,
      headName = current.head_name,
      purokZone = current.purok_zone,
      address = current.address,
      incomeClass = current.income_class,
      housingType = current.housing_type,
      toiletFacility = current.toilet_facility,
      waterSource = current.water_source,
      wasteManagement = current.waste_management,
      is4psBeneficiary = current.is_4ps_beneficiary,
      isIndigent = current.is_indigent,
      members = current.members,
      remarks = current.remarks,
    } = req.body;

    // Check unique household number excluding self
    if (householdNo && householdNo.trim() !== current.household_no) {
      const { rows: dupRows } = await pool.query(
        'SELECT id FROM households WHERE LOWER(household_no) = LOWER($1) AND id <> $2',
        [householdNo.trim(), req.params.id]
      );
      if (dupRows.length > 0) {
        return res.status(400).json({ message: `Household number "${householdNo}" is already in use.` });
      }
    }

    const { rows } = await pool.query(
      `UPDATE households
       SET household_no = $1, head_resident_id = $2, head_name = $3, purok_zone = $4, address = $5,
           income_class = $6, housing_type = $7, toilet_facility = $8, water_source = $9,
           waste_management = $10, is_4ps_beneficiary = $11, is_indigent = $12, members = $13,
           remarks = $14, updated_at = now()
       WHERE id = $15
       RETURNING *`,
      [
        householdNo.trim(),
        headResidentId || null,
        headName.trim(),
        purokZone.trim(),
        address.trim(),
        incomeClass,
        housingType,
        toiletFacility,
        waterSource,
        wasteManagement,
        Boolean(is4psBeneficiary),
        Boolean(isIndigent),
        JSON.stringify(members || []),
        remarks.trim(),
        req.params.id,
      ]
    );

    res.json(toHousehold(rows[0]));
  } catch (err) {
    console.error('[HOUSEHOLDS PUT] Error:', err);
    res.status(500).json({ message: 'Database error updating household: ' + (err.message || 'Server error') });
  }
});

// DELETE /api/households/:id - Delete household record
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM households WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ message: 'Household not found.' });
    }
    res.json({ message: 'Household record deleted successfully.' });
  } catch (err) {
    console.error('[HOUSEHOLDS DELETE] Error:', err);
    res.status(500).json({ message: 'Database error deleting household.' });
  }
});

module.exports = router;
