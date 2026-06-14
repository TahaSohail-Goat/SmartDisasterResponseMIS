# 🚨 Smart Disaster Response MIS

A full-stack **Management Information System** for coordinating disaster response operations in real time. Built with **Next.js**, **Node.js/Express**, and **Microsoft SQL Server**.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Database Setup](#-database-setup)
- [Backend Setup](#-backend-setup)
- [Frontend Setup](#-frontend-setup)
- [Environment Variables](#-environment-variables)
- [API Endpoints](#-api-endpoints)
- [Troubleshooting](#-troubleshooting)

---

## 🧭 Overview

Smart Disaster Response MIS enables government and NGO teams to manage disaster events end-to-end — from emergency reporting and rescue team deployment to resource allocation, hospital tracking, procurement, and financial oversight.

The system supports **role-based dashboards** for:
- **Admins** — user management, approvals, audit logs, system overview
- **Coordinators** — disaster events, rescue team deployment, resource allocation
- **Field Officers** — emergency report submission and status updates
- **Finance Officers** — donations, expenses, financial transactions
- **Warehouse Managers** — inventory, procurement, warehouses
- **Hospital Staff** — patient tracking, hospital capacity

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Framer Motion, Recharts |
| Backend | Node.js, Express 5 |
| Database | Microsoft SQL Server (mssql) |
| Auth | JWT (JSON Web Tokens) + bcryptjs |
| Styling | Vanilla CSS (custom design system) |

---

## ✨ Features

- 🔐 **JWT Authentication** — Login / Signup with role-based access control
- 📊 **Admin Dashboard** — System-wide overview with live statistics
- 🌪️ **Disaster Event Management** — Create, track, and close disaster events
- 📋 **Emergency Reports** — Field-officer report submission and severity tracking
- 🚑 **Rescue Team Deployment** — Assign teams with approval workflow
- 📦 **Inventory & Warehouses** — Track resources across multiple warehouse locations
- 🏥 **Hospital Management** — Monitor hospital capacity and patient intake
- 💰 **Finance Module** — Donations, expenses, and financial transaction ledger
- 🛒 **Procurement** — Procurement request and approval pipeline
- 📈 **Analytics** — Charts and performance metrics powered by SQL views
- 📝 **Audit Trail** — Full audit log via database triggers
- ⚡ **Performance Optimized** — Custom SQL indexes and benchmarked views

---

## 📁 Project Structure

```
DBProject/
├── backend/                  # Express API server
│   ├── routes/               # Route handlers
│   │   ├── auth.js           # Login & signup
│   │   ├── events.js         # Disaster events
│   │   ├── reports.js        # Emergency reports
│   │   ├── teams.js          # Rescue teams & deployment
│   │   ├── inventory.js      # Inventory management
│   │   ├── finance.js        # Finance & transactions
│   │   ├── hospitals.js      # Hospitals & patients
│   │   ├── procurement.js    # Procurement workflow
│   │   ├── resources.js      # Resources CRUD
│   │   ├── warehouses.js     # Warehouses CRUD
│   │   ├── analytics.js      # Analytics & charts
│   │   └── admin.js          # Admin panel APIs
│   ├── middleware/           # Auth middleware
│   ├── db.js                 # SQL Server connection pool
│   ├── server.js             # Express app entry point
│   ├── .env                  # Your local config (do NOT commit)
│   └── .env.example          # Template for env setup
│
├── frontend/                 # Next.js web application
│   └── app/
│       ├── page.js           # Main dashboard
│       ├── login/            # Login page
│       ├── signup/           # Registration page
│       ├── events/           # Disaster events page
│       ├── reports/          # Emergency reports page
│       ├── teams/            # Rescue teams page
│       ├── inventory/        # Inventory page
│       ├── hospitals/        # Hospitals page
│       ├── finance/          # Finance page
│       ├── procurement/      # Procurement page
│       ├── analytics/        # Analytics & charts
│       ├── approvals/        # Approval workflow
│       ├── audit/            # Audit trail log
│       └── admin/            # Admin panel
│
└── database/                 # SQL Server scripts
    ├── ddl.sql               # Table definitions (20 tables)
    ├── dml.sql               # Sample data
    ├── triggers.sql          # 8 automation/audit triggers
    ├── views_and_latency.sql # 7 SQL views + latency checks
    ├── indexing_and_performance.sql  # Index benchmarks
    ├── txn1_resource_allocation.sql  # Transaction: resource alloc
    ├── txn2_donation_recording.sql   # Transaction: donations
    ├── txn3_procurement.sql          # Transaction: procurement
    └── txn4_event_closure.sql        # Transaction: event closure
```

---

## ✅ Prerequisites

Make sure the following are installed on your machine:

- [Node.js](https://nodejs.org/) v18 or higher
- [Microsoft SQL Server](https://www.microsoft.com/en-us/sql-server) (Express edition is free)
- [SQL Server Management Studio (SSMS)](https://aka.ms/ssms) — recommended for running SQL scripts

---

## 🗄️ Database Setup

### 1. Create the database

Open SSMS, connect to your SQL Server instance, and run:

```sql
CREATE DATABASE ProjectDB;
GO
USE ProjectDB;
GO
```

### 2. Run SQL scripts in order

Execute each file in SSMS in the following order:

| # | File | Purpose |
|---|------|---------|
| 1 | `database/ddl.sql` | Creates all 20 tables and base indexes |
| 2 | `database/dml.sql` | Inserts sample/demo data |
| 3 | `database/triggers.sql` | Adds 8 automation and audit triggers |
| 4 | `database/txn1_resource_allocation.sql` | Resource allocation transaction |
| 5 | `database/txn2_donation_recording.sql` | Donation + ledger transaction |
| 6 | `database/txn3_procurement.sql` | Procurement approval transaction |
| 7 | `database/txn4_event_closure.sql` | Disaster event closure transaction |
| 8 | `database/views_and_latency.sql` | 7 views + latency benchmarks |
| 9 | `database/indexing_and_performance.sql` | Index creation and benchmarks |

> ⚠️ **Important:** Run scripts in this exact order. `ddl.sql` must come before all others.

---

## ⚙️ Backend Setup

```powershell
# Navigate to backend
cd backend

# Install dependencies
npm install

# Test database connection
npm run test-db

# Start the server
npm run dev
```

The backend will start at: **http://localhost:5000**

Health check: **http://localhost:5000/api/health**

---

## 🖥️ Frontend Setup

Open a **new terminal** and run:

```powershell
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will start at: **http://localhost:3000**

> 💡 Both the backend and frontend must be running at the same time.

---

## 🔧 Environment Variables

### Backend — `backend/.env`

Copy `backend/.env.example` to `backend/.env` and fill in your values:

```env
# Database
DB_SERVER=localhost
DB_USER=your_sql_username
DB_PASSWORD=your_sql_password
DB_DATABASE=ProjectDB
DB_PORT=1433

# Server
PORT=5000
NODE_ENV=development

# Auth
JWT_SECRET=your_long_random_secret_here
JWT_EXPIRES_IN=8h

# CORS (use * for local dev)
CORS_ORIGIN=*
```

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

> 🔒 **Never commit `.env` files to GitHub.** They are already listed in `.gitignore`.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Database connection health check |
| `POST` | `/api/auth/login` | User login |
| `POST` | `/api/auth/signup` | User registration |
| `GET` | `/api/dashboard` | Admin system overview |
| `GET` | `/api/events` | List disaster events |
| `GET` | `/api/reports` | Emergency reports |
| `GET` | `/api/teams` | Rescue teams |
| `POST` | `/api/teams/deployment-requests` | Team deployment with approval |
| `GET` | `/api/inventory` | Warehouse inventory |
| `GET` | `/api/resources` | Resources list |
| `GET` | `/api/warehouses` | Warehouses list |
| `GET` | `/api/finance/summary` | Finance summary |
| `GET` | `/api/hospitals` | Hospital capacity |
| `GET` | `/api/hospitals/patients` | Patient tracking |
| `GET` | `/api/procurements` | Procurement requests |
| `GET` | `/api/admin/users` | User & role management |
| `GET` | `/api/admin/approvals` | Approval workflow |
| `GET` | `/api/admin/audit` | Audit trail log |
| `GET` | `/api/analytics/overview` | Analytics & charts data |

---

## 🔎 Troubleshooting

### "Failed to fetch" on the frontend
- The backend is not running. Start it with `npm run dev` inside the `backend/` folder.

### Backend won't connect to SQL Server
1. Open **Services** (`Win + R` → `services.msc`) → ensure `SQL Server (MSSQLSERVER)` is **Running**
2. In SSMS → right-click server → **Properties** → **Security** → set to **SQL Server and Windows Authentication mode**
3. Make sure the login in `.env` (`DB_USER`) exists in SSMS → **Security** → **Logins**
4. Run `npm run test-db` in the `backend/` folder to isolate the connection error

### Port already in use
- Backend: Change `PORT=5000` in `backend/.env` to another port (e.g., `5001`)
- Frontend: Run `npm run dev -- -p 3001` to use a different port

### SQL Script errors
- Make sure you are connected to `ProjectDB` before running scripts (`USE ProjectDB;`)
- Run `ddl.sql` first — all other scripts depend on it

---

## 👨‍💻 Authors

Built as a Database Systems course project at **FAST-NUCES**.

---
