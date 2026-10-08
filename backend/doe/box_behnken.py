# ============================================================
#  doe/box_behnken.py  –  Box-Behnken Designs
# ============================================================
import numpy as np

# Box-Behnken designs stored as blocks of factor pairs at ±1
# For k factors: use midpoints of edges of a hypercube
BB_BLOCKS: dict = {
    3: [[0,1],[0,2],[1,2]],
    4: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],
    5: [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]],
    6: [[0,1],[2,3],[4,5],[0,2],[1,4],[3,5],[0,3],[1,5],[2,4]],
    7: [[0,1],[2,3],[4,5],[0,2],[3,5],[1,4],[0,3],[1,5],[2,4],[0,4],[1,3],[2,5],[6,0],[6,1],[6,2]],
}


def box_behnken(k: int, n_center: int = 3) -> dict:
    """
    Box-Behnken Design for k factors (k must be 3-7).
    Does not support k<3 or k>7 natively.
    """
    if k < 3 or k > 7:
        raise ValueError(f"Box-Behnken design supports k=3..7, got k={k}")

    blocks = BB_BLOCKS.get(k, BB_BLOCKS[min(7, k)])
    rows = []
    for pair in blocks:
        for s1 in [-1, 1]:
            for s2 in [-1, 1]:
                row = [0.0] * k
                row[pair[0]] = float(s1)
                row[pair[1]] = float(s2)
                rows.append(row)

    # Add center runs
    for _ in range(n_center):
        rows.append([0.0] * k)

    matrix = np.array(rows)
    run_types = (
        ["Factorial"] * (len(rows) - n_center) +
        ["Center"]   * n_center
    )

    return {
        "matrix": matrix.tolist(),
        "run_types": run_types,
        "design_type": f"Box-Behnken ({len(rows)} runs)",
        "resolution": "RSM – Full Quadratic Model",
        "n_runs": len(rows),
        "n_factorial": len(rows) - n_center,
        "n_axial": 0,
        "n_center": n_center,
        "description": (
            f"Box-Behnken design for {k} factors with {n_center} center points. "
            "All points lie on a sphere – avoids extreme combinations. "
            "Excellent for RSM when you want to avoid corners of the design space."
        )
    }
