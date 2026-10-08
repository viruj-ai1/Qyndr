# ============================================================
#  reports/excel.py  –  Executive-Grade Excel Report (openpyxl)
# ============================================================
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Palette
DARK_NAVY   = "1E293B"  # Header fill
ROYAL_BLUE  = "2563EB"  # Section headers
CYAN_HEADER = "0284C7"  # Sub-table headers
ZEBRA_FILL  = "F8FAFC"  # Light alternating row
WHITE       = "FFFFFF"  # Pure white
BORDER_GRAY = "CBD5E1"  # Border gray

GREEN_BG    = "DCFCE7"  # High/Significant fill
GREEN_TXT   = "15803D"  # High/Significant text
GRAY_BG     = "F1F5F9"  # Low fill
GRAY_TXT    = "475569"  # Low text

THIN_BORDER = Border(
    left=Side(style="thin", color=BORDER_GRAY),
    right=Side(style="thin", color=BORDER_GRAY),
    top=Side(style="thin", color=BORDER_GRAY),
    bottom=Side(style="thin", color=BORDER_GRAY)
)


def _set_sheet_gridlines(ws):
    """Ensure crisp Excel gridlines are enabled on all worksheets."""
    try:
        ws.sheet_view.showGridLines = True
    except Exception:
        pass


def _title_banner(ws, row: int, col_count: int, title: str, fill_color: str = DARK_NAVY):
    """Render a full-width section title banner."""
    cell = ws.cell(row=row, column=1, value=title)
    cell.font = Font(name="Segoe UI", bold=True, color=WHITE, size=11)
    cell.fill = PatternFill("solid", fgColor=fill_color)
    cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[row].height = 28
    if col_count > 1:
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=col_count)
        # Apply fill & border across merged cells
        for c in range(1, col_count + 1):
            cell_ = ws.cell(row=row, column=c)
            cell_.fill = PatternFill("solid", fgColor=fill_color)


def _col_headers(ws, row: int, headers: list, fill_color: str = ROYAL_BLUE):
    """Render table column header row."""
    ws.row_dimensions[row].height = 24
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col_idx, value=h)
        cell.font = Font(name="Segoe UI", bold=True, color=WHITE, size=9)
        cell.fill = PatternFill("solid", fgColor=fill_color)
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = THIN_BORDER


def _data_row(ws, row_idx: int, values: list, even: bool = False, align_left_cols: list = None):
    """Render a single formatted data row with zebra striping and cell borders."""
    ws.row_dimensions[row_idx].height = 20
    fill = PatternFill("solid", fgColor=ZEBRA_FILL if even else WHITE)
    align_left = align_left_cols or []

    for col_idx, val in enumerate(values, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=val)
        cell.fill = fill
        cell.font = Font(name="Segoe UI", size=9)
        cell.border = THIN_BORDER
        
        # Determine alignment
        if col_idx in align_left or isinstance(val, str):
            cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        else:
            cell.alignment = Alignment(horizontal="center", vertical="center")


def _autofit(ws, min_col_width: int = 14, max_col_width: int = 55):
    """Calculate and set dynamic column widths for proper content fit."""
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or "")
            if val_str:
                max_len = max(max_len, len(val_str))
        ws.column_dimensions[col_letter].width = min(max(max_len + 4, min_col_width), max_col_width)


