-- ============================================================
--  TRANSACTION 4 — Disaster Event Closure
--  Smart Disaster Response MIS
--
--  Steps (from Design Rationale §17.3):
--    1. Validate event exists and is Active (cannot close what's closed)
--    2. UPDATE Disaster_Event → status='Completed', end_date=NOW()
--    3. UPDATE all active Team_Assignment rows for this event → 'Completed'
--    4. UPDATE Rescue_Team.availability_status → 'Available' for freed teams
--    5. UPDATE open Resource_Allocation rows for this event → 'Completed'
--    6. UPDATE open Approval_Request rows tied to this event → 'Rejected' (lapse)
--    7. INSERT Audit_Log (closure record)
--    COMMIT or ROLLBACK — all steps succeed together or none do.
-- ============================================================

-- ── Parameters ──
DECLARE @event_id_to_close  INT  = 6;        -- Islamabad Landslide (status='Active' — safe to close)
DECLARE @closed_by_user     INT  = 2;        -- coord_sara

-- ── Internal ──
DECLARE @current_status     VARCHAR(20);
DECLARE @event_name         VARCHAR(255);
DECLARE @teams_freed        INT  = 0;
DECLARE @assignments_closed INT  = 0;
DECLARE @allocs_closed      INT  = 0;
DECLARE @requests_lapsed    INT  = 0;

PRINT '=== TRANSACTION 4: Disaster Event Closure ===';
PRINT 'Closing event_id: ' + CAST(@event_id_to_close AS VARCHAR);

-- ══════════════════════════════════════════════════════════
--  HAPPY PATH — close an active event  
-- ══════════════════════════════════════════════════════════
BEGIN TRY
    BEGIN TRANSACTION T4_EventClosure;

    -- Step 1: Validate the event exists and can be closed
    SELECT @current_status = status,
           @event_name     = event_name
    FROM   Disaster_Event WITH (UPDLOCK)
    WHERE  event_id = @event_id_to_close;

    IF @current_status IS NULL
        RAISERROR('ERROR: Disaster event %d not found. Rolling back.', 16, 1, @event_id_to_close);

    IF @current_status IN ('Completed', 'Inactive')
        RAISERROR('ERROR: Event "%s" is already closed (status: %s). Rolling back.',
                  16, 1, @event_name, @current_status);

    PRINT 'Closing: "' + @event_name + '" — current status: ' + @current_status;

    -- Step 2: Close the disaster event itself
    UPDATE Disaster_Event
    SET    status   = 'Completed',
           end_date = GETDATE()
    WHERE  event_id = @event_id_to_close;

    PRINT 'Disaster_Event → Completed, end_date stamped.';

    -- Step 3: Complete all active team assignments linked to this event's reports
    UPDATE TA
    SET    TA.status       = 'Completed',
           TA.completed_at = GETDATE(),
           TA.notes        = ISNULL(CAST(TA.notes AS VARCHAR(MAX)), '') + ' | Auto-completed on event closure.'
    FROM   Team_Assignment TA
    INNER JOIN Emergency_Report ER ON ER.report_id = TA.report_id
    WHERE  ER.disaster_event_id = @event_id_to_close
    AND    TA.status IN ('Active', 'Pending');

    SET @assignments_closed = @@ROWCOUNT;
    PRINT 'Team_Assignment: ' + CAST(@assignments_closed AS VARCHAR) + ' row(s) → Completed.';

    -- Step 4: Free up rescue teams whose ALL active assignments are now done
    UPDATE RT
    SET    RT.availability_status = 'Available'
    FROM   Rescue_Team RT
    WHERE  RT.team_id IN (
        -- Teams that had assignments for this event
        SELECT DISTINCT TA.rescue_team_id
        FROM   Team_Assignment TA
        INNER JOIN Emergency_Report ER ON ER.report_id = TA.report_id
        WHERE  ER.disaster_event_id = @event_id_to_close
    )
    AND RT.team_id NOT IN (
        -- Exclude teams that still have active assignments elsewhere
        SELECT DISTINCT TA2.rescue_team_id
        FROM   Team_Assignment TA2
        INNER JOIN Emergency_Report ER2 ON ER2.report_id = TA2.report_id
        WHERE  TA2.status IN ('Active', 'Pending')
        AND    ER2.disaster_event_id != @event_id_to_close
    )
    AND RT.availability_status != 'Available';  -- only update if currently occupied

    SET @teams_freed = @@ROWCOUNT;
    PRINT 'Rescue_Team: ' + CAST(@teams_freed AS VARCHAR) + ' team(s) → Available.';

    -- Step 5: Complete any open resource allocations for this event
    UPDATE RA
    SET    RA.status = 'Completed'
    FROM   Resource_Allocation RA
    INNER JOIN Emergency_Report ER ON ER.report_id = RA.report_id
    WHERE  ER.disaster_event_id = @event_id_to_close
    AND    RA.status IN ('Active', 'Pending');

    SET @allocs_closed = @@ROWCOUNT;
    PRINT 'Resource_Allocation: ' + CAST(@allocs_closed AS VARCHAR) + ' row(s) → Completed.';

    -- Step 6: Lapse any pending approval requests for this event's allocations
    UPDATE AR
    SET    AR.status        = 'Rejected',
           AR.resolved_date = GETDATE(),
           AR.remarks       = ISNULL(CAST(AR.remarks AS VARCHAR(MAX)), '') + ' | Lapsed — parent event closed.'
    FROM   Approval_Request AR
    INNER JOIN Resource_Allocation RA ON RA.allocation_id = AR.allocation_id
    INNER JOIN Emergency_Report ER    ON ER.report_id     = RA.report_id
    WHERE  ER.disaster_event_id = @event_id_to_close
    AND    AR.status = 'Pending';

    SET @requests_lapsed = @@ROWCOUNT;
    PRINT 'Approval_Request: ' + CAST(@requests_lapsed AS VARCHAR) + ' pending request(s) lapsed → Rejected.';

    -- Step 7: Audit log — single closure record summarising all changes
    INSERT INTO Audit_Log
        (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    VALUES
        (@closed_by_user, 'UPDATE', 'Disaster_Event', @event_id_to_close,
         '{"status":"' + @current_status + '"}',
         '{"status":"Completed"'
             + ',"assignments_closed":' + CAST(@assignments_closed AS VARCHAR)
             + ',"teams_freed":'        + CAST(@teams_freed AS VARCHAR)
             + ',"allocs_closed":'      + CAST(@allocs_closed AS VARCHAR)
             + ',"requests_lapsed":'    + CAST(@requests_lapsed AS VARCHAR)
             + '}',
         '192.168.1.2');

    COMMIT TRANSACTION T4_EventClosure;
    PRINT '>>> COMMIT — Disaster event closure completed.';
    PRINT '    Assignments closed : ' + CAST(@assignments_closed AS VARCHAR);
    PRINT '    Teams freed        : ' + CAST(@teams_freed AS VARCHAR);
    PRINT '    Allocations closed : ' + CAST(@allocs_closed AS VARCHAR);
    PRINT '    Requests lapsed    : ' + CAST(@requests_lapsed AS VARCHAR);

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T4_EventClosure;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Event status, team statuses, and all related records unchanged.';
END CATCH;

GO

-- ══════════════════════════════════════════════════════════
--  FAILURE PATH — attempt to close an already-closed event
-- ══════════════════════════════════════════════════════════
PRINT '';
PRINT '=== TRANSACTION 4 (FAILURE PATH): Close already-completed event ===';

DECLARE @closed_event_id    INT  = 2;   -- Quetta Earthquake 2025 — status='Completed' in seed
DECLARE @closed_by2         INT  = 2;
DECLARE @status_check2      VARCHAR(20);
DECLARE @name_check2        VARCHAR(255);

BEGIN TRY
    BEGIN TRANSACTION T4_Fail;

    SELECT @status_check2 = status,
           @name_check2   = event_name
    FROM   Disaster_Event WITH (UPDLOCK)
    WHERE  event_id = @closed_event_id;

    IF @status_check2 IS NULL
        RAISERROR('ERROR: Event not found.', 16, 1);

    IF @status_check2 IN ('Completed', 'Inactive')
        RAISERROR('ERROR: Event "%s" is already closed (status: %s). Cannot close again.',
                  16, 1, @name_check2, @status_check2);

    -- Would not reach here
    UPDATE Disaster_Event SET status='Completed' WHERE event_id = @closed_event_id;

    COMMIT TRANSACTION T4_Fail;
    PRINT '>>> COMMIT';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T4_Fail;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Double-closure rejected. No records changed.';
END CATCH;

GO

-- ══════════════════════════════════════════════════════════
--  FAILURE PATH — invalid event_id
-- ══════════════════════════════════════════════════════════
PRINT '';
PRINT '=== TRANSACTION 4 (FAILURE PATH): Non-existent event_id ===';

DECLARE @bad_event_id       INT  = 9999;
DECLARE @closed_by3         INT  = 2;
DECLARE @status_check3      VARCHAR(20);
DECLARE @name_check3        VARCHAR(255);

BEGIN TRY
    BEGIN TRANSACTION T4_Fail2;

    SELECT @status_check3 = status,
           @name_check3   = event_name
    FROM   Disaster_Event WITH (UPDLOCK)
    WHERE  event_id = @bad_event_id;

    IF @status_check3 IS NULL
        RAISERROR('ERROR: Disaster event %d not found. Rolling back.', 16, 1, @bad_event_id);

    UPDATE Disaster_Event SET status='Completed' WHERE event_id = @bad_event_id;

    COMMIT TRANSACTION T4_Fail2;
    PRINT '>>> COMMIT';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T4_Fail2;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Non-existent event rejected cleanly.';
END CATCH;
