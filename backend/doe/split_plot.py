# ============================================================
#  doe/split_plot.py  –  Split-Plot Design Generator
# ============================================================
import numpy as np
from typing import Dict, Any, List
from doe.fractional import get_fractional_design

def generate_split_plot(k: int, factors: list = None) -> Dict[str, Any]:
    """
    Generate a Split-Plot design grouping Hard-to-Change (HTC) factors into Whole Plots.
    Minimizes factor adjustment cost by holding HTC factors constant across subplots.
    """
    # Identify HTC factors
    htc_indices = []
    if factors:
        for idx, f in enumerate(factors):
            is_htc = getattr(f, 'is_hard_to_change', False) or (isinstance(f, dict) and f.get('is_hard_to_change', False))
            if is_htc:
                htc_indices.append(idx)
    
    if not htc_indices:
        htc_indices = [0] # default first factor as HTC if none specified

    # Base design
    base_design = get_fractional_design(k)
    matrix = base_design["matrix"]
    
    # Sort matrix by HTC factor values to form Whole Plots
    matrix_np = np.array(matrix)
    sort_keys = [matrix_np[:, idx] for idx in reversed(htc_indices)]
    sorted_order = np.lexsort(tuple(sort_keys))
    sorted_matrix = matrix_np[sorted_order].tolist()

    # Assign Whole Plot numbers
    whole_plots = []
    current_wp = 1
    prev_htc_vals = None
    for row in sorted_matrix:
        htc_vals = [row[i] for i in htc_indices]
        if prev_htc_vals is not None and htc_vals != prev_htc_vals:
            current_wp += 1
        whole_plots.append(current_wp)
        prev_htc_vals = htc_vals

    run_types = [f"WholePlot_{wp}" for wp in whole_plots]

    return {
        "design_type": "Split-Plot Design",
        "resolution": base_design.get("resolution", "IV"),
        "description": f"Split-Plot design with {max(whole_plots)} Whole Plots for Hard-to-Change factors ({len(sorted_matrix)} total runs)",
        "n_runs": len(sorted_matrix),
        "n_whole_plots": max(whole_plots),
        "matrix": sorted_matrix,
        "run_types": run_types,
        "whole_plots": whole_plots
    }
