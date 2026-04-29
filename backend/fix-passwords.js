/**
 * Updates all seeded users to the demo password: Pass@1234
 */
require('dotenv').config({ quiet: true });
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'ProjectDB',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  options: { encrypt: false, trustServerCertificate: true },
};

async function main() {
  const hash = await bcrypt.hash('Pass@1234', 12);
  const pool = await sql.connect(config);

  try {
    const result = await pool.request()
      .input('hash', sql.Text, hash)
      .query('UPDATE [User] SET password_hash = @hash');

    console.log(`Updated ${result.rowsAffected[0]} users. All seeded passwords are now Pass@1234`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
