-- ============================================================
--  Smart Disaster Response MIS
--  TRIGGERS — All 8 triggers in run order
--  Target: SQL Server (T-SQL)
--  Run AFTER ddl.sql and dml.sql
-- ============================================================
--
--  TRIGGER INDEX
--  ─────────────────────────────────────────────────────────
--  TRG-01  trg_TeamAssignment_SetTeamAssigned
--          AFTER INSERT on Team_Assignment
--          → sets Rescue_Team.availability_status = 'Assigned'
--
--  TRG-02  trg_TeamAssignment_FreeTeam
--          AFTER UPDATE on Team_Assignment (status → Completed)
--          → sets Rescue_Team.availability_status = 'Available'
--
--  TRG-03  trg_ResourceAllocation_DecrementInventory
--          AFTER UPDATE on Resource_Allocation (dispatched_quantity changes)
--          → decrements Warehouse_Inventory.quantity
--
--  TRG-04  trg_Inventory_PreventNegative
--          INSTEAD OF UPDATE on Warehouse_Inventory
--          → blocks any update that would make quantity < 0
--
--  TRG-05  trg_Procurement_IncrementInventory
--          AFTER UPDATE on Procurement (status → Completed)
--          → upserts Warehouse_Inventory quantity
--
--  TRG-06  trg_Audit_EmergencyReport
--          AFTER INSERT, UPDATE, DELETE on Emergency_Report → Audit_Log
--
--  TRG-07  trg_Audit_ResourceAllocation
--          AFTER INSERT, UPDATE, DELETE on Resource_Allocation → Audit_Log
--
--  TRG-08  trg_Audit_FinancialTransaction
--          AFTER INSERT, UPDATE, DELETE on Financial_Transaction → Audit_Log
-- ============================================================

-- ── Drop existing triggers (safe re-run) ─────────────────
IF OBJECT_ID('trg_TeamAssignment_SetTeamBusy',            'TR') IS NOT NULL DROP TRIGGER trg_TeamAssignment_SetTeamBusy;
IF OBJECT_ID('trg_TeamAssignment_SetTeamAssigned',         'TR') IS NOT NULL DROP TRIGGER trg_TeamAssignment_SetTeamAssigned;
IF OBJECT_ID('trg_TeamAssignment_FreeTeam',               'TR') IS NOT NULL DROP TRIGGER trg_TeamAssignment_FreeTeam;
IF OBJECT_ID('trg_ResourceAllocation_DecrementInventory', 'TR') IS NOT NULL DROP TRIGGER trg_ResourceAllocation_DecrementInventory;
IF OBJECT_ID('trg_Inventory_PreventNegative',             'TR') IS NOT NULL DROP TRIGGER trg_Inventory_PreventNegative;
IF OBJECT_ID('trg_Procurement_IncrementInventory',        'TR') IS NOT NULL DROP TRIGGER trg_Procurement_IncrementInventory;
IF OBJECT_ID('trg_Audit_EmergencyReport',                 'TR') IS NOT NULL DROP TRIGGER trg_Audit_EmergencyReport;
IF OBJECT_ID('trg_Audit_ResourceAllocation',              'TR') IS NOT NULL DROP TRIGGER trg_Audit_ResourceAllocation;
IF OBJECT_ID('trg_Audit_FinancialTransaction',            'TR') IS NOT NULL DROP TRIGGER trg_Audit_FinancialTransaction;
GO

-- ============================================================
--  TRG-01  Team assigned → mark team Assigned (intermediate state)
--          Team goes Available → Assigned → Busy (on-scene) → Available
-- ============================================================
CREATE TRIGGER trg_TeamAssignment_SetTeamAssigned
ON Team_Assignment
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- A single INSERT may assign multiple teams at once (batch-safe)
    -- Set to 'Assigned' (dispatched but not yet on-scene)
    UPDATE RT
    SET    RT.availability_status = 'Assigned'
    FROM   Rescue_Team RT
    INNER JOIN inserted i ON i.rescue_team_id = RT.team_id
    WHERE  i.status = 'Active'
    AND    RT.availability_status = 'Available';   -- only transition from Available

    -- Audit each assignment
    INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    SELECT
        1,                          -- system user (admin_ali) as trigger actor
        'INSERT',
        'Team_Assignment',
        i.assignment_id,
        NULL,
        '{"rescue_team_id":' + CAST(i.rescue_team_id AS VARCHAR)
            + ',"status":"' + i.status + '"}',
        'TRIGGER'
    FROM inserted i;
