-- ============================================================
--  Migration: Approval_Request references for allocations,
--  procurements, and rescue deployments.
--  Run this only on an existing database created before the
--  approval-reference redesign. Fresh databases use ddl.sql.
-- ============================================================

IF COL_LENGTH('Procurement', 'disaster_event_id') IS NULL
BEGIN
    ALTER TABLE Procurement ADD disaster_event_id INT NULL;
    ALTER TABLE Procurement
      ADD CONSTRAINT FK_Procurement_Event FOREIGN KEY (disaster_event_id)
      REFERENCES Disaster_Event(event_id);
END
GO

UPDATE P
SET disaster_event_id = FT.disaster_event_id
FROM Procurement P
INNER JOIN Financial_Transaction FT
  ON FT.transaction_type = 'Procurement'
 AND FT.reference_id = P.procurement_id
WHERE P.disaster_event_id IS NULL;
GO

IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_ApprReq_Allocation'
      AND parent_object_id = OBJECT_ID('Approval_Request')
)
BEGIN
    ALTER TABLE Approval_Request DROP CONSTRAINT FK_ApprReq_Allocation;
END
GO

IF COL_LENGTH('Approval_Request', 'allocation_id') IS NOT NULL
BEGIN
    ALTER TABLE Approval_Request ALTER COLUMN allocation_id INT NULL;
END
GO

IF COL_LENGTH('Approval_Request', 'procurement_id') IS NULL
    ALTER TABLE Approval_Request ADD procurement_id INT NULL;
GO

IF COL_LENGTH('Approval_Request', 'assignment_id') IS NULL
    ALTER TABLE Approval_Request ADD assignment_id INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ApprReq_Allocation')
    ALTER TABLE Approval_Request
      ADD CONSTRAINT FK_ApprReq_Allocation FOREIGN KEY (allocation_id)
      REFERENCES Resource_Allocation(allocation_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ApprReq_Procurement')
    ALTER TABLE Approval_Request
      ADD CONSTRAINT FK_ApprReq_Procurement FOREIGN KEY (procurement_id)
      REFERENCES Procurement(procurement_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ApprReq_Assignment')
    ALTER TABLE Approval_Request
      ADD CONSTRAINT FK_ApprReq_Assignment FOREIGN KEY (assignment_id)
      REFERENCES Team_Assignment(assignment_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_ApprReq_OneTarget')
BEGIN
    ALTER TABLE Approval_Request
      ADD CONSTRAINT CHK_ApprReq_OneTarget CHECK (
        (CASE WHEN allocation_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN procurement_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN assignment_id IS NOT NULL THEN 1 ELSE 0 END) = 1
      );
END
GO

PRINT 'Approval reference migration complete.';