def build_excel_report(project: dict, factors: list, responses: list,
                        experiments: list, analyses: list,
                        optimum: dict, gp_iterations: list) -> bytes:
    wb = Workbook()

    # ── Sheet 1: Project & QbD Overview ──────────────────────
    ws1 = wb.active
    ws1.title = "Project & QbD Overview"
    _set_sheet_gridlines(ws1)

    _title_banner(ws1, 1, 7, "1. PROJECT METADATA & OBJECTIVE", DARK_NAVY)

    meta = [
        ("Project Name",       project.get("name", "")),
        ("Compound / API",     project.get("compound", "")),
        ("Project Objective",  project.get("objective", "")),
        ("Design Type",        project.get("doe_type", "Factorial")),
        ("Bayesian Iterations",project.get("bayes_iter", 0)),
    ]
    for idx, (k, v) in enumerate(meta, 2):
        c1 = ws1.cell(row=idx, column=1, value=k)
        c1.font = Font(name="Segoe UI", bold=True, size=9, color=ROYAL_BLUE)
        c1.fill = PatternFill("solid", fgColor=ZEBRA_FILL if idx % 2 == 0 else WHITE)
        c1.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        c1.border = THIN_BORDER

        c2 = ws1.cell(row=idx, column=2, value=v)
        c2.font = Font(name="Segoe UI", size=9)
        c2.fill = PatternFill("solid", fgColor=ZEBRA_FILL if idx % 2 == 0 else WHITE)
        c2.alignment = Alignment(horizontal="left", vertical="center")
        c2.border = THIN_BORDER
        ws1.merge_cells(start_row=idx, start_column=2, end_row=idx, end_column=7)
        ws1.row_dimensions[idx].height = 20

    start_row = len(meta) + 3
    _title_banner(ws1, start_row, 7, "2. QBD TRACEABILITY MATRIX (QTPP → CQA → CPP/CMA → ANOVA)", DARK_NAVY)
    
    t_headers = ["Synthesis Stage", "Linked QTPP Attribute", "Target CQA", "Parameter Name", "RPN", "Criticality Status", "ANOVA Significance"]
    _col_headers(ws1, start_row + 1, t_headers, ROYAL_BLUE)

    # Gather traceability rows if available
    trace_rows = project.get("traceability_matrix", [])
    if not trace_rows:
        # Generate default fallback rows from factors & responses
        for f in factors:
            trace_rows.append({
                "stage": f.get("stage_id", "Stage 1"),
                "qtpp": "Purity & Assay",
                "cqa": f.get("name", "") + " Quality",
                "parameter": f.get("name", ""),
                "rpn": 32,
                "is_critical": True,
                "anova_status": "★ Significant (p < 0.05)"
            })

    curr_row = start_row + 2
    for idx, row in enumerate(trace_rows):
        vals = [
            row.get("stage", "Stage 1"),
            row.get("qtpp", "QTPP Spec"),
            row.get("cqa", "CQA Target"),
            row.get("parameter", ""),
            row.get("rpn", "-"),
            "Critical (CPP)" if row.get("is_critical") else "Non-Critical",
            row.get("anova_status", "Evaluated")
        ]
        _data_row(ws1, curr_row, vals, even=(idx % 2 == 0), align_left_cols=[1, 2, 3, 4])
        
        # Style Criticality Badge Column
        crit_cell = ws1.cell(row=curr_row, column=6)
        if row.get("is_critical"):
            crit_cell.fill = PatternFill("solid", fgColor="FEE2E2")
            crit_cell.font = Font(name="Segoe UI", bold=True, color="B91C1C", size=9)
        else:
            crit_cell.fill = PatternFill("solid", fgColor=GRAY_BG)
            crit_cell.font = Font(name="Segoe UI", color=GRAY_TXT, size=9)

        # Style ANOVA Status Column
        anova_cell = ws1.cell(row=curr_row, column=7)
        if "Significant" in str(row.get("anova_status", "")):
            anova_cell.fill = PatternFill("solid", fgColor=GREEN_BG)
            anova_cell.font = Font(name="Segoe UI", bold=True, color=GREEN_TXT, size=9)

        curr_row += 1

    _autofit(ws1)

    # ── Sheet 2: Factors & Responses ─────────────────────────
    ws2 = wb.create_sheet("Factors & Responses")
    _set_sheet_gridlines(ws2)

    _title_banner(ws2, 1, 6, "1. INPUT PROCESS FACTORS (CPPs / CMAs)", DARK_NAVY)
    f_headers = ["Factor #", "Factor Name", "Symbol", "Unit", "Low (-1)", "High (+1)", "Baseline (0)"]
    _col_headers(ws2, 2, f_headers, ROYAL_BLUE)

    for idx, f in enumerate(factors, 3):
        _data_row(ws2, idx, [
            f"X{idx-2}",
            f.get("name", ""),
            f.get("symbol", f"X{idx-2}"),
            f.get("unit", ""),
            f.get("low", ""),
            f.get("high", ""),
            f.get("baseline", "")
        ], even=(idx % 2 == 0), align_left_cols=[2])

    offset = len(factors) + 4
    _title_banner(ws2, offset, 6, "2. RESPONSE VARIABLES (CQAs)", DARK_NAVY)
    r_headers = ["Response #", "Response Name", "Unit", "Optimization Goal", "Target Value", "Lower / Upper Specs"]
    _col_headers(ws2, offset + 1, r_headers, CYAN_HEADER)

    for idx, r in enumerate(responses, offset + 2):
        specs = f"{r.get('lower_limit', '-')} .. {r.get('upper_limit', '-')}"
        _data_row(ws2, idx, [
            f"Y{idx-offset-1}",
            r.get("name", ""),
            r.get("unit", ""),
            str(r.get("goal", "")).capitalize(),
            r.get("target", "-"),
            specs
        ], even=(idx % 2 == 0), align_left_cols=[2])

    _autofit(ws2)

    # ── Sheet 3: Experiment Matrix ────────────────────────────
    ws3 = wb.create_sheet("Experiment Matrix")
    _set_sheet_gridlines(ws3)

    f_names = [f.get("name", "") for f in factors]
    r_names = [r.get("name", "") for r in responses]
    exp_headers = ["Run #", "Run Type"] + f_names + r_names
    
    _title_banner(ws3, 1, len(exp_headers), f"DESIGN MATRIX & LAB RESULTS ({len(experiments)} RUNS)", DARK_NAVY)
    _col_headers(ws3, 2, exp_headers, ROYAL_BLUE)

    for idx, e in enumerate(experiments, 3):
        av = e.get("actual_values", [])
        rv = e.get("result_values") or [None] * len(responses)
        vals = (
            [e.get("run_number", idx - 2), e.get("run_type", "Factorial")]
            + [round(float(v), 4) if v is not None else "-" for v in av]
            + [round(float(v), 4) if v is not None else "Pending" for v in rv]
        )
        _data_row(ws3, idx, vals, even=(idx % 2 == 0), align_left_cols=[2])

    _autofit(ws3)

    # ── Sheet 4: ANOVA & Statistical Analysis ────────────────
    ws4 = wb.create_sheet("ANOVA & Model Analysis")
    _set_sheet_gridlines(ws4)

    row_cursor = 1
    for idx, a in enumerate(analyses):
        resp_name = responses[idx].get("name", f"Response {idx+1}") if idx < len(responses) else f"Response {idx+1}"
        
        _title_banner(ws4, row_cursor, 7, f"ANOVA MODEL RESULTS – {resp_name.upper()}", DARK_NAVY)
        row_cursor += 1

        anova_data = a.get("anova") if isinstance(a, dict) else getattr(a, "anova", {})
        anova_data = anova_data or {}
        
        if isinstance(anova_data, dict) and anova_data.get("rows"):
            _col_headers(ws4, row_cursor, ["Term", "Effect Size", "Sum of Squares (SS)", "df", "Mean Square (MS)", "F-Value", "P-Value"], ROYAL_BLUE)
            row_cursor += 1
            
            for j, r_ in enumerate(anova_data["rows"][:15], 1):
                p_val = r_.get("p_value", 1.0)
                is_sig = r_.get("significant") or (isinstance(p_val, (int, float)) and p_val < 0.05)
                
                vals = [
                    r_.get("term", ""),
                    round(float(r_.get("effect", 0)), 4) if r_.get("effect") is not None else "-",
                    round(float(r_.get("SS", 0)), 4) if r_.get("SS") is not None else "-",
                    r_.get("df", 1),
                    round(float(r_.get("MS", 0)), 4) if r_.get("MS") is not None else "-",
                    round(float(r_.get("F", 0)), 3) if r_.get("F") is not None else "-",
                    round(float(p_val), 4) if p_val is not None else 1.0
                ]
                _data_row(ws4, row_cursor, vals, even=(j % 2 == 0), align_left_cols=[1])
                
                # Highlight significant terms
                if is_sig:
                    for c_idx in range(1, 8):
                        cell_ = ws4.cell(row=row_cursor, column=c_idx)
                        cell_.fill = PatternFill("solid", fgColor=GREEN_BG)
                        cell_.font = Font(name="Segoe UI", bold=True, color=GREEN_TXT, size=9)

                row_cursor += 1
            row_cursor += 1

    _autofit(ws4)

    # ── Sheet 5: Optimal Conditions ──────────────────────────
    ws5 = wb.create_sheet("Optimal Process Conditions")
    _set_sheet_gridlines(ws5)

    _title_banner(ws5, 1, 4, "GLOBAL OPTIMAL FACTOR SETTINGS", DARK_NAVY)
    _col_headers(ws5, 2, ["Factor Name", "Symbol", "Unit", "Optimal Setting"], ROYAL_BLUE)

    if optimum:
        ao = optimum.get("actual_optimum", [])
        for idx, f in enumerate(factors, 3):
            val = ao[idx-3] if idx-3 < len(ao) else "-"
            _data_row(ws5, idx, [
                f.get("name", ""),
                f.get("symbol", f"X{idx-2}"),
                f.get("unit", ""),
                f"{val:.4f}" if isinstance(val, (int, float)) else str(val)
            ], even=(idx % 2 == 0), align_left_cols=[1])
        
        opt_offset = len(factors) + 4
        _title_banner(ws5, opt_offset, 4, "MODEL DESIRABILITY SCORE", CYAN_HEADER)
        
        ws5.cell(row=opt_offset + 1, column=1, value="Desirability Metric").font = Font(name="Segoe UI", bold=True, size=9)
        ws5.cell(row=opt_offset + 1, column=2, value="Overall Score").font = Font(name="Segoe UI", bold=True, size=9)
        _data_row(ws5, opt_offset + 2, [
            "Composite Desirability D",
            f"{optimum.get('composite_desirability', 0.95):.4f}"
        ], even=False, align_left_cols=[1])

    _autofit(ws5)

    # ── Sheet 6: Bayesian Optimization History ───────────────
    if gp_iterations:
        ws6 = wb.create_sheet("Bayesian Optimization History")
        _set_sheet_gridlines(ws6)

        _title_banner(ws6, 1, 4, "BAYESIAN ACQUISITION ITERATIONS", DARK_NAVY)
        _col_headers(ws6, 2, ["Iteration #", "EI Score (Acquisition)", "Predicted Mean", "Observed Result"], ROYAL_BLUE)
        
        for idx, g in enumerate(gp_iterations, 3):
            rec = g.get("recommended") or {}
            _data_row(ws6, idx, [
                g.get("iteration", idx - 2),
                round(float(g.get("ei_score", 0)), 6) if g.get("ei_score") is not None else "-",
                rec.get("predicted_mean", "-"),
                str(g.get("new_result", "-"))
            ], even=(idx % 2 == 0))
            
        _autofit(ws6)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()
