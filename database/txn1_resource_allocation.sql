
--  TRANSACTION 1 — Resource Allocation
--  Steps (from Design Rationale §17.3):
--    1. Lock inventory row (pessimistic, prevents double-allocation)
--    2. Validate sufficient stock
--    3. INSERT Resource_Allocation
--    4. INSERT Approval_Request
--    5. UPDATE Warehouse_Inventory (decrement)
--    6. INSERT Financial_Transaction (Expense record)
--    7. INSERT Audit_Log


DECLARE @inventory_id       INT           = 1;     -- Rice sacks, Sindh depot
DECLARE @report_id          INT           = 1;     -- Sukkur flood report
DECLARE @requested_by_user  INT           = 3;     -- rescue_omar
DECLARE @qty_requested      INT           = 100;   -- sacks requested
DECLARE @disaster_event_id  INT           = 1;     -- Indus Flood 2025
DECLARE @recorded_by_user   INT           = 5;     -- fin_ahmed

--  Internal variables 
DECLARE @current_qty        INT;
DECLARE @new_allocation_id  INT;
DECLARE @unit_cost_estimate DECIMAL(15,2) = 3500.00;  -- per sack (from procurement)
DECLARE @total_expense      DECIMAL(15,2);

SET @total_expense = @qty_requested * @unit_cost_estimate;

PRINT '=== TRANSACTION 1: Resource Allocation ===';
PRINT 'Requesting ' + CAST(@qty_requested AS VARCHAR) + ' units from inventory_id ' + CAST(@inventory_id AS VARCHAR);


--  HAPPY PATH — sufficient stock available
BEGIN TRY
    BEGIN TRANSACTION T1_ResourceAllocation;

    -- Step 1: Lock the inventory row
    SELECT @current_qty = quantity
    FROM   Warehouse_Inventory WITH (UPDLOCK, ROWLOCK)
    WHERE  inventory_id = @inventory_id;

    PRINT 'Current stock: ' + CAST(@current_qty AS VARCHAR);

    -- Step 2: Validate stock
    IF @current_qty IS NULL
    BEGIN
        RAISERROR('ERROR: Inventory record not found. Rolling back.', 16, 1);
    END

    IF @current_qty < @qty_requested
    BEGIN
        RAISERROR('ERROR: Insufficient stock. Available: %d, Requested: %d. Rolling back.',
                  16, 1, @current_qty, @qty_requested);
    END

    -- Step 3: Record the allocation
    INSERT INTO Resource_Allocation
        (inventory_id, report_id, requested_by, allocated_quantity,
         dispatched_quantity, consumed_quantity, allocation_date, status)
    VALUES
        (@inventory_id, @report_id, @requested_by_user, @qty_requested,
         0, 0, GETDATE(), 'Pending');

    SET @new_allocation_id = SCOPE_IDENTITY();
    PRINT 'Resource_Allocation inserted — allocation_id: ' + CAST(@new_allocation_id AS VARCHAR);

    -- Step 4: Create an approval request for this allocation
    INSERT INTO Approval_Request
        (request_type, requested_by, approved_by, allocation_id,
         status, request_date, resolved_date, remarks)
    VALUES
        ('Resource_Allocation', @requested_by_user, NULL, @new_allocation_id,
         'Pending', GETDATE(), NULL, 'Auto-generated on allocation creation');

    PRINT 'Approval_Request inserted — awaiting approver.';

    -- Step 5: Decrement warehouse inventory
    UPDATE Warehouse_Inventory
    SET    quantity     = quantity - @qty_requested,
           last_updated = GETDATE()
    WHERE  inventory_id = @inventory_id;

    PRINT 'Warehouse_Inventory updated — new quantity: ' + CAST((@current_qty - @qty_requested) AS VARCHAR);

    -- Step 6: Record a financial expense entry
    INSERT INTO Financial_Transaction
        (transaction_type, reference_id, disaster_event_id, amount,
         transaction_date, recorded_by, notes)
    VALUES
        ('Expense', @new_allocation_id, @disaster_event_id, @total_expense,
         GETDATE(), @recorded_by_user,
         'Resource allocation #' + CAST(@new_allocation_id AS VARCHAR) + ' — dispatch expense');

    PRINT 'Financial_Transaction (Expense) inserted — amount: ' + CAST(@total_expense AS VARCHAR);

    -- Step 7: Audit log entry
    INSERT INTO Audit_Log
        (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    VALUES
        (@requested_by_user, 'INSERT', 'Resource_Allocation', @new_allocation_id,
         NULL,
         '{"allocated_quantity":' + CAST(@qty_requested AS VARCHAR) + ',"status":"Pending"}',
         '192.168.1.10');

    COMMIT TRANSACTION T1_ResourceAllocation;
    PRINT '>>> COMMIT — Resource allocation completed successfully.';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T1_ResourceAllocation;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Inventory quantity unchanged. No records written.';
END CATCH;

GO


--  FAILURE PATH — request more than available stock
PRINT '';
PRINT '=== TRANSACTION 1 (FAILURE PATH): Requesting more than available ===';

DECLARE @inventory_id2      INT           = 1;
DECLARE @report_id2         INT           = 1;
DECLARE @requested_by2      INT           = 3;
DECLARE @qty_too_large      INT           = 999999;   -- deliberately exceeds stock
DECLARE @disaster_id2       INT           = 1;
DECLARE @recorder2          INT           = 5;
DECLARE @current_qty2       INT;
DECLARE @alloc_id2          INT;

BEGIN TRY
    BEGIN TRANSACTION T1_Fail;

    SELECT @current_qty2 = quantity
    FROM   Warehouse_Inventory WITH (UPDLOCK, ROWLOCK)
    WHERE  inventory_id = @inventory_id2;

    PRINT 'Current stock: ' + CAST(@current_qty2 AS VARCHAR);

    IF @current_qty2 < @qty_too_large
    BEGIN
        RAISERROR('ERROR: Insufficient stock. Available: %d, Requested: %d. Rolling back.',
                  16, 1, @current_qty2, @qty_too_large);
    END

    -- (Steps below never execute in this path)
    INSERT INTO Resource_Allocation
        (inventory_id, report_id, requested_by, allocated_quantity,
         dispatched_quantity, consumed_quantity, allocation_date, status)
    VALUES
        (@inventory_id2, @report_id2, @requested_by2, @qty_too_large,
         0, 0, GETDATE(), 'Pending');

    COMMIT TRANSACTION T1_Fail;
    PRINT '>>> COMMIT';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T1_Fail;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Database unchanged. No records written.';
END CATCH;
