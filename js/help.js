/**
 * Comprehensive Engineering Help & Rich Hover Tooltip Engine
 * Explains every input entry & UI abbreviation in plain English with FULL NAMES
 * for every abbreviation used, where to find the value, typical values, and tips.
 */

window.SGHelp = (function () {
  'use strict';

  const HELP_DB = {
    // --- Main & Vertical Busbar ---
    'bb.preset': {
      title: 'Busbar Construction Preset (HBB / VBB)',
      what: 'Shortcut to populate standard laminated Copper (Cu) busbar sizes (parallel bars × width × thickness per phase) for the Main Horizontal Busbar (HBB) or Vertical Dropper Busbar (VBB).',
      where: 'Match against the switchgear vendor\'s General Arrangement (GA) drawing or busbar schedule.',
      typical: '630 A: 1×50×6 mm (300 mm²) · 1600 A: 2×75×6 mm (900 mm²) · 2500 A: 2×100×10 mm (2000 mm²) · 3200 A: 3×100×10 mm (3000 mm²).',
      tip: 'Selecting a preset fills all geometry fields automatically—you can still adjust any dimension afterward.',
    },
    'bb.cert': {
      title: 'Type 439 / IEC 61439 Certificate Reference',
      what: 'Reference identifier for the switchgear assembly\'s temperature-rise and short-circuit type test certificate under British Standard / European Norm 60439-1 (BS EN 60439-1) or International Electrotechnical Commission 61439-1 (IEC 61439-1).',
      where: 'Switchgear manufacturer\'s Association of Short-Circuit Testing Authorities (ASTA), Keuring van Elektrotechnische Materialen (KEMA), or Low Voltage Agreement Group (LOVAG) test dossier.',
      typical: 'Example: "BS EN 60439-1 Type 439 Cert — 2×75×6 mm Copper" or "ASTA Cert #18492 (65 kA 1 s)".',
      tip: 'Printed directly onto your exported Comma-Separated Values (CSV) and Portable Document Format (PDF) calculation reports for audit traceability.',
    },
    'bb.rated': {
      title: 'Busbar Rated Current (In) in Amperes (A)',
      what: 'Rated Current (In) is the maximum continuous Alternating Current (AC) the busbar assembly is certified to carry without exceeding International Electrotechnical Commission (IEC) temperature-rise limits.',
      where: 'Switchgear Single Line Diagram (SLD), technical specification, or manufacturer type-test certificate.',
      typical: 'Main Horizontal Busbar (HBB): 800 A, 1600 A, 2500 A, 3200 A, 4000 A. Vertical Dropper Busbar (VBB): 400 A, 630 A, 800 A, 1250 A, 1600 A.',
      tip: 'Used to compute % utilization and trigger red thermal overload warnings if exceeded (such as during Single-Contingency N-1 transfer).',
    },
    'bb.material': {
      title: 'Conductor Material — Copper (Cu) vs Aluminium (Al)',
      what: 'Selects the conductor metal\'s electrical resistivity at 20 °C (ρ₂₀) and temperature coefficient (α₂₀), rated against the International Annealed Copper Standard (IACS).',
      where: 'Switchgear specification or busbar datasheet (Electrolytic Tough Pitch Copper, Cu-ETP, is standard in UK/EU Low Voltage switchboards).',
      typical: 'Copper 100% International Annealed Copper Standard (IACS) (0.01724 Ω·mm²/m) is standard; Copper 98% IACS is conservative; Electrical Conductor (EC) Aluminium 61% IACS has ~64% higher resistance for the same cross-section.',
      tip: 'Switching from Copper (Cu) to Aluminium (Al) without increasing cross-sectional area increases busbar Joule heat by ~64%.',
    },
    'bb.bars': {
      title: 'Number of Parallel Bars per Phase (Bars / Ph)',
      what: 'How many flat rectangular busbar laminations are bolted in parallel to form a single phase conductor (Line 1, Line 2, or Line 3).',
      where: 'General Arrangement (GA) cross-section drawing or Type 439 certificate (the first number in "2 × 75 × 6 mm").',
      typical: '1 bar for ≤800 A, 2 bars for 1000 A–2500 A, 3–4 bars for 3200 A–4000 A.',
      tip: 'Total Cross-Sectional Area (CSA) per phase = Bars × Width × Thickness. Three or four parallel bars experience stronger Alternating Current (AC) skin/proximity crowding.',
    },
    'bb.width': {
      title: 'Busbar Width in Millimetres (mm)',
      what: 'The wider face dimension of each rectangular busbar lamination.',
      where: 'Busbar schedule or Type 439 test certificate (the second number in "2 × 75 × 6 mm").',
      typical: 'Vertical Dropper Busbars (VBB): 30–60 mm. Main Horizontal Busbars (HBB): 50, 60, 75, 80, 100, or 120 mm.',
      tip: 'Wider bars reduce Direct Current (DC) resistance and provide more surface area for convective cooling.',
    },
    'bb.thickness': {
      title: 'Busbar Thickness in Millimetres (mm)',
      what: 'The narrower thickness dimension of each rectangular busbar lamination.',
      where: 'Busbar schedule or Type 439 certificate (the third number in "2 × 75 × 6 mm").',
      typical: 'Standard metric Copper (Cu) bar thicknesses: 5 mm, 6 mm, 8 mm, or 10 mm.',
      tip: 'At 50 Hertz (Hz), Copper skin depth (δ) is ~10.2 mm, so 6 mm or 10 mm bars avoid severe interior skin-effect waste.',
    },
    'bb.gap': {
      title: 'Inter-Bar Air Gap in Millimetres (mm)',
      what: 'Air spacing between parallel laminations belonging to the SAME phase (applicable when using 2 or more bars per phase).',
      where: 'Busbar support insulator or spacer-block detail on the manufacturer\'s General Arrangement (GA).',
      typical: 'Normally equal to the bar thickness (e.g. 6 mm gap for 6 mm bars, 10 mm gap for 10 mm bars).',
      tip: 'Used in Calculated Skin/Proximity mode; a larger gap slightly reduces mutual magnetic crowding and improves air cooling.',
    },
    'bb.spacing': {
      title: 'Phase-to-Phase Centre Spacing (Phase Ctr) in Millimetres (mm)',
      what: 'Centre-to-centre distance between adjacent phases (L1 to L2, and L2 to L3).',
      where: 'Switchgear busbar support drawing or mechanical General Arrangement (GA) cross-section.',
      typical: 'Vertical Dropper Busbars (VBB): 80–110 mm. Main Horizontal Busbars (HBB): 100–160 mm (wider for higher short-circuit fault ratings).',
      tip: 'Closer phase spacing increases magnetic Proximity Effect (yp) in Calculated Alternating Current (AC) mode.',
    },
    'bb.temp': {
      title: 'Busbar Operating Temperature (Op Temp) in Degrees Celsius (°C)',
      what: 'Estimated steady-state conductor temperature under load. Electrical resistance rises as metal heats up.',
      where: 'Thermal design basis (Room Ambient Temperature + Temperature Rise ΔT). International Electrotechnical Commission (IEC) 61439 permits up to 105 °C (35 °C ambient + 70 K rise) at bare busbars.',
      typical: '70 °C is a standard realistic operating design estimate; 85–90 °C is conservative for full rated load in warm switchrooms.',
      tip: 'At 70 °C, Copper resistance is ~19.7% higher than at 20 °C—critical for realistic heat output.',
    },
    'bb.orient': {
      title: 'Busbar Orientation (Edge-On vs Flat-On)',
      what: 'Whether the wide face of the busbars stands vertically ("Edge-on", letting hot air rise freely between parallel bars) or lies horizontally ("Flat-on").',
      where: 'Manufacturer\'s busbar chamber section view on the General Arrangement (GA).',
      typical: 'Edge-on (vertical wide face) is standard practice in Low Voltage (LV) industrial switchgear.',
      tip: 'Edge-on lowers Proximity Effect (yp) and improves natural convective cooling versus flat-on.',
    },
    'bb.neutral': {
      title: 'Neutral Busbar Sizing (% of Phase Cross-Section)',
      what: 'Cross-sectional area of the Neutral (N) busbar expressed as a percentage of one phase busbar (L1/L2/L3).',
      where: 'Switchboard Single Line Diagram (SLD) or International Electrotechnical Commission (IEC) 61439 specification.',
      typical: '50% of phase for predominantly 3-phase motor boards; 100% of phase for commercial/harmonic-rich loads; No Neutral for 3-Phase (3P) 3-wire boards.',
      tip: 'Neutral Joule heat is added only when Neutral Current Ratio (I_N / I_ph) > 0 in Board Config (Tab 5).',
    },
    'bb.acmode': {
      title: 'Direct Current (DC) → Alternating Current (AC) Conversion Method',
      what: 'Alternating Current (AC) crowds toward the bar surface (Skin Effect, ys) and interacts magnetically with neighbouring phases (Proximity Effect, yp), raising AC Resistance (R_AC) above DC Resistance (R_DC).',
      where: 'Choose "Manual Factor (S)" to match a hand-calculation multiplier (e.g. S = 1.20), or "Calculated Skin/Prox" to compute k_AC = 1 + ys + yp + ye automatically from geometry and frequency.',
      typical: 'Manual S = 1.20 is common for 2-bar Copper (Cu) boards; Calculated mode adapts automatically when you change bar count, spacing, or 50/60 Hertz (Hz).',
      tip: 'Even in Manual mode, the live Calculated k_AC is displayed alongside so you can compare both.',
    },
    'bb.manualS': {
      title: 'Manual Alternating Current (AC) Resistance Factor (S)',
      what: 'Multiplier converting temperature-corrected Direct Current Resistance (R_DC) to Alternating Current Resistance (R_AC): R_AC = S × R_DC(T). Accounts for skin effect, proximity effect, and enclosure eddy currents.',
      where: 'Copper Development Association (CDA) Publication 22 tables or standard electrical design guidelines.',
      typical: '1 bar/phase: 1.05–1.10 · 2 bars/phase (e.g. 2×75×6 mm): 1.15–1.25 (1.20 standard) · 3–4 bars/phase: 1.35–1.60.',
      tip: 'Scales busbar Watts per metre (W/m) directly—increasing S from 1.20 to 1.32 raises busbar losses by 10%.',
    },
    'bb.ye': {
      title: 'Enclosure Eddy-Current Allowance Factor (ye)',
      what: 'Extra loss factor accounting for circulating magnetic eddy currents induced in nearby mild-steel switchboard partitions and covers.',
      where: 'Engineering judgement based on enclosure sheet-metal material (mild steel vs non-magnetic aluminium/GRP).',
      typical: '0.02–0.05 (2%–5%) for painted mild-steel enclosures; 0.00 for non-magnetic aluminium or open frames.',
      tip: 'Added directly into Alternating Current Factor k_AC = 1 + ys (skin) + yp (proximity) + ye (eddy).',
    },

    // --- Column / Cubicle ---
    'col.name': {
      title: 'Column / Cubicle Designation',
      what: 'Name for this vertical switchboard section (column/cubicle) shown on the Single Line Diagram (SLD) and General Arrangement (GA) elevation.',
      where: 'Switchboard General Arrangement (GA) drawing (normally numbered left-to-right from COL-01).',
      typical: 'Example: "COL-01 Incomer", "COL-02 MCC Tier 1" (Motor Control Centre), "COL-05 Interconnector".',
      tip: 'You can drag column headers (SLD) or footers (GA) left and right to reorder columns live.',
    },
    'col.width': {
      title: 'Cubicle Width in Millimetres (mm)',
      what: 'Physical horizontal width of this switchboard column on the General Arrangement (GA) elevation.',
      where: 'Switchgear manufacturer\'s General Arrangement (GA) drawing or modular enclosure catalogue.',
      typical: '400 mm (cable/auxiliary bay), 600 mm (outgoing Moulded Case Circuit Breakers, MCCBs), 800 mm (Motor Control Centre / Air Circuit Breaker), 1000–1200 mm (3200 A–4000 A Air Circuit Breakers).',
      tip: 'Directly sets the centreline-to-centreline lengths of the Main Horizontal Busbar (HBB) spans.',
    },
    'col.xcenter': {
      title: 'Column X Centreline Coordinate (mm)',
      what: 'Automatically calculated horizontal distance from the left outer edge of the switchboard to the centre of this column.',
      where: 'Derived automatically from the widths of all columns to the left.',
      typical: 'Used to compute exact Main Horizontal Busbar (HBB) segment lengths: L = (X₂ − X₁) / 1000 metres.',
      tip: 'Dragging or resizing columns updates every horizontal busbar span automatically.',
    },

    // --- Tier / Device / Starter / HRC Fuse ---
    'tier.tag': {
      title: 'Circuit Tag / Equipment Identifier (ID)',
      what: 'Unique electrical tag identifying the circuit, motor starter, incomer, fuse-switch, or spare bay.',
      where: 'Project Single Line Diagram (SLD), Motor List, or Cable Schedule.',
      typical: 'INC-A (Incomer), BC-1 (Bus Coupler), M-101 (Motor), VSD-202 (Variable Speed Drive), F-301 (Feeder), IC-AB (Interconnector), SP-01 (Spare Space), PH-01 (Placeholder).',
      tip: 'Displayed on diagrams, schedules, Comma-Separated Values (CSV) exports, and Portable Document Format (PDF) reports.',
    },
    'tier.status': {
      title: 'Operating Status (Active / Future / Standby)',
      what: 'Controls which operating scenarios energize this circuit and include its load and heat output.',
      where: 'Plant duty/standby operating philosophy and future expansion allowance.',
      typical: 'Active = running in Normal and all scenarios · Future = energized only in "Normal + Future" & "Worst-Case" · Standby = installed spare (0 W).',
      tip: 'Mark planned expansion circuits as "Future" to compare Day-1 vs Future Capacity kilowatts (kW) instantly.',
    },
    'tier.desc': {
      title: 'Circuit Description',
      what: 'Plain-text description of the load, starter type, or Eaton High Rupturing Capacity (HRC) fuse rating.',
      where: 'Electrical load list, mechanical equipment schedule, or Single Line Diagram (SLD).',
      typical: 'Example: "Cooling Water Pump 1 — 55 kW Direct-On-Line (DOL)" or "Eaton 400NHG2B — 400 A NH2 gG HRC Fuse-Switch".',
      tip: 'Printed in full on the Heat Loss Schedule and Engineering Report.',
    },
    'tier.role': {
      title: 'Electrical Role in Switchboard',
      what: 'Defines how this compartment behaves in the Kirchhoff busbar current solver.',
      where: 'Determined from the Single Line Diagram (SLD) topology.',
      typical: 'Outgoing Feeder/Starter = draws load · Main Incomer = feeds busbar · Bus-Section Coupler = splits/ties bus sections · Interconnector = feeds partner B-side board · Spare Space / Placeholder = physical height only (0 A).',
      tip: 'Convert any Spare Space/Placeholder into a live circuit later by changing its Role or selecting a Template.',
    },
    'tier.height': {
      title: 'Compartment / Tier Height in Millimetres (mm)',
      what: 'Physical vertical height of this compartment module inside the switchboard cubicle.',
      where: 'Switchgear vendor\'s modular compartment sizing chart or General Arrangement (GA) elevation.',
      typical: '150–250 mm (Miniature Circuit Breakers, small Direct-On-Line starters ≤15 kW, NH000/NH00 fuses) · 300–450 mm (Direct-On-Line 37–55 kW, Star-Delta, Moulded Case Circuit Breaker 400 A, NH1–NH3 fuses) · 600 mm (Variable Speed Drive / NH4 1250 A) · 750–900 mm (Air Circuit Breaker).',
      tip: 'Directly sets the vertical take-off Elevation above Finished Floor Level (EL) and Vertical Dropper Busbar (VBB) lengths!',
    },
    'tier.template': {
      title: 'Device, Starter & Eaton HRC Fuse Library Template',
      what: 'Loads manufacturer power-loss data for Air Circuit Breakers (ACB), Moulded Case Circuit Breakers (MCCB), Miniature Circuit Breakers (MCB), Direct-On-Line (DOL) & Star-Delta Starters, Soft Starters, Variable Speed Drives (VSD), and Eaton Bussmann Low-Voltage High-Rupturing Knife-Blade General-Purpose (NH gG) High Rupturing Capacity (HRC) fuse links (2 A–1250 A, Data Sheet 10164).',
      where: 'Pre-loaded library (fully editable in Tab 4: Device & Starter Library).',
      typical: 'Includes exact Eaton part numbers such as 2NHG000B (3.9 W/link), 16NHG0B (3.0 W/link), 250NHG1B (19 W/link), 400NHG2B (30 W/link), and 1250NHG4G (108 W/link).',
      tip: 'All multi-part templates split losses into editable sub-components (e.g. 3× HRC Fuse Links + Fuse Base Contacts).',
    },
    'tier.incState': {
      title: 'Incomer Breaker Position (Closed / Open)',
      what: 'Simulates whether this incoming Air Circuit Breaker (ACB) is supplying the busbar or isolated.',
      where: 'Operating mode (e.g. normal dual-transformer vs Single-Contingency N-1 transformer outage).',
      typical: 'CLOSED normally; set OPEN to test loss of one incoming Transformer (Tx) when a Bus-Section Coupler is closed.',
      tip: 'Incomer operating current is summed automatically from all active loads in its electrical section.',
    },
    'tier.couplerState': {
      title: 'Bus-Section Coupler (BC) Position (Open / Closed)',
      what: 'Controls whether left and right horizontal busbar sections operate split (OPEN) or electrically tied together (CLOSED).',
      where: 'Switchboard switching philosophy (typically 2-out-of-3 interlocked with dual incomers).',
      typical: 'OPEN during normal split operation; CLOSED when one incomer feeds both busbar sections.',
      tip: 'Closing the coupler routes transfer current through the coupler Air Circuit Breaker (ACB) and updates all horizontal spans.',
    },
    'tier.remoteBoard': {
      title: 'Remote Partner Switchboard Name',
      what: 'Name of the adjacent firm-supply switchboard supplied via this Interconnector (IC) feeder (e.g. A-Side board supplying B-Side board).',
      where: 'Site Low Voltage (LV) Single Line Diagram (SLD).',
      typical: 'Example: "MSB-B (Firm Supply)" — Main Switchboard B.',
      tip: 'Shown on the SLD interconnector card and exported schedules.',
    },
    'tier.normTransfer': {
      title: 'Normal Operation Transfer Current in Amperes (A)',
      what: 'Current flowing through the Interconnector (IC) during Normal (N) healthy operation.',
      where: 'Normal distribution configuration (typically 0 A when both A-Side and B-Side boards run on their own incomers).',
      typical: '0 A (normally open/standby interconnector) or partial transfer if normally closed.',
      tip: 'Used in "Normal (N)" and "Normal + Future" scenarios.',
    },
    'tier.n1Transfer': {
      title: 'Single-Contingency (N-1) Firm Supply Transfer Load (A)',
      what: 'Current exported across the Interconnector (IC) when the partner switchboard (e.g. MSB-B) loses its incomer and must be supplied from this board.',
      where: 'Total diversified operating current of the partner switchboard from its load schedule.',
      typical: '600 A – 1600 A depending on the partner board\'s running load.',
      tip: 'Activated in "N-1 Firm Transfer" and "Worst-Case (N-1 + Future)" scenarios—often drives peak horizontal busbar Watts per metre (W/m)!',
    },
    'tier.cableN': {
      title: 'Interconnector Parallel Cables per Phase (Cables / Ph)',
      what: 'Number of Cross-Linked Polyethylene (XLPE) power cables connected in parallel per phase inside the interconnector cable box.',
      where: 'Low Voltage (LV) Cable Schedule or British Standard 7671 / IEC 60364 cable sizing calc.',
      typical: '2 × 240 mm² (~800 A), 3 × 240 mm² (~1200 A), 4 × 300 mm² (~1600 A).',
      tip: 'More parallel cables divide the current and reduce internal cable riser I²R heat.',
    },
    'tier.cableCsa': {
      title: 'Interconnector Cable Cross-Sectional Area (CSA) in mm²',
      what: 'Copper conductor Cross-Sectional Area (CSA) of each parallel cable core.',
      where: 'Project Cable Schedule.',
      typical: '185 mm², 240 mm², 300 mm², or 400 mm² Copper (Cu).',
      tip: 'Calculates Joule heat generated by the cable section rising inside the switchboard enclosure.',
    },
    'tier.cableLen': {
      title: 'Internal Cable Length inside Enclosure in Metres (m)',
      what: 'Length of interconnector cable routed *inside* the switchboard cubicle (from gland plate to breaker terminals).',
      where: 'Switchgear General Arrangement (GA) cable entry detail.',
      typical: '1.5 m – 3.5 m inside the cubicle (enter ONLY the internal length heating the panel, not the external trench length!).',
      tip: 'External underground/tray cable heat does not warm the switchboard or switchroom.',
    },
    'tier.loadMode': {
      title: 'Load Entry Mode — Power (kW) vs Direct Operating Current (Amps)',
      what: 'Choose whether to enter load power in Kilowatts (kW) (ideal for motors/drives) or directly as Operating Current (Iop) in Amperes (A) (ideal for sub-distribution boards).',
      where: 'Mechanical Motor List (kW) or Electrical Sub-Distribution Board Schedule / Clamp-Meter reading (A).',
      typical: 'Motors & Variable Speed Drives (VSDs) → kW mode. Outgoing feeders & fuse-switches → Direct Amps.',
      tip: 'In kW mode, Operating Current Iop = (kW × 1000) / (√3 × V_LL × PF × η) × Duty Factor.',
    },
    'tier.loadFactor': {
      title: 'Duty / Load Utilisation Factor',
      what: 'Ratio of actual average running load to nameplate Kilowatts (kW) or base current (for example, a 55 kW pump absorbing 48 kW shaft power has a 0.87 load factor).',
      where: 'Process datasheet (absorbed kW vs rated motor kW) or operational profile.',
      typical: '0.80–0.90 for industrial pumps/fans/compressors; 1.00 for continuous full-load or conservative worst-case.',
      tip: 'Because resistive heat scales with Iop², running at 80% load cuts variable I²R losses by 36%!',
    },
    'tier.kw': {
      title: 'Rated / Absorbed Load Power in Kilowatts (kW)',
      what: 'Motor mechanical shaft power or electrical load power in Kilowatts (kW).',
      where: 'Motor nameplate, mechanical equipment list, or Piping & Instrumentation Diagram (P&ID) load schedule.',
      typical: 'Standard International Electrotechnical Commission (IEC) motor sizes: 7.5, 11, 15, 22, 30, 37, 45, 55, 75, 90, 110 kW.',
      tip: 'Combined with Power Factor (PF) and Efficiency (η) to compute Operating Current (Iop).',
    },
    'tier.pf': {
      title: 'Power Factor (PF, cos φ)',
      what: 'Ratio of real working power (Kilowatts, kW) to apparent power (Kilovolt-Amperes, kVA). Lower Power Factor draws higher Amperes for the same kW.',
      where: 'Motor manufacturer datasheet (full-load cos φ) or Variable Speed Drive (VSD) specification.',
      typical: '0.82–0.88 for standard 4-pole induction motors (Direct-On-Line / Star-Delta); 0.95–0.98 for Variable Speed Drives (VSD); 1.00 for resistive heaters.',
      tip: 'Lower Power Factor increases Operating Current (Iop), raising both device and busbar I²R heat.',
    },
    'tier.eff': {
      title: 'Motor / Load Efficiency (Eff, η)',
      what: 'Ratio of mechanical shaft output power to electrical input power drawn from the switchboard.',
      where: 'Motor datasheet—International Efficiency Class 3 (IE3) or Class 4 (IE4). Set to 1.00 if entering electrical input kW directly.',
      typical: '0.90–0.95 for IE3 motors (15–110 kW); 1.00 for general electrical feeders or resistive loads.',
      tip: 'Electrical Input kW = Shaft kW / Efficiency (η).',
    },
    'tier.amps': {
      title: 'Base Operating Current (Iop) in Amperes (A)',
      what: 'Normal continuous running current drawn by this outgoing feeder (before Duty Factor).',
      where: 'Sub-Distribution Board (Sub-DB) load schedule, maximum demand calculation, or site clamp-meter reading.',
      typical: 'Typically 50%–80% of the protective device Rated Current (In) (e.g. 160–280 A on a 400 A breaker/fuse).',
      tip: 'Running at 65% of Rated Current (In) generates only 0.65² = 42% of full-rated Joule heat loss.',
    },
    'tier.in': {
      title: 'Protective Device Rated Current (In) in Amperes (A)',
      what: 'Nominal frame or fuse-link current rating at which the manufacturer publishes Rated Power Loss (Pn).',
      where: 'Manufacturer datasheet (e.g. Eaton Bussmann Data Sheet 10164 for NH HRC fuses, or IEC 60947-2 breaker catalogue).',
      typical: 'HRC Fuses: 2 A to 1250 A (Eaton 2NHG000B up to 1250NHG4G). Breakers: 25 A to 3200 A.',
      tip: 'Denominator in International Electrotechnical Commission Technical Report 60890 (IEC TR 60890) scaling: P_op = P_n × (I_op / I_n)².',
    },
    'tier.pn': {
      title: 'Manufacturer Rated Power Loss (Pn) at Rated Current (In) in Watts (W)',
      what: 'Total 3-Pole (3P) load-dependent heat dissipation quoted by the manufacturer when carrying 100% of Rated Current (In).',
      where: 'Manufacturer\'s "Watts Loss / Power Dissipation" datasheet (note: single-link fuse losses like Eaton 1250NHG4G = 108 W/link are multiplied by 3 for 3-phase = 324 W!).',
      typical: 'Eaton 16NHG0B (3×): 9 W · 250NHG1B (3×): 57 W · 1250NHG4G (3×): 324 W · MCCB 400 A: 66 W · ACB 2500 A: 480 W.',
      tip: 'Automatically scaled by (I_op / I_n)² whenever operating below rated current.',
    },
    'tier.pfix': {
      title: 'Fixed / Standby Power Loss (Fixed W) in Watts (W)',
      what: 'Constant heat dissipated whenever energized, regardless of load current (contactor holding coils, electronic trip units, control transformers, relays, pilot lamps, Variable Speed Drive cooling fans).',
      where: 'Contactor coil holding watts datasheet, electronic trip unit spec, or Variable Speed Drive (VSD) standby datasheet.',
      typical: 'Breaker trip unit: 2–18 W · Direct-On-Line (DOL) coil + control: 9–22 W · Star-Delta (2 coils + timer): 25–35 W · VSD control/fan: 35–80 W · HRC Fuse: 0 W.',
      tip: 'Does NOT shrink with (I_op / I_n)² — stays constant whenever the circuit is energized.',
    },

    // --- Board & Standards Config ---
    'cfg.projName': {
      title: 'Project / Switchboard Name',
      what: 'Title of the switchboard printed across the Single Line Diagram (SLD), General Arrangement (GA), CSV, and PDF report headers.',
      where: 'Project Single Line Diagram (SLD) title block.',
      typical: 'Example: "MSB-A — Main Low Voltage Switchboard (Firm Supply A)".',
      tip: 'Stored inside saved JavaScript Object Notation (JSON) files and shareable links.',
    },
    'cfg.projNum': {
      title: 'Document / Calculation Reference Number',
      what: 'Engineering document number used for Quality Assurance (QA) traceability and exported file names.',
      where: 'Project document register.',
      typical: 'Example: "CEI-TH-001" (Control, Electrical & Instrumentation — Thermal Calc 001).',
      tip: 'Used automatically as the filename prefix for CSV, JSON, and Scalable Vector Graphics (SVG) exports.',
    },
    'cfg.eng': {
      title: 'Originating Engineer / Discipline',
      what: 'Engineer name or team printed on the Engineering Calculation Report title block.',
      where: 'Your name or engineering team.',
      typical: 'Example: "Control, Electrical & Instrumentation (CE&I) Engineering".',
      tip: 'Appears in the top-right header when printing or saving to Portable Document Format (PDF).',
    },
    'cfg.rev': {
      title: 'Document Revision',
      what: 'Revision code tracking iterations of the switchgear thermal calculation.',
      where: 'Project document control workflow.',
      typical: 'Example: "Rev A (Preliminary)", "Rev P02", "Rev C01 (For Construction)".',
      tip: 'Update when replacing assumed losses with certified vendor datasheet values.',
    },
    'cfg.v': {
      title: 'Nominal Line-to-Line System Voltage (V_LL) in Volts (V)',
      what: '3-Phase Line-to-Line Root Mean Square (RMS) voltage of the Low Voltage (LV) switchboard.',
      where: 'Site Single Line Diagram (SLD) or step-down Transformer (Tx) secondary rating.',
      typical: '400 V (standard International Electrotechnical Commission / UK / EU), 415 V (legacy UK), 480 V (60 Hz North America), 690 V (heavy industrial drives).',
      tip: 'Used to convert Kilowatts (kW) loads into Operating Current (Amperes).',
    },
    'cfg.f': {
      title: 'Alternating Current (AC) System Frequency in Hertz (Hz)',
      what: 'Mains supply frequency in cycles per second (Hertz, Hz).',
      where: 'Regional power grid standard (50 Hz in UK/EU/Asia/Australia; 60 Hz in North America/Saudi Arabia).',
      typical: '50 Hz (Copper skin depth δ ≈ 10.2 mm @ 70 °C) or 60 Hz (δ ≈ 9.3 mm @ 70 °C).',
      tip: 'Drives Skin Effect (ys) and Proximity Effect (yp) in Calculated AC busbar mode.',
    },
    'cfg.poles': {
      title: 'System Poles — 3-Phase + Neutral (3P+N) vs 3-Phase (3P)',
      what: 'Whether the switchboard includes a 4th Neutral (N) busbar alongside the 3 phases (L1, L2, L3).',
      where: 'Site earthing/distribution arrangement (Terra-Neutral Separate, TN-S, or Combined-Separate, TN-C-S).',
      typical: '3P+N (4-wire) for general distribution and mixed Motor Control Centres (MCCs); 3P (3-wire) for pure 3-phase motor boards.',
      tip: 'Neutral I²R heat is added when 3P+N is selected and Neutral Current Ratio > 0.',
    },
    'cfg.nratio': {
      title: 'Neutral Current Ratio (I_N / I_ph)',
      what: 'Average Neutral conductor current (I_N) divided by Phase current (I_ph), caused by phase imbalance or 3rd-order triplen harmonics.',
      where: 'Power quality harmonic study, imbalance estimate, or 0.00 for balanced 3-phase motor boards.',
      typical: '0.00 (balanced 3-phase motors) · 0.10 (mixed industrial board) · 0.25–0.50 (heavy single-phase / IT / LED harmonic loads).',
      tip: 'Neutral bar Joule heat scales with (I_N)² × R_N,AC.',
    },
    'cfg.rdf': {
      title: 'Rated Diversity Factor (RDF — IEC 61439-1)',
      what: 'Per-unit coincidence factor applied when summing multiple local outgoing circuits onto Vertical Dropper Busbars (VBB) and Main Horizontal Busbars (HBB), recognizing that not every circuit peaks simultaneously.',
      where: 'International Electrotechnical Commission (IEC) 61439-1 Table 101 or site maximum demand diversity study.',
      typical: '1.00 (conservative 100% simultaneous) · 0.90 (2–3 circuits) · 0.80 (4–5 circuits) · 0.70 (6–9 circuits) · 0.60 (10+ general circuits).',
      tip: 'Applied to local feeders summed onto busbars; Single-Contingency (N-1) Interconnector transfer stays at 100%.',
    },
    'cfg.growth': {
      title: 'Global Future Load Growth Allowance (%)',
      what: 'Percentage uplift applied to all active local loads in the "Normal + Future" and "Worst-Case" scenarios (in addition to any dedicated Future compartments).',
      where: 'Client Basis of Design or switchroom Heating, Ventilation, and Air Conditioning (HVAC) expansion margin.',
      typical: '10%–25% (15%–20% standard). Set 0% if using dedicated Future compartments only.',
      tip: 'Gives immediate visibility of future heat output in kilowatts (kW).',
    },
    'cfg.h': {
      title: 'Overall Panel Height in Millimetres (mm)',
      what: 'Total vertical height of the switchgear enclosure from Finished Floor Level (FFL) to roof.',
      where: 'Switchgear General Arrangement (GA) front elevation drawing.',
      typical: '2000 mm, 2100 mm, or 2200 mm (standard Form 4 Low Voltage switchboards).',
      tip: 'Drives GA scale, compartment Take-off Elevations (EL +mm), and IEC 60890 cooling surface area (Ae).',
    },
    'cfg.d': {
      title: 'Overall Panel Depth in Millimetres (mm)',
      what: 'Front-to-rear depth of the switchboard enclosure.',
      where: 'Switchgear General Arrangement (GA) side elevation.',
      typical: '600 mm (light front-access), 800–1000 mm (standard Form 4 Motor Control Centre / Switchboard), 1200 mm (back-to-back or heavy cabling).',
      tip: 'Used to compute IEC 60890 Effective Cooling Surface Area (Ae) and average Watts per square metre (W/m²) heat flux.',
    },
    'cfg.hbbh': {
      title: 'Main Horizontal Busbar (HBB) Chamber Height (mm)',
      what: 'Vertical height of the top or bottom enclosure chamber housing the main horizontal busbars.',
      where: 'Switchgear General Arrangement (GA) front elevation.',
      typical: '300 mm – 450 mm (350 mm typical for 1600 A–2500 A assemblies).',
      tip: 'Sets the exact vertical tap-off origin from which all Vertical Dropper Busbar (VBB) lengths are calculated.',
    },
    'cfg.hbbpos': {
      title: 'Main Horizontal Busbar (HBB) Position — Top vs Bottom',
      what: 'Whether the Main Horizontal Busbars (HBB) run along the top chamber or bottom chamber of the switchboard.',
      where: 'General Arrangement (GA) drawing (top HBB is typical with bottom cable entry, and vice versa).',
      typical: 'Top Busbar Chamber is the most common industrial arrangement.',
      tip: 'Toggling Top/Bottom automatically recalculates every vertical dropper span and tapering current.',
    },
    'cfg.tail': {
      title: 'Take-Off Connection Tail Length per Tier in Metres (m)',
      what: 'Short copper busbar link or cable tail connecting each compartment\'s Vertical Dropper Busbar (VBB) tap-off to its protective device line terminals.',
      where: 'Internal cubicle busbar dropper detail drawing.',
      typical: '0.25 m – 0.50 m (0.35 m is typical for Form 4 compartments). Set 0 m to exclude take-off tails.',
      tip: 'Captures internal connection losses inside each compartment.',
    },
    'cfg.joint': {
      title: 'Bolted Busbar Joint Contact Resistance in Micro-Ohms (µΩ)',
      what: 'Electrical contact resistance across one bolted Copper-to-Copper lap joint (per phase) at panel-to-panel busbar splices and dropper tap-offs.',
      where: 'Copper Development Association (CDA) / International Electrotechnical Commission (IEC) contact resistance guidelines.',
      typical: '3–10 µΩ per torqued clean/tinned Copper joint (5 µΩ typical; poorly torqued joints can exceed 20 µΩ).',
      tip: 'At 1600 A, a single 5 µΩ 3-phase splice joint generates 3 × 1600² × 5×10⁻⁶ = 38.4 W of local heat!',
    },
    'cfg.aux': {
      title: 'Panel Auxiliary Losses in Watts (W)',
      what: 'Continuous board-level auxiliary heat from power meters, 24 V Direct Current (DC) Power Supply Units (PSUs), Programmable Logic Controller (PLC) / Supervisory Control and Data Acquisition (SCADA) gateways, marshalling relays, and enclosure lighting.',
      where: 'Control & Instrumentation load list or design allowance.',
      typical: '80–250 W for a standard 5-column LV switchboard.',
      tip: 'Added to total heat loss in all operating scenarios.',
    },
    'cfg.inst': {
      title: 'Enclosure Installation Type — IEC 60890 Effective Cooling Area (Ae)',
      what: 'Defines which external enclosure faces can dissipate heat by natural convection/radiation per International Electrotechnical Commission (IEC) Technical Report 60890.',
      where: 'Switchroom layout drawing (standing clear in the room vs backed flush against a wall).',
      typical: 'Freestanding (front, rear, top & both ends exposed) vs Wall-Backed (rear face blocked).',
      tip: 'Calculates Effective Cooling Surface Area (Ae) in m² and average enclosure Heat Flux (W/m²).',
    },
    'cfg.hvac': {
      title: 'HVAC Cooling Safety Margin (%)',
      what: 'Design contingency percentage added above calculated switchgear kilowatts (kW) when issuing sensible heat loads to the Heating, Ventilation, and Air Conditioning (HVAC) engineer.',
      where: 'Project Mechanical, Electrical & Plumbing (MEP) / HVAC Basis of Design.',
      typical: '15%–25% (15% with verified vendor datasheets; 20%–25% at preliminary concept stage).',
      tip: 'Shown live on the HVAC Cooling Key Performance Indicator (KPI) card and exported reports.',
    },

    // --- UI Abbreviation Glossary Badges (KPIs, Tabs, Toolbar) ---
    'ui.sld': {
      title: 'Single Line Diagram (SLD)',
      what: 'Simplified electrical schematic showing the main power path: Incomers, Main Horizontal Busbar (HBB), Bus-Section Couplers (BC), Vertical Dropper Busbars (VBB), Outgoing Feeders, Motor Starters, HRC Fuses, and Interconnectors (IC).',
      where: 'Standard electrical design deliverable used to model current flow and heat losses.',
      typical: 'Click any item to edit, drag items to move between columns, or use Ctrl + Mouse Wheel to zoom.',
      tip: 'Changes on the SLD instantly synchronize with the General Arrangement (GA) elevation and heat schedules.',
    },
    'ui.ga': {
      title: 'General Arrangement (GA) Front Elevation',
      what: 'True-to-scale physical front view of the switchboard showing cubicle widths, heights, busbar chambers, and Take-Off Elevations above Finished Floor Level (EL +mm).',
      where: 'Automatically generated from your column widths and compartment tier heights.',
      typical: 'Drives exact Horizontal Busbar (HBB) and Vertical Dropper Busbar (VBB) conductor lengths in metres.',
      tip: 'Toggle the Thermal Heatmap overlay to spot hot compartments (like Variable Speed Drives) and high W/m busbar spans.',
    },

    // --- Switchroom Cooling & Ventilation ---
    'room.dims': {
      title: 'Switchroom Internal Dimensions (Length × Width × Height in Metres)',
      what: 'Internal clear dimensions of the electrical switchroom, used to calculate Room Volume (m³), Floor Area (m²), Air Change Rate per Hour (ACH), and thermal heat density (W/m²).',
      where: 'Architectural floor plan and building section drawing.',
      typical: 'Example: 5 m × 5 m × 9 m = 225 m³ (industrial plant switchroom), or 6 m × 4 m × 3.5 m = 84 m³ (standard substation room).',
      tip: 'Taller rooms allow larger vertical Stack Height (H_stack), boosting natural buoyancy ventilation.',
    },
    'room.tamb': {
      title: 'Outdoor / Supply Air Design Temperature (T_amb) in °C',
      what: 'Maximum design temperature of incoming fresh cooling air entering the switchroom (outdoor summer ambient or adjacent corridor supply temperature).',
      where: 'Chartered Institution of Building Services Engineers (CIBSE) Guide A / ASHRAE local summer design weather data.',
      typical: 'UK/Northern Europe summer design: 25 °C – 28 °C · Warm industrial / Southern Europe: 30 °C – 35 °C · Middle East: 40 °C – 46 °C.',
      tip: 'Allowable temperature rise ΔT = T_max − T_amb. If T_amb approaches T_max, Active Air Conditioning (DX / Chilled Water) becomes mandatory.',
    },
    'room.tmax': {
      title: 'Maximum Permitted Switchroom Temperature (T_max) in °C',
      what: 'Upper ambient air temperature limit allowed inside the switchroom around the switchgear enclosure.',
      where: 'International Electrotechnical Commission (IEC) 61439-1 ambient limits and Variable Speed Drive (VSD) / Uninterruptible Power Supply (UPS) vendor derating limits.',
      typical: 'IEC 61439-1 standard: 35 °C (24-hour average) / 40 °C (peak). VSDs/PLCs often derate above 40 °C; batteries prefer 20 °C – 25 °C.',
      tip: 'Higher ΔT reduces required airflow linearly (Q = V̇ · ρ · cp · ΔT), but never exceed equipment derating limits.',
    },
    'room.other': {
      title: 'Other Room Heat Gains (Transformers, UPS, Lighting, Solar) in kW',
      what: 'Additional sensible heat sources inside the same switchroom besides this switchboard (e.g. second switchboard, dry-type transformer, Uninterruptible Power Supply, lighting, solar fabric gains).',
      where: 'Electrical room heat-load schedule and Mechanical, Electrical & Plumbing (MEP) building thermal model.',
      typical: '0.2–0.5 kW (LED lighting & small power), 1–5 kW (UPS / battery chargers), 5–15 kW (indoor dry-type transformer).',
      tip: 'Added directly to the design switchgear heat load when sizing airflow and fans.',
    },
    'room.louver': {
      title: 'Natural Ventilation Louver Free Area (Each: Inlet & Exhaust) in m²',
      what: 'Net aerodynamic FREE opening area (typically ~45%–55% of gross louver face area after accounting for rain blades and insect mesh) of the low-level air inlet AND matching high-level air exhaust louver.',
      where: 'Architectural / Heating, Ventilation, and Air Conditioning (HVAC) louver schedule.',
      typical: '0.30 m² – 1.50 m² free area (a 1.0 m × 1.0 m weather louver with 50% free area gives 0.50 m² free area).',
      tip: 'Used in CIBSE Guide A stack-effect buoyancy calculation to test whether natural ventilation alone is sufficient.',
    },
    'room.stack': {
      title: 'Vertical Stack Height Between Inlet & Exhaust Louvers (H_stack) in m',
      what: 'Vertical height difference between the centreline of the low-level cool-air intake louver and the centreline of the high-level hot-air exhaust louver.',
      where: 'Switchroom wall elevation / architectural section.',
      typical: 'Typically Room Height minus 1.0–1.5 m (e.g. 6.0 m – 7.5 m in a 9 m high room; 2.0 m in a 3.5 m room).',
      tip: 'Natural buoyancy airflow increases with √(H_stack): placing exhaust louvers as high as possible maximises natural cooling.',
    },
    'room.override': {
      title: 'Manual Heat Load Override Test (kW)',
      what: 'Optional what-if override allowing you to test any arbitrary switchgear heat dissipation (e.g. 6.0 kW) directly against your switchroom volume and temperatures without editing the switchboard.',
      where: 'Use for rapid sensitivity checks or verifying third-party vendor kW figures.',
      typical: 'Unchecked = uses live calculated Switchgear Heat Output (kW) automatically. Checked = uses your typed test kW.',
      tip: 'Great for quickly checking scenarios like "6 kW in a 5 × 5 × 9 m room".',
    },

    // --- Simple Mode ---
    'simple.topology': {
      title: 'Switchboard Topology (Simple Mode)',
      what: 'High-level arrangement of incoming supplies, Bus-Section Coupler (BC), and Firm-Supply Interconnector (IC) to an adjacent B-Side switchboard.',
      where: 'Preliminary site Single Line Diagram (SLD).',
      typical: 'Single Incomer + Interconnector is standard for A/B firm-supply switchrooms.',
      tip: 'When you click "Expand to Detailed Mode", all columns and incomers/couplers/interconnectors are generated automatically from this choice.',
    },
    'simple.loadPct': {
      title: 'Average Running Load (% of Rated Equipment)',
      what: 'Rough average utilisation across all motors and outgoing feeders for a preliminary crude heat assessment.',
      where: 'Early-stage engineering estimate before full motor/load lists are finalised.',
      typical: '65% – 80% (75% is a realistic industrial running average; 85–90% is conservative).',
      tip: 'Applied cleanly to all generated circuits if you expand into Detailed Mode.',
    },
  };

  let tipEl = null;
  let hideTimer = null;

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureTipEl() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.id = 'sg-help-tooltip';
      tipEl.className = 'sg-help-tooltip';
      tipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tipEl);
      tipEl.addEventListener('mouseenter', () => {
        if (hideTimer) clearTimeout(hideTimer);
      });
      tipEl.addEventListener('mouseleave', () => {
        scheduleHide();
      });
    }
    return tipEl;
  }

  function showForTarget(target) {
    const key = target.dataset.help;
    const entry = HELP_DB[key];
    if (!entry) return;
    if (hideTimer) clearTimeout(hideTimer);

    const el = ensureTipEl();
    el.innerHTML = `
      <div class="ht-title">${esc(entry.title)}</div>
      <div class="ht-row"><span class="ht-k">What it is:</span> ${esc(entry.what)}</div>
      <div class="ht-row"><span class="ht-k">Where to get it:</span> ${esc(entry.where)}</div>
      <div class="ht-row"><span class="ht-k">Typical values:</span> <span class="ht-typ">${esc(entry.typical)}</span></div>
      ${entry.tip ? `<div class="ht-tip">💡 ${esc(entry.tip)}</div>` : ''}
    `;

    el.classList.add('visible');

    const rect = target.getBoundingClientRect();
    const tw = el.offsetWidth || 350;
    const th = el.offsetHeight || 180;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 12;

    let left = rect.left;
    let top = rect.bottom + 8;

    if (rect.left > vw * 0.55 && rect.left - tw - 12 > pad) {
      left = rect.left - tw - 12;
      top = Math.min(vh - th - pad, Math.max(pad, rect.top - 10));
    } else {
      if (left + tw + pad > vw) left = vw - tw - pad;
      if (left < pad) left = pad;
      if (top + th + pad > vh) {
        top = rect.top - th - 8;
        if (top < pad) top = pad;
      }
    }

    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  function scheduleHide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (tipEl) tipEl.classList.remove('visible');
    }, 120);
  }

  function initDelegation() {
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-help]');
      if (target) showForTarget(target);
    });
    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('[data-help]');
      if (target) scheduleHide();
    });
    document.addEventListener('focusin', (e) => {
      const target = e.target.closest('[data-help]');
      if (target) showForTarget(target);
    });
    document.addEventListener('focusout', (e) => {
      const target = e.target.closest('[data-help]');
      if (target) scheduleHide();
    });
  }

  initDelegation();

  return {
    HELP_DB,
    showForTarget,
    hide: scheduleHide,
  };
})();
