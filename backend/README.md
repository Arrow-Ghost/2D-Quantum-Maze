# Quantum Maze — Backend Engine (FastAPI & Qiskit)

This is the standalone Python backend for **Quantum Maze**, powered by FastAPI, Qiskit, and Qiskit Aer.

---

## 🚀 Deploying to Render (Step-by-Step)

### Option A: Deploy from Monorepo (Recommended)
1. Push your repository to **GitHub**.
2. Go to your **[Render Dashboard](https://dashboard.render.com/)** and click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service settings:
   - **Name**: `quantum-maze-backend` (or your choice)
   - **Language / Runtime**: `Python 3`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
5. In **Environment Variables**, add:
   - `PYTHON_VERSION`: `3.11.9`
   - `CORS_ORIGINS`: `*` (or your Vercel frontend domain: `https://your-app.vercel.app`)
6. Click **Create Web Service**.
7. Once deployed, copy your Render URL:
   `https://quantum-maze-backend.onrender.com`

---

### Option B: Deploy as a Separate Git Repository
If you prefer a dedicated backend repository:
1. Initialize a new Git repo inside the `backend` folder:
   ```bash
   cd backend
   git init
   git add .
   git commit -m "Initial commit of Quantum Maze backend"
   git remote add origin https://github.com/YOUR_USERNAME/quantum-maze-backend.git
   git push -u origin main
   ```
2. In Render, select **New +** → **Web Service**, choose `quantum-maze-backend`, and leave **Root Directory** empty.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

---

## 🧪 Local Testing

### 1. Set Up Python Virtual Environment
```bash
python -m venv .venv
source .venv/bin/activate  # On Linux / macOS
# or
.\.venv\Scripts\Activate.ps1  # On Windows PowerShell
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Automated Tests
```bash
pytest tests/
```

### 4. Start Local Development Server
```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger API documentation will be available at: `http://127.0.0.1:8000/docs`
Health check endpoint: `http://127.0.0.1:8000/health`
