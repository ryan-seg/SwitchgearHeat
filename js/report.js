/**
 * Export & Engineering Report Generator (CSV, JSON, SVG, Print/PDF)
 */

window.SGReport = (function () {
  'use strict';

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

  function exportCSV(project, evalRes, allScenarios) {
    const lines = [];
    const pushRow = (arr) => lines.push(arr.map(csvCell).join(','));

    pushRow(['SWITCHGEAR HEAT LOSS CALCULATION REPORT']);
    pushRow(['Project', project.meta.projectName, 'Project No', project.meta.projectNumber]);
    pushRow(['Active Scenario', evalRes.scenario, 'Date', project.meta.date]);
    pushRow(['System', `${project.config.voltageV}V ${project.config.frequencyHz}Hz ${project.config.poles}`, 'RDF', project.config.diversityFactorRDF]);
    pushRow([]);

    // Scenario Summary
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

    // Main Busbar Physics
    const bb = project.mainBusbar;
    const hr = evalRes.hbbRes;
    pushRow(['=== MAIN HORIZONTAL BUSBAR PARAMETERS ===']);
    pushRow(['Construction', `${bb.barsPerPhase} x ${bb.widthMm} x ${bb.thicknessMm} mm (${hr.areaMm2} mm2)`, 'Cert Ref', bb.certRef]);
    pushRow(['Material', hr.material.name, 'Operating Temp (C)', hr.tempC]);
    pushRow(['R_DC 20C (uOhm/m)', hr.rDc20_uOhmPerM.toFixed(3), 'R_DC OpTemp (uOhm/m)', hr.rDcT_uOhmPerM.toFixed(3)]);
    pushRow(['AC Factor Mode', hr.acFactorMode, 'k_AC Used', hr.kAcUsed.toFixed(4)]);
    pushRow(['R_AC OpTemp (uOhm/m)', hr.rAcT_uOhmPerM.toFixed(3), 'Rated W/m (3-ph)', evalRes.hbbRatedWPerM.toFixed(2)]);
    pushRow([]);

    // Horizontal Segments
    pushRow(['=== HORIZONTAL BUSBAR SEGMENTS ===']);
    pushRow(['From Column', 'To Column', 'Length (m)', 'Current (A)', 'Direction', 'Utilization (%)', 'Loss/m 3-Ph (W/m)', 'Busbar Loss (W)', 'Joint Loss (W)', 'Total Segment (W)']);
    evalRes.hbbSegments.forEach((s) => {
      pushRow([
        s.fromColName,
        s.toColName,
        s.lengthM.toFixed(3),
        s.currentA.toFixed(1),
        s.direction,
        s.utilizationPct.toFixed(1),
        s.wPerMTotal.toFixed(2),
        s.lossW.toFixed(2),
        s.jointLossW.toFixed(2),
        s.totalSegW.toFixed(2),
      ]);
    });
    pushRow([]);

    // Vertical Segments
    pushRow(['=== VERTICAL BUSBAR DROPPER SEGMENTS ===']);
    pushRow(['Column', 'From', 'To Take-off', 'Take-off EL (mm)', 'Length (m)', 'Current (A)', 'Utilization (%)', 'Loss/m 3-Ph (W/m)', 'Segment Loss (W)']);
    evalRes.vbbSegments.forEach((s) => {
      pushRow([
        s.colName,
        s.fromLabel,
        s.toLabel,
        s.takeoffElevationMm,
        s.lengthM.toFixed(3),
        s.currentA.toFixed(1),
        s.utilizationPct.toFixed(1),
        s.wPerMTotal.toFixed(2),
        s.lossW.toFixed(2),
      ]);
    });
    pushRow([]);

    // Devices & Starters Schedule
    pushRow(['=== PROTECTIVE DEVICES & STARTERS SCHEDULE ===']);
    pushRow(['Column', 'Tag', 'Description', 'Category', 'Role', 'Status', 'Active', 'Rated In (A)', 'Op Current Iop (A)', '(Iop/In)^2', 'Rated Pn (W)', 'Fixed Loss (W)', 'Var Loss (W)', 'Device Total (W)', 'Takeoff/Joint (W)', 'Cable Loss (W)', 'Row Total (W)']);
    evalRes.deviceRows.forEach((r) => {
      pushRow([
        r.colName,
        r.tag,
        r.description,
        r.category,
        r.role,
        r.status,
        r.isActive ? 'YES' : 'NO',
        r.ratedCurrentA,
        r.iOp.toFixed(1),
        (r.loadRatio * r.loadRatio).toFixed(3),
        r.ratedLossW.toFixed(1),
        r.fixedLossW.toFixed(1),
        r.varLossW.toFixed(1),
        r.deviceLossW.toFixed(1),
        r.takeoffLossW.toFixed(1),
        r.cableLossW.toFixed(1),
        r.totalRowW.toFixed(1),
      ]);
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

  function buildPrintReportHTML(project, evalRes, allScenarios) {
    const bb = project.mainBusbar;
    const hr = evalRes.hbbRes;
    const t = evalRes.totals;
    const sldSvg = window.SGSLD.renderSLD(project, evalRes, null);
    const gaSvg = window.SGGA.renderGA(project, evalRes, null, { showHeatmap: true, showDimensions: true, showBusbars: true });

    return `
      <div class="print-header">
        <div>
          <h1>Switchgear Heat Loss Calculation Report</h1>
          <div><strong>${project.meta.projectName}</strong> · Ref: ${project.meta.projectNumber} · ${project.meta.revision}</div>
          <div>Basis: IEC 60439 / 61439 · ${project.config.voltageV}V ${project.config.frequencyHz}Hz ${project.config.poles} · RDF ${(project.config.diversityFactorRDF * 100).toFixed(0)}%</div>
        </div>
        <div style="text-align:right; font-size:11px;">
          <div>Date: ${project.meta.date}</div>
          <div>Engineer: ${project.meta.engineer}</div>
          <div>Active Scenario: <strong>${evalRes.scenario.toUpperCase()}</strong></div>
        </div>
      </div>

      <div class="print-section">
        <h2>1. Executive Summary — All Operating Scenarios</h2>
        <table class="print-table">
          <thead>
            <tr>
              <th>Operating Scenario</th>
              <th class="num">Total Loss (kW)</th>
              <th class="num">Total Loss (W)</th>
              <th class="num">Busbars (W)</th>
              <th class="num">Devices &amp; Starters (W)</th>
              <th class="num">Incomer Load (A)</th>
              <th class="num">Peak HBB (W/m)</th>
              <th class="num">HVAC Cooling (+${project.config.hvacSafetyMarginPct}%) (kW)</th>
            </tr>
          </thead>
          <tbody>
            ${allScenarios
              .map((sc) => {
                const st = sc.result.totals;
                const bold = sc.id === evalRes.scenario ? 'font-weight:700;background:#f8fafc;' : '';
                return `<tr style="${bold}">
                  <td>${sc.label} — <span style="color:#475569">${sc.subtitle}</span></td>
                  <td class="num">${st.grandTotalKW.toFixed(3)}</td>
                  <td class="num">${st.grandTotalW.toFixed(0)}</td>
                  <td class="num">${st.totalBusbarW.toFixed(0)}</td>
                  <td class="num">${st.totalDevicesW.toFixed(0)}</td>
                  <td class="num">${st.totalIncomerCurrentA.toFixed(0)}</td>
                  <td class="num">${st.maxHbbWPerM.toFixed(1)}</td>
                  <td class="num">${st.recommendedCoolingKW.toFixed(3)}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="print-section">
        <h2>2. Busbar Electrical &amp; Thermal Basis (Joule's Law)</h2>
        <p style="font-size:10.5px; margin:0 0 6px 0;">
          <strong>Main Horizontal Busbar:</strong> ${bb.barsPerPhase} × ${bb.widthMm} × ${bb.thicknessMm} mm (${hr.areaMm2} mm²/phase) ${hr.material.name} · Rating ${bb.ratedCurrentA} A · Cert: ${bb.certRef}.
          R<sub>DC,20°C</sub> = ${hr.rDc20_uOhmPerM.toFixed(2)} µΩ/m → R<sub>DC,${hr.tempC}°C</sub> = ${hr.rDcT_uOhmPerM.toFixed(2)} µΩ/m × k<sub>AC</sub> (${hr.kAcUsed.toFixed(3)}, ${hr.acFactorMode}) = <strong>R<sub>AC</sub> = ${hr.rAcT_uOhmPerM.toFixed(2)} µΩ/m</strong>.
          At rated ${bb.ratedCurrentA} A: <strong>${evalRes.hbbRatedWPerM.toFixed(1)} W/m</strong> (3-phase).
        </p>
        <p style="font-size:10.5px; margin:0;">
          <strong>Active Scenario (${evalRes.scenario}) Total:</strong> <strong>${t.grandTotalKW.toFixed(3)} kW</strong> (${t.grandTotalW.toFixed(0)} W · ${t.btuPerHr.toFixed(0)} BTU/hr).
          Enclosure Effective Surface A<sub>e</sub> ≈ ${t.effectiveAreaM2.toFixed(1)} m² → Avg Heat Flux ${t.heatFluxWPerM2.toFixed(0)} W/m².
        </p>
      </div>

      <div class="print-section">
        <h2>3. Single Line Diagram (SLD)</h2>
        <div class="print-svg-wrap">${sldSvg}</div>
      </div>

      <div class="print-section">
        <h2>4. General Arrangement (GA Elevation &amp; Take-Offs)</h2>
        <div class="print-svg-wrap">${gaSvg}</div>
      </div>

      <div class="print-section">
        <h2>5. Horizontal &amp; Vertical Busbar Segment Losses</h2>
        <table class="print-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Segment / Span</th>
              <th class="num">Length (m)</th>
              <th class="num">Current (A)</th>
              <th class="num">Util (%)</th>
              <th class="num">Loss/m (W/m)</th>
              <th class="num">Total Loss (W)</th>
            </tr>
          </thead>
          <tbody>
            ${evalRes.hbbSegments
              .map(
                (s) => `<tr>
                  <td>Horizontal</td>
                  <td>${s.fromColName} → ${s.toColName}</td>
                  <td class="num">${s.lengthM.toFixed(2)}</td>
                  <td class="num">${s.currentA.toFixed(1)}</td>
                  <td class="num">${s.utilizationPct.toFixed(1)}%</td>
                  <td class="num">${s.wPerMTotal.toFixed(1)}</td>
                  <td class="num">${s.totalSegW.toFixed(1)}</td>
                </tr>`
              )
              .join('')}
            ${evalRes.vbbSegments
              .map(
                (s) => `<tr>
                  <td>Vertical</td>
                  <td>${s.colName}: ${s.fromLabel} → ${s.toLabel} (EL+${s.takeoffElevationMm}mm)</td>
                  <td class="num">${s.lengthM.toFixed(2)}</td>
                  <td class="num">${s.currentA.toFixed(1)}</td>
                  <td class="num">${s.utilizationPct.toFixed(1)}%</td>
                  <td class="num">${s.wPerMTotal.toFixed(1)}</td>
                  <td class="num">${s.lossW.toFixed(1)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="print-section">
        <h2>6. Protective Devices &amp; Starters Heat Loss Schedule</h2>
        <table class="print-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Tag</th>
              <th>Description</th>
              <th>Category</th>
              <th>Status</th>
              <th class="num">In (A)</th>
              <th class="num">Iop (A)</th>
              <th class="num">Pn (W)</th>
              <th class="num">Fixed (W)</th>
              <th class="num">Device (W)</th>
              <th class="num">Takeoff/Cable (W)</th>
              <th class="num">Total (W)</th>
            </tr>
          </thead>
          <tbody>
            ${evalRes.deviceRows
              .map(
                (r) => `<tr>
                  <td>${r.colName}</td>
                  <td>${r.tag}</td>
                  <td>${r.description}</td>
                  <td>${r.category}</td>
                  <td>${r.status}</td>
                  <td class="num">${r.ratedCurrentA}</td>
                  <td class="num">${r.iOp.toFixed(1)}</td>
                  <td class="num">${r.ratedLossW.toFixed(0)}</td>
                  <td class="num">${r.fixedLossW.toFixed(0)}</td>
                  <td class="num">${r.deviceLossW.toFixed(1)}</td>
                  <td class="num">${(r.takeoffLossW + r.cableLossW).toFixed(1)}</td>
                  <td class="num">${r.totalRowW.toFixed(1)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return {
    exportCSV,
    exportJSON,
    exportSVG,
    buildPrintReportHTML,
  };
})();
