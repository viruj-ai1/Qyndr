# ============================================================
#  optimization/desirability.py  –  Derringer-Suich Desirability
# ============================================================
import numpy as np
from typing import List, Dict, Any


def individual_desirability(y: float, goal: str,
                             y_min: float, y_max: float,
                             target: float = None,
                             weight: float = 1.0,
                             lower_limit: float = None,
                             upper_limit: float = None) -> float:
    """
    Compute individual desirability d ∈ [0, 1] for one response.
    goal: 'maximize' | 'minimize' | 'target'
    """
    lo  = lower_limit if lower_limit is not None else y_min
    hi  = upper_limit if upper_limit is not None else y_max
    rng = hi - lo if (hi - lo) > 1e-12 else 1.0

    if goal == "maximize":
        d = max(0.0, min(1.0, (y - lo) / rng)) ** weight

    elif goal == "minimize":
        d = max(0.0, min(1.0, (hi - y) / rng)) ** weight

    else:  # target
        tgt = target if target is not None else (lo + hi) / 2
        if y < lo or y > hi:
            d = 0.0
        elif y <= tgt:
            d = ((y - lo) / max(tgt - lo, 1e-12)) ** weight
        else:
            d = ((hi - y) / max(hi - tgt, 1e-12)) ** weight

    return float(np.clip(d, 0.0, 1.0))


def composite_desirability(desirabilities: List[float],
                            weights: List[float] = None) -> float:
    """Geometric mean: D = (d1^w1 · d2^w2 · ... · dk^wk)^(1/sum(w))"""
    if not desirabilities:
        return 0.0
    w = weights if weights else [1.0] * len(desirabilities)
    total_w = sum(w)
    d_prod  = np.prod([max(d, 1e-12) ** wi for d, wi in zip(desirabilities, w)])
    return float(d_prod ** (1.0 / total_w))
