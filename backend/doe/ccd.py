# ============================================================
#  doe/ccd.py  –  Central Composite Design (CCD)
# ============================================================
import numpy as np
from .factorial import full_factorial_2level


def central_composite(k: int, face_centered: bool = True, n_center: int = 0) -> dict:
    """
    Central Composite Design (CCD) for k factors.
    face_centered: α=1 (cube face), else rotatable α=(2^k)^(1/4)
    n_center: number of center runs (0 = auto)
    """
    # Rotatable alpha
    alpha = 1.0 if face_centered else round(float((2 ** min(k, 5)) ** 0.25), 4)

    # --- Factorial part ---
    if k <= 4:
        fact = full_factorial_2level(k)
    else:
        # Half fraction for k≥5 to keep runs manageable
        from .fractional import get_fractional_design
        fd = get_fractional_design(k, prefer_small=False)
        fact = np.array(fd["matrix"])

    # --- Axial (star) points ---
    axial = []
    for j in range(k):
        pos = np.zeros(k); pos[j] = +alpha
        neg = np.zeros(k); neg[j] = -alpha
        axial.extend([pos, neg])
    axial = np.array(axial)

    # --- Center points ---
    nc = n_center if n_center > 0 else max(3, int(np.ceil(0.5 * k + 1)))
    centers = np.zeros((nc, k))

    # --- Combine ---
    matrix = np.vstack([fact, axial, centers])

    run_types = (
        ["Factorial"] * len(fact) +
        ["Axial"]    * len(axial) +
        ["Center"]   * nc
    )

    return {
        "matrix": matrix.tolist(),
        "run_types": run_types,
        "design_type": f"CCD {'Face-Centered' if face_centered else f'Rotatable (α={alpha})'}",
        "resolution": "RSM – Full Quadratic Model",
        "alpha": alpha,
        "n_runs": len(matrix),
        "n_factorial": len(fact),
        "n_axial": len(axial),
        "n_center": nc,
        "description": (
            f"Central Composite Design with {len(fact)} factorial, {len(axial)} axial "
            f"(α={alpha}), and {nc} center runs. "
            "Fits a full second-order (quadratic) response surface model with interaction terms."
        )
    }
