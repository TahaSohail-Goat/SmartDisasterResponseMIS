
--  Smart Disaster Response MIS

IF OBJECT_ID('Audit_Log',            'U') IS NOT NULL DROP TABLE Audit_Log;
IF OBJECT_ID('Approval_Request',     'U') IS NOT NULL DROP TABLE Approval_Request;
IF OBJECT_ID('Financial_Transaction','U') IS NOT NULL DROP TABLE Financial_Transaction;
IF OBJECT_ID('Expense',              'U') IS NOT NULL DROP TABLE Expense;
IF OBJECT_ID('Donation',             'U') IS NOT NULL DROP TABLE Donation;
IF OBJECT_ID('Procurement',          'U') IS NOT NULL DROP TABLE Procurement;
IF OBJECT_ID('Patient',              'U') IS NOT NULL DROP TABLE Patient;
IF OBJECT_ID('Hospital',             'U') IS NOT NULL DROP TABLE Hospital;
IF OBJECT_ID('Resource_Allocation',  'U') IS NOT NULL DROP TABLE Resource_Allocation;
IF OBJECT_ID('Warehouse_Inventory',  'U') IS NOT NULL DROP TABLE Warehouse_Inventory;
IF OBJECT_ID('Warehouse',            'U') IS NOT NULL DROP TABLE Warehouse;
IF OBJECT_ID('Resource',             'U') IS NOT NULL DROP TABLE Resource;
IF OBJECT_ID('Team_Assignment',      'U') IS NOT NULL DROP TABLE Team_Assignment;
IF OBJECT_ID('Emergency_Report',     'U') IS NOT NULL DROP TABLE Emergency_Report;
IF OBJECT_ID('Disaster_Event',       'U') IS NOT NULL DROP TABLE Disaster_Event;
IF OBJECT_ID('Citizen',              'U') IS NOT NULL DROP TABLE Citizen;
IF OBJECT_ID('Rescue_Team',          'U') IS NOT NULL DROP TABLE Rescue_Team;
IF OBJECT_ID('User_Role',            'U') IS NOT NULL DROP TABLE User_Role;
IF OBJECT_ID('[User]',               'U') IS NOT NULL DROP TABLE [User];
IF OBJECT_ID('Role',                 'U') IS NOT NULL DROP TABLE Role;

GO


