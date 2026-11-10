# DOE Workflow Studio

DOE (Design of Experiments) Workflow Studio is an interactive, premium web application built for pharmaceutical chemists to optimize synthesis process parameters. It implements a complete, closed-loop workflow: process understanding, factor definitions, screening/factorial DOE designs, statistical regression (RSM), initial optimization, and Gaussian Process-guided Bayesian Optimization iterations to reach the global process optimum.

## 🚀 Getting Started

### Prerequisites
- Python 3.8+ (with `scikit-learn`, `numpy`, `scipy`, `reportlab`, `openpyxl`, `sqlalchemy`, `fastapi`, `uvicorn`, `requests`)
- Node.js & npm (Vite, React, TypeScript)

### Launching the Application

For convenience, startup scripts are provided in the root directory:

1. **Start the FastAPI Backend**:
   - Run the script:
     ```powershell
     ./start_backend.ps1
     ```
   - Alternatively:
     ```bash
     cd backend
     python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
     ```
   - The backend runs on [http://localhost:8000](http://localhost:8000). Interactive API docs are available at `/docs`.

2. **Start the Vite Frontend**:
   - Run the script:
     ```powershell
     ./start_frontend.ps1
     ```
   - Alternatively:
     ```bash
     cd frontend
     npm run dev
     ```
   - Access the application at [http://localhost:5173](http://localhost:5173).

## 🛠️ Main Features
- **Design of Experiments (DOE) Engine**: Generates $2^k$ Full Factorial, Fractional Factorial, and Central Composite designs.
- **Statistical Analysis**: Run descriptive statistics, Pareto charts of standardized effects, and ANOVA (Analysis of Variance) tables.
- **Response Surface Methodology (RSM)**: Multi-response optimization using composite desirability functions.
- **Bayesian Optimization Loop**: Refits a Gaussian Process regression model and suggests subsequent high-value experiments using the Expected Improvement (EI) acquisition function.
- **Professional Reports**: Download compiled PDF and multi-sheet Excel workbooks with experiment history, regression parameters, and optimal conditions.

## 🔐 Authentication & Access Control

Qyndr requires username and password authentication before accessing the DOE workflow.

### 1. Environment Configuration
Copy `.env.example` to `backend/.env` (or project root `.env`):
```bash
JWT_SECRET=your_super_secret_jwt_key_here
JWT_ALGORITHM=HS256
TOKEN_EXPIRY_HOURS=8
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

### 2. Creating Users
Use the secure CLI script to create application accounts:
```bash
python backend/scripts/create_user.py
```
This prompts for a username and hidden password, hashes credentials with `bcrypt` (12 rounds), and saves the user directly to `doe_workflow.db`.

Alternatively, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env` to automatically bootstrap an administrator user upon first server startup.

### 3. API Security & Session Management
- **Login Endpoint**: `POST /api/auth/login` (rate-limited to 5 failed attempts per IP/username per 15 minutes; returns generic 401 on failure).
- **Session Handling**: Dual-mode authentication:
  - **HttpOnly Cookies**: Automatic `access_token` cookie with `SameSite=Lax`.
  - **Bearer Token**: Compatible Authorization header fallback for cross-domain deployments (e.g. Vercel $\to$ Render).
- **Protected Routes**: All DOE, QbD, Analysis, and Optimization endpoints enforce `get_current_user` dependency protection.

