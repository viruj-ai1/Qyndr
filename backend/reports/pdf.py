# ============================================================
#  reports/pdf.py  –  PDF Report Generation (ReportLab)
# ============================================================
import io, os
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


INDIGO = colors.HexColor("#6366f1")
CYAN   = colors.HexColor("#06b6d4")
DARK   = colors.HexColor("#1e1b4b")
LIGHT  = colors.HexColor("#eef2ff")
GRAY   = colors.HexColor("#64748b")
GREEN  = colors.HexColor("#10b981")
RED    = colors.HexColor("#ef4444")


def build_pdf_report(project: dict, factors: list, responses: list,
                      experiments: list, analyses: list,
                      optimum: dict, gp_iterations: list) -> bytes:
    """Generate a complete PDF report and return as bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2.5*cm, bottomMargin=2*cm
    )
    styles = getSampleStyleSheet()
    story  = []

    # ── Custom styles ────────────────────────────────────────
    H1 = ParagraphStyle("H1", parent=styles["Heading1"],
                         textColor=DARK, fontSize=22, spaceAfter=6)
    H2 = ParagraphStyle("H2", parent=styles["Heading2"],
                         textColor=INDIGO, fontSize=14, spaceBefore=12, spaceAfter=4)
    H3 = ParagraphStyle("H3", parent=styles["Heading3"],
                         textColor=DARK, fontSize=11, spaceBefore=8, spaceAfter=3)
    BODY = ParagraphStyle("Body", parent=styles["Normal"],
                           fontSize=9, textColor=colors.HexColor("#374151"), leading=14)
    LABEL = ParagraphStyle("Label", parent=styles["Normal"],
                            fontSize=8, textColor=GRAY)

    def hr():
        return HRFlowable(width="100%", thickness=1, color=INDIGO, spaceAfter=6, spaceBefore=6)

    def section(title):
        story.append(Spacer(1, 0.3*cm))
        story.append(Paragraph(title, H2))
        story.append(hr())

    # ── Cover Page ───────────────────────────────────────────
    story.append(Spacer(1, 1.5*cm))
    story.append(Paragraph("VIRUJ PHARMA", ParagraphStyle(
        "Brand", parent=styles["Normal"], fontSize=10, textColor=INDIGO,
        alignment=TA_CENTER, spaceAfter=4, fontName="Helvetica-Bold"
    )))
    story.append(Paragraph("DOE Workflow Studio", ParagraphStyle(
        "Sub", parent=styles["Normal"], fontSize=9, textColor=GRAY,
        alignment=TA_CENTER, spaceAfter=16
    )))
    story.append(Paragraph("EXPERIMENTAL OPTIMIZATION REPORT", ParagraphStyle(
        "Title", parent=styles["Normal"], fontSize=20, textColor=DARK,
        alignment=TA_CENTER, fontName="Helvetica-Bold", spaceAfter=8
    )))
    story.append(Paragraph(project.get("name", ""), ParagraphStyle(
        "ProjName", parent=styles["Normal"], fontSize=16, textColor=INDIGO,
        alignment=TA_CENTER, spaceAfter=4
    )))
    if project.get("compound"):
        story.append(Paragraph(f"Compound: {project['compound']}", ParagraphStyle(
            "Comp", parent=styles["Normal"], fontSize=11, textColor=GRAY,
            alignment=TA_CENTER, spaceAfter=4
        )))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y  %H:%M')}", ParagraphStyle(
        "Date", parent=styles["Normal"], fontSize=9, textColor=GRAY, alignment=TA_CENTER
    )))
    story.append(Spacer(1, 0.8*cm))
    story.append(hr())

    # ── 1. Project Overview ──────────────────────────────────
    section("1. Project Overview")
    meta = [
        ["Project Name",  Paragraph(project.get("name", "") or "", BODY)],
        ["Compound",      Paragraph(project.get("compound", "") or "", BODY)],
        ["Objective",     Paragraph(project.get("objective", "") or "", BODY)],
        ["DOE Type",      Paragraph(project.get("doe_type", "") or "", BODY)],
        ["Bayes Iters",   str(project.get("bayes_iter", 0))],
    ]
    t = Table(meta, colWidths=[5*cm, 11*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("TEXTCOLOR",  (0, 0), (0, -1), INDIGO),
        ("FONTNAME",   (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 9),
        ("GRID",       (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, LIGHT]),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)

    if project.get("description"):
        story.append(Spacer(1, 0.3*cm))
        story.append(Paragraph("<b>Process Description:</b>", BODY))
        story.append(Paragraph(project["description"], BODY))

    # ── 2. Factors & Responses ───────────────────────────────
    section("2. Factors & Responses")
    story.append(Paragraph("<b>Process Factors</b>", H3))
    fh = ["#", "Factor Name", "Unit", "Low", "High", "Baseline"]
    fd = [fh] + [[str(i+1), f.get("name",""), f.get("unit",""),
                  str(f.get("low","")), str(f.get("high","")),
                  str(f.get("baseline",""))] for i, f in enumerate(factors)]
    ft = Table(fd, colWidths=[1*cm, 6*cm, 2*cm, 2*cm, 2*cm, 2.5*cm])
    ft.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 8),
        ("GRID",       (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.white, LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(ft)
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph("<b>Response Variables</b>", H3))
    rh = ["#", "Response", "Unit", "Goal", "Target"]
    rd = [rh] + [[str(i+1), r.get("name",""), r.get("unit",""),
                  r.get("goal","").capitalize(), str(r.get("target") or "-")]
                 for i, r in enumerate(responses)]
    rt_tbl = Table(rd, colWidths=[1*cm, 6*cm, 2*cm, 3*cm, 3.5*cm])
    rt_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), CYAN),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 8),
        ("GRID",       (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.white, colors.HexColor("#e0f7fa")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(rt_tbl)

    # ── 3. Experiment Matrix ─────────────────────────────────
    section("3. Experiment Matrix")
    if experiments:
        story.append(Paragraph(f"Total runs: {len(experiments)}", BODY))
        eh = ["Run", "Type"] + [f.get("name","") for f in factors] + [r.get("name","") for r in responses]
        ed = [eh]
        for e in experiments:
            av = e.get("actual_values", [])
            rv = e.get("result_values") or []
            row = [str(e.get("run_number","")), e.get("run_type","")]
            row += [f"{v:.4g}" if v is not None else "-" for v in av]
            row += [f"{v:.4g}" if v is not None else "—" for v in (rv if rv else [None]*len(responses))]
            ed.append(row)
        ncols  = len(eh)
        cw_run = 0.8*cm
        cw_type= 1.5*cm
        cw_rest= (16.7*cm - cw_run - cw_type) / max(ncols - 2, 1)
        col_ws = [cw_run, cw_type] + [cw_rest]*(ncols-2)
        et = Table(ed, colWidths=col_ws, repeatRows=1)
        et.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), DARK),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",   (0,0), (-1,-1), 7),
            ("GRID",       (0,0), (-1,-1), 0.3, colors.HexColor("#e5e7eb")),
            ("ROWBACKGROUNDS", (1,0), (-1,-1), [colors.white, LIGHT]),
            ("TOPPADDING", (0,0), (-1,-1), 3),
            ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ]))
        story.append(et)

    # ── 4. Statistical Analysis ──────────────────────────────
    section("4. Statistical Analysis")
    for i, a in enumerate(analyses):
        resp_name = responses[i].get("name","") if i < len(responses) else f"Response {i+1}"
        anova = a.get("anova") if isinstance(a, dict) else getattr(a, "anova", {})
        anova = anova or {}
        if isinstance(anova, dict) and anova.get("rows"):
            story.append(Paragraph(f"R² = {anova.get('R2','—')}  |  n = {anova.get('n','—')}", BODY))
            ah = ["Term", "Effect", "SS", "F-value", "p-value", "Sig."]
            ad = [ah] + [[
                row.get("term",""), f"{row.get('effect',0):.4f}",
                f"{row.get('SS',0):.4f}", f"{row.get('F',0):.2f}",
                f"{row.get('p_value',1):.4f}",
                "★" if row.get("significant") else ""
            ] for row in anova["rows"][:12]]
            at = Table(ad, colWidths=[4*cm,3*cm,3*cm,2.5*cm,2.5*cm,1.2*cm])
            at.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), INDIGO),
                ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
                ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
                ("FONTSIZE",   (0,0), (-1,-1), 8),
                ("GRID",       (0,0), (-1,-1), 0.3, colors.HexColor("#e5e7eb")),
                ("ROWBACKGROUNDS", (1,0), (-1,-1), [colors.white, LIGHT]),
                ("TOPPADDING", (0,0), (-1,-1), 3),
                ("BOTTOMPADDING",(0,0),(-1,-1), 3),
            ]))
            story.append(at)
        story.append(Spacer(1, 0.3*cm))

    # ── 5. Optimum ───────────────────────────────────────────
    if optimum:
        section("5. Optimal Process Conditions")
        ao = optimum.get("actual_optimum", [])
        opt_data = [["Factor", "Unit", "Optimal Value"]]
        for j, f in enumerate(factors):
            val = ao[j] if j < len(ao) else "-"
            opt_data.append([f.get("name",""), f.get("unit",""), f"{val:.4g}" if isinstance(val, float) else str(val)])
        ot = Table(opt_data, colWidths=[7*cm, 3*cm, 6.7*cm])
        ot.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), GREEN),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTNAME",   (0,1), (-1,-1), "Helvetica"),
            ("FONTSIZE",   (0,0), (-1,-1), 9),
            ("GRID",       (0,0), (-1,-1), 0.4, colors.HexColor("#e5e7eb")),
            ("ROWBACKGROUNDS", (1,0), (-1,-1), [colors.white, colors.HexColor("#f0fdf4")]),
            ("TOPPADDING", (0,0), (-1,-1), 5),
            ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ]))
        story.append(ot)
        D = optimum.get("composite_desirability")
        if D is not None:
            story.append(Spacer(1, 0.3*cm))
            label = "GP Predicted Optimum Value" if optimum.get("is_gp") else "Composite Desirability"
            story.append(Paragraph(f"<b>{label}: {D:.4f}</b>", BODY))

    # ── 6. Bayesian Iterations ───────────────────────────────
    if gp_iterations:
        section("6. Bayesian Optimization History")
        bh = ["Iter", "EI Score", "Predicted Mean", "Result"]
        bd = [bh] + [[
            str(g.get("iteration","")),
            f"{g.get('ei_score',0):.4f}" if g.get("ei_score") is not None else "-",
            f"{g.get('recommended',{}).get('predicted_mean','—')}",
            str(g.get("new_result","—"))
        ] for g in gp_iterations]
        bt = Table(bd, colWidths=[2*cm, 4*cm, 5*cm, 5.7*cm])
        bt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), DARK),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",   (0,0), (-1,-1), 8),
            ("GRID",       (0,0), (-1,-1), 0.3, colors.HexColor("#e5e7eb")),
            ("ROWBACKGROUNDS", (1,0), (-1,-1), [colors.white, LIGHT]),
            ("TOPPADDING", (0,0), (-1,-1), 3),
            ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ]))
        story.append(bt)

    # ── Footer note ──────────────────────────────────────────
    story.append(Spacer(1, 1*cm))
    story.append(hr())
    story.append(Paragraph(
        "Generated by Viruj Pharma DOE Workflow Studio · Confidential",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7,
                        textColor=GRAY, alignment=TA_CENTER)
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
