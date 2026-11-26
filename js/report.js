/**
 * Configurable Report & Export Generator
 * Supports:
 * - Formatted Multi-Page HTML / Print PDF Report (with configurable sections, detail level, orientation & units)
 * - Structured Plain-Text / Email Summary (.txt)
 * - Markdown Engineering Calculation Note (.md)
 * - Standalone Self-Contained HTML Export (.html)
 * - CSV (Excel) & JSON & SVG Exports
 */

window.SGReport = (function () {
  'use strict';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function fmtPower(watts, rcfg) {
    const w = Number(watts || 0);
    const dp = Number(rcfg.kwDecimals != null ? rcfg.kwDecimals : 3);
    const kwStr = (w / 1000).toFixed(dp) + ' kW';
    const wStr = w.toFixed(0) + ' W';
    if (rcfg.unitsMode === 'kw') return kwStr;
    if (rcfg.unitsMode === 'w') return wStr;
    return `${kwStr} (${wStr})`;
  }

  function scenarioLabelOf(id, allScenarios) {
    const found = allScenarios.find((s) => s.id === id);
    return found ? `${found.label} — ${found.subtitle}` : id;
  }

  function getFilteredScenarios(evalRes, allScenarios, rcfg) {
    if (rcfg.scenarioScope === 'active') {
      return allScenarios.filter((s) => s.id === evalRes.scenario);
    }
    return allScenarios;
  }

  function getFilteredDeviceRows(evalRes, rcfg) {
    if (rcfg.includeInactiveRows) return evalRes.deviceRows;
    return evalRes.deviceRows.filter((r) => r.isActive && r.role !== 'spacer');
  }

  function getCategoryRows(t) {
    const grand = Math.max(0.001, t.grandTotalW);
    return [
      { name: 'Main Horizontal Busbar (HBB)', w: t.totalHbbLossW },
      { name: 'Vertical Dropper Busbars (VBB)', w: t.totalVbbLossW },
      { name: 'Take-off Tails, Risers & Bolted Joints', w: t.totalTakeoffAndJointW },
      { name: 'Incomers & Bus-Section Couplers (ACB)', w: t.totalIncomerDevicesW },
      { name: 'Motor Starters & Variable Speed Drives', w: t.totalStarterDevicesW },
      { name: 'Outgoing Protective Feeders & Eaton HRC Fuses', w: t.totalFeederDevicesW },
      { name: 'Interconnector Device & Internal Cable', w: t.totalInterconnectorDeviceW + t.totalInterconnectorCableW },
      { name: 'Panel Auxiliaries (Meters, PSU, PLC, Lighting)', w: t.totalAuxW },
    ].map((row) => ({
      ...row,
      pct: (row.w / grand) * 100,
    }));
  }

  /**
   * Build configurable Formatted HTML Report (used in BOTH Live Preview and Print/PDF!)
   * idPrefix should be 'prev-' for on-screen preview and 'print-' for hidden print container
   * so SVG pattern/marker IDs never collide!
   */
  function buildPrintReportHTML(project, evalRes, allScenarios, idPrefix) {
    const rcfg = window.SGState.ensureReportConfig(project);
    const s = rcfg.sections;
    const px = idPrefix || 'print-';
    const bb = project.mainBusbar;
    const hr = evalRes.hbbRes;
    const t = evalRes.totals;
    const scenarios = getFilteredScenarios(evalRes, allScenarios, rcfg);
    const devRows = getFilteredDeviceRows(evalRes, rcfg);
    const catRows = getCategoryRows(t);
    const pb = rcfg.pageBreaks ? ' print-page-break' : '';
    const diagTheme = rcfg.diagramTheme === 'active' ? undefined : 'light';

    const sections = [];

    // 1. Title Block
    if (s.titleBlock) {
      sections.push(`
        <div class="print-header">
          <div>
            <h1>Switchgear Heat Loss Calculation Report</h1>
            <div><strong>${esc(project.meta.projectName)}</strong> · Ref: ${esc(project.meta.projectNumber)} · ${esc(project.meta.revision)}</div>
            <div>Basis: IEC 60439 / 61439 · ${project.config.voltageV} V ${project.config.frequencyHz} Hz ${project.config.poles} · Board RDF ${(project.config.diversityFactorRDF * 100).toFixed(0)}%</div>
          </div>
          <div style="text-align:right; font-size:10.5px;">
            <div><strong>Date:</strong> ${esc(project.meta.date)}</div>
            <div><strong>Engineer:</strong> ${esc(project.meta.engineer)}</div>
            <div><strong>Active Scenario:</strong> ${esc(scenarioLabelOf(evalRes.scenario, allScenarios))}</div>
          </div>
        </div>
      `);
    }

    let secNum = 0;
    const nextNum = () => {
      secNum += 1;
      return secNum;
    };

    // 2. Executive Summary
    if (s.execSummary) {
      const n = nextNum();
      sections.push(`
        <div class="print-section">
          <h2>${n}. Executive Heat Output Summary</h2>
          <div class="rep-kpi-strip">
            <div class="rep-kpi">
              <div class="rk-lbl">Active Scenario Total</div>
              <div class="rk-val">${esc(fmtPower(t.grandTotalW, rcfg))}</div>
              ${rcfg.includeBtuHvac ? `<div class="rk-sub">${Math.round(t.btuPerHr).toLocaleString()} BTU/hr</div>` : ''}
            </div>
            <div class="rep-kpi">
              <div class="rk-lbl">Busbars &amp; Joints</div>
              <div class="rk-val">${esc(fmtPower(t.totalBusbarW, rcfg))}</div>
              <div class="rk-sub">${((t.totalBusbarW / Math.max(1, t.grandTotalW)) * 100).toFixed(1)}% of total</div>
            </div>
            <div class="rep-kpi">
              <div class="rk-lbl">Devices, Fuses &amp; Starters</div>
              <div class="rk-val">${esc(fmtPower(t.totalDevicesW, rcfg))}</div>
              <div class="rk-sub">${((t.totalDevicesW / Math.max(1, t.grandTotalW)) * 100).toFixed(1)}% of total</div>
            </div>
            <div class="rep-kpi">
              <div class="rk-lbl">Incomer Load / Peak HBB</div>
              <div class="rk-val">${Math.round(t.totalIncomerCurrentA)} A</div>
              <div class="rk-sub">Peak ${t.maxHbbWPerM.toFixed(1)} W/m</div>
            </div>
            ${
              rcfg.includeBtuHvac
                ? `<div class="rep-kpi">
                    <div class="rk-lbl">HVAC Cooling (+${project.config.hvacSafetyMarginPct}%)</div>
                    <div class="rk-val">${t.recommendedCoolingKW.toFixed(rcfg.kwDecimals)} kW</div>
                    <div class="rk-sub">${Math.round(t.recommendedCoolingKW * 3412.14).toLocaleString()} BTU/hr</div>
                  </div>`
                : ''
            }
          </div>

          <table class="print-table" style="margin-top:8px;">
            <thead>
              <tr>
                <th>Operating Scenario</th>
                <th class="num">Total Loss</th>
                <th class="num">Busbars &amp; Joints</th>
                <th class="num">Devices &amp; Starters</th>
                <th class="num">Incomer Load (A)</th>
                <th class="num">Peak HBB (W/m)</th>
                ${rcfg.includeBtuHvac ? `<th class="num">HVAC Cooling (+${project.config.hvacSafetyMarginPct}%)</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${scenarios
                .map((sc) => {
                  const st = sc.result.totals;
                  const bold = sc.id === evalRes.scenario ? 'font-weight:700;background:#f8fafc;' : '';
                  return `<tr style="${bold}">
                    <td>${esc(sc.label)} — <span style="color:#475569">${esc(sc.subtitle)}</span></td>
                    <td class="num">${esc(fmtPower(st.grandTotalW, rcfg))}</td>
                    <td class="num">${esc(fmtPower(st.totalBusbarW, rcfg))}</td>
                    <td class="num">${esc(fmtPower(st.totalDevicesW, rcfg))}</td>
                    <td class="num">${st.totalIncomerCurrentA.toFixed(0)}</td>
                    <td class="num">${st.maxHbbWPerM.toFixed(1)}</td>
                    ${rcfg.includeBtuHvac ? `<td class="num">${st.recommendedCoolingKW.toFixed(rcfg.kwDecimals)} kW</td>` : ''}
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `);
    }

    // 3. Category Breakdown
    if (s.categoryBreakdown) {
      const n = nextNum();
      sections.push(`
        <div class="print-section">
          <h2>${n}. Heat Loss Breakdown by Category (${esc(evalRes.scenario.toUpperCase())})</h2>
          <table class="print-table">
            <thead>
              <tr>
                <th>Heat Source Category</th>
                <th class="num">Power Dissipation</th>
                <th class="num">Share (%)</th>
              </tr>
            </thead>
            <tbody>
              ${catRows
                .map(
                  (r) => `<tr>
                    <td>${esc(r.name)}</td>
                    <td class="num">${esc(fmtPower(r.w, rcfg))}</td>
                    <td class="num">${r.pct.toFixed(1)}%</td>
                  </tr>`
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight:700;background:#f1f5f9;">
                <td>Grand Total</td>
                <td class="num">${esc(fmtPower(t.grandTotalW, rcfg))}</td>
                <td class="num">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `);
    }

    // 4. Busbar Electrical & Thermal Basis + Optional Worked Steps
    if (s.busbarBasis || s.workedBusbarSteps) {
      const n = nextNum();
      sections.push(`
        <div class="print-section">
          <h2>${n}. Main Busbar Electrical &amp; Thermal Basis (Joule's Law)</h2>
          <p class="rep-p">
            <strong>Main Horizontal Busbar (HBB):</strong> ${bb.barsPerPhase} × ${bb.widthMm} × ${bb.thicknessMm} mm
            (${hr.areaMm2} mm²/phase) ${esc(hr.material.name)} · Rated ${bb.ratedCurrentA} A · Cert: ${esc(bb.certRef)}.
            R<sub>DC,20°C</sub> = ${hr.rDc20_uOhmPerM.toFixed(2)} µΩ/m →
            R<sub>DC,${hr.tempC}°C</sub> = ${hr.rDcT_uOhmPerM.toFixed(2)} µΩ/m × k<sub>AC</sub> (${hr.kAcUsed.toFixed(3)}, ${hr.acFactorMode}) =
            <strong>R<sub>AC</sub> = ${hr.rAcT_uOhmPerM.toFixed(2)} µΩ/m</strong>.
            At rated ${bb.ratedCurrentA} A (3-phase): <strong>${evalRes.hbbRatedWPerM.toFixed(1)} W/m</strong>.
          </p>
          ${
            s.workedBusbarSteps
              ? `<div class="rep-worked-box">
                  <div><strong>Step 1 — Area per Phase:</strong> A = ${bb.barsPerPhase} × ${bb.widthMm} × ${bb.thicknessMm} = ${hr.areaMm2} mm²</div>
                  <div><strong>Step 2 — DC Resistance @ 20 °C:</strong> R_DC,20 = ρ₂₀ / A = ${hr.material.rho20} / ${hr.areaMm2} = ${hr.rDc20_uOhmPerM.toFixed(3)} µΩ/m</div>
                  <div><strong>Step 3 — Temperature Correction (${hr.tempC} °C):</strong> R_DC(${hr.tempC}°C) = ${hr.rDc20_uOhmPerM.toFixed(3)} × [1 + ${hr.material.alpha20} × (${hr.tempC} − 20)] = ${hr.rDcT_uOhmPerM.toFixed(3)} µΩ/m</div>
                  <div><strong>Step 4 — AC Skin/Proximity Factor (${project.config.frequencyHz} Hz):</strong> δ = ${hr.skinDepthMm.toFixed(2)} mm · Calc k_AC = 1 + y_s(${hr.ys.toFixed(3)}) + y_p(${hr.yp.toFixed(3)}) + y_e(${hr.ye.toFixed(3)}) = ${hr.kAcCalculated.toFixed(3)} · Active k_AC = <strong>${hr.kAcUsed.toFixed(3)}</strong> (${hr.acFactorMode})</div>
                  <div><strong>Step 5 — AC Resistance per Metre:</strong> R_AC = ${hr.rDcT_uOhmPerM.toFixed(3)} × ${hr.kAcUsed.toFixed(3)} = <strong>${hr.rAcT_uOhmPerM.toFixed(3)} µΩ/m</strong></div>
                  <div><strong>Step 6 — Rated 3-Phase Heat Loss per Metre:</strong> P/L = 3 × (${bb.ratedCurrentA})² × ${hr.rAcT_uOhmPerM.toFixed(3)}×10⁻⁶ = <strong>${evalRes.hbbRatedWPerM.toFixed(1)} W/m</strong></div>
                </div>`
              : ''
          }
        </div>
      `);
    }

    // 5. Single Line Diagram (SLD)
    if (s.sldDiagram) {
      const n = nextNum();
      const sldSvg = window.SGSLD.renderSLD(project, evalRes, null, 1.0, diagTheme, px);
      sections.push(`
        <div class="print-section${pb} print-diagram-block">
          <h2>${n}. Single Line Diagram (SLD)</h2>
          <div class="print-svg-wrap">${sldSvg}</div>
        </div>
      `);
    }

    // 6. General Arrangement (GA)
    if (s.gaDiagram) {
      const n = nextNum();
      const gaSvg = window.SGGA.renderGA(
        project,
        evalRes,
        null,
        { showHeatmap: rcfg.gaHeatmap, showDimensions: rcfg.gaDims, showBusbars: rcfg.gaBusbars },
        1.0,
        diagTheme,
        px
      );
      sections.push(`
        <div class="print-section${pb} print-diagram-block">
          <h2>${n}. General Arrangement (GA Front Elevation &amp; Take-Off Positions)</h2>
          <div class="print-svg-wrap">${gaSvg}</div>
        </div>
      `);
    }

    // 7. Column Summary
    if (s.columnSummary) {
      const n = nextNum();
      sections.push(`
        <div class="print-section${pb}">
          <h2>${n}. Column-by-Column Heat Summary</h2>
          <table class="print-table">
            <thead>
              <tr>
                <th>Column / Cubicle</th>
                <th class="num">Width (mm)</th>
                <th class="num">Net Load / Supply (A)</th>
                <th class="num">Devices &amp; Starters (W)</th>
                <th class="num">Vertical Dropper (W)</th>
                <th class="num">Takeoffs &amp; Cable (W)</th>
                <th class="num">Column Total</th>
              </tr>
            </thead>
            <tbody>
              ${evalRes.columns
                .map(
                  (cr) => `<tr>
                    <td><strong>${esc(cr.col.name)}</strong></td>
                    <td class="num">${cr.widthMm}</td>
                    <td class="num">${cr.hasIncomer ? 'Incomer ' + cr.incomerSupplyA.toFixed(0) : cr.colTotalLoadA.toFixed(1)}</td>
                    <td class="num">${cr.colDevicesW.toFixed(1)}</td>
                    <td class="num">${cr.vbbTotalLossW.toFixed(1)}</td>
                    <td class="num">${(cr.colTakeoffW + cr.colCableW).toFixed(1)}</td>
                    <td class="num"><strong>${esc(fmtPower(cr.colTotalLossW, rcfg))}</strong></td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `);
    }

    // 8. Horizontal Busbar Segment Schedule
    if (s.hbbSchedule) {
      const n = nextNum();
      sections.push(`
        <div class="print-section${s.columnSummary ? '' : pb}">
          <h2>${n}. Main Horizontal Busbar (HBB) Segment Losses</h2>
          <table class="print-table">
            <thead>
              <tr>
                <th>From Column</th>
                <th>To Column</th>
                <th class="num">Length (m)</th>
                <th class="num">Current (A)</th>
                <th class="num">Util (%)</th>
                <th class="num">3-Ph (W/m)</th>
                <th class="num">Busbar (W)</th>
                <th class="num">Splice Joint (W)</th>
                <th class="num">Total (W)</th>
              </tr>
            </thead>
            <tbody>
              ${evalRes.hbbSegments
                .map(
                  (seg) => `<tr>
                    <td>${esc(seg.fromColName)}</td>
                    <td>${esc(seg.toColName)}</td>
                    <td class="num">${seg.lengthM.toFixed(2)}</td>
                    <td class="num">${seg.direction === 'right' ? '→ ' : '← '}${seg.currentA.toFixed(1)}</td>
                    <td class="num">${seg.utilizationPct.toFixed(1)}%</td>
                    <td class="num">${seg.wPerMTotal.toFixed(1)}</td>
                    <td class="num">${seg.lossW.toFixed(1)}</td>
                    <td class="num">${seg.jointLossW.toFixed(1)}</td>
                    <td class="num"><strong>${seg.totalSegW.toFixed(1)}</strong></td>
                  </tr>`
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight:700;background:#f1f5f9;">
                <td colspan="2">Total Horizontal Busbar</td>
                <td class="num">${t.totalHbbLenM.toFixed(2)}</td>
                <td class="num">Max ${t.maxHbbCurrentA.toFixed(0)}</td>
                <td></td>
                <td class="num">Max ${t.maxHbbWPerM.toFixed(1)}</td>
                <td class="num">${t.totalHbbLossW.toFixed(1)}</td>
                <td class="num">${evalRes.hbbSegments.reduce((a, b) => a + b.jointLossW, 0).toFixed(1)}</td>
                <td class="num">${(t.totalHbbLossW + evalRes.hbbSegments.reduce((a, b) => a + b.jointLossW, 0)).toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `);
    }

    // 9. Vertical Dropper Busbar Segment Schedule
    if (s.vbbSchedule) {
      const n = nextNum();
      sections.push(`
        <div class="print-section">
          <h2>${n}. Vertical Dropper Busbar (VBB) Segment Losses</h2>
          <table class="print-table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Span (From → To)</th>
                <th class="num">Take-off EL (mm)</th>
                <th class="num">Span (m)</th>
                <th class="num">Current (A)</th>
                <th class="num">Util (%)</th>
                <th class="num">3-Ph (W/m)</th>
                <th class="num">Loss (W)</th>
              </tr>
            </thead>
            <tbody>
              ${evalRes.vbbSegments
                .map(
                  (seg) => `<tr>
                    <td>${esc(seg.colName)}</td>
                    <td>${esc(seg.fromLabel)} → ${esc(seg.toLabel)}</td>
                    <td class="num">+${seg.takeoffElevationMm}</td>
                    <td class="num">${seg.lengthM.toFixed(2)}</td>
                    <td class="num">${seg.currentA.toFixed(1)}</td>
                    <td class="num">${seg.utilizationPct.toFixed(1)}%</td>
                    <td class="num">${seg.wPerMTotal.toFixed(1)}</td>
                    <td class="num"><strong>${seg.lossW.toFixed(1)}</strong></td>
                  </tr>`
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight:700;background:#f1f5f9;">
                <td colspan="3">Total Vertical Droppers</td>
                <td class="num">${t.totalVbbLenM.toFixed(2)}</td>
                <td></td>
                <td></td>
                <td class="num">Max ${t.maxVbbWPerM.toFixed(1)}</td>
                <td class="num">${t.totalVbbLossW.toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `);
    }

    // 10. Protective Devices, Eaton HRC Fuses & Starters Schedule
    if (s.deviceSchedule) {
      const n = nextNum();
      sections.push(`
        <div class="print-section${pb}">
          <h2>${n}. Protective Devices, Eaton HRC Fuses &amp; Starters Schedule</h2>
          <table class="print-table">
            <thead>
              <tr>
                <th>Col</th>
                <th>Tag</th>
                <th>Description</th>
                <th>Category</th>
                <th>Status</th>
                <th class="num">In (A)</th>
                <th class="num">Iop (A)</th>
                <th class="num">(Iop/In)²</th>
                <th class="num">Fixed (W)</th>
                <th class="num">Var (W)</th>
                <th class="num">Takeoff/Cable (W)</th>
                <th class="num">Total (W)</th>
              </tr>
            </thead>
            <tbody>
              ${devRows
                .map((r) => {
                  const mainRow = `<tr>
                    <td>${esc(r.colName.split(' ')[0])}</td>
                    <td><strong>${esc(r.tag)}</strong></td>
                    <td>${esc(r.description)}</td>
                    <td>${esc(r.category)}</td>
                    <td>${esc(r.role === 'spacer' ? 'spare' : r.status)}</td>
                    <td class="num">${r.role === 'spacer' ? '—' : r.ratedCurrentA}</td>
                    <td class="num">${r.iOp.toFixed(1)}</td>
                    <td class="num">${r.role === 'spacer' ? '—' : (r.loadRatio * r.loadRatio).toFixed(2)}</td>
                    <td class="num">${r.fixedLossW.toFixed(1)}</td>
                    <td class="num">${r.varLossW.toFixed(1)}</td>
                    <td class="num">${(r.takeoffLossW + r.cableLossW).toFixed(1)}</td>
                    <td class="num"><strong>${r.totalRowW.toFixed(1)}</strong></td>
                  </tr>`;
                  if (!s.deviceSubComponents || !r.breakdown || r.breakdown.length <= 1) return mainRow;
                  const subRows = r.breakdown
                    .map(
                      (b) => `<tr style="color:#475569;font-size:9px;background:#f8fafc;">
                        <td></td>
                        <td>↳</td>
                        <td colspan="6">${esc(b.name)} (Rated Pn = ${b.ratedLossW} W, Fixed = ${b.fixedLossW} W)</td>
                        <td class="num">${b.fixedLossW.toFixed(1)}</td>
                        <td class="num">${(b.opLossW - b.fixedLossW).toFixed(1)}</td>
                        <td class="num">—</td>
                        <td class="num">${b.opLossW.toFixed(1)}</td>
                      </tr>`
                    )
                    .join('');
                  return mainRow + subRows;
                })
                .join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight:700;background:#f1f5f9;">
                <td colspan="8">Total Shown Compartments</td>
                <td class="num">${devRows.reduce((a, b) => a + b.fixedLossW, 0).toFixed(1)}</td>
                <td class="num">${devRows.reduce((a, b) => a + b.varLossW, 0).toFixed(1)}</td>
                <td class="num">${devRows.reduce((a, b) => a + b.takeoffLossW + b.cableLossW, 0).toFixed(1)}</td>
                <td class="num">${devRows.reduce((a, b) => a + b.totalRowW, 0).toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `);
    }

    // 11. IEC 60890 Enclosure Advisory
    if (s.enclosureAdvisory) {
      const n = nextNum();
      sections.push(`
        <div class="print-section">
          <h2>${n}. IEC 60890 Enclosure Surface Area &amp; Heat Flux Advisory</h2>
          <p class="rep-p">
            Overall Assembly: <strong>${evalRes.totalWidthMm} mm (W) × ${evalRes.panelHeightMm} mm (H) × ${project.config.panelDepthMm} mm (D)</strong> ·
            Installation: <strong>${project.config.installationType === 'wall_backed' ? 'Wall-Backed (Rear Blocked)' : 'Freestanding (All Faces Exposed)'}</strong> ·
            Effective Cooling Surface A<sub>e</sub> ≈ <strong>${t.effectiveAreaM2.toFixed(2)} m²</strong> ·
            Average Enclosure Heat Flux: <strong>${t.heatFluxWPerM2.toFixed(1)} W/m²</strong>.
            ${rcfg.includeBtuHvac ? `Recommended Switchroom Sensible Cooling (+${project.config.hvacSafetyMarginPct}% margin): <strong>${t.recommendedCoolingKW.toFixed(rcfg.kwDecimals)} kW (${Math.round(t.recommendedCoolingKW * 3412.14).toLocaleString()} BTU/hr)</strong>.` : ''}
          </p>
        </div>
      `);
    }

    // 12. Methodology & Equations Appendix
    if (s.methodologyAppendix) {
      const n = nextNum();
      sections.push(`
        <div class="print-section">
          <h2>${n}. Calculation Methodology &amp; Governing Equations</h2>
          <ul class="rep-list">
            <li><strong>Busbar Direct Current Resistance:</strong> R<sub>DC</sub>(T) = (ρ<sub>20</sub> / (n · w · t)) × [1 + α<sub>20</sub> · (T<sub>op</sub> − 20)]</li>
            <li><strong>AC Conversion:</strong> R<sub>AC</sub>(T) = R<sub>DC</sub>(T) × k<sub>AC</sub>, using either Manual Factor S or calculated skin/proximity/eddy factor k<sub>AC</sub> = 1 + y<sub>s</sub> + y<sub>p</sub> + y<sub>e</sub>.</li>
            <li><strong>3-Phase Busbar Joule Loss:</strong> P<sub>seg</sub> = [3 · I² · R<sub>AC</sub> + (k<sub>N</sub> · I)² · R<sub>N,AC</sub>] · L<sub>seg</sub> + 3 · I² · R<sub>joint</sub>.</li>
            <li><strong>Protective Devices, HRC Fuses &amp; Starters (IEC TR 60890):</strong> P<sub>op</sub> = P<sub>fixed</sub> + P<sub>n</sub> · (I<sub>op</sub> / I<sub>n</sub>)² (with IGBT conduction/switching load curve for VSDs).</li>
            <li><strong>Motor Operating Current:</strong> I<sub>op</sub> = [P<sub>kW</sub> × 1000 / (√3 · V<sub>LL</sub> · cos φ · η)] × Duty Factor.</li>
            <li><strong>Diversity (IEC 61439-1):</strong> Board RDF (${(project.config.diversityFactorRDF * 100).toFixed(0)}%) applied when summing local circuits onto vertical/horizontal busbars; N-1 interconnector transfer applied at 100%.</li>
          </ul>
        </div>
      `);
    }

    // 13. Notes & Sign-Off Block
    if (s.signOffBlock) {
      sections.push(`
        <div class="print-section">
          ${rcfg.customNotes ? `<h2>Notes &amp; Design Assumptions</h2><p class="rep-p">${esc(rcfg.customNotes)}</p>` : ''}
          <table class="print-table" style="margin-top:10px;">
            <thead>
              <tr><th>Prepared By</th><th>Checked By</th><th>Approved By</th><th>Date</th><th>Revision</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>${esc(project.meta.engineer)}</td>
                <td>${esc(rcfg.checkedBy || '________________')}</td>
                <td>${esc(rcfg.approvedBy || '________________')}</td>
                <td>${esc(project.meta.date)}</td>
                <td>${esc(project.meta.revision)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `);
    }

    return sections.join('\n');
  }

  /**
   * Build Configurable Plain-Text or Markdown Report matching the exact same checkboxes!
   */
  function buildTextOrMarkdownReport(project, evalRes, allScenarios, isMarkdown) {
    const rcfg = window.SGState.ensureReportConfig(project);
    const s = rcfg.sections;
    const bb = project.mainBusbar;
    const hr = evalRes.hbbRes;
    const t = evalRes.totals;
    const scenarios = getFilteredScenarios(evalRes, allScenarios, rcfg);
    const devRows = getFilteredDeviceRows(evalRes, rcfg);
    const catRows = getCategoryRows(t);
    const out = [];

    const h1 = (txt) => (isMarkdown ? `# ${txt}\n` : `${'='.repeat(72)}\n${txt.toUpperCase()}\n${'='.repeat(72)}`);
    const h2 = (txt) => (isMarkdown ? `\n## ${txt}\n` : `\n--- ${txt} ---`);
    let secNum = 0;
    const nextNum = () => {
      secNum += 1;
      return secNum;
    };

    if (s.titleBlock) {
      out.push(h1('Switchgear Heat Loss Calculation Report'));
      out.push(`Project:         ${project.meta.projectName}`);
      out.push(`Reference / Rev: ${project.meta.projectNumber} (${project.meta.revision}) · Date: ${project.meta.date}`);
      out.push(`Engineer:        ${project.meta.engineer}`);
      out.push(`System Basis:    IEC 60439 / 61439 · ${project.config.voltageV}V ${project.config.frequencyHz}Hz ${project.config.poles} · RDF ${(project.config.diversityFactorRDF * 100).toFixed(0)}%`);
      out.push(`Active Scenario: ${scenarioLabelOf(evalRes.scenario, allScenarios)}`);
    }

    if (s.execSummary) {
      out.push(h2(`${nextNum()}. Executive Heat Output Summary`));
      out.push(`Total Heat Output (${evalRes.scenario}): ${fmtPower(t.grandTotalW, rcfg)}${rcfg.includeBtuHvac ? ` | ${Math.round(t.btuPerHr).toLocaleString()} BTU/hr` : ''}`);
      if (rcfg.includeBtuHvac) {
        out.push(`Recommended HVAC Cooling (+${project.config.hvacSafetyMarginPct}% margin): ${t.recommendedCoolingKW.toFixed(rcfg.kwDecimals)} kW (${Math.round(t.recommendedCoolingKW * 3412.14).toLocaleString()} BTU/hr)`);
      }
      out.push('');
      if (isMarkdown) {
        out.push(`| Scenario | Total Loss | Busbars & Joints | Devices & Starters | Incomer (A) | Peak HBB (W/m) |${rcfg.includeBtuHvac ? ' HVAC Cooling |' : ''}`);
        out.push(`| --- | ---: | ---: | ---: | ---: | ---: |${rcfg.includeBtuHvac ? ' ---: |' : ''}`);
        scenarios.forEach((sc) => {
          const st = sc.result.totals;
          out.push(
            `| ${sc.label} | ${fmtPower(st.grandTotalW, rcfg)} | ${fmtPower(st.totalBusbarW, rcfg)} | ${fmtPower(st.totalDevicesW, rcfg)} | ${st.totalIncomerCurrentA.toFixed(0)} | ${st.maxHbbWPerM.toFixed(1)} |${rcfg.includeBtuHvac ? ` ${st.recommendedCoolingKW.toFixed(rcfg.kwDecimals)} kW |` : ''}`
          );
        });
      } else {
        scenarios.forEach((sc) => {
          const st = sc.result.totals;
          out.push(
            `  * ${sc.label.padEnd(28)} : ${fmtPower(st.grandTotalW, rcfg)}  [Busbars: ${st.totalBusbarW.toFixed(0)}W | Devices: ${st.totalDevicesW.toFixed(0)}W | Incomer: ${st.totalIncomerCurrentA.toFixed(0)}A | Peak HBB: ${st.maxHbbWPerM.toFixed(1)} W/m${rcfg.includeBtuHvac ? ` | HVAC: ${st.recommendedCoolingKW.toFixed(rcfg.kwDecimals)} kW` : ''}]`
          );
        });
      }
    }

    if (s.categoryBreakdown) {
      out.push(h2(`${nextNum()}. Heat Loss Breakdown by Category`));
      if (isMarkdown) {
        out.push('| Category | Heat Loss | Share |');
        out.push('| --- | ---: | ---: |');
        catRows.forEach((r) => out.push(`| ${r.name} | ${fmtPower(r.w, rcfg)} | ${r.pct.toFixed(1)}% |`));
        out.push(`| **Grand Total** | **${fmtPower(t.grandTotalW, rcfg)}** | **100.0%** |`);
      } else {
        catRows.forEach((r) => out.push(`  - ${r.name.padEnd(48)} : ${fmtPower(r.w, rcfg).padStart(18)} (${r.pct.toFixed(1)}%)`));
        out.push(`  = ${'GRAND TOTAL'.padEnd(48)} : ${fmtPower(t.grandTotalW, rcfg).padStart(18)} (100.0%)`);
      }
    }

    if (s.busbarBasis || s.workedBusbarSteps) {
      out.push(h2(`${nextNum()}. Main Horizontal Busbar Physics (Joule's Law)`));
      out.push(`Construction: ${bb.barsPerPhase} x ${bb.widthMm} x ${bb.thicknessMm} mm (${hr.areaMm2} mm2/phase) ${hr.material.name} · Rated ${bb.ratedCurrentA} A`);
      out.push(`Cert Ref:     ${bb.certRef}`);
      out.push(`Resistance:   R_DC(20C) = ${hr.rDc20_uOhmPerM.toFixed(2)} uOhm/m -> R_DC(${hr.tempC}C) = ${hr.rDcT_uOhmPerM.toFixed(2)} uOhm/m x k_AC(${hr.kAcUsed.toFixed(3)}, ${hr.acFactorMode}) = R_AC ${hr.rAcT_uOhmPerM.toFixed(2)} uOhm/m`);
      out.push(`Rated Loss:   ${evalRes.hbbRatedWPerM.toFixed(1)} W/m (3-phase @ ${bb.ratedCurrentA} A)`);
      if (s.workedBusbarSteps) {
        out.push('');
        out.push(`  Step 1 (Area):        A = ${bb.barsPerPhase} * ${bb.widthMm} * ${bb.thicknessMm} = ${hr.areaMm2} mm2`);
        out.push(`  Step 2 (R_DC 20C):    ${hr.material.rho20} / ${hr.areaMm2} = ${hr.rDc20_uOhmPerM.toFixed(3)} uOhm/m`);
        out.push(`  Step 3 (Temp ${hr.tempC}C):    ${hr.rDc20_uOhmPerM.toFixed(3)} * [1 + ${hr.material.alpha20}*(${hr.tempC}-20)] = ${hr.rDcT_uOhmPerM.toFixed(3)} uOhm/m`);
        out.push(`  Step 4 (AC Factor):   delta = ${hr.skinDepthMm.toFixed(2)} mm | calc k_AC = 1 + ${hr.ys.toFixed(3)} + ${hr.yp.toFixed(3)} + ${hr.ye.toFixed(3)} = ${hr.kAcCalculated.toFixed(3)} | used = ${hr.kAcUsed.toFixed(3)}`);
        out.push(`  Step 5 (R_AC):        ${hr.rDcT_uOhmPerM.toFixed(3)} * ${hr.kAcUsed.toFixed(3)} = ${hr.rAcT_uOhmPerM.toFixed(3)} uOhm/m`);
      }
    }

    if (s.columnSummary) {
      out.push(h2(`${nextNum()}. Column-by-Column Heat Summary`));
      evalRes.columns.forEach((cr) => {
        out.push(
          `  - ${cr.col.name.padEnd(26)} (${cr.widthMm}mm) : ${fmtPower(cr.colTotalLossW, rcfg)} [Devices ${cr.colDevicesW.toFixed(0)}W | VBB ${cr.vbbTotalLossW.toFixed(0)}W | Takeoffs/Cable ${(cr.colTakeoffW + cr.colCableW).toFixed(0)}W]`
        );
      });
    }

    if (s.hbbSchedule) {
      out.push(h2(`${nextNum()}. Horizontal Busbar (HBB) Segments`));
      evalRes.hbbSegments.forEach((seg) => {
        out.push(
          `  - ${seg.fromColName} -> ${seg.toColName}: L=${seg.lengthM.toFixed(2)}m | I=${seg.currentA.toFixed(1)}A (${seg.utilizationPct.toFixed(1)}%) | ${seg.wPerMTotal.toFixed(1)} W/m | Busbar ${seg.lossW.toFixed(1)}W + Joint ${seg.jointLossW.toFixed(1)}W = ${seg.totalSegW.toFixed(1)} W`
        );
      });
    }

    if (s.vbbSchedule) {
      out.push(h2(`${nextNum()}. Vertical Dropper Busbar (VBB) Segments`));
      evalRes.vbbSegments.forEach((seg) => {
        out.push(
          `  - ${seg.colName} (${seg.fromLabel} -> ${seg.toLabel}, EL +${seg.takeoffElevationMm}mm): L=${seg.lengthM.toFixed(2)}m | I=${seg.currentA.toFixed(1)}A | ${seg.wPerMTotal.toFixed(1)} W/m | ${seg.lossW.toFixed(1)} W`
        );
      });
    }

    if (s.deviceSchedule) {
      out.push(h2(`${nextNum()}. Protective Devices, Eaton HRC Fuses & Starters`));
      devRows.forEach((r) => {
        out.push(
          `  - [${r.colName.split(' ')[0]}] ${r.tag} (${r.category}, ${r.status}): In=${r.ratedCurrentA}A, Iop=${r.iOp.toFixed(1)}A -> Fixed ${r.fixedLossW.toFixed(1)}W + Var ${r.varLossW.toFixed(1)}W + Takeoff/Cable ${(r.takeoffLossW + r.cableLossW).toFixed(1)}W = ${r.totalRowW.toFixed(1)} W`
        );
        if (s.deviceSubComponents && r.breakdown && r.breakdown.length > 1) {
          r.breakdown.forEach((b) => {
            out.push(`      -> ${b.name}: ${b.opLossW.toFixed(1)} W (Pn=${b.ratedLossW}W, Fix=${b.fixedLossW}W)`);
          });
        }
      });
    }

    if (s.enclosureAdvisory) {
      out.push(h2(`${nextNum()}. IEC 60890 Enclosure Surface & Heat Flux Advisory`));
      out.push(`Overall Size: ${evalRes.totalWidthMm}W x ${evalRes.panelHeightMm}H x ${project.config.panelDepthMm}D mm (${project.config.installationType})`);
      out.push(`Effective Area Ae: ${t.effectiveAreaM2.toFixed(2)} m2 | Avg Heat Flux: ${t.heatFluxWPerM2.toFixed(1)} W/m2`);
    }

    if (s.methodologyAppendix) {
      out.push(h2(`${nextNum()}. Governing Equations`));
      out.push('  * R_DC(T) = (rho_20 / (n*w*t)) * [1 + alpha_20 * (T_op - 20)]');
      out.push('  * R_AC(T) = R_DC(T) * k_AC');
      out.push('  * P_busbar = 3 * I^2 * R_AC * L + 3 * I^2 * R_joint');
      out.push('  * P_device = P_fixed + P_n * (I_op / I_n)^2   [IEC TR 60890]');
    }

    if (s.signOffBlock) {
      out.push('');
      if (rcfg.customNotes) out.push(`Notes: ${rcfg.customNotes}`);
      out.push(`Prepared By: ${project.meta.engineer} | Checked By: ${rcfg.checkedBy || 'TBD'} | Approved By: ${rcfg.approvedBy || 'TBD'} | Date: ${project.meta.date}`);
    }

    return out.join('\n');
  }

  function exportStandaloneHTML(project, evalRes, allScenarios) {
    const rcfg = window.SGState.ensureReportConfig(project);
    const bodyHtml = buildPrintReportHTML(project, evalRes, allScenarios, 'exp-');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(project.meta.projectName)} — Heat Loss Report</title>
<style>
  @page { size: A4 ${rcfg.orientation}; margin: 10mm 12mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; background: #fff; margin: 20px; font-size: 11px; line-height: 1.45; }
  .print-header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; }
  .print-header h1 { margin: 0 0 4px 0; font-size: 18px; }
  .print-section { margin-bottom: 16px; }
  .print-section.print-page-break { page-break-before: always; break-before: page; }
  .print-section h2 { font-size: 13px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin: 0 0 8px 0; page-break-after: avoid; }
  .rep-kpi-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 8px; }
  .rep-kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 9px; background: #f8fafc; }
  .rk-lbl { font-size: 9px; text-transform: uppercase; color: #475569; font-weight: 700; }
  .rk-val { font-size: 13px; font-weight: 800; font-family: Consolas, monospace; color: #0f172a; margin-top: 2px; }
  .rk-sub { font-size: 9.5px; color: #475569; }
  .rep-p { margin: 0 0 6px 0; font-size: 10.5px; }
  .rep-worked-box { background: #f8fafc; border: 1px solid #cbd5e1; border-left: 3px solid #0284c7; padding: 8px 10px; font-family: Consolas, monospace; font-size: 10px; display: flex; flex-direction: column; gap: 3px; }
  .rep-list { margin: 0; padding-left: 18px; font-size: 10.5px; }
  .print-table { width: 100%; border-collapse: collapse; font-size: 9.8px; }
  .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
  .print-table th { background: #f1f5f9; }
  .print-table td.num, .print-table th.num { text-align: right; font-family: Consolas, monospace; }
  .print-svg-wrap svg { width: 100%; height: auto; border: 1px solid #94a3b8; border-radius: 4px; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
    const slug = (project.meta.projectNumber || 'switchgear').replace(/[^a-z0-9_-]/gi, '_');
    downloadBlob(html, `${slug}_report_${evalRes.scenario}.html`, 'text/html;charset=utf-8');
  }

  function exportTextFile(content, ext, mime, project, evalRes) {
    const slug = (project.meta.projectNumber || 'switchgear').replace(/[^a-z0-9_-]/gi, '_');
    downloadBlob(content, `${slug}_calc_${evalRes.scenario}.${ext}`, mime);
  }

  function exportCSV(project, evalRes, allScenarios) {
    const lines = [];
    const pushRow = (arr) => lines.push(arr.map(csvCell).join(','));

    pushRow(['SWITCHGEAR HEAT LOSS CALCULATION REPORT']);
    pushRow(['Project', project.meta.projectName, 'Project No', project.meta.projectNumber]);
    pushRow(['Active Scenario', evalRes.scenario, 'Date', project.meta.date]);
    pushRow(['System', `${project.config.voltageV}V ${project.config.frequencyHz}Hz ${project.config.poles}`, 'RDF', project.config.diversityFactorRDF]);
    pushRow([]);

    pushRow(['=== SCENARIO SUMMARY ===']);
    pushRow(['Scenario', 'Total Heat Loss (kW)', 'Total Heat Loss (W)', 'Busbars (W)', 'Devices & Starters (W)', 'Interconn Cable (W)', 'Auxiliaries (W)', 'Incomer Current (A)', 'Peak HBB (W/m)', 'HVAC Cooling w/ Margin (kW)']);
    allScenarios.forEach((sc) => {
      const t = sc.result.totals;
      pushRow([
        sc.label,
        t.grandTotalKW.toFixed(3),
        t.grandTotalW.toFixed(1),
        t.totalBusbarW.toFixed(1),
        t.totalDevicesW.toFixed(1),
        t.totalInterconnectorCableW.toFixed(1),
        t.totalAuxW.toFixed(1),
        t.totalIncomerCurrentA.toFixed(1),
        t.maxHbbWPerM.toFixed(1),
        t.recommendedCoolingKW.toFixed(3),
      ]);
    });
    pushRow([]);

    const bb = project.mainBusbar;
    const hr = evalRes.hbbRes;
    pushRow(['=== MAIN HORIZONTAL BUSBAR PARAMETERS ===']);
    pushRow(['Construction', `${bb.barsPerPhase} x ${bb.widthMm} x ${bb.thicknessMm} mm (${hr.areaMm2} mm2)`, 'Cert Ref', bb.certRef]);
    pushRow(['Material', hr.material.name, 'Operating Temp (C)', hr.tempC]);
    pushRow(['R_DC 20C (uOhm/m)', hr.rDc20_uOhmPerM.toFixed(3), 'R_DC OpTemp (uOhm/m)', hr.rDcT_uOhmPerM.toFixed(3)]);
    pushRow(['AC Factor Mode', hr.acFactorMode, 'k_AC Used', hr.kAcUsed.toFixed(4)]);
    pushRow(['R_AC OpTemp (uOhm/m)', hr.rAcT_uOhmPerM.toFixed(3), 'Rated W/m (3-ph)', evalRes.hbbRatedWPerM.toFixed(2)]);
    pushRow([]);

    pushRow(['=== HORIZONTAL BUSBAR SEGMENTS ===']);
    pushRow(['From Column', 'To Column', 'Length (m)', 'Current (A)', 'Direction', 'Utilization (%)', 'Loss/m 3-Ph (W/m)', 'Busbar Loss (W)', 'Joint Loss (W)', 'Total Segment (W)']);
    evalRes.hbbSegments.forEach((s) => {
      pushRow([s.fromColName, s.toColName, s.lengthM.toFixed(3), s.currentA.toFixed(1), s.direction, s.utilizationPct.toFixed(1), s.wPerMTotal.toFixed(2), s.lossW.toFixed(2), s.jointLossW.toFixed(2), s.totalSegW.toFixed(2)]);
    });
    pushRow([]);

    pushRow(['=== VERTICAL BUSBAR DROPPER SEGMENTS ===']);
    pushRow(['Column', 'From', 'To Take-off', 'Take-off EL (mm)', 'Length (m)', 'Current (A)', 'Utilization (%)', 'Loss/m 3-Ph (W/m)', 'Segment Loss (W)']);
    evalRes.vbbSegments.forEach((s) => {
      pushRow([s.colName, s.fromLabel, s.toLabel, s.takeoffElevationMm, s.lengthM.toFixed(3), s.currentA.toFixed(1), s.utilizationPct.toFixed(1), s.wPerMTotal.toFixed(2), s.lossW.toFixed(2)]);
    });
    pushRow([]);

    pushRow(['=== PROTECTIVE DEVICES, HRC FUSES & STARTERS SCHEDULE ===']);
    pushRow(['Column', 'Tag', 'Description', 'Category', 'Role', 'Status', 'Active', 'Rated In (A)', 'Op Current Iop (A)', '(Iop/In)^2', 'Rated Pn (W)', 'Fixed Loss (W)', 'Var Loss (W)', 'Device Total (W)', 'Takeoff/Joint (W)', 'Cable Loss (W)', 'Row Total (W)']);
    evalRes.deviceRows.forEach((r) => {
      pushRow([r.colName, r.tag, r.description, r.category, r.role, r.status, r.isActive ? 'YES' : 'NO', r.ratedCurrentA, r.iOp.toFixed(1), (r.loadRatio * r.loadRatio).toFixed(3), r.ratedLossW.toFixed(1), r.fixedLossW.toFixed(1), r.varLossW.toFixed(1), r.deviceLossW.toFixed(1), r.takeoffLossW.toFixed(1), r.cableLossW.toFixed(1), r.totalRowW.toFixed(1)]);
    });

    const slug = (project.meta.projectNumber || 'switchgear').replace(/[^a-z0-9_-]/gi, '_');
    downloadBlob(lines.join('\r\n'), `${slug}_heat_loss_${evalRes.scenario}.csv`, 'text/csv;charset=utf-8');
  }

  function exportJSON(project) {
    const slug = (project.meta.projectNumber || 'switchgear').replace(/[^a-z0-9_-]/gi, '_');
    downloadBlob(JSON.stringify(project, null, 2), `${slug}_project.json`, 'application/json');
  }

  function exportSVG(svgElementId, filename) {
    const el = document.getElementById(svgElementId);
    if (!el) return;
    const serializer = new XMLSerializer();
    const source = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(el);
    downloadBlob(source, filename, 'image/svg+xml;charset=utf-8');
  }

  return {
    exportCSV,
    exportJSON,
    exportSVG,
    exportStandaloneHTML,
    exportTextFile,
    buildPrintReportHTML,
    buildTextOrMarkdownReport,
  };
})();
