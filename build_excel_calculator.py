"""
Generates a 100% macro-free, live-formula Excel workbook (.xlsx) for
Switchgear Thermal, Heat Loss & Switchroom Cooling Calculation (IEC 60439 / 61439).

Sheets (9 tabs, zero macros):
  00_Simple_Mode           - Rapid crude assessment (few inputs) feeding Detailed Mode defaults
  01_Summary               - Executive Dashboard, Simple/Detailed Switch, 4-Scenario Table & Chart
  02_Board_&_Busbars       - System Config, Material Table, Main HBB & Vertical Busbar Joule Physics
  03_Feeder_Schedule       - Columns + Multi-Tier Starters, Eaton HRC Fuses (2A-1250A) & Interconnector
  04_Busbar_Segments       - PROTECTED Calculation Engine (formulas hidden & uncopyable; password: CEI)
  05_GA_Heat_Map           - PROTECTED Visual Block General Arrangement Elevation w/ Thermal Heatmap
  06_Device_&_Fuse_Library - Editable IEC & Eaton Bussmann NH gG HRC Fuse (2A-1250A) Catalog
  07_Room_Ventilation      - Switchroom Size (e.g. 5x5x9m), Airflow, ACH & Natural vs Mechanical Verdict
  08_Calc_Help_&_Method    - Full Calculation Methodology, Worked Examples & Abbreviation Glossary
"""

import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, Protection
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.formatting.rule import ColorScaleRule, CellIsRule
from openpyxl.chart import BarChart, Reference

OUTPUT_PATH = r"g:\My Drive\Personal & Life\Projects\CE&I\Switchgear_Heat_Loss_Calculator.xlsx"
PROTECT_PASSWORD = "CEI"

# --- Styling Palette ---
FONT_FAMILY = "Calibri"

NAVY_DARK = "0F172A"
NAVY_MED = "1E3A5F"
SLATE_SUB = "334155"
INPUT_BG = "DBEAFE"
INPUT_FG = "1E3A8A"
CALC_BG = "FFFFFF"
ZEBRA_BG = "F8FAFC"
TOTAL_BG = "E2E8F0"
HERO_BG = "FEF3C7"
HERO_FG = "92400E"
WARN_BG = "FEE2E2"
WARN_FG = "991B1B"
OK_BG = "DCFCE7"
OK_FG = "166534"

THIN_SIDE = Side(style="thin", color="CBD5E1")
MED_NAVY_SIDE = Side(style="medium", color="1E3A5F")
DOUBLE_BOTTOM_SIDE = Side(style="double", color="0F172A")

BORDER_CELL = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=THIN_SIDE)
BORDER_TOTAL = Border(left=THIN_SIDE, right=THIN_SIDE, top=MED_NAVY_SIDE, bottom=DOUBLE_BOTTOM_SIDE)

FILL_TITLE = PatternFill("solid", fgColor=NAVY_DARK)
FILL_SECTION = PatternFill("solid", fgColor=NAVY_MED)
FILL_HEADER = PatternFill("solid", fgColor=SLATE_SUB)
FILL_INPUT = PatternFill("solid", fgColor=INPUT_BG)
FILL_ZEBRA = PatternFill("solid", fgColor=ZEBRA_BG)
FILL_WHITE = PatternFill("solid", fgColor=CALC_BG)
FILL_TOTAL = PatternFill("solid", fgColor=TOTAL_BG)
FILL_HERO = PatternFill("solid", fgColor=HERO_BG)
FILL_OK = PatternFill("solid", fgColor=OK_BG)
FILL_WARN = PatternFill("solid", fgColor=WARN_BG)

FONT_TITLE = Font(name=FONT_FAMILY, size=14, bold=True, color="FFFFFF")
FONT_SUBTITLE = Font(name=FONT_FAMILY, size=10, italic=True, color="CBD5E1")
FONT_SECTION = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
FONT_HEADER = Font(name=FONT_FAMILY, size=10, bold=True, color="FFFFFF")
FONT_INPUT = Font(name=FONT_FAMILY, size=10, bold=True, color=INPUT_FG)
FONT_CALC = Font(name=FONT_FAMILY, size=10, bold=False, color="0F172A")
FONT_CALC_BOLD = Font(name=FONT_FAMILY, size=10, bold=True, color="0F172A")
FONT_LINK = Font(name=FONT_FAMILY, size=10, bold=False, color="166534")
FONT_HINT = Font(name=FONT_FAMILY, size=9, italic=True, color="475569")
FONT_HERO_VAL = Font(name=FONT_FAMILY, size=15, bold=True, color=HERO_FG)
FONT_HERO_LBL = Font(name=FONT_FAMILY, size=9, bold=True, color="475569")
FONT_TOTAL = Font(name=FONT_FAMILY, size=10, bold=True, color="0F172A")

ALIGN_L = Alignment(horizontal="left", vertical="center", wrap_text=True)
ALIGN_C = Alignment(horizontal="center", vertical="center", wrap_text=True)
ALIGN_R = Alignment(horizontal="right", vertical="center", wrap_text=True)

PROT_UNLOCKED = Protection(locked=False, hidden=False)
PROT_LOCKED_VISIBLE = Protection(locked=True, hidden=False)
PROT_LOCKED_HIDDEN = Protection(locked=True, hidden=True)


def add_comment(cell, text, width=330, height=135):
    c = Comment(text, "CE&I Thermal Calc")
    c.width = width
    c.height = height
    cell.comment = c


def style_title_banner(ws, max_col, title, subtitle):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=max_col)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=max_col)
    c1 = ws.cell(1, 1, title)
    c1.font = FONT_TITLE; c1.fill = FILL_TITLE; c1.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    c2 = ws.cell(2, 1, subtitle)
    c2.font = FONT_SUBTITLE; c2.fill = FILL_TITLE; c2.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 28
    ws.row_dimensions[2].height = 18


def style_section_bar(ws, row, col_start, col_end, text):
    ws.merge_cells(start_row=row, start_column=col_start, end_row=row, end_column=col_end)
    c = ws.cell(row, col_start, text)
    c.font = FONT_SECTION; c.fill = FILL_SECTION; c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[row].height = 22


def configure_print(ws, landscape=True, fit_width=1, fit_height=0, repeat_rows=None):
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE if landscape else ws.ORIENTATION_PORTRAIT
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = fit_width
    ws.page_setup.fitToHeight = fit_height
    if repeat_rows:
        ws.print_title_rows = repeat_rows
    ws.views.sheetView[0].showGridLines = True


def apply_sheet_protection(ws, strict_calc_sheet=False):
    """
    Protects formulas on every sheet while leaving blue input cells unlocked.
    On strict_calc_sheet (04_Busbar_Segments & 05_GA_Heat_Map), formulas are ALSO
    hidden and locked cells cannot be selected/copied (preventing copying & tampering).
    """
    for row in ws.iter_rows():
        for cell in row:
            if strict_calc_sheet:
                cell.protection = PROT_LOCKED_HIDDEN
            else:
                # Blue input cells (FILL_INPUT) remain unlocked; everything else locked
                if cell.fill and cell.fill.fgColor and cell.fill.fgColor.rgb and cell.fill.fgColor.rgb.endswith(INPUT_BG):
                    cell.protection = PROT_UNLOCKED
                else:
                    cell.protection = PROT_LOCKED_VISIBLE

    ws.protection.sheet = True
    ws.protection.set_password(PROTECT_PASSWORD)
    # Note: In OOXML / openpyxl SheetProtection, True = PROHIBITED (protected), False = ALLOWED.
    ws.protection.selectUnlockedCells = False            # Allow selecting blue input cells
    ws.protection.selectLockedCells = strict_calc_sheet  # Prohibit selecting/copying locked cells on strict calc sheets
    ws.protection.formatCells = True                     # Prohibit changing cell formatting
    ws.protection.formatColumns = True
    ws.protection.formatRows = True
    ws.protection.insertRows = True
    ws.protection.deleteRows = True


def build_library_data():
    """Returns full Device, Starter, and Eaton Bussmann NH gG HRC Fuse (2A-1250A) catalog (no ~ wildcards)."""
    items = [
        ("ACB 800A Drawout (3P/4P)", "ACB", "Incomer", 800, 110.0, 12.0, "quadratic", 700, "Generic IEC 60947-2 Air Circuit Breaker + electronic trip unit"),
        ("ACB 1600A Drawout (3P/4P)", "ACB", "Incomer", 1600, 260.0, 15.0, "quadratic", 750, "Generic 1600A Drawout Air Circuit Breaker"),
        ("ACB 2500A Drawout (3P/4P)", "ACB", "Incomer", 2500, 480.0, 18.0, "quadratic", 850, "Generic 2500A Drawout Air Circuit Breaker"),
        ("ACB 3200A Drawout (3P/4P)", "ACB", "Incomer", 3200, 680.0, 20.0, "quadratic", 900, "Generic 3200A Drawout Air Circuit Breaker"),
        ("Bus-Section Coupler ACB 2500A", "ACB", "Bus Coupler", 2500, 440.0, 15.0, "quadratic", 850, "Bus-section coupler ACB between Section A and Section B"),
        ("Interconnector ACB 1600A (Firm Supply)", "ACB", "Interconnector", 1600, 260.0, 15.0, "quadratic", 850, "Outgoing Interconnector ACB supplying partner B-Side switchboard"),

        ("MCCB 100A (3P Thermal-Mag)", "MCCB", "Feeder", 100, 24.0, 0.0, "quadratic", 200, "Generic 100A Moulded Case Circuit Breaker (~8W/pole)"),
        ("MCCB 160A (3P Electronic)", "MCCB", "Feeder", 160, 30.0, 2.0, "quadratic", 220, "Generic 160A Moulded Case Circuit Breaker (~10W/pole)"),
        ("MCCB 250A (3P Electronic)", "MCCB", "Feeder", 250, 42.0, 2.0, "quadratic", 260, "Generic 250A Moulded Case Circuit Breaker (~14W/pole)"),
        ("MCCB 400A (3P Electronic)", "MCCB", "Feeder", 400, 66.0, 3.0, "quadratic", 320, "Generic 400A Moulded Case Circuit Breaker (~22W/pole)"),
        ("MCCB 630A (3P Electronic)", "MCCB", "Feeder", 630, 114.0, 4.0, "quadratic", 400, "Generic 630A Moulded Case Circuit Breaker (~38W/pole)"),
        ("MCCB 800A (3P Electronic)", "MCCB", "Feeder", 800, 165.0, 5.0, "quadratic", 450, "Generic 800A Moulded Case Circuit Breaker (~55W/pole)"),
        ("MCB 63A (3P Miniature Breaker)", "MCB", "Feeder", 63, 16.0, 0.0, "quadratic", 160, "Generic 63A 3-Pole Miniature Circuit Breaker (~5.3W/pole)"),

        ("DOL Starter 7.5 kW (25A frame)", "DOL Starter", "Feeder", 25, 18.0, 9.0, "quadratic", 200, "Direct-On-Line: MPCB + Contactor poles/coil + Overload + Aux"),
        ("DOL Starter 15 kW (40A frame)", "DOL Starter", "Feeder", 40, 27.0, 12.0, "quadratic", 220, "Direct-On-Line: MCCB + 40A Contactor + Overload + Control"),
        ("DOL Starter 22 kW (63A frame)", "DOL Starter", "Feeder", 63, 36.0, 15.0, "quadratic", 260, "Direct-On-Line: MCCB + 65A Contactor + Overload + Control"),
        ("DOL Starter 37 kW (100A frame)", "DOL Starter", "Feeder", 100, 55.0, 18.0, "quadratic", 300, "Direct-On-Line: MCCB 100A + 95A Contactor + Electronic O/L + Aux"),
        ("DOL Starter 55 kW (160A frame)", "DOL Starter", "Feeder", 160, 78.0, 22.0, "quadratic", 350, "Direct-On-Line: MCCB 160A + 150A Contactor + O/L + Aux"),
        ("Star-Delta Starter 75 kW (200A frame)", "Star-Delta Starter", "Feeder", 200, 108.0, 34.0, "quadratic", 450, "MCCB + Main & Delta Contactors (Run mode) + O/L + Timer"),
        ("Soft Starter 30 kW (Bypassed, 80A)", "Soft Starter", "Feeder", 80, 36.0, 25.0, "quadratic", 350, "MCCB + Internal bypass contactor poles + electronics/fan"),
        ("VSD / Inverter Drive 15 kW (3% loss)", "VSD / Inverter", "Feeder", 32, 450.0, 35.0, "vsd", 400, "Variable Speed Drive: Input MCCB + IGBT power stage + fan"),
        ("VSD / Inverter Drive 45 kW (2.8% loss)", "VSD / Inverter", "Feeder", 90, 1260.0, 65.0, "vsd", 600, "Variable Speed Drive: Input MCCB + IGBT power stage + fan"),

        ("Spare Space / Blank Reserve Bay (0W)", "Spare Space", "Spare / Placeholder", 1, 0.0, 0.0, "quadratic", 250, "Physical reserve space occupying GA height (0 A, 0 W)"),
        ("Placeholder Bay (0W)", "Placeholder", "Spare / Placeholder", 1, 0.0, 0.0, "quadratic", 300, "Undefined future equipment placeholder (0 A, 0 W)"),
        ("Metering / Marshalling Chamber (15W)", "Chamber / Aux", "Spare / Placeholder", 1, 0.0, 15.0, "quadratic", 300, "Control/metering compartment with 15 W fixed auxiliary heat"),
    ]

    eaton_fuses = [
        ("2NHG000B",   "NH000", 2,    3.9,   0.6,  160),
        ("4NHG000B",   "NH000", 4,    1.8,   0.6,  160),
        ("6NHG000B",   "NH000", 6,    2.0,   0.9,  160),
        ("10NHG000B",  "NH000", 10,   1.5,   1.2,  160),
        ("16NHG000B",  "NH000", 16,   2.3,   1.5,  160),
        ("16NHG0B",    "NH0",   16,   3.0,   1.5,  180),
        ("20NHG000B",  "NH000", 20,   2.6,   1.8,  160),
        ("25NHG000B",  "NH000", 25,   3.1,   2.1,  160),
        ("32NHG000B",  "NH000", 32,   3.4,   2.4,  160),
        ("35NHG000B",  "NH000", 35,   3.6,   2.7,  160),
        ("40NHG000B",  "NH000", 40,   3.9,   3.0,  180),
        ("50NHG000B",  "NH000", 50,   4.2,   3.6,  180),
        ("63NHG000B",  "NH000", 63,   4.6,   4.5,  180),
        ("80NHG000B",  "NH000", 80,   6.1,   6.0,  200),
        ("100NHG000B", "NH000", 100,  7.4,   7.5,  200),
        ("125NHG00B",  "NH00",  125,  8.8,   9.0,  220),
        ("160NHG00B",  "NH00",  160,  10.0,  12.0, 240),
        ("200NHG1B",   "NH1",   200,  15.5,  15.0, 280),
        ("224NHG1B",   "NH1",   224,  17.5,  16.5, 280),
        ("250NHG1B",   "NH1",   250,  19.0,  18.0, 300),
        ("300NHG2B",   "NH2",   300,  22.5,  20.0, 320),
        ("315NHG2B",   "NH2",   315,  24.0,  21.0, 320),
        ("355NHG2B",   "NH2",   355,  27.0,  23.0, 340),
        ("400NHG2B",   "NH2",   400,  30.0,  25.0, 350),
        ("425NHG3B",   "NH3",   425,  33.0,  27.0, 380),
        ("500NHG3B",   "NH3",   500,  38.0,  30.0, 400),
        ("630NHG3B",   "NH3",   630,  47.0,  36.0, 420),
        ("710NHG4G",   "NH4",   710,  58.0,  42.0, 480),
        ("800NHG4G",   "NH4",   800,  68.0,  48.0, 500),
        ("1000NHG4G",  "NH4",   1000, 80.0,  60.0, 550),
        ("1250NHG4G",  "NH4",   1250, 108.0, 75.0, 600),
    ]
    for part, size, amps, w_link, w_base, h_mm in eaton_fuses:
        links_3p = round(w_link * 3, 1)
        total_pn = round(links_3p + w_base, 1)
        name = f"Eaton {part} — {amps}A {size} gG HRC ({w_link}W/link)"
        note = f"Eaton Bussmann DS 10164 (500V AC gG): 3x{w_link}W links ({links_3p}W) + {size} fuse-switch base ({w_base}W)"
        items.append((name, "HRC Fuse-Switch", "Feeder", amps, total_pn, 0.0, "quadratic", h_mm, note))

    return items