END;
GO

-- ── Test TRG-01 ──────────────────────────────────────────
PRINT '--- TRG-01 test: assign Charlie team (team_id=3) to report_id=10 ---';

SELECT team_id, team_name, availability_status
FROM   Rescue_Team WHERE team_id = 3;

INSERT INTO Team_Assignment (rescue_team_id, report_id, assigned_at, status, notes)
VALUES (3, 10, GETDATE(), 'Active', 'TRG-01 test assignment');

SELECT team_id, team_name, availability_status
FROM   Rescue_Team WHERE team_id = 3;  -- should now be 'Assigned'

GO

-- ============================================================
--  TRG-02  Team assignment completed → free the team
-- ============================================================
CREATE TRIGGER trg_TeamAssignment_FreeTeam
ON Team_Assignment
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only fire when status transitions to 'Completed'
    IF NOT EXISTS (
        SELECT 1 FROM inserted i
        INNER JOIN deleted d ON d.assignment_id = i.assignment_id
        WHERE i.status = 'Completed' AND d.status != 'Completed'
    ) RETURN;

    -- Free teams that have NO remaining active assignments after this update
    -- Handles teams in both 'Assigned' and 'Busy' states
    UPDATE RT
    SET    RT.availability_status = 'Available'
    FROM   Rescue_Team RT
    INNER JOIN inserted i ON i.rescue_team_id = RT.team_id
    WHERE  i.status = 'Completed'
    AND    RT.availability_status IN ('Assigned', 'Busy')
    AND    RT.team_id NOT IN (
        -- Teams still active somewhere
        SELECT rescue_team_id
        FROM   Team_Assignment
        WHERE  status IN ('Active', 'Pending')
    );

    INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    SELECT
        1, 'UPDATE', 'Team_Assignment', i.assignment_id,
        '{"status":"' + d.status + '"}',
        '{"status":"' + i.status + '"}',
        'TRIGGER'
    FROM inserted i
    INNER JOIN deleted d ON d.assignment_id = i.assignment_id
    WHERE i.status = 'Completed' AND d.status != 'Completed';
END;
GO

-- ── Test TRG-02 ──────────────────────────────────────────
PRINT '--- TRG-02 test: complete the assignment just created ---';

DECLARE @test_assignment_id INT = (SELECT MAX(assignment_id) FROM Team_Assignment WHERE rescue_team_id = 3);

UPDATE Team_Assignment
SET    status       = 'Completed',
       completed_at = GETDATE()
WHERE  assignment_id = @test_assignment_id;

SELECT team_id, team_name, availability_status
FROM   Rescue_Team WHERE team_id = 3;  -- should be 'Available' again (if no other active assignments)

GO

-- ============================================================
--  TRG-03  Resource dispatched → decrement warehouse inventory
-- ============================================================
CREATE TRIGGER trg_ResourceAllocation_DecrementInventory
ON Resource_Allocation
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only fire when dispatched_quantity actually increases
    IF NOT EXISTS (
        SELECT 1 FROM inserted i
        INNER JOIN deleted d ON d.allocation_id = i.allocation_id
        WHERE i.dispatched_quantity > d.dispatched_quantity
    ) RETURN;

    -- Decrement by the NET new dispatch (supports partial dispatches over time)
    UPDATE WI
    SET    WI.quantity     = WI.quantity - (i.dispatched_quantity - d.dispatched_quantity),
           WI.last_updated = GETDATE()
    FROM   Warehouse_Inventory WI
    INNER JOIN inserted i ON i.inventory_id = WI.inventory_id
    INNER JOIN deleted  d ON d.allocation_id = i.allocation_id;
    -- Note: trg_Inventory_PreventNegative (TRG-04) will block this if stock goes negative

    INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    SELECT
        i.requested_by, 'UPDATE', 'Resource_Allocation', i.allocation_id,
        '{"dispatched_quantity":' + CAST(d.dispatched_quantity AS VARCHAR) + '}',
        '{"dispatched_quantity":' + CAST(i.dispatched_quantity AS VARCHAR) + '}',
        'TRIGGER'
    FROM inserted i
    INNER JOIN deleted d ON d.allocation_id = i.allocation_id
    WHERE i.dispatched_quantity > d.dispatched_quantity;
