import sys
import os
import pytest
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from services.bayesian_service import get_final_combined_optimum


def test_get_final_combined_optimum_improves_with_bayesian_run():
    factors = [
        {"name": "Temp", "low": 20.0, "high": 80.0, "baseline": 50.0, "unit": "°C"},
        {"name": "Ratio", "low": 20.0, "high": 80.0, "baseline": 50.0, "unit": "eq"},
        {"name": "Catalyst", "low": 20.0, "high": 80.0, "baseline": 50.0, "unit": "eq"},
        {"name": "HoldTime", "low": 20.0, "high": 80.0, "baseline": 50.0, "unit": "h"}
    ]

    responses = [
        {"name": "Purity", "goal": "maximize", "lower_limit": None, "upper_limit": None, "target": 97.0, "weight": 1.0},
        {"name": "Impurity", "goal": "minimize", "lower_limit": None, "upper_limit": None, "target": 0.05, "weight": 1.0},
        {"name": "Yield", "goal": "maximize", "lower_limit": None, "upper_limit": None, "target": 85.0, "weight": 1.0}
    ]

    # 12 initial DOE runs where hold time was not varied
    experiments = [
        {"actual_values": [80.0, 80.0, 20.0], "result_values": [95.0, 1.0, 87.0]},
        {"actual_values": [20.0, 80.0, 80.0], "result_values": [96.0, 2.0, 88.0]},
        {"actual_values": [80.0, 20.0, 80.0], "result_values": [91.0, 3.0, 95.0]},
        {"actual_values": [20.0, 80.0, 20.0], "result_values": [92.0, 4.0, 94.0]},
        {"actual_values": [20.0, 20.0, 80.0], "result_values": [89.0, 5.0, 96.0]},
        {"actual_values": [20.0, 20.0, 20.0], "result_values": [90.0, 7.0, 90.0]},
        {"actual_values": [80.0, 20.0, 20.0], "result_values": [99.0, 8.0, 99.0]},
        {"actual_values": [80.0, 80.0, 20.0], "result_values": [91.0, 9.0, 92.0]},
        {"actual_values": [80.0, 80.0, 80.0], "result_values": [99.0, 1.0, 99.0]},
        {"actual_values": [20.0, 80.0, 80.0], "result_values": [87.0, 13.0, 100.0]},
        {"actual_values": [80.0, 20.0, 80.0], "result_values": [85.0, 15.0, 98.0]},
        {"actual_values": [20.0, 20.0, 20.0], "result_values": [90.0, 10.0, 89.0]},
        # Run 13: Bayesian run exploring Hold Time = 37.14h with high performance
        {"actual_values": [80.0, 80.0, 80.0, 37.1429], "result_values": [100.0, 0.0, 100.0]}
    ]

    res = get_final_combined_optimum(experiments, responses, factors)

    assert "error" not in res
    assert res["n_obs"] == 13
    assert len(res["actual_optimum"]) == 4
    assert len(res["predicted_responses"]) == 3
    # Desirability should be high (> 0.85, up from 0.777)
    assert res["composite_desirability"] > 0.85
    # Predicted purity should be near 99%
    assert res["predicted_responses"][0] > 98.0
    # Impurity should be low (< 1.5%)
    assert res["predicted_responses"][1] < 1.5
    # Yield should be high (> 98%)
    assert res["predicted_responses"][2] > 98.0
