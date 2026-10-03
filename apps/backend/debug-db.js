const pool = require('./db/pool');
(async () => {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('residents','admins')");
    console.log('tables', JSON.stringify(res.rows));
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='residents' ORDER BY ordinal_position");
    console.log('resident columns', JSON.stringify(cols.rows.map(r => r.column_name)));
    const recs = await pool.query("SELECT id, email, status, password_hash IS NULL AS no_hash, email_verified FROM residents LIMIT 5");
    console.log('rows', JSON.stringify(recs.rows, null, 2));
  } catch (e) {
    console.error('ERR', e.message);
  }
  process.exit(0);
})();