CREATE TABLE Role (
    role_id     INT           IDENTITY(1,1) PRIMARY KEY,
    role_name   VARCHAR(255)  NOT NULL,
    description TEXT          NOT NULL,
    created_at  DATETIME      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE [User] (
    user_id         INT           IDENTITY(1,1) PRIMARY KEY,
    username        VARCHAR(255)  NOT NULL,
    password_hash   TEXT          NOT NULL,
    email           VARCHAR(255)  NOT NULL UNIQUE,
    phone           VARCHAR(20)   NOT NULL,
    is_active       BIT           NOT NULL DEFAULT 1,
    created_at      DATETIME      NOT NULL DEFAULT GETDATE(),
    role_id         INT           NOT NULL,
    CONSTRAINT FK_User_Role FOREIGN KEY (role_id) REFERENCES Role(role_id)
);

-- Junction table for M:N User–Role (a user can hold multiple roles)
CREATE TABLE User_Role (
    user_id     INT       NOT NULL,
    role_id     INT       NOT NULL,
    assigned_at DATETIME  NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_User_Role PRIMARY KEY (user_id, role_id),
    CONSTRAINT FK_UserRole_User FOREIGN KEY (user_id) REFERENCES [User](user_id),
    CONSTRAINT FK_UserRole_Role FOREIGN KEY (role_id) REFERENCES Role(role_id)
);


--  16.2  CITIZEN & DISASTER MANAGEMENT
CREATE TABLE Citizen (
    citizen_id    INT           IDENTITY(1,1) PRIMARY KEY,
    user_id       INT           NOT NULL,
    full_name     VARCHAR(255)  NOT NULL,
    cnic          VARCHAR(15)   NOT NULL UNIQUE,
    address       VARCHAR(255)  NOT NULL,
    date_of_birth DATE          NOT NULL,
    gender        VARCHAR(10)   NOT NULL CHECK (gender IN ('Male','Female','Other')),
    CONSTRAINT FK_Citizen_User FOREIGN KEY (user_id) REFERENCES [User](user_id)
);

CREATE TABLE Disaster_Event (
    event_id       INT           IDENTITY(1,1) PRIMARY KEY,
    event_name     VARCHAR(255)  NOT NULL,
    disaster_type  VARCHAR(100)  NOT NULL,
    location       VARCHAR(255)  NOT NULL,
    severity_level VARCHAR(20)   NOT NULL CHECK (severity_level IN ('Low','Medium','High','Critical')),
    start_date     DATETIME      NOT NULL DEFAULT GETDATE(),
    end_date       DATETIME      NULL,              -- NULL while event is ongoing
    status         VARCHAR(20)   NOT NULL CHECK (status IN ('Active','Inactive','Pending','Completed')),
    description    TEXT          NOT NULL
);

CREATE TABLE Emergency_Report (
    report_id         INT           IDENTITY(1,1) PRIMARY KEY,
    citizen_id        INT           NOT NULL,
    disaster_event_id INT           NOT NULL,
    location          VARCHAR(255)  NOT NULL,
    latitude          DECIMAL(9,6)  NOT NULL,
    longitude         DECIMAL(9,6)  NOT NULL,
    disaster_type     VARCHAR(100)  NOT NULL,
    severity_level    VARCHAR(20)   NOT NULL CHECK (severity_level IN ('Low','Medium','High','Critical')),
    report_time       DATETIME      NOT NULL DEFAULT GETDATE(),
    status            VARCHAR(20)   NOT NULL CHECK (status IN ('Active','Inactive','Pending','Completed')),
    description       TEXT          NOT NULL,
    CONSTRAINT FK_EmReport_Citizen      FOREIGN KEY (citizen_id)        REFERENCES Citizen(citizen_id),
    CONSTRAINT FK_EmReport_Disaster     FOREIGN KEY (disaster_event_id) REFERENCES Disaster_Event(event_id)
);
--  16.3  RESCUE OPERATIONS

CREATE TABLE Rescue_Team (
    team_id             INT           IDENTITY(1,1) PRIMARY KEY,
    team_name           VARCHAR(255)  NOT NULL,
    team_type           VARCHAR(100)  NOT NULL,   
    current_location    VARCHAR(255)  NOT NULL,
    availability_status VARCHAR(50)   NOT NULL CHECK (availability_status IN ('Available','Assigned','Busy','Completed')),
    team_size           INT           NOT NULL CHECK (team_size > 0),
    contact_number      VARCHAR(20)   NOT NULL
  
);

CREATE TABLE Team_Assignment (
    assignment_id   INT          IDENTITY(1,1) PRIMARY KEY,
    rescue_team_id  INT          NOT NULL,
    report_id       INT          NOT NULL,
    assigned_at     DATETIME     NOT NULL DEFAULT GETDATE(),
    completed_at    DATETIME     NULL,
    status          VARCHAR(20)  NOT NULL CHECK (status IN ('Active','Inactive','Pending','Completed')),
    notes           TEXT         NULL,
    CONSTRAINT FK_TeamAssign_Team   FOREIGN KEY (rescue_team_id) REFERENCES Rescue_Team(team_id),
    CONSTRAINT FK_TeamAssign_Report FOREIGN KEY (report_id)      REFERENCES Emergency_Report(report_id)
);

--  16.4  RESOURCE MANAGEMENT

CREATE TABLE Resource (
    resource_id     INT           IDENTITY(1,1) PRIMARY KEY,
    resource_name   VARCHAR(255)  NOT NULL,
    resource_type   VARCHAR(100)  NOT NULL,   
    unit_of_measure VARCHAR(50)   NOT NULL,
    description     TEXT          NOT NULL
);

CREATE TABLE Warehouse (
    warehouse_id    INT           IDENTITY(1,1) PRIMARY KEY,
    warehouse_name  VARCHAR(255)  NOT NULL,
    location        VARCHAR(255)  NOT NULL,
    capacity        INT           NOT NULL CHECK (capacity > 0),
    contact_number  VARCHAR(20)   NOT NULL,
    manager_id      INT           NOT NULL,
    CONSTRAINT FK_Warehouse_Manager FOREIGN KEY (manager_id) REFERENCES [User](user_id)
);

CREATE TABLE Warehouse_Inventory (
    inventory_id     INT          IDENTITY(1,1) PRIMARY KEY,
    warehouse_id     INT          NOT NULL,
    resource_id      INT          NOT NULL,
    quantity         INT          NOT NULL CHECK (quantity >= 0),
    threshold_level  INT          NOT NULL CHECK (threshold_level >= 0),
    last_updated     DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Inventory_Warehouse FOREIGN KEY (warehouse_id) REFERENCES Warehouse(warehouse_id),
    CONSTRAINT FK_Inventory_Resource  FOREIGN KEY (resource_id)  REFERENCES Resource(resource_id),
    CONSTRAINT UQ_Inventory_Slot UNIQUE (warehouse_id, resource_id)   -- one row per resource per warehouse
);

CREATE TABLE Resource_Allocation (
    allocation_id      INT          IDENTITY(1,1) PRIMARY KEY,
    inventory_id       INT          NOT NULL,
    report_id          INT          NOT NULL,
    requested_by       INT          NOT NULL,     
    allocated_quantity INT          NOT NULL CHECK (allocated_quantity >= 0),
    dispatched_quantity INT         NOT NULL DEFAULT 0,
    consumed_quantity   INT         NOT NULL DEFAULT 0,
    allocation_date    DATETIME     NOT NULL DEFAULT GETDATE(),
    status             VARCHAR(20)  NOT NULL CHECK (status IN ('Active','Inactive','Pending','Completed')),
    CONSTRAINT FK_Alloc_Inventory  FOREIGN KEY (inventory_id)  REFERENCES Warehouse_Inventory(inventory_id),
    CONSTRAINT FK_Alloc_Report     FOREIGN KEY (report_id)     REFERENCES Emergency_Report(report_id),
    CONSTRAINT FK_Alloc_User       FOREIGN KEY (requested_by)  REFERENCES [User](user_id)
);

--  16.5  MEDICAL MANAGEMENT

CREATE TABLE Hospital (
    hospital_id     INT           IDENTITY(1,1) PRIMARY KEY,
    hospital_name   VARCHAR(255)  NOT NULL,
    location        VARCHAR(255)  NOT NULL,
    contact_number  VARCHAR(20)   NOT NULL,
    total_beds      INT           NOT NULL CHECK (total_beds > 0),
    available_beds  INT           NOT NULL CHECK (available_beds >= 0),
    specialization  VARCHAR(255)  NOT NULL,
    CONSTRAINT CHK_Hospital_Beds CHECK (available_beds <= total_beds)
);

CREATE TABLE Patient (
    patient_id      INT           IDENTITY(1,1) PRIMARY KEY,
    report_id       INT           NOT NULL,
    hospital_id     INT           NOT NULL,
    full_name       VARCHAR(255)  NOT NULL,
    age             INT           NOT NULL CHECK (age > 0),
    gender          VARCHAR(10)   NOT NULL CHECK (gender IN ('Male','Female','Other')),
    admission_time  DATETIME      NOT NULL DEFAULT GETDATE(),
    discharge_time  DATETIME      NULL,
    status          VARCHAR(20)   NOT NULL CHECK (status IN ('Active','Admitted','Discharged','Critical','Deceased')),
    medical_notes   TEXT          NULL,
    CONSTRAINT FK_Patient_Report   FOREIGN KEY (report_id)   REFERENCES Emergency_Report(report_id),
    CONSTRAINT FK_Patient_Hospital FOREIGN KEY (hospital_id) REFERENCES Hospital(hospital_id)
);

--  16.6  FINANCIAL MANAGEMENT

CREATE TABLE Donation (
    donation_id           INT            IDENTITY(1,1) PRIMARY KEY,
    citizen_id            INT            NOT NULL,
    disaster_event_id     INT            NOT NULL,
    donor_name            VARCHAR(255)   NOT NULL,
    donor_type            VARCHAR(50)    NOT NULL,  
    amount                DECIMAL(15,2)  NOT NULL CHECK (amount > 0),
    donation_date         DATETIME       NOT NULL DEFAULT GETDATE(),
    payment_method        VARCHAR(100)   NOT NULL,
    transaction_reference VARCHAR(255)   NOT NULL UNIQUE, 
    CONSTRAINT FK_Donation_Citizen  FOREIGN KEY (citizen_id)        REFERENCES Citizen(citizen_id),
    CONSTRAINT FK_Donation_Event    FOREIGN KEY (disaster_event_id) REFERENCES Disaster_Event(event_id)
);

CREATE TABLE Expense (
    expense_id        INT            IDENTITY(1,1) PRIMARY KEY,
    disaster_event_id INT            NOT NULL,
    category          VARCHAR(100)   NOT NULL,
    amount            DECIMAL(15,2)  NOT NULL CHECK (amount > 0),
    description       TEXT           NOT NULL,
    expense_date      DATETIME       NOT NULL DEFAULT GETDATE(),
    recorded_by       INT            NOT NULL,
    approval_status   VARCHAR(20)    NOT NULL CHECK (approval_status IN ('Pending','Approved','Rejected')),
    CONSTRAINT FK_Expense_Event FOREIGN KEY (disaster_event_id) REFERENCES Disaster_Event(event_id),
    CONSTRAINT FK_Expense_User  FOREIGN KEY (recorded_by)       REFERENCES [User](user_id)
);

CREATE TABLE Procurement (
    procurement_id   INT            IDENTITY(1,1) PRIMARY KEY,
    resource_id      INT            NOT NULL,
    warehouse_id     INT            NOT NULL,
    disaster_event_id INT           NULL,
    quantity         INT            NOT NULL CHECK (quantity > 0),
    unit_cost        DECIMAL(15,2)  NOT NULL CHECK (unit_cost > 0),
    procurement_date DATETIME       NOT NULL DEFAULT GETDATE(),
    supplier_name    VARCHAR(255)   NOT NULL,
    approved_by      INT            NOT NULL,
    status           VARCHAR(20)    NOT NULL CHECK (status IN ('Active','Inactive','Pending','Completed')),
    CONSTRAINT FK_Procurement_Resource  FOREIGN KEY (resource_id)  REFERENCES Resource(resource_id),
    CONSTRAINT FK_Procurement_Warehouse FOREIGN KEY (warehouse_id) REFERENCES Warehouse(warehouse_id),
    CONSTRAINT FK_Procurement_Event     FOREIGN KEY (disaster_event_id) REFERENCES Disaster_Event(event_id),
    CONSTRAINT FK_Procurement_Approver  FOREIGN KEY (approved_by)  REFERENCES [User](user_id)
);

CREATE TABLE Financial_Transaction (
    transaction_id   INT            IDENTITY(1,1) PRIMARY KEY,
    transaction_type VARCHAR(50)    NOT NULL CHECK (transaction_type IN ('Donation','Expense','Procurement')),
    reference_id     INT            NOT NULL,     
    disaster_event_id INT           NOT NULL,
    amount           DECIMAL(15,2)  NOT NULL CHECK (amount > 0),
    transaction_date DATETIME       NOT NULL DEFAULT GETDATE(),
    recorded_by      INT            NOT NULL,
    notes            TEXT           NULL,
    CONSTRAINT FK_FinTxn_Event FOREIGN KEY (disaster_event_id) REFERENCES Disaster_Event(event_id),
    CONSTRAINT FK_FinTxn_User  FOREIGN KEY (recorded_by)       REFERENCES [User](user_id)
);

--  16.7  WORKFLOW & AUDIT


CREATE TABLE Approval_Request (
    request_id    INT           IDENTITY(1,1) PRIMARY KEY,
    request_type  VARCHAR(100)  NOT NULL,
    requested_by  INT           NOT NULL,
    approved_by   INT           NULL,              
    allocation_id INT           NULL,
    procurement_id INT          NULL,
    assignment_id INT           NULL,
    status        VARCHAR(20)   NOT NULL CHECK (status IN ('Pending','Approved','Rejected')),
    request_date  DATETIME      NOT NULL DEFAULT GETDATE(),
    resolved_date DATETIME      NULL,
    remarks       TEXT          NULL,
    CONSTRAINT FK_ApprReq_Requester  FOREIGN KEY (requested_by)  REFERENCES [User](user_id),
    CONSTRAINT FK_ApprReq_Approver   FOREIGN KEY (approved_by)   REFERENCES [User](user_id),
    CONSTRAINT FK_ApprReq_Allocation FOREIGN KEY (allocation_id) REFERENCES Resource_Allocation(allocation_id),
    CONSTRAINT FK_ApprReq_Procurement FOREIGN KEY (procurement_id) REFERENCES Procurement(procurement_id),
    CONSTRAINT FK_ApprReq_Assignment FOREIGN KEY (assignment_id) REFERENCES Team_Assignment(assignment_id),
    CONSTRAINT CHK_ApprReq_OneTarget CHECK (
        (CASE WHEN allocation_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN procurement_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN assignment_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

CREATE TABLE Audit_Log (
    log_id     INT           IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NOT NULL,
    action     VARCHAR(50)   NOT NULL,       
    table_name VARCHAR(100)  NOT NULL,
    record_id  INT           NOT NULL,
    old_value  NVARCHAR(MAX) NULL,        
    new_value  NVARCHAR(MAX) NULL,          
    ip_address VARCHAR(50)   NULL,
    [timestamp] DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_AuditLog_User FOREIGN KEY (user_id) REFERENCES [User](user_id)
);

GO

--  Indexes (non-clustered, for Step 8 performance analysis)
--  See indexing report for WITH/WITHOUT benchmarks.

-- Emergency_Report
CREATE INDEX IX_EmReport_Severity   ON Emergency_Report (severity_level);
CREATE INDEX IX_EmReport_EventId    ON Emergency_Report (disaster_event_id);
CREATE INDEX IX_EmReport_ReportTime ON Emergency_Report (report_time);

-- Disaster_Event
CREATE INDEX IX_Event_Type          ON Disaster_Event (disaster_type);
CREATE INDEX IX_Event_Status        ON Disaster_Event (status);

-- Warehouse_Inventory
CREATE INDEX IX_Inventory_Resource  ON Warehouse_Inventory (resource_id);
CREATE INDEX IX_Inventory_Warehouse ON Warehouse_Inventory (warehouse_id);

-- Financial_Transaction
CREATE INDEX IX_FinTxn_Date         ON Financial_Transaction (transaction_date);
CREATE INDEX IX_FinTxn_Type         ON Financial_Transaction (transaction_type);

-- Composite: common dashboard query (event + severity)
CREATE INDEX IX_EmReport_Event_Sev  ON Emergency_Report (disaster_event_id, severity_level);

GO

