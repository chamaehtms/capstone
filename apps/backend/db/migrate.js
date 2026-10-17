// Creates the schema (if not already present) and seeds starter data
// (if the tables are empty). Safe to re-run — every insert is idempotent.
//
// Usage:  npm run migrate

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const { hashPassword } = require('../utils/password');

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  console.log('Applying schema...');
  await pool.query(schema);

  // Safe to re-run: adds the column only if it doesn't already exist.
  // (CREATE TABLE IF NOT EXISTS above won't add new columns to a table
  // that was already created in an earlier migration run.)
  console.log('Ensuring residents.photo_url column exists...');
  await pool.query('ALTER TABLE residents ADD COLUMN IF NOT EXISTS photo_url TEXT');

  console.log('Ensuring admins.photo_url column exists...');
  await pool.query('ALTER TABLE admins ADD COLUMN IF NOT EXISTS photo_url TEXT');

  console.log('Ensuring selfie_id_url columns exist...');
  await pool.query('ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS selfie_id_url TEXT');
  await pool.query('ALTER TABLE admins ADD COLUMN IF NOT EXISTS selfie_id_url TEXT');
  await pool.query('ALTER TABLE residents ADD COLUMN IF NOT EXISTS selfie_id_url TEXT');

  console.log('Ensuring access request email-verification columns exist...');
  await pool.query(`
    ALTER TABLE access_requests
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS verification_token_hash TEXT,
      ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS email_verification_code_hash TEXT,
      ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS email_verification_attempts INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS first_name TEXT,
      ADD COLUMN IF NOT EXISTS middle_name TEXT,
      ADD COLUMN IF NOT EXISTS last_name TEXT,
      ADD COLUMN IF NOT EXISTS sex TEXT,
      ADD COLUMN IF NOT EXISTS contact_no TEXT,
      ADD COLUMN IF NOT EXISTS id_document_url TEXT
  `);

  console.log('Ensuring admin name breakdown and details columns exist...');
  await pool.query(`
    ALTER TABLE admins
      ADD COLUMN IF NOT EXISTS first_name TEXT,
      ADD COLUMN IF NOT EXISTS middle_name TEXT,
      ADD COLUMN IF NOT EXISTS last_name TEXT,
      ADD COLUMN IF NOT EXISTS sex TEXT,
      ADD COLUMN IF NOT EXISTS contact_no TEXT,
      ADD COLUMN IF NOT EXISTS id_document_url TEXT
  `);

  // Resident-portal self-service account fields (self-registration, login, preferences)
  console.log('Ensuring resident-portal columns exist on residents...');
  await pool.query(`
    ALTER TABLE residents
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS civil_status TEXT,
      ADD COLUMN IF NOT EXISTS id_document_url TEXT,
      ADD COLUMN IF NOT EXISTS community_points INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'Member',
      ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS email_announcements BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'English (US)',
        ADD COLUMN IF NOT EXISTS self_registered BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS email_verification_code_hash TEXT,
        ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS email_verification_attempts INT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS password_reset_code_hash TEXT,
          ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS password_reset_sent_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS password_reset_attempts INT NOT NULL DEFAULT 0
  `);

  // Backfill: any resident row that already has a portal password was
  // necessarily created via self-registration (admin-enrolled residents
  // never set password_hash), so reclassify those retroactively. This
  // catches self-registered rows created before the self_registered column
  // existed, so they're correctly hidden from Resident Records / surfaced
  // in Pending Requests if still Pending.
  await pool.query(`
    UPDATE residents SET self_registered = true
    WHERE password_hash IS NOT NULL AND self_registered = false
  `);

  console.log('Ensuring AI ID validation columns exist on residents and access_requests...');
  await pool.query(`
    ALTER TABLE residents
      ADD COLUMN IF NOT EXISTS id_ai_status TEXT DEFAULT 'not_scanned',
      ADD COLUMN IF NOT EXISTS id_ai_score NUMERIC,
      ADD COLUMN IF NOT EXISTS id_ai_summary TEXT,
      ADD COLUMN IF NOT EXISTS id_ai_checked_at TIMESTAMPTZ;

    ALTER TABLE access_requests
      ADD COLUMN IF NOT EXISTS id_ai_status TEXT DEFAULT 'not_scanned',
      ADD COLUMN IF NOT EXISTS id_ai_score NUMERIC,
      ADD COLUMN IF NOT EXISTS id_ai_summary TEXT,
      ADD COLUMN IF NOT EXISTS id_ai_checked_at TIMESTAMPTZ;
  `);

  // Formal-blotter / resident-portal fields on complaints
  console.log('Ensuring resident-portal columns exist on complaints...');
  await pool.query(`
    ALTER TABLE complaints
      ADD COLUMN IF NOT EXISTS needs_escalation BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS ai_scan_status TEXT NOT NULL DEFAULT 'not_scanned',
      ADD COLUMN IF NOT EXISTS ai_scan_score NUMERIC,
      ADD COLUMN IF NOT EXISTS ai_scan_checked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS respondent TEXT,
      ADD COLUMN IF NOT EXISTS respondent_address TEXT,
      ADD COLUMN IF NOT EXISTS complainant_address TEXT,
      ADD COLUMN IF NOT EXISTS narrative TEXT,
      ADD COLUMN IF NOT EXISTS relief_sought TEXT,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS filed_by_resident_id TEXT REFERENCES residents(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS under_review_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS assigned_team TEXT DEFAULT 'Maintenance Team'
  `);

  // The announcements table pre-dates the current schema in some existing
  // databases, with `id` as an auto-incrementing INTEGER rather than TEXT.
  // The app now generates text ids like "ann-55b420e8", which can't fit an
  // integer column — fix that up regardless of which type is already there
  // (both statements are safe/no-ops if id is already TEXT with no default).
  console.log('Ensuring announcements.id is TEXT...');
  await pool.query(`ALTER TABLE announcements ALTER COLUMN id DROP DEFAULT`);
  await pool.query(`ALTER TABLE announcements ALTER COLUMN id TYPE TEXT USING id::text`);
  await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url TEXT`);

  console.log('Ensuring meeting detailed minutes columns exist...');
  await pool.query(`
    ALTER TABLE meetings
      ADD COLUMN IF NOT EXISTS absentees JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS main_topics JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS concerns_raised TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS action_items JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS next_meeting_date TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS next_meeting_time TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS next_meeting_venue TEXT DEFAULT ''
  `);

  console.log('Ensuring meeting mediation and notification columns exist...');
  await pool.query(`
    ALTER TABLE meetings
      ADD COLUMN IF NOT EXISTS meeting_type TEXT NOT NULL DEFAULT 'council',
      ADD COLUMN IF NOT EXISTS case_id TEXT,
      ADD COLUMN IF NOT EXISTS resident_id TEXT,
      ADD COLUMN IF NOT EXISTS resident_name TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS resident_email TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS respondent_name TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS mediator TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS hearing_stage TEXT DEFAULT '1st Mediation Hearing',
      ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS next_notification_sent BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS next_notification_sent_at TIMESTAMPTZ
  `);

  console.log('Ensuring complaint mediation schedule columns exist...');
  await pool.query(`
    ALTER TABLE complaints
      ADD COLUMN IF NOT EXISTS mediation_date DATE,
      ADD COLUMN IF NOT EXISTS mediation_time TEXT,
      ADD COLUMN IF NOT EXISTS mediation_venue TEXT,
      ADD COLUMN IF NOT EXISTS mediator TEXT,
      ADD COLUMN IF NOT EXISTS hearing_stage TEXT,
      ADD COLUMN IF NOT EXISTS next_mediation_date TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS next_mediation_time TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS next_mediation_venue TEXT DEFAULT ''
  `);

  console.log('Ensuring households table exists...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS households (
      id                    TEXT PRIMARY KEY,
      household_no          TEXT UNIQUE NOT NULL,
      head_resident_id      TEXT REFERENCES residents(id) ON DELETE SET NULL,
      head_name             TEXT NOT NULL,
      purok_zone            TEXT NOT NULL,
      address               TEXT NOT NULL,
      income_class          TEXT DEFAULT 'Low Income',
      housing_type          TEXT DEFAULT 'Concrete / Permanent',
      toilet_facility       TEXT DEFAULT 'Water-sealed / Flush',
      water_source          TEXT DEFAULT 'Piped Water Connection',
      waste_management      TEXT DEFAULT 'Barangay Collection',
      is_4ps_beneficiary    BOOLEAN NOT NULL DEFAULT false,
      is_indigent           BOOLEAN NOT NULL DEFAULT false,
      members               JSONB NOT NULL DEFAULT '[]',
      remarks               TEXT DEFAULT '',
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_households_zone ON households(purok_zone);
    CREATE INDEX IF NOT EXISTS idx_households_head ON households(head_resident_id);
  `);

  console.log('Ensuring notifications table exists...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      target_role TEXT DEFAULT 'resident',
      admin_id TEXT,
      resident_id TEXT,
      resident_email TEXT,
      actor_name TEXT,
      actor_avatar TEXT,
      case_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'mediation',
      link TEXT,
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_resident ON notifications(resident_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(resident_email);
    CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON notifications(target_role);
    CREATE INDEX IF NOT EXISTS idx_notifications_admin ON notifications(admin_id);
  `);

  console.log('Ensuring puroks_zones table exists...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS puroks_zones (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      center_lat DOUBLE PRECISION NOT NULL,
      center_lng DOUBLE PRECISION NOT NULL,
      zoom_level INT DEFAULT 16,
      boundary_geojson JSONB,
      landmarks JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_puroks_zones_name ON puroks_zones(LOWER(name));
  `);

  console.log('Seeding official Poblacion Cordova Puroks and Zones...');
  const officialPuroks = [
    {
      id: 'pz-camolinas-centro',
      name: 'Camolinas Centro',
      description: 'Central northwest sector of Barangay Poblacion, Cordova along Camolinas corridor.',
      centerLat: 10.2542,
      centerLng: 123.9485,
      zoomLevel: 16,
      boundaryGeojson: {
        type: 'Polygon',
        coordinates: [[
          [123.9465, 10.2528],
          [123.9505, 10.2528],
          [123.9505, 10.2562],
          [123.9465, 10.2562],
          [123.9465, 10.2528]
        ]]
      },
      landmarks: [
        { name: 'Camolinas Chapel & Community Stage', type: 'Chapel', lat: 10.2545, lng: 123.9488 },
        { name: 'Cordova Central Elementary School (North Access)', type: 'School', lat: 10.2536, lng: 123.9495 }
      ]
    },
    {
      id: 'pz-atabay',
      name: 'Atabay',
      description: 'Northeastern district of Barangay Poblacion connecting Cordova toward Day-as highway.',
      centerLat: 10.2558,
      centerLng: 123.9525,
      zoomLevel: 16,
      boundaryGeojson: {
        type: 'Polygon',
        coordinates: [[
          [123.9505, 10.2538],
          [123.9555, 10.2538],
          [123.9555, 10.2580],
          [123.9505, 10.2580],
          [123.9505, 10.2538]
        ]]
      },
      landmarks: [
        { name: 'Atabay Daycare Center & Health Post', type: 'Health', lat: 10.2555, lng: 123.9520 },
        { name: 'Poblacion Northeast Boundary Marker', type: 'Boundary', lat: 10.2565, lng: 123.9538 }
      ]
    },
    {
      id: 'pz-calan',
      name: 'Calan',
      description: 'Southwestern coastal sector of Barangay Poblacion with fishing communities and seawall.',
      centerLat: 10.2488,
      centerLng: 123.9472,
      zoomLevel: 16,
      boundaryGeojson: {
        type: 'Polygon',
        coordinates: [[
          [123.9448, 10.2465],
          [123.9495, 10.2465],
          [123.9495, 10.2510],
          [123.9448, 10.2510],
          [123.9448, 10.2465]
        ]]
      },
      landmarks: [
        { name: 'Calan Coastal Boardwalk & Fisherfolk Port', type: 'Port', lat: 10.2480, lng: 123.9468 },
        { name: 'Calan Multi-Purpose Hall', type: 'Hall', lat: 10.2492, lng: 123.9478 }
      ]
    },
    {
      id: 'pz-housing',
      name: 'Housing',
      description: 'Eastern residential subdivisions and municipal housing community in Poblacion, Cordova.',
      centerLat: 10.2505,
      centerLng: 123.9538,
      zoomLevel: 16,
      boundaryGeojson: {
        type: 'Polygon',
        coordinates: [[
          [123.9515, 10.2485],
          [123.9565, 10.2485],
          [123.9565, 10.2530],
          [123.9515, 10.2530],
          [123.9515, 10.2485]
        ]]
      },
      landmarks: [
        { name: 'Barangay Poblacion Housing Covered Court', type: 'Sports', lat: 10.2508, lng: 123.9535 },
        { name: 'Housing Community Health Sub-center', type: 'Clinic', lat: 10.2502, lng: 123.9542 }
      ]
    },
    {
      id: 'pz-puso',
      name: 'Puso',
      description: 'Civic heart and heritage center of Barangay Poblacion surrounding the Parish Church and Town Plaza.',
      centerLat: 10.2518,
      centerLng: 123.9498,
      zoomLevel: 17,
      boundaryGeojson: {
        type: 'Polygon',
        coordinates: [[
          [123.9475, 10.2502],
          [123.9518, 10.2502],
          [123.9518, 10.2535],
          [123.9475, 10.2535],
          [123.9475, 10.2502]
        ]]
      },
      landmarks: [
        { name: 'San Roque Parish Church (Cordova)', type: 'Church', lat: 10.25128, lng: 123.94957 },
        { name: 'Barangay Poblacion Hall & Session Hall', type: 'Government', lat: 10.25195, lng: 123.94970 },
        { name: 'Cordova Municipal Town Plaza', type: 'Plaza', lat: 10.25150, lng: 123.94940 },
        { name: 'Cordova Sports Complex & Gymnasium', type: 'Sports', lat: 10.25100, lng: 123.94820 }
      ]
    },
    {
      id: 'pz-intra',
      name: 'Intra',
      description: 'Inner core residential zone between Camolinas and Housing with high-density settlements.',
      centerLat: 10.2532,
      centerLng: 123.9512,
      zoomLevel: 16,
      boundaryGeojson: {
        type: 'Polygon',
        coordinates: [[
          [123.9495, 10.2518],
          [123.9535, 10.2518],
          [123.9535, 10.2550],
          [123.9495, 10.2550],
          [123.9495, 10.2518]
        ]]
      },
      landmarks: [
        { name: 'Intra Youth Basketball Half-Court', type: 'Sports', lat: 10.2530, lng: 123.9510 },
        { name: 'Intra Purok Tanod Outpost', type: 'Security', lat: 10.2535, lng: 123.9515 }
      ]
    },
    {
      id: 'pz-crossroad',
      name: 'Crossroad',
      description: 'Major junction and commercial crossroad of Poblacion, Cordova along Pacaldo and Nuñez streets.',
      centerLat: 10.2512,
      centerLng: 123.9478,
      zoomLevel: 16,
      boundaryGeojson: {
        type: 'Polygon',
        coordinates: [[
          [123.9455, 10.2495],
          [123.9498, 10.2495],
          [123.9498, 10.2525],
          [123.9455, 10.2525],
          [123.9455, 10.2495]
        ]]
      },
      landmarks: [
        { name: 'Poblacion Commercial Crossing & Terminal', type: 'Transit', lat: 10.2511, lng: 123.9475 },
        { name: 'Cordova Public Market Perimeter', type: 'Market', lat: 10.2508, lng: 123.9485 }
      ]
    }
  ];

  for (const p of officialPuroks) {
    await pool.query(
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
         updated_at = now()`,
      [
        p.id,
        p.name,
        p.description,
        p.centerLat,
        p.centerLng,
        p.zoomLevel,
        JSON.stringify(p.boundaryGeojson),
        JSON.stringify(p.landmarks)
      ]
    );
  }

  console.log('Ensuring query performance indexes exist on core tables...');
  await pool.query(`
    -- Residents performance indexes
    CREATE INDEX IF NOT EXISTS idx_residents_created_at ON residents(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_residents_self_reg_status ON residents(self_registered, status);
    CREATE INDEX IF NOT EXISTS idx_residents_zone ON residents(zone);
    CREATE INDEX IF NOT EXISTS idx_residents_lower_email ON residents(LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_residents_lower_full_name ON residents(LOWER(full_name));

    -- Complaints performance indexes
    CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
    CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
    CREATE INDEX IF NOT EXISTS idx_complaints_filed_by ON complaints(filed_by_resident_id);

    -- Meetings & Mediation performance indexes
    CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date DESC);
    CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(meeting_type);
    CREATE INDEX IF NOT EXISTS idx_meetings_case_id ON meetings(case_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_resident_id ON meetings(resident_id);

    -- Access Requests performance indexes
    CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status, requested_at DESC);
    CREATE INDEX IF NOT EXISTS idx_access_requests_lower_email ON access_requests(LOWER(email));

    -- Escalations performance indexes
    CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON escalations(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
  `);

  const { rows: adminCountRows } = await pool.query('SELECT COUNT(*) FROM admins');
  if (Number(adminCountRows[0].count) === 0) {
    console.log('Seeding default admin account (brgypoblacion@admin.gov / admin123)...');
    await pool.query(
      `INSERT INTO admins (id, institutional_id, full_name, email, department, password_hash, status, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        'adm-001',
        'CL-8848-00X',
        'Poblacion Admin',
        'brgypoblacion@admin.gov',
        'Internal Oversight',
        hashPassword('admin123'),
        'approved',
        'Administrator',
      ]
    );
  }

  const { rows: residentCountRows } = await pool.query('SELECT COUNT(*) FROM residents');
  if (Number(residentCountRows[0].count) === 0) {
    console.log('Seeding sample residents...');
    const residents = [
      {
        id: 'res-002', fullName: 'Ricardo M. Delgado', birthDate: '1959-07-01', age: 67, gender: 'Male',
        occupation: 'Retired', address: 'Unit 4, Block 3', zone: 'Zone 1 - Alpha', residencyYears: 30,
        contact: '', email: '', status: 'Pending',
        category: ['Voter'], education: null, bloodType: 'A+', placeOfBirth: 'Cebu', spouse: null, household: [],
      },
      {
        id: 'res-003', fullName: 'Carmelita S. Tan', birthDate: '1954-01-20', age: 72, gender: 'Female',
        occupation: 'Retired', address: 'Blk 4, Lot 12', zone: 'Zone 3 - Charlie', residencyYears: 40,
        contact: '', email: '', status: 'Verified',
        category: ['Senior Citizen', 'Voter'], education: null, bloodType: 'B+', placeOfBirth: 'Mandaue', spouse: null, household: [],
      },
      {
        id: 'res-004', fullName: 'Ricardo V. De Jesus', birthDate: '1962-01-15', age: 63, gender: 'Male',
        occupation: 'Retired Civil Engineer', address: 'Purok Manga, Sitio Rio Barangay Poblacion',
        zone: 'Purok Manga', residencyYears: 14, contact: '+63 917 555 1290', email: 'r.dejesus.62@gmail.com',
        status: 'Verified', category: ['Voter'], education: 'Post-Graduate (M.S. Eng)', bloodType: 'O Positive (O+)',
        placeOfBirth: 'Cordova Cebu', spouse: 'Maria Idesa De Jesus', household: [],
      },
    ];

    for (const r of residents) {
      await pool.query(
        `INSERT INTO residents
          (id, full_name, birth_date, age, gender, occupation, address, zone, residency_years,
           contact, email, status, category, education, blood_type, place_of_birth, spouse, household)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          r.id, r.fullName, r.birthDate, r.age, r.gender, r.occupation, r.address, r.zone, r.residencyYears,
          r.contact, r.email, r.status, JSON.stringify(r.category), r.education, r.bloodType,
          r.placeOfBirth, r.spouse, JSON.stringify(r.household),
        ]
      );
    }
  }

  const { rows: complaintCountRows } = await pool.query('SELECT COUNT(*) FROM complaints');
  if (Number(complaintCountRows[0].count) === 0) {
    console.log('Seeding sample complaints...');
    const complaints = [
      { id: 'CASE-2024-089', resident: 'Maria Santos', category: 'Sanitation', status: 'Pending', filingDate: '2024-10-24', description: 'Registered a noise complaint for Jurisdiction Sector 4.', priority: 'Normal' },
      { id: 'CASE-2024-072', resident: 'Juan Dela Cruz', category: 'Noise Nuisance', status: 'In Progress', filingDate: '2024-10-20', description: 'Noise nuisance complaint under review.', priority: 'Normal' },
      { id: 'CASE-2024-055', resident: 'Eduardo Rodriguez', category: 'Boundary Dispute', status: 'Mediation', filingDate: '2024-10-15', description: 'Boundary dispute referred to mediation.', priority: 'Normal' },
    ];
    for (const c of complaints) {
      await pool.query(
        `INSERT INTO complaints (id, resident, category, status, filing_date, description, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [c.id, c.resident, c.category, c.status, c.filingDate, c.description, c.priority]
      );
    }
  }

  const { rows: meetingCountRows } = await pool.query('SELECT COUNT(*) FROM meetings');
  if (Number(meetingCountRows[0].count) === 0) {
    console.log('Seeding sample meeting...');
    await pool.query(
      `INSERT INTO meetings (id, title, date, time, location, attendees, agenda, minutes, resolutions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        'mtg-001',
        'Monthly Community Council Meeting',
        '2024-10-24',
        '02:00 PM - 04:30 PM',
        'Barangay Hall',
        JSON.stringify(['Roberto Cruz', 'Liza Lopez', 'Juan Santos']),
        JSON.stringify([
          'Call to Order & Opening Remarks',
          'Approval of Previous Minutes',
          'Public Safety Report (Zone 4)',
          'Community Health Waiting Time Report',
        ]),
        'Meeting proceeded as scheduled with quorum present.',
        JSON.stringify([
          { id: 'R22-4200', title: 'Allocation of PHP 40,000 for Additional Street Lighting on Purok 5', status: 'Approved' },
          { id: 'R22-4199', title: 'Mandatory Curfew Reinforcement Initiative for Minors', status: 'Approved' },
          { id: 'R22-4198', title: 'Proposed 2025 Barangay Hall Front Desk Upgrades', status: 'Pending' },
        ]),
      ]
    );
  }

  // Backfill detailed meeting minutes on mtg-001 so all 7 required sections are populated
  await pool.query(`
    UPDATE meetings
    SET
      location = CASE WHEN location IS NULL OR location = '' OR location = 'Barangay Hall' THEN 'Barangay Poblacion Session Hall' ELSE location END,
      attendees = CASE WHEN jsonb_array_length(attendees) <= 3 THEN $1::jsonb ELSE attendees END,
      absentees = CASE WHEN jsonb_array_length(absentees) = 0 THEN $2::jsonb ELSE absentees END,
      main_topics = CASE WHEN jsonb_array_length(main_topics) = 0 THEN $3::jsonb ELSE main_topics END,
      concerns_raised = CASE WHEN concerns_raised IS NULL OR concerns_raised = '' THEN $4 ELSE concerns_raised END,
      minutes = CASE WHEN minutes IS NULL OR minutes = '' OR minutes = 'Meeting proceeded as scheduled with quorum present.' THEN $5 ELSE minutes END,
      action_items = CASE WHEN jsonb_array_length(action_items) = 0 THEN $6::jsonb ELSE action_items END,
      next_meeting_date = CASE WHEN next_meeting_date IS NULL OR next_meeting_date = '' THEN $7 ELSE next_meeting_date END,
      next_meeting_time = CASE WHEN next_meeting_time IS NULL OR next_meeting_time = '' THEN $8 ELSE next_meeting_time END,
      next_meeting_venue = CASE WHEN next_meeting_venue IS NULL OR next_meeting_venue = '' THEN $9 ELSE next_meeting_venue END
    WHERE id = 'mtg-001'
  `, [
    JSON.stringify(['Hon. Roberto Cruz (Barangay Captain)', 'Kgd. Liza Lopez (Admin & Finance)', 'Kgd. Carmelita Tan (Health & Sanitation)', 'Sec. Juan Santos (Peace & Order)', 'Kgd. Ricardo Delgado (Infrastructure)']),
    JSON.stringify(['SK Chairman Mark Rivera (Excused - Academic Commitment)']),
    JSON.stringify([
      'Allocation and procurement for additional street lighting on Purok 5 corridor',
      'Mandatory curfew reinforcement for minors and night tanod patrol logistics',
      'Front desk triage and digital queuing kiosk upgrades for the Barangay Hall',
      'Review of schedule and logistics for upcoming quarterly community clean-up drive',
    ]),
    'Purok 5 residents reported frequent outages on dark street corners posing safety concerns for evening commuters. The youth council also requested clearer guidelines on curfew enforcement so students returning from evening study sessions or night classes are not penalized.',
    'The regular monthly session of the Barangay Poblacion Council was called to order at 2:00 PM by Hon. Roberto Cruz with quorum established. The council reviewed ongoing community infrastructure projects, evaluated the peace and order quarterly report, and deliberated on public safety improvements for residential zones.',
    JSON.stringify([
      { id: 'ACT-001', task: 'Canvass and procure 12 LED solar streetlights for Purok 5', responsible: 'Kgd. Ricardo Delgado (Infrastructure)', deadline: '2024-11-15', status: 'In Progress' },
      { id: 'ACT-002', task: 'Coordinate joint patrol schedule with PNP precinct and Barangay Tanods', responsible: 'Sec. Juan Santos (Peace & Order)', deadline: '2024-10-31', status: 'Completed' },
      { id: 'ACT-003', task: 'Draft technical specifications for front desk digital queuing kiosk', responsible: 'Kgd. Liza Lopez (Admin & Finance)', deadline: '2024-11-10', status: 'Pending' },
    ]),
    '2024-11-28',
    '02:00 PM - 05:00 PM',
    'Barangay Poblacion Session Hall',
  ]);

  const { rows: escalationCountRows } = await pool.query('SELECT COUNT(*) FROM escalations');
  if (Number(escalationCountRows[0].count) === 0) {
    console.log('Seeding sample escalations...');
    const escalations = [
      { id: 'ESC-2024-002', category: 'Noise Complaint', reason: 'Repetitive Offense', priority: 'Critical', overseer: 'Hon. J. Miller', status: 'Under Review', escalated: '2024-10-11' },
      { id: 'ESC-2024-012', category: 'Boundary Dispute', reason: 'Judicial Request', priority: 'High', overseer: 'Unassigned', status: 'Mediation', escalated: '2024-10-14' },
      { id: 'ESC-2024-045', category: 'Utility Misuse', reason: 'Multiple Appeals', priority: 'Medium', overseer: 'Dr. Sarah Kent', status: 'Resolved', escalated: '2024-10-10' },
      { id: 'ESC-2024-067', category: 'Zoning Breach', reason: 'Judicial Request', priority: 'Critical', overseer: 'Hon. P. Vance', status: 'Under Review', escalated: '2024-10-15' },
    ];
    for (const e of escalations) {
      await pool.query(
        `INSERT INTO escalations (id, category, reason, priority, overseer, status, escalated)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [e.id, e.category, e.reason, e.priority, e.overseer, e.status, e.escalated]
      );
    }
  }

  const { rows: announcementCountRows } = await pool.query('SELECT COUNT(*) FROM announcements');
  if (Number(announcementCountRows[0].count) === 0) {
    console.log('Seeding sample announcement...');
    await pool.query(
      `INSERT INTO announcements (id, title, tag, body, event_date)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        'ann-001',
        'Barangay Clean-up Drive',
        'CLEAN-UP DRIVE',
        'Join us this weekend for our quarterly clean-up drive. Equipment and refreshments will be provided for all volunteers.',
        '2024-10-24',
      ]
    );
  }

  console.log('Done. Database is ready.');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
