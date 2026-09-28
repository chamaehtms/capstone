# Deployment Guide

This guide covers deploying the Barangay Poblacion Monorepo to standard cloud platforms (**Render**, **Railway**, **Vercel**, **Netlify**, or any Node.js VPS) without Docker or Nginx.

---

## 📋 System Architecture & Production URLs

| Service | Workspace | Runtime | Build / Start Command | Output / Port |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | `apps/backend` | Node.js (20+) | `npm run migrate -w @capstone/backend && npm run start -w @capstone/backend` | Port `process.env.PORT` |
| **Admin Dashboard** | `apps/admin` | Static SPA | `npm run build -w @capstone/admin` | `apps/admin/dist` |
| **Resident Portal** | `apps/resident` | Static SPA | `npm run build -w @capstone/resident` | `apps/resident/dist` |

---

## Option 1: Render (1-Click Blueprint with `render.yaml`)

The repository includes a ready-to-use [`render.yaml`](./render.yaml) blueprint that automatically sets up:
- 1 Managed PostgreSQL Database (`barangay-db`)
- 1 Node.js Web Service for the Backend API
- 2 Static Sites for the Admin Dashboard and Resident Portal with automatic SPA rewrites (`/* -> /index.html`)

### Steps:
1. Push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** > **Blueprint**.
3. Connect your repository (`chamaehtms/capstone`).
4. Render will detect `render.yaml` and configure all 3 services and the database.
5. Click **Apply**.
6. Once deployed, open your backend settings and configure your `SMTP_*` email variables in the Environment tab (for verification emails).

---

## Option 2: Vercel / Netlify (Frontends) + Render / Railway (Backend)

A very common pattern is hosting frontends on Vercel or Netlify (free, global CDN) and hosting the Node backend on Render or Railway.

### Step 1: Deploy Backend (Render or Railway)
1. Create a new **Web Service** pointing to your repo.
2. **Root Directory:** Leave blank (repository root).
3. **Build Command:** `npm install`
4. **Start Command:** `npm run migrate -w @capstone/backend && npm run start -w @capstone/backend`
5. **Environment Variables:**
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: Your PostgreSQL connection string (Neon, Supabase, or Railway)
   - `JWT_SECRET`: A secure 32+ character random string
   - `CORS_ORIGIN`: Your deployed frontend URLs separated by commas (e.g. `https://admin.vercel.app,https://resident.vercel.app` or `*`)
   - `SMTP_*`: Your email credentials

### Step 2: Deploy Admin Dashboard (Vercel or Netlify)
1. In Vercel or Netlify, import the repository.
2. **Framework Preset:** Vite
3. **Root Directory:** `apps/admin`
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. **Environment Variable:**
   - `VITE_API_URL`: Your backend API URL with `/api` path (e.g. `https://barangay-backend.onrender.com/api`)
7. **SPA Rewrites:** Already configured via [`apps/admin/vercel.json`](./apps/admin/vercel.json) and [`apps/admin/public/_redirects`](./apps/admin/public/_redirects) to prevent 404 errors on browser refresh.

### Step 3: Deploy Resident Portal (Vercel or Netlify)
1. Import the repository again as a second project.
2. **Framework Preset:** Vite
3. **Root Directory:** `apps/resident`
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. **Environment Variable:**
   - `VITE_API_BASE`: Your backend API URL with `/api` path (e.g. `https://barangay-backend.onrender.com/api`)
7. **SPA Rewrites:** Already configured via [`apps/resident/vercel.json`](./apps/resident/vercel.json) and [`apps/resident/public/_redirects`](./apps/resident/public/_redirects).

---

## Option 3: Traditional VPS / Ubuntu (PM2)

If hosting on a Linux VPS (Ubuntu/Debian) using PM2:

### 1. Install Node.js (v20+) & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2 serve
```

### 2. Clone & Install
```bash
git clone https://github.com/chamaehtms/capstone.git
cd capstone
npm install
```

### 3. Build Frontends & Migrate Database
```bash
cp apps/backend/.env.production.example apps/backend/.env
# Edit .env with nano / vim to add real database credentials
npm run migrate -w @capstone/backend
npm run build
```

### 4. Start Services with PM2
```bash
# Start backend API (runs on port 4000)
pm2 start apps/backend/server.js --name "barangay-backend"

# Serve Admin frontend (port 5173 with SPA rewrite)
pm2 start "npx serve -s apps/admin/dist -l 5173" --name "barangay-admin"

# Serve Resident frontend (port 5500 with SPA rewrite)
pm2 start "npx serve -s apps/resident/dist -l 5500" --name "barangay-resident"

# Save PM2 process list to restart on reboot
pm2 save
pm2 startup
```

---

## 🔒 Production Environment Variables Checklist

Set these in your backend service dashboard:

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | Sets Node runtime environment | `production` |
| `PORT` | Auto | Set automatically by most PaaS hosts | `4000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgres://user:pass@host:5432/db?sslmode=require` |
| `JWT_SECRET` | Yes | Secret key for signing session tokens | `a-long-random-string-at-least-32-chars` |
| `CORS_ORIGIN` | Optional | Allowed origins (comma-separated or `*`) | `https://admin.domain.com,https://resident.domain.com` |
| `FRONTEND_URL` | Yes | Admin portal URL for email links | `https://admin.domain.com` |
| `RESIDENT_FRONTEND_URL`| Yes | Resident portal URL for notifications | `https://resident.domain.com` |
| `SMTP_HOST` | Optional | SMTP mail server | `smtp.gmail.com` |
| `SMTP_PORT` | Optional | SMTP mail port | `587` |
| `SMTP_USER` | Optional | Email sending address | `barangay.notifications@gmail.com` |
| `SMTP_PASS` | Optional | Gmail App Password (16 characters) | `abcd efgh ijkl mnop` |
| `SMTP_FROM` | Optional | Sender display name & address | `Barangay Poblacion <noreply@domain.gov>` |
