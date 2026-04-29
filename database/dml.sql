-- ============================================================
--  Smart Disaster Response MIS
--  DML  — Data Manipulation Language (Sample Data)
--  Target: SQL Server (T-SQL)
--  Run AFTER ddl.sql — tables must already exist.
--  5-10 rows per table; enough for triggers/views/queries.
-- ============================================================

-- ============================================================
--  ROLES  (5 rows — matches RBAC section of design rationale)
-- ============================================================
INSERT INTO Role (role_name, description) VALUES
('System_Admin',         'Full DDL and DML privileges; manages users and audit logs'),
('Disaster_Coordinator', 'Manages disaster events and emergency reports'),
('Rescue_Operator',      'Assigns and tracks rescue teams in the field'),
('Warehouse_Manager',    'Controls inventory, procurement, and stock levels'),
('Finance_Officer',      'Records donations, expenses, and financial transactions'),
('Citizen',             'Registered citizen who can submit emergency reports and donations');

-- ============================================================
--  USERS  (10 rows — one per functional persona + extras)
-- ============================================================
-- Passwords are bcrypt hashes of 'Pass@1234' (placeholder)
INSERT INTO [User] (username, password_hash, email, phone, is_active, role_id) VALUES
('admin_ali',      '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'ali@sdrmis.gov.pk',      '0300-1111111', 1, 1),
('coord_sara',     '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'sara@sdrmis.gov.pk',     '0300-2222222', 1, 2),
('rescue_omar',    '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'omar@sdrmis.gov.pk',     '0300-3333333', 1, 3),
('wh_fatima',      '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'fatima@sdrmis.gov.pk',   '0300-4444444', 1, 4),
('fin_ahmed',      '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'ahmed@sdrmis.gov.pk',    '0300-5555555', 1, 5),
('citizen_hamza',  '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'hamza@gmail.com',         '0311-1234567', 1, 6),
('citizen_aisha',  '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'aisha@gmail.com',         '0311-2345678', 1, 6),
('citizen_bilal',  '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'bilal@yahoo.com',         '0311-3456789', 1, 6),
('citizen_zara',   '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'zara@hotmail.com',         '0311-4567890', 1, 6),
('wh_manager2',    '$2b$12$eW5bB3rOXJkT5mKZmMzQGOqPwVtNfkL4cRAkxhMdMOWJB5k8dH6Ky', 'manager2@sdrmis.gov.pk', '0300-6666666', 1, 4);

-- ============================================================
--  USER_ROLE  (junction — some users hold multiple roles)
-- ============================================================
INSERT INTO User_Role (user_id, role_id) VALUES
(1, 1), (1, 2),        -- admin also acts as coordinator
(2, 2),
(3, 3),
(4, 4),
(5, 5),
(6, 6), (7, 6), (8, 6), (9, 6),  -- citizens get Citizen role
(10, 4);               -- wh_manager2 gets Warehouse_Manager role

-- ============================================================
--  CITIZENS  (7 rows)
-- ============================================================
INSERT INTO Citizen (user_id, full_name, cnic, address, date_of_birth, gender) VALUES
(6,  'Hamza Malik',     '35202-1234567-1', 'House 12, Gulberg, Lahore',           '1990-05-15', 'Male'),
(7,  'Aisha Khan',      '37405-2345678-2', 'Flat 3B, G-9, Islamabad',             '1995-08-22', 'Female'),
(8,  'Bilal Raza',      '34201-3456789-3', 'Village Kot Adu, Muzaffargarh',       '1988-11-10', 'Male'),
(9,  'Zara Hussain',    '36302-4567890-4', 'Street 7, Saddar, Rawalpindi',        '1992-03-30', 'Female'),
(2,  'Sara Noor',       '61101-5678901-5', 'Block D, DHA Phase 2, Karachi',       '1985-07-04', 'Female'),
(3,  'Omar Farooq',     '42201-6789012-6', 'Model Town, Gujranwala',              '1987-12-19', 'Male'),
(5,  'Ahmed Siddiqui',  '42301-7890123-7', 'North Nazimabad, Karachi',            '1991-09-08', 'Male');

-- ============================================================
--  DISASTER EVENTS  (6 rows)
-- ============================================================
INSERT INTO Disaster_Event (event_name, disaster_type, location, severity_level, start_date, end_date, status, description) VALUES
('Indus Flood 2025',       'Flood',      'Sindh, Pakistan',       'Critical', '2025-08-01', NULL,         'Active',    'Massive monsoon flooding across lower Sindh affecting 2M people'),
('Quetta Earthquake 2025', 'Earthquake', 'Quetta, Balochistan',   'High',     '2025-09-14', '2025-09-28', 'Completed', '6.2 magnitude earthquake causing widespread structural damage'),
('Lahore Urban Fire',      'Fire',       'Lahore, Punjab',        'Medium',   '2025-10-05', '2025-10-06', 'Completed', 'Industrial area fire spreading to residential zones'),
('KPK Flash Floods',       'Flood',      'Swat, KPK',             'High',     '2025-07-20', '2025-08-10', 'Completed', 'Flash floods triggered by heavy rainfall in mountain valleys'),
('Karachi Heatwave',       'Heatwave',   'Karachi, Sindh',        'Medium',   '2025-06-01', '2025-06-15', 'Completed', 'Extreme heat event with temperatures exceeding 48°C'),
('Islamabad Landslide',    'Landslide',  'Murree, Punjab',        'Low',      '2025-11-02', NULL,         'Active',    'Roadblocking landslide after heavy rainfall in Murree hills');

-- ============================================================
--  EMERGENCY REPORTS  (10 rows)
-- ============================================================
INSERT INTO Emergency_Report (citizen_id, disaster_event_id, location, latitude, longitude, disaster_type, severity_level, report_time, status, description) VALUES
(1, 1, 'Sukkur Barrage Area',         27.705400,  68.857200, 'Flood',      'Critical', '2025-08-02 07:30:00', 'Active',    'Water level rising rapidly, 500 families trapped'),
(2, 1, 'Larkana District',            27.557900,  68.215600, 'Flood',      'High',     '2025-08-03 09:15:00', 'Active',    'Crop fields submerged, livestock lost'),
(3, 2, 'Quetta City Center',          30.183700,  67.007000, 'Earthquake', 'High',     '2025-09-14 03:45:00', 'Completed', 'Building collapse, 12 people trapped under rubble'),
(4, 2, 'Mastung Road, Quetta',        29.792500,  66.845600, 'Earthquake', 'Medium',   '2025-09-14 05:20:00', 'Completed', 'Road cracks, gas pipeline rupture suspected'),
(1, 3, 'Shahdara, Lahore',            31.612300,  74.315400, 'Fire',       'High',     '2025-10-05 22:10:00', 'Completed', 'Factory fire spreading to adjacent warehouses'),
(2, 3, 'Badami Bagh, Lahore',         31.578900,  74.307600, 'Fire',       'Medium',   '2025-10-05 23:00:00', 'Completed', 'Residential fire, 30 families evacuated'),
(5, 4, 'Bahrain, Swat',               35.198900,  72.556300, 'Flood',      'Critical', '2025-07-21 14:30:00', 'Completed', 'Flash flood sweeping through village, bridges destroyed'),
(6, 5, 'Lyari, Karachi',              24.861400,  66.989100, 'Heatwave',   'High',     '2025-06-03 13:00:00', 'Completed', 'Multiple heatstroke cases, hospital capacity strained'),
(7, 1, 'Jacobabad',                   28.277700,  68.436100, 'Flood',      'Critical', '2025-08-05 08:45:00', 'Active',    'Entire neighbourhood under 4 feet of water'),
(3, 6, 'Murree Hill Road',            33.907800,  73.390400, 'Landslide',  'Low',      '2025-11-03 06:00:00', 'Pending',   'Debris blocking main road, no casualties reported yet');

-- ============================================================
--  RESCUE TEAMS  (8 rows)
-- ============================================================
INSERT INTO Rescue_Team (team_name, team_type, current_location, availability_status, team_size, contact_number) VALUES
('Alpha Medical Unit',     'Medical', 'Sukkur, Sindh',         'Busy',      12, '0333-1010101'),
('Bravo Fire Brigade',     'Fire',    'Lahore Central Station', 'Available', 8,  '0333-2020202'),
('Charlie Rescue Squad',   'Rescue',  'Quetta Base Camp',      'Available', 15, '0333-3030303'),
('Delta Medical Team',     'Medical', 'Islamabad HQ',          'Available', 10, '0333-4040404'),
('Echo Relief Unit',       'Rescue',  'Swat Operations Camp',  'Completed', 20, '0333-5050505'),
('Foxtrot Engineering',    'Rescue',  'Lahore Engineering Depot','Available',7,  '0333-6060606'),
('Golf Medical Corps',     'Medical', 'Karachi General',       'Busy',      14, '0333-7070707'),
('Hotel Flood Response',   'Rescue',  'Jacobabad Camp',        'Busy',      18, '0333-8080808');

-- ============================================================
--  TEAM ASSIGNMENTS  (9 rows)
-- ============================================================
INSERT INTO Team_Assignment (rescue_team_id, report_id, assigned_at, completed_at, status, notes) VALUES
(1, 1,  '2025-08-02 10:00:00', NULL,                  'Active',    'Deployed boats for evacuation, ongoing rescue'),
(1, 9,  '2025-08-05 10:00:00', NULL,                  'Active',    'Secondary deployment to Jacobabad'),
(3, 3,  '2025-09-14 05:00:00', '2025-09-14 18:00:00', 'Completed', 'Extracted 11 survivors, 1 fatality'),
(3, 4,  '2025-09-14 07:00:00', '2025-09-14 15:00:00', 'Completed', 'Secured gas line, road partially cleared'),
(2, 5,  '2025-10-05 22:30:00', '2025-10-06 03:00:00', 'Completed', 'Fire contained, 2 firefighters treated for smoke inhalation'),
(6, 6,  '2025-10-05 23:30:00', '2025-10-06 02:00:00', 'Completed', 'Structural assessment and debris removal'),
(5, 7,  '2025-07-21 16:00:00', '2025-07-25 12:00:00', 'Completed', 'Full village evacuation completed'),
(7, 8,  '2025-06-03 14:00:00', '2025-06-03 20:00:00', 'Completed', 'Medical camp set up, 47 patients treated'),
(8, 9,  '2025-08-05 11:00:00', NULL,                  'Active',    'Boat rescue operation in progress');

-- ============================================================
--  RESOURCES  (8 rows)
-- ============================================================
INSERT INTO Resource (resource_name, resource_type, unit_of_measure, description) VALUES
('Rice (25 kg sacks)',    'Food',     'Sacks',   'Standard 25 kg rice sacks for disaster relief'),
('Drinking Water',        'Water',    'Litres',  'Bottled or tanker drinking water supply'),
('ORS Sachets',           'Medicine', 'Packets', 'Oral Rehydration Salts for dehydration treatment'),
('Tents (8-person)',      'Shelter',  'Units',   'Heavy-duty 8-person relief tents'),
('Paracetamol 500mg',     'Medicine', 'Tablets', 'Basic analgesic and antipyretic medication'),
('Blankets',              'Shelter',  'Units',   'Thermal blankets for cold weather relief'),
('First Aid Kits',        'Medicine', 'Kits',    'Standard first aid kit with bandages, antiseptic'),
('Ready-to-Eat Meals',    'Food',     'Packs',   'Self-contained MRE packs, no heating required');

-- ============================================================
--  WAREHOUSES  (5 rows)
-- ============================================================
INSERT INTO Warehouse (warehouse_name, location, capacity, contact_number, manager_id) VALUES
('Sindh Central Depot',    'Hyderabad, Sindh',     10000, '022-1234567',  4),
('Punjab Relief Store',    'Lahore, Punjab',        8000, '042-2345678',  10),
('KPK Emergency Warehouse','Peshawar, KPK',         6000, '091-3456789',  4),
('Balochistan Depot',      'Quetta, Balochistan',   5000, '081-4567890',  10),
('Federal Reserve Store',  'Islamabad',            15000, '051-5678901',  4);

-- ============================================================
--  WAREHOUSE INVENTORY  (10 rows)
-- ============================================================
INSERT INTO Warehouse_Inventory (warehouse_id, resource_id, quantity, threshold_level) VALUES
(1, 1, 2500, 500),   -- Rice at Sindh depot
(1, 2, 50000, 10000),-- Water at Sindh depot
(1, 3, 8000,  1000), -- ORS at Sindh depot
(1, 4, 300,   50),   -- Tents at Sindh depot
(2, 1, 1800,  400),  -- Rice at Punjab store
(2, 6, 1200,  200),  -- Blankets at Punjab store
(3, 7, 600,   100),  -- First Aid Kits at KPK
(4, 5, 25000, 5000), -- Paracetamol at Balochistan
(5, 8, 5000,  1000), -- MRE packs at Federal store
(5, 4, 500,   100);  -- Tents at Federal store

-- ============================================================
--  RESOURCE ALLOCATIONS  (8 rows)
-- ============================================================
INSERT INTO Resource_Allocation (inventory_id, report_id, requested_by, allocated_quantity, dispatched_quantity, consumed_quantity, allocation_date, status) VALUES
(1,  1, 3, 300,  300, 280,  '2025-08-02 12:00:00', 'Active'),
(2,  1, 3, 10000,10000,9500,'2025-08-02 12:30:00', 'Active'),
(3,  1, 3, 2000, 2000,1800, '2025-08-02 13:00:00', 'Active'),
(4,  9, 3, 50,   50,  45,   '2025-08-05 13:00:00', 'Active'),
(5,  3, 2, 200,  200, 200,  '2025-09-14 06:00:00', 'Completed'),
(6,  7, 3, 150,  150, 120,  '2025-07-21 18:00:00', 'Completed'),
(7,  8, 2, 80,   80,  75,   '2025-06-03 15:00:00', 'Completed'),
(8,  8, 5, 5000, 5000,4800, '2025-06-03 15:30:00', 'Completed');

-- ============================================================
--  HOSPITALS  (6 rows)
-- ============================================================
INSERT INTO Hospital (hospital_name, location, contact_number, total_beds, available_beds, specialization) VALUES
('Civil Hospital Karachi',    'Karachi, Sindh',     '021-9921001', 800, 120, 'General, Trauma, Burns'),
('Mayo Hospital Lahore',      'Lahore, Punjab',     '042-9920091', 1200, 200,'General, Orthopaedics'),
('Quetta Civil Hospital',     'Quetta, Balochistan','081-9201011', 400,  60, 'General, Emergency'),
('Sukkur General Hospital',   'Sukkur, Sindh',      '071-5613001', 350, 40, 'General, Flood Trauma'),
('PIMS Islamabad',            'Islamabad',          '051-9261170', 700, 180,'General, Neurology'),
('Lady Reading Hospital',     'Peshawar, KPK',      '091-9211355', 900, 150,'General, Paediatrics');

-- ============================================================
--  PATIENTS  (8 rows)
-- ============================================================
INSERT INTO Patient (report_id, hospital_id, full_name, age, gender, admission_time, discharge_time, status, medical_notes) VALUES
(1, 4, 'Noor Fatima',      35, 'Female', '2025-08-02 14:00:00', NULL,                  'Admitted',   'Flood victim, mild hypothermia and dehydration'),
(1, 4, 'Ghulam Rasool',    60, 'Male',   '2025-08-02 14:30:00', NULL,                  'Critical',   'Elderly, severe dehydration, respiratory complications'),
(3, 3, 'Asad Baloch',      28, 'Male',   '2025-09-14 06:00:00', '2025-09-18 10:00:00', 'Discharged', 'Crush injury to left leg, required surgery'),
(3, 3, 'Rubina Kakar',     45, 'Female', '2025-09-14 06:30:00', '2025-09-20 09:00:00', 'Discharged', 'Multiple fractures, stable after orthopaedic treatment'),
(7, 6, 'Tahir Swati',      22, 'Male',   '2025-07-22 09:00:00', '2025-07-28 08:00:00', 'Discharged', 'Flash flood trauma, contusions and lacerations'),
(8, 1, 'Perveen Begum',    55, 'Female', '2025-06-03 16:00:00', '2025-06-05 11:00:00', 'Discharged', 'Severe heatstroke, IV fluids administered'),
(8, 1, 'Shahid Afridi II', 40, 'Male',   '2025-06-03 17:00:00', '2025-06-05 14:00:00', 'Discharged', 'Heat exhaustion, rehydration treatment'),
(9, 4, 'Salma Bibi',       30, 'Female', '2025-08-05 12:00:00', NULL,                  'Admitted',   'Flood-related infection, antibiotics started');

-- ============================================================
--  DONATIONS  (8 rows)
-- ============================================================
INSERT INTO Donation (citizen_id, disaster_event_id, donor_name, donor_type, amount, donation_date, payment_method, transaction_reference) VALUES
(1, 1, 'Hamza Malik',                     'Individual',   50000.00, '2025-08-03 10:00:00', 'Bank Transfer', 'TRF-2025-0001'),
(2, 1, 'Helping Hands Foundation',        'Organization', 500000.00,'2025-08-04 11:00:00', 'Cheque',        'CHQ-2025-0002'),
(3, 2, 'Bilal Raza',                      'Individual',   25000.00, '2025-09-15 09:00:00', 'EasyPaisa',     'EP-2025-0003'),
(4, 4, 'Zara Hussain',                    'Individual',   10000.00, '2025-07-22 14:00:00', 'JazzCash',      'JC-2025-0004'),
(5, 1, 'Sara Noor',                       'Individual',   75000.00, '2025-08-06 08:00:00', 'Bank Transfer', 'TRF-2025-0005'),
(6, 1, 'Pakistan Relief Corps',           'Organization', 1000000.00,'2025-08-07 09:00:00','RTGS',          'RTGS-2025-0006'),
(7, 5, 'Ahmed Siddiqui',                  'Individual',   15000.00, '2025-06-05 16:00:00', 'Debit Card',    'DC-2025-0007'),
(1, 6, 'Hamza Malik',                     'Individual',   20000.00, '2025-11-04 12:00:00', 'Bank Transfer', 'TRF-2025-0008');

-- ============================================================
--  EXPENSES  (8 rows)
-- ============================================================
INSERT INTO Expense (disaster_event_id, category, amount, description, expense_date, recorded_by, approval_status) VALUES
(1, 'Rescue Operations',    250000.00, 'Boat rental and fuel for Sukkur evacuation',      '2025-08-03 09:00:00', 5, 'Approved'),
(1, 'Medical Supplies',     180000.00, 'ORS, IV drips, and medications for flood victims', '2025-08-04 10:00:00', 5, 'Approved'),
(1, 'Food Distribution',    320000.00, 'Rice and MRE packs for 2000 displaced families',  '2025-08-05 11:00:00', 5, 'Approved'),
(2, 'Search & Rescue',      150000.00, 'Heavy equipment for debris removal in Quetta',     '2025-09-15 08:00:00', 5, 'Approved'),
(2, 'Medical',               90000.00, 'Surgery costs for earthquake casualties',          '2025-09-16 09:00:00', 5, 'Approved'),
(3, 'Fire Suppression',      60000.00, 'Chemical foam and firefighting equipment',         '2025-10-06 06:00:00', 5, 'Approved'),
(4, 'Shelter',              200000.00, 'Emergency tents for KPK flood victims',            '2025-07-22 14:00:00', 5, 'Pending'),
(5, 'Medical Camp Setup',   120000.00, 'Mobile medical unit for Karachi heatwave',         '2025-06-04 08:00:00', 5, 'Approved');

-- ============================================================
--  PROCUREMENT  (7 rows)
-- ============================================================
INSERT INTO Procurement (resource_id, warehouse_id, quantity, unit_cost, procurement_date, supplier_name, approved_by, status) VALUES
(1, 1, 1000, 3500.00, '2025-07-28 09:00:00', 'National Food Corp',        1, 'Completed'),
(2, 1, 20000,   12.00,'2025-07-29 10:00:00', 'Pure Water Suppliers Ltd',  1, 'Completed'),
(3, 1, 5000,    45.00,'2025-07-30 08:00:00', 'Medical Essentials Pvt',    1, 'Completed'),
(4, 5, 200,  18000.00,'2025-07-25 11:00:00', 'Relief Shelter Company',    1, 'Completed'),
(5, 4, 10000,   15.00,'2025-09-10 09:00:00', 'PharmaPak Ltd',             1, 'Completed'),
(7, 3, 300,   2500.00,'2025-09-12 10:00:00', 'MediKit Solutions',         1, 'Completed'),
(8, 5, 2000,   650.00,'2025-08-01 08:00:00', 'Ready Meals Pakistan',      1, 'Pending');

-- ============================================================
--  FINANCIAL TRANSACTIONS  (10 rows)
-- ============================================================
INSERT INTO Financial_Transaction (transaction_type, reference_id, disaster_event_id, amount, transaction_date, recorded_by, notes) VALUES
('Donation',     1, 1,    50000.00, '2025-08-03 10:05:00', 5, 'Donation from Hamza Malik for Sindh flood relief'),
('Donation',     2, 1,   500000.00, '2025-08-04 11:05:00', 5, 'Donation from Helping Hands Foundation'),
('Expense',      1, 1,   250000.00, '2025-08-03 09:05:00', 5, 'Boat rental for Sukkur rescue operations'),
('Expense',      2, 1,   180000.00, '2025-08-04 10:05:00', 5, 'Medical supplies procurement for flood camps'),
('Donation',     3, 2,    25000.00, '2025-09-15 09:05:00', 5, 'Donation from Bilal Raza for earthquake relief'),
('Expense',      4, 2,   150000.00, '2025-09-15 08:05:00', 5, 'Search and rescue equipment for Quetta'),
('Donation',     5, 1,    75000.00, '2025-08-06 08:05:00', 5, 'Donation from Sara Noor'),
('Donation',     6, 1,  1000000.00,'2025-08-07 09:05:00', 5, 'Major donation from Pakistan Relief Corps'),
('Expense',      3, 1,   320000.00, '2025-08-05 11:05:00', 5, 'Food distribution for displaced families'),
('Procurement',  1, 1,  3500000.00,'2025-07-28 09:05:00', 5, 'Rice procurement from National Food Corp (1000 sacks)');

-- ============================================================
--  APPROVAL REQUESTS  (7 rows)
-- ============================================================
INSERT INTO Approval_Request (request_type, requested_by, approved_by, allocation_id, status, request_date, resolved_date, remarks) VALUES
('Resource_Allocation', 3, 1, 1, 'Approved', '2025-08-02 11:00:00', '2025-08-02 11:45:00', 'Urgent flood relief — approved immediately'),
('Resource_Allocation', 3, 1, 2, 'Approved', '2025-08-02 11:15:00', '2025-08-02 11:50:00', 'Critical water shortage confirmed'),
('Resource_Allocation', 3, 1, 3, 'Approved', '2025-08-02 11:30:00', '2025-08-02 12:00:00', 'ORS urgently needed for diarrhea cases'),
('Resource_Allocation', 3, 1, 4, 'Approved', '2025-08-05 12:00:00', '2025-08-05 12:30:00', 'Jacobabad shelter request approved'),
('Resource_Allocation', 2, 1, 5, 'Approved', '2025-09-14 05:30:00', '2025-09-14 05:45:00', 'Emergency medical supply for quake survivors'),
('Resource_Allocation', 3, 1, 6, 'Approved', '2025-07-21 17:00:00', '2025-07-21 17:20:00', 'KPK flood blanket allocation approved'),
('Resource_Allocation', 2, NULL, 7,'Pending', '2025-06-03 15:15:00', NULL,                  'Awaiting finance officer sign-off');

-- ============================================================
--  AUDIT LOG  (10 rows — simulating trigger-generated entries)
-- ============================================================
INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address) VALUES
(3, 'INSERT', 'Emergency_Report',    1,  NULL,                          '{"status":"Active"}',             '192.168.1.10'),
(3, 'INSERT', 'Team_Assignment',     1,  NULL,                          '{"status":"Active"}',             '192.168.1.10'),
(4, 'UPDATE', 'Warehouse_Inventory', 1,  '{"quantity":2800}',           '{"quantity":2500}',               '192.168.1.20'),
(4, 'UPDATE', 'Warehouse_Inventory', 2,  '{"quantity":60000}',          '{"quantity":50000}',              '192.168.1.20'),
(1, 'INSERT', 'Disaster_Event',      1,  NULL,                          '{"status":"Active"}',             '192.168.1.1'),
(5, 'INSERT', 'Financial_Transaction',1, NULL,                          '{"amount":50000.00}',             '192.168.1.30'),
(1, 'UPDATE', 'Rescue_Team',         1,  '{"availability_status":"Available"}','{"availability_status":"Busy"}','192.168.1.1'),
(3, 'INSERT', 'Resource_Allocation', 1,  NULL,                          '{"allocated_quantity":300}',      '192.168.1.10'),
(1, 'INSERT', 'Procurement',         1,  NULL,                          '{"status":"Completed"}',          '192.168.1.1'),
(5, 'INSERT', 'Expense',             1,  NULL,                          '{"amount":250000.00}',            '192.168.1.30');

GO

PRINT 'DML complete — sample data inserted across all 20 tables.';
