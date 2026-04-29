# Smart Disaster Response MIS - SQL Run Order Guide

## SQL Files

| File | Purpose | Status |
|------|---------|--------|
| `ddl.sql` | Creates all 20 tables and base indexes | Ready |
| `dml.sql` | Inserts sample data | Ready |
| `triggers.sql` | Creates 8 automation/audit triggers | Ready |
| `txn1_resource_allocation.sql` | Resource allocation transaction | Ready |
| `txn2_donation_recording.sql` | Donation + ledger transaction | Ready |
| `txn3_procurement.sql` | Procurement request/approval transaction | Ready |
| `txn4_event_closure.sql` | Disaster event closure transaction | Ready |
| `views_and_latency.sql` | 7 views plus view-vs-raw latency checks | Ready |
| `indexing_and_performance.sql` | Index benchmarks with and without indexes | Ready |
| `migration_approval_references.sql` | Existing-DB migration for procurement/team approvals | Optional |

## Fresh Database Run Order

1. Create the database:

```sql
CREATE DATABASE ProjectDB;
GO
USE ProjectDB;
GO
```

2. Run `database\ddl.sql`.
3. Run `database\dml.sql`.
4. Run `database\triggers.sql`.
5. Run each transaction file:

```text
database\txn1_resource_allocation.sql
database\txn2_donation_recording.sql
database\txn3_procurement.sql
database\txn4_event_closure.sql
```

6. Run `database\views_and_latency.sql`.
7. Run `database\indexing_and_performance.sql`.

## Existing Database Upgrade

If your database was created before procurement/team approval references were added, run:

```text
database\migration_approval_references.sql
```

This makes `Approval_Request` support:

- `allocation_id` for resource allocation approvals
- `procurement_id` for procurement approvals
- `assignment_id` for rescue deployment approvals

## Backend Verification

```powershell
cd backend
npm run test-db
npm start
```

Health check:

```text
http://localhost:5000/api/health
```

## Main API Endpoints

| Endpoint | Data Source | Purpose |
|----------|-------------|---------|
| `GET /api/health` | Core table counts | DB verification |
| `GET /api/dashboard` | `vw_Admin_SystemOverview` | Admin dashboard |
| `GET /api/events` | `Disaster_Event` | Disaster events |
| `GET /api/reports` | `Emergency_Report` | Emergency reports |
| `GET /api/teams` | `Rescue_Team` | Rescue teams |
| `POST /api/teams/deployment-requests` | `Team_Assignment`, `Approval_Request` | Deployment approval workflow |
| `GET /api/inventory` | `vw_WarehouseManager_Inventory` | Inventory dashboard |
| `GET /api/procurements` | `Procurement` | Procurement workflow |
| `GET /api/resources` | `Resource` | Resource CRUD |
| `GET /api/warehouses` | `Warehouse` | Warehouse CRUD |
| `GET /api/finance/summary` | `vw_FinanceOfficer_Summary` | Finance dashboard |
| `GET /api/hospitals` | `vw_Hospital_Capacity` | Hospital capacity |
| `GET /api/hospitals/patients` | `Patient` | Patient tracking |
| `GET /api/admin/users` | `[User]`, `Role` | User/role management |
| `GET /api/admin/approvals` | `Approval_Request` | Approval workflow |
| `GET /api/admin/audit` | `Audit_Log` | Audit trail |
| `GET /api/analytics/overview` | Aggregates/views | Dashboard charts |
