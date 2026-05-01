
--  Run AFTER ddl.sql, dml.sql, triggers.sql

IF OBJECT_ID('vw_Admin_SystemOverview',       'V') IS NOT NULL DROP VIEW vw_Admin_SystemOverview;
IF OBJECT_ID('vw_Coordinator_ActiveEvents',   'V') IS NOT NULL DROP VIEW vw_Coordinator_ActiveEvents;
IF OBJECT_ID('vw_FieldOfficer_ActiveReports', 'V') IS NOT NULL DROP VIEW vw_FieldOfficer_ActiveReports;
IF OBJECT_ID('vw_WarehouseManager_Inventory', 'V') IS NOT NULL DROP VIEW vw_WarehouseManager_Inventory;
IF OBJECT_ID('vw_FinanceOfficer_Summary',     'V') IS NOT NULL DROP VIEW vw_FinanceOfficer_Summary;
IF OBJECT_ID('vw_Hospital_Capacity',          'V') IS NOT NULL DROP VIEW vw_Hospital_Capacity;
IF OBJECT_ID('vw_AuditTrail_Recent',          'V') IS NOT NULL DROP VIEW vw_AuditTrail_Recent;
GO


--  VW-01  Admin — full system snapshot
--  Role: System_Admin
--  Hides: password_hash, raw financial amounts per user
--  Shows: per-event counts, team statuses, overall health
CREATE VIEW vw_Admin_SystemOverview AS
SELECT
    DE.event_id,
    DE.event_name,
    DE.disaster_type,
    DE.location                                         AS event_location,
    DE.severity_level,
    DE.status                                           AS event_status,
    DE.start_date,
    DE.end_date,
    ISNULL(R.total_reports, 0)                          AS total_reports,
    ISNULL(R.active_reports, 0)                         AS active_reports,
    ISNULL(R.resolved_reports, 0)                       AS resolved_reports,
    ISNULL(TA.total_team_assignments, 0)                AS total_team_assignments,
    ISNULL(P.total_patients, 0)                         AS total_patients,
    ISNULL(FT.total_donations, 0)                       AS total_donations,
    ISNULL(FT.total_expenses, 0)                        AS total_expenses,
    (ISNULL(FT.total_donations, 0) - ISNULL(FT.total_expenses, 0)) AS net_balance
FROM       Disaster_Event DE
LEFT JOIN (
    SELECT disaster_event_id,
           COUNT(report_id) AS total_reports,
           SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active_reports,
           SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS resolved_reports
    FROM Emergency_Report GROUP BY disaster_event_id
) R ON R.disaster_event_id = DE.event_id
LEFT JOIN (
    SELECT ER.disaster_event_id, COUNT(TA.assignment_id) AS total_team_assignments
    FROM Emergency_Report ER
    INNER JOIN Team_Assignment TA ON TA.report_id = ER.report_id
    GROUP BY ER.disaster_event_id
) TA ON TA.disaster_event_id = DE.event_id
LEFT JOIN (
    SELECT ER.disaster_event_id, COUNT(P.patient_id) AS total_patients
    FROM Emergency_Report ER
    INNER JOIN Patient P ON P.report_id = ER.report_id
    GROUP BY ER.disaster_event_id
) P ON P.disaster_event_id = DE.event_id
LEFT JOIN (
    SELECT disaster_event_id,
           SUM(CASE WHEN transaction_type = 'Donation' THEN amount ELSE 0 END) AS total_donations,
           SUM(CASE WHEN transaction_type = 'Expense' THEN amount ELSE 0 END) AS total_expenses
    FROM Financial_Transaction
    GROUP BY disaster_event_id
) FT ON FT.disaster_event_id = DE.event_id;
GO


