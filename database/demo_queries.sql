-- =================================================================================
-- SMART DISASTER RESPONSE MIS - DEMO VERIFICATION QUERIES
-- =================================================================================
-- Use these queries in SQL Server Management Studio (SSMS) during your demo 
-- to prove that frontend actions are correctly updating the database.
-- =================================================================================

USE ProjectDB;
GO

-- ---------------------------------------------------------------------------------
-- STEP 1: Emergency Reporting Verification
-- Run this after submitting a report from the frontend (Citizen Role).
-- ---------------------------------------------------------------------------------
PRINT '--- STEP 1: Latest Emergency Report ---';
SELECT TOP 1 
    report_id, 
    location, 
    disaster_type, 
    severity_level, 
    status, 
    report_time 
FROM Emergency_Report 
ORDER BY report_time DESC;
GO


-- ---------------------------------------------------------------------------------
-- STEP 2: Team Assignment & Trigger Verification
-- Run this after assigning a team to the report (Coordinator Role).
-- ---------------------------------------------------------------------------------
PRINT '--- STEP 2A: Latest Team Assignment ---';
-- Show the assignment was created
SELECT TOP 1 
    assignment_id, 
    rescue_team_id, 
    report_id, 
    status,
    assigned_at
FROM Team_Assignment 
ORDER BY assigned_at DESC;

PRINT '--- STEP 2B: Trigger TRG-01 Verification ---';
-- Prove the TRIGGER automatically set the assigned team to 'Busy'
SELECT 
    team_id,
    team_name, 
    availability_status 
FROM Rescue_Team 
WHERE team_id = (SELECT TOP 1 rescue_team_id FROM Team_Assignment ORDER BY assigned_at DESC);
GO


-- ---------------------------------------------------------------------------------
-- STEP 3: Approval Workflow - Pending State
-- Run this after requesting resources (Rescue Operator Role).
-- ---------------------------------------------------------------------------------
PRINT '--- STEP 3: Pending Approval Requests ---';
-- Show that the request is parked in the 'Pending' state for Approval
SELECT 
    request_id, 
    request_type, 
    status, 
    request_date 
FROM Approval_Request 
WHERE request_type = 'Resource_Allocation' AND status = 'Pending';
GO


-- ---------------------------------------------------------------------------------
-- STEP 4: Approval Execution & ACID Transactions
-- Run this after approving the resource dispatch (Warehouse Manager Role).
-- ---------------------------------------------------------------------------------
PRINT '--- STEP 4A: Approved Status ---';
-- Show approval status updated
SELECT TOP 1
    request_id, 
    status, 
    approved_by, 
    resolved_date 
FROM Approval_Request 
WHERE request_type = 'Resource_Allocation'
ORDER BY resolved_date DESC;

PRINT '--- STEP 4B: Inventory Deduction (Transaction Proof) ---';
-- Show the warehouse inventory was successfully deducted
SELECT 
    warehouse_id, 
    resource_id, 
    quantity, 
    last_updated 
FROM Warehouse_Inventory 
WHERE inventory_id = (
    SELECT TOP 1 inventory_id 
    FROM Resource_Allocation 
    ORDER BY allocation_id DESC
);
GO


-- ---------------------------------------------------------------------------------
-- STEP 5: Auto-Admit Hospital Algorithm
-- Run this after clicking "Auto-Assign Best Hospital" (Coordinator Role).
-- ---------------------------------------------------------------------------------
PRINT '--- STEP 5A: Patient Admission ---';
-- Prove the patient was inserted
SELECT TOP 1 
    patient_id, 
    hospital_id, 
    full_name, 
    status,
    admission_time
FROM Patient 
ORDER BY admission_time DESC;

PRINT '--- STEP 5B: Hospital Bed Reduction ---';
-- Check the Hospital beds (Compare total_beds vs available_beds)
SELECT 
    hospital_id,
    hospital_name, 
    total_beds, 
    available_beds 
FROM Hospital 
WHERE hospital_id = (SELECT TOP 1 hospital_id FROM Patient ORDER BY admission_time DESC);
GO


-- ---------------------------------------------------------------------------------
-- STEP 6: Enterprise Audit Logging
-- Run this to show that the system tracked all of the above actions (Admin Role).
-- ---------------------------------------------------------------------------------
PRINT '--- STEP 6: Audit Trail Log ---';
-- View the raw Audit Trail capturing Old/New JSON values
SELECT TOP 10 
    log_id, 
    user_id,
    action, 
    table_name, 
    old_value, 
    new_value, 
    [timestamp] 
FROM Audit_Log 
ORDER BY [timestamp] DESC;
GO