END;
GO

-- ── Test TRG-03 ──────────────────────────────────────────
PRINT '--- TRG-03 test: dispatch 50 units from allocation_id=1 ---';

SELECT WI.inventory_id, WI.quantity AS qty_before
FROM   Warehouse_Inventory WI
INNER JOIN Resource_Allocation RA ON RA.inventory_id = WI.inventory_id
WHERE  RA.allocation_id = 1;

UPDATE Resource_Allocation
SET    dispatched_quantity = dispatched_quantity + 50
WHERE  allocation_id = 1;

SELECT WI.inventory_id, WI.quantity AS qty_after
FROM   Warehouse_Inventory WI
INNER JOIN Resource_Allocation RA ON RA.inventory_id = WI.inventory_id
WHERE  RA.allocation_id = 1;  -- should be 50 less

GO

-- ============================================================
--  TRG-04  INSTEAD OF UPDATE — prevent negative inventory
-- ============================================================
CREATE TRIGGER trg_Inventory_PreventNegative
ON Warehouse_Inventory
INSTEAD OF UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Check for any attempted negative update
    IF EXISTS (SELECT 1 FROM inserted WHERE quantity < 0)
    BEGIN
        -- Log the blocked attempt
        INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
        SELECT
            1, 'UPDATE', 'Warehouse_Inventory', i.inventory_id,
            '{"quantity":' + CAST(d.quantity AS VARCHAR) + '}',
            '{"quantity_attempted":' + CAST(i.quantity AS VARCHAR) + ',"blocked":true}',
            'TRIGGER'
        FROM inserted i
        INNER JOIN deleted d ON d.inventory_id = i.inventory_id
        WHERE i.quantity < 0;

        RAISERROR('TRIGGER BLOCK: Warehouse inventory cannot go below zero. Update rejected.', 16, 1);
        RETURN;
    END

    -- All rows are valid — perform the real update
    UPDATE WI
    SET    WI.quantity        = i.quantity,
           WI.threshold_level = i.threshold_level,
           WI.last_updated    = GETDATE()
    FROM   Warehouse_Inventory WI
    INNER JOIN inserted i ON i.inventory_id = WI.inventory_id;
END;
GO

-- ── Test TRG-04 (happy path) ─────────────────────────────
PRINT '--- TRG-04 test (valid): update inventory_id=1 to 9999 ---';

UPDATE Warehouse_Inventory SET quantity = 9999 WHERE inventory_id = 1;

SELECT inventory_id, quantity FROM Warehouse_Inventory WHERE inventory_id = 1;

GO

-- ── Test TRG-04 (blocked) ────────────────────────────────
PRINT '--- TRG-04 test (blocked): attempt to set quantity = -1 ---';

BEGIN TRY
    UPDATE Warehouse_Inventory SET quantity = -1 WHERE inventory_id = 1;
END TRY
BEGIN CATCH
    PRINT '>>> BLOCKED by TRG-04: ' + ERROR_MESSAGE();
END CATCH;

SELECT inventory_id, quantity FROM Warehouse_Inventory WHERE inventory_id = 1;  -- unchanged

GO

