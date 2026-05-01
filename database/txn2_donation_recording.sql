
--  TRANSACTION 2 — Donation Recording
--  Steps (from Design Rationale §17.3):
--    1. INSERT into Donation
--    2. INSERT into Financial_Transaction (type='Donation')
--    3. INSERT into Audit_Log


DECLARE @citizen_id         INT            = 1;        -- Hamza Malik
DECLARE @disaster_event_id  INT            = 1;        -- Indus Flood 2025
DECLARE @donor_name         VARCHAR(255)   = 'Hamza Malik';
DECLARE @donor_type         VARCHAR(50)    = 'Individual';
DECLARE @amount             DECIMAL(15,2)  = 30000.00;
DECLARE @payment_method     VARCHAR(100)   = 'Bank Transfer';
DECLARE @txn_ref            VARCHAR(255)   = 'TRF-2025-0099';
DECLARE @recorded_by        INT            = 5;        -- fin_ahmed

-- ── Internal
DECLARE @new_donation_id    INT;

PRINT '=== TRANSACTION 2: Donation Recording ===';
PRINT 'Donor: ' + @donor_name + ' | Amount: PKR ' + CAST(@amount AS VARCHAR);


--  HAPPY PATH — valid donation with matching transaction row

BEGIN TRY
    BEGIN TRANSACTION T2_DonationRecording;

    -- Step 1: Insert the donation record
    INSERT INTO Donation
        (citizen_id, disaster_event_id, donor_name, donor_type,
         amount, donation_date, payment_method, transaction_reference)
    VALUES
        (@citizen_id, @disaster_event_id, @donor_name, @donor_type,
         @amount, GETDATE(), @payment_method, @txn_ref);

    SET @new_donation_id = SCOPE_IDENTITY();
    PRINT 'Donation inserted — donation_id: ' + CAST(@new_donation_id AS VARCHAR);

    IF @new_donation_id IS NULL
        RAISERROR('ERROR: Donation insert failed silently. Rolling back.', 16, 1);

    -- Step 2: Create the matching financial ledger entry (atomically paired)
    INSERT INTO Financial_Transaction
        (transaction_type, reference_id, disaster_event_id, amount,
         transaction_date, recorded_by, notes)
    VALUES
        ('Donation', @new_donation_id, @disaster_event_id, @amount,
         GETDATE(), @recorded_by,
         'Donation from ' + @donor_name + ' | Ref: ' + @txn_ref);

    PRINT 'Financial_Transaction (Donation) inserted — linked to donation_id: ' + CAST(@new_donation_id AS VARCHAR);

    -- Step 3: Audit log
    INSERT INTO Audit_Log
        (user_id, action, table_name, record_id, old_value, new_value, ip_address)
    VALUES
        (@recorded_by, 'INSERT', 'Donation', @new_donation_id,
         NULL,
         '{"amount":' + CAST(@amount AS VARCHAR) + ',"donor":"' + @donor_name + '"}',
         '192.168.1.30');

    COMMIT TRANSACTION T2_DonationRecording;
    PRINT '>>> COMMIT — Donation recorded and ledger updated successfully.';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T2_DonationRecording;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Neither Donation nor Financial_Transaction rows were written.';
END CATCH;

GO

--  FAILURE PATH — duplicate transaction reference (UNIQUE violation)
PRINT '';
PRINT '=== TRANSACTION 2 (FAILURE PATH): Duplicate transaction reference ===';

DECLARE @citizen_id2        INT            = 1;
DECLARE @event_id2          INT            = 1;
DECLARE @donor_name2        VARCHAR(255)   = 'Hamza Malik';
DECLARE @donor_type2        VARCHAR(50)    = 'Individual';
DECLARE @amount2            DECIMAL(15,2)  = 30000.00;
DECLARE @payment_method2    VARCHAR(100)   = 'Bank Transfer';
DECLARE @txn_ref2           VARCHAR(255)   = 'TRF-2025-0001';  -- already exists in DML seed data
DECLARE @recorded_by2       INT            = 5;
DECLARE @new_donation_id2   INT;

BEGIN TRY
    BEGIN TRANSACTION T2_Fail;

    -- This INSERT will violate the UNIQUE constraint on transaction_reference
    INSERT INTO Donation
        (citizen_id, disaster_event_id, donor_name, donor_type,
         amount, donation_date, payment_method, transaction_reference)
    VALUES
        (@citizen_id2, @event_id2, @donor_name2, @donor_type2,
         @amount2, GETDATE(), @payment_method2, @txn_ref2);

    SET @new_donation_id2 = SCOPE_IDENTITY();

    INSERT INTO Financial_Transaction
        (transaction_type, reference_id, disaster_event_id, amount,
         transaction_date, recorded_by, notes)
    VALUES
        ('Donation', @new_donation_id2, @event_id2, @amount2,
         GETDATE(), @recorded_by2, 'Should never reach here');

    COMMIT TRANSACTION T2_Fail;
    PRINT '>>> COMMIT';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T2_Fail;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Duplicate reference rejected. No partial records written.';
END CATCH;

GO

--  FAILURE PATH — negative amount 
PRINT '';
PRINT '=== TRANSACTION 2 (FAILURE PATH): Invalid donation amount ===';

DECLARE @citizen_id3       INT            = 2;
DECLARE @event_id3         INT            = 1;
DECLARE @donor_name3       VARCHAR(255)   = 'Test Donor';
DECLARE @donor_type3       VARCHAR(50)    = 'Individual';
DECLARE @bad_amount        DECIMAL(15,2)  = -500.00;    -- violates CHECK (amount > 0)
DECLARE @payment_method3   VARCHAR(100)   = 'Cash';
DECLARE @txn_ref3          VARCHAR(255)   = 'CASH-9999';
DECLARE @recorded_by3      INT            = 5;

BEGIN TRY
    BEGIN TRANSACTION T2_Fail2;

    INSERT INTO Donation
        (citizen_id, disaster_event_id, donor_name, donor_type,
         amount, donation_date, payment_method, transaction_reference)
    VALUES
        (@citizen_id3, @event_id3, @donor_name3, @donor_type3,
         @bad_amount, GETDATE(), @payment_method3, @txn_ref3);

    COMMIT TRANSACTION T2_Fail2;
    PRINT '>>> COMMIT';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION T2_Fail2;

    PRINT '>>> ROLLBACK — ' + ERROR_MESSAGE();
    PRINT 'Negative amount rejected by CHECK constraint. Database unchanged.';
END CATCH;
