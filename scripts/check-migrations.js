const { Client } = require('pg');
require('dotenv').config({ path: 'd:/HostelGhar/.env' });
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function check() {
  await client.connect();
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables in DB:', tables.rows.map(r => r.table_name));
  try {
    const migs = await client.query('SELECT * FROM typeorm_migrations');
    console.log('Migrations in typeorm_migrations:', migs.rows);
  } catch (e) {
    console.log('typeorm_migrations error:', e.message);
  }
  await client.end();
}
check().catch(e => { console.error(e); process.exit(1); });

