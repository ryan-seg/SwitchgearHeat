/**
 * Auto-Generated True-to-Scale General Arrangement (GA) Elevation SVG Renderer
 * Supports vector zoom, drag-and-drop moving of compartments & columns,
 * hatched spare/placeholder bays, and one-click removal.
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

  function renderGA(project, evalRes, selection, options, zoom, themeOverride, idPrefix) {
    const P = window.SGSLD.getPalette(themeOverride);
    const px = idPrefix || '';
    const isPrint = Boolean(px);
    const isLight = (themeOverride || (document.documentElement && document.documentElement.dataset.theme)) === 'light';
    const z = zoom || 1.0;
    const opts = Object.assign({ showHeatmap: true, showDimensions: true, showBusbars: true }, options || {});
    const totalWidthMm = Math.max(800, evalRes.totalWidthMm);
    const panelHeightMm = evalRes.panelHeightMm;

    const scale = 0.24;
    const marginLeft = 105;
    const marginTop = 104;
    const marginRight = 135;
    const marginBottom = 88;

    const boardPxW = totalWidthMm * scale;
    const boardPxH = panelHeightMm * scale;
    const svgW = Math.max(880, marginLeft + boardPxW + marginRight);
    const svgH = marginTop + boardPxH + marginBottom;

    const xOf = (mm) => marginLeft + mm * scale;
    const yOf = (mm) => marginTop + mm * scale;

    const sizeAttrs = isPrint
      ? `width="100%" preserveAspectRatio="xMidYMid meet"`
      : `width="${Math.round(svgW * z)}" height="${Math.round(svgH * z)}" data-base-width="${svgW}" data-base-height="${svgH}"`;

    const parts = [];
    parts.push(
      `<svg id="${px}ga-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" ${sizeAttrs} class="diagram-svg">`
    );

    parts.push(`
      <defs>
        <pattern id="${px}ga-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="${P.grid}" stroke-width="0.5" />
        </pattern>
        <pattern id="${px}ga-hatch-spare" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="${P.hatch}" stroke-width="2" />
        </pattern>
        <marker id="${px}dim-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 2 8 L 8 2" stroke="${P.sub}" stroke-width="1.5" />
        </marker>
      </defs>
      <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="${P.bg}" class="pan-bg" />
      <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="url(#${px}ga-grid)" class="pan-bg" />
    `);

    parts.push(`
      <text x="20" y="26" fill="${P.title}" font-size="14.5" font-weight="700" font-family="Inter, system-ui, sans-serif">${esc(project.meta.projectName)} — GENERAL ARRANGEMENT (FRONT ELEVATION)</text>
      <text x="20" y="44" fill="${P.sub}" font-size="11" font-family="Inter, system-ui, sans-serif">Overall: ${totalWidthMm}W × ${panelHeightMm}H × ${project.config.panelDepthMm}D mm · HBB: ${project.config.hbbPosition.toUpperCase()} (${evalRes.hbbChamberMm}mm) · Drag compartments or column footers to rearrange</text>
    `);

    const floorY = yOf(panelHeightMm);
    parts.push(`
      <line x1="${marginLeft - 35}" y1="${floorY}" x2="${marginLeft + boardPxW + 35}" y2="${floorY}" stroke="#475569" stroke-width="2" />
      <text x="${marginLeft + boardPxW + 40}" y="${floorY + 4}" fill="#64748b" font-size="9.5" font-family="JetBrains Mono, monospace">FFL +0 mm</text>
    `);

    if (opts.showDimensions) {
      const dimY = marginTop - 42;
      parts.push(`
        <line x1="${xOf(0)}" y1="${dimY}" x2="${xOf(totalWidthMm)}" y2="${dimY}" stroke="#94a3b8" stroke-width="1" marker-start="url(#${px}dim-tick)" marker-end="url(#${px}dim-tick)" />
        <line x1="${xOf(0)}" y1="${dimY - 5}" x2="${xOf(0)}" y2="${marginTop - 4}" stroke="#475569" stroke-width="0.8" />
        <line x1="${xOf(totalWidthMm)}" y1="${dimY - 5}" x2="${xOf(totalWidthMm)}" y2="${marginTop - 4}" stroke="#475569" stroke-width="0.8" />
        <rect x="${xOf(totalWidthMm / 2) - 44}" y="${dimY - 9}" width="88" height="16" rx="3" fill="${P.bg}" />
        <text x="${xOf(totalWidthMm / 2)}" y="${dimY + 3}" text-anchor="middle" fill="${P.title}" font-size="10.5" font-weight="700" font-family="JetBrains Mono, monospace">${totalWidthMm} mm</text>
      `);

      const dimX = marginLeft - 42;
      parts.push(`
        <line x1="${dimX}" y1="${yOf(0)}" x2="${dimX}" y2="${yOf(panelHeightMm)}" stroke="#94a3b8" stroke-width="1" marker-start="url(#${px}dim-tick)" marker-end="url(#${px}dim-tick)" />
        <line x1="${dimX - 5}" y1="${yOf(0)}" x2="${marginLeft - 4}" y2="${yOf(0)}" stroke="#475569" stroke-width="0.8" />
        <line x1="${dimX - 5}" y1="${yOf(panelHeightMm)}" x2="${marginLeft - 4}" y2="${yOf(panelHeightMm)}" stroke="#475569" stroke-width="0.8" />
        <text x="${dimX - 8}" y="${yOf(panelHeightMm / 2)}" text-anchor="middle" fill="${P.title}" font-size="10.5" font-weight="700" font-family="JetBrains Mono, monospace" transform="rotate(-90 ${dimX - 8} ${yOf(panelHeightMm / 2)})">${panelHeightMm} mm</text>
      `);
    }

    // Draw Columns & Compartments
    evalRes.columns.forEach((cr, colIdx) => {
      const cx0 = xOf(cr.xStartMm);
      const colW = cr.widthMm * scale;
      const isColSel = selection && selection.type === 'column' && selection.colIndex === colIdx;

      parts.push(`<g class="drop-col-zone" data-drop-col="${colIdx}">`);

      // Column Top Drag Grip Bar (click-hold-drag to reorder column)
      if (!isPrint) {
        parts.push(`
          <g class="clickable draggable-item" data-select-type="column" data-col-index="${colIdx}" data-drag-col="${colIdx}" title="Click and hold to drag column left/right">
            <rect x="${cx0 + 2}" y="${yOf(0) - 20}" width="${colW - 4}" height="17" rx="3" fill="${isColSel ? P.headerBgSel : P.headerBg}" stroke="${isColSel ? P.accent : P.cardBorder}" stroke-width="0.9" />
            <text x="${cx0 + colW / 2}" y="${yOf(0) - 8}" text-anchor="middle" fill="${P.headerText}" font-size="8.6" font-weight="700" font-family="Inter, sans-serif">⋮⋮ ${esc(truncate(cr.col.name, 14))} (${cr.widthMm})</text>
          </g>
        `);
      } else if (opts.showDimensions) {
        const subDimY = marginTop - 16;
        parts.push(`
          <line x1="${cx0}" y1="${subDimY}" x2="${cx0 + colW}" y2="${subDimY}" stroke="#64748b" stroke-width="0.9" />
          <text x="${cx0 + colW / 2}" y="${subDimY - 3}" text-anchor="middle" fill="#475569" font-size="9.5" font-family="JetBrains Mono, monospace">${cr.widthMm}</text>
        `);
      }

      // Column outer frame (also draggable to reorder column)
      parts.push(`
        <rect x="${cx0}" y="${yOf(0)}" width="${colW}" height="${boardPxH}"
          fill="${P.cardBg}" stroke="${isColSel ? P.accent : P.cardBorder}" stroke-width="${isColSel ? 2.2 : 1.4}"
          class="clickable col-bg-rect draggable-item" data-select-type="column" data-col-index="${colIdx}" data-drag-col="${colIdx}" />
      `);

      // Base Plinth
      const plinthH = 100 * scale;
      parts.push(`<rect x="${cx0 + 1}" y="${floorY - plinthH}" width="${colW - 2}" height="${plinthH}" fill="${P.headerBg}" stroke="${P.cardBorder}" stroke-width="0.8" />`);

      // Horizontal Busbar Chamber
      const hbbTopMm = evalRes.hbbPosition === 'top' ? 0 : panelHeightMm - evalRes.hbbChamberMm;
      parts.push(`
        <rect x="${cx0 + 1}" y="${yOf(hbbTopMm)}" width="${colW - 2}" height="${evalRes.hbbChamberMm * scale}"
          fill="${isLight ? 'rgba(226, 232, 240, 0.7)' : 'rgba(30, 41, 59, 0.72)'}" stroke="${P.cardBorder}" stroke-width="1"
          class="clickable" data-select-type="mainBusbar" />
      `);

      // Tiers inside Column
      cr.tiers.forEach((tr, tierIdx) => {
        const ty = yOf(tr.yTopMm);
        const th = tr.heightMm * scale;
        const isSel = selection && selection.type === 'tier' && selection.colIndex === colIdx && selection.tierIndex === tierIdx;
        const isSpacer = tr.tier.role === 'spacer';
        const isFuture = tr.tier.status === 'future';
        const isInterconn = tr.tier.role === 'interconnector';
        const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;
        const totalW = devW + (tr.takeoffLossW || 0) + (tr.cableLoss ? tr.cableLoss.totalW : 0);

        const doorPad = 5;
        const hasVbbSpine = opts.showBusbars && cr.vbbSegments.length > 0;
        const vbbReserve = hasVbbSpine ? 24 : 0;
        const doorW = Math.max(40, colW - doorPad * 2 - vbbReserve);
        const doorX = cx0 + doorPad + vbbReserve;
        const doorH = Math.max(24, th - 4);

        const fill = isSpacer
          ? `url(#${px}ga-hatch-spare)`
          : opts.showHeatmap
          ? compartmentHeatFill(totalW, tr.isActive)
          : P.pillBg;
        const stroke = isSel
          ? P.accent
          : isSpacer
          ? P.cardBorder
          : isInterconn && tr.isActive
          ? '#f97316'
          : isFuture
          ? '#64748b'
          : P.cardBorder;

        parts.push(`
          <g class="clickable draggable-item" data-select-type="tier" data-col-index="${colIdx}" data-tier-index="${tierIdx}" data-drag-tier="${colIdx}:${tierIdx}" data-drop-tier="${colIdx}:${tierIdx}">
            <rect x="${doorX}" y="${ty + 2}" width="${doorW}" height="${doorH}" rx="3"
              fill="${fill}" stroke="${stroke}" stroke-width="${isSel ? 2.2 : 1.1}"
              stroke-dasharray="${isFuture || isSpacer ? '5 3' : 'none'}" />
            ${
              isSpacer
                ? `<rect x="${doorX + 5}" y="${ty + 7}" width="${Math.max(30, doorW - 26)}" height="${Math.min(34, doorH - 10)}" rx="3" fill="${P.spacerLabelBg}" />
                   <text x="${doorX + 9}" y="${ty + 20}" fill="${P.textMain}" font-size="9.5" font-weight="700" font-family="Inter, sans-serif">${esc(tr.tier.tag)} (${tr.tier.heightMm}mm)</text>
                   ${doorH >= 38 ? `<text x="${doorX + 9}" y="${ty + 33}" fill="${P.textMuted}" font-size="8.2" font-family="Inter, sans-serif">${esc(tr.tier.category)}${totalW > 0 ? ' · ' + totalW.toFixed(0) + 'W' : ' · 0W'}</text>` : ''}`
                : `<!-- Compartment Door Handle -->
                   <rect x="${doorX + doorW - 7}" y="${ty + th / 2 - 7}" width="3" height="14" rx="1" fill="#64748b" />
                   ${
                     th >= 44
                       ? `<text x="${doorX + 6}" y="${ty + 16}" fill="${tr.isActive ? P.textMain : P.textMuted}" font-size="10" font-weight="700" font-family="Inter, sans-serif">${esc(truncate(tr.tier.tag, 12))}</text>
                          <text x="${doorX + doorW - 22}" y="${ty + 16}" text-anchor="end" fill="${tr.isActive ? P.warmText : P.textDim}" font-size="9.5" font-weight="700" font-family="JetBrains Mono, monospace">${totalW.toFixed(0)}W</text>
                          <text x="${doorX + 6}" y="${ty + 29}" fill="${P.textMuted}" font-size="8.5" font-family="Inter, sans-serif">${esc(truncate(tr.tier.category + ' ' + tr.tier.ratedCurrentA + 'A', 19))}</text>
                          <text x="${doorX + 6}" y="${ty + 41}" fill="${tr.isActive ? P.accent : P.textDim}" font-size="9" font-weight="600" font-family="JetBrains Mono, monospace">${tr.isActive ? tr.iOp.toFixed(0) + ' A' : isFuture ? 'FUTURE' : 'OFF'}</text>
                          ${opts.showDimensions ? `<text x="${doorX + doorW - 14}" y="${ty + Math.min(th - 8, 41)}" text-anchor="end" fill="${P.textDim}" font-size="7.8" font-family="JetBrains Mono, monospace">EL+${Math.round(panelHeightMm - tr.yCenterMm)}</text>` : ''}`
                       : `<text x="${doorX + 6}" y="${ty + th / 2 + 3.5}" fill="${P.textMain}" font-size="9" font-weight="600">${esc(tr.tier.tag)} · ${totalW.toFixed(0)}W</text>`
                   }`
            }
            <g class="quick-del-btn clickable" data-quick-del-tier="${colIdx}:${tierIdx}" title="Remove compartment">
              <rect x="${doorX + doorW - 17}" y="${ty + 4}" width="13" height="14" rx="2" fill="rgba(239,68,68,0.22)" stroke="rgba(239,68,68,0.5)" />
              <text x="${doorX + doorW - 10.5}" y="${ty + 14.5}" text-anchor="middle" fill="#ef4444" font-size="10.5" font-weight="700">×</text>
            </g>
          </g>
        `);
      });

      // Column Footer (Draggable to Reorder Column + Quick-Add Spare)
      parts.push(`
        <g class="clickable draggable-item" data-select-type="column" data-col-index="${colIdx}" data-drag-col="${colIdx}">
          <text x="${cx0 + colW / 2}" y="${floorY + 18}" text-anchor="middle" fill="${P.title}" font-size="10.2" font-weight="700" font-family="Inter, sans-serif">⋮⋮ ${esc(truncate(cr.col.name, 18))}</text>
          <text x="${cx0 + colW / 2}" y="${floorY + 32}" text-anchor="middle" fill="${P.warmText}" font-size="9.3" font-weight="600" font-family="JetBrains Mono, monospace">Col: ${cr.colTotalLossW.toFixed(0)}W (VBB ${cr.vbbTotalLossW.toFixed(0)}W)</text>
          <text x="${cx0 + colW / 2}" y="${floorY + 45}" text-anchor="middle" fill="${P.textDim}" font-size="8.6" font-family="JetBrains Mono, monospace">${cr.hasIncomer && cr.colInterconnectorA > 0 ? 'Inc: ' + Math.round(cr.incomerSupplyA) + 'A · IC: ' + Math.round(cr.colInterconnectorA) + 'A' : cr.hasIncomer ? 'Incomer: ' + Math.round(cr.incomerSupplyA) + 'A' : cr.hasCoupler ? 'Bus Coupler' : 'Load: ' + Math.round(cr.colTotalLoadA) + 'A'}</text>
        </g>
      `);

      parts.push('</g>');
    });

    // Busbars Overlay (Vertical FIRST, Horizontal ON TOP)
    if (opts.showBusbars) {
      const hbbY = yOf(evalRes.hbbCenterYMm);

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
              <circle cx="${spineX}" cy="${y2}" r="4" fill="#0f172a" stroke="${color}" stroke-width="2" />
              <line x1="${spineX + 4}" y1="${y2}" x2="${spineX + 12}" y2="${y2}" stroke="${color}" stroke-width="1.5" />
            </g>
          `);
        });
      });

      evalRes.hbbSegments.forEach((seg) => {
        const x1 = xOf(seg.x1Mm);
        const x2 = xOf(seg.x2Mm);
        const nextCol = evalRes.columns[seg.toColIndex];
        const boundaryX = nextCol ? xOf(nextCol.xStartMm) : (x1 + x2) / 2;
        // Position pill cleanly to the left of the next column's vertical dropper spine (boundaryX + 12)
        const pillW = 80;
        const pillX = boundaryX - pillW + 2;
        const pillCenterX = pillX + pillW / 2;
        const color = opts.showHeatmap ? heatColor(seg.utilizationPct, seg.wPerMTotal) : '#d97706';

        parts.push(`
          <g class="clickable" data-select-type="mainBusbar">
            <line x1="${x1}" y1="${hbbY - 18}" x2="${x2}" y2="${hbbY - 18}" stroke="${color}" stroke-width="2.8" />
            <line x1="${x1}" y1="${hbbY - 12}" x2="${x2}" y2="${hbbY - 12}" stroke="${color}" stroke-width="2.8" />
            <line x1="${x1}" y1="${hbbY - 6}" x2="${x2}" y2="${hbbY - 6}" stroke="${color}" stroke-width="2.8" />
            <rect x="${pillX}" y="${hbbY + 2}" width="${pillW}" height="24" rx="4" fill="${P.pillBg}" stroke="${color}" stroke-width="1" />
            <text x="${pillCenterX}" y="${hbbY + 13}" text-anchor="middle" fill="${P.pillText}" font-size="8.2" font-weight="700" font-family="JetBrains Mono, monospace">${seg.currentA > 1 ? (seg.direction === 'right' ? '→ ' : '← ') : ''}${Math.round(seg.currentA)}A · ${seg.lengthM.toFixed(2)}m</text>
            <text x="${pillCenterX}" y="${hbbY + 23}" text-anchor="middle" fill="${color}" font-size="7.9" font-weight="600" font-family="JetBrains Mono, monospace">${seg.wPerMTotal.toFixed(0)} W/m</text>
          </g>
        `);
      });

      const legX = marginLeft + boardPxW + 20;
      const legY = marginTop + 10;
      parts.push(`
        <g>
          <rect x="${legX}" y="${legY}" width="102" height="136" rx="6" fill="${P.pillBg}" stroke="${P.cardBorder}" />
          <text x="${legX + 8}" y="${legY + 18}" fill="${P.title}" font-size="9.5" font-weight="700">BUSBAR W/m</text>
          <rect x="${legX + 8}" y="${legY + 28}" width="12" height="10" rx="2" fill="#ef4444" /><text x="${legX + 26}" y="${legY + 37}" fill="${P.textMuted}" font-size="8.8">&gt;320 W/m / &gt;100%</text>
          <rect x="${legX + 8}" y="${legY + 46}" width="12" height="10" rx="2" fill="#f97316" /><text x="${legX + 26}" y="${legY + 55}" fill="${P.textMuted}" font-size="8.8">180–320 W/m</text>
          <rect x="${legX + 8}" y="${legY + 64}" width="12" height="10" rx="2" fill="#eab308" /><text x="${legX + 26}" y="${legY + 73}" fill="${P.textMuted}" font-size="8.8">90–180 W/m</text>
          <rect x="${legX + 8}" y="${legY + 82}" width="12" height="10" rx="2" fill="#22c55e" /><text x="${legX + 26}" y="${legY + 91}" fill="${P.textMuted}" font-size="8.8">25–90 W/m</text>
          <rect x="${legX + 8}" y="${legY + 100}" width="12" height="10" rx="2" fill="#38bdf8" /><text x="${legX + 26}" y="${legY + 109}" fill="${P.textMuted}" font-size="8.8">&lt;25 W/m</text>
          <rect x="${legX + 8}" y="${legY + 118}" width="12" height="10" rx="2" fill="#64748b" /><text x="${legX + 26}" y="${legY + 127}" fill="${P.textMuted}" font-size="8.8">0 A / Idle</text>
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