-- ============================================================
--  TRG-05  Procurement approved → increment warehouse inventory
-- ============================================================
CREATE TRIGGER trg_Procurement_IncrementInventory
ON Procurement
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only fire on Pending → Completed transitions
    IF NOT EXISTS (
        SELECT 1 FROM inserted i
        INNER JOIN deleted d ON d.procurement_id = i.procurement_id
        WHERE i.status = 'Completed' AND d.status = 'Pending'
    ) RETURN;

    -- Use UPDATE + INSERT instead of MERGE because Warehouse_Inventory has an INSTEAD OF UPDATE trigger.
    -- SQL Server blocks MERGE when only some actions have INSTEAD OF triggers.
    UPDATE WI
    SET    WI.quantity     = WI.quantity + src.quantity,
           WI.last_updated = GETDATE()
    FROM   Warehouse_Inventory WI
    INNER JOIN (
        SELECT i.warehouse_id, i.resource_id, i.quantity
        FROM   inserted i
        INNER JOIN deleted d ON d.procurement_id = i.procurement_id
        WHERE  i.status = 'Completed' AND d.status = 'Pending'
    ) src ON src.warehouse_id = WI.warehouse_id
         AND src.resource_id  = WI.resource_id;

    INSERT INTO Warehouse_Inventory (warehouse_id, resource_id, quantity, threshold_level, last_updated)
    SELECT src.warehouse_id, src.resource_id, src.quantity, 50, GETDATE()
    FROM (
        SELECT i.warehouse_id, i.resource_id, i.quantity
        FROM   inserted i
        INNER JOIN deleted d ON d.procurement_id = i.procurement_id
        WHERE  i.status = 'Completed' AND d.status = 'Pending'
    ) src
    WHERE NOT EXISTS (
        SELECT 1
        FROM Warehouse_Inventory WI
        WHERE WI.warehouse_id = src.warehouse_id
          AND WI.resource_id  = src.resource_id
    );

    INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    SELECT
        i.approved_by, 'UPDATE', 'Procurement', i.procurement_id,
        '{"status":"Pending"}',
        '{"status":"Completed","quantity_added":' + CAST(i.quantity AS VARCHAR) + '}',
        'TRIGGER'
    FROM inserted i
    INNER JOIN deleted d ON d.procurement_id = i.procurement_id
    WHERE i.status = 'Completed' AND d.status = 'Pending';
END;
GO

-- ── Test TRG-05 ──────────────────────────────────────────
PRINT '--- TRG-05 test: approve procurement_id=7 (2000 MRE packs) ---';

SELECT WI.inventory_id, WI.quantity AS qty_before
FROM   Warehouse_Inventory WI
INNER JOIN Procurement P ON P.warehouse_id = WI.warehouse_id AND P.resource_id = WI.resource_id
WHERE  P.procurement_id = 7;

UPDATE Procurement SET status = 'Completed' WHERE procurement_id = 7 AND status = 'Pending';

SELECT WI.inventory_id, WI.quantity AS qty_after
FROM   Warehouse_Inventory WI
INNER JOIN Procurement P ON P.warehouse_id = WI.warehouse_id AND P.resource_id = WI.resource_id
WHERE  P.procurement_id = 7;  -- should be higher

GO

-- ============================================================
--  TRG-06  Audit — Emergency_Report
-- ============================================================
CREATE TRIGGER trg_Audit_EmergencyReport
ON Emergency_Report
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @action VARCHAR(10);

    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
        SET @action = 'UPDATE';
    ELSE IF EXISTS (SELECT 1 FROM inserted)
        SET @action = 'INSERT';
    ELSE
        SET @action = 'DELETE';

    IF @action IN ('INSERT', 'UPDATE')
    BEGIN
        INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
        SELECT
            1,
            @action,
            'Emergency_Report',
            COALESCE(i.report_id, d.report_id),
            CASE WHEN d.report_id IS NOT NULL
                 THEN '{"status":"' + d.status + '","severity":"' + d.severity_level + '"}'
                 ELSE NULL END,
            CASE WHEN i.report_id IS NOT NULL
                 THEN '{"status":"' + i.status + '","severity":"' + i.severity_level
                      + '","location":"' + i.location + '"}'
                 ELSE NULL END,
            'TRIGGER'
        FROM inserted i
        FULL OUTER JOIN deleted d ON d.report_id = i.report_id;
    END
    ELSE  -- DELETE
    BEGIN
        INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
        SELECT
            1, 'DELETE', 'Emergency_Report', d.report_id,
            '{"status":"' + d.status + '","severity":"' + d.severity_level + '"}',
            NULL, 'TRIGGER'
        FROM deleted d;
    END
