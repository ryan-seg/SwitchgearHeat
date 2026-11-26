/**
 * Auto-Generated True-to-Scale General Arrangement (GA) Elevation SVG Renderer
 * Shows exact panel widths, heights, HBB chamber, vertical dropper take-off coordinates,
 * and live thermal heatmap overlays (W/m on busbars & W on compartments).
 */

window.SGGA = (function () {
  'use strict';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function heatColor(utilPct, wPerM) {
    return window.SGSLD.heatColor(utilPct, wPerM);
  }

  function compartmentHeatFill(watts, active) {
    if (!active || watts <= 0) return 'rgba(30, 41, 59, 0.45)';
    if (watts > 600) return 'rgba(239, 68, 68, 0.28)';
    if (watts > 200) return 'rgba(249, 115, 22, 0.24)';
    if (watts > 80) return 'rgba(234, 179, 8, 0.18)';
    return 'rgba(56, 189, 248, 0.14)';
  }

  function renderGA(project, evalRes, selection, options) {
    const opts = Object.assign({ showHeatmap: true, showDimensions: true, showBusbars: true }, options || {});
    const totalWidthMm = Math.max(800, evalRes.totalWidthMm);
    const panelHeightMm = evalRes.panelHeightMm;

    // Scale: ~0.24 px per mm, clamped so drawing fits comfortably
    const scale = 0.24;
    const marginLeft = 105;
    const marginTop = 95;
    const marginRight = 135;
    const marginBottom = 75;

    const boardPxW = totalWidthMm * scale;
    const boardPxH = panelHeightMm * scale;
    const svgW = Math.max(880, marginLeft + boardPxW + marginRight);
    const svgH = marginTop + boardPxH + marginBottom;

    const xOf = (mm) => marginLeft + mm * scale;
    const yOf = (mm) => marginTop + mm * scale;

    const parts = [];
    parts.push(
      `<svg id="ga-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" class="diagram-svg">`
    );

    parts.push(`
      <defs>
        <pattern id="ga-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" stroke-width="0.5" />
        </pattern>
        <marker id="dim-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 2 8 L 8 2" stroke="#94a3b8" stroke-width="1.5" />
        </marker>
      </defs>
      <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#0b1120" />
      <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="url(#ga-grid)" />
    `);

    // Header
    parts.push(`
      <text x="20" y="26" fill="#e2e8f0" font-size="14.5" font-weight="700" font-family="Inter, system-ui, sans-serif">${esc(project.meta.projectName)} — GENERAL ARRANGEMENT (FRONT ELEVATION)</text>
      <text x="20" y="44" fill="#94a3b8" font-size="11" font-family="Inter, system-ui, sans-serif">Overall: ${totalWidthMm}W × ${panelHeightMm}H × ${project.config.panelDepthMm}D mm · HBB: ${project.config.hbbPosition.toUpperCase()} (${evalRes.hbbChamberMm}mm) · Effective Cooling Area Ae ≈ ${evalRes.totals.effectiveAreaM2.toFixed(1)} m²</text>
    `);

    // Floor datum line
    const floorY = yOf(panelHeightMm);
    parts.push(`
      <line x1="${marginLeft - 35}" y1="${floorY}" x2="${marginLeft + boardPxW + 35}" y2="${floorY}" stroke="#475569" stroke-width="2" />
      <text x="${marginLeft + boardPxW + 40}" y="${floorY + 4}" fill="#64748b" font-size="9.5" font-family="JetBrains Mono, monospace">FFL +0 mm</text>
    `);

    // Overall Outer Dimensions (CAD style)
    if (opts.showDimensions) {
      // Total width dimension at top
      const dimY = marginTop - 38;
      parts.push(`
        <line x1="${xOf(0)}" y1="${dimY}" x2="${xOf(totalWidthMm)}" y2="${dimY}" stroke="#94a3b8" stroke-width="1" marker-start="url(#dim-tick)" marker-end="url(#dim-tick)" />
        <line x1="${xOf(0)}" y1="${dimY - 5}" x2="${xOf(0)}" y2="${marginTop - 4}" stroke="#475569" stroke-width="0.8" />
        <line x1="${xOf(totalWidthMm)}" y1="${dimY - 5}" x2="${xOf(totalWidthMm)}" y2="${marginTop - 4}" stroke="#475569" stroke-width="0.8" />
        <rect x="${xOf(totalWidthMm / 2) - 44}" y="${dimY - 9}" width="88" height="16" rx="3" fill="#0b1120" />
        <text x="${xOf(totalWidthMm / 2)}" y="${dimY + 3}" text-anchor="middle" fill="#e2e8f0" font-size="10.5" font-weight="700" font-family="JetBrains Mono, monospace">${totalWidthMm} mm</text>
      `);

      // Overall height dimension on left
      const dimX = marginLeft - 42;
      parts.push(`
        <line x1="${dimX}" y1="${yOf(0)}" x2="${dimX}" y2="${yOf(panelHeightMm)}" stroke="#94a3b8" stroke-width="1" marker-start="url(#dim-tick)" marker-end="url(#dim-tick)" />
        <line x1="${dimX - 5}" y1="${yOf(0)}" x2="${marginLeft - 4}" y2="${yOf(0)}" stroke="#475569" stroke-width="0.8" />
        <line x1="${dimX - 5}" y1="${yOf(panelHeightMm)}" x2="${marginLeft - 4}" y2="${yOf(panelHeightMm)}" stroke="#475569" stroke-width="0.8" />
        <text x="${dimX - 8}" y="${yOf(panelHeightMm / 2)}" text-anchor="middle" fill="#e2e8f0" font-size="10.5" font-weight="700" font-family="JetBrains Mono, monospace" transform="rotate(-90 ${dimX - 8} ${yOf(panelHeightMm / 2)})">${panelHeightMm} mm</text>
      `);
    }

    // Draw Columns & Compartments
    evalRes.columns.forEach((cr, colIdx) => {
      const cx0 = xOf(cr.xStartMm);
      const colW = cr.widthMm * scale;
      const isColSel = selection && selection.type === 'column' && selection.colIndex === colIdx;

      // Per-column width dimension
      if (opts.showDimensions) {
        const subDimY = marginTop - 16;
        parts.push(`
          <line x1="${cx0}" y1="${subDimY}" x2="${cx0 + colW}" y2="${subDimY}" stroke="#64748b" stroke-width="0.9" />
          <text x="${cx0 + colW / 2}" y="${subDimY - 3}" text-anchor="middle" fill="#94a3b8" font-size="9.5" font-family="JetBrains Mono, monospace">${cr.widthMm}</text>
        `);
      }

      // Column outer frame
      parts.push(`
        <rect x="${cx0}" y="${yOf(0)}" width="${colW}" height="${boardPxH}"
          fill="#0f172a" stroke="${isColSel ? '#38bdf8' : '#475569'}" stroke-width="${isColSel ? 2.2 : 1.4}"
          class="clickable" data-select-type="column" data-col-index="${colIdx}" />
      `);

      // Base Plinth (100mm)
      const plinthH = 100 * scale;
      parts.push(`
        <rect x="${cx0 + 1}" y="${floorY - plinthH}" width="${colW - 2}" height="${plinthH}" fill="#1e293b" stroke="#334155" stroke-width="0.8" />
      `);

      // Horizontal Busbar Chamber outline
      const hbbTopMm = evalRes.hbbPosition === 'top' ? 0 : panelHeightMm - evalRes.hbbChamberMm;
      parts.push(`
        <rect x="${cx0 + 1}" y="${yOf(hbbTopMm)}" width="${colW - 2}" height="${evalRes.hbbChamberMm * scale}"
          fill="rgba(30, 41, 59, 0.72)" stroke="#334155" stroke-width="1"
          class="clickable" data-select-type="mainBusbar" />
      `);

      // Draw each tier compartment inside this column
      cr.tiers.forEach((tr, tierIdx) => {
        const ty = yOf(tr.yTopMm);
        const th = tr.heightMm * scale;
        const isSel = selection && selection.type === 'tier' && selection.colIndex === colIdx && selection.tierIndex === tierIdx;
        const isFuture = tr.tier.status === 'future';
        const isInterconn = tr.tier.role === 'interconnector';
        const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;
        const totalW = devW + (tr.takeoffLossW || 0) + (tr.cableLoss ? tr.cableLoss.totalW : 0);

        const fill = opts.showHeatmap ? compartmentHeatFill(totalW, tr.isActive) : 'rgba(15, 23, 42, 0.85)';
        const stroke = isSel
          ? '#38bdf8'
          : isInterconn && tr.isActive
          ? '#f97316'
          : isFuture
          ? '#64748b'
          : '#334155';

        const doorPad = 5;
        const doorW = colW - doorPad * 2 - (opts.showBusbars && cr.vbbSegments.length > 0 ? 18 : 0);
        const doorX = cx0 + doorPad + (opts.showBusbars && cr.vbbSegments.length > 0 ? 18 : 0);

        parts.push(`
          <g class="clickable" data-select-type="tier" data-col-index="${colIdx}" data-tier-index="${tierIdx}">
            <rect x="${doorX}" y="${ty + 2}" width="${Math.max(40, doorW)}" height="${Math.max(24, th - 4)}" rx="3"
              fill="${fill}" stroke="${stroke}" stroke-width="${isSel ? 2.2 : 1.1}"
              stroke-dasharray="${isFuture ? '5 3' : 'none'}" />
            <!-- Compartment Door Handle -->
            <rect x="${doorX + Math.max(40, doorW) - 8}" y="${ty + th / 2 - 7}" width="3.5" height="14" rx="1" fill="#64748b" />
        `);

        // Labels scaled to fit tier height
        if (th >= 44) {
          parts.push(`
            <text x="${doorX + 7}" y="${ty + 17}" fill="${tr.isActive ? '#f8fafc' : '#94a3b8'}" font-size="10.5" font-weight="700" font-family="Inter, sans-serif">${esc(tr.tier.tag)}</text>
            <text x="${doorX + Math.max(40, doorW) - 14}" y="${ty + 17}" text-anchor="end" fill="${tr.isActive ? '#fbbf24' : '#64748b'}" font-size="10" font-weight="700" font-family="JetBrains Mono, monospace">${totalW.toFixed(0)} W</text>
            <text x="${doorX + 7}" y="${ty + 31}" fill="#94a3b8" font-size="8.8" font-family="Inter, sans-serif">${esc(truncate(tr.tier.category + ' ' + tr.tier.ratedCurrentA + 'A', 20))}</text>
            <text x="${doorX + 7}" y="${ty + 43}" fill="${tr.isActive ? '#38bdf8' : '#64748b'}" font-size="9.2" font-weight="600" font-family="JetBrains Mono, monospace">${tr.isActive ? tr.iOp.toFixed(0) + ' A' : isFuture ? 'FUTURE' : 'OFF'}</text>
          `);
        } else {
          parts.push(`
            <text x="${doorX + 6}" y="${ty + th / 2 + 3.5}" fill="#f8fafc" font-size="9.5" font-weight="600">${esc(tr.tier.tag)} · ${totalW.toFixed(0)}W</text>
          `);
        }

        // Take-off elevation marker on right of door if dimensions enabled
        if (opts.showDimensions && th >= 42) {
          const elMm = Math.round(panelHeightMm - tr.yCenterMm);
          parts.push(`
            <text x="${doorX + Math.max(40, doorW) - 14}" y="${ty + Math.min(th - 8, 43)}" text-anchor="end" fill="#64748b" font-size="8" font-family="JetBrains Mono, monospace">EL+${elMm}</text>
          `);
        }

        parts.push('</g>');
      });

      // Column Footer Label & Total Column Heat
      parts.push(`
        <g class="clickable" data-select-type="column" data-col-index="${colIdx}">
          <text x="${cx0 + colW / 2}" y="${floorY + 18}" text-anchor="middle" fill="#e2e8f0" font-size="10.5" font-weight="700" font-family="Inter, sans-serif">${esc(cr.col.name)}</text>
          <text x="${cx0 + colW / 2}" y="${floorY + 32}" text-anchor="middle" fill="#fbbf24" font-size="9.5" font-weight="600" font-family="JetBrains Mono, monospace">Col: ${cr.colTotalLossW.toFixed(0)} W (VBB: ${cr.vbbTotalLossW.toFixed(0)} W)</text>
          <text x="${cx0 + colW / 2}" y="${floorY + 45}" text-anchor="middle" fill="#64748b" font-size="8.8" font-family="JetBrains Mono, monospace">${cr.hasIncomer ? 'Incomer: ' + Math.round(cr.incomerSupplyA) + 'A' : cr.hasCoupler ? 'Bus Coupler' : 'Load: ' + Math.round(cr.colTotalLoadA) + 'A'}</text>
        </g>
      `);
    });

    // Overlay Horizontal & Vertical Busbar Paths with Thermal Heatmap Colours & Take-off Nodes
    if (opts.showBusbars) {
      const hbbY = yOf(evalRes.hbbCenterYMm);

      // 1. Vertical busbar dropper segments drawn FIRST (under HBB pills for clean CAD layering)
      evalRes.columns.forEach((cr, colIdx) => {
        if (cr.vbbSegments.length === 0) return;
        const spineX = xOf(cr.xStartMm) + 12;

        cr.vbbSegments.forEach((vSeg, sIdx) => {
          const y1 = sIdx === 0 ? hbbY - 12 : yOf(vSeg.y1Mm);
          const y2 = yOf(vSeg.y2Mm);
          const color = opts.showHeatmap ? heatColor(vSeg.utilizationPct, vSeg.wPerMTotal) : '#d97706';

          parts.push(`
            <g class="clickable" data-select-type="column" data-col-index="${colIdx}">
              <line x1="${spineX - 3}" y1="${y1}" x2="${spineX - 3}" y2="${y2}" stroke="${color}" stroke-width="2" />
              <line x1="${spineX}" y1="${y1}" x2="${spineX}" y2="${y2}" stroke="${color}" stroke-width="2" />
              <line x1="${spineX + 3}" y1="${y1}" x2="${spineX + 3}" y2="${y2}" stroke="${color}" stroke-width="2" />
              <!-- Take-off tap point -->
              <circle cx="${spineX}" cy="${y2}" r="4" fill="#0f172a" stroke="${color}" stroke-width="2" />
              <line x1="${spineX + 4}" y1="${y2}" x2="${spineX + 12}" y2="${y2}" stroke="${color}" stroke-width="1.5" />
            </g>
          `);
        });
      });

      // 2. Horizontal busbar segments & callout badges ON TOP
      evalRes.hbbSegments.forEach((seg) => {
        const x1 = xOf(seg.x1Mm);
        const x2 = xOf(seg.x2Mm);
        const midX = (x1 + x2) / 2;
        const color = opts.showHeatmap ? heatColor(seg.utilizationPct, seg.wPerMTotal) : '#d97706';

        parts.push(`
          <g class="clickable" data-select-type="mainBusbar">
            <!-- 3-phase copper bar stripes -->
            <line x1="${x1}" y1="${hbbY - 18}" x2="${x2}" y2="${hbbY - 18}" stroke="${color}" stroke-width="2.8" />
            <line x1="${x1}" y1="${hbbY - 12}" x2="${x2}" y2="${hbbY - 12}" stroke="${color}" stroke-width="2.8" />
            <line x1="${x1}" y1="${hbbY - 6}" x2="${x2}" y2="${hbbY - 6}" stroke="${color}" stroke-width="2.8" />
            <rect x="${midX - 42}" y="${hbbY + 2}" width="84" height="24" rx="4" fill="#0f172a" stroke="${color}" stroke-width="1" />
            <text x="${midX}" y="${hbbY + 13}" text-anchor="middle" fill="#f8fafc" font-size="8.4" font-weight="700" font-family="JetBrains Mono, monospace">${Math.round(seg.currentA)}A · ${seg.lengthM.toFixed(2)}m</text>
            <text x="${midX}" y="${hbbY + 23}" text-anchor="middle" fill="${color}" font-size="8.0" font-weight="600" font-family="JetBrains Mono, monospace">${seg.wPerMTotal.toFixed(0)} W/m</text>
          </g>
        `);
      });

      // Right-hand Thermal Legend
      const legX = marginLeft + boardPxW + 20;
      const legY = marginTop + 10;
      parts.push(`
        <g>
          <rect x="${legX}" y="${legY}" width="102" height="136" rx="6" fill="#0f172a" stroke="#334155" />
          <text x="${legX + 8}" y="${legY + 18}" fill="#e2e8f0" font-size="9.5" font-weight="700">BUSBAR W/m</text>
          <rect x="${legX + 8}" y="${legY + 28}" width="12" height="10" rx="2" fill="#ef4444" /><text x="${legX + 26}" y="${legY + 37}" fill="#cbd5e1" font-size="8.8">&gt;320 W/m / &gt;100%</text>
          <rect x="${legX + 8}" y="${legY + 46}" width="12" height="10" rx="2" fill="#f97316" /><text x="${legX + 26}" y="${legY + 55}" fill="#cbd5e1" font-size="8.8">180–320 W/m</text>
          <rect x="${legX + 8}" y="${legY + 64}" width="12" height="10" rx="2" fill="#eab308" /><text x="${legX + 26}" y="${legY + 73}" fill="#cbd5e1" font-size="8.8">90–180 W/m</text>
          <rect x="${legX + 8}" y="${legY + 82}" width="12" height="10" rx="2" fill="#22c55e" /><text x="${legX + 26}" y="${legY + 91}" fill="#cbd5e1" font-size="8.8">25–90 W/m</text>
          <rect x="${legX + 8}" y="${legY + 100}" width="12" height="10" rx="2" fill="#38bdf8" /><text x="${legX + 26}" y="${legY + 109}" fill="#cbd5e1" font-size="8.8">&lt;25 W/m</text>
          <rect x="${legX + 8}" y="${legY + 118}" width="12" height="10" rx="2" fill="#64748b" /><text x="${legX + 26}" y="${legY + 127}" fill="#cbd5e1" font-size="8.8">0 A / Idle</text>
        </g>
      `);
    }

    parts.push('</svg>');
    return parts.join('\n');
  }

  function truncate(s, max) {
    if (!s) return '';
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  return { renderGA };
})();
