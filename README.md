# Barangay Poblacion — Smart Profiling & Complaint Management System

A unified monorepo housing the full-stack system for Barangay Poblacion: the unified Express API backend, the Admin & Staff Dashboard, and the Resident Portal.

---

## 🏗️ Repository Architecture

This project is organized as an **npm workspaces + Turborepo** monorepo:

```
capstone/
├── apps/
│   ├── backend/     # Express REST API + PostgreSQL (Port 4000)
│   ├── admin/       # Admin & Staff Web Dashboard (React + Vite, Port 5173)
│   └── resident/    # Resident Self-Service Portal (React + Vite, Port 5500)
├── packages/        # Shared packages and configurations
├── package.json     # Monorepo root workspaces & orchestrator scripts
├── turbo.json       # Turborepo task pipeline configuration
└── .gitignore       # Centralized git ignore rules
```

### Applications Breakdown

| Application | Path | Tech Stack | Default Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | `apps/backend` | Node.js, Express, PostgreSQL, JWT | `4000` | Unified REST API powering both portals, database migrations, authentication, email verification, and file uploads. |
| **Admin Dashboard** | `apps/admin` | React 18, Vite, React Router, Tailwind | `5173` | Management portal for barangay officials to view resident profiles, manage complaints, schedule hearings, and approve accounts. |
| **Resident Portal** | `apps/resident` | React 18, Vite, React Router | `5500` | Citizen self-service portal for resident registration, filing complaints/blotter reports, tracking statuses, and viewing announcements. |

---

## 🚀 Quick Start

### 1. Install Dependencies
Install all dependencies across the entire monorepo with a single command from the root:

```bash
npm install
```

### 2. Configure Environment Variables
Copy the example environment file for the backend:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Open `apps/backend/.env` and update the following settings:
- `DATABASE_URL`: Your PostgreSQL connection string (e.g. Neon, local Postgres, or Supabase).
- `JWT_SECRET`: A secure random string for JWT token generation.
- `PORT`: Defaults to `4000`.
- `SMTP_*`: Credentials for email notifications & verification codes (e.g. Gmail App Password).
- `FRONTEND_URL`: `http://localhost:5173` (Admin portal address).
- `RESIDENT_FRONTEND_URL`: `http://localhost:5500` (Resident portal address).

### 3. Run Database Migrations
Initialize database tables and seed demo accounts and sample data:

```bash
npm run migrate
```

### 4. Start Development Servers
Run all three services (Backend API, Admin Dashboard, Resident Portal) concurrently with labeled terminal logs:

```bash
npm run dev
```

You can now open:
- **Admin Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Resident Portal**: [http://localhost:5500](http://localhost:5500)
- **Backend API**: [http://localhost:4000](http://localhost:4000)

---

## 📜 Available Scripts

Run these scripts from the repository root:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts **Backend**, **Admin**, and **Resident** concurrently with color-coded logs |
| `npm run dev:backend` | Starts only the Express backend API in watch mode (`nodemon`) |
| `npm run dev:admin` | Starts only the Admin Dashboard Vite dev server |
| `npm run dev:resident` | Starts only the Resident Portal Vite dev server |
| `npm run dev:frontends` | Starts both frontends concurrently (without restarting backend) |
| `npm run build` | Builds all production bundles via Turborepo |
| `npm run check` | Runs syntax and validation checks across apps |
| `npm run migrate` | Runs PostgreSQL database migration and seeds initial data |
| `npm run start:backend`| Starts backend in production mode (`node server.js`) |

---

## 🔑 Demo Credentials

Once migrations (`npm run migrate`) have completed:

### Admin Dashboard (`http://localhost:5173`)
- **Email:** `admin@civicledger.gov`
- **Password:** `admin123`

### Resident Portal (`http://localhost:5500`)
- **Email:** `elena.santos@example.com`
- **Password:** `password123`

---

## 📁 Shared Database & Real-Time Sync
Because both frontends communicate with the unified backend in `apps/backend`:
- Any complaint submitted by a resident in the **Resident Portal** immediately appears in the **Admin Dashboard** complaints queue.
- Status changes or hearing minutes added by barangay staff in the **Admin Dashboard** reflect instantaneously when tracked in the **Resident Portal**.
- No duplicate backend processes or database drift!
