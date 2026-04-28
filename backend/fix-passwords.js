/**
 * fix-passwords.js — update all placeholder hashes to a real bcrypt hash of 'Pass@1234'
 */
require('dotenv').config();
const sql    = require('mssql');
const bcrypt = require('bcryptjs');

const config = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options:  { encrypt: false, trustServerCertificate: true },
};

async function main() {
  const hash = await bcrypt.hash('Pass@1234', 12);
  console.log('Generated hash:', hash);

  const pool = await sql.connect(config);
  const result = await pool.request()
    .input('hash', sql.Text, hash)
    .query(`UPDATE [User] SET password_hash = @hash`);

  console.log(`✅ Updated ${result.rowsAffected[0]} users — all passwords set to 'Pass@1234'`);
  await pool.close();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