--  VW-02  Coordinator — active events with rescue team status
--  Role: Disaster_Coordinator
--  Hides: financial data, patient records, audit logs
--  Shows: active/pending events, team assignments per event
CREATE VIEW vw_Coordinator_ActiveEvents AS
SELECT
    DE.event_id,
    DE.event_name,
    DE.disaster_type,
    DE.location,
    DE.severity_level,
    DE.status,
    DE.start_date,
    ISNULL(R.report_count, 0)                                 AS report_count,
    ISNULL(R.critical_reports, 0)                             AS critical_reports,
    ISNULL(TA.active_assignments, 0)                          AS active_assignments,
    ISNULL(TA.teams_deployed, 0)                              AS teams_deployed,
    STUFF((
        SELECT DISTINCT ', ' + RT2.team_name
        FROM   Emergency_Report ER2
        INNER JOIN Team_Assignment TA2 ON TA2.report_id = ER2.report_id
        INNER JOIN Rescue_Team RT2 ON RT2.team_id = TA2.rescue_team_id
        WHERE  ER2.disaster_event_id = DE.event_id
        AND    TA2.status IN ('Active', 'Pending')
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '')                  AS deployed_teams_list
FROM       Disaster_Event DE
LEFT JOIN (
    SELECT disaster_event_id,
           COUNT(report_id) AS report_count,
           SUM(CASE WHEN severity_level = 'Critical' THEN 1 ELSE 0 END) AS critical_reports
    FROM Emergency_Report GROUP BY disaster_event_id
) R ON R.disaster_event_id = DE.event_id
LEFT JOIN (
    SELECT ER.disaster_event_id,
           COUNT(TA.assignment_id) AS active_assignments,
           COUNT(DISTINCT TA.rescue_team_id) AS teams_deployed
    FROM Emergency_Report ER
    INNER JOIN Team_Assignment TA ON TA.report_id = ER.report_id
    WHERE TA.status IN ('Active', 'Pending')
    GROUP BY ER.disaster_event_id
) TA ON TA.disaster_event_id = DE.event_id
WHERE  DE.status IN ('Active', 'Pending');
GO


--  VW-03  Field Officer — active reports needing action
--  Role: Rescue_Operator
--  Hides: financial data, patient medical notes, audit logs
--  Shows: unassigned and in-progress reports with geo data
CREATE VIEW vw_FieldOfficer_ActiveReports AS
SELECT
    ER.report_id,
    ER.location,
    ER.latitude,
    ER.longitude,
    ER.disaster_type,
    ER.severity_level,
    ER.report_time,
    ER.status                                               AS report_status,
    ER.description,
    C.full_name                                             AS reported_by,
    U.phone                                                 AS citizen_phone,
    DE.event_name,
    DE.disaster_type                                        AS event_type,
    ISNULL(TA.assignment_count, 0)                          AS teams_assigned,
    CASE
        WHEN ISNULL(TA.assignment_count, 0) = 0 THEN 'Unassigned'
        ELSE 'Assigned'
    END                                                     AS assignment_status,
    DATEDIFF(MINUTE, ER.report_time, GETDATE())             AS minutes_since_report
FROM       Emergency_Report ER
INNER JOIN Citizen          C  ON C.citizen_id = ER.citizen_id
INNER JOIN [User]           U  ON U.user_id    = C.user_id
INNER JOIN Disaster_Event   DE ON DE.event_id  = ER.disaster_event_id
LEFT JOIN (
    SELECT report_id, COUNT(*) AS assignment_count
    FROM   Team_Assignment
    WHERE  status IN ('Active', 'Pending')
    GROUP BY report_id
) TA ON TA.report_id = ER.report_id
WHERE  ER.status IN ('Active', 'Pending')
AND    DE.status  IN ('Active', 'Pending');
GO

--  VW-04  Warehouse Manager — inventory with low-stock alerts
--  Role: Warehouse_Manager
--  Hides: financial transactions, emergency reports, audit logs
--  Shows: stock levels, low-stock flag, pending procurements
CREATE VIEW vw_WarehouseManager_Inventory AS
SELECT
    W.warehouse_id,
    W.warehouse_name,
    W.location                                              AS warehouse_location,
    R.resource_id,
    R.resource_name,
    R.resource_type,
    R.unit_of_measure,
    WI.quantity                                             AS current_stock,
    WI.threshold_level,
    WI.last_updated,
    CASE
        WHEN WI.quantity = 0                    THEN 'OUT OF STOCK'
        WHEN WI.quantity < WI.threshold_level   THEN 'LOW STOCK'
        ELSE                                         'OK'
    END                                                     AS stock_alert,
    WI.quantity - WI.threshold_level                        AS buffer_above_threshold,
    ISNULL(PEND.pending_qty, 0)                             AS pending_procurement_qty,
    WI.quantity + ISNULL(PEND.pending_qty, 0)               AS projected_stock
FROM       Warehouse_Inventory WI
INNER JOIN Warehouse  W ON W.warehouse_id  = WI.warehouse_id
INNER JOIN Resource   R ON R.resource_id   = WI.resource_id
LEFT JOIN (
    SELECT warehouse_id, resource_id, SUM(quantity) AS pending_qty
    FROM   Procurement
    WHERE  status = 'Pending'
    GROUP BY warehouse_id, resource_id
) PEND ON PEND.warehouse_id = WI.warehouse_id
       AND PEND.resource_id  = WI.resource_id;
GO


--  VW-05  Finance Officer — per-event financial summary
--  Role: Finance_Officer
--  Hides: emergency reports, patient records, team assignments
--  Shows: donations, expenses, procurement totals, net balance

CREATE VIEW vw_FinanceOfficer_Summary AS
SELECT
    DE.event_id,
    DE.event_name,
    DE.disaster_type,
    DE.status                                               AS event_status,
    DE.start_date,

    ISNULL(DON.donation_count, 0)                           AS donation_count,
    ISNULL(DON.total_donations, 0)                          AS total_donations,

    ISNULL(EXP.expense_count, 0)                            AS expense_count,
    ISNULL(EXP.approved_expenses, 0)                        AS approved_expenses,
    ISNULL(EXP.pending_expenses, 0)                         AS pending_expenses,

    ISNULL(PR.procurement_spend, 0)                         AS procurement_spend,

    ISNULL(DON.total_donations, 0)
    - ISNULL(EXP.approved_expenses, 0)
    - ISNULL(PR.procurement_spend, 0)                       AS net_balance

FROM       Disaster_Event DE
LEFT JOIN (
    SELECT disaster_event_id, COUNT(donation_id) AS donation_count, SUM(amount) AS total_donations
    FROM Donation GROUP BY disaster_event_id
) DON ON DON.disaster_event_id = DE.event_id
LEFT JOIN (
    SELECT disaster_event_id, COUNT(expense_id) AS expense_count,
           SUM(CASE WHEN approval_status = 'Approved' THEN amount ELSE 0 END) AS approved_expenses,
           SUM(CASE WHEN approval_status = 'Pending' THEN amount ELSE 0 END) AS pending_expenses
    FROM Expense GROUP BY disaster_event_id
) EXP ON EXP.disaster_event_id = DE.event_id
LEFT JOIN (
    SELECT disaster_event_id, SUM(amount) AS procurement_spend
    FROM Financial_Transaction
    WHERE transaction_type = 'Procurement'
    GROUP BY disaster_event_id
) PR ON PR.disaster_event_id = DE.event_id;
GO


--  VW-06  Hospital Capacity — load balancing aid
--  Role: Public read (no sensitive patient data exposed)
--  Hides: patient names, medical notes, admission details
--  Shows: bed availability, occupancy rate, admitted counts
CREATE VIEW vw_Hospital_Capacity AS
SELECT
    H.hospital_id,
    H.hospital_name,
    H.location,
    H.contact_number,
    H.specialization,
    H.total_beds,
    H.available_beds,
    H.total_beds - H.available_beds                         AS occupied_beds,
    CAST(
        (H.total_beds - H.available_beds) * 100.0 / H.total_beds
    AS DECIMAL(5,2))                                        AS occupancy_pct,
    COUNT(CASE WHEN P.status = 'Critical'   THEN 1 END)     AS critical_patients,
    COUNT(CASE WHEN P.status = 'Admitted'   THEN 1 END)     AS admitted_patients,
    CASE
        WHEN H.available_beds = 0          THEN 'FULL'
        WHEN H.available_beds < 20         THEN 'NEAR CAPACITY'
        ELSE                                    'ACCEPTING'
    END                                                     AS capacity_status
FROM       Hospital H
LEFT JOIN  Patient P ON P.hospital_id = H.hospital_id
               AND P.status IN ('Admitted', 'Critical')
GROUP BY
    H.hospital_id, H.hospital_name, H.location,
    H.contact_number, H.specialization,
    H.total_beds, H.available_beds;
GO


--  VW-07  Audit Trail — recent 200 entries (Admin only)
--  Role: System_Admin
--  Hides: nothing — this is the full audit surface
--  Shows: who did what, on which table, before/after values
CREATE VIEW vw_AuditTrail_Recent AS
SELECT TOP 200
    AL.log_id,
    AL.[timestamp],
    U.username                  AS actor,
    R.role_name                 AS actor_role,
    AL.action,
    AL.table_name,
    AL.record_id,
    AL.old_value,
    AL.new_value,
    AL.ip_address
FROM       Audit_Log AL
INNER JOIN [User]    U ON U.user_id = AL.user_id
INNER JOIN Role      R ON R.role_id = U.role_id
ORDER BY   AL.[timestamp] DESC;
GO

PRINT '=== 7 views created. ===';
GO

-- ============================================================
--  LATENCY COMPARISON — Views vs Raw Table Queries
--
--  HOW TO USE:
--    1. Run this entire section in SSMS
--    2. Check the "Messages" tab for CPU/elapsed times
--    3. Screenshot or copy the numbers into your report
--       table (template provided at the bottom of this file)
--
--  SET STATISTICS TIME ON  → CPU time + elapsed time (ms)
--  SET STATISTICS IO  ON   → logical reads (buffer hits)
--  DBCC DROPCLEANBUFFERS   → clears cache for fair comparison
--                            (requires sysadmin — skip if restricted)
-- ============================================================

-- ── COMPARISON 1: Active disaster events with report counts ──

PRINT ''; PRINT '========== COMPARISON 1: Active Events + Report Counts ==========';

-- A) Via view
PRINT '--- 1A) Via vw_Coordinator_ActiveEvents ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT event_id, event_name, severity_level, report_count, critical_reports, teams_deployed
FROM   vw_Coordinator_ActiveEvents
WHERE  severity_level IN ('High', 'Critical')
ORDER BY critical_reports DESC;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

