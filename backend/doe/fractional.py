# ============================================================
#  doe/fractional.py  –  2^(k-p) Fractional Factorial Designs
# ============================================================
import numpy as np
from .factorial import full_factorial_2level

# Standard generators for common designs
# Key: (k, n_runs) → list of generator expressions as column index lists
# Each generator element is a list of 0-based indices whose product gives the new column
GENERATORS: dict = {
    # k=4, n=8: 2^(4-1) IV, D=ABC
    (4, 8): {"gens": [[0, 1, 2]], "resolution": "IV",
              "label": "2^(4-1) Half Fraction",
              "detail": "8 runs, generator D=ABC. Resolution IV – main effects clear of 2FIs."},

    # k=5, n=16: 2^(5-1) V, E=ABCD
    (5, 16): {"gens": [[0, 1, 2, 3]], "resolution": "V",
               "label": "2^(5-1) Half Fraction",
               "detail": "16 runs, generator E=ABCD. Resolution V – all main effects and 2FIs estimable."},

    # k=5, n=8: 2^(5-2) III, D=AB E=AC
    (5, 8): {"gens": [[0, 1], [0, 2]], "resolution": "III",
              "label": "2^(5-2) Quarter Fraction",
              "detail": "8 runs, generators D=AB, E=AC. Resolution III – screening only."},

    # k=6, n=16: 2^(6-2) IV, E=ABC F=BCD
    (6, 16): {"gens": [[0, 1, 2], [1, 2, 3]], "resolution": "IV",
               "label": "2^(6-2) Quarter Fraction",
               "detail": "16 runs, generators E=ABC, F=BCD. Resolution IV."},

    # k=6, n=8: 2^(6-3) III, D=AB E=AC F=BC
    (6, 8): {"gens": [[0, 1], [0, 2], [1, 2]], "resolution": "III",
              "label": "2^(6-3) Eighth Fraction",
              "detail": "8 runs, generators D=AB, E=AC, F=BC. Resolution III – screening."},

    # k=7, n=16: 2^(7-3) IV, E=ABC F=ABD G=ACD
    (7, 16): {"gens": [[0, 1, 2], [0, 1, 3], [0, 2, 3]], "resolution": "IV",
               "label": "2^(7-3) Eighth Fraction",
               "detail": "16 runs, generators E=ABC, F=ABD, G=ACD. Resolution IV."},

    # k=7, n=8: 2^(7-4) III
    (7, 8): {"gens": [[0, 1], [0, 2], [1, 2], [0, 1, 2]], "resolution": "III",
              "label": "2^(7-4) 1/16 Fraction",
              "detail": "8 runs, generators D=AB, E=AC, F=BC, G=ABC. Resolution III."},

    # k=8, n=16: 2^(8-4) IV
    (8, 16): {"gens": [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]], "resolution": "IV",
               "label": "2^(8-4) 1/16 Fraction",
               "detail": "16 runs, Resolution IV – good screening for 8 factors."},
}


def _apply_generators(base: np.ndarray, gen_lists: list) -> np.ndarray:
    """Extend base factorial matrix with generated columns."""
    cols = [base]
    for gen in gen_lists:
        new_col = np.prod(base[:, gen], axis=1, keepdims=True)
        cols.append(new_col)
    return np.hstack(cols)


def get_fractional_design(k: int, prefer_small: bool = False) -> dict:
    """
    Return the best fractional factorial for k factors.
    prefer_small=True: use fewer runs (lower resolution).
    """
    if k <= 3:
        matrix = full_factorial_2level(k)
        return {
            "matrix": matrix.tolist(),
            "run_types": ["Factorial"] * len(matrix),
            "design_type": f"2^{k} Full Factorial",
            "resolution": "Full",
            "n_runs": len(matrix),
            "n_factorial": len(matrix),
            "n_axial": 0,
            "n_center": 0,
            "description": f"Full 2^{k} factorial with {len(matrix)} runs. All main effects and interactions estimable."
        }

    # Pick design from lookup table
    sizes = [8, 16] if not prefer_small else [8, 16]
    chosen = None
    for n in (sizes if not prefer_small else reversed(sizes)):
        if (k, n) in GENERATORS:
            chosen = (k, n)
            break

    if chosen is None:
        # Fallback: use largest available base
        for base_k in sorted([ck for (ck, _) in GENERATORS.keys()], reverse=True):
            if base_k <= k:
                n = max(n for (ck, n) in GENERATORS if ck == base_k)
                chosen = (base_k, n)
                break

    if chosen is None:
        # If no exact match, use 2^(floor(k/2)) base
        base_k = max(2, k // 2 + k % 2)
        matrix = full_factorial_2level(base_k)
        # Extend greedily
        extra = k - base_k
        gens = [[i % base_k, (i + 1) % base_k] for i in range(extra)]
        matrix = _apply_generators(matrix, gens)
        return {
            "matrix": matrix.tolist(),
            "run_types": ["Factorial"] * len(matrix),
            "design_type": f"Custom Fractional Factorial ({len(matrix)} runs)",
            "resolution": "III",
            "n_runs": len(matrix),
            "n_factorial": len(matrix),
            "n_axial": 0,
            "n_center": 0,
            "description": "Custom fractional factorial generated for this factor count."
        }

    ck, n = chosen
    info = GENERATORS[(ck, n)]
    base = full_factorial_2level(ck)
    gens = info["gens"][:k - ck]  # only as many generators as needed
    matrix = _apply_generators(base, gens)

    return {
        "matrix": matrix.tolist(),
        "run_types": ["Factorial"] * len(matrix),
        "design_type": info["label"],
        "resolution": f"Resolution {info['resolution']}",
        "n_runs": len(matrix),
        "n_factorial": len(matrix),
        "n_axial": 0,
        "n_center": 0,
        "description": info["detail"]
    }
