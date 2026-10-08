# ============================================================
#  doe/factorial.py  –  Full Factorial Designs
# ============================================================
import numpy as np
from itertools import product as iproduct
from typing import List


def full_factorial_2level(n_factors: int) -> np.ndarray:
    """
    Generate a 2^k full factorial in standard (Yates) order.
    Returns matrix of shape (2^k, k) with coded values −1 and +1.
    """
    n = 2 ** n_factors
    design = np.empty((n, n_factors), dtype=float)
    for j in range(n_factors):
        period = 2 ** (n_factors - j - 1)
        for i in range(n):
            design[i, j] = -1.0 if (i // period) % 2 == 0 else 1.0
    return design


def full_factorial_multilevel(levels: List[int]) -> np.ndarray:
    """
    Full factorial for factors with arbitrary number of levels.
    levels: list of # levels per factor.
    Returns matrix with coded values from 0 to n_levels-1.
    """
    combos = list(iproduct(*[range(lv) for lv in levels]))
    return np.array(combos, dtype=float)


def build_design_info(matrix: np.ndarray, label: str,
                       center_pts: int = 4, description: str = "") -> dict:
    """Wrap a design matrix with metadata."""
    n, k = matrix.shape
    run_types = []
    for row in matrix:
        if np.all(row == 0):
            run_types.append("Center")
        elif np.any(np.abs(row) > 1.0):
            run_types.append("Axial")
        else:
            run_types.append("Factorial")

    return {
        "matrix": matrix.tolist(),
        "run_types": run_types,
        "design_type": label,
        "n_runs": n,
        "n_factorial": sum(1 for t in run_types if t == "Factorial"),
        "n_axial": sum(1 for t in run_types if t == "Axial"),
        "n_center": sum(1 for t in run_types if t == "Center"),
        "description": description
    }