-- B) Raw tables (equivalent query)
PRINT '--- 1B) Via Raw Tables ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT
    DE.event_id,
    DE.event_name,
    DE.severity_level,
    ISNULL(R.report_count, 0) AS report_count,
    ISNULL(R.critical_reports, 0) AS critical_reports,
    ISNULL(TA.teams_deployed, 0) AS teams_deployed
FROM       Disaster_Event DE
LEFT JOIN (
    SELECT disaster_event_id, COUNT(report_id) AS report_count,
           SUM(CASE WHEN severity_level = 'Critical' THEN 1 ELSE 0 END) AS critical_reports
    FROM Emergency_Report GROUP BY disaster_event_id
) R ON R.disaster_event_id = DE.event_id
LEFT JOIN (
    SELECT ER.disaster_event_id, COUNT(DISTINCT TA.rescue_team_id) AS teams_deployed
    FROM Emergency_Report ER
    INNER JOIN Team_Assignment TA ON TA.report_id = ER.report_id
    WHERE TA.status IN ('Active','Pending')
    GROUP BY ER.disaster_event_id
) TA ON TA.disaster_event_id = DE.event_id
WHERE  DE.status IN ('Active', 'Pending')
AND    DE.severity_level IN ('High', 'Critical')
ORDER BY critical_reports DESC;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

