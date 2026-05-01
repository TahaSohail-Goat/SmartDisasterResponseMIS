--  Run AFTER ddl.sql, dml.sql, triggers.sql, views_and_latency.sql



-- ── Step 1: Drop all benchmark indexes for a clean slate ──
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmReport_Severity'   AND object_id = OBJECT_ID('Emergency_Report'))      DROP INDEX IX_EmReport_Severity    ON Emergency_Report;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmReport_EventId'    AND object_id = OBJECT_ID('Emergency_Report'))      DROP INDEX IX_EmReport_EventId     ON Emergency_Report;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmReport_ReportTime' AND object_id = OBJECT_ID('Emergency_Report'))      DROP INDEX IX_EmReport_ReportTime  ON Emergency_Report;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Event_Type'          AND object_id = OBJECT_ID('Disaster_Event'))        DROP INDEX IX_Event_Type           ON Disaster_Event;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Event_Status'        AND object_id = OBJECT_ID('Disaster_Event'))        DROP INDEX IX_Event_Status         ON Disaster_Event;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inventory_Resource'  AND object_id = OBJECT_ID('Warehouse_Inventory'))   DROP INDEX IX_Inventory_Resource   ON Warehouse_Inventory;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inventory_Warehouse' AND object_id = OBJECT_ID('Warehouse_Inventory'))   DROP INDEX IX_Inventory_Warehouse  ON Warehouse_Inventory;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FinTxn_Date'         AND object_id = OBJECT_ID('Financial_Transaction')) DROP INDEX IX_FinTxn_Date          ON Financial_Transaction;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FinTxn_Type'         AND object_id = OBJECT_ID('Financial_Transaction')) DROP INDEX IX_FinTxn_Type          ON Financial_Transaction;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmReport_Event_Sev'  AND object_id = OBJECT_ID('Emergency_Report'))      DROP INDEX IX_EmReport_Event_Sev   ON Emergency_Report;

PRINT '=== All benchmark indexes dropped. Running WITHOUT-INDEX phase. ===';
GO


-- ── SCENARIO A: Filter reports by severity — WITHOUT index ──
PRINT ''; PRINT '=== SCENARIO A (WITHOUT INDEX): Reports by severity = Critical ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT report_id, location, disaster_type, severity_level, report_time, status
FROM   Emergency_Report
WHERE  severity_level = 'Critical'
ORDER BY report_time DESC;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO B: Reports per event — WITHOUT index ────────
PRINT ''; PRINT '=== SCENARIO B (WITHOUT INDEX): Reports for disaster_event_id = 1 ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT ER.report_id, ER.location, ER.severity_level, ER.status,
       C.full_name AS reported_by
FROM   Emergency_Report ER
INNER JOIN Citizen C ON C.citizen_id = ER.citizen_id
WHERE  ER.disaster_event_id = 1
ORDER BY ER.severity_level DESC;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO C: Time-range reports — WITHOUT index ───────
PRINT ''; PRINT '=== SCENARIO C (WITHOUT INDEX): Reports in date range ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT report_id, location, disaster_type, severity_level, report_time
FROM   Emergency_Report
WHERE  report_time BETWEEN '2025-08-01' AND '2025-08-31'
ORDER BY report_time;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO D: Events by type — WITHOUT index ───────────
PRINT ''; PRINT '=== SCENARIO D (WITHOUT INDEX): Disaster events of type Flood ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT event_id, event_name, location, severity_level, status, start_date
FROM   Disaster_Event
WHERE  disaster_type = 'Flood'
ORDER BY severity_level DESC;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO E: Inventory by resource — WITHOUT index ────
PRINT ''; PRINT '=== SCENARIO E (WITHOUT INDEX): Inventory for resource_id = 1 (Rice) ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT WI.inventory_id, W.warehouse_name, WI.quantity,
       WI.threshold_level, WI.last_updated