def generate_workbook():
    wb = openpyxl.Workbook()
    ws_smp  = wb.active
    ws_smp.title = "00_Simple_Mode"
    ws_sum  = wb.create_sheet("01_Summary")
    ws_bus  = wb.create_sheet("02_Board_&_Busbars")
    ws_fed  = wb.create_sheet("03_Feeder_Schedule")
    ws_seg  = wb.create_sheet("04_Busbar_Segments")
    ws_ga   = wb.create_sheet("05_GA_Heat_Map")
    ws_lib  = wb.create_sheet("06_Device_&_Fuse_Library")
    ws_rm   = wb.create_sheet("07_Room_Ventilation")
    ws_help = wb.create_sheet("08_Calc_Help_&_Method")

    # Tab colours for clean navigation
    ws_smp.sheet_properties.tabColor = "0284C7"
    ws_sum.sheet_properties.tabColor = "F59E0B"
    ws_bus.sheet_properties.tabColor = "1E3A5F"
    ws_fed.sheet_properties.tabColor = "1E3A5F"
    ws_seg.sheet_properties.tabColor = "DC2626"   # Red tab = Protected Calculation Engine
    ws_ga.sheet_properties.tabColor  = "DC2626"   # Red tab = Protected Visual GA
    ws_lib.sheet_properties.tabColor = "15803D"
    ws_rm.sheet_properties.tabColor  = "0D9488"
    ws_help.sheet_properties.tabColor = "7C3AED"

    LIB_START = 5
    LIB_END = 75
    COL_START = 6
    COL_END = 13
    FEED_START = 17
    FEED_END = 51
    HBB_START = 6
    HBB_END = 12
    VBB_START = 18
    VBB_END = 52

    lib_name_rng = f"'06_Device_&_Fuse_Library'!$A${LIB_START}:$A${LIB_END}"
    lib_in_rng   = f"'06_Device_&_Fuse_Library'!$D${LIB_START}:$D${LIB_END}"
    lib_pn_rng   = f"'06_Device_&_Fuse_Library'!$E${LIB_START}:$E${LIB_END}"
    lib_fix_rng  = f"'06_Device_&_Fuse_Library'!$F${LIB_START}:$F${LIB_END}"
    lib_mod_rng  = f"'06_Device_&_Fuse_Library'!$G${LIB_START}:$G${LIB_END}"

    # =========================================================================
    # SHEET 00: 00_Simple_Mode (Rapid Crude Assessment + Seeds Detailed Mode!)
    # =========================================================================
    style_title_banner(
        ws_smp, 7,
        "SIMPLE MODE — RAPID CRUDE SWITCHGEAR HEAT ASSESSMENT (FEW INPUTS)",
        "Enter ~10 high-level inputs for an instant heat & room cooling estimate. Detailed Mode inherits your busbar rating, diversity, future growth & N-1 transfer automatically!"
    )

    style_section_bar(ws_smp, 4, 1, 7, "A. SIMPLE MODE INPUTS (BLUE CELLS = EDITABLE)")
    for idx, h in enumerate(["Parameter", "Input Value", "Unit", "Typical / Example Values & Guidance"], 1):
        if idx == 4:
            ws_smp.merge_cells(start_row=5, start_column=4, end_row=5, end_column=7)
        c = ws_smp.cell(5, idx, h)
        c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C if idx in (2, 3) else ALIGN_L; c.border = BORDER_CELL
    for cc in range(5, 8):
        ws_smp.cell(5, cc).fill = FILL_HEADER; ws_smp.cell(5, cc).border = BORDER_CELL
    ws_smp.row_dimensions[5].height = 22

    # Simple Mode Input Rows (Rows 6..19):
    # B6=Busbar Preset, B7=Topology, B8=Est Columns, B9=Manual S,
    # B10=Motor Starters Qty, B11=Typical Starter Template,
    # B12=VSD Drives Qty, B13=Typical VSD Template,
    # B14=Outgoing Feeders/Fuses Qty, B15=Typical Feeder/HRC Template,
    # B16=Avg Running Load %, B17=Board RDF, B18=Future Growth %, B19=N-1 Transfer Load (A)
    smp_inputs = [
        (6,  "Main Busbar Preset", "1600 A — 2×75×6 mm Cu (900 mm²)", "-", "@",
         "Seeds Detailed Mode Main Busbar! Typ: 1600A (2×75×6), 2500A (2×100×10), 3200A (3×100×10)"),
        (7,  "Switchboard Topology", "Single Incomer + Interconnector (A→B)", "-", "@",
         "Single Incomer | Single + Interconnector | Dual + Bus Coupler"),
        (8,  "Estimated Switchboard Columns", 5, "cols", "0",
         "Typ: 4–8 columns (~0.78 m average cubicle width → drives approx busbar length)"),
        (9,  "Manual AC Resistance Factor (S)", 1.20, "×", "0.00",
         "Typ: 1.05 (1-bar), 1.20 (2-bar Cu), 1.40 (3-bar Cu). Seeds Detailed Mode!"),
        (10, "Motor Starters (Qty)", 4, "no.", "0",
         "Number of Direct-On-Line (DOL) / Star-Delta / Soft Starters"),
        (11, "Typical Motor Starter Size", "DOL Starter 37 kW (100A frame)", "-", "@",
         "Select representative motor starter from Device Library"),
        (12, "Variable Speed Drives — VSD (Qty)", 1, "no.", "0",
         "Number of VSDs (major heat source ~2.5–3.5% of kW!)"),
        (13, "Typical VSD Size", "VSD / Inverter Drive 45 kW (2.8% loss)", "-", "@",
         "Select representative VSD size from Device Library"),
        (14, "Outgoing Feeders / Eaton HRC Fuses (Qty)", 4, "no.", "0",
         "Number of MCCBs or Eaton NH gG HRC Fuse-Switches"),
        (15, "Typical Outgoing Feeder / HRC Fuse", "Eaton 250NHG1B — 250A NH1 gG HRC (19.0W/link)", "-", "@",
         "Select representative MCCB or Eaton HRC Fuse (2A–1250A)"),
        (16, "Average Running Load (% of Rated)", 0.75, "%", "0%",
         "Typ: 65%–80% average operating load across motors & feeders"),
        (17, "Board Rated Diversity Factor (RDF)", 0.90, "pu", "0.00",
         "IEC 61439-1 typ: 0.80–0.90 (4–9 circuits), 1.00 worst-case. Seeds Detailed Mode!"),
        (18, "Future Capacity Growth Allowance", 0.20, "%", "0%",
         "Typ: 15%–25% allowance for Future scenarios. Seeds Detailed Mode!"),
        (19, "N-1 Interconnector Transfer Load (A→B)", 850, "A", "#,##0",
         "Typ: 600–1600 A supplied to B-side firm-supply board during N-1 outage"),
    ]
    for r, name, val, unit, nf, hint in smp_inputs:
        ws_smp.row_dimensions[r].height = 20
        c1 = ws_smp.cell(r, 1, name); c1.font = FONT_CALC_BOLD; c1.fill = FILL_ZEBRA if r % 2 else FILL_WHITE; c1.border = BORDER_CELL
        c2 = ws_smp.cell(r, 2, val); c2.font = FONT_INPUT; c2.fill = FILL_INPUT; c2.border = BORDER_CELL
        c2.alignment = ALIGN_L if isinstance(val, str) else ALIGN_R; c2.number_format = nf
        c3 = ws_smp.cell(r, 3, unit); c3.font = FONT_CALC; c3.fill = FILL_ZEBRA if r % 2 else FILL_WHITE; c3.alignment = ALIGN_C; c3.border = BORDER_CELL
        ws_smp.merge_cells(start_row=r, start_column=4, end_row=r, end_column=7)
        c4 = ws_smp.cell(r, 4, hint); c4.font = FONT_HINT; c4.fill = FILL_ZEBRA if r % 2 else FILL_WHITE; c4.alignment = ALIGN_L
        for cc in range(4, 8):
            ws_smp.cell(r, cc).border = BORDER_CELL

    # Busbar Presets Lookup Table on 00_Simple_Mode (Rows 36..44 — clean visible reference table!)
    style_section_bar(ws_smp, 35, 1, 7, "C. BUSBAR PRESET LOOKUP TABLE (DRIVES SIMPLE MODE & DETAILED MODE INHERITANCE)")
    bb_p_hdrs = ["Preset Name", "Rated In (A)", "Bars/Ph", "Width (mm)", "Thick (mm)", "Area (mm²)", "R_AC @ 70°C (µΩ/m)"]
    ws_smp.row_dimensions[36].height = 22
    for i, h in enumerate(bb_p_hdrs, 1):
        c = ws_smp.cell(36, i, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C; c.border = BORDER_CELL

    bb_preset_rows = [
        ("630 A — 1×50×6 mm Cu (300 mm²)",    630,  1, 50,  6),
        ("800 A — 1×60×8 mm Cu (480 mm²)",    800,  1, 60,  8),
        ("1000 A — 2×50×6 mm Cu (600 mm²)",   1000, 2, 50,  6),
        ("1600 A — 2×75×6 mm Cu (900 mm²)",   1600, 2, 75,  6),
        ("2000 A — 2×80×10 mm Cu (1600 mm²)", 2000, 2, 80, 10),
        ("2500 A — 2×100×10 mm Cu (2000 mm²)",2500, 2, 100, 10),
        ("3200 A — 3×100×10 mm Cu (3000 mm²)",3200, 3, 100, 10),
        ("4000 A — 4×100×10 mm Cu (4000 mm²)",4000, 4, 100, 10),
    ]
    for idx, (pname, pin, pbars, pw, pt) in enumerate(bb_preset_rows):
        r = 37 + idx
        ws_smp.row_dimensions[r].height = 19
        ws_smp.cell(r, 1, pname).font = FONT_CALC_BOLD
        ws_smp.cell(r, 2, pin).number_format = "#,##0"
        ws_smp.cell(r, 3, pbars).number_format = "0"
        ws_smp.cell(r, 4, pw).number_format = "0"
        ws_smp.cell(r, 5, pt).number_format = "0"
        ws_smp.cell(r, 6, f"=C{r}*D{r}*E{r}").number_format = "#,##0"
        ws_smp.cell(r, 7, f"=(0.017241*(1+0.00393*50)/F{r})*1000000*$B$9").number_format = "0.00"
        for cc in range(1, 8):
            ws_smp.cell(r, cc).border = BORDER_CELL
            ws_smp.cell(r, cc).fill = FILL_ZEBRA if idx % 2 else FILL_WHITE
            if cc > 1:
                ws_smp.cell(r, cc).font = FONT_CALC
                ws_smp.cell(r, cc).alignment = ALIGN_R

    # Simple Mode Dropdowns
    dv_sm_bb = DataValidation(type="list", formula1="=$A$37:$A$44", allow_blank=False)
    dv_sm_topo = DataValidation(type="list", formula1='"Single Incomer,Single Incomer + Interconnector (A→B),Dual Incomer + Bus Coupler"', allow_blank=False)
    dv_sm_lib = DataValidation(type="list", formula1=f"={lib_name_rng}", allow_blank=False)
    ws_smp.add_data_validation(dv_sm_bb); dv_sm_bb.add("B6")
    ws_smp.add_data_validation(dv_sm_topo); dv_sm_topo.add("B7")
    ws_smp.add_data_validation(dv_sm_lib); dv_sm_lib.add("B11"); dv_sm_lib.add("B13"); dv_sm_lib.add("B15")

    # Section B: Simple Mode Live 4-Scenario Outputs (Rows 21..27) + Quick Room Cooling Verdict Link (Rows 29..33)
    style_section_bar(ws_smp, 21, 1, 7, "B. SIMPLE MODE RAPID HEAT OUTPUT ESTIMATE (4 SCENARIOS LIVE)")
    sm_res_hdrs = ["Operating Scenario", "Total Loss (kW)", "Total Loss (W)", "Busbars & Joints (W)", "Devices & Drives (W)", "Est. Board Load (A)", "HVAC Cooling (+15%)"]
    ws_smp.row_dimensions[22].height = 24
    for i, h in enumerate(sm_res_hdrs, 1):
        c = ws_smp.cell(22, i, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C; c.border = BORDER_CELL

    # Helper expressions for Simple Mode physics
    sm_rac = "INDEX($G$37:$G$44,MATCH($B$6,$A$37:$A$44,0))"
    sm_in  = "INDEX($B$37:$B$44,MATCH($B$6,$A$37:$A$44,0))"
    sm_len = "MAX(1.2,$B$8*0.78)"
    sm_dol_in = f"IFERROR(INDEX({lib_in_rng},MATCH($B$11,{lib_name_rng},0)),100)"
    sm_dol_pn = f"IFERROR(INDEX({lib_pn_rng},MATCH($B$11,{lib_name_rng},0)),55)"
    sm_dol_fx = f"IFERROR(INDEX({lib_fix_rng},MATCH($B$11,{lib_name_rng},0)),18)"
    sm_vsd_in = f"IFERROR(INDEX({lib_in_rng},MATCH($B$13,{lib_name_rng},0)),90)"
    sm_vsd_pn = f"IFERROR(INDEX({lib_pn_rng},MATCH($B$13,{lib_name_rng},0)),1260)"
    sm_vsd_fx = f"IFERROR(INDEX({lib_fix_rng},MATCH($B$13,{lib_name_rng},0)),65)"
    sm_fdr_in = f"IFERROR(INDEX({lib_in_rng},MATCH($B$15,{lib_name_rng},0)),250)"
    sm_fdr_pn = f"IFERROR(INDEX({lib_pn_rng},MATCH($B$15,{lib_name_rng},0)),75)"
    sm_fdr_fx = f"IFERROR(INDEX({lib_fix_rng},MATCH($B$15,{lib_name_rng},0)),0)"

    sm_sc_defs = [
        (23, "Normal (N) — Local Active Loads",            False, False),
        (24, "N-1 Firm Transfer — Supplying B-Side Board", False, True),
        (25, "Normal + Future Capacity",                   True,  False),
        (26, "Worst-Case (N-1 Transfer + Future)",         True,  True),
    ]
    for r, sc_lbl, is_fut, is_n1 in sm_sc_defs:
        ws_smp.row_dimensions[r].height = 21
        mul = "(1+$B$18)" if is_fut else "1"
        ic_a = "IF($B$7=\"Single Incomer + Interconnector (A→B)\",$B$19,0)" if is_n1 else "0"
        # Local diversified Amps (approximate: each circuit at avgLoad% * 0.72 of frame * mul * RDF)
        loc_a = f"(($B$10*{sm_dol_in}*0.65+$B$12*{sm_vsd_in}*0.72+$B$14*{sm_fdr_in}*0.70)*$B$16*{mul}*$B$17)"
        ws_smp.cell(r, 1, sc_lbl).font = FONT_CALC_BOLD
        ws_smp.cell(r, 6, f"={loc_a}+{ic_a}").number_format = "#,##0.0"
        # Devices + Incomer + Interconnector W
        dol_w = f"($B$10*({sm_dol_fx}+{sm_dol_pn}*((0.65*$B$16*{mul})^2)))"
        vsd_w = f"($B$12*({sm_vsd_fx}+{sm_vsd_pn}*(0.25+0.75*(0.72*$B$16*{mul}))))"
        fdr_w = f"($B$14*({sm_fdr_fx}+{sm_fdr_pn}*((0.70*$B$16*{mul})^2)))"
        inc_w = f"(18+IF({sm_in}>=2500,480,260)*((F{r}/MAX(1,{sm_in}))^2))"
        ic_w  = f"IF({ic_a}>0,15+260*(({ic_a}/1600)^2)+3*({ic_a}^2)*(0.017241*1.1965/720)*1.05*2.5,0)"
        ws_smp.cell(r, 5, f"={dol_w}+{vsd_w}+{fdr_w}+{inc_w}+{ic_w}").number_format = "#,##0.0"
        # Busbars + Joints W (RMS tapered HBB + VBB + splice joints)
        hbb_rms_sq = f"(({loc_a}^2)/3+({ic_a}^2)+{loc_a}*{ic_a})"
        bus_w = f"(3*{hbb_rms_sq}*{sm_rac}*0.000001*{sm_len} + 3*({loc_a}/MAX(1,$B$8-1)*0.65)^2*'02_Board_&_Busbars'!$C$60*0.000001*MAX(1,($B$8-1)*1.3) + 3*{hbb_rms_sq}*'02_Board_&_Busbars'!$B$23*0.000001*MAX(1,$B$8-1))"
        ws_smp.cell(r, 4, f"={bus_w}").number_format = "#,##0.0"
        ws_smp.cell(r, 3, f"=D{r}+E{r}+'02_Board_&_Busbars'!$B$24").number_format = "#,##0.0"
        ws_smp.cell(r, 2, f"=C{r}/1000").number_format = "0.000"
        ws_smp.cell(r, 7, f"=B{r}*(1+'02_Board_&_Busbars'!$B$26)").number_format = "0.000\" kW\""
        for cc in range(1, 8):
            ws_smp.cell(r, cc).border = BORDER_CELL
            if cc > 1:
                ws_smp.cell(r, cc).alignment = ALIGN_R
                ws_smp.cell(r, cc).font = FONT_CALC_BOLD if cc in (2, 7) else FONT_CALC
            ws_smp.cell(r, cc).fill = FILL_HERO if r == 26 and cc in (2, 7) else (FILL_ZEBRA if r % 2 else FILL_WHITE)

    # Quick Link Banner to Switchroom Ventilation & Detailed Mode (Rows 29..32)
    style_section_bar(ws_smp, 29, 1, 7, "QUICK ROOM COOLING STATUS (SEE TAB 07_Room_Ventilation FOR FULL ROOM DETAILS)")
    ws_smp.row_dimensions[30].height = 24
    ws_smp.row_dimensions[31].height = 22
    ws_smp.merge_cells("A30:B30"); ws_smp.cell(30, 1, "Switchroom Ventilation Verdict:").font = FONT_CALC_BOLD; ws_smp.cell(30, 1).fill = FILL_ZEBRA
    ws_smp.merge_cells("C30:G30"); c_rv = ws_smp.cell(30, 3, "='07_Room_Ventilation'!B28"); c_rv.font = FONT_HERO_VAL; c_rv.fill = FILL_HERO; c_rv.alignment = ALIGN_C
    ws_smp.merge_cells("A31:B31"); ws_smp.cell(31, 1, "Required Airflow / Air Change Rate:").font = FONT_CALC_BOLD; ws_smp.cell(31, 1).fill = FILL_ZEBRA
    ws_smp.merge_cells("C31:G31"); ws_smp.cell(31, 3, "=TEXT('07_Room_Ventilation'!B21,\"#,##0\")&\" L/s  (\" & TEXT('07_Room_Ventilation'!B22,\"#,##0\") & \" m³/h  |  \" & TEXT('07_Room_Ventilation'!B24,\"0.0\") & \" ACH)  for \" & '07_Room_Ventilation'!B6 & \"×\" & '07_Room_Ventilation'!B7 & \"×\" & '07_Room_Ventilation'!B8 & \"m Room\"").font = FONT_CALC_BOLD
    ws_smp.cell(31, 3).alignment = ALIGN_C
    for rr in (30, 31):
        for cc in range(1, 8):
            ws_smp.cell(rr, cc).border = BORDER_CELL

    ws_smp.merge_cells("A33:G33"); ws_smp.row_dimensions[33].height = 22
    ws_smp.cell(33, 1, "Tip: Switch Calculation Mode on '01_Summary' (cell C8) between 'Simple Mode' and 'Detailed Mode'. Detailed Mode automatically inherits your Busbar Preset, Factor S, RDF & Future Growth from this sheet when 'Link to Simple Mode' = Yes on '02_Board_&_Busbars'!").font = FONT_HINT

    smp_widths = [38, 42, 12, 18, 18, 18, 18]
    for i, w in enumerate(smp_widths, 1):
        ws_smp.column_dimensions[get_column_letter(i)].width = w
    configure_print(ws_smp, landscape=True, fit_width=1)

    # =========================================================================
    # SHEET 06: 06_Device_&_Fuse_Library
    # =========================================================================
    style_title_banner(
        ws_lib, 9,
        "PROTECTIVE DEVICE, STARTER & EATON HRC FUSE LIBRARY (EDITABLE)",
        "Generic IEC 60947 templates + Eaton Bussmann NH gG High Rupturing Capacity (HRC) Fuse Links (2A–1250A, Data Sheet 10164). Add custom parts in rows 61–75."
    )
    lib_headers = [
        "Template Name (Dropdown Key)", "Category", "Default Role",
        "Rated Current In (A)", "Rated 3P Variable Loss Pn (W)", "Fixed / Standby Loss (W)",
        "Scaling Model", "Default Tier Height (mm)", "Manufacturer Basis / Notes"
    ]
    ws_lib.row_dimensions[4].height = 26
    for idx, h in enumerate(lib_headers, 1):
        c = ws_lib.cell(4, idx, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C; c.border = BORDER_CELL

    lib_data = build_library_data()
    for i, row_vals in enumerate(lib_data):
        r = LIB_START + i
        ws_lib.row_dimensions[r].height = 19
        fill = FILL_ZEBRA if i % 2 == 1 else FILL_WHITE
        for col_i, val in enumerate(row_vals, 1):
            c = ws_lib.cell(r, col_i, val)
            c.border = BORDER_CELL
            c.fill = FILL_INPUT if col_i in (4, 5, 6, 8) else fill
            c.font = FONT_INPUT if col_i in (4, 5, 6, 8) else (FONT_HINT if col_i == 9 else FONT_CALC)
            c.alignment = ALIGN_R if col_i in (4, 5, 6, 8) else (ALIGN_C if col_i in (2, 3, 7) else ALIGN_L)
            if col_i in (4, 8):
                c.number_format = "#,##0"
            elif col_i in (5, 6):
                c.number_format = "#,##0.0"

    for r in range(LIB_START + len(lib_data), LIB_END + 1):
        ws_lib.row_dimensions[r].height = 18
        for col_i in range(1, 10):
            c = ws_lib.cell(r, col_i, "")
            c.border = BORDER_CELL; c.fill = FILL_INPUT if col_i <= 8 else FILL_WHITE; c.font = FONT_INPUT

    for i, w in enumerate([42, 18, 18, 16, 20, 18, 14, 16, 56], 1):
        ws_lib.column_dimensions[get_column_letter(i)].width = w
    ws_lib.freeze_panes = "A5"
    configure_print(ws_lib, landscape=True, fit_width=1, repeat_rows="1:4")

    # =========================================================================
    # SHEET 02: 02_Board_&_Busbars (Inherits from 00_Simple_Mode when linked!)
    # =========================================================================
    style_title_banner(
        ws_bus, 7,
        "SWITCHBOARD CONFIGURATION & BUSBAR JOULE PHYSICS (IEC 60439 / 61439)",
        "Blue cells are editable inputs (unlocked). Set 'Inherit from Simple Mode' = Yes (cell B9) to automatically carry Simple Mode busbar, RDF & growth selections into Detailed Mode."
    )

    style_section_bar(ws_bus, 4, 1, 7, "A. PROJECT METADATA & SIMPLE-TO-DETAILED INHERITANCE")
    meta_rows = [
        ("Project / Switchboard Name", "MSB-A — Main LV Switchboard (Firm Supply A)", "Appears on Summary & Print headers. Do not enter classified/sensitive site names."),
        ("Document / Calc Reference", "CEI-TH-001", "Example: CEI-TH-001"),
        ("Originating Engineer", "CE&I Engineering", "Shown on Engineering Sign-Off block"),
        ("Revision & Date", "Rev B  |  2026-11-27", "Update revision when vendor datasheets replace estimates"),
        ("Inherit Busbar/RDF/Growth from Simple Mode?", "Yes", "Yes = Detailed Mode auto-inherits Busbar Size, S, RDF & Future Growth from 00_Simple_Mode!"),
    ]
    for idx, (lbl_t, val, hint) in enumerate(meta_rows, 5):
        ws_bus.row_dimensions[idx].height = 20
        ws_bus.cell(idx, 1, lbl_t).font = FONT_CALC_BOLD; ws_bus.cell(idx, 1).fill = FILL_ZEBRA; ws_bus.cell(idx, 1).border = BORDER_CELL
        ws_bus.merge_cells(start_row=idx, start_column=2, end_row=idx, end_column=4)
        cv = ws_bus.cell(idx, 2, val); cv.font = FONT_INPUT; cv.fill = FILL_INPUT; cv.alignment = ALIGN_L
        for cc in range(2, 5):
            ws_bus.cell(idx, cc).border = BORDER_CELL
        ws_bus.merge_cells(start_row=idx, start_column=5, end_row=idx, end_column=7)
        ws_bus.cell(idx, 5, hint).font = FONT_HINT
        for cc in range(5, 8):
            ws_bus.cell(idx, cc).border = BORDER_CELL
    dv_yn = DataValidation(type="list", formula1='"Yes,No"', allow_blank=False)
    ws_bus.add_data_validation(dv_yn); dv_yn.add("B9")

    # Section B: Electrical System & Enclosure Config (Rows 10..26)
    style_section_bar(ws_bus, 10, 1, 7, "B. ELECTRICAL SYSTEM, DIVERSITY & ENCLOSURE PARAMETERS")
    for idx, h in enumerate(["Parameter", "Active Value", "Unit", "Typical / Example Values & Guidance"], 1):
        if idx == 4:
            ws_bus.merge_cells(start_row=11, start_column=4, end_row=11, end_column=7)
        c = ws_bus.cell(11, idx, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C if idx in (2, 3) else ALIGN_L; c.border = BORDER_CELL
    for cc in range(5, 8):
        ws_bus.cell(11, cc).fill = FILL_HEADER; ws_bus.cell(11, cc).border = BORDER_CELL
    ws_bus.row_dimensions[11].height = 22

    # Note: B16 (RDF) & B17 (Future Growth) default to inheriting from 00_Simple_Mode when B9="Yes"!
    sys_params = [
        ("Nominal System Voltage (V_LL)", 400, "V", "0", True,
         "Typ: 400 V (IEC/EU) or 415 V (UK legacy), 480 V (60Hz US)",
         "Line-to-Line Root Mean Square (RMS) Voltage (V_LL). Used to calculate motor Operating Current (I_op) from Kilowatts (kW)."),
        ("System Frequency (f)", 50, "Hz", "0", True,
         "Typ: 50 Hz (UK/EU/IEC) or 60 Hz (Americas)",
         "Alternating Current (AC) supply frequency in Hertz (Hz). Drives Copper/Aluminium skin depth (δ)."),
        ("System Poles", "3P+N", "-", "@", True,
         "3P+N (4-Wire) for mixed distribution/MCC; 3P (3-Wire) for motor-only boards",
         "3-Phase + Neutral (3P+N) vs 3-Phase (3P)."),
        ("Neutral Current Ratio (I_N / I_ph)", 0.10, "pu", "0.00", True,
         "Typ: 0.00 balanced motors, 0.10 mixed plant, 0.25–0.40 harmonic/IT loads",
         "Average Neutral Current (I_N) divided by Phase Current (I_ph)."),
        ("Board Rated Diversity Factor (RDF)", "=IF($B$9=\"Yes\",'00_Simple_Mode'!$B$17,0.90)", "pu", "0.00", True,
         "Inherits from Simple Mode when B9=Yes; or type custom 0.80–1.00 directly!",
         "Rated Diversity Factor (RDF) per IEC 61439-1 Table 101."),
        ("Global Future Load Growth", "=IF($B$9=\"Yes\",'00_Simple_Mode'!$B$18,0.15)", "%", "0%", True,
         "Inherits from Simple Mode when B9=Yes; or type custom 10%–25% directly!",
         "Global percentage uplift applied in Future scenarios."),
        ("Overall Panel Height", 2200, "mm", "#,##0", True,
         "Typ: 2000–2200 mm standard Form 4 LV switchboard",
         "Total enclosure height from Finished Floor Level (FFL) to roof."),
        ("Overall Panel Depth", 800, "mm", "#,##0", True,
         "Typ: 600–1000 mm (drives IEC 60890 cooling surface area Ae)",
         "Front-to-rear enclosure depth in mm."),
        ("Main HBB Chamber Height", 350, "mm", "#,##0", True,
         "Typ: 300–450 mm Main Horizontal Busbar (HBB) chamber",
         "Sets vertical origin for Vertical Dropper Busbar (VBB) lengths."),
        ("Main HBB Position", "Top", "-", "@", True,
         "Top (standard with bottom cable entry) or Bottom",
         "Main Horizontal Busbar (HBB) chamber location."),
        ("Take-off Tail Length per Tier", 0.35, "m", "0.00", True,
         "Typ: 0.25–0.50 m internal link from dropper to breaker terminals",
         "Short internal copper link connecting dropper tap-off to protective device."),
        ("Bolted Joint Contact Resistance", 5.0, "µΩ", "0.0", True,
         "Typ: 3–10 µΩ per torqued clean/tinned Copper lap joint",
         "Contact resistance in Micro-Ohms (µΩ) per bolted 3-phase lap joint."),
        ("Panel Auxiliary Losses", 120.0, "W", "#,##0.0", True,
         "Typ: 80–250 W (meters, 24V DC PSU, PLC/SCADA, lamps)",
         "Continuous board-level auxiliary heat."),
        ("Enclosure Installation Type", "Freestanding", "-", "@", True,
         "Freestanding (Front + Rear exposed) vs Wall-Backed (Rear blocked)",
         "Determines Effective Enclosure Cooling Surface Area (Ae) per IEC TR 60890."),
        ("HVAC Cooling Safety Margin", 0.15, "%", "0%", True,
         "Typ: 15%–25% contingency for switchroom cooling plant",
         "Design contingency added to calculated switchgear Kilowatts (kW) for HVAC sizing."),
    ]
    for i, (name, val, unit, num_fmt, is_inp, hint, note) in enumerate(sys_params):
        r = 12 + i
        ws_bus.row_dimensions[r].height = 20
        c1 = ws_bus.cell(r, 1, name); c1.font = FONT_CALC_BOLD; c1.fill = FILL_ZEBRA if i % 2 else FILL_WHITE; c1.border = BORDER_CELL
        add_comment(c1, f"{name}\n\n{note}\n\nTypical: {hint}")
        c2 = ws_bus.cell(r, 2, val); c2.font = FONT_INPUT; c2.fill = FILL_INPUT; c2.border = BORDER_CELL
        c2.alignment = ALIGN_C if isinstance(val, str) and not val.startswith("=") else ALIGN_R; c2.number_format = num_fmt
        c3 = ws_bus.cell(r, 3, unit); c3.font = FONT_CALC; c3.fill = FILL_ZEBRA if i % 2 else FILL_WHITE; c3.border = BORDER_CELL; c3.alignment = ALIGN_C
        ws_bus.merge_cells(start_row=r, start_column=4, end_row=r, end_column=7)
        c4 = ws_bus.cell(r, 4, hint); c4.font = FONT_HINT; c4.fill = FILL_ZEBRA if i % 2 else FILL_WHITE; c4.alignment = ALIGN_L
        for cc in range(4, 8):
            ws_bus.cell(r, cc).border = BORDER_CELL

    for dv, ref in [
        (DataValidation(type="list", formula1='"50,60"', allow_blank=False), "B13"),
        (DataValidation(type="list", formula1='"3P+N,3P"', allow_blank=False), "B14"),
        (DataValidation(type="list", formula1='"Top,Bottom"', allow_blank=False), "B21"),
        (DataValidation(type="list", formula1='"Freestanding,Wall-Backed"', allow_blank=False), "B25"),
    ]:
        ws_bus.add_data_validation(dv); dv.add(ref)

    # Section C: Material Table (Rows 28..33)
    style_section_bar(ws_bus, 28, 1, 7, "C. CONDUCTOR MATERIAL PROPERTIES (IEC / IACS REFERENCE)")
    ws_bus.row_dimensions[29].height = 20
    for idx, h in enumerate(["Material Name", "ρ₂₀ (Ω·mm²/m)", "α₂₀ (1/K)", "Notes"], 1):
        if idx == 4:
            ws_bus.merge_cells(start_row=29, start_column=4, end_row=29, end_column=7)
        c = ws_bus.cell(29, idx, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C if idx in (2, 3) else ALIGN_L; c.border = BORDER_CELL
    for cc in range(5, 8):
        ws_bus.cell(29, cc).fill = FILL_HEADER; ws_bus.cell(29, cc).border = BORDER_CELL

    for i, (mn, rho, alp, note) in enumerate([
        ("Copper (Cu 100% IACS)", 0.017241, 0.00393, "Electrolytic Tough Pitch Copper (Cu-ETP), 100% IACS"),
        ("Copper (Cu 98% IACS)",  0.017593, 0.00385, "Commercial Copper busbar BS EN 13601 (98% IACS)"),
        ("Aluminium (Al 61% IACS)", 0.028264, 0.00403, "EC Grade Aluminium 1350 (~64% higher R than Cu)"),
        ("Aluminium (Al 55% IACS)", 0.031347, 0.00360, "Alloy 6101-T6 Structural Aluminium busbar"),
    ]):
        r = 30 + i
        ws_bus.row_dimensions[r].height = 19
        ws_bus.cell(r, 1, mn).font = FONT_CALC_BOLD
        ws_bus.cell(r, 2, rho).number_format = "0.000000"
        ws_bus.cell(r, 3, alp).number_format = "0.00000"
        ws_bus.merge_cells(start_row=r, start_column=4, end_row=r, end_column=7)
        ws_bus.cell(r, 4, note).font = FONT_HINT
        for cc in range(1, 8):
            ws_bus.cell(r, cc).border = BORDER_CELL; ws_bus.cell(r, cc).fill = FILL_ZEBRA if i % 2 else FILL_WHITE
            if cc in (2, 3):
                ws_bus.cell(r, cc).font = FONT_CALC; ws_bus.cell(r, cc).alignment = ALIGN_R

    # Section D: Busbar Physics (Rows 35..62) — Main HBB inherits from 00_Simple_Mode when B9="Yes"!
    style_section_bar(ws_bus, 35, 1, 7, "D. BUSBAR CONSTRUCTION & JOULE'S LAW DC → AC RESISTANCE PHYSICS")
    ws_bus.row_dimensions[36].height = 24
    for idx, h in enumerate(["Busbar Parameter / Calculated Quantity", "Main HBB", "VBB-Std", "VBB-Heavy", "Unit", "Typical Values / Formula Explanation"], 1):
        if idx == 6:
            ws_bus.merge_cells(start_row=36, start_column=6, end_row=36, end_column=7)
        c = ws_bus.cell(36, idx, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C if idx in (2, 3, 4, 5) else ALIGN_L; c.border = BORDER_CELL
    ws_bus.cell(36, 7).fill = FILL_HEADER; ws_bus.cell(36, 7).border = BORDER_CELL

    sm_lu = lambda col_l: f"INDEX('00_Simple_Mode'!${col_l}$37:${col_l}$44,MATCH('00_Simple_Mode'!$B$6,'00_Simple_Mode'!$A$37:$A$44,0))"
    bb_inputs = [
        (37, "Type 439 / IEC 61439 Cert Ref", "Type 439 — 2×75×6mm", "Dropper 1×60×6mm", "Riser 2×75×6mm", "-", "@", "Manufacturer type test certificate reference"),
        (38, "Busbar Rated Current (In)", f"=IF($B$9=\"Yes\",{sm_lu('B')},1600)", 800, f"=IF($B$9=\"Yes\",{sm_lu('B')},1600)", "A", "#,##0", "Inherits from Simple Mode when B9=Yes; or overwrite directly!"),
        (39, "Conductor Material", "Copper (Cu 100% IACS)", "Copper (Cu 100% IACS)", "Copper (Cu 100% IACS)", "-", "@", "Select from Material Table above"),
        (40, "Parallel Bars per Phase (n)", f"=IF($B$9=\"Yes\",{sm_lu('C')},2)", 1, f"=IF($B$9=\"Yes\",{sm_lu('C')},2)", "bars", "0", "Typ: 1–4 parallel bars/phase"),
        (41, "Bar Width (w)", f"=IF($B$9=\"Yes\",{sm_lu('D')},75)", 60, f"=IF($B$9=\"Yes\",{sm_lu('D')},75)", "mm", "0", "Typ: 40–100 mm"),
        (42, "Bar Thickness (t)", f"=IF($B$9=\"Yes\",{sm_lu('E')},6)", 6, f"=IF($B$9=\"Yes\",{sm_lu('E')},6)", "mm", "0", "Typ: 5, 6, 8, or 10 mm"),
        (43, "Inter-Bar Air Gap (g)", f"=IF($B$9=\"Yes\",{sm_lu('E')},6)", 6, f"=IF($B$9=\"Yes\",{sm_lu('E')},6)", "mm", "0", "Typ: Equal to bar thickness t"),
        (44, "Phase Centre Spacing (D)", 120, 95, 120, "mm", "0", "Typ: 90–160 mm centre-to-centre"),
        (45, "Bar Orientation", "Edge", "Edge", "Edge", "-", "@", "Edge (vertical wide face) vs Flat"),
        (46, "Operating Temperature (T_op)", 70, 70, 70, "°C", "0", "Typ: 70 °C normal / 85 °C conservative"),
        (47, "Neutral Bar Sizing Ratio", 0.50, 0.50, 0.50, "pu", "0%", "Typ: 50% (motors) or 100% (harmonics)"),
        (48, "AC Conversion Mode", "Manual", "Manual", "Manual", "-", "@", "Manual (Factor S) or Calculated (Skin + Prox + Eddy)"),
        (49, "Manual AC Factor (S)", "=IF($B$9=\"Yes\",'00_Simple_Mode'!$B$9,1.20)", 1.15, "=IF($B$9=\"Yes\",'00_Simple_Mode'!$B$9,1.20)", "×", "0.00", "Typ: 1.05 (1-bar), 1.20 (2-bar), 1.40 (3-bar)"),
        (50, "Enclosure Eddy Factor (ye)", 0.02, 0.02, 0.02, "pu", "0.00", "Typ: 0.02–0.05 (steel) / 0.00 (aluminium)"),
    ]
    for r, label, v_hbb, v_vs, v_vh, unit, nf, hint in bb_inputs:
        ws_bus.row_dimensions[r].height = 20
        ws_bus.cell(r, 1, label).font = FONT_CALC_BOLD; ws_bus.cell(r, 1).fill = FILL_ZEBRA if r % 2 else FILL_WHITE; ws_bus.cell(r, 1).border = BORDER_CELL
        for ci, val in [(2, v_hbb), (3, v_vs), (4, v_vh)]:
            c = ws_bus.cell(r, ci, val); c.font = FONT_INPUT; c.fill = FILL_INPUT; c.border = BORDER_CELL
            c.alignment = ALIGN_C if isinstance(val, str) and not val.startswith("=") else ALIGN_R; c.number_format = nf
        ws_bus.cell(r, 5, unit).font = FONT_CALC; ws_bus.cell(r, 5).fill = FILL_ZEBRA if r % 2 else FILL_WHITE; ws_bus.cell(r, 5).alignment = ALIGN_C; ws_bus.cell(r, 5).border = BORDER_CELL
        ws_bus.merge_cells(start_row=r, start_column=6, end_row=r, end_column=7)
        ws_bus.cell(r, 6, hint).font = FONT_HINT; ws_bus.cell(r, 6).fill = FILL_ZEBRA if r % 2 else FILL_WHITE
        ws_bus.cell(r, 6).border = BORDER_CELL; ws_bus.cell(r, 7).border = BORDER_CELL

    for dv, rng in [
        (DataValidation(type="list", formula1="=$A$30:$A$33", allow_blank=False), "B39:D39"),
        (DataValidation(type="list", formula1='"Edge,Flat"', allow_blank=False), "B45:D45"),
        (DataValidation(type="list", formula1='"Manual,Calculated"', allow_blank=False), "B48:D48"),
    ]:
        ws_bus.add_data_validation(dv); dv.add(rng)

    bb_calcs = [
        (51, "Cross-Sectional Area per Phase (A)", "mm²", "#,##0", lambda col: f"={col}40*{col}41*{col}42", "A = n × w × t"),
        (52, "DC Resistance @ 20 °C (R_DC,20)", "µΩ/m", "0.00", lambda col: f"=(INDEX($B$30:$B$33,MATCH({col}39,$A$30:$A$33,0))/{col}51)*1000000", "R_DC,20 = (ρ₂₀ / A) × 10⁶"),
        (53, "Temperature Correction Factor", "×", "0.0000", lambda col: f"=1+INDEX($C$30:$C$33,MATCH({col}39,$A$30:$A$33,0))*({col}46-20)", "1 + α₂₀ × (T_op − 20)"),
        (54, "DC Resistance @ Operating Temp R_DC(T)", "µΩ/m", "0.00", lambda col: f"={col}52*{col}53", "Temperature-corrected DC resistance"),
        (55, "AC Skin Depth (δ)", "mm", "0.00", lambda col: f"=SQRT((INDEX($B$30:$B$33,MATCH({col}39,$A$30:$A$33,0))*{col}53*0.000001)/(PI()*$B$13*4*PI()*0.0000001))*1000", "δ = √(ρ(T)/(π·f·μ₀)) × 1000"),
        (56, "Calculated Skin Effect Factor (ys)", "pu", "0.000",
         lambda col: (
             f"=IFERROR(MAX(0,(({col}42*IF({col}40=1,1,1+0.55*({col}40-1)*EXP(-{col}43/(2.5*{col}42))))/(2*{col}55))"
             f"*((SINH(2*(({col}42*IF({col}40=1,1,1+0.55*({col}40-1)*EXP(-{col}43/(2.5*{col}42))))/(2*{col}55)))"
             f"+SIN(2*(({col}42*IF({col}40=1,1,1+0.55*({col}40-1)*EXP(-{col}43/(2.5*{col}42))))/(2*{col}55))))"
             f"/(COSH(2*(({col}42*IF({col}40=1,1,1+0.55*({col}40-1)*EXP(-{col}43/(2.5*{col}42))))/(2*{col}55)))"
             f"-COS(2*(({col}42*IF({col}40=1,1,1+0.55*({col}40-1)*EXP(-{col}43/(2.5*{col}42))))/(2*{col}55)))))-1)"
             f"+0.0045*(MAX(0,{col}41/{col}55-1.5)^1.35)*MIN(2.2,SQRT(({col}41/MAX(1,{col}40*{col}42))/4))"
             f"+IF({col}40>1,0.028*(({col}40-1)^1.55)*((({col}40*{col}42)/(2*{col}55))^1.2),0),0)"
         ), "CDA Pub 22 slab + edge + parallel-bar skin effect"),
        (57, "Calculated Proximity Effect Factor (yp)", "pu", "0.000",
         lambda col: (
             f"=IFERROR((((((8*PI()*$B$13*0.0000001)/({col}54*0.000001))*IF({col}45=\"Flat\",1,0.72))^2)"
             f"/(192+0.8*((((8*PI()*$B$13*0.0000001)/({col}54*0.000001))*IF({col}45=\"Flat\",1,0.72))^2)))"
             f"*(MIN(0.85,SQRT(4*{col}51/PI())/{col}44)^2)"
             f"*(0.312*(MIN(0.85,SQRT(4*{col}51/PI())/{col}44)^2)"
             f"+1.18/((((((8*PI()*$B$13*0.0000001)/({col}54*0.000001))*IF({col}45=\"Flat\",1,0.72))^2)"
             f"/(192+0.8*((((8*PI()*$B$13*0.0000001)/({col}54*0.000001))*IF({col}45=\"Flat\",1,0.72))^2)))+0.27)),0)"
         ), "IEC 60287 inter-phase proximity effect"),
        (58, "Calculated Total AC Factor (1 + ys + yp + ye)", "×", "0.000", lambda col: f"=1+{col}56+{col}57+{col}50", "Computed AC/DC resistance multiplier"),
        (59, "ACTIVE AC Factor Used (k_AC)", "×", "0.000", lambda col: f"=IF({col}48=\"Calculated\",{col}58,{col}49)", "Uses Calculated k_AC or Manual S"),
        (60, "AC Resistance @ Operating Temp R_AC(T)", "µΩ/m", "0.00", lambda col: f"={col}54*{col}59", "R_AC = R_DC(T) × k_AC"),
        (61, "Neutral Busbar R_N,AC(T)", "µΩ/m", "0.00", lambda col: f"=IF({col}47>0,{col}60/{col}47,0)", "Neutral conductor AC resistance"),
        (62, "Reference 3-Phase (+N) Heat Loss @ Rated In", "W/m", "#,##0.0",
         lambda col: f"=(3*({col}38^2)*{col}60*0.000001)+IF(AND($B$14=\"3P+N\",{col}61>0),(($B$15*{col}38)^2)*{col}61*0.000001,0)",
         "Joule's Law @ 100% Rated In (2×75×6 @ 1600A, S=1.2 ≈ 212.6 W/m)"),
    ]
    for r, label, unit, nf, ffn, hint in bb_calcs:
        ws_bus.row_dimensions[r].height = 20
        is_key = r in (59, 60, 62)
        ws_bus.cell(r, 1, label).font = FONT_TOTAL if is_key else FONT_CALC
        ws_bus.cell(r, 1).fill = FILL_HERO if is_key else (FILL_ZEBRA if r % 2 else FILL_WHITE)
        ws_bus.cell(r, 1).border = BORDER_TOTAL if r == 62 else BORDER_CELL
        for ci, col_let in [(2, "B"), (3, "C"), (4, "D")]:
            c = ws_bus.cell(r, ci, ffn(col_let))
            c.font = FONT_TOTAL if is_key else FONT_CALC_BOLD
            c.fill = FILL_HERO if is_key else (FILL_ZEBRA if r % 2 else FILL_WHITE)
            c.border = BORDER_TOTAL if r == 62 else BORDER_CELL; c.alignment = ALIGN_R; c.number_format = nf
        ws_bus.cell(r, 5, unit).font = FONT_CALC; ws_bus.cell(r, 5).fill = FILL_HERO if is_key else (FILL_ZEBRA if r % 2 else FILL_WHITE); ws_bus.cell(r, 5).alignment = ALIGN_C; ws_bus.cell(r, 5).border = BORDER_TOTAL if r == 62 else BORDER_CELL
        ws_bus.merge_cells(start_row=r, start_column=6, end_row=r, end_column=7)
        ws_bus.cell(r, 6, hint).font = FONT_HINT; ws_bus.cell(r, 6).fill = FILL_HERO if is_key else (FILL_ZEBRA if r % 2 else FILL_WHITE)
        ws_bus.cell(r, 6).border = BORDER_TOTAL if r == 62 else BORDER_CELL; ws_bus.cell(r, 7).border = BORDER_TOTAL if r == 62 else BORDER_CELL

    for i, w in enumerate([40, 22, 20, 20, 10, 28, 28], 1):
        ws_bus.column_dimensions[get_column_letter(i)].width = w
    ws_bus.freeze_panes = "A4"
    configure_print(ws_bus, landscape=True, fit_width=1)

    # =========================================================================
    # SHEET 03: 03_Feeder_Schedule
    # =========================================================================
    style_title_banner(
        ws_fed, 33,
        "DETAILED MODE — COLUMNS, COMPARTMENTS, STARTERS & EATON HRC FUSE SCHEDULE",
        "Blue cells = Editable inputs (unlocked). All 4 operating scenarios calculate simultaneously in columns Z–AG."
    )
    style_section_bar(ws_fed, 4, 1, 16, "A. SWITCHBOARD COLUMNS / CUBICLES (UP TO 8 COLUMNS LEFT-TO-RIGHT)")
    col_hdrs = [
        "Col ID", "Column Name", "Width (mm)", "Vertical Busbar",
        "X Start (mm)", "X Centre (mm)", "Active Local Load (A)", "Active IC Load (A)",
        "Active Incomer Supply (A)", "Col Devices (W)", "Col VBB (W)", "Col Total (W)",
        "Normal Load (A)", "N-1 Load (A)", "Norm+Fut Load (A)", "Worst-Case Load (A)"
    ]
    ws_fed.row_dimensions[5].height = 26
    for i, h in enumerate(col_hdrs, 1):
        c = ws_fed.cell(5, i, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C; c.border = BORDER_CELL

    preset_cols = [
        ("COL-01", "COL-01 Incomer",           800, "None"),
        ("COL-02", "COL-02 MCC Tier 1",        800, "VBB-Std"),
        ("COL-03", "COL-03 Drives & Starters", 800, "VBB-Std"),
        ("COL-04", "COL-04 Feeders & HRC",     600, "VBB-Std"),
        ("COL-05", "COL-05 Interconnector",    800, "VBB-Heavy"),
        ("COL-06", "", 0, "None"), ("COL-07", "", 0, "None"), ("COL-08", "", 0, "None"),
    ]
    for idx, (cid, cname, cw, vtype) in enumerate(preset_cols):
        r = COL_START + idx
        ws_fed.row_dimensions[r].height = 19
        ws_fed.cell(r, 1, cid).font = FONT_CALC_BOLD; ws_fed.cell(r, 1).alignment = ALIGN_C; ws_fed.cell(r, 1).fill = FILL_ZEBRA
        ws_fed.cell(r, 2, cname).font = FONT_INPUT; ws_fed.cell(r, 2).fill = FILL_INPUT
        c_w = ws_fed.cell(r, 3, cw); c_w.font = FONT_INPUT; c_w.fill = FILL_INPUT; c_w.number_format = "#,##0"; c_w.alignment = ALIGN_R
        c_v = ws_fed.cell(r, 4, vtype); c_v.font = FONT_INPUT; c_v.fill = FILL_INPUT; c_v.alignment = ALIGN_C

        ws_fed.cell(r, 5, 0 if idx == 0 else f"=E{r-1}+C{r-1}").number_format = "#,##0"
        ws_fed.cell(r, 6, f"=IF(C{r}>0,E{r}+C{r}/2,0)").number_format = "#,##0"
        ws_fed.cell(r, 7, f"=SUMIFS($S${FEED_START}:$S${FEED_END},$A${FEED_START}:$A${FEED_END},A{r},$E${FEED_START}:$E${FEED_END},\"Feeder\")*'02_Board_&_Busbars'!$B$16").number_format = "#,##0.0"
        ws_fed.cell(r, 8, f"=SUMIFS($S${FEED_START}:$S${FEED_END},$A${FEED_START}:$A${FEED_END},A{r},$E${FEED_START}:$E${FEED_END},\"Interconnector\")").number_format = "#,##0.0"
        ws_fed.cell(r, 9,
            f"=IF(COUNTIFS($A${FEED_START}:$A${FEED_END},A{r},$E${FEED_START}:$E${FEED_END},\"Incomer\",$F${FEED_START}:$F${FEED_END},\"Active\")>0,"
            f"(SUM($G${COL_START}:$G${COL_END})+SUM($H${COL_START}:$H${COL_END}))/MAX(1,COUNTIFS($E${FEED_START}:$E${FEED_END},\"Incomer\",$F${FEED_START}:$F${FEED_END},\"Active\")),0)"
        ).number_format = "#,##0.0"
        ws_fed.cell(r, 10, f"=SUMIFS($Y${FEED_START}:$Y${FEED_END},$A${FEED_START}:$A${FEED_END},A{r})").number_format = "#,##0.0"
        ws_fed.cell(r, 11, f"=SUMIFS('04_Busbar_Segments'!$L$18:$L$52,'04_Busbar_Segments'!$A$18:$A$52,A{r})").number_format = "#,##0.0"
        ws_fed.cell(r, 12, f"=J{r}+K{r}").number_format = "#,##0.0"

        for sc_offset, i_col in enumerate(["AD", "AE", "AF", "AG"]):
            ws_fed.cell(r, 13 + sc_offset,
                f"=SUMIFS(${i_col}${FEED_START}:${i_col}${FEED_END},$A${FEED_START}:$A${FEED_END},A{r},$E${FEED_START}:$E${FEED_END},\"Feeder\")*'02_Board_&_Busbars'!$B$16"
                f"+SUMIFS(${i_col}${FEED_START}:${i_col}${FEED_END},$A${FEED_START}:$A${FEED_END},A{r},$E${FEED_START}:$E${FEED_END},\"Interconnector\")"
            ).number_format = "#,##0.0"

        for cc in range(1, 17):
            ws_fed.cell(r, cc).border = BORDER_CELL
            if cc >= 5:
                ws_fed.cell(r, cc).font = FONT_CALC_BOLD if cc == 12 else FONT_CALC
                ws_fed.cell(r, cc).alignment = ALIGN_R
                ws_fed.cell(r, cc).fill = FILL_HERO if cc == 12 else (FILL_ZEBRA if idx % 2 else FILL_WHITE)

    dv_vbb_type = DataValidation(type="list", formula1='"None,VBB-Std,VBB-Heavy"', allow_blank=False)
    ws_fed.add_data_validation(dv_vbb_type); dv_vbb_type.add(f"D{COL_START}:D{COL_END}")

    style_section_bar(ws_fed, 15, 1, 33, "B. PROTECTIVE DEVICES, MOTOR STARTERS, EATON HRC FUSES & INTERCONNECTOR SCHEDULE")
    feed_hdrs = [
        "Col ID", "Tier #", "Tag", "Description", "Role", "Status",
        "Device / Starter / Eaton HRC Template", "Tier Height (mm)",
        "Load Mode", "Base Load (kW or A)", "N-1 Transfer (A)", "PF (cos φ)", "Eff (η)", "Duty Factor",
        "Eff. In (A)", "Eff. Pn (W)", "Eff. Fixed (W)", "Take-off EL (mm)",
        "Active I_op (A)", "(I_op/In)²", "Fixed (W)", "Variable (W)", "Takeoff & Joint (W)", "IC Cable (W)",
        "Active Total (W)",
        "Norm Total (W)", "N-1 Total (W)", "Norm+Fut (W)", "Worst-Case (W)",
        "Norm I_op (A)", "N-1 I_op (A)", "Norm+Fut I_op (A)", "Worst I_op (A)"
    ]
    ws_fed.row_dimensions[16].height = 30
    for i, h in enumerate(feed_hdrs, 1):
        c = ws_fed.cell(16, i, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C; c.border = BORDER_CELL

    preset_feeders = [
        ("COL-01", 1, "INC-A", "Main Incomer ACB 2500A (Tx-A)", "Incomer", "Active", "ACB 2500A Drawout (3P/4P)", 900, "Auto", 0, 0, 0.90, 1.00, 1.00),
        ("COL-02", 1, "M-101", "Cooling Water Pump 1 — 55 kW DOL", "Feeder", "Active", "DOL Starter 55 kW (160A frame)", 350, "kW", 55, 0, 0.87, 0.94, 0.88),
        ("COL-02", 2, "M-102", "Process Booster Pump — 37 kW DOL", "Feeder", "Active", "DOL Starter 37 kW (100A frame)", 300, "kW", 37, 0, 0.86, 0.93, 0.85),
        ("COL-02", 3, "M-103", "Extraction Fan 1 — 22 kW DOL", "Feeder", "Active", "DOL Starter 22 kW (63A frame)", 260, "kW", 22, 0, 0.85, 0.92, 0.90),
        ("COL-02", 4, "M-104", "Transfer Pump — 15 kW DOL", "Feeder", "Active", "DOL Starter 15 kW (40A frame)", 240, "kW", 15, 0, 0.84, 0.91, 0.80),
        ("COL-02", 5, "M-105 (FUT)", "Future Process Pump — 37 kW DOL", "Feeder", "Future", "DOL Starter 37 kW (100A frame)", 300, "kW", 37, 0, 0.86, 0.93, 0.85),
        ("COL-03", 1, "M-201", "Main Air Compressor — 75 kW Star-Delta", "Feeder", "Active", "Star-Delta Starter 75 kW (200A frame)", 450, "kW", 75, 0, 0.88, 0.94, 0.85),
        ("COL-03", 2, "VSD-202", "Variable Speed Blower — 45 kW VSD", "Feeder", "Active", "VSD / Inverter Drive 45 kW (2.8% loss)", 600, "kW", 45, 0, 0.95, 0.94, 0.82),
        ("COL-03", 3, "SS-203", "Chilled Water Pump — 30 kW Soft Starter", "Feeder", "Active", "Soft Starter 30 kW (Bypassed, 80A)", 350, "kW", 30, 0, 0.86, 0.93, 0.85),
        ("COL-03", 4, "VSD-204 (FUT)", "Future Dosing Blower — 15 kW VSD", "Feeder", "Future", "VSD / Inverter Drive 15 kW (3% loss)", 320, "kW", 15, 0, 0.95, 0.93, 0.85),
        ("COL-04", 1, "F-301", "Sub-DB Process Area 1 (Eaton 400NHG2B HRC)", "Feeder", "Active", "Eaton 400NHG2B — 400A NH2 gG HRC (30.0W/link)", 350, "Amps", 280, 0, 0.90, 1.00, 1.00),
        ("COL-04", 2, "F-302", "HVAC & Switchroom Cooling (250A MCCB)", "Feeder", "Active", "MCCB 250A (3P Electronic)", 280, "Amps", 165, 0, 0.90, 1.00, 1.00),
        ("COL-04", 3, "F-303", "Lighting & Small Power DB (160A MCCB)", "Feeder", "Active", "MCCB 160A (3P Electronic)", 240, "Amps", 95, 0, 0.92, 1.00, 1.00),
        ("COL-04", 4, "F-304", "Workshop Sub-Feeder (Eaton 250NHG1B HRC)", "Feeder", "Active", "Eaton 250NHG1B — 250A NH1 gG HRC (19.0W/link)", 300, "Amps", 140, 0, 0.90, 1.00, 1.00),
        ("COL-04", 5, "F-305 (FUT)", "Future Sub-DB Expansion (250A MCCB)", "Feeder", "Future", "MCCB 250A (3P Electronic)", 280, "Amps", 180, 0, 0.90, 1.00, 1.00),
        ("COL-05", 1, "IC-AB", "Interconnector to MSB-B (Firm Supply Link)", "Interconnector", "Active", "Interconnector ACB 1600A (Firm Supply)", 850, "Amps", 0, "=IF('02_Board_&_Busbars'!$B$9=\"Yes\",'00_Simple_Mode'!$B$19,850)", 0.90, 1.00, 1.00),
    ]

    for idx in range(FEED_END - FEED_START + 1):
        r = FEED_START + idx
        ws_fed.row_dimensions[r].height = 19
        is_pop = idx < len(preset_feeders)
        row_data = preset_feeders[idx] if is_pop else ("", "", "", "", "", "", "", "", "", "", "", "", "", "")

        for ci, val in enumerate(row_data, 1):
            c = ws_fed.cell(r, ci, val)
            c.font = FONT_INPUT; c.fill = FILL_INPUT; c.border = BORDER_CELL
            c.alignment = ALIGN_R if ci in (2, 8, 10, 11, 12, 13, 14) else (ALIGN_C if ci in (1, 5, 6, 9) else ALIGN_L)
            if ci in (2, 8): c.number_format = "0"
            elif ci in (10, 11): c.number_format = "#,##0.0"
            elif ci in (12, 13, 14): c.number_format = "0.00"

        ws_fed.cell(r, 15, f"=IF(G{r}=\"\",0,IFERROR(INDEX({lib_in_rng},MATCH(G{r},{lib_name_rng},0)),1))").number_format = "#,##0"
        ws_fed.cell(r, 16, f"=IF(G{r}=\"\",0,IFERROR(INDEX({lib_pn_rng},MATCH(G{r},{lib_name_rng},0)),0))").number_format = "#,##0.0"
        ws_fed.cell(r, 17, f"=IF(G{r}=\"\",0,IFERROR(INDEX({lib_fix_rng},MATCH(G{r},{lib_name_rng},0)),0))").number_format = "#,##0.0"
        ws_fed.cell(r, 18,
            f"=IF(A{r}=\"\",0,'02_Board_&_Busbars'!$B$18-(IF('02_Board_&_Busbars'!$B$21=\"Top\",'02_Board_&_Busbars'!$B$20,100)"
            f"+SUMIFS($H${FEED_START}:$H${FEED_END},$A${FEED_START}:$A${FEED_END},A{r},$B${FEED_START}:$B${FEED_END},\"<\"&B{r})+H{r}/2))"
        ).number_format = "#,##0"

        base_feeder_i = f"IF(I{r}=\"kW\",(J{r}*1000)/(SQRT(3)*'02_Board_&_Busbars'!$B$12*MAX(0.1,L{r})*MAX(0.1,M{r})),J{r})*IF(N{r}=\"\",1,N{r})"
        ws_fed.cell(r, 30, f"=IF(A{r}=\"\",0,IF(OR(E{r}=\"Spare / Placeholder\",E{r}=\"Incomer\",E{r}=\"Bus Coupler\"),0,IF(E{r}=\"Interconnector\",IF(F{r}=\"Active\",J{r},0),IF(F{r}=\"Active\",{base_feeder_i},0))))").number_format = "#,##0.0"
        ws_fed.cell(r, 31, f"=IF(A{r}=\"\",0,IF(OR(E{r}=\"Spare / Placeholder\",E{r}=\"Incomer\",E{r}=\"Bus Coupler\"),0,IF(E{r}=\"Interconnector\",K{r},IF(F{r}=\"Active\",{base_feeder_i},0))))").number_format = "#,##0.0"
        ws_fed.cell(r, 32, f"=IF(A{r}=\"\",0,IF(OR(E{r}=\"Spare / Placeholder\",E{r}=\"Incomer\",E{r}=\"Bus Coupler\"),0,IF(E{r}=\"Interconnector\",IF(F{r}=\"Active\",J{r},0),IF(F{r}=\"Active\",({base_feeder_i})*(1+'02_Board_&_Busbars'!$B$17),IF(F{r}=\"Future\",{base_feeder_i},0)))))").number_format = "#,##0.0"
        ws_fed.cell(r, 33, f"=IF(A{r}=\"\",0,IF(OR(E{r}=\"Spare / Placeholder\",E{r}=\"Incomer\",E{r}=\"Bus Coupler\"),0,IF(E{r}=\"Interconnector\",K{r},IF(F{r}=\"Active\",({base_feeder_i})*(1+'02_Board_&_Busbars'!$B$17),IF(F{r}=\"Future\",{base_feeder_i},0)))))").number_format = "#,##0.0"

        def sc_iop_expr(sc_col):
            return f"IF(E{r}=\"Incomer\",IF(F{r}=\"Active\",${sc_col}$52/MAX(1,COUNTIFS($E${FEED_START}:$E${FEED_END},\"Incomer\",$F${FEED_START}:$F${FEED_END},\"Active\")),0),{sc_col}{r})"

        ws_fed.cell(r, 19,
            f"=IF('01_Summary'!$C$9=\"Normal (N)\",{sc_iop_expr('AD')},IF('01_Summary'!$C$9=\"N-1 Firm Transfer\",{sc_iop_expr('AE')},IF('01_Summary'!$C$9=\"Normal + Future\",{sc_iop_expr('AF')},{sc_iop_expr('AG')})))"
        ).number_format = "#,##0.0"
        ws_fed.cell(r, 20, f"=IF(OR(A{r}=\"\",O{r}<=0,E{r}=\"Spare / Placeholder\"),0,(S{r}/O{r})^2)").number_format = "0.000"

        def make_loss_formula(sc_col, is_future_sc, is_n1_sc):
            iop_ref = sc_iop_expr(sc_col)
            active_expr = f"OR(F{r}=\"Active\"" + (f",F{r}=\"Future\"" if is_future_sc else "") + (f",E{r}=\"Interconnector\"" if is_n1_sc else "") + ")"
            is_on = f"IF(E{r}=\"Interconnector\",{iop_ref}>0,IF(E{r}=\"Spare / Placeholder\",Q{r}>0,{active_expr}))"
            loss_mod = f"IFERROR(INDEX({lib_mod_rng},MATCH(G{r},{lib_name_rng},0)),\"quadratic\")"
            var_part = f"IF({loss_mod}=\"vsd\",P{r}*(0.25+0.75*(({iop_ref})/MAX(1,O{r}))),P{r}*((({iop_ref})/MAX(1,O{r}))^2))"
            vbb_rac_expr = f"IF(IFERROR(INDEX($D${COL_START}:$D${COL_END},MATCH(A{r},$A${COL_START}:$A${COL_END},0)),\"VBB-Std\")=\"VBB-Heavy\",'02_Board_&_Busbars'!$D$60,'02_Board_&_Busbars'!$C$60)"
            takeoff_part = (
                f"IF(E{r}=\"Incomer\",3*(({iop_ref})^2)*'02_Board_&_Busbars'!$B$60*0.000001*0.6 + 6*(({iop_ref})^2)*'02_Board_&_Busbars'!$B$23*0.000001,"
                f"IF(OR(E{r}=\"Feeder\",E{r}=\"Interconnector\"),3*(({iop_ref})^2)*{vbb_rac_expr}*0.000001*'02_Board_&_Busbars'!$B$22 + 3*(({iop_ref})^2)*'02_Board_&_Busbars'!$B$23*0.000001,0))"
            )
            ic_cable_part = f"IF(E{r}=\"Interconnector\",3*(({iop_ref})^2)*(0.017241*(1+0.00393*50)/(3*240))*1.05*2.5,0)"
            return f"=IF(A{r}=\"\",0,IF({is_on},Q{r}+{var_part}+{takeoff_part}+{ic_cable_part},0))"

        is_act_now = f"IF(E{r}=\"Interconnector\",S{r}>0,IF(E{r}=\"Spare / Placeholder\",Q{r}>0,OR(F{r}=\"Active\",AND(F{r}=\"Future\",OR('01_Summary'!$C$9=\"Normal + Future\",'01_Summary'!$C$9=\"Worst-Case (N-1 + Future)\")))))"
        loss_mod = f"IFERROR(INDEX({lib_mod_rng},MATCH(G{r},{lib_name_rng},0)),\"quadratic\")"
        vbb_rac = f"IF(IFERROR(INDEX($D${COL_START}:$D${COL_END},MATCH(A{r},$A${COL_START}:$A${COL_END},0)),\"VBB-Std\")=\"VBB-Heavy\",'02_Board_&_Busbars'!$D$60,'02_Board_&_Busbars'!$C$60)"

        ws_fed.cell(r, 21, f"=IF(A{r}=\"\",0,IF({is_act_now},Q{r},0))").number_format = "#,##0.0"
        ws_fed.cell(r, 22, f"=IF(A{r}=\"\",0,IF({is_act_now},IF({loss_mod}=\"vsd\",P{r}*(0.25+0.75*(S{r}/MAX(1,O{r}))),P{r}*T{r}),0))").number_format = "#,##0.0"
        ws_fed.cell(r, 23,
            f"=IF(OR(A{r}=\"\",S{r}<=0),0,IF(E{r}=\"Incomer\",3*(S{r}^2)*'02_Board_&_Busbars'!$B$60*0.000001*0.6 + 6*(S{r}^2)*'02_Board_&_Busbars'!$B$23*0.000001,"
            f"IF(OR(E{r}=\"Feeder\",E{r}=\"Interconnector\"),3*(S{r}^2)*{vbb_rac}*0.000001*'02_Board_&_Busbars'!$B$22 + 3*(S{r}^2)*'02_Board_&_Busbars'!$B$23*0.000001,0)))"
        ).number_format = "#,##0.0"
        ws_fed.cell(r, 24, f"=IF(AND(E{r}=\"Interconnector\",S{r}>0),3*(S{r}^2)*(0.017241*(1+0.00393*50)/(3*240))*1.05*2.5,0)").number_format = "#,##0.0"
        ws_fed.cell(r, 25, f"=U{r}+V{r}+W{r}+X{r}").number_format = "#,##0.0"
        ws_fed.cell(r, 26, make_loss_formula("AD", False, False)).number_format = "#,##0.0"
        ws_fed.cell(r, 27, make_loss_formula("AE", False, True)).number_format = "#,##0.0"
        ws_fed.cell(r, 28, make_loss_formula("AF", True, False)).number_format = "#,##0.0"
        ws_fed.cell(r, 29, make_loss_formula("AG", True, True)).number_format = "#,##0.0"

        for cc in range(15, 34):
            ws_fed.cell(r, cc).border = BORDER_CELL; ws_fed.cell(r, cc).alignment = ALIGN_R
            ws_fed.cell(r, cc).font = FONT_CALC_BOLD if cc == 25 else FONT_CALC
            ws_fed.cell(r, cc).fill = FILL_HERO if cc == 25 else (FILL_ZEBRA if idx % 2 else FILL_WHITE)

    r_tot = FEED_END + 1
    ws_fed.row_dimensions[r_tot].height = 22
    ws_fed.cell(r_tot, 1, "TOTAL").font = FONT_TOTAL
    ws_fed.merge_cells(start_row=r_tot, start_column=1, end_row=r_tot, end_column=14)
    ws_fed.cell(r_tot, 1).alignment = ALIGN_R
    for cc in range(1, 34):
        ws_fed.cell(r_tot, cc).fill = FILL_TOTAL; ws_fed.cell(r_tot, cc).border = BORDER_TOTAL; ws_fed.cell(r_tot, cc).font = FONT_TOTAL
    for cc in [21, 22, 23, 24, 25, 26, 27, 28, 29]:
        cl = get_column_letter(cc)
        c = ws_fed.cell(r_tot, cc, f"=SUM({cl}{FEED_START}:{cl}{FEED_END})"); c.number_format = "#,##0.0"; c.alignment = ALIGN_R
    for cc in [30, 31, 32, 33]:
        cl = get_column_letter(cc)
        c = ws_fed.cell(r_tot, cc,
            f"=SUMIFS({cl}{FEED_START}:{cl}{FEED_END},$E${FEED_START}:$E${FEED_END},\"Feeder\")*'02_Board_&_Busbars'!$B$16"
            f"+SUMIFS({cl}{FEED_START}:{cl}{FEED_END},$E${FEED_START}:$E${FEED_END},\"Interconnector\")"
        ); c.number_format = "#,##0.0"; c.alignment = ALIGN_R

    # Hidden GA Key col AH
    ws_fed.cell(16, 34, "GA_Key")
    for r in range(FEED_START, FEED_END + 1):
        ws_fed.cell(r, 34, f"=IF(A{r}=\"\",\"\",A{r}&\"|\"&B{r})")
    ws_fed.column_dimensions["AH"].hidden = True

    for dv, rng in [
        (DataValidation(type="list", formula1=f"=$A${COL_START}:$A${COL_END}", allow_blank=True), f"A{FEED_START}:A{FEED_END}"),
        (DataValidation(type="list", formula1='"Feeder,Incomer,Bus Coupler,Interconnector,Spare / Placeholder"', allow_blank=True), f"E{FEED_START}:E{FEED_END}"),
        (DataValidation(type="list", formula1='"Active,Future,Standby"', allow_blank=True), f"F{FEED_START}:F{FEED_END}"),
        (DataValidation(type="list", formula1=f"={lib_name_rng}", allow_blank=True), f"G{FEED_START}:G{FEED_END}"),
        (DataValidation(type="list", formula1='"kW,Amps,Auto"', allow_blank=True), f"I{FEED_START}:I{FEED_END}"),
    ]:
        ws_fed.add_data_validation(dv); dv.add(rng)

    for i, w in enumerate([10, 7, 14, 34, 15, 10, 42, 12, 10, 12, 12, 9, 9, 10, 10, 10, 10, 12, 12, 10, 11, 11, 13, 11, 14, 12, 12, 12, 12, 11, 11, 12, 11], 1):
        ws_fed.column_dimensions[get_column_letter(i)].width = w
    ws_fed.freeze_panes = "D17"
    configure_print(ws_fed, landscape=True, fit_width=1, repeat_rows="15:16")

    # =========================================================================
    # SHEET 04: 04_Busbar_Segments (STRICTLY PROTECTED CALCULATION ENGINE)
    # =========================================================================
    style_title_banner(
        ws_seg, 16,
        "PROTECTED CALCULATION ENGINE — HORIZONTAL & VERTICAL BUSBAR SEGMENTS (W/m)",
        "This calculation sheet is protected against modification & copying (formulas hidden). See tab '08_Calc_Help_&_Method' for full governing equations & worked examples."
    )
    style_section_bar(ws_seg, 4, 1, 16, "A. MAIN HORIZONTAL BUSBAR (HBB) SEGMENTS — COLUMN-TO-COLUMN SPANS")
    hbb_hdrs = [
        "From Col", "To Col", "Span Length (m)", "Active Current (A)", "Direction",
        "Utilization %", "Per-Phase (W/m)", "3-Phase + N (W/m)", "Busbar Loss (W)",
        "Splice Joint (W)", "Active Span Total (W)",
        "Norm Span (W)", "N-1 Span (W)", "Norm+Fut (W)", "Worst-Case (W)", "N-1 Current (A)"
    ]
    ws_seg.row_dimensions[5].height = 26
    for i, h in enumerate(hbb_hdrs, 1):
        c = ws_seg.cell(5, i, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C; c.border = BORDER_CELL

    for idx in range(7):
        r = HBB_START + idx
        c_from_row = COL_START + idx
        c_to_row = COL_START + idx + 1
        ws_seg.row_dimensions[r].height = 19
        ws_seg.cell(r, 1, f"='03_Feeder_Schedule'!A{c_from_row}").alignment = ALIGN_C
        ws_seg.cell(r, 2, f"='03_Feeder_Schedule'!A{c_to_row}").alignment = ALIGN_C
        ws_seg.cell(r, 3, f"=IF('03_Feeder_Schedule'!C{c_to_row}>0,('03_Feeder_Schedule'!F{c_to_row}-'03_Feeder_Schedule'!F{c_from_row})/1000,0)").number_format = "0.00"
        signed_act = f"(SUM('03_Feeder_Schedule'!$I${COL_START}:I{c_from_row})-SUM('03_Feeder_Schedule'!$G${COL_START}:G{c_from_row})-SUM('03_Feeder_Schedule'!$H${COL_START}:H{c_from_row}))"
        ws_seg.cell(r, 4, f"=IF(C{r}>0,ABS({signed_act}),0)").number_format = "#,##0.0"
        ws_seg.cell(r, 5, f"=IF(D{r}<0.1,\"Idle\",IF({signed_act}>=0,\"→ Right\",\"← Left\"))").alignment = ALIGN_C
        ws_seg.cell(r, 6, f"=IF('02_Board_&_Busbars'!$B$38>0,D{r}/'02_Board_&_Busbars'!$B$38,0)").number_format = "0.0%"
        ws_seg.cell(r, 7, f"=(D{r}^2)*'02_Board_&_Busbars'!$B$60*0.000001").number_format = "#,##0.0"
        ws_seg.cell(r, 8, f"=3*G{r}+IF(AND('02_Board_&_Busbars'!$B$14=\"3P+N\",'02_Board_&_Busbars'!$B$61>0),(('02_Board_&_Busbars'!$B$15*D{r})^2)*'02_Board_&_Busbars'!$B$61*0.000001,0)").number_format = "#,##0.0"
        ws_seg.cell(r, 9, f"=H{r}*C{r}").number_format = "#,##0.0"
        ws_seg.cell(r, 10, f"=IF(C{r}>0,3*(D{r}^2)*'02_Board_&_Busbars'!$B$23*0.000001,0)").number_format = "#,##0.0"
        ws_seg.cell(r, 11, f"=I{r}+J{r}").number_format = "#,##0.0"

        inc_frac = f"(COUNTIFS('03_Feeder_Schedule'!$A${FEED_START}:$A${FEED_END},\"<=\"&A{r},'03_Feeder_Schedule'!$E${FEED_START}:$E${FEED_END},\"Incomer\",'03_Feeder_Schedule'!$F${FEED_START}:$F${FEED_END},\"Active\")/MAX(1,COUNTIFS('03_Feeder_Schedule'!$E${FEED_START}:$E${FEED_END},\"Incomer\",'03_Feeder_Schedule'!$F${FEED_START}:$F${FEED_END},\"Active\")))"
        for sc_idx, load_col in enumerate(["M", "N", "O", "P"]):
            seg_i = f"ABS(SUM('03_Feeder_Schedule'!${load_col}${COL_START}:${load_col}${COL_END})*{inc_frac}-SUM('03_Feeder_Schedule'!${load_col}${COL_START}:{load_col}{c_from_row}))"
            w_m = f"(3*({seg_i}^2)*'02_Board_&_Busbars'!$B$60*0.000001+IF(AND('02_Board_&_Busbars'!$B$14=\"3P+N\",'02_Board_&_Busbars'!$B$61>0),(('02_Board_&_Busbars'!$B$15*{seg_i})^2)*'02_Board_&_Busbars'!$B$61*0.000001,0))"
            j_w = f"(3*({seg_i}^2)*'02_Board_&_Busbars'!$B$23*0.000001)"
            ws_seg.cell(r, 12 + sc_idx, f"=IF(C{r}>0,{w_m}*C{r}+{j_w},0)").number_format = "#,##0.0"
            if sc_idx == 1:
                ws_seg.cell(r, 16, f"=IF(C{r}>0,{seg_i},0)").number_format = "#,##0.0"

        for cc in range(1, 17):
            ws_seg.cell(r, cc).border = BORDER_CELL
            if cc not in (1, 2, 5): ws_seg.cell(r, cc).alignment = ALIGN_R
            ws_seg.cell(r, cc).font = FONT_CALC_BOLD if cc == 11 else FONT_CALC
            ws_seg.cell(r, cc).fill = FILL_HERO if cc == 11 else (FILL_ZEBRA if idx % 2 else FILL_WHITE)

    ws_seg.row_dimensions[13].height = 22
    ws_seg.cell(13, 1, "TOTAL HBB"); ws_seg.merge_cells("A13:B13")
    ws_seg.cell(13, 3, "=SUM(C6:C12)").number_format = "0.00"
    ws_seg.cell(13, 4, "=MAX(D6:D12)").number_format = "#,##0.0"
    ws_seg.cell(13, 5, "Peak A").alignment = ALIGN_C
    ws_seg.cell(13, 6, "=MAX(F6:F12)").number_format = "0.0%"
    ws_seg.cell(13, 7, "=MAX(G6:G12)").number_format = "#,##0.0"
    ws_seg.cell(13, 8, "=MAX(H6:H12)").number_format = "#,##0.0"
    for cc in [9, 10, 11, 12, 13, 14, 15]:
        cl = get_column_letter(cc); ws_seg.cell(13, cc, f"=SUM({cl}6:{cl}12)").number_format = "#,##0.0"
    ws_seg.cell(13, 16, "=MAX(P6:P12)").number_format = "#,##0.0"
    for cc in range(1, 17):
        ws_seg.cell(13, cc).fill = FILL_TOTAL; ws_seg.cell(13, cc).border = BORDER_TOTAL; ws_seg.cell(13, cc).font = FONT_TOTAL
        if cc not in (1, 2, 5): ws_seg.cell(13, cc).alignment = ALIGN_R

    ws_seg.conditional_formatting.add("F6:F12", CellIsRule(operator="greaterThan", formula=["1"], stopIfTrue=True, fill=FILL_WARN, font=Font(bold=True, color=WARN_FG)))

    style_section_bar(ws_seg, 16, 1, 16, "B. VERTICAL DROPPER BUSBAR (VBB) SEGMENTS — TAPERING MULTI-TIER TAKE-OFFS")
    vbb_hdrs = [
        "Col ID", "Tier #", "To Compartment", "Take-off EL (mm)", "Span Length Δy (m)",
        "VBB Type", "VBB R_AC (µΩ/m)", "Tapering Current (A)", "Utilization %",
        "Per-Phase (W/m)", "3-Phase + N (W/m)", "Active Span Loss (W)",
        "Norm VBB (W)", "N-1 VBB (W)", "Norm+Fut VBB (W)", "Worst-Case VBB (W)"
    ]
    ws_seg.row_dimensions[17].height = 26
    for i, h in enumerate(vbb_hdrs, 1):
        c = ws_seg.cell(17, i, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C; c.border = BORDER_CELL

    for idx in range(FEED_END - FEED_START + 1):
        r = VBB_START + idx
        fr = FEED_START + idx
        ws_seg.row_dimensions[r].height = 19
        is_vbb_tier = f"AND('03_Feeder_Schedule'!A{fr}<>\"\",OR('03_Feeder_Schedule'!E{fr}=\"Feeder\",'03_Feeder_Schedule'!E{fr}=\"Interconnector\"))"
        ws_seg.cell(r, 1, f"=IF({is_vbb_tier},'03_Feeder_Schedule'!A{fr},\"\")").alignment = ALIGN_C
        ws_seg.cell(r, 2, f"=IF({is_vbb_tier},'03_Feeder_Schedule'!B{fr},\"\")").alignment = ALIGN_C
        ws_seg.cell(r, 3, f"=IF({is_vbb_tier},'03_Feeder_Schedule'!C{fr},\"\")").alignment = ALIGN_L
        ws_seg.cell(r, 4, f"=IF({is_vbb_tier},'03_Feeder_Schedule'!R{fr},0)").number_format = "#,##0"
        ws_seg.cell(r, 5,
            f"=IF(NOT({is_vbb_tier}),0,IF(B{r}=1,ABS(('02_Board_&_Busbars'!$B$18-IF('02_Board_&_Busbars'!$B$21=\"Top\",'02_Board_&_Busbars'!$B$20/2,'02_Board_&_Busbars'!$B$18-'02_Board_&_Busbars'!$B$20/2))-D{r})/1000,"
            f"(('03_Feeder_Schedule'!H{fr}/2)+SUMIFS('03_Feeder_Schedule'!$H${FEED_START}:$H${FEED_END},'03_Feeder_Schedule'!$A${FEED_START}:$A${FEED_END},A{r},'03_Feeder_Schedule'!$B${FEED_START}:$B${FEED_END},B{r}-1)/2)/1000))"
        ).number_format = "0.00"
        ws_seg.cell(r, 6, f"=IF(A{r}=\"\",\"\",IFERROR(INDEX('03_Feeder_Schedule'!$D${COL_START}:$D${COL_END},MATCH(A{r},'03_Feeder_Schedule'!$A${COL_START}:$A${COL_END},0)),\"VBB-Std\"))").alignment = ALIGN_C
        ws_seg.cell(r, 7, f"=IF(F{r}=\"VBB-Heavy\",'02_Board_&_Busbars'!$D$60,IF(F{r}=\"VBB-Std\",'02_Board_&_Busbars'!$C$60,0))").number_format = "0.00"
        ws_seg.cell(r, 8,
            f"=IF(A{r}=\"\",0,SUMIFS('03_Feeder_Schedule'!$S${FEED_START}:$S${FEED_END},'03_Feeder_Schedule'!$A${FEED_START}:$A${FEED_END},A{r},'03_Feeder_Schedule'!$B${FEED_START}:$B${FEED_END},\">=\"&B{r},'03_Feeder_Schedule'!$E${FEED_START}:$E${FEED_END},\"Feeder\")*'02_Board_&_Busbars'!$B$16"
            f"+SUMIFS('03_Feeder_Schedule'!$S${FEED_START}:$S${FEED_END},'03_Feeder_Schedule'!$A${FEED_START}:$A${FEED_END},A{r},'03_Feeder_Schedule'!$B${FEED_START}:$B${FEED_END},\">=\"&B{r},'03_Feeder_Schedule'!$E${FEED_START}:$E${FEED_END},\"Interconnector\"))"
        ).number_format = "#,##0.0"
        ws_seg.cell(r, 9, f"=IF(A{r}=\"\",0,H{r}/IF(F{r}=\"VBB-Heavy\",'02_Board_&_Busbars'!$D$38,'02_Board_&_Busbars'!$C$38))").number_format = "0.0%"
        ws_seg.cell(r, 10, f"=(H{r}^2)*G{r}*0.000001").number_format = "#,##0.0"
        vbb_rn = f"IF(F{r}=\"VBB-Heavy\",'02_Board_&_Busbars'!$D$61,'02_Board_&_Busbars'!$C$61)"
        ws_seg.cell(r, 11, f"=3*J{r}+IF(AND('02_Board_&_Busbars'!$B$14=\"3P+N\",{vbb_rn}>0),(('02_Board_&_Busbars'!$B$15*H{r})^2)*{vbb_rn}*0.000001,0)").number_format = "#,##0.0"
        ws_seg.cell(r, 12, f"=K{r}*E{r}").number_format = "#,##0.0"

        for sc_idx, i_col in enumerate(["AD", "AE", "AF", "AG"]):
            tap_i = (
                f"(SUMIFS('03_Feeder_Schedule'!${i_col}${FEED_START}:${i_col}${FEED_END},'03_Feeder_Schedule'!$A${FEED_START}:$A${FEED_END},A{r},'03_Feeder_Schedule'!$B${FEED_START}:$B${FEED_END},\">=\"&B{r},'03_Feeder_Schedule'!$E${FEED_START}:$E${FEED_END},\"Feeder\")*'02_Board_&_Busbars'!$B$16"
                f"+SUMIFS('03_Feeder_Schedule'!${i_col}${FEED_START}:${i_col}${FEED_END},'03_Feeder_Schedule'!$A${FEED_START}:$A${FEED_END},A{r},'03_Feeder_Schedule'!$B${FEED_START}:$B${FEED_END},\">=\"&B{r},'03_Feeder_Schedule'!$E${FEED_START}:$E${FEED_END},\"Interconnector\"))"
            )
            ws_seg.cell(r, 13 + sc_idx,
                f"=IF(A{r}=\"\",0,(3*({tap_i}^2)*G{r}*0.000001+IF(AND('02_Board_&_Busbars'!$B$14=\"3P+N\",{vbb_rn}>0),(('02_Board_&_Busbars'!$B$15*{tap_i})^2)*{vbb_rn}*0.000001,0))*E{r})"
            ).number_format = "#,##0.0"

        for cc in range(1, 17):
            ws_seg.cell(r, cc).border = BORDER_CELL
            if cc not in (1, 2, 3, 6): ws_seg.cell(r, cc).alignment = ALIGN_R
            ws_seg.cell(r, cc).font = FONT_CALC_BOLD if cc == 12 else FONT_CALC
            ws_seg.cell(r, cc).fill = FILL_HERO if cc == 12 else (FILL_ZEBRA if idx % 2 else FILL_WHITE)

    ws_seg.row_dimensions[53].height = 22
    ws_seg.cell(53, 1, "TOTAL VBB"); ws_seg.merge_cells("A53:D53")
    ws_seg.cell(53, 5, f"=SUM(E{VBB_START}:E{VBB_END})").number_format = "0.00"
    ws_seg.cell(53, 8, f"=MAX(H{VBB_START}:H{VBB_END})").number_format = "#,##0.0"
    ws_seg.cell(53, 9, f"=MAX(I{VBB_START}:I{VBB_END})").number_format = "0.0%"
    ws_seg.cell(53, 11, f"=MAX(K{VBB_START}:K{VBB_END})").number_format = "#,##0.0"
    for cc in [12, 13, 14, 15, 16]:
        cl = get_column_letter(cc); ws_seg.cell(53, cc, f"=SUM({cl}{VBB_START}:{cl}{VBB_END})").number_format = "#,##0.0"
    for cc in range(1, 17):
        ws_seg.cell(53, cc).fill = FILL_TOTAL; ws_seg.cell(53, cc).border = BORDER_TOTAL; ws_seg.cell(53, cc).font = FONT_TOTAL
        if cc > 4: ws_seg.cell(53, cc).alignment = ALIGN_R

    for i, w in enumerate([11, 10, 18, 15, 14, 12, 14, 15, 13, 13, 15, 15, 13, 13, 13, 14], 1):
        ws_seg.column_dimensions[get_column_letter(i)].width = w
    ws_seg.freeze_panes = "A6"
    configure_print(ws_seg, landscape=True, fit_width=1)

    # =========================================================================
    # SHEET 05: 05_GA_Heat_Map (PROTECTED)
    # =========================================================================
    style_title_banner(
        ws_ga, 10,
        "GENERAL ARRANGEMENT (GA) ELEVATION BLOCK DIAGRAM & THERMAL HEATMAP",
        "Auto-populated from 03_Feeder_Schedule & 04_Busbar_Segments. Sheet is protected against accidental edits."
    )
    ws_ga.cell(4, 1, "ELEVATION ZONE").font = FONT_HEADER; ws_ga.cell(4, 1).fill = FILL_HEADER; ws_ga.cell(4, 1).alignment = ALIGN_C; ws_ga.cell(4, 1).border = BORDER_CELL
    ws_ga.row_dimensions[4].height = 24; ws_ga.row_dimensions[5].height = 20; ws_ga.row_dimensions[6].height = 26
    ws_ga.cell(5, 1, "Cubicle Width (mm)").font = FONT_CALC_BOLD; ws_ga.cell(5, 1).fill = FILL_ZEBRA; ws_ga.cell(5, 1).border = BORDER_CELL
    ws_ga.cell(6, 1, "Main HBB Span (W/m)").font = FONT_CALC_BOLD; ws_ga.cell(6, 1).fill = FILL_HERO; ws_ga.cell(6, 1).border = BORDER_CELL

    for ci in range(8):
        col_num = 2 + ci; cr = COL_START + ci
        c_hdr = ws_ga.cell(4, col_num, f"=IF('03_Feeder_Schedule'!B{cr}<>\"\",'03_Feeder_Schedule'!B{cr},'03_Feeder_Schedule'!A{cr}&\" (Unused)\")")
        c_hdr.font = FONT_HEADER; c_hdr.fill = FILL_SECTION; c_hdr.alignment = ALIGN_C; c_hdr.border = BORDER_CELL
        c_w = ws_ga.cell(5, col_num, f"='03_Feeder_Schedule'!C{cr}"); c_w.font = FONT_CALC_BOLD; c_w.fill = FILL_ZEBRA; c_w.alignment = ALIGN_C; c_w.border = BORDER_CELL; c_w.number_format = "#,##0\" mm\""
        c_hb = ws_ga.cell(6, col_num, f"='04_Busbar_Segments'!H{HBB_START + ci}" if ci < 7 else 0)
        c_hb.number_format = "0.0\" W/m\"" if ci < 7 else "\"End\""; c_hb.font = FONT_CALC_BOLD; c_hb.alignment = ALIGN_C; c_hb.border = BORDER_CELL

    key_rng = f"'03_Feeder_Schedule'!$AH${FEED_START}:$AH${FEED_END}"
    tag_rng = f"'03_Feeder_Schedule'!$C${FEED_START}:$C${FEED_END}"
    iop_rng = f"'03_Feeder_Schedule'!$S${FEED_START}:$S${FEED_END}"
    el_rng  = f"'03_Feeder_Schedule'!$R${FEED_START}:$R${FEED_END}"
    w_rng   = f"'03_Feeder_Schedule'!$Y${FEED_START}:$Y${FEED_END}"

    for tier_n in range(1, 9):
        r_lbl = 7 + (tier_n - 1) * 2; r_val = r_lbl + 1
        ws_ga.row_dimensions[r_lbl].height = 30; ws_ga.row_dimensions[r_val].height = 19
        ws_ga.cell(r_lbl, 1, f"Tier {tier_n}\n(Tag & Load)").font = FONT_CALC_BOLD; ws_ga.cell(r_lbl, 1).fill = FILL_ZEBRA; ws_ga.cell(r_lbl, 1).alignment = ALIGN_C; ws_ga.cell(r_lbl, 1).border = BORDER_CELL
        ws_ga.cell(r_val, 1, f"Tier {tier_n} Heat (W)").font = FONT_HINT; ws_ga.cell(r_val, 1).fill = FILL_WHITE; ws_ga.cell(r_val, 1).alignment = ALIGN_C; ws_ga.cell(r_val, 1).border = BORDER_CELL
        for ci in range(8):
            col_num = 2 + ci; key_str = f"\"COL-0{ci+1}|{tier_n}\""
            c_box = ws_ga.cell(r_lbl, col_num,
                f"=IFERROR(INDEX({tag_rng},MATCH({key_str},{key_rng},0))&CHAR(10)&TEXT(INDEX({iop_rng},MATCH({key_str},{key_rng},0)),\"0\")&\" A  |  EL+\"&TEXT(INDEX({el_rng},MATCH({key_str},{key_rng},0)),\"0\"),\"—\")"
            )
            c_box.font = FONT_CALC_BOLD; c_box.fill = FILL_ZEBRA; c_box.alignment = ALIGN_C; c_box.border = BORDER_CELL
            c_w = ws_ga.cell(r_val, col_num, f"=IFERROR(INDEX({w_rng},MATCH({key_str},{key_rng},0)),0)")
            c_w.font = FONT_CALC_BOLD; c_w.alignment = ALIGN_C; c_w.border = BORDER_CELL; c_w.number_format = "#,##0.0\" W\";;\"-\""

    for offset, (lbl_txt, src_col, nf) in enumerate([
        ("Col Net Load / Supply (A)", "G", "#,##0.0\" A\""),
        ("Col Vertical Busbar (W)", "K", "#,##0.0\" W\""),
        ("COLUMN TOTAL HEAT (W)", "L", "#,##0.0\" W\""),
    ]):
        rr = 23 + offset; ws_ga.row_dimensions[rr].height = 22
        ws_ga.cell(rr, 1, lbl_txt).font = FONT_TOTAL if offset == 2 else FONT_CALC_BOLD
        ws_ga.cell(rr, 1).fill = FILL_TOTAL if offset == 2 else FILL_ZEBRA; ws_ga.cell(rr, 1).border = BORDER_TOTAL if offset == 2 else BORDER_CELL
        for ci in range(8):
            cr = COL_START + ci; col_num = 2 + ci
            formula = f"=MAX('03_Feeder_Schedule'!G{cr}+'03_Feeder_Schedule'!H{cr},'03_Feeder_Schedule'!I{cr})" if offset == 0 else f"='03_Feeder_Schedule'!{src_col}{cr}"
            c = ws_ga.cell(rr, col_num, formula); c.font = FONT_TOTAL if offset == 2 else FONT_CALC; c.fill = FILL_HERO if offset == 2 else FILL_WHITE; c.alignment = ALIGN_C; c.border = BORDER_TOTAL if offset == 2 else BORDER_CELL; c.number_format = nf

    heat_rule = ColorScaleRule(start_type="num", start_value=0, start_color="E0F2FE", mid_type="num", mid_value=150, mid_color="FEF08A", end_type="num", end_value=800, end_color="FCA5A5")
    ws_ga.conditional_formatting.add("B6:H6", heat_rule)
    for tier_n in range(1, 9):
        ws_ga.conditional_formatting.add(f"B{8 + (tier_n - 1) * 2}:I{8 + (tier_n - 1) * 2}", heat_rule)
    ws_ga.column_dimensions["A"].width = 22
    for ci in range(8): ws_ga.column_dimensions[get_column_letter(2 + ci)].width = 21
    ws_ga.column_dimensions["J"].width = 4
    ws_ga.freeze_panes = "B7"
    configure_print(ws_ga, landscape=True, fit_width=1, fit_height=1)

    # =========================================================================
    # SHEET 07: 07_Room_Ventilation (Switchroom Size, Airflow, ACH & Verdict)
    # =========================================================================
    style_title_banner(
        ws_rm, 6,
        "SWITCHROOM COOLING, AIRFLOW, AIR CHANGE RATE (ACH) & VENTILATION ASSESSMENT",
        "Evaluates required cooling airflow (m³/s, L/s, m³/h, CFM), ACH, and Natural Stack Buoyancy vs Mechanical Ventilation vs Active Air Conditioning (CIBSE Guide A)."
    )

    style_section_bar(ws_rm, 4, 1, 6, "A. SWITCHROOM GEOMETRY, TEMPERATURES & LOUVER INPUTS (BLUE = EDITABLE)")
    ws_rm.row_dimensions[5].height = 22
    for idx, h in enumerate(["Parameter", "Input Value", "Unit", "Typical Values & Guidance"], 1):
        if idx == 4: ws_rm.merge_cells(start_row=5, start_column=4, end_row=5, end_column=6)
        c = ws_rm.cell(5, idx, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C if idx in (2, 3) else ALIGN_L; c.border = BORDER_CELL
    for cc in (5, 6): ws_rm.cell(5, cc).fill = FILL_HEADER; ws_rm.cell(5, cc).border = BORDER_CELL

    # Fixed rows: B6=L, B7=W, B8=H, B9=T_amb, B10=T_max, B11=Other_kW, B12=LouverFreeM2, B13=StackH, B14=Cd, B15=UseOverride, B16=OverrideKW
    rm_inputs = [
        (6,  "Room Length (L)", 5.0, "m", "0.0", "Example: 5.0 m (5 × 5 × 9 m = 225 m³ switchroom)"),
        (7,  "Room Width (W)", 5.0, "m", "0.0", "Example: 5.0 m"),
        (8,  "Room Height (H)", 9.0, "m", "0.0", "Example: 9.0 m (tall industrial switchroom; typical substation: 3.5–4.5 m)"),
        (9,  "Outdoor / Supply Air Design Temp (T_amb)", 25.0, "°C", "0.0", "Typ: 25–28 °C UK summer design, 30–35 °C warm industrial"),
        (10, "Max Permitted Room Temperature (T_max)", 35.0, "°C", "0.0", "IEC 61439-1 standard: 35 °C 24h average / 40 °C peak"),
        (11, "Other Room Heat Gains (Tx, UPS, Lighting)", 0.0, "kW", "0.00", "Additional sensible heat inside same room (e.g. 0.5 kW lighting/UPS)"),
        (12, "Natural Louver Free Area (Each: Inlet & Exhaust)", 0.50, "m²", "0.00", "Net aerodynamic free area (~50% of gross weather louver face area)"),
        (13, "Vertical Stack Height Between Louvers (H_stack)", 6.0, "m", "0.0", "Height between low inlet & high exhaust centrelines (Typ: H − 1.5 m)"),
        (14, "Louver Discharge Coefficient (Cd)", 0.60, "-", "0.00", "Typ: 0.60 standard orifice/louver discharge coefficient (CIBSE AM10)"),
        (15, "Use Manual Heat Override for What-If Test?", "No", "-", "@", "No = Auto-linked from 01_Summary kW! Set 'Yes' to test e.g. 6.0 kW directly."),
        (16, "Manual Test Switchgear Heat Load (if Override=Yes)", 6.0, "kW", "0.00", "Example: Enter 6.0 kW with Override = Yes to test 6 kW in a 5×5×9 m room!"),
    ]
    for r, name, val, unit, nf, hint in rm_inputs:
        ws_rm.row_dimensions[r].height = 20
        ws_rm.cell(r, 1, name).font = FONT_CALC_BOLD; ws_rm.cell(r, 1).fill = FILL_ZEBRA if r % 2 else FILL_WHITE; ws_rm.cell(r, 1).border = BORDER_CELL
        cv = ws_rm.cell(r, 2, val); cv.font = FONT_INPUT; cv.fill = FILL_INPUT; cv.border = BORDER_CELL
        cv.alignment = ALIGN_C if isinstance(val, str) else ALIGN_R; cv.number_format = nf
        ws_rm.cell(r, 3, unit).font = FONT_CALC; ws_rm.cell(r, 3).fill = FILL_ZEBRA if r % 2 else FILL_WHITE; ws_rm.cell(r, 3).alignment = ALIGN_C; ws_rm.cell(r, 3).border = BORDER_CELL
        ws_rm.merge_cells(start_row=r, start_column=4, end_row=r, end_column=6)
        ws_rm.cell(r, 4, hint).font = FONT_HINT; ws_rm.cell(r, 4).fill = FILL_ZEBRA if r % 2 else FILL_WHITE
        for cc in range(4, 7): ws_rm.cell(r, cc).border = BORDER_CELL
    dv_rm_ov = DataValidation(type="list", formula1='"No,Yes"', allow_blank=False)
    ws_rm.add_data_validation(dv_rm_ov); dv_rm_ov.add("B15")

    style_section_bar(ws_rm, 17, 1, 6, "B. CALCULATED COOLING AIRFLOW, AIR CHANGE RATE (ACH) & NATURAL VENTILATION CHECK")
    # Rows 18..29:
    # B18=Room Volume m3, B19=Total Design Heat Load kW, B20=Allowable dT K & rho*cp,
    # B21=Required Airflow L/s, B22=Required Airflow m3/h, B23=Required Airflow m3/s & CFM,
    # B24=Air Change Rate ACH, B25=Natural Stack Flow m3/h, B26=Natural Stack Cooling Capacity kW,
    # B27=Est. Room Temp under Natural Louvers Alone °C, B28=ENGINEERING VERDICT!
    rm_calcs = [
        (18, "Switchroom Volume (V = L × W × H)", "=B6*B7*B8", "m³", "#,##0.0", "Floor area = L × W (e.g. 5×5×9 = 225 m³)"),
        (19, "Total Design Heat Load (Q_design)", "=IF(B15=\"Yes\",B16,'01_Summary'!A13)*(1+'02_Board_&_Busbars'!B26)+B11", "kW", "0.000", "Includes HVAC safety margin + Other Room Heat Gains"),
        (20, "Allowable Temperature Rise (ΔT = T_max − T_amb)", "=B10-B9", "K (°C)", "0.0", "Must be > 2 K for outside-air ventilation; otherwise Active AC required"),
        (21, "Required Cooling Airflow (Litres / second)", "=IF(B20>0.5,(B19/((353/((B9+B10)/2+273.15))*1.005*B20))*1000,0)", "L/s", "#,##0", "Sensible heat balance: V̇ = Q / (ρ · cp · ΔT)"),
        (22, "Required Cooling Airflow (m³ / hour)", "=B21*3.6", "m³/h", "#,##0", "Used to size mechanical extract/supply fans"),
        (23, "Required Cooling Airflow (CFM)", "=B22*0.58858", "CFM", "#,##0", "Cubic Feet per Minute equivalent"),
        (24, "Required Air Change Rate (ACH)", "=IF(B18>0,B22/B18,0)", "ACH", "0.00", "ACH = Airflow (m³/h) / Room Volume (m³). Natural ≤6 ACH; Mech ≤20 ACH"),
        (25, "Natural Stack Buoyancy Airflow (V̇_nat)", "=IF(B20>0.5,B14*(B12/SQRT(2))*SQRT(2*9.81*B13*B20/(B9+273.15))*3600,0)", "m³/h", "#,##0", "CIBSE Guide A stack effect with specified low/high louvers"),
        (26, "Natural Ventilation Heat Capacity (Q_nat)", "=IF(B20>0.5,(B25/3600)*(353/((B9+B10)/2+273.15))*1.005*B20,0)", "kW", "0.00", "Maximum heat (kW) natural stack louvers can reject at ΔT"),
        (27, "Est. Steady Room Temp (Natural Louvers Only)", "=IF(AND(B19>0,B12>0,B13>0),B9+(B19/(B14*(B12/SQRT(2))*(353/((B9+B10)/2+273.15))*1.005*SQRT(2*9.81*B13/(B9+273.15))))^(2/3),B9)", "°C", "0.0", "Estimated equilibrium room temperature without fans or AC"),
        (28, "VENTILATION & COOLING VERDICT",
         "=IF(B20<=2,\"ACTIVE COOLING (AIR CONDITIONING) REQUIRED — Ambient too close to T_max\","
         "IF(AND(B25>=B22,B24<=6),\"NATURAL VENTILATION SUFFICIENT (verify louver free area & fire dampers)\","
         "IF(AND(B24<=20,B20>=5),\"MECHANICAL VENTILATION (FORCED EXTRACT FANS) REQUIRED\","
         "\"ACTIVE COOLING (AIR CONDITIONING) RECOMMENDED — High ACH / Narrow ΔT\")))",
         "-", "@", "Automatic recommendation based on CIBSE Guide A & ACH limits"),
    ]
    for r, name, form, unit, nf, hint in rm_calcs:
        ws_rm.row_dimensions[r].height = 26 if r == 28 else 20
        is_key = r in (19, 21, 24, 28)
        ws_rm.cell(r, 1, name).font = FONT_TOTAL if is_key else FONT_CALC_BOLD
        ws_rm.cell(r, 1).fill = FILL_HERO if is_key else (FILL_ZEBRA if r % 2 else FILL_WHITE)
        ws_rm.cell(r, 1).border = BORDER_TOTAL if r == 28 else BORDER_CELL
        if r == 28:
            ws_rm.merge_cells("B28:F28")
            cv = ws_rm.cell(28, 2, form)
            cv.font = Font(name=FONT_FAMILY, size=11, bold=True, color=NAVY_DARK)
            cv.fill = FILL_HERO; cv.alignment = ALIGN_C
            for cc in range(2, 7): ws_rm.cell(28, cc).border = BORDER_TOTAL
        else:
            cv = ws_rm.cell(r, 2, form); cv.font = FONT_TOTAL if is_key else FONT_CALC_BOLD
            cv.fill = FILL_HERO if is_key else (FILL_ZEBRA if r % 2 else FILL_WHITE)
            cv.alignment = ALIGN_R; cv.number_format = nf; cv.border = BORDER_CELL
            ws_rm.cell(r, 3, unit).font = FONT_CALC; ws_rm.cell(r, 3).fill = FILL_HERO if is_key else (FILL_ZEBRA if r % 2 else FILL_WHITE); ws_rm.cell(r, 3).alignment = ALIGN_C; ws_rm.cell(r, 3).border = BORDER_CELL
            ws_rm.merge_cells(start_row=r, start_column=4, end_row=r, end_column=6)
            ws_rm.cell(r, 4, hint).font = FONT_HINT; ws_rm.cell(r, 4).fill = FILL_HERO if is_key else (FILL_ZEBRA if r % 2 else FILL_WHITE)
            for cc in range(4, 7): ws_rm.cell(r, cc).border = BORDER_CELL

    for i, w in enumerate([44, 18, 12, 22, 22, 22], 1):
        ws_rm.column_dimensions[get_column_letter(i)].width = w
    configure_print(ws_rm, landscape=True, fit_width=1)

    # =========================================================================
    # SHEET 01: 01_Summary (Supports Simple Mode vs Detailed Mode Switch!)
    # =========================================================================
    style_title_banner(
        ws_sum, 8,
        "SWITCHGEAR HEAT LOSS & COOLING CALCULATION — EXECUTIVE SUMMARY",
        "100% Macro-Free Workbook (.xlsx) · Switch between Simple Mode & Detailed Mode below · Protected calculation engine with full methodology on Tab 08."
    )
    for r, l1, f1, l2, f2 in [
        (4, "Project / Switchboard:", "='02_Board_&_Busbars'!B5", "Document Ref:", "='02_Board_&_Busbars'!B6"),
        (5, "Engineer / Originator:", "='02_Board_&_Busbars'!B7", "Revision & Date:", "='02_Board_&_Busbars'!B8"),
        (6, "Main Busbar Spec:", "='02_Board_&_Busbars'!B40&\"×\"&'02_Board_&_Busbars'!B41&\"×\"&'02_Board_&_Busbars'!B42&\" mm (\"&'02_Board_&_Busbars'!B51&\" mm²) \"&'02_Board_&_Busbars'!B39&\" · \"&'02_Board_&_Busbars'!B38&\"A · kAC=\"&TEXT('02_Board_&_Busbars'!B59,\"0.00\")",
         "Electrical Basis:", "='02_Board_&_Busbars'!B12&\"V \"&'02_Board_&_Busbars'!B13&\"Hz \"&'02_Board_&_Busbars'!B14&\" · RDF \"&TEXT('02_Board_&_Busbars'!B16,\"0%\")"),
    ]:
        ws_sum.row_dimensions[r].height = 20
        ws_sum.cell(r, 1, l1).font = FONT_CALC_BOLD; ws_sum.cell(r, 1).fill = FILL_ZEBRA
        ws_sum.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5); ws_sum.cell(r, 2, f1).font = FONT_LINK
        ws_sum.cell(r, 6, l2).font = FONT_CALC_BOLD; ws_sum.cell(r, 6).fill = FILL_ZEBRA
        ws_sum.merge_cells(start_row=r, start_column=7, end_row=r, end_column=8); ws_sum.cell(r, 7, f2).font = FONT_LINK
        for cc in range(1, 9): ws_sum.cell(r, cc).border = BORDER_CELL; ws_sum.cell(r, cc).alignment = ALIGN_L

    # Mode Selector (Row 8) & Active Scenario Selector (Row 9)
    ws_sum.row_dimensions[8].height = 24; ws_sum.row_dimensions[9].height = 24
    ws_sum.merge_cells("A8:B8"); ws_sum.cell(8, 1, "CALCULATION MODE:").font = FONT_SECTION; ws_sum.cell(8, 1).fill = FILL_SECTION; ws_sum.cell(8, 1).alignment = ALIGN_C
    ws_sum.merge_cells("C8:D8"); c_mv = ws_sum.cell(8, 3, "Detailed Mode"); c_mv.font = Font(name=FONT_FAMILY, size=11, bold=True, color=INPUT_FG); c_mv.fill = FILL_INPUT; c_mv.alignment = ALIGN_C
    ws_sum.merge_cells("E8:H8"); ws_sum.cell(8, 5, "Choose 'Simple Mode' (reads 00_Simple_Mode) or 'Detailed Mode' (reads 03_Feeder_Schedule & 04_Busbar_Segments).").font = FONT_HINT; ws_sum.cell(8, 5).fill = FILL_ZEBRA

    ws_sum.merge_cells("A9:B9"); ws_sum.cell(9, 1, "ACTIVE SCENARIO:").font = FONT_SECTION; ws_sum.cell(9, 1).fill = FILL_SECTION; ws_sum.cell(9, 1).alignment = ALIGN_C
    ws_sum.merge_cells("C9:D9"); c_sv = ws_sum.cell(9, 3, "Normal (N)"); c_sv.font = Font(name=FONT_FAMILY, size=11, bold=True, color=INPUT_FG); c_sv.fill = FILL_INPUT; c_sv.alignment = ALIGN_C
    ws_sum.merge_cells("E9:H9"); ws_sum.cell(9, 5, "Select Normal (N), N-1 Firm Transfer (A→B), Normal + Future, or Worst-Case. Updates Room Ventilation too!").font = FONT_HINT; ws_sum.cell(9, 5).fill = FILL_ZEBRA
    for rr in (8, 9):
        for cc in range(1, 9): ws_sum.cell(rr, cc).border = BORDER_CELL

    dv_mode = DataValidation(type="list", formula1='"Detailed Mode,Simple Mode"', allow_blank=False)
    dv_sc = DataValidation(type="list", formula1='"Normal (N),N-1 Firm Transfer,Normal + Future,Worst-Case (N-1 + Future)"', allow_blank=False)
    ws_sum.add_data_validation(dv_mode); dv_mode.add("C8")
    ws_sum.add_data_validation(dv_sc); dv_sc.add("C9")

    # Section 1: KPI Cards (respects Simple Mode vs Detailed Mode!)
    style_section_bar(ws_sum, 11, 1, 8, "1. ACTIVE SCENARIO THERMAL & SWITCHROOM COOLING KPIs")
    ws_sum.row_dimensions[12].height = 18; ws_sum.row_dimensions[13].height = 28; ws_sum.row_dimensions[14].height = 18

    sm_act_row = "IF($C$9=\"Normal (N)\",23,IF($C$9=\"N-1 Firm Transfer\",24,IF($C$9=\"Normal + Future\",25,26)))"
    kpi_defs = [
        (1, 2, "TOTAL SWITCHGEAR HEAT LOSS",
         f"=IF($C$8=\"Simple Mode\",INDEX('00_Simple_Mode'!$B$23:$B$26,{sm_act_row}-22),('04_Busbar_Segments'!K13+'04_Busbar_Segments'!L53+'03_Feeder_Schedule'!Y52+'02_Board_&_Busbars'!B24)/1000)",
         "0.000\" kW\"",
         "=TEXT(A13*1000,\"#,##0\")&\" W  |  \"&TEXT(A13*3412.14,\"#,##0\")&\" BTU/hr\""),
        (3, 4, "BUSBARS, DROPPERS & JOINTS",
         f"=IF($C$8=\"Simple Mode\",INDEX('00_Simple_Mode'!$D$23:$D$26,{sm_act_row}-22)/1000,('04_Busbar_Segments'!K13+'04_Busbar_Segments'!L53+'03_Feeder_Schedule'!W52)/1000)",
         "0.000\" kW\"",
         "=TEXT(C13*1000,\"#,##0\")&\" W  (\"&TEXT(IF(A13>0,C13/A13,0),\"0.0%\")&\" of total)\""),
        (5, 6, "DEVICES, EATON FUSES & STARTERS",
         f"=IF($C$8=\"Simple Mode\",INDEX('00_Simple_Mode'!$E$23:$E$26,{sm_act_row}-22)/1000,('03_Feeder_Schedule'!U52+'03_Feeder_Schedule'!V52)/1000)",
         "0.000\" kW\"",
         "=TEXT(E13*1000,\"#,##0\")&\" W  (\"&TEXT(IF(A13>0,E13/A13,0),\"0.0%\")&\" of total)\""),
        (7, 8, "SWITCHROOM COOLING & AIRFLOW",
         "='07_Room_Ventilation'!B21",
         "#,##0\" L/s\"",
         "=TEXT('07_Room_Ventilation'!B24,\"0.0\")&\" ACH  |  HVAC: \"&TEXT('07_Room_Ventilation'!B19,\"0.00\")&\" kW\""),
    ]
    for c1, c2, lbl_t, f_val, nf, f_sub in kpi_defs:
        for r in (12, 13, 14):
            ws_sum.merge_cells(start_row=r, start_column=c1, end_row=r, end_column=c2)
            for cc in range(c1, c2 + 1): ws_sum.cell(r, cc).fill = FILL_HERO if c1 == 1 else FILL_ZEBRA; ws_sum.cell(r, cc).border = BORDER_CELL
        ws_sum.cell(12, c1, lbl_t).font = FONT_HERO_LBL; ws_sum.cell(12, c1).alignment = ALIGN_C
        cv = ws_sum.cell(13, c1, f_val); cv.font = FONT_HERO_VAL if c1 == 1 else Font(name=FONT_FAMILY, size=14, bold=True, color="0F172A"); cv.alignment = ALIGN_C; cv.number_format = nf
        ws_sum.cell(14, c1, f_sub).font = FONT_HINT; ws_sum.cell(14, c1).alignment = ALIGN_C

    # Section 2: 4-Scenario Simultaneous Comparison (Switches cleanly with Mode!)
    style_section_bar(ws_sum, 16, 1, 8, "2. ALL 4 OPERATING SCENARIOS — SIDE-BY-SIDE COMPARISON (LIVE)")
    ws_sum.row_dimensions[17].height = 24
    for i, h in enumerate(["Operating Scenario", "Total Loss (kW)", "Total Loss (W)", "Busbars & Joints (W)", "Devices & Starters (W)", "Auxiliaries (W)", "Incomer Load (A)", "HVAC Cooling (kW)"], 1):
        c = ws_sum.cell(17, i, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C; c.border = BORDER_CELL

    sc_rows = [
        ("Normal (N) — Local Active Loads",            "L", "M", "Z",  "M", 23),
        ("N-1 Firm Transfer — Supplying B-Side Board", "M", "N", "AA", "N", 24),
        ("Normal + Future Capacity",                   "N", "O", "AB", "O", 25),
        ("Worst-Case (N-1 Transfer + Future)",         "O", "P", "AC", "P", 26),
    ]
    for idx, (sc_name, hbb_c, vbb_c, fed_c, col_c, sm_r) in enumerate(sc_rows):
        r = 18 + idx
        ws_sum.row_dimensions[r].height = 21
        ws_sum.cell(r, 1, sc_name).font = FONT_CALC_BOLD
        ws_sum.cell(r, 2, f"=C{r}/1000").number_format = "0.000"
        ws_sum.cell(r, 3, f"=D{r}+E{r}+F{r}").number_format = "#,##0.0"
        ws_sum.cell(r, 4, f"=IF($C$8=\"Simple Mode\",'00_Simple_Mode'!D{sm_r},'04_Busbar_Segments'!{hbb_c}13+'04_Busbar_Segments'!{vbb_c}53)").number_format = "#,##0.0"
        ws_sum.cell(r, 5, f"=IF($C$8=\"Simple Mode\",'00_Simple_Mode'!E{sm_r},'03_Feeder_Schedule'!{fed_c}52)").number_format = "#,##0.0"
        ws_sum.cell(r, 6, "='02_Board_&_Busbars'!$B$24").number_format = "#,##0.0"
        ws_sum.cell(r, 7, f"=IF($C$8=\"Simple Mode\",'00_Simple_Mode'!F{sm_r},SUM('03_Feeder_Schedule'!${col_c}${COL_START}:${col_c}${COL_END}))").number_format = "#,##0.0"
        ws_sum.cell(r, 8, f"=B{r}*(1+'02_Board_&_Busbars'!$B$26)").number_format = "0.000"
        for cc in range(1, 9):
            ws_sum.cell(r, cc).border = BORDER_CELL
            if cc > 1: ws_sum.cell(r, cc).alignment = ALIGN_R; ws_sum.cell(r, cc).font = FONT_CALC_BOLD if cc in (2, 8) else FONT_CALC
            ws_sum.cell(r, cc).fill = FILL_HERO if idx == 3 and cc in (2, 8) else (FILL_ZEBRA if idx % 2 else FILL_WHITE)

    # Section 3 & 4: Category Breakdown + Room Cooling Verdict Summary
    style_section_bar(ws_sum, 23, 1, 4, "3. DETAILED BREAKDOWN BY CATEGORY (ACTIVE)")
    style_section_bar(ws_sum, 23, 5, 8, "4. SWITCHROOM VENTILATION & IEC 60890 SUMMARY")
    for i, h in enumerate(["Category", "Watts (W)", "Kilowatts (kW)", "Share (%)"], 1):
        c = ws_sum.cell(24, i, h); c.font = FONT_HEADER; c.fill = FILL_HEADER; c.alignment = ALIGN_C if i > 1 else ALIGN_L; c.border = BORDER_CELL

    cat_formulas = [
        ("Main Horizontal Busbar (HBB)", "='04_Busbar_Segments'!I13"),
        ("Vertical Dropper Busbars (VBB)", "='04_Busbar_Segments'!L53"),
        ("Splice Joints & Tier Take-off Tails", "='04_Busbar_Segments'!J13+'03_Feeder_Schedule'!W52"),
        ("Incomers & Bus Couplers (ACB)", "=SUMIFS('03_Feeder_Schedule'!$U$17:$U$51,'03_Feeder_Schedule'!$E$17:$E$51,\"Incomer\")+SUMIFS('03_Feeder_Schedule'!$V$17:$V$51,'03_Feeder_Schedule'!$E$17:$E$51,\"Incomer\")+SUMIFS('03_Feeder_Schedule'!$U$17:$U$51,'03_Feeder_Schedule'!$E$17:$E$51,\"Bus Coupler\")+SUMIFS('03_Feeder_Schedule'!$V$17:$V$51,'03_Feeder_Schedule'!$E$17:$E$51,\"Bus Coupler\")"),
        ("Outgoing Feeders, Starters & Eaton HRC Fuses", "=SUMIFS('03_Feeder_Schedule'!$U$17:$U$51,'03_Feeder_Schedule'!$E$17:$E$51,\"Feeder\")+SUMIFS('03_Feeder_Schedule'!$V$17:$V$51,'03_Feeder_Schedule'!$E$17:$E$51,\"Feeder\")"),
        ("Interconnector Device & Internal Cable", "=SUMIFS('03_Feeder_Schedule'!$U$17:$U$51,'03_Feeder_Schedule'!$E$17:$E$51,\"Interconnector\")+SUMIFS('03_Feeder_Schedule'!$V$17:$V$51,'03_Feeder_Schedule'!$E$17:$E$51,\"Interconnector\")+'03_Feeder_Schedule'!X52"),
        ("Panel Auxiliaries & Reserve Chambers", "='02_Board_&_Busbars'!B24+SUMIFS('03_Feeder_Schedule'!$U$17:$U$51,'03_Feeder_Schedule'!$E$17:$E$51,\"Spare / Placeholder\")"),
    ]
    for idx, (cname, cform) in enumerate(cat_formulas):
        r = 25 + idx; ws_sum.row_dimensions[r].height = 20
        ws_sum.cell(r, 1, cname).font = FONT_CALC
        ws_sum.cell(r, 2, cform).number_format = "#,##0.0"
        ws_sum.cell(r, 3, f"=B{r}/1000").number_format = "0.000"
        ws_sum.cell(r, 4, f"=IF($B$32>0,B{r}/$B$32,0)").number_format = "0.0%"
        for cc in range(1, 5):
            ws_sum.cell(r, cc).border = BORDER_CELL; ws_sum.cell(r, cc).fill = FILL_ZEBRA if idx % 2 else FILL_WHITE
            if cc > 1: ws_sum.cell(r, cc).alignment = ALIGN_R; ws_sum.cell(r, cc).font = FONT_CALC

    ws_sum.row_dimensions[32].height = 22
    ws_sum.cell(32, 1, "DETAILED TOTAL"); ws_sum.cell(32, 2, "=SUM(B25:B31)").number_format = "#,##0.0"
    ws_sum.cell(32, 3, "=SUM(C25:C31)").number_format = "0.000"; ws_sum.cell(32, 4, "=SUM(D25:D31)").number_format = "0.0%"
    for cc in range(1, 5):
        ws_sum.cell(32, cc).fill = FILL_TOTAL; ws_sum.cell(32, cc).border = BORDER_TOTAL; ws_sum.cell(32, cc).font = FONT_TOTAL
        if cc > 1: ws_sum.cell(32, cc).alignment = ALIGN_R

    enc_rows = [
        ("Switchroom Dimensions", "='07_Room_Ventilation'!B6&\" × \"&'07_Room_Ventilation'!B7&\" × \"&'07_Room_Ventilation'!B8", "m", "@"),
        ("Switchroom Volume", "='07_Room_Ventilation'!B18", "m³", "#,##0.0"),
        ("Room Temps (T_amb → T_max)", "='07_Room_Ventilation'!B9&\"°C → \"&'07_Room_Ventilation'!B10&\"°C (ΔT=\"&'07_Room_Ventilation'!B20&\"K)\"", "-", "@"),
        ("Required Cooling Airflow", "='07_Room_Ventilation'!B22", "m³/h", "#,##0"),
        ("Required Air Change Rate", "='07_Room_Ventilation'!B24", "ACH", "0.00"),
        ("Natural Stack Capacity", "='07_Room_Ventilation'!B26", "kW", "0.00"),
        ("Est. Temp (Natural Only)", "='07_Room_Ventilation'!B27", "°C", "0.0"),
        ("Enclosure Surface Ae (IEC 60890)",
         "=IF('02_Board_&_Busbars'!B25=\"Wall-Backed\",0.9*(SUM('03_Feeder_Schedule'!C6:C13)/1000)*('02_Board_&_Busbars'!B18/1000)+1.4*(SUM('03_Feeder_Schedule'!C6:C13)/1000)*('02_Board_&_Busbars'!B19/1000)+1.8*('02_Board_&_Busbars'!B19/1000)*('02_Board_&_Busbars'!B18/1000),1.8*(SUM('03_Feeder_Schedule'!C6:C13)/1000)*('02_Board_&_Busbars'!B18/1000)+1.4*(SUM('03_Feeder_Schedule'!C6:C13)/1000)*('02_Board_&_Busbars'!B19/1000)+1.8*('02_Board_&_Busbars'!B19/1000)*('02_Board_&_Busbars'!B18/1000))",
         "m²", "0.00"),
        ("Ventilation Verdict", "='07_Room_Ventilation'!B28", "-", "@"),
    ]
    for idx, (elbl, eform, eunit, enf) in enumerate(enc_rows):
        r = 24 + idx
        if idx == 8:
            ws_sum.merge_cells(start_row=r, start_column=5, end_row=r, end_column=8)
            cv = ws_sum.cell(r, 5, eform); cv.font = FONT_TOTAL; cv.fill = FILL_HERO; cv.alignment = ALIGN_C
            for cc in range(5, 9): ws_sum.cell(r, cc).border = BORDER_TOTAL
        else:
            ws_sum.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
            ws_sum.cell(r, 5, elbl).font = FONT_CALC_BOLD; ws_sum.cell(r, 5).fill = FILL_ZEBRA if idx % 2 else FILL_WHITE
            cv = ws_sum.cell(r, 7, eform); cv.font = FONT_CALC_BOLD if idx in (3, 4) else FONT_CALC; cv.alignment = ALIGN_R; cv.number_format = enf; cv.fill = FILL_ZEBRA if idx % 2 else FILL_WHITE
            ws_sum.cell(r, 8, eunit).font = FONT_HINT; ws_sum.cell(r, 8).alignment = ALIGN_C; ws_sum.cell(r, 8).fill = FILL_ZEBRA if idx % 2 else FILL_WHITE
            for cc in range(5, 9): ws_sum.cell(r, cc).border = BORDER_CELL

    # Native Stacked Bar Chart
    chart = BarChart()
    chart.type = "bar"; chart.grouping = "stacked"; chart.overlap = 100
    chart.title = "Switchgear Heat Output by Operating Scenario (Watts)"
    chart.y_axis.title = "Scenario"; chart.x_axis.title = "Heat Output (W)"
    chart.style = 10; chart.width = 24; chart.height = 8.5
    chart.add_data(Reference(ws_sum, min_col=4, max_col=6, min_row=17, max_row=21), titles_from_data=True)
    chart.set_categories(Reference(ws_sum, min_col=1, min_row=18, max_row=21))
    if len(chart.series) >= 3:
        chart.series[0].graphicalProperties.solidFill = "F59E0B"
        chart.series[1].graphicalProperties.solidFill = "38BDF8"
        chart.series[2].graphicalProperties.solidFill = "64748B"
    ws_sum.add_chart(chart, "A34")

    style_section_bar(ws_sum, 50, 1, 8, "5. ENGINEERING SIGN-OFF & BASIS NOTE")
    ws_sum.merge_cells("A51:H51"); ws_sum.row_dimensions[51].height = 24
    ws_sum.cell(51, 1, "Macro-Free Workbook (.xlsx). All calculation formulas are protected; full equations & worked examples are documented in Tab 08_Calc_Help_&_Method. Do not distribute with restricted/classified site names.").font = FONT_HINT
    ws_sum.cell(51, 1).fill = FILL_ZEBRA; ws_sum.cell(51, 1).alignment = ALIGN_L
    for cc in range(1, 9): ws_sum.cell(51, cc).border = BORDER_CELL

    ws_sum.row_dimensions[52].height = 22
    for idx, (sh, sv) in enumerate([("Prepared By", "='02_Board_&_Busbars'!B7"), ("Checked By", ""), ("Approved By", ""), ("Date / Rev", "='02_Board_&_Busbars'!B8")]):
        c1 = 1 + idx * 2
        ws_sum.cell(52, c1, sh).font = FONT_CALC_BOLD; ws_sum.cell(52, c1).fill = FILL_TOTAL; ws_sum.cell(52, c1).border = BORDER_CELL
        cv = ws_sum.cell(52, c1 + 1, sv); cv.font = FONT_INPUT if sv == "" else FONT_LINK; cv.fill = FILL_INPUT if sv == "" else FILL_WHITE; cv.border = BORDER_CELL

    for i, w in enumerate([34, 15, 15, 17, 18, 14, 15, 16], 1):
        ws_sum.column_dimensions[get_column_letter(i)].width = w
    configure_print(ws_sum, landscape=True, fit_width=1, fit_height=1)

    # =========================================================================
    # SHEET 08: 08_Calc_Help_&_Method (Comprehensive Engineering Guide & Formulas)
    # =========================================================================
    style_title_banner(
        ws_help, 5,
        "CALCULATION METHODOLOGY, WORKED EXAMPLES & ABBREVIATION GLOSSARY",
        "Complete transparent documentation of how every calculation in this protected workbook is carried out (IEC 60439 / 61439, IEC TR 60890, Eaton DS 10164, CIBSE Guide A)."
    )

    help_sections = [
        ("1. QUICK-START GUIDE & WORKBOOK PROTECTION", [
            ("Blue Cells = User Inputs", "All editable inputs across sheets 00, 01, 02, 03, 06, and 07 are shaded light blue and unlocked. All formula cells are locked to prevent accidental corruption."),
            ("Simple Mode vs Detailed Mode", "Start on '00_Simple_Mode' for a 30-second preliminary estimate. Switch '01_Summary' cell C8 to 'Detailed Mode' to refine individual cubicles, starters, Eaton HRC fuses, and busbar spans—Detailed Mode automatically inherits your Simple Mode Busbar Preset, AC Factor S, RDF, Future Growth, and N-1 Transfer when '02_Board_&_Busbars' cell B9 = 'Yes'."),
            ("Protected Calculation Sheet", "Tab '04_Busbar_Segments' (and '05_GA_Heat_Map') has Sheet Protection enabled with formulas hidden and locked cells unselectable to prevent unauthorized tampering or copying. Authorized reviewers can unprotect via Review → Unprotect Sheet (default admin password: CEI)."),
            ("Data Privacy Advisory", "This workbook is 100% macro-free and runs strictly locally on your computer. Do not distribute files containing security-classified or client-restricted site identifiers."),
        ]),
        ("2. BUSBAR JOULE'S LAW PHYSICS (DC → AC CONVERSION)", [
            ("Cross-Sectional Area (A)", "A = n × w × t  [mm²/phase]. Example: 2 × 75 × 6 mm = 900 mm² per phase (per BS EN 60439-1 Type 439 certificate)."),
            ("DC Resistance @ 20 °C (R_DC,20)", "R_DC,20 = (ρ₂₀ / A) × 10⁶  [µΩ/m]. For Copper 100% IACS (ρ₂₀ = 0.017241 Ω·mm²/m) and A = 900 mm²: R_DC,20 = 19.16 µΩ/m."),
            ("Temperature Correction R_DC(T)", "R_DC(T) = R_DC,20 × [1 + α₂₀ × (T_op − 20)]. For Cu (α₂₀ = 0.00393 /K) at T_op = 70 °C: 19.16 × [1 + 0.00393×50] = 22.92 µΩ/m (+19.7%)."),
            ("AC Skin & Proximity Factor (k_AC)", "Either Manual Factor S (default 1.20 for 2-bar Cu) OR Calculated k_AC = 1 + y_s + y_p + y_e from skin depth δ = √(ρ(T)/(π·f·μ₀)) ≈ 10.22 mm @ 50 Hz Cu, rectangular slab+edge+lamination skin factor y_s, IEC 60287 inter-phase proximity y_p, and steel enclosure eddy factor y_e (0.02). For 2×75×6 mm @ 120 mm spacing: Calc k_AC = 1.119."),
            ("AC Resistance & 3-Phase W/m", "R_AC(T) = R_DC(T) × k_AC. At S = 1.20: R_AC = 22.92 × 1.20 = 27.51 µΩ/m. 3-Phase loss/m = 3 × I² × R_AC × 10⁻⁶ (+ neutral I_N²·R_N,AC if 3P+N). At 1600 A (10% N, 50% N bar): 3×1600²×27.51×10⁻⁶ + 160²×55.01×10⁻⁶ = 212.6 W/m!"),
            ("Bolted Joint Contact Loss", "Each bolted 3-phase panel splice or tap-off joint adds P_joint = 3 × I² × R_joint (default R_joint = 5 µΩ/phase; typical torqued Cu-Cu lap joint: 3–10 µΩ)."),
        ]),
        ("3. PROTECTIVE DEVICES, STARTERS & EATON HRC FUSES (IEC TR 60890)", [
            ("Operating vs Rated Current Scaling", "P_op = P_fixed + P_n × (I_op / I_n)². Variable contact/pole/overload/fuse-link losses scale quadratically with load current, while fixed coil/electronic/fan losses remain constant whenever energized."),
            ("Motor Operating Current (I_op)", "I_op = [P_kW × 1000 / (√3 × V_LL × cos φ × η)] × Duty Factor. Example: 37 kW DOL at 400 V, PF 0.86, η 0.93, 85% duty → I_op = 56.8 A on 100 A frame → (56.8/100)² = 0.322 → P_op = 18 + 55×0.322 = 35.7 W (vs 73 W at rated)."),
            ("Variable Speed Drives (VSD)", "IGBT switching & rectifier losses do not drop purely quadratically at part load; VSDs use P_op = P_fixed + P_n × (0.25 + 0.75 × I_op/I_n)."),
            ("Eaton Bussmann NH gG HRC Fuses", "All 31 standard IEC ratings from 2 A (2NHG000B: 3.9 W/link) and 16 A (16NHG0B: 3.0 W/link) through 250 A (250NHG1B: 19 W/link), 400 A (400NHG2B: 30 W/link), 630 A (630NHG3B: 47 W/link), up to 1250 A (1250NHG4G: 108 W/link) per Eaton Bussmann Data Sheet 10164 (500 V AC gG), multiplied ×3 for 3-phase plus fuse-switch base contact loss."),
        ]),
        ("4. SWITCHROOM COOLING, AIRFLOW, ACH & VENTILATION (WORKED 6 kW / 5×5×9 m EXAMPLE)", [
            ("Sensible Heat Balance (Airflow)", "V̇_req = Q_design / (ρ · c_p · ΔT) [m³/s], where ρ = 353 / (T_avg + 273.15) kg/m³ (~1.165 kg/m³ at 30 °C), c_p = 1.005 kJ/(kg·K), and ΔT = T_max − T_amb. Worked example for Q = 6.0 kW, T_amb = 25 °C, T_max = 35 °C (ΔT = 10 K): V̇_req = 6.0 / (1.170 × 10) = 0.513 m³/s = 513 L/s = 1,846 m³/h (1,086 CFM)."),
            ("Air Change Rate per Hour (ACH)", "ACH = V̇_req (m³/h) / Room Volume (m³). For a 5 × 5 × 9 m room (V = 225 m³) with 6 kW load: ACH = 1,846 / 225 = 8.20 ACH."),
            ("Natural Stack-Effect Buoyancy", "Per CIBSE Guide A / AM10: V̇_nat = C_d × (A_louver / √2) × √(2·g·H_stack·ΔT / (T_amb + 273.15)). For 0.50 m² low/high free louver area and H_stack = 6.0 m: V̇_nat ≈ 0.422 m³/s = 1,520 m³/h (Q_nat ≈ 4.94 kW capacity)."),
            ("Ventilation Verdict Thresholds", "1) If ΔT ≤ 2 K → ACTIVE AIR CONDITIONING REQUIRED.  2) If V̇_nat ≥ V̇_req AND ACH ≤ 6 → NATURAL VENTILATION SUFFICIENT.  3) If ACH ≤ 20 AND ΔT ≥ 5 K → MECHANICAL VENTILATION (FORCED FANS) REQUIRED (e.g. 6 kW in 5×5×9 m @ 8.2 ACH exceeds 4.94 kW natural louver capacity → Mechanical Fans Required!).  4) If ACH > 20 or ΔT < 5 K → ACTIVE AIR CONDITIONING RECOMMENDED."),
        ]),
        ("5. COMPLETE ABBREVIATION GLOSSARY (FULL NAMES)", [
            ("ACB / MCCB / MCB", "Air Circuit Breaker (ACB) · Moulded Case Circuit Breaker (MCCB) · Miniature Circuit Breaker (MCB)"),
            ("ACH / CFM / L/s", "Air Changes per Hour (ACH) · Cubic Feet per Minute (CFM) · Litres per Second (L/s)"),
            ("Ae / FFL / EL", "Effective Enclosure Cooling Surface Area (Ae, IEC 60890) · Finished Floor Level (FFL) · Elevation above FFL (EL)"),
            ("BTU/hr / HVAC / DX", "British Thermal Units per Hour (BTU/hr) · Heating, Ventilation, and Air Conditioning (HVAC) · Direct Expansion Cooling (DX)"),
            ("DOL / VSD / SS", "Direct-On-Line Motor Starter (DOL) · Variable Speed Drive (VSD) · Soft Starter (SS)"),
            ("GA / SLD / HBB / VBB", "General Arrangement (GA) · Single Line Diagram (SLD) · Main Horizontal Busbar (HBB) · Vertical Dropper Busbar (VBB)"),
            ("HRC / NH / gG", "High Rupturing Capacity (HRC) · Low-Voltage High-Rupturing Knife-Blade Fuse (NH) · General Purpose Full-Range Protection Class (gG)"),
            ("IACS / Cu-ETP / XLPE", "International Annealed Copper Standard (IACS) · Electrolytic Tough Pitch Copper (Cu-ETP) · Cross-Linked Polyethylene Cable (XLPE)"),
            ("IEC / CIBSE / CDA", "International Electrotechnical Commission (IEC) · Chartered Institution of Building Services Engineers (CIBSE) · Copper Development Association (CDA)"),
            ("In / Iop / Pn / RDF / N-1", "Rated Current (In) · Operating Current (Iop) · Rated Power Loss at In (Pn) · Rated Diversity Factor (RDF) · Single-Contingency Supply Outage (N-1)"),
        ]),
    ]

    r_h = 4
    for sec_title, rows_list in help_sections:
        style_section_bar(ws_help, r_h, 1, 5, sec_title)
        r_h += 1
        for i, (topic, desc) in enumerate(rows_list):
            ws_help.merge_cells(start_row=r_h, start_column=2, end_row=r_h, end_column=5)
            c1 = ws_help.cell(r_h, 1, topic); c1.font = FONT_CALC_BOLD; c1.fill = FILL_ZEBRA if i % 2 else FILL_WHITE; c1.alignment = ALIGN_L; c1.border = BORDER_CELL
            c2 = ws_help.cell(r_h, 2, desc); c2.font = FONT_CALC; c2.fill = FILL_ZEBRA if i % 2 else FILL_WHITE; c2.alignment = ALIGN_L
            for cc in range(2, 6): ws_help.cell(r_h, cc).border = BORDER_CELL
            ws_help.row_dimensions[r_h].height = max(24, min(68, 16 * (1 + len(desc) // 95)))
            r_h += 1
        r_h += 1

    for i, w in enumerate([34, 28, 28, 28, 28], 1):
        ws_help.column_dimensions[get_column_letter(i)].width = w
    configure_print(ws_help, landscape=True, fit_width=1)

    # =========================================================================
    # APPLY SHEET PROTECTION ACROSS ALL TABS
    # =========================================================================
    for ws_inp in [ws_smp, ws_sum, ws_bus, ws_fed, ws_lib, ws_rm, ws_help]:
        apply_sheet_protection(ws_inp, strict_calc_sheet=False)
    # Strict protection (hidden formulas + unselectable/uncopyable locked cells) on Calculation Engine & GA!
    apply_sheet_protection(ws_seg, strict_calc_sheet=True)
    apply_sheet_protection(ws_ga, strict_calc_sheet=True)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    wb.save(OUTPUT_PATH)
    print(f"SUCCESS: Generated macro-free protected Excel workbook at: {OUTPUT_PATH}")
    print(f"Sheets ({len(wb.sheetnames)}): {wb.sheetnames}")
    print(f"Protection enabled on all sheets (Strict hidden+uncopyable on 04_Busbar_Segments & 05_GA_Heat_Map; password: {PROTECT_PASSWORD})")


if __name__ == "__main__":
    generate_workbook()
