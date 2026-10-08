# ============================================================
#  doe/plackett_burman.py  –  Plackett-Burman Designs
# ============================================================
import numpy as np

# Generating rows for Plackett-Burman designs (first row of circulant matrix)
PB_GENERATORS: dict = {
    12:  [1, 1,-1, 1, 1, 1,-1,-1,-1, 1,-1],
    20:  [1, 1,-1,-1, 1, 1, 1, 1,-1, 1,-1, 1,-1,-1,-1,-1, 1, 1,-1, 1],
    24:  [1, 1, 1, 1, 1,-1, 1,-1, 1, 1,-1,-1, 1, 1,-1,-1, 1,-1, 1,-1,-1,-1,-1, 1],
}


def _cyclic_shift(row: list) -> list:
    return [row[-1]] + row[:-1]


def plackett_burman(k: int) -> dict:
    """
    Return a Plackett-Burman design for k factors.
    Chooses smallest PB design that accommodates k factors (runs = k+1, rounded to multiple of 4).
    """
    # Find smallest PB size that fits k factors
    pb_size = None
    for size in sorted(PB_GENERATORS.keys()):
        if size - 1 >= k:
            pb_size = size
            break
    if pb_size is None:
        pb_size = max(PB_GENERATORS.keys())

    base = PB_GENERATORS[pb_size]
    rows = []
    current = list(base)
    for _ in range(pb_size - 1):
        rows.append(current[:k])
        current = _cyclic_shift(current)
    rows.append([-1] * k)   # last row all −1

    matrix = np.array(rows, dtype=float)

    return {
        "matrix": matrix.tolist(),
        "run_types": ["Plackett-Burman"] * pb_size,
        "design_type": f"Plackett-Burman ({pb_size} runs)",
        "resolution": "Resolution III (PB)",
        "n_runs": pb_size,
        "n_factorial": pb_size,
        "n_axial": 0,
        "n_center": 0,
        "description": (
            f"Plackett-Burman design with {pb_size} runs for up to {pb_size - 1} factors. "
            "Highly efficient for screening – all main effects are independently estimable. "
            "2FIs are partially confounded but main effects are unbiased."
        )
    }