FROM   Warehouse_Inventory WI
INNER JOIN Warehouse W ON W.warehouse_id = WI.warehouse_id
WHERE  WI.resource_id = 1
ORDER BY WI.quantity DESC;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO F: Financial timeline — WITHOUT index ───────
PRINT ''; PRINT '=== SCENARIO F (WITHOUT INDEX): Financial transactions Aug 2025 ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT transaction_id, transaction_type, amount, transaction_date, notes
FROM   Financial_Transaction
WHERE  transaction_date BETWEEN '2025-08-01' AND '2025-08-31'
ORDER BY transaction_date;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO H: Composite — event + severity WITHOUT index ─
PRINT ''; PRINT '=== SCENARIO H (WITHOUT INDEX): Critical reports for event_id=1 ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT report_id, location, severity_level, report_time, status
FROM   Emergency_Report
WHERE  disaster_event_id = 1
AND    severity_level    = 'Critical'
ORDER BY report_time DESC;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO


--  CREATE ALL 10 INDEXES
PRINT ''; PRINT '=== Creating all 10 indexes... ===';

-- IDX-01: Single-column — severity filter (dashboard priority queue)
CREATE NONCLUSTERED INDEX IX_EmReport_Severity
ON Emergency_Report (severity_level)
INCLUDE (report_id, location, disaster_type, report_time, status);

-- IDX-02: Single-column — event drill-down (coordinator view)
CREATE NONCLUSTERED INDEX IX_EmReport_EventId
ON Emergency_Report (disaster_event_id)
INCLUDE (report_id, citizen_id, severity_level, status, report_time);

-- IDX-03: Single-column — time-range queries (real-time feed)
CREATE NONCLUSTERED INDEX IX_EmReport_ReportTime
ON Emergency_Report (report_time DESC)
INCLUDE (report_id, disaster_event_id, severity_level, status);

-- IDX-04: Single-column — disaster type filter (MIS reports)
CREATE NONCLUSTERED INDEX IX_Event_Type
ON Disaster_Event (disaster_type)
INCLUDE (event_id, event_name, location, severity_level, status, start_date);

-- IDX-05: Single-column — event status filter (active events only)
CREATE NONCLUSTERED INDEX IX_Event_Status
ON Disaster_Event (status)
INCLUDE (event_id, event_name, disaster_type, severity_level, start_date);

-- IDX-06: Single-column — inventory by resource (warehouse manager)
CREATE NONCLUSTERED INDEX IX_Inventory_Resource
ON Warehouse_Inventory (resource_id)
INCLUDE (warehouse_id, quantity, threshold_level, last_updated);

-- IDX-07: Single-column — inventory by warehouse (warehouse manager)
CREATE NONCLUSTERED INDEX IX_Inventory_Warehouse
ON Warehouse_Inventory (warehouse_id)
INCLUDE (resource_id, quantity, threshold_level, last_updated);

-- IDX-08: Single-column — financial date range (audit + reporting)
CREATE NONCLUSTERED INDEX IX_FinTxn_Date
ON Financial_Transaction (transaction_date DESC)
INCLUDE (transaction_id, transaction_type, amount, disaster_event_id, recorded_by);

-- IDX-09: Single-column — transaction type filter (donation vs expense)
CREATE NONCLUSTERED INDEX IX_FinTxn_Type
ON Financial_Transaction (transaction_type)
INCLUDE (transaction_id, amount, transaction_date, disaster_event_id);

-- IDX-10: COMPOSITE — event_id + severity (most common dashboard query)
--         Leading column = disaster_event_id (higher selectivity when scoped to one event)
CREATE NONCLUSTERED INDEX IX_EmReport_Event_Sev
ON Emergency_Report (disaster_event_id, severity_level)
INCLUDE (report_id, location, report_time, status);

PRINT '=== All 10 indexes created. Running WITH-INDEX phase. ===';
GO



-- ── SCENARIO A: Filter by severity — WITH index ──────────
PRINT ''; PRINT '=== SCENARIO A (WITH INDEX): Reports by severity = Critical ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT report_id, location, disaster_type, severity_level, report_time, status
FROM   Emergency_Report
WHERE  severity_level = 'Critical'
ORDER BY report_time DESC;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO B: Reports per event — WITH index ───────────
PRINT ''; PRINT '=== SCENARIO B (WITH INDEX): Reports for disaster_event_id = 1 ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT ER.report_id, ER.location, ER.severity_level, ER.status,
       C.full_name AS reported_by
