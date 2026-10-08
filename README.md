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