END;
GO

-- ── Test TRG-06 ──────────────────────────────────────────
PRINT '--- TRG-06 test: update report_id=10 status to Completed ---';

UPDATE Emergency_Report SET status = 'Completed' WHERE report_id = 10;

SELECT TOP 1 * FROM Audit_Log ORDER BY log_id DESC;  -- should show the UPDATE

GO

-- ============================================================
--  TRG-07  Audit — Resource_Allocation
-- ============================================================
CREATE TRIGGER trg_Audit_ResourceAllocation
ON Resource_Allocation
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @action VARCHAR(10);

    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
        SET @action = 'UPDATE';
    ELSE IF EXISTS (SELECT 1 FROM inserted)
        SET @action = 'INSERT';
    ELSE
        SET @action = 'DELETE';

    INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    SELECT
        COALESCE(i.requested_by, d.requested_by),
        @action,
        'Resource_Allocation',
        COALESCE(i.allocation_id, d.allocation_id),
        CASE WHEN d.allocation_id IS NOT NULL
             THEN '{"status":"' + d.status
                  + '","allocated":' + CAST(d.allocated_quantity AS VARCHAR)
                  + ',"dispatched":' + CAST(d.dispatched_quantity AS VARCHAR) + '}'
             ELSE NULL END,
        CASE WHEN i.allocation_id IS NOT NULL
             THEN '{"status":"' + i.status
                  + '","allocated":' + CAST(i.allocated_quantity AS VARCHAR)
                  + ',"dispatched":' + CAST(i.dispatched_quantity AS VARCHAR) + '}'
             ELSE NULL END,
        'TRIGGER'
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.allocation_id = i.allocation_id;
END;
GO

-- ── Test TRG-07 ──────────────────────────────────────────
PRINT '--- TRG-07 test: complete allocation_id=5 ---';

UPDATE Resource_Allocation SET status = 'Completed' WHERE allocation_id = 5;

SELECT TOP 1 * FROM Audit_Log ORDER BY log_id DESC;

GO

-- ============================================================
--  TRG-08  Audit — Financial_Transaction
-- ============================================================
CREATE TRIGGER trg_Audit_FinancialTransaction
ON Financial_Transaction
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @action VARCHAR(10);

    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
        SET @action = 'UPDATE';
    ELSE IF EXISTS (SELECT 1 FROM inserted)
        SET @action = 'INSERT';
    ELSE
        SET @action = 'DELETE';

    INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    SELECT
        COALESCE(i.recorded_by, d.recorded_by),
        @action,
        'Financial_Transaction',
        COALESCE(i.transaction_id, d.transaction_id),
        CASE WHEN d.transaction_id IS NOT NULL
             THEN '{"type":"' + d.transaction_type
                  + '","amount":' + CAST(d.amount AS VARCHAR) + '}'
             ELSE NULL END,
        CASE WHEN i.transaction_id IS NOT NULL
             THEN '{"type":"' + i.transaction_type
                  + '","amount":' + CAST(i.amount AS VARCHAR) + '}'
             ELSE NULL END,
        'TRIGGER'
    FROM inserted i
    FULL OUTER JOIN deleted d ON d.transaction_id = i.transaction_id;
END;
GO

-- ── Test TRG-08 ──────────────────────────────────────────
PRINT '--- TRG-08 test: insert a new Financial_Transaction ---';

INSERT INTO Financial_Transaction
    (transaction_type, reference_id, disaster_event_id, amount, recorded_by, notes)
VALUES
    ('Donation', 8, 6, 20000.00, 5, 'TRG-08 audit test');

SELECT TOP 1 * FROM Audit_Log ORDER BY log_id DESC;

GO

-- ============================================================
--  VERIFICATION — show all 8 triggers
-- ============================================================
SELECT
    name        AS trigger_name,
    OBJECT_NAME(parent_id) AS on_table,
    type_desc,
    is_disabled,
    create_date
FROM   sys.triggers
WHERE  parent_class = 1    -- table triggers only
ORDER  BY parent_id, name;

PRINT '=== All triggers installed. ===';