FROM   Emergency_Report ER
INNER JOIN Citizen C ON C.citizen_id = ER.citizen_id
WHERE  ER.disaster_event_id = 1
ORDER BY ER.severity_level DESC;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO C: Time-range — WITH index ──────────────────
PRINT ''; PRINT '=== SCENARIO C (WITH INDEX): Reports in date range ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT report_id, location, disaster_type, severity_level, report_time
FROM   Emergency_Report
WHERE  report_time BETWEEN '2025-08-01' AND '2025-08-31'
ORDER BY report_time;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO D: Events by type — WITH index ──────────────
PRINT ''; PRINT '=== SCENARIO D (WITH INDEX): Disaster events of type Flood ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT event_id, event_name, location, severity_level, status, start_date
FROM   Disaster_Event
WHERE  disaster_type = 'Flood'
ORDER BY severity_level DESC;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO E: Inventory by resource — WITH index ───────
PRINT ''; PRINT '=== SCENARIO E (WITH INDEX): Inventory for resource_id = 1 (Rice) ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT WI.inventory_id, W.warehouse_name, WI.quantity,
       WI.threshold_level, WI.last_updated
FROM   Warehouse_Inventory WI
INNER JOIN Warehouse W ON W.warehouse_id = WI.warehouse_id
WHERE  WI.resource_id = 1
ORDER BY WI.quantity DESC;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO F: Financial timeline — WITH index ──────────
PRINT ''; PRINT '=== SCENARIO F (WITH INDEX): Financial transactions Aug 2025 ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT transaction_id, transaction_type, amount, transaction_date, notes
FROM   Financial_Transaction
WHERE  transaction_date BETWEEN '2025-08-01' AND '2025-08-31'
ORDER BY transaction_date;

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO

-- ── SCENARIO H: Composite — event + severity WITH index ──
PRINT ''; PRINT '=== SCENARIO H (WITH INDEX): Critical reports for event_id=1 ===';
SET STATISTICS TIME ON; SET STATISTICS IO ON;

SELECT report_id, location, severity_level, report_time, status
FROM   Emergency_Report
WHERE  disaster_event_id = 1
AND    severity_level    = 'Critical'
ORDER BY report_time DESC;


SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

GO


--  SCENARIO G — INSERT OVERHEAD (honest trade-off analysis)
--  This is the case where indexing HURTS performance.
--  The spec explicitly asks for this: §14 "Cases where
--  indexing may introduce overhead (inserts/updates)"
PRINT ''; PRINT '=== SCENARIO G: INSERT OVERHEAD — indexes make writes slower ===';

-- G1: INSERT without indexes (drop them first to simulate)
PRINT '--- G1) Baseline INSERT — no indexes on Emergency_Report ---';

DROP INDEX IF EXISTS IX_EmReport_Severity    ON Emergency_Report;
DROP INDEX IF EXISTS IX_EmReport_EventId     ON Emergency_Report;
DROP INDEX IF EXISTS IX_EmReport_ReportTime  ON Emergency_Report;
DROP INDEX IF EXISTS IX_EmReport_Event_Sev   ON Emergency_Report;

SET STATISTICS TIME ON; SET STATISTICS IO ON;

-- Insert 5 rows without index maintenance cost
INSERT INTO Emergency_Report (citizen_id, disaster_event_id, location, latitude, longitude,
    disaster_type, severity_level, report_time, status, description)
VALUES
(1,1,'Test Location A',30.0,70.0,'Flood','High',  GETDATE(),'Active','Perf test row 1'),
(2,1,'Test Location B',30.1,70.1,'Flood','Medium',GETDATE(),'Active','Perf test row 2'),
(3,2,'Test Location C',30.2,70.2,'Earthquake','Critical',GETDATE(),'Active','Perf test row 3'),
(4,3,'Test Location D',30.3,70.3,'Fire','Low',    GETDATE(),'Active','Perf test row 4'),
(5,4,'Test Location E',30.4,70.4,'Flood','High',  GETDATE(),'Active','Perf test row 5');

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

