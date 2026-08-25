# 🚀 Quantum Maze Deployment Guide (Render + Vercel)

This project is fully architected to run with a **FastAPI + Qiskit backend on Render** and an **Astro frontend on Vercel**.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                        │
│  Astro + TypeScript + Three.js + GSAP WebGL Landing Page     │
│  Environment Variable: PUBLIC_API_BASE_URL                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON REST API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (Render)                        │
│  FastAPI + Qiskit + Qiskit Aer + NumPy                      │
│  Statevector Simulation & Real-time Topology Generator      │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1: Deploying the Backend on Render

### Step 1: Push Code to GitHub
Ensure your repository is pushed to GitHub:
```bash
git add .
git commit -m "Configure Render and Vercel deployment"
git push origin main
```

### Step 2: Create a Web Service on Render
1. Log in to your **[Render Dashboard](https://dashboard.render.com/)**.
2. Click **New +** → **Web Service**.
3. Select your GitHub repository.
4. Fill in the deployment configuration:

| Field | Value |
|---|---|
| **Name** | `quantum-maze-backend` |
| **Region** | Oregon (US West) or closest region |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | `Free` |

### Step 3: Configure Environment Variables in Render
In the **Environment Variables** tab in Render, add:
- `PYTHON_VERSION` = `3.11.9`
- `CORS_ORIGINS` = `*`

### Step 4: Deploy & Copy Backend URL
1. Click **Create Web Service**.
2. Once the build completes and status changes to `Live`, copy your service URL:
   ```
   https://quantum-maze-backend.onrender.com
   ```
3. Test your live backend in your browser at `https://quantum-maze-backend.onrender.com/health`. You should receive:
   ```json
   {
     "status": "online",
     "engine": "Qiskit Quantum Engine",
     "qiskit_version": "1.x.x",
     "message": "Quantum Computing Backend active. Real statevector and Aer simulation operational."
   }
   ```

---

## Part 2: Deploying the Frontend on Vercel

### Step 1: Import Project to Vercel
1. Log in to your **[Vercel Dashboard](https://vercel.com/dashboard)**.
2. Click **Add New...** → **Project**.
3. Import your GitHub repository.

### Step 2: Configure Project Settings in Vercel
1. **Framework Preset**: `Astro`
2. **Root Directory**: `./` (leave default)
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`

### Step 3: Add Environment Variable
Under **Environment Variables**, add:
- **Key**: `PUBLIC_API_BASE_URL`
- **Value**: `https://quantum-maze-backend.onrender.com` (use your actual Render backend URL from Part 1)

### Step 4: Deploy!
Click **Deploy**. Vercel will build the Astro application and host it on your custom `.vercel.app` domain.

---

## ⚙️ In-Game Endpoint Switcher

You can also dynamically test and switch backend URLs directly inside the game:
1. Go to the **Settings** page (`/settings`).
2. Scroll to **Quantum Backend Engine Connection**.
3. Paste your Render backend URL or localhost URL.
4. Click **Test Connection** to view live Qiskit health status.
5. Click **Save Preferences ✓**.

---

## 🛠️ Local Development

To run both services locally simultaneously:

### Terminal 1 (Backend):
```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
# or: source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2 (Frontend):
```bash
npm install
npm run dev
```
Open `http://localhost:4321` in your browser.
