-- ============================================================
--  TRANSACTION 3 — Procurement
--  Smart Disaster Response MIS
--
--  Steps (from Design Rationale §17.3):
--    1. INSERT Procurement (status='Pending')
--    2. INSERT Approval_Request linked by procurement_id
--    On approval signal:
--    3. UPDATE Procurement.status = 'Completed'
--    4. UPDATE+INSERT Warehouse_Inventory (upsert — handles first-time stocking)
--    5. INSERT Financial_Transaction (type='Procurement')
--    6. INSERT Audit_Log
--
--  The two phases (create + approve) are separate transactions,
--  each independently atomic.
-- ============================================================

-- ── Parameters ──
DECLARE @resource_id        INT            = 6;        -- Blankets
DECLARE @warehouse_id       INT            = 3;        -- KPK Emergency Warehouse
DECLARE @quantity           INT            = 500;
DECLARE @unit_cost          DECIMAL(15,2)  = 850.00;
DECLARE @supplier_name      VARCHAR(255)   = 'Pak Textile Relief Supplies';
DECLARE @approved_by_user   INT            = 1;        -- admin_ali
DECLARE @recorded_by_user   INT            = 5;        -- fin_ahmed
DECLARE @disaster_event_id  INT            = 4;        -- KPK Flash Floods
DECLARE @threshold_default  INT            = 100;      -- default low-stock threshold

-- ── Internal ──
DECLARE @new_procurement_id INT;
DECLARE @total_cost         DECIMAL(15,2)  = @quantity * @unit_cost;

PRINT '=== TRANSACTION 3: Procurement — Phase 1 (Create & Request Approval) ===';
PRINT 'Item: resource_id=' + CAST(@resource_id AS VARCHAR) + ' | Qty: ' + CAST(@quantity AS VARCHAR) + ' | Total: PKR ' + CAST(@total_cost AS VARCHAR);

-- ══════════════════════════════════════════════════════════
--  PHASE 1 — Create procurement record and approval request
-- ══════════════════════════════════════════════════════════
BEGIN TRY
    BEGIN TRANSACTION T3_ProcurementCreate;

    -- Step 1: Insert procurement in Pending state
    INSERT INTO Procurement
        (resource_id, warehouse_id, disaster_event_id, quantity, unit_cost,
         procurement_date, supplier_name, approved_by, status)
    VALUES
        (@resource_id, @warehouse_id, @disaster_event_id, @quantity, @unit_cost,
         GETDATE(), @supplier_name, @approved_by_user, 'Pending');

    SET @new_procurement_id = SCOPE_IDENTITY();
    PRINT 'Procurement inserted (Pending) — procurement_id: ' + CAST(@new_procurement_id AS VARCHAR);

    IF @new_procurement_id IS NULL
        RAISERROR('ERROR: Procurement insert failed. Rolling back.', 16, 1);

    -- Step 2: Create matching approval request using procurement_id.
    INSERT INTO Approval_Request
        (request_type, requested_by, approved_by, procurement_id,
         status, request_date, resolved_date, remarks)
    VALUES
        ('Procurement', @approved_by_user, NULL, @new_procurement_id,
         'Pending', GETDATE(), NULL,
         'Procurement #' + CAST(@new_procurement_id AS VARCHAR) + ' awaiting finance approval');

    PRINT 'Approval_Request inserted — status: Pending.';

    COMMIT TRANSACTION T3_ProcurementCreate;
    PRINT '>>> COMMIT — Phase 1 complete. Awaiting approval.';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T3_ProcurementCreate;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'No procurement or approval request recorded.';
END CATCH;

GO

-- ══════════════════════════════════════════════════════════
--  PHASE 2 — Approve: update status, upsert inventory, log
-- ══════════════════════════════════════════════════════════
PRINT '';
PRINT '=== TRANSACTION 3: Procurement — Phase 2 (Approval & Inventory Update) ===';