GO

-- ── COMPARISON 2: Low-stock inventory alerts ──────────────

PRINT ''; PRINT '========== COMPARISON 2: Low-Stock Inventory Alerts ==========';

PRINT '--- 2A) Via vw_WarehouseManager_Inventory ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT warehouse_name, resource_name, resource_type,
       current_stock, threshold_level, stock_alert, projected_stock
FROM   vw_WarehouseManager_Inventory
WHERE  stock_alert IN ('LOW STOCK', 'OUT OF STOCK')
ORDER BY stock_alert DESC, current_stock ASC;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

PRINT '--- 2B) Via Raw Tables ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT
    W.warehouse_name,
    R.resource_name,
    R.resource_type,
    WI.quantity                                     AS current_stock,
    WI.threshold_level,
    CASE
        WHEN WI.quantity = 0                  THEN 'OUT OF STOCK'
        WHEN WI.quantity < WI.threshold_level THEN 'LOW STOCK'
        ELSE                                       'OK'
    END                                             AS stock_alert,
    WI.quantity + ISNULL(PEND.pending_qty, 0)       AS projected_stock
FROM       Warehouse_Inventory WI
INNER JOIN Warehouse W ON W.warehouse_id = WI.warehouse_id
INNER JOIN Resource  R ON R.resource_id  = WI.resource_id
LEFT JOIN (
    SELECT warehouse_id, resource_id, SUM(quantity) AS pending_qty
    FROM   Procurement WHERE status = 'Pending'
    GROUP BY warehouse_id, resource_id
) PEND ON PEND.warehouse_id = WI.warehouse_id AND PEND.resource_id = WI.resource_id
WHERE WI.quantity < WI.threshold_level OR WI.quantity = 0
ORDER BY WI.quantity ASC;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

