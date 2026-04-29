const sql = require('mssql');
require('dotenv').config({ quiet: true });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'ProjectDB',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let poolPromise = null;

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config).catch((err) => {
      poolPromise = null;
      throw err;
    });
  }

  const pool = await poolPromise;
  if (!pool.connected) {
    poolPromise = null;
    return getPool();
  }

  return pool;
}

async function closePool() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  poolPromise = null;
  await pool.close();
}

module.exports = { getPool, closePool, sql };
