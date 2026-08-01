# BSC Enterprise HRMS & Recruitment Management System

A production-ready Enterprise HRMS & Recruitment Web Application built with **Next.js 15**, **React 19**, **Node.js/Express**, and **MySQL 8**.

---

## Architecture & Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide React icons, Glassmorphism design tokens.
- **Backend:** Node.js, Express.js REST API, `mysql2/promise` connection pool, JWT Authentication, Multer file uploader, bcrypt password hashing.
- **Database:** MySQL 8.0 / MariaDB (Hostinger compatible).
- **Security:** Helmet headers, CORS policies, Express Rate Limiting, Role-based route guards (`HR`, `Manager`, `Admin`).

---

## Directory Structure

```
/hrms-system
├── /client                  # Next.js 15 App Router Frontend
│   ├── /app                 # App routes (login, dashboard, candidates, interview-panel, etc.)
│   ├── /components          # Reusable UI Components (Sidebar, Topbar, ToastContainer)
│   ├── /services            # API Client & LocalStorage Auth Guard
│   ├── package.json
│   └── tailwind.config.ts
├── /server                  # Express Node.js Backend API
│   ├── /config              # Database Pool Connection
│   ├── /controllers         # Business Logic Controllers
│   ├── /middleware          # JWT Auth & Multer Upload Middlewares
│   ├── /routes              # Express REST & Legacy Action Routes
│   ├── /scripts             # Database Seeder (seed.js)
│   ├── index.js             # Main Express Entry Point
│   └── package.json
├── /database                # Database SQL Schemas
│   ├── schema.sql           # Complete MySQL Table Definitions
│   └── default_data.sql     # Default Designations, Questions, Visibility
└── /uploads                 # Uploaded Candidate Resumes, Photos, Documents
```

---

## Database Setup (MySQL 8)

1. Log into your MySQL Server / phpMyAdmin on Hostinger.
2. Create a new database named `hrms_db`:
   ```sql
   CREATE DATABASE `hrms_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Import `database/schema.sql` to create all 17 tables, foreign keys, and indexes.
4. Import `database/default_data.sql` to populate default roles, questions, and page visibility rules.

---

## Backend Setup (`/server`)

1. Navigate to the server folder:
   ```bash
   cd hrms-system/server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `server/.env`:
   ```env
   PORT=5000
   NODE_ENV=production
   JWT_SECRET=bsc_hrms_super_secret_jwt_key_2026
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=hrms_db
   DB_USER=your_db_username
   DB_PASSWORD=your_db_password
   ```
4. Run the seed script to create initial Admin & User accounts with hashed passwords:
   ```bash
   npm run seed
   ```
   *Default Accounts:*
   - **HR:** `hr@bsctextiles.com` / `bsc@2026`
   - **Store Manager:** `manager@bsctextiles.com` / `bsc@2026`
   - **Admin:** `admin@bsctextiles.com` / `bsc@2026`

5. Start the Express backend:
   ```bash
   npm start
   ```

---

## Frontend Setup (`/client`)

1. Navigate to the client folder:
   ```bash
   cd hrms-system/client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build for production:
   ```bash
   npm run build
   ```
4. Start Next.js production server:
   ```bash
   npm start
   ```

---

## Hostinger Node.js Deployment Steps

1. Upload the `/server` directory to Hostinger's Node.js application directory.
2. In Hostinger Web hosting control panel -> **Node.js Selector**, set application root to `server` and entry point to `index.js`.
3. Set Node.js version to 20.x or higher.
4. Create MySQL Database in Hostinger and run `database/schema.sql` & `database/default_data.sql` using phpMyAdmin.
5. Set environment variables in Hostinger Node.js environment configuration.
6. Build Next.js production bundle (`npm run build`) and point custom domain or subdomain to the Next.js production server or reverse proxy.

---

## Features & Workflows Covered

- **Zero Feature Loss Guarantee:** Every page, workflow, modal, scoring logic, call tracking step, and clearance item from the original Google Apps Script project has been completely preserved and upgraded.
- **Candidate Registration:** Public QR/walk-in registration form with debounced duplicate phone checking.
- **Step-by-step Calling:** Track 1st Call, 2nd Call, and Interview Scheduling with dates and mandatory remarks.
- **Two-Round Evaluations:** HR Round 1 + Evaluator Round 2 with one-time shareable links.
- **Manager Approval Matrix:** Select, Probation Select (<60%), Assign New Role, and Rejection with mandatory remarks.
- **Offer Process & Joining:** Log offer calls, DOJ tracking, and one-click employee onboarding transition.
- **Onboarding & Exit Clearances:** Checklists with progress percentages and audit trails.
- **Admin Control Panel:** User management, bcrypt password resets, page visibility matrix per role, interview question builder, and designation manager.
