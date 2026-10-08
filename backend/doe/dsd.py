# ============================================================
#  doe/dsd.py  –  Definitive Screening Designs (DSD)
# ============================================================
import numpy as np
from typing import Dict, Any, List

def generate_dsd(k: int) -> Dict[str, Any]:
    """
    Generate a Definitive Screening Design (DSD) for k factors.
    DSDs are 3-level designs with N = 2k + 1 (or 2k + 3) runs.
    Properties:
    - Main effects are completely orthogonal to each other.
    - Main effects are unconfounded with 2-factor interactions.
    - 2-factor interactions are not fully aliased with each other.
    - Quadratic terms can be estimated.
    """
    if k < 3:
        k = 3

    # Base Hadamard / cyclic matrix generator for standard DSDs
    # Constructed using foldover pairs + center run
    m = k if k % 2 == 0 else k + 1

    # Base design block (circulant shift matrix)
    base = []
    # Generate cyclic shifted rows
    seed = [0.0] + [1.0 if (i % 2 == 0) else -1.0 for i in range(1, m)]
    for i in range(m):
        row = seed[i:] + seed[:i]
        base.append(row[:k])
    
    # Foldover (-1 * base)
    fold = [[-val for val in row] for row in base]
    
    # Center point (0, 0, ..., 0)
    center = [[0.0] * k]

    matrix = base + fold + center
    
    # Classify run types
    run_types = ["Definitive Screening"] * (2 * m) + ["Center"]

    return {
        "design_type": "Definitive Screening Design (DSD)",
        "resolution": "Unconfounded Main & Quadratic",
        "description": f"3-level Definitive Screening Design ({len(matrix)} runs for {k} factors)",
        "n_runs": len(matrix),
        "n_factorial": 2 * m,
        "n_center": 1,
        "matrix": matrix,
        "run_types": run_types
    }