-- G2: Recreate indexes, then INSERT same volume
PRINT '--- G2) INSERT with 4 indexes on Emergency_Report (index maintenance cost) ---';

CREATE NONCLUSTERED INDEX IX_EmReport_Severity   ON Emergency_Report (severity_level)         INCLUDE (report_id, location, disaster_type, report_time, status);
CREATE NONCLUSTERED INDEX IX_EmReport_EventId    ON Emergency_Report (disaster_event_id)      INCLUDE (report_id, citizen_id, severity_level, status, report_time);
CREATE NONCLUSTERED INDEX IX_EmReport_ReportTime ON Emergency_Report (report_time DESC)       INCLUDE (report_id, disaster_event_id, severity_level, status);
CREATE NONCLUSTERED INDEX IX_EmReport_Event_Sev  ON Emergency_Report (disaster_event_id, severity_level) INCLUDE (report_id, location, report_time, status);

SET STATISTICS TIME ON; SET STATISTICS IO ON;

INSERT INTO Emergency_Report (citizen_id, disaster_event_id, location, latitude, longitude,
    disaster_type, severity_level, report_time, status, description)
VALUES
(1,1,'Test Location F',31.0,71.0,'Flood','High',  GETDATE(),'Active','Perf test row 6'),
(2,1,'Test Location G',31.1,71.1,'Flood','Medium',GETDATE(),'Active','Perf test row 7'),
(3,2,'Test Location H',31.2,71.2,'Earthquake','Critical',GETDATE(),'Active','Perf test row 8'),
(4,3,'Test Location I',31.3,71.3,'Fire','Low',    GETDATE(),'Active','Perf test row 9'),
(5,4,'Test Location J',31.4,71.4,'Flood','High',  GETDATE(),'Active','Perf test row 10');

SET STATISTICS TIME OFF; SET STATISTICS IO OFF;

-- Clean up perf test rows
DELETE FROM Emergency_Report WHERE description LIKE 'Perf test row%';

PRINT '--- G analysis: G2 CPU time should be higher than G1 due to index tree updates ---';
PRINT '    This is the write overhead trade-off. Document both numbers in your report.';

GO




SELECT report_id, severity_level, report_time
FROM   Emergency_Report WITH (INDEX = IX_EmReport_Severity)
WHERE  severity_level = 'Critical';

SELECT report_id, severity_level, report_time
FROM   Emergency_Report WITH (INDEX = 0)   
WHERE  severity_level = 'Critical';

GO


--  FINAL INDEX CATALOGUE — what's installed
SELECT
    I.name                              AS index_name,
    OBJECT_NAME(I.object_id)            AS table_name,
    I.type_desc,
    I.is_unique,
    STUFF((
        SELECT ', ' + C2.name
        FROM   sys.index_columns IC2
        INNER JOIN sys.columns C2 ON C2.object_id = IC2.object_id AND C2.column_id = IC2.column_id
        WHERE  IC2.object_id = I.object_id AND IC2.index_id = I.index_id AND IC2.is_included_column = 0
        ORDER BY IC2.key_ordinal
        FOR XML PATH(''), TYPE
    ).value('.','NVARCHAR(MAX)'), 1, 2, '') AS key_columns
FROM       sys.indexes        I
INNER JOIN sys.index_columns  IC ON IC.object_id  = I.object_id
                                 AND IC.index_id   = I.index_id
                                 AND IC.is_included_column = 0
INNER JOIN sys.columns        C  ON C.object_id   = IC.object_id
                                 AND C.column_id   = IC.column_id
WHERE  OBJECT_NAME(I.object_id) IN (
    'Emergency_Report','Disaster_Event',
    'Warehouse_Inventory','Financial_Transaction'
)
AND    I.type > 0    -- exclude heaps
GROUP BY I.name, I.object_id, I.index_id, I.type_desc, I.is_unique
ORDER BY OBJECT_NAME(I.object_id), I.name;

GO

