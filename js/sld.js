/**
 * Interactive Single Line Diagram (SLD) SVG Renderer
 * Synchronized directly with the unified Switchboard model & live physics results.
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
    if (utilPct <= 0.1 && wPerM <= 0.1) return '#64748b'; // idle slate
    if (utilPct > 100 || wPerM > 320) return '#ef4444'; // overload / hot red
    if (utilPct > 80 || wPerM > 180) return '#f97316'; // high orange
    if (utilPct > 55 || wPerM > 90) return '#eab308'; // warm amber
    if (utilPct > 25 || wPerM > 25) return '#22c55e'; // normal green
    return '#38bdf8'; // light load sky blue
  }

  function renderSLD(project, evalRes, selection) {
    const cols = evalRes.columns;
    const colSpacing = 240;
    const padLeft = 70;
    const padRight = 140;
    const busY = 205;

    // Determine tallest column (max tiers)
    let maxTiers = 1;
    cols.forEach((cr) => {
      const feedCount = cr.tiers.filter((t) => t.tier.role !== 'incomer' && t.tier.role !== 'bus_coupler').length;
      if (feedCount > maxTiers) maxTiers = feedCount;
    });

    const tierStepY = 86;
    const svgWidth = Math.max(920, padLeft + cols.length * colSpacing + padRight);
    const svgHeight = Math.max(520, busY + 95 + maxTiers * tierStepY + 70);

    const colCenters = cols.map((_, idx) => padLeft + idx * colSpacing + colSpacing / 2);

    const parts = [];
    parts.push(
      `<svg id="sld-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" class="diagram-svg">`
    );

    // Defs (markers, subtle grid, glow)
    parts.push(`
      <defs>
        <pattern id="sld-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" stroke-width="0.6" />
        </pattern>
        <marker id="arrow-flow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
        </marker>
        <marker id="arrow-hot" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#f97316" />
        </marker>
      </defs>
      <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#0b1120" />
      <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="url(#sld-grid)" />
    `);

    // Title block inside SVG
    const bb = project.mainBusbar;
    const busSpecTxt = `${bb.barsPerPhase}×${bb.widthMm}×${bb.thicknessMm}mm (${evalRes.hbbRes.areaMm2}mm²) ${evalRes.hbbRes.material.shortName} · ${bb.ratedCurrentA}A · kAC=${evalRes.hbbRes.kAcUsed.toFixed(2)}`;
    parts.push(`
      <g class="sld-header">
        <text x="20" y="28" fill="#e2e8f0" font-size="15" font-weight="700" font-family="Inter, system-ui, sans-serif">${esc(project.meta.projectName)} — SINGLE LINE DIAGRAM</text>
        <text x="20" y="47" fill="#94a3b8" font-size="11.5" font-family="Inter, system-ui, sans-serif">${project.config.voltageV}V ${project.config.frequencyHz}Hz ${project.config.poles} · Main Busbar: ${esc(busSpecTxt)} · RDF: ${(project.config.diversityFactorRDF * 100).toFixed(0)}%</text>
      </g>
    `);

    // Column background guides & headers
    cols.forEach((cr, idx) => {
      const cx = colCenters[idx];
      const isColSelected = selection && selection.type === 'column' && selection.colIndex === idx;
      parts.push(`
        <g class="sld-col-header clickable" data-select-type="column" data-col-index="${idx}">
          <rect x="${cx - 108}" y="62" width="216" height="${svgHeight - 82}" rx="8"
            fill="${isColSelected ? 'rgba(56, 189, 248, 0.06)' : 'rgba(15, 23, 42, 0.35)'}"
            stroke="${isColSelected ? '#38bdf8' : '#1e293b'}" stroke-width="${isColSelected ? 1.5 : 1}" stroke-dasharray="${isColSelected ? 'none' : '4 4'}" />
          <rect x="${cx - 98}" y="68" width="196" height="26" rx="5" fill="${isColSelected ? '#0c4a6e' : '#1e293b'}" stroke="${isColSelected ? '#38bdf8' : '#334155'}" />
          <text x="${cx}" y="85" text-anchor="middle" fill="#f1f5f9" font-size="11.5" font-weight="600" font-family="Inter, system-ui, sans-serif">${esc(cr.col.name)} (${cr.widthMm}mm)</text>
        </g>
      `);
    });

    // Draw Main Horizontal Busbar (segment by segment between column centres)
    const isHbbSelected = selection && selection.type === 'mainBusbar';
    if (cols.length > 0) {
      const firstX = colCenters[0] - 45;
      const lastX = colCenters[cols.length - 1] + 45;

      // Subtle clickable backdrop for main busbar
      parts.push(`
        <rect x="${firstX}" y="${busY - 14}" width="${lastX - firstX}" height="28" rx="6"
          fill="${isHbbSelected ? 'rgba(56,189,248,0.16)' : 'transparent'}"
          stroke="${isHbbSelected ? '#38bdf8' : 'none'}" stroke-width="1.2"
          class="clickable" data-select-type="mainBusbar" />
      `);

      // Left & right end stubs
      parts.push(`<line x1="${firstX}" y1="${busY}" x2="${colCenters[0]}" y2="${busY}" stroke="#475569" stroke-width="6" stroke-linecap="round" class="clickable" data-select-type="mainBusbar" />`);
      parts.push(`<line x1="${colCenters[cols.length - 1]}" y1="${busY}" x2="${lastX}" y2="${busY}" stroke="#475569" stroke-width="6" stroke-linecap="round" class="clickable" data-select-type="mainBusbar" />`);

      // Segments between columns
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
          // Open bus coupler split between i and i+1
          parts.push(`<line x1="${x1}" y1="${busY}" x2="${x2}" y2="${busY}" stroke="#334155" stroke-width="3" stroke-dasharray="6 6" />`);
        } else {
          const color = heatColor(seg.utilizationPct, seg.wPerMTotal);
          parts.push(`
            <g class="clickable" data-select-type="mainBusbar">
              <line x1="${x1}" y1="${busY}" x2="${x2}" y2="${busY}" stroke="${color}" stroke-width="7" stroke-linecap="butt" />
              <line x1="${x1}" y1="${busY}" x2="${x2}" y2="${busY}" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" />
          `);

          // Direction arrow + current/W/m badge
          const dirArrow = seg.currentA > 1 ? (seg.direction === 'right' ? '→' : '←') : '·';
          parts.push(`
              <rect x="${midX - 58}" y="${busY - 40}" width="116" height="30" rx="5" fill="#0f172a" stroke="${color}" stroke-width="1.2" />
              <text x="${midX}" y="${busY - 27}" text-anchor="middle" fill="#f8fafc" font-size="10.5" font-weight="700" font-family="JetBrains Mono, Consolas, monospace">${dirArrow} ${Math.round(seg.currentA)} A (${seg.lengthM.toFixed(2)}m)</text>
              <text x="${midX}" y="${busY - 14}" text-anchor="middle" fill="${color}" font-size="9.5" font-weight="600" font-family="JetBrains Mono, Consolas, monospace">${seg.wPerMTotal.toFixed(1)} W/m · ${seg.lossW.toFixed(0)}W</text>
            </g>
          `);
        }
      }

      // Main Busbar Label Pill on far left
      parts.push(`
        <g class="clickable" data-select-type="mainBusbar">
          <rect x="12" y="${busY - 13}" width="50" height="26" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1" />
          <text x="37" y="${busY + 4}" text-anchor="middle" fill="#38bdf8" font-size="10" font-weight="700" font-family="Inter, sans-serif">HBB</text>
        </g>
      `);
    }

    // Draw Incomers, Bus Couplers, Vertical Busbars & Outgoing Tiers per Column
    cols.forEach((cr, colIdx) => {
      const cx = colCenters[colIdx];

      // 1. Incomers (drawn ABOVE main busbar)
      cr.tiers.forEach((tr, tierIdx) => {
        if (tr.tier.role === 'incomer') {
          const isSel = selection && selection.type === 'tier' && selection.colIndex === colIdx && selection.tierIndex === tierIdx;
          const isClosed = tr.tier.incomerState !== 'open' && tr.tier.status !== 'standby';
          const colStroke = isClosed ? '#38bdf8' : '#64748b';
          const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;

          parts.push(`
            <g class="clickable" data-select-type="tier" data-col-index="${colIdx}" data-tier-index="${tierIdx}">
              <!-- Supply line down to breaker -->
              <line x1="${cx}" y1="100" x2="${cx}" y2="128" stroke="${colStroke}" stroke-width="2.5" />
              <polygon points="${cx - 6},104 ${cx + 6},104 ${cx},113" fill="${colStroke}" />
              <!-- ACB Symbol -->
              <rect x="${cx - 14}" y="128" width="28" height="26" rx="3" fill="${isSel ? '#0c4a6e' : '#0f172a'}" stroke="${isSel ? '#38bdf8' : colStroke}" stroke-width="${isSel ? 2.2 : 1.8}" />
              ${
                isClosed
                  ? `<line x1="${cx - 7}" y1="134" x2="${cx + 7}" y2="148" stroke="${colStroke}" stroke-width="2" />
                     <line x1="${cx + 7}" y1="134" x2="${cx - 7}" y2="148" stroke="${colStroke}" stroke-width="2" />`
                  : `<line x1="${cx}" y1="132" x2="${cx + 9}" y2="146" stroke="#ef4444" stroke-width="2" />`
              }
              <!-- Line to HBB -->
              <line x1="${cx}" y1="154" x2="${cx}" y2="${busY}" stroke="${colStroke}" stroke-width="3" />
              <circle cx="${cx}" cy="${busY}" r="5" fill="${colStroke}" />
              <!-- Label Box -->
              <rect x="${cx + 20}" y="98" width="84" height="54" rx="5" fill="${isSel ? '#0c4a6e' : '#1e293b'}" stroke="${isSel ? '#38bdf8' : '#334155'}" />
              <text x="${cx + 26}" y="112" fill="#f8fafc" font-size="10.5" font-weight="700" font-family="Inter, sans-serif">${esc(tr.tier.tag)}</text>
              <text x="${cx + 26}" y="124" fill="#94a3b8" font-size="9.5" font-family="JetBrains Mono, monospace">${tr.tier.ratedCurrentA}A ACB</text>
              <text x="${cx + 26}" y="136" fill="${isClosed ? '#38bdf8' : '#f87171'}" font-size="10" font-weight="700" font-family="JetBrains Mono, monospace">${isClosed ? Math.round(tr.iOp) + ' A' : 'OPEN'}</text>
              <text x="${cx + 26}" y="148" fill="#fbbf24" font-size="9.5" font-family="JetBrains Mono, monospace">${devW.toFixed(0)} W</text>
            </g>
          `);
        }

        // 2. Bus Coupler (drawn ON the main busbar)
        if (tr.tier.role === 'bus_coupler') {
          const isSel = selection && selection.type === 'tier' && selection.colIndex === colIdx && selection.tierIndex === tierIdx;
          const isClosed = tr.tier.couplerState === 'closed';
          const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;
          const color = isClosed ? '#22c55e' : '#f59e0b';

          parts.push(`
            <g class="clickable" data-select-type="tier" data-col-index="${colIdx}" data-tier-index="${tierIdx}">
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
              <rect x="${cx - 56}" y="${busY + 26}" width="112" height="44" rx="5" fill="#1e293b" stroke="${color}" stroke-width="1" />
              <text x="${cx}" y="${busY + 41}" text-anchor="middle" fill="#f8fafc" font-size="10.5" font-weight="700">${esc(tr.tier.tag)} (${isClosed ? 'CLOSED' : 'OPEN'})</text>
              <text x="${cx}" y="${busY + 54}" text-anchor="middle" fill="#94a3b8" font-size="9.5" font-family="JetBrains Mono, monospace">${Math.round(tr.iOp)} A · ${devW.toFixed(0)} W</text>
              <text x="${cx}" y="${busY + 65}" text-anchor="middle" fill="#38bdf8" font-size="8.5" class="clickable" data-toggle-coupler="${colIdx}:${tierIdx}">Click to inspect / toggle</text>
            </g>
          `);
        }
      });

      // 3. Outgoing Feeders & Interconnectors hanging off Vertical Dropper Busbar
      const outTiers = cr.tiers
        .map((tr, origIdx) => ({ tr, origIdx }))
        .filter((item) => item.tr.tier.role === 'feeder' || item.tr.tier.role === 'interconnector');

      if (outTiers.length > 0) {
        const dropperX = cx - 72;
        const firstTierY = busY + 62;
        const lastTierY = firstTierY + (outTiers.length - 1) * tierStepY;
        const vbbColor = heatColor(
          cr.vbbSegments.length ? Math.max(...cr.vbbSegments.map((s) => s.utilizationPct)) : 0,
          cr.vbbMaxWPerM
        );

        // Tap-off dot on HBB
        parts.push(`<circle cx="${dropperX}" cy="${busY}" r="4.5" fill="${vbbColor}" />`);
        // Vertical busbar dropper line
        parts.push(`
          <line x1="${dropperX}" y1="${busY}" x2="${dropperX}" y2="${lastTierY}" stroke="${vbbColor}" stroke-width="4" stroke-linecap="round" class="clickable" data-select-type="column" data-col-index="${colIdx}" />
        `);

        // Vertical busbar summary pill right below HBB
        const vbb = cr.vbbSpec;
        parts.push(`
          <g class="clickable" data-select-type="column" data-col-index="${colIdx}">
            <rect x="${dropperX + 8}" y="${busY + 12}" width="160" height="24" rx="4" fill="#0f172a" stroke="#334155" />
            <text x="${dropperX + 14}" y="${busY + 27}" fill="#cbd5e1" font-size="9.2" font-family="JetBrains Mono, monospace">VBB ${vbb.barsPerPhase}×${vbb.widthMm}×${vbb.thicknessMm} · ${cr.vbbTotalLossW.toFixed(0)}W (${cr.vbbTotalLengthM.toFixed(2)}m)</text>
          </g>
        `);

        // Draw each outgoing tier card + IEC symbol
        outTiers.forEach((item, listIdx) => {
          const { tr, origIdx } = item;
          const ty = firstTierY + listIdx * tierStepY;
          const isSel = selection && selection.type === 'tier' && selection.colIndex === colIdx && selection.tierIndex === origIdx;
          const isFuture = tr.tier.status === 'future';
          const isInterconn = tr.tier.role === 'interconnector';
          const active = tr.isActive;
          const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;
          const totalW = devW + (tr.takeoffLossW || 0) + (tr.cableLoss ? tr.cableLoss.totalW : 0);

          const cardStroke = isSel
            ? '#38bdf8'
            : isInterconn
            ? active
              ? '#f97316'
              : '#a855f7'
            : isFuture
            ? active
              ? '#c084fc'
              : '#475569'
            : active
            ? '#334155'
            : '#1e293b';

          const cardFill = isSel
            ? '#0c4a6e'
            : isInterconn && active
            ? 'rgba(249, 115, 22, 0.14)'
            : '#111c33';

          // Horizontal tap-off line from vertical busbar to device symbol
          parts.push(`
            <g class="clickable" data-select-type="tier" data-col-index="${colIdx}" data-tier-index="${origIdx}">
              <circle cx="${dropperX}" cy="${ty}" r="3.5" fill="${active ? '#38bdf8' : '#475569'}" />
              <line x1="${dropperX}" y1="${ty}" x2="${dropperX + 20}" y2="${ty}" stroke="${active ? '#38bdf8' : '#475569'}" stroke-width="2" stroke-dasharray="${isFuture && !active ? '3 3' : 'none'}" />
              <!-- Miniature Breaker/Starter Symbol -->
              ${renderDeviceSymbol(dropperX + 20, ty, tr.tier.category, isInterconn, active)}
              <!-- Tier Info Card -->
              <rect x="${dropperX + 46}" y="${ty - 32}" width="136" height="64" rx="6"
                fill="${cardFill}" stroke="${cardStroke}" stroke-width="${isSel ? 2 : 1.2}"
                stroke-dasharray="${isFuture ? '5 3' : 'none'}" />
              <text x="${dropperX + 54}" y="${ty - 16}" fill="${active ? '#f8fafc' : '#94a3b8'}" font-size="10.5" font-weight="700" font-family="Inter, sans-serif">${esc(tr.tier.tag)}</text>
              <text x="${dropperX + 174}" y="${ty - 16}" text-anchor="end" fill="${active ? '#fbbf24' : '#64748b'}" font-size="10" font-weight="700" font-family="JetBrains Mono, monospace">${totalW.toFixed(0)} W</text>
              <text x="${dropperX + 54}" y="${ty - 2}" fill="#94a3b8" font-size="9" font-family="Inter, sans-serif">${esc(truncate(tr.tier.category + ' · ' + tr.tier.ratedCurrentA + 'A', 22))}</text>
              <text x="${dropperX + 54}" y="${ty + 13}" fill="${isInterconn && active ? '#fb923c' : active ? '#38bdf8' : '#64748b'}" font-size="9.8" font-weight="600" font-family="JetBrains Mono, monospace">${active ? tr.iOp.toFixed(1) + ' A' : isFuture ? 'FUTURE (OFF)' : 'IDLE / 0 A'}</text>
              <text x="${dropperX + 54}" y="${ty + 25}" fill="#64748b" font-size="8.5" font-family="JetBrains Mono, monospace">${isInterconn ? '→ ' + esc(truncate(tr.tier.remoteBoardName || 'MSB-B', 18)) : 'EL +' + Math.round(evalRes.panelHeightMm - tr.yCenterMm) + 'mm'}</text>
            </g>
          `);
        });

        // Quick "+ Add Feeder" button at bottom of column
        const addBtnY = lastTierY + 48;
        parts.push(`
          <g class="clickable" data-action="add-tier" data-col-index="${colIdx}">
            <rect x="${cx - 64}" y="${addBtnY}" width="128" height="24" rx="5" fill="#1e293b" stroke="#334155" stroke-dasharray="3 2" />
            <text x="${cx}" y="${addBtnY + 15.5}" text-anchor="middle" fill="#38bdf8" font-size="10" font-weight="600">+ Add Feeder / Starter</text>
          </g>
        `);
      }
    });

    // Ghost "+ Add Column" button on right
    const ghostX = padLeft + cols.length * colSpacing + 12;
    parts.push(`
      <g class="clickable" data-action="add-column">
        <rect x="${ghostX}" y="120" width="108" height="130" rx="8" fill="rgba(30,41,59,0.45)" stroke="#334155" stroke-width="1.5" stroke-dasharray="5 4" />
        <text x="${ghostX + 54}" y="178" text-anchor="middle" fill="#38bdf8" font-size="22" font-weight="600">+</text>
        <text x="${ghostX + 54}" y="200" text-anchor="middle" fill="#cbd5e1" font-size="11" font-weight="600">Add Column</text>
      </g>
    `);

    parts.push('</svg>');
    return parts.join('\n');
  }

  function renderDeviceSymbol(x, y, category, isInterconn, active) {
    const c = isInterconn ? (active ? '#f97316' : '#a855f7') : active ? '#38bdf8' : '#64748b';
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
        <circle cx="${x + 12}" cy="${y}" r="11" fill="#0f172a" stroke="${c}" stroke-width="1.8" />
        <text x="${x + 12}" y="${y + 3.5}" text-anchor="middle" fill="${c}" font-size="8.5" font-weight="700" font-family="Inter, sans-serif">${code}</text>
      `;
    }
    if (isInterconn) {
      return `
        <rect x="${x + 1}" y="${y - 10}" width="22" height="20" rx="3" fill="#0f172a" stroke="${c}" stroke-width="1.8" />
        <text x="${x + 12}" y="${y + 3.5}" text-anchor="middle" fill="${c}" font-size="8.5" font-weight="700">IC</text>
      `;
    }
    // Standard breaker / fuse-switch symbol
    return `
      <rect x="${x + 2}" y="${y - 9}" width="20" height="18" rx="2" fill="#0f172a" stroke="${c}" stroke-width="1.6" />
      <line x1="${x + 6}" y1="${y - 4}" x2="${x + 18}" y2="${y + 4}" stroke="${c}" stroke-width="1.6" />
    `;
  }

  function truncate(s, max) {
    if (!s) return '';
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  return { renderSLD, heatColor };
})();