-- Re-declare for Phase 2 (GO resets scope)
DECLARE @proc_id_p2         INT            = (SELECT MAX(procurement_id) FROM Procurement);
DECLARE @res_id_p2          INT;
DECLARE @wh_id_p2           INT;
DECLARE @qty_p2             INT;
DECLARE @unit_cost_p2       DECIMAL(15,2);
DECLARE @total_cost_p2      DECIMAL(15,2);
DECLARE @approver_p2        INT            = 1;   -- admin_ali
DECLARE @recorder_p2        INT            = 5;
DECLARE @disaster_id_p2     INT            = 4;
DECLARE @thresh_p2          INT            = 100;

-- Load the procurement row we just inserted
SELECT  @res_id_p2     = resource_id,
        @wh_id_p2      = warehouse_id,
        @qty_p2        = quantity,
        @unit_cost_p2  = unit_cost,
        @disaster_id_p2 = ISNULL(disaster_event_id, @disaster_id_p2)
FROM    Procurement
WHERE   procurement_id = @proc_id_p2;

SET @total_cost_p2 = @qty_p2 * @unit_cost_p2;

BEGIN TRY
    BEGIN TRANSACTION T3_ProcurementApprove;

    -- Step 3: Mark procurement as Completed
    UPDATE Procurement
    SET    status = 'Completed'
    WHERE  procurement_id = @proc_id_p2;

    PRINT 'Procurement status → Completed.';

    -- Step 4: Upsert Warehouse_Inventory using UPDATE + INSERT.
    -- MERGE is avoided because Warehouse_Inventory has an INSTEAD OF UPDATE trigger.
    -- UPDATE handled by trg_Procurement_IncrementInventory
    /*
    UPDATE Warehouse_Inventory
    SET    quantity     = quantity + @qty_p2,
           last_updated = GETDATE()
    WHERE  warehouse_id = @wh_id_p2
      AND  resource_id  = @res_id_p2;

    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO Warehouse_Inventory (warehouse_id, resource_id, quantity, threshold_level, last_updated)
        VALUES (@wh_id_p2, @res_id_p2, @qty_p2, @thresh_p2, GETDATE());
    END
    */

    PRINT 'Warehouse_Inventory upserted — resource_id: ' + CAST(@res_id_p2 AS VARCHAR)
        + ' in warehouse_id: ' + CAST(@wh_id_p2 AS VARCHAR);

    -- Step 5: Financial ledger entry
    INSERT INTO Financial_Transaction
        (transaction_type, reference_id, disaster_event_id, amount,
         transaction_date, recorded_by, notes)
    VALUES
        ('Procurement', @proc_id_p2, @disaster_id_p2, @total_cost_p2,
         GETDATE(), @recorder_p2,
         'Procurement #' + CAST(@proc_id_p2 AS VARCHAR) + ' approved and fulfilled');

    PRINT 'Financial_Transaction (Procurement) inserted — amount: PKR ' + CAST(@total_cost_p2 AS VARCHAR);

    -- Step 6: Audit log
    INSERT INTO Audit_Log
        (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    VALUES
        (@approver_p2, 'UPDATE', 'Procurement', @proc_id_p2,
         '{"status":"Pending"}', '{"status":"Completed"}', '192.168.1.1');

    COMMIT TRANSACTION T3_ProcurementApprove;
    PRINT '>>> COMMIT — Phase 2 complete. Inventory updated and financial record created.';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T3_ProcurementApprove;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Procurement status, inventory, and financial records all rolled back.';
END CATCH;

GO

-- ══════════════════════════════════════════════════════════
--  FAILURE PATH — zero quantity (CHECK constraint violation)
-- ══════════════════════════════════════════════════════════
PRINT '';
PRINT '=== TRANSACTION 3 (FAILURE PATH): Zero quantity procurement ===';

BEGIN TRY
    BEGIN TRANSACTION T3_Fail;

    INSERT INTO Procurement
        (resource_id, warehouse_id, disaster_event_id, quantity, unit_cost,
         procurement_date, supplier_name, approved_by, status)
    VALUES
        (1, 1, 1, 0, 3500.00, GETDATE(), 'Bad Supplier', 1, 'Pending');
        -- quantity=0 violates CHECK (quantity > 0)

    COMMIT TRANSACTION T3_Fail;
    PRINT '>>> COMMIT';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T3_Fail;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Zero-quantity procurement rejected. Database unchanged.';
END CATCH;
