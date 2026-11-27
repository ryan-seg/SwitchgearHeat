/**
 * Interactive Single Line Diagram (SLD) SVG Renderer
 * Supports vector zoom, drag-and-drop reordering/moving of tiers & columns,
 * spare spaces & placeholders, and one-click tier/column deletion.
 */

window.SGSLD = (function () {
  'use strict';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function heatColor(utilPct, wPerM) {
    if (utilPct <= 0.1 && wPerM <= 0.1) return '#64748b';
    if (utilPct > 100 || wPerM > 320) return '#ef4444';
    if (utilPct > 80 || wPerM > 180) return '#f97316';
    if (utilPct > 55 || wPerM > 90) return '#eab308';
    if (utilPct > 25 || wPerM > 25) return '#22c55e';
    return '#38bdf8';
  }

  function getPalette(themeOverride) {
    const t = themeOverride || (document.documentElement && document.documentElement.dataset.theme) || 'dark';
    if (t === 'light') {
      return {
        bg: '#f8fafc',
        grid: '#e2e8f0',
        hatch: '#cbd5e1',
        title: '#0f172a',
        sub: '#475569',
        colBg: 'rgba(255, 255, 255, 0.78)',
        colBgSel: 'rgba(2, 132, 199, 0.08)',
        colBorder: '#cbd5e1',
        headerBg: '#e2e8f0',
        headerBgSel: '#bae6fd',
        headerText: '#0f172a',
        cardBg: '#ffffff',
        cardBgSel: '#e0f2fe',
        cardBorder: '#94a3b8',
        pillBg: '#ffffff',
        pillText: '#0f172a',
        textMain: '#0f172a',
        textMuted: '#475569',
        textDim: '#64748b',
        warmText: '#b45309',
        accent: '#0284c7',
        spacerLabelBg: 'rgba(255, 255, 255, 0.92)',
      };
    }
    if (t === 'blueprint') {
      return {
        bg: '#06152c',
        grid: '#102a52',
        hatch: '#1d447d',
        title: '#f0f9ff',
        sub: '#7dd3fc',
        colBg: 'rgba(13, 39, 77, 0.45)',
        colBgSel: 'rgba(56, 189, 248, 0.1)',
        colBorder: '#1e4b85',
        headerBg: '#0d274d',
        headerBgSel: '#0369a1',
        headerText: '#f0f9ff',
        cardBg: '#0a2040',
        cardBgSel: '#0c4a6e',
        cardBorder: '#285ea6',
        pillBg: '#071933',
        pillText: '#f0f9ff',
        textMain: '#f0f9ff',
        textMuted: '#bae6fd',
        textDim: '#7dd3fc',
        warmText: '#fbbf24',
        accent: '#38bdf8',
        spacerLabelBg: 'rgba(6, 21, 44, 0.88)',
      };
    }
    if (t === 'slate') {
      return {
        bg: '#171513',
        grid: '#292522',
        hatch: '#443e38',
        title: '#fafaf9',
        sub: '#a8a29e',
        colBg: 'rgba(37, 34, 31, 0.45)',
        colBgSel: 'rgba(245, 158, 11, 0.08)',
        colBorder: '#3f3932',
        headerBg: '#25221f',
        headerBgSel: '#78350f',
        headerText: '#fafaf9',
        cardBg: '#1e1b18',
        cardBgSel: '#451a03',
        cardBorder: '#4c443c',
        pillBg: '#1c1917',
        pillText: '#fafaf9',
        textMain: '#fafaf9',
        textMuted: '#d6d3d1',
        textDim: '#a8a29e',
        warmText: '#fb923c',
        accent: '#f59e0b',
        spacerLabelBg: 'rgba(23, 21, 19, 0.9)',
      };
    }
    // Default Midnight CAD (dark)
    return {
      bg: '#0b1120',
      grid: '#1e293b',
      hatch: '#334155',
      title: '#e2e8f0',
      sub: '#94a3b8',
      colBg: 'rgba(15, 23, 42, 0.35)',
      colBgSel: 'rgba(56, 189, 248, 0.06)',
      colBorder: '#1e293b',
      headerBg: '#1e293b',
      headerBgSel: '#0c4a6e',
      headerText: '#f1f5f9',
      cardBg: '#111c33',
      cardBgSel: '#0c4a6e',
      cardBorder: '#334155',
      pillBg: '#0f172a',
      pillText: '#f8fafc',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      textDim: '#64748b',
      warmText: '#fbbf24',
      accent: '#38bdf8',
      spacerLabelBg: 'rgba(11, 17, 32, 0.88)',
    };
  }

  function renderSLD(project, evalRes, selection, zoom, themeOverride, idPrefix) {
    const P = getPalette(themeOverride);
    const px = idPrefix || '';
    const isPrint = Boolean(px);
    const z = zoom || 1.0;
    const cols = evalRes.columns;
    const colSpacing = 248;
    const padLeft = 70;
    const padRight = 148;
    const busY = 208;

    let maxTiers = 1;
    cols.forEach((cr) => {
      const belowCount = cr.tiers.filter((t) => t.tier.role !== 'incomer' && t.tier.role !== 'bus_coupler').length;
      if (belowCount > maxTiers) maxTiers = belowCount;
    });

    const tierStepY = 86;
    const svgWidth = Math.max(920, padLeft + cols.length * colSpacing + padRight);
    const svgHeight = Math.max(560, busY + 124 + maxTiers * tierStepY + 86);
    const colCenters = cols.map((_, idx) => padLeft + idx * colSpacing + colSpacing / 2);

    const sizeAttrs = isPrint
      ? `width="100%" preserveAspectRatio="xMidYMid meet"`
      : `width="${Math.round(svgWidth * z)}" height="${Math.round(svgHeight * z)}" data-base-width="${svgWidth}" data-base-height="${svgHeight}"`;

    const parts = [];
    parts.push(
      `<svg id="${px}sld-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" ${sizeAttrs} class="diagram-svg">`
    );

    parts.push(`
      <defs>
        <pattern id="${px}sld-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="${P.grid}" stroke-width="0.6" />
        </pattern>
        <pattern id="${px}hatch-spare" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="${P.hatch}" stroke-width="2" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="${P.bg}" class="pan-bg" />
      <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="url(#${px}sld-grid)" class="pan-bg" />
    `);

    // Title Block
    const bb = project.mainBusbar;
    const busSpecTxt = `${bb.barsPerPhase}×${bb.widthMm}×${bb.thicknessMm}mm (${evalRes.hbbRes.areaMm2}mm²) ${evalRes.hbbRes.material.shortName} · ${bb.ratedCurrentA}A · kAC=${evalRes.hbbRes.kAcUsed.toFixed(2)}`;
    parts.push(`
      <g class="sld-header">
        <text x="20" y="28" fill="${P.title}" font-size="15" font-weight="700" font-family="Inter, system-ui, sans-serif">${esc(project.meta.projectName)} — SINGLE LINE DIAGRAM</text>
        <text x="20" y="47" fill="${P.sub}" font-size="11.5" font-family="Inter, system-ui, sans-serif">${project.config.voltageV}V ${project.config.frequencyHz}Hz ${project.config.poles} · Main Busbar: ${esc(busSpecTxt)} · RDF: ${(project.config.diversityFactorRDF * 100).toFixed(0)}%</text>
      </g>
    `);

    // Column Frames & Draggable Headers
    cols.forEach((cr, idx) => {
      const cx = colCenters[idx];
      const isColSelected = selection && selection.type === 'column' && selection.colIndex === idx;
      parts.push(`
        <g class="drop-col-zone" data-drop-col="${idx}">
          <rect x="${cx - 112}" y="62" width="224" height="${svgHeight - 82}" rx="8"
            fill="${isColSelected ? P.colBgSel : P.colBg}"
            stroke="${isColSelected ? P.accent : P.colBorder}" stroke-width="${isColSelected ? 1.5 : 1}" stroke-dasharray="${isColSelected ? 'none' : '4 4'}"
            class="col-bg-rect" />
          <g class="clickable draggable-item" data-select-type="column" data-col-index="${idx}" data-drag-col="${idx}">
            <rect x="${cx - 102}" y="68" width="204" height="27" rx="5" fill="${isColSelected ? P.headerBgSel : P.headerBg}" stroke="${isColSelected ? P.accent : P.cardBorder}" />
            <text x="${cx - 94}" y="85" fill="${P.textDim}" font-size="11" font-family="monospace">⋮⋮</text>
            <text x="${cx - 4}" y="85.5" text-anchor="middle" fill="${P.headerText}" font-size="11" font-weight="600" font-family="Inter, sans-serif">${esc(truncate(cr.col.name, 19))} (${cr.widthMm})</text>
          </g>
          ${
            cols.length > 1
              ? `<g class="quick-del-btn clickable" data-quick-del-col="${idx}" title="Remove column">
                  <rect x="${cx + 82}" y="72" width="16" height="18" rx="3" fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.55)" />
                  <text x="${cx + 90}" y="84.5" text-anchor="middle" fill="#fca5a5" font-size="11.5" font-weight="700">×</text>
                </g>`
              : ''
          }
        </g>
      `);
    });

    // Main Horizontal Busbar
    const isHbbSelected = selection && selection.type === 'mainBusbar';
    if (cols.length > 0) {
      const firstX = colCenters[0] - 45;
      const lastX = colCenters[cols.length - 1] + 45;

      parts.push(`
        <rect x="${firstX}" y="${busY - 14}" width="${lastX - firstX}" height="28" rx="6"
          fill="${isHbbSelected ? 'rgba(56,189,248,0.16)' : 'transparent'}"
          stroke="${isHbbSelected ? '#38bdf8' : 'none'}" stroke-width="1.2"
          class="clickable" data-select-type="mainBusbar" />
      `);
      parts.push(`<line x1="${firstX}" y1="${busY}" x2="${colCenters[0]}" y2="${busY}" stroke="#475569" stroke-width="6" stroke-linecap="round" class="clickable" data-select-type="mainBusbar" />`);
      parts.push(`<line x1="${colCenters[cols.length - 1]}" y1="${busY}" x2="${lastX}" y2="${busY}" stroke="#475569" stroke-width="6" stroke-linecap="round" class="clickable" data-select-type="mainBusbar" />`);

      const segMap = {};
      evalRes.hbbSegments.forEach((s) => {
        segMap[`${s.fromColIndex}-${s.toColIndex}`] = s;
      });

      for (let i = 0; i < cols.length - 1; i++) {
        const x1 = colCenters[i];
        const x2 = colCenters[i + 1];
        const midX = (x1 + x2) / 2;
        const seg = segMap[`${i}-${i + 1}`];

        if (!seg) {
          parts.push(`<line x1="${x1}" y1="${busY}" x2="${x2}" y2="${busY}" stroke="#334155" stroke-width="3" stroke-dasharray="6 6" />`);
        } else {
          const color = heatColor(seg.utilizationPct, seg.wPerMTotal);
          const dirArrow = seg.currentA > 1 ? (seg.direction === 'right' ? '→' : '←') : '·';
          parts.push(`
            <g class="clickable" data-select-type="mainBusbar">
              <line x1="${x1}" y1="${busY}" x2="${x2}" y2="${busY}" stroke="${color}" stroke-width="7" stroke-linecap="butt" />
              <line x1="${x1}" y1="${busY}" x2="${x2}" y2="${busY}" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" />
              <rect x="${midX - 58}" y="${busY - 40}" width="116" height="30" rx="5" fill="${P.pillBg}" stroke="${color}" stroke-width="1.2" />
              <text x="${midX}" y="${busY - 27}" text-anchor="middle" fill="${P.pillText}" font-size="10.5" font-weight="700" font-family="JetBrains Mono, Consolas, monospace">${dirArrow} ${Math.round(seg.currentA)} A (${seg.lengthM.toFixed(2)}m)</text>
              <text x="${midX}" y="${busY - 14}" text-anchor="middle" fill="${color}" font-size="9.5" font-weight="600" font-family="JetBrains Mono, Consolas, monospace">${seg.wPerMTotal.toFixed(1)} W/m · ${seg.lossW.toFixed(0)}W</text>
            </g>
          `);
        }
      }

      parts.push(`
        <g class="clickable" data-select-type="mainBusbar">
          <rect x="12" y="${busY - 13}" width="50" height="26" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1" />
          <text x="37" y="${busY + 4}" text-anchor="middle" fill="#38bdf8" font-size="10" font-weight="700" font-family="Inter, sans-serif">HBB</text>
        </g>
      `);
    }

    // Draw Incomers, Couplers, Vertical Droppers & Tiers
    cols.forEach((cr, colIdx) => {
      const cx = colCenters[colIdx];

      // 1. Incomers & Bus Couplers
      cr.tiers.forEach((tr, tierIdx) => {
        if (tr.tier.role === 'incomer') {
          const isSel = selection && selection.type === 'tier' && selection.colIndex === colIdx && selection.tierIndex === tierIdx;
          const isClosed = tr.tier.incomerState !== 'open' && tr.tier.status !== 'standby';
          const colStroke = isClosed ? '#38bdf8' : '#64748b';
          const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;

          parts.push(`
            <g class="clickable draggable-item" data-select-type="tier" data-col-index="${colIdx}" data-tier-index="${tierIdx}" data-drag-tier="${colIdx}:${tierIdx}" data-drop-tier="${colIdx}:${tierIdx}">
              <line x1="${cx}" y1="100" x2="${cx}" y2="128" stroke="${colStroke}" stroke-width="2.5" />
              <polygon points="${cx - 6},104 ${cx + 6},104 ${cx},113" fill="${colStroke}" />
              <rect x="${cx - 14}" y="128" width="28" height="26" rx="3" fill="${isSel ? '#0c4a6e' : '#0f172a'}" stroke="${isSel ? '#38bdf8' : colStroke}" stroke-width="${isSel ? 2.2 : 1.8}" />
              ${
                isClosed
                  ? `<line x1="${cx - 7}" y1="134" x2="${cx + 7}" y2="148" stroke="${colStroke}" stroke-width="2" />
                     <line x1="${cx + 7}" y1="134" x2="${cx - 7}" y2="148" stroke="${colStroke}" stroke-width="2" />`
                  : `<line x1="${cx}" y1="132" x2="${cx + 9}" y2="146" stroke="#ef4444" stroke-width="2" />`
              }
              <line x1="${cx}" y1="154" x2="${cx}" y2="${busY}" stroke="${colStroke}" stroke-width="3" />
              <circle cx="${cx}" cy="${busY}" r="5" fill="${colStroke}" />
              <rect x="${cx + 20}" y="99" width="88" height="54" rx="5" fill="${isSel ? P.cardBgSel : P.cardBg}" stroke="${isSel ? P.accent : P.cardBorder}" />
              <text x="${cx + 26}" y="113" fill="${P.textMain}" font-size="10.5" font-weight="700" font-family="Inter, sans-serif">${esc(tr.tier.tag)}</text>
              <text x="${cx + 26}" y="125" fill="${P.textMuted}" font-size="9.5" font-family="JetBrains Mono, monospace">${tr.tier.ratedCurrentA}A ACB</text>
              <text x="${cx + 26}" y="137" fill="${isClosed ? P.accent : '#ef4444'}" font-size="10" font-weight="700" font-family="JetBrains Mono, monospace">${isClosed ? Math.round(tr.iOp) + ' A' : 'OPEN'}</text>
              <text x="${cx + 26}" y="149" fill="${P.warmText}" font-size="9.5" font-family="JetBrains Mono, monospace">${devW.toFixed(0)} W</text>
              <g class="quick-del-btn clickable" data-quick-del-tier="${colIdx}:${tierIdx}" title="Delete incomer">
                <rect x="${cx + 92}" y="102" width="13" height="14" rx="2" fill="rgba(239,68,68,0.2)" />
                <text x="${cx + 98.5}" y="112" text-anchor="middle" fill="#fca5a5" font-size="10.5" font-weight="700">×</text>
              </g>
            </g>
          `);
        }

        if (tr.tier.role === 'bus_coupler') {
          const isSel = selection && selection.type === 'tier' && selection.colIndex === colIdx && selection.tierIndex === tierIdx;
          const isClosed = tr.tier.couplerState === 'closed';
          const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;
          const color = isClosed ? '#22c55e' : '#f59e0b';

          parts.push(`
            <g class="clickable draggable-item" data-select-type="tier" data-col-index="${colIdx}" data-tier-index="${tierIdx}" data-drag-tier="${colIdx}:${tierIdx}" data-drop-tier="${colIdx}:${tierIdx}">
              <rect x="${cx - 22}" y="${busY - 18}" width="44" height="36" rx="5" fill="${isSel ? '#0c4a6e' : '#0f172a'}" stroke="${isSel ? '#38bdf8' : color}" stroke-width="2" />
              ${
                isClosed
                  ? `<line x1="${cx - 12}" y1="${busY}" x2="${cx + 12}" y2="${busY}" stroke="#22c55e" stroke-width="3" />
                     <line x1="${cx - 6}" y1="${busY - 6}" x2="${cx + 6}" y2="${busY + 6}" stroke="#22c55e" stroke-width="1.8" />
                     <line x1="${cx + 6}" y1="${busY - 6}" x2="${cx - 6}" y2="${busY + 6}" stroke="#22c55e" stroke-width="1.8" />`
                  : `<line x1="${cx - 12}" y1="${busY}" x2="${cx - 4}" y2="${busY}" stroke="#f59e0b" stroke-width="2.5" />
                     <line x1="${cx + 4}" y1="${busY}" x2="${cx + 12}" y2="${busY}" stroke="#f59e0b" stroke-width="2.5" />
                     <line x1="${cx - 4}" y1="${busY}" x2="${cx + 5}" y2="${busY - 10}" stroke="#f59e0b" stroke-width="2.2" />`
              }
              <rect x="${cx - 58}" y="${busY + 26}" width="116" height="44" rx="5" fill="#1e293b" stroke="${color}" stroke-width="1" />
              <text x="${cx}" y="${busY + 41}" text-anchor="middle" fill="#f8fafc" font-size="10.5" font-weight="700">${esc(tr.tier.tag)} (${isClosed ? 'CLOSED' : 'OPEN'})</text>
              <text x="${cx}" y="${busY + 54}" text-anchor="middle" fill="#94a3b8" font-size="9.5" font-family="JetBrains Mono, monospace">${Math.round(tr.iOp)} A · ${devW.toFixed(0)} W</text>
              <text x="${cx}" y="${busY + 65}" text-anchor="middle" fill="#38bdf8" font-size="8.5">Click to inspect / toggle</text>
              <g class="quick-del-btn clickable" data-quick-del-tier="${colIdx}:${tierIdx}" title="Delete coupler">
                <rect x="${cx + 42}" y="${busY + 29}" width="13" height="14" rx="2" fill="rgba(239,68,68,0.2)" />
                <text x="${cx + 48.5}" y="${busY + 39}" text-anchor="middle" fill="#fca5a5" font-size="10.5" font-weight="700">×</text>
              </g>
            </g>
          `);
        }
      });

      // 2. Outgoing Feeders, Interconnectors & Spare/Placeholder Tiers
      const belowTiers = cr.tiers
        .map((tr, origIdx) => ({ tr, origIdx }))
        .filter((item) => item.tr.tier.role !== 'incomer' && item.tr.tier.role !== 'bus_coupler');

      const dropperX = cx - 76;
      const firstTierY = busY + 86;
      const lastTierY = belowTiers.length > 0 ? firstTierY + (belowTiers.length - 1) * tierStepY : busY + 86;

      // Draw Vertical Dropper if any electrical loads exist in this column
      const hasElectricalDropper = belowTiers.some((it) => it.tr.tier.role === 'feeder' || it.tr.tier.role === 'interconnector');
      if (hasElectricalDropper) {
        const lastElecIdx = belowTiers.reduce((acc, it, i) => (it.tr.tier.role !== 'spacer' ? i : acc), 0);
        const dropperEndY = firstTierY + lastElecIdx * tierStepY;
        const vbbColor = heatColor(
          cr.vbbSegments.length ? Math.max(...cr.vbbSegments.map((s) => s.utilizationPct)) : 0,
          cr.vbbMaxWPerM
        );
        const vbb = cr.vbbSpec;
        parts.push(`<circle cx="${dropperX}" cy="${busY}" r="4.5" fill="${vbbColor}" />`);
        parts.push(`<line x1="${dropperX}" y1="${busY}" x2="${dropperX}" y2="${dropperEndY}" stroke="${vbbColor}" stroke-width="4" stroke-linecap="round" class="clickable" data-select-type="column" data-col-index="${colIdx}" />`);
        parts.push(`
          <g class="clickable" data-select-type="column" data-col-index="${colIdx}">
            <rect x="${dropperX + 8}" y="${busY + 12}" width="166" height="24" rx="4" fill="${P.pillBg}" stroke="${P.cardBorder}" />
            <text x="${dropperX + 14}" y="${busY + 27}" fill="${P.textMain}" font-size="9.2" font-family="JetBrains Mono, monospace">VBB ${vbb.barsPerPhase}×${vbb.widthMm}×${vbb.thicknessMm} · ${cr.vbbTotalLossW.toFixed(0)}W (${cr.vbbTotalLengthM.toFixed(2)}m)</text>
          </g>
        `);
      }

      belowTiers.forEach((item, listIdx) => {
        const { tr, origIdx } = item;
        const ty = firstTierY + listIdx * tierStepY;
        const isSel = selection && selection.type === 'tier' && selection.colIndex === colIdx && selection.tierIndex === origIdx;
        const isSpacer = tr.tier.role === 'spacer';
        const isFuture = tr.tier.status === 'future';
        const isInterconn = tr.tier.role === 'interconnector';
        const active = tr.isActive;
        const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;
        const totalW = devW + (tr.takeoffLossW || 0) + (tr.cableLoss ? tr.cableLoss.totalW : 0);

        if (isSpacer) {
          parts.push(`
            <g class="clickable draggable-item" data-select-type="tier" data-col-index="${colIdx}" data-tier-index="${origIdx}" data-drag-tier="${colIdx}:${origIdx}" data-drop-tier="${colIdx}:${origIdx}">
              <rect x="${dropperX + 18}" y="${ty - 28}" width="168" height="56" rx="6"
                fill="url(#${px}hatch-spare)" stroke="${isSel ? P.accent : P.cardBorder}" stroke-width="${isSel ? 2 : 1.2}" stroke-dasharray="5 3" />
              <rect x="${dropperX + 24}" y="${ty - 21}" width="136" height="42" rx="4" fill="${P.spacerLabelBg}" />
              <text x="${dropperX + 30}" y="${ty - 6}" fill="${P.textMain}" font-size="10.2" font-weight="700" font-family="Inter, sans-serif">⋮⋮ ${esc(tr.tier.tag)}</text>
              <text x="${dropperX + 30}" y="${ty + 7}" fill="${P.textMuted}" font-size="8.8" font-family="Inter, sans-serif">${esc(truncate(tr.tier.category, 20))} · ${tr.tier.heightMm}mm</text>
              <text x="${dropperX + 30}" y="${ty + 18}" fill="${totalW > 0 ? P.warmText : P.textDim}" font-size="8.8" font-family="JetBrains Mono, monospace">${totalW > 0 ? totalW.toFixed(0) + ' W aux' : '0 W (Physical Reserve)'}</text>
              <g class="quick-del-btn clickable" data-quick-del-tier="${colIdx}:${origIdx}" title="Remove spare/placeholder">
                <rect x="${dropperX + 169}" y="${ty - 24}" width="14" height="15" rx="3" fill="rgba(239,68,68,0.22)" stroke="rgba(239,68,68,0.5)" />
                <text x="${dropperX + 176}" y="${ty - 13}" text-anchor="middle" fill="#ef4444" font-size="11" font-weight="700">×</text>
              </g>
            </g>
          `);
          return;
        }

        const cardStroke = isSel
          ? P.accent
          : isInterconn
          ? active
            ? '#f97316'
            : '#a855f7'
          : isFuture
          ? active
            ? '#c084fc'
            : P.cardBorder
          : active
          ? P.cardBorder
          : P.colBorder;

        const cardFill = isSel
          ? P.cardBgSel
          : isInterconn && active
          ? 'rgba(249, 115, 22, 0.14)'
          : P.cardBg;

        parts.push(`
          <g class="clickable draggable-item" data-select-type="tier" data-col-index="${colIdx}" data-tier-index="${origIdx}" data-drag-tier="${colIdx}:${origIdx}" data-drop-tier="${colIdx}:${origIdx}">
            <circle cx="${dropperX}" cy="${ty}" r="3.5" fill="${active ? P.accent : '#64748b'}" />
            <line x1="${dropperX}" y1="${ty}" x2="${dropperX + 18}" y2="${ty}" stroke="${active ? P.accent : '#64748b'}" stroke-width="2" stroke-dasharray="${isFuture && !active ? '3 3' : 'none'}" />
            ${renderDeviceSymbol(dropperX + 18, ty, tr.tier.category, isInterconn, active, P)}
            <rect x="${dropperX + 44}" y="${ty - 32}" width="144" height="64" rx="6"
              fill="${cardFill}" stroke="${cardStroke}" stroke-width="${isSel ? 2 : 1.2}"
              stroke-dasharray="${isFuture ? '5 3' : 'none'}" />
            <text x="${dropperX + 51}" y="${ty - 16}" fill="${active ? P.textMain : P.textMuted}" font-size="10.2" font-weight="700" font-family="Inter, sans-serif">⋮⋮ ${esc(truncate(tr.tier.tag, 12))}${tr.tier.phases === '1P' ? ' [1P]' : ''}</text>
            <text x="${dropperX + 168}" y="${ty - 16}" text-anchor="end" fill="${active ? P.warmText : P.textDim}" font-size="10" font-weight="700" font-family="JetBrains Mono, monospace">${totalW.toFixed(0)}W</text>
            <text x="${dropperX + 51}" y="${ty - 2}" fill="${P.textMuted}" font-size="9" font-family="Inter, sans-serif">${esc(truncate(tr.tier.category + ' · ' + tr.tier.ratedCurrentA + 'A' + (tr.tier.phases === '1P' ? ' 1P' : ''), 22))}</text>
            <text x="${dropperX + 51}" y="${ty + 13}" fill="${isInterconn && active ? '#ea580c' : active ? P.accent : P.textDim}" font-size="9.6" font-weight="600" font-family="JetBrains Mono, monospace">${active ? tr.iOp.toFixed(1) + ' A' : isInterconn ? '0 A (N-1: ' + Math.round(tr.tier.n1TransferCurrentA || 0) + 'A)' : isFuture ? 'FUTURE (OFF)' : 'IDLE / 0 A'}</text>
            <text x="${dropperX + 51}" y="${ty + 25}" fill="${P.textDim}" font-size="8.5" font-family="JetBrains Mono, monospace">${isInterconn ? '→ ' + esc(truncate(tr.tier.remoteBoardName || 'MSB-B', 18)) : 'EL +' + Math.round(evalRes.panelHeightMm - tr.yCenterMm) + 'mm'}</text>
            <g class="quick-del-btn clickable" data-quick-del-tier="${colIdx}:${origIdx}" title="Remove component">
              <rect x="${dropperX + 172}" y="${ty - 29}" width="14" height="15" rx="3" fill="rgba(239,68,68,0.22)" stroke="rgba(239,68,68,0.5)" />
              <text x="${dropperX + 179}" y="${ty - 18}" text-anchor="middle" fill="#ef4444" font-size="11" font-weight="700">×</text>
            </g>
          </g>
        `);
      });

      // Quick Add Buttons at Bottom of Every Column (Feeder + Spare Space, or Interconnector Tier in Incomer Column)
      if (!cr.hasIncomer && !cr.hasCoupler) {
        const addBtnY = belowTiers.length > 0 ? lastTierY + 46 : busY + 46;
        parts.push(`
          <g class="clickable" data-action="add-tier" data-col-index="${colIdx}">
            <rect x="${cx - 98}" y="${addBtnY}" width="94" height="24" rx="5" fill="#1e293b" stroke="#334155" stroke-dasharray="3 2" />
            <text x="${cx - 51}" y="${addBtnY + 15.5}" text-anchor="middle" fill="#38bdf8" font-size="9.8" font-weight="600">+ Feeder</text>
          </g>
          <g class="clickable" data-action="add-spare" data-col-index="${colIdx}">
            <rect x="${cx + 4}" y="${addBtnY}" width="94" height="24" rx="5" fill="#1e293b" stroke="#475569" stroke-dasharray="3 2" />
            <text x="${cx + 51}" y="${addBtnY + 15.5}" text-anchor="middle" fill="#cbd5e1" font-size="9.8" font-weight="600">+ Spare Bay</text>
          </g>
        `);
      } else if (cr.hasIncomer) {
        const addBtnY = belowTiers.length > 0 ? lastTierY + 46 : busY + 46;
        parts.push(`
          <g class="clickable" data-action="add-interconn-tier" data-col-index="${colIdx}" title="Place an Interconnector (e.g. 1250A ACB) in a tier in this Incomer column">
            <rect x="${cx - 98}" y="${addBtnY}" width="196" height="24" rx="5" fill="#1e293b" stroke="#f97316" stroke-dasharray="3 2" />
            <text x="${cx}" y="${addBtnY + 15.5}" text-anchor="middle" fill="#fb923c" font-size="9.5" font-weight="600">+ Interconnector Tier (1250A)</text>
          </g>
        `);
      }
    });

    // Ghost "+ Add Column" button on right
    const ghostX = padLeft + cols.length * colSpacing + 12;
    parts.push(`
      <g class="clickable" data-action="add-column">
        <rect x="${ghostX}" y="120" width="114" height="130" rx="8" fill="rgba(30,41,59,0.45)" stroke="#334155" stroke-width="1.5" stroke-dasharray="5 4" />
        <text x="${ghostX + 57}" y="178" text-anchor="middle" fill="#38bdf8" font-size="22" font-weight="600">+</text>
        <text x="${ghostX + 57}" y="200" text-anchor="middle" fill="#cbd5e1" font-size="11" font-weight="600">Add Column</text>
      </g>
    `);

    parts.push('</svg>');
    return parts.join('\n');
  }

  function renderDeviceSymbol(x, y, category, isInterconn, active, P) {
    const bg = P ? P.pillBg : '#0f172a';
    const c = isInterconn ? (active ? '#f97316' : '#a855f7') : active ? (P ? P.accent : '#38bdf8') : '#64748b';
    if (category === 'DOL Starter' || category === 'Star-Delta Starter' || category === 'Soft Starter' || category === 'VSD / Inverter') {
      const code =
        category === 'DOL Starter'
          ? 'M'
          : category === 'Star-Delta Starter'
          ? 'YΔ'
          : category === 'Soft Starter'
          ? 'SS'
          : 'V';
      return `
        <circle cx="${x + 11}" cy="${y}" r="10.5" fill="${bg}" stroke="${c}" stroke-width="1.8" />
        <text x="${x + 11}" y="${y + 3.5}" text-anchor="middle" fill="${c}" font-size="8.5" font-weight="700" font-family="Inter, sans-serif">${code}</text>
      `;
    }
    if (category === 'HRC Fuse-Switch' || category === 'Fuse-Switch') {
      return `
        <rect x="${x + 1}" y="${y - 6}" width="20" height="12" rx="1" fill="${bg}" stroke="${c}" stroke-width="1.6" />
        <line x1="${x + 1}" y1="${y}" x2="${x + 21}" y2="${y}" stroke="${c}" stroke-width="1.4" />
      `;
    }
    if (isInterconn) {
      return `
        <rect x="${x}" y="${y - 10}" width="22" height="20" rx="3" fill="${bg}" stroke="${c}" stroke-width="1.8" />
        <text x="${x + 11}" y="${y + 3.5}" text-anchor="middle" fill="${c}" font-size="8.5" font-weight="700">IC</text>
      `;
    }
    return `
      <rect x="${x + 1}" y="${y - 9}" width="20" height="18" rx="2" fill="${bg}" stroke="${c}" stroke-width="1.6" />
      <line x1="${x + 5}" y1="${y - 4}" x2="${x + 17}" y2="${y + 4}" stroke="${c}" stroke-width="1.6" />
    `;
  }

  function truncate(s, max) {
    if (!s) return '';
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  return { renderSLD, heatColor, getPalette };
})();
