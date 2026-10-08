# ============================================================
#  doe/mixture.py  –  Mixture Designs (Simplex-Centroid, Lattice)
# ============================================================
import numpy as np
from itertools import combinations


def simplex_centroid(n_components: int, degree: int = 3) -> dict:
    """
    Scheffé simplex-centroid design for n_components mixture components.
    Includes all blends up to `degree` components.
    Sum of components = 1.
    """
    rows = []
    for d in range(1, min(degree, n_components) + 1):
        for combo in combinations(range(n_components), d):
            row = [0.0] * n_components
            for i in combo:
                row[i] = 1.0 / d
            rows.append(row)

    # Overall centroid
    rows.append([1.0 / n_components] * n_components)

    matrix = np.array(rows)
    run_types = ["Mixture"] * len(rows)

    return {
        "matrix": matrix.tolist(),
        "run_types": run_types,
        "design_type": f"Simplex-Centroid ({n_components} components)",
        "resolution": "Mixture (Scheffé)",
        "n_runs": len(rows),
        "n_factorial": 0,
        "n_axial": 0,
        "n_center": 1,
        "description": (
            f"Simplex-centroid mixture design for {n_components} components. "
            "All component proportions sum to 1. "
            "Models the effect of composition on response."
        )
    }


def simplex_lattice(n_components: int, m: int = 2) -> dict:
    """
    Simplex {n,m} lattice design.
    Each component takes values 0, 1/m, 2/m, ..., 1.
    """
    from itertools import combinations_with_replacement
    rows = []
    for combo in combinations_with_replacement(range(n_components), m):
        row = [combo.count(i) / m for i in range(n_components)]
        rows.append(row)

    matrix = np.unique(np.array(rows), axis=0)
    run_types = ["Mixture"] * len(matrix)

    return {
        "matrix": matrix.tolist(),
        "run_types": run_types,
        "design_type": f"Simplex Lattice {{{n_components},{m}}}",
        "resolution": "Mixture (Scheffé)",
        "n_runs": len(matrix),
        "n_factorial": 0,
        "n_axial": 0,
        "n_center": 0,
        "description": (
            f"Simplex {{n={n_components}, m={m}}} lattice design. "
            "Uniformly spaced points across the mixture simplex. "
            "Used for formulation studies."
        )
    }