GO

-- ── COMPARISON 3: Finance summary — net balance per event ──

PRINT ''; PRINT '========== COMPARISON 3: Finance Summary Per Event ==========';

PRINT '--- 3A) Via vw_FinanceOfficer_Summary ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT event_name, event_status, total_donations, approved_expenses,
       procurement_spend, net_balance
FROM   vw_FinanceOfficer_Summary
ORDER BY net_balance DESC;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

PRINT '--- 3B) Via Raw Tables ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT
    DE.event_id,
    DE.event_name,
    DE.status,
    ISNULL(DON.total_donations, 0) AS total_donations,
    ISNULL(EXP.approved_expenses, 0) AS approved_expenses,
    ISNULL(PR.procurement_spend, 0) AS procurement_spend,
    (ISNULL(DON.total_donations, 0) - ISNULL(EXP.approved_expenses, 0) - ISNULL(PR.procurement_spend, 0)) AS net_balance
FROM       Disaster_Event DE
LEFT JOIN (
    SELECT disaster_event_id, SUM(amount) AS total_donations
    FROM Donation GROUP BY disaster_event_id
) DON ON DON.disaster_event_id = DE.event_id
LEFT JOIN (
    SELECT disaster_event_id,
           SUM(CASE WHEN approval_status = 'Approved' THEN amount ELSE 0 END) AS approved_expenses
    FROM Expense GROUP BY disaster_event_id
) EXP ON EXP.disaster_event_id = DE.event_id
LEFT JOIN (
    SELECT disaster_event_id, SUM(amount) AS procurement_spend
    FROM Financial_Transaction
    WHERE transaction_type = 'Procurement'
    GROUP BY disaster_event_id
) PR ON PR.disaster_event_id = DE.event_id
ORDER BY net_balance DESC;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

GO

-- ── COMPARISON 4: Hospital capacity — who's accepting patients ──

PRINT ''; PRINT '========== COMPARISON 4: Hospital Capacity ==========';

PRINT '--- 4A) Via vw_Hospital_Capacity ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT hospital_name, location, total_beds, available_beds,
       occupancy_pct, critical_patients, capacity_status
FROM   vw_Hospital_Capacity
ORDER BY occupancy_pct DESC;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

PRINT '--- 4B) Via Raw Tables ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT
    H.hospital_id,
    H.hospital_name,
    H.location,
    H.total_beds,
    H.available_beds,
    CAST((H.total_beds - H.available_beds) * 100.0 / H.total_beds AS DECIMAL(5,2)) AS occupancy_pct,
    COUNT(CASE WHEN P.status = 'Critical' THEN 1 END)   AS critical_patients,
    CASE
        WHEN H.available_beds = 0   THEN 'FULL'
        WHEN H.available_beds < 20  THEN 'NEAR CAPACITY'
        ELSE                             'ACCEPTING'
    END                                                  AS capacity_status
FROM       Hospital H
LEFT JOIN  Patient P ON P.hospital_id = H.hospital_id AND P.status IN ('Admitted','Critical')
GROUP BY   H.hospital_id, H.hospital_name, H.location, H.total_beds, H.available_beds
ORDER BY   occupancy_pct DESC;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

GO

-- ── COMPARISON 5: Recent audit trail (security use-case) ──

PRINT ''; PRINT '========== COMPARISON 5: Recent Audit Trail ==========';

PRINT '--- 5A) Via vw_AuditTrail_Recent ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT TOP 20 log_id, [timestamp], actor, actor_role, action, table_name, record_id
FROM   vw_AuditTrail_Recent;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

PRINT '--- 5B) Via Raw Tables ---';
SET STATISTICS TIME ON;
SET STATISTICS IO  ON;

SELECT TOP 20
    AL.log_id,
    AL.[timestamp],
    U.username     AS actor,
    R.role_name    AS actor_role,
    AL.action,
    AL.table_name,
    AL.record_id
FROM       Audit_Log AL
INNER JOIN [User] U ON U.user_id = AL.user_id
INNER JOIN Role   R ON R.role_id = U.role_id
ORDER BY   AL.[timestamp] DESC;

SET STATISTICS TIME OFF;
SET STATISTICS IO  OFF;

GO
PRINT '=== Views and latency comparison complete. Check Messages tab for timing output. ===';
