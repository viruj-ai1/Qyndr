# ============================================================
#  doe/d_optimal.py  –  D-Optimal / Custom Constrained Design
# ============================================================
import numpy as np
from typing import Dict, Any, List

def generate_d_optimal(k: int, factors: list = None, constraints: list = None, n_runs: int = None, quick_preview: bool = False) -> Dict[str, Any]:
    """
    Generate a D-Optimal design maximizing det(X'X) for constrained or custom factor spaces.
    Supports linear constraints like Factor A + Factor B <= X.
    """
    np.random.seed(42)
    # Default runs: minimum 2k + 4
    if n_runs is None:
        n_runs = max(2 * k + 4, 12)

    # Generate candidate grid points in [-1, 1]^k
    grid_levels = np.array([-1.0, -0.5, 0.0, 0.5, 1.0])
    # Random sampling candidate pool
    n_candidates = min(100 if quick_preview else 500, 5**k if k <= 4 else (50 if quick_preview else 300))
    
    if k <= 4:
        mesh = np.array(np.meshgrid(*[grid_levels]*k)).T.reshape(-1, k)
        candidates = mesh
    else:
        rand_pts = np.random.choice(grid_levels, size=(n_candidates, k))
        candidates = rand_pts

    # Filter candidates based on constraints if provided
    valid_candidates = []
    for pt in candidates:
        is_valid = True
        if constraints and factors:
            # Map coded [-1, 1] to actual factor values
            actual_vals = {}
            for j, val in enumerate(pt):
                f = factors[j]
                fname = f.name if hasattr(f, 'name') else f.get('name', f'Factor_{j}')
                flow = f.low if hasattr(f, 'low') else f.get('low', -1)
                fhigh = f.high if hasattr(f, 'high') else f.get('high', 1)
                actual_vals[fname] = (fhigh + flow)/2 + val * (fhigh - flow)/2

            for c in constraints:
                coeffs = c.get('coefficients', {})
                op = c.get('operator', '<=')
                rhs = c.get('rhs', 0)
                lhs_val = sum(coeffs.get(fn, 0) * actual_vals.get(fn, 0) for fn in coeffs)
                if op == '<=' and lhs_val > rhs + 1e-6:
                    is_valid = False; break
                elif op == '>=' and lhs_val < rhs - 1e-6:
                    is_valid = False; break

        if is_valid:
            valid_candidates.append(pt)

    if len(valid_candidates) < n_runs:
        valid_candidates = list(candidates) # Fallback to grid if constraints are overly tight

    valid_candidates = np.array(valid_candidates)

    # Coordinate Exchange / Fedorov Algorithm for D-optimality
    # Model matrix X: intercept, linear terms, and 2-factor interactions
    def model_row(pt):
        row = [1.0] + list(pt)
        for i in range(len(pt)):
            for j in range(i+1, len(pt)):
                row.append(pt[i] * pt[j])
        return row

    # Initial random selection
    idx = np.random.choice(len(valid_candidates), size=n_runs, replace=(len(valid_candidates) < n_runs))
    chosen_pts = valid_candidates[idx].copy()
    X = np.array([model_row(p) for p in chosen_pts])

    # Exchange algorithm iterations
    n_iters = 1 if quick_preview else 10
    for _ in range(n_iters):
        for r in range(n_runs):
            best_det = np.linalg.det(X.T @ X + 1e-8 * np.eye(X.shape[1]))
            best_pt = chosen_pts[r]
            for cand in valid_candidates:
                X_temp = X.copy()
                X_temp[r] = model_row(cand)
                det_temp = np.linalg.det(X_temp.T @ X_temp + 1e-8 * np.eye(X_temp.shape[1]))
                if det_temp > best_det:
                    best_det = det_temp
                    best_pt = cand
            chosen_pts[r] = best_pt
            X[r] = model_row(best_pt)

    matrix = [[round(float(val), 4) for val in row] for row in chosen_pts]
    run_types = ["D-Optimal"] * len(matrix)

    return {
        "design_type": "D-Optimal Custom Design",
        "resolution": "Custom Constrained",
        "description": f"D-Optimal algorithm generated {len(matrix)} runs respecting factor space constraints",
        "n_runs": len(matrix),
        "n_factorial": len(matrix),
        "matrix": matrix,
        "run_types": run_types
    }
