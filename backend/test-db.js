require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { getPool, sql, closePool } = require('./db');

async function main() {
  const pool = await getPool();
  const counts = await pool.request().query(`
    SELECT
      DB_NAME() AS database_name,
      (SELECT COUNT(*) FROM [User]) AS users,
      (SELECT COUNT(*) FROM Disaster_Event) AS events,
      (SELECT COUNT(*) FROM Emergency_Report) AS reports,
      (SELECT COUNT(*) FROM Warehouse_Inventory) AS inventory_rows,
      OBJECT_ID('vw_Admin_SystemOverview', 'V') AS admin_view,
      OBJECT_ID('vw_WarehouseManager_Inventory', 'V') AS inventory_view,
      OBJECT_ID('vw_FinanceOfficer_Summary', 'V') AS finance_view,
      OBJECT_ID('vw_Hospital_Capacity', 'V') AS hospital_view
  `);

  const login = await pool.request()
    .input('username', sql.VarChar, 'admin_ali')
    .query('SELECT CAST(password_hash AS VARCHAR(MAX)) AS password_hash FROM [User] WHERE username = @username');

  const demoPasswordOk = login.recordset[0]
    ? await bcrypt.compare('Pass@1234', login.recordset[0].password_hash)
    : false;

  console.log({
    ...counts.recordset[0],
    demoPasswordOk,
  });
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
