-- Install remaining triggers (TRG-05 through TRG-08)
IF OBJECT_ID('trg_Procurement_IncrementInventory','TR') IS NOT NULL DROP TRIGGER trg_Procurement_IncrementInventory;
IF OBJECT_ID('trg_Audit_EmergencyReport',         'TR') IS NOT NULL DROP TRIGGER trg_Audit_EmergencyReport;
IF OBJECT_ID('trg_Audit_ResourceAllocation',      'TR') IS NOT NULL DROP TRIGGER trg_Audit_ResourceAllocation;
IF OBJECT_ID('trg_Audit_FinancialTransaction',    'TR') IS NOT NULL DROP TRIGGER trg_Audit_FinancialTransaction;
GO

-- TRG-05: Procurement approved → increment warehouse inventory (using UPDATE instead of MERGE to avoid INSTEAD OF trigger conflict)
CREATE TRIGGER trg_Procurement_IncrementInventory
ON Procurement
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (
        SELECT 1 FROM inserted i
        INNER JOIN deleted d ON d.procurement_id = i.procurement_id
        WHERE i.status = 'Completed' AND d.status = 'Pending'
    ) RETURN;

    -- For rows that already exist in Warehouse_Inventory, update quantity
    UPDATE WI
    SET    WI.quantity     = WI.quantity + src.quantity,
           WI.last_updated = GETDATE()
    FROM   Warehouse_Inventory WI
    INNER JOIN (
        SELECT i.warehouse_id, i.resource_id, i.quantity
        FROM   inserted i INNER JOIN deleted d ON d.procurement_id = i.procurement_id
        WHERE  i.status = 'Completed' AND d.status = 'Pending'
    ) src ON src.warehouse_id = WI.warehouse_id AND src.resource_id = WI.resource_id;

    -- For new inventory rows (no existing record), insert
    INSERT INTO Warehouse_Inventory (warehouse_id, resource_id, quantity, threshold_level, last_updated)
    SELECT src.warehouse_id, src.resource_id, src.quantity, 50, GETDATE()
    FROM (
        SELECT i.warehouse_id, i.resource_id, i.quantity
        FROM   inserted i INNER JOIN deleted d ON d.procurement_id = i.procurement_id
        WHERE  i.status = 'Completed' AND d.status = 'Pending'
    ) src
    WHERE NOT EXISTS (
        SELECT 1 FROM Warehouse_Inventory WI
        WHERE WI.warehouse_id = src.warehouse_id AND WI.resource_id = src.resource_id
    );

    INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    SELECT
        ISNULL(i.approved_by, 1), 'UPDATE', 'Procurement', i.procurement_id,
        '{"status":"Pending"}',
        '{"status":"Completed","quantity_added":' + CAST(i.quantity AS VARCHAR) + '}',
        'TRIGGER'
    FROM inserted i INNER JOIN deleted d ON d.procurement_id = i.procurement_id
    WHERE i.status = 'Completed' AND d.status = 'Pending';
END;
GO

-- TRG-06: Audit — Emergency_Report
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

    IF @action IN ('INSERT','UPDATE')
    BEGIN
        INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
        SELECT
            1, @action, 'Emergency_Report',
            COALESCE(i.report_id, d.report_id),
            CASE WHEN d.report_id IS NOT NULL
                 THEN '{"status":"' + d.status + '","severity":"' + d.severity_level + '"}'
                 ELSE NULL END,
            CASE WHEN i.report_id IS NOT NULL
                 THEN '{"status":"' + i.status + '","severity":"' + i.severity_level
                      + '","location":"' + i.location + '"}'
                 ELSE NULL END,
            'TRIGGER'
        FROM inserted i FULL OUTER JOIN deleted d ON d.report_id = i.report_id;
    END
    ELSE
    BEGIN
        INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
        SELECT 1, 'DELETE', 'Emergency_Report', d.report_id,
               '{"status":"' + d.status + '","severity":"' + d.severity_level + '"}',
               NULL, 'TRIGGER'
        FROM deleted d;
    END
END;
GO

-- TRG-07: Audit — Resource_Allocation
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
        @action, 'Resource_Allocation',
        COALESCE(i.allocation_id, d.allocation_id),
        CASE WHEN d.allocation_id IS NOT NULL
             THEN '{"status":"' + d.status + '","allocated":' + CAST(d.allocated_quantity AS VARCHAR)
                  + ',"dispatched":' + CAST(d.dispatched_quantity AS VARCHAR) + '}'
             ELSE NULL END,
        CASE WHEN i.allocation_id IS NOT NULL
             THEN '{"status":"' + i.status + '","allocated":' + CAST(i.allocated_quantity AS VARCHAR)
                  + ',"dispatched":' + CAST(i.dispatched_quantity AS VARCHAR) + '}'
             ELSE NULL END,
        'TRIGGER'
    FROM inserted i FULL OUTER JOIN deleted d ON d.allocation_id = i.allocation_id;
END;
GO

-- TRG-08: Audit — Financial_Transaction
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
        @action, 'Financial_Transaction',
        COALESCE(i.transaction_id, d.transaction_id),
        CASE WHEN d.transaction_id IS NOT NULL
             THEN '{"type":"' + d.transaction_type + '","amount":' + CAST(d.amount AS VARCHAR) + '}'
             ELSE NULL END,
        CASE WHEN i.transaction_id IS NOT NULL
             THEN '{"type":"' + i.transaction_type + '","amount":' + CAST(i.amount AS VARCHAR) + '}'
             ELSE NULL END,
        'TRIGGER'
    FROM inserted i FULL OUTER JOIN deleted d ON d.transaction_id = i.transaction_id;
END;
GO

SELECT name AS trigger_name, OBJECT_NAME(parent_id) AS on_table
FROM sys.triggers WHERE parent_class = 1 ORDER BY name;
PRINT '=== All 8 triggers now installed ===';
