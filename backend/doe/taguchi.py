# ============================================================
#  doe/taguchi.py  –  Taguchi Orthogonal Arrays
# ============================================================
import numpy as np

# Standard Taguchi L-arrays (2-level factors, coded as −1/+1)
L_ARRAYS: dict = {
    "L4":  {"runs": 4,  "max_factors": 3,  "matrix": [
        [-1,-1,-1], [1,-1,1], [-1,1,1], [1,1,-1]
    ]},
    "L8":  {"runs": 8,  "max_factors": 7,  "matrix": [
        [-1,-1,-1,-1,-1,-1,-1], [1,-1,-1,1,1,1,-1],
        [-1,1,-1,1,-1,1,1],     [1,1,-1,-1,1,-1,1],
        [-1,-1,1,1,1,-1,1],     [1,-1,1,-1,-1,1,1],
        [-1,1,1,-1,1,1,-1],     [1,1,1,1,-1,-1,-1]
    ]},
    "L12": {"runs": 12, "max_factors": 11, "matrix": None},  # Use PB-12
    "L16": {"runs": 16, "max_factors": 15, "matrix": None},  # Generated
}


def taguchi(k: int) -> dict:
    """
    Return a Taguchi orthogonal array for k 2-level factors.
    """
    if k <= 3:
        info = L_ARRAYS["L4"]
        matrix = np.array(info["matrix"])[:, :k]
        label = "L4"
    elif k <= 7:
        info = L_ARRAYS["L8"]
        matrix = np.array(info["matrix"])[:, :k]
        label = "L8"
    elif k <= 11:
        # Use PB-12 as L12
        from .plackett_burman import plackett_burman
        d = plackett_burman(k)
        return {**d, "design_type": f"Taguchi L12 (PB-12, {k} factors)"}
    else:
        from .plackett_burman import plackett_burman
        d = plackett_burman(k)
        return {**d, "design_type": f"Taguchi L20 (PB-20, {k} factors)"}

    run_types = ["Taguchi"] * len(matrix)
    return {
        "matrix": matrix.tolist(),
        "run_types": run_types,
        "design_type": f"Taguchi {label} ({k} factors)",
        "resolution": "Resolution III",
        "n_runs": len(matrix),
        "n_factorial": len(matrix),
        "n_axial": 0,
        "n_center": 0,
        "description": (
            f"Taguchi {label} orthogonal array for {k} factors. "
            "Robust design methodology – balances main effects efficiently. "
            "Suitable for manufacturing process optimization."
        )
    }
