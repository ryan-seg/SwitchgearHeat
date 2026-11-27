/**
 * Main Application Controller
 * Features:
 * - Interactive SLD & GA with smooth vector Zoom (40%–250%), Fit, Ctrl+Wheel & Pan
 * - Pointer-based Drag-and-Drop to move/reorder tiers across columns & reorder columns
 * - Spare Spaces & Placeholders + One-click removal + Undo stack (Ctrl+Z)
 * - Rich Hover Help Tooltips (SGHelp) on every single entry label
 * - Click-to-Analyse Step-by-Step Calculation Breakdowns (SGExplain) on every calculated figure
 */

(function () {
  'use strict';

  const APP_VERSION = '2.6.0';

  function loadInitialProject() {
    try {
      const hash = window.location.hash || '';
      if (hash.startsWith('#data=')) {
        const b64 = decodeURIComponent(hash.slice(6));
        const json = decodeURIComponent(escape(atob(b64)));
        const parsed = JSON.parse(json);
        if (parsed && parsed.columns && parsed.mainBusbar && parsed.config) {
          parsed.deviceLibrary = window.SGState.syncLibraryWithDefaults(parsed.deviceLibrary);
          window.SGState.ensureExtras(parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not decode shared URL state:', e);
    }
    return window.SGState.ensureExtras(window.SGState.loadProject());
  }

  let project = loadInitialProject();
  let selection = { type: 'mainBusbar' };
  let activeTab = 'sld';
  let gaOptions = { showHeatmap: true, showDimensions: true, showBusbars: true };
  let lastEvalRes = null;
  let libFilterCategory = 'ALL';
  let libSearchQuery = '';

  // Zoom state per diagram
  let sldZoom = 1.0;
  let gaZoom = 1.0;

  // Undo history stack (stores JSON snapshots)
  const undoStack = [];
  const MAX_UNDO = 40;

  function pushUndo() {
    undoStack.push(JSON.stringify(project));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    updateUndoBtn();
  }

  function performUndo() {
    if (undoStack.length === 0) return;
    try {
      project = JSON.parse(undoStack.pop());
      selection = { type: 'mainBusbar' };
      updateUndoBtn();
      renderAll();
    } catch (e) {
      console.warn('Undo failed:', e);
    }
  }

  function updateUndoBtn() {
    const btn = document.getElementById('btn-undo');
    if (btn) {
      btn.disabled = undoStack.length === 0;
      btn.textContent = undoStack.length > 0 ? `↶ Undo (${undoStack.length})` : '↶ Undo';
    }
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Helper to create hover-documented labels effortlessly
  function lbl(text, helpKey) {
    if (!helpKey) return `<label>${esc(text)}</label>`;
    return `<label class="help-label" data-help="${esc(helpKey)}" tabindex="0">${esc(text)}</label>`;
  }

  function openExplain(key, ctx) {
    if (!lastEvalRes || !window.SGExplain) return;
    window.SGExplain.openModal(key, ctx || {}, project, lastEvalRes, (applyFn) => {
      pushUndo();
      if (typeof applyFn === 'function') applyFn();
      renderAll();
      return lastEvalRes;
    });
  }

  function renderAll(skipInspectorRebuild) {
    window.SGState.ensureExtras(project);
    window.SGState.saveProject(project);
    const allScenarios = window.SGPhysics.evaluateAllScenarios(project);
    const activeScObj = allScenarios.find((s) => s.id === project.activeScenario) || allScenarios[0];
    const evalRes = activeScObj.result;
    lastEvalRes = evalRes;

    const isSimple = project.uiMode === 'simple';
    const simpleWs = document.getElementById('simple-workspace');
    const detailedWs = document.getElementById('detailed-workspace');
    const summaryStrip = document.querySelector('.summary-strip');
    const btnSimple = document.getElementById('mode-btn-simple');
    const btnDetailed = document.getElementById('mode-btn-detailed');

    if (btnSimple && btnDetailed) {
      btnSimple.classList.toggle('active', isSimple);
      btnDetailed.classList.toggle('active', !isSimple);
    }
    if (simpleWs && detailedWs) {
      simpleWs.style.display = isSimple ? 'block' : 'none';
      detailedWs.style.display = isSimple ? 'none' : 'flex';
    }
    if (summaryStrip) {
      summaryStrip.style.display = isSimple ? 'none' : 'flex';
    }

    if (isSimple) {
      renderSimpleWorkspace();
      updateUndoBtn();
      return;
    }

    renderScenarioBar(allScenarios);
    renderKPIs(evalRes);
    renderSLDView(evalRes);
    renderGAView(evalRes);
    if (activeTab === 'schedules') renderSchedulesView(evalRes, allScenarios);
    if (activeTab === 'library') renderLibraryView();
    if (activeTab === 'config') renderConfigView();
    if (activeTab === 'room') renderRoomView(evalRes);
    if (activeTab === 'report') renderReportBuilderView(evalRes, allScenarios);
    if (!skipInspectorRebuild) renderInspector(evalRes);
    updateUndoBtn();
  }

  // --- Scenario Pills ---
  function renderScenarioBar(allScenarios) {
    const bar = document.getElementById('scenario-bar');
    bar.innerHTML =
      `<span class="scenario-label">Scenario:</span>` +
      allScenarios
        .map((sc) => {
          const isActive = sc.id === project.activeScenario;
          return `
            <button class="scenario-pill ${isActive ? 'active' : ''}" data-scenario="${sc.id}" title="${esc(sc.subtitle)}">
              <span>${esc(sc.label)}</span>
              <span class="sc-kw">${sc.result.totals.grandTotalKW.toFixed(2)} kW</span>
            </button>
          `;
        })
        .join('') +
      `<span class="toolbar-hint" style="margin-left:auto;">Hover any <b>label ?</b> for plain-English help · Drag components to move · Click any calculated value to analyse.</span>`;

    bar.querySelectorAll('.scenario-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        project.activeScenario = btn.dataset.scenario;
        renderAll();
      });
    });
  }

  // --- KPI Cards ---
  function renderKPIs(evalRes) {
    const t = evalRes.totals;
    const totalW = Math.max(0.001, t.grandTotalW);
    const busPct = ((t.totalBusbarW / totalW) * 100).toFixed(0);
    const devPct = ((t.totalDevicesW / totalW) * 100).toFixed(0);

    const grid = document.getElementById('kpi-grid');
    grid.innerHTML = `
      <div class="kpi-card hero explainable" data-explain="kpi.grandTotal" title="Click to inspect full kW heat loss breakdown">
        <span class="kpi-explain-cue">Analyse ↗</span>
        <span class="kpi-label">Total Switchgear Heat Loss</span>
        <span class="kpi-value">${t.grandTotalKW.toFixed(3)} kW</span>
        <span class="kpi-sub">${t.grandTotalW.toFixed(0)} W · ${Math.round(t.btuPerHr).toLocaleString()} BTU/hr</span>
      </div>
      <div class="kpi-card explainable" data-explain="kpi.busbars" title="Click to inspect busbar & joint I²R_AC breakdown">
        <span class="kpi-explain-cue">Analyse ↗</span>
        <span class="kpi-label">Busbar &amp; Joint Losses</span>
        <span class="kpi-value">${(t.totalBusbarW / 1000).toFixed(3)} kW</span>
        <span class="kpi-sub">${t.totalBusbarW.toFixed(0)} W (${busPct}%) · HBB ${t.totalHbbLossW.toFixed(0)}W / VBB ${t.totalVbbLossW.toFixed(0)}W</span>
      </div>
      <div class="kpi-card explainable" data-explain="kpi.devices" title="Click to inspect IEC TR 60890 device & starter loss breakdown">
        <span class="kpi-explain-cue">Analyse ↗</span>
        <span class="kpi-label">Devices &amp; Starters</span>
        <span class="kpi-value">${(t.totalDevicesW / 1000).toFixed(3)} kW</span>
        <span class="kpi-sub">${t.totalDevicesW.toFixed(0)} W (${devPct}%) · Starters/VSD ${t.totalStarterDevicesW.toFixed(0)}W</span>
      </div>
      <div class="kpi-card explainable" data-explain="kpi.incomer" title="Click to inspect incomer load summation & peak W/m">
        <span class="kpi-explain-cue">Analyse ↗</span>
        <span class="kpi-label">Incomer Load / Peak W/m</span>
        <span class="kpi-value">${Math.round(t.totalIncomerCurrentA)} A</span>
        <span class="kpi-sub">Max HBB: ${t.maxHbbWPerM.toFixed(1)} W/m · Max VBB: ${t.maxVbbWPerM.toFixed(1)} W/m</span>
      </div>
      <div class="kpi-card explainable" data-explain="kpi.hvac" title="Click to inspect HVAC cooling margin & IEC 60890 surface flux">
        <span class="kpi-explain-cue">Analyse ↗</span>
        <span class="kpi-label">HVAC Cooling (+${project.config.hvacSafetyMarginPct}%)</span>
        <span class="kpi-value">${t.recommendedCoolingKW.toFixed(2)} kW</span>
        <span class="kpi-sub">Flux: ${t.heatFluxWPerM2.toFixed(0)} W/m² (Ae ${t.effectiveAreaM2.toFixed(1)} m²)</span>
      </div>
    `;

    grid.querySelectorAll('[data-explain]').forEach((card) => {
      card.addEventListener('click', () => openExplain(card.dataset.explain));
    });
  }

  // --- Zoom Helpers ---
  function setZoom(which, newZoom) {
    const clamped = Math.min(2.5, Math.max(0.4, Math.round(newZoom * 20) / 20));
    if (which === 'sld') {
      sldZoom = clamped;
      document.getElementById('sld-zoom-pct').textContent = Math.round(sldZoom * 100) + '%';
      applySvgZoom('sld-svg', sldZoom);
    } else {
      gaZoom = clamped;
      document.getElementById('ga-zoom-pct').textContent = Math.round(gaZoom * 100) + '%';
      applySvgZoom('ga-svg', gaZoom);
    }
  }

  function applySvgZoom(svgId, z) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const bw = Number(svg.dataset.baseWidth) || 960;
    const bh = Number(svg.dataset.baseHeight) || 560;
    svg.setAttribute('width', Math.round(bw * z));
    svg.setAttribute('height', Math.round(bh * z));
  }

  function fitZoom(which) {
    const container = document.getElementById(which === 'sld' ? 'sld-container' : 'ga-container');
    const svg = document.getElementById(which === 'sld' ? 'sld-svg' : 'ga-svg');
    if (!container || !svg) return;
    const bw = Number(svg.dataset.baseWidth) || 960;
    const bh = Number(svg.dataset.baseHeight) || 560;
    const availW = Math.max(300, container.clientWidth - 28);
    const availH = Math.max(250, container.clientHeight - 28);
    const z = Math.min(availW / bw, availH / bh, 1.5);
    setZoom(which, z);
  }

  // --- SLD & GA Views ---
  function renderSLDView(evalRes) {
    const container = document.getElementById('sld-container');
    container.innerHTML = window.SGSLD.renderSLD(project, evalRes, selection, sldZoom);
    document.getElementById('sld-zoom-pct').textContent = Math.round(sldZoom * 100) + '%';
    bindDiagramEvents(container);
  }

  function renderGAView(evalRes) {
    const container = document.getElementById('ga-container');
    container.innerHTML = window.SGGA.renderGA(project, evalRes, selection, gaOptions, gaZoom);
    document.getElementById('ga-zoom-pct').textContent = Math.round(gaZoom * 100) + '%';
    bindDiagramEvents(container);
  }

  // --- Floating Drag Ghost & Drop Line ---
  let dragGhostEl = null;
  let dropLineEl = null;

  function ensureDragOverlays() {
    if (!dragGhostEl) {
      dragGhostEl = document.createElement('div');
      dragGhostEl.className = 'drag-ghost';
      document.body.appendChild(dragGhostEl);
    }
    if (!dropLineEl) {
      dropLineEl = document.createElement('div');
      dropLineEl.className = 'drop-insert-line';
      document.body.appendChild(dropLineEl);
    }
  }

  function bindDiagramEvents(container) {
    ensureDragOverlays();

    // 1. One-click Quick Delete buttons (stop propagation so they don't select or drag)
    container.querySelectorAll('[data-quick-del-tier]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const [cIdx, tIdx] = el.dataset.quickDelTier.split(':').map(Number);
        const col = project.columns[cIdx];
        if (!col || !col.tiers[tIdx]) return;
        pushUndo();
        col.tiers.splice(tIdx, 1);
        selection = { type: 'column', colIndex: cIdx };
        renderAll();
      });
    });

    container.querySelectorAll('[data-quick-del-col]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const cIdx = Number(el.dataset.quickDelCol);
        if (project.columns.length <= 1) return;
        pushUndo();
        project.columns.splice(cIdx, 1);
        selection = { type: 'mainBusbar' };
        renderAll();
      });
    });

    // 2. Quick-Add Actions
    container.querySelectorAll('[data-action="add-tier"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        addTierToColumn(Number(el.dataset.colIndex), 'dol-22kw');
      });
    });

    container.querySelectorAll('[data-action="add-spare"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        addTierToColumn(Number(el.dataset.colIndex), 'spare-space');
      });
    });

    container.querySelectorAll('[data-action="add-column"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        addNewColumn('feeders');
      });
    });

    // 3. Pointer Drag-and-Drop (Tiers & Columns) + Click-to-Select + Canvas Pan
    container.onpointerdown = (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('[data-quick-del-tier], [data-quick-del-col], [data-action]')) return;

      const dragTierEl = e.target.closest('[data-drag-tier]');
      const dragColEl = !dragTierEl ? e.target.closest('[data-drag-col]') : null;
      const selectEl = e.target.closest('[data-select-type]');

      // Background Pan
      if (!dragTierEl && !dragColEl && !selectEl) {
        const startX = e.clientX;
        const startY = e.clientY;
        const startScrollL = container.scrollLeft;
        const startScrollT = container.scrollTop;
        container.classList.add('panning');

        const onMovePan = (me) => {
          container.scrollLeft = startScrollL - (me.clientX - startX);
          container.scrollTop = startScrollT - (me.clientY - startY);
        };
        const onUpPan = () => {
          container.classList.remove('panning');
          window.removeEventListener('pointermove', onMovePan);
          window.removeEventListener('pointerup', onUpPan);
        };
        window.addEventListener('pointermove', onMovePan);
        window.addEventListener('pointerup', onUpPan);
        return;
      }

      // Click-only non-draggable elements (e.g. Main Busbar)
      if (!dragTierEl && !dragColEl) {
        if (selectEl) handleSelectElement(selectEl);
        return;
      }

      // Draggable Tier or Column (prevent native text selection so click-hold-drag is rock-solid)
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      let isDragging = false;
      let dropTarget = null;
      const sourceDragEl = dragTierEl || dragColEl;

      let dragInfo = null;
      if (dragTierEl) {
        const [cIdx, tIdx] = dragTierEl.dataset.dragTier.split(':').map(Number);
        const tierObj = project.columns[cIdx] && project.columns[cIdx].tiers[tIdx];
        if (!tierObj) return;
        dragInfo = { kind: 'tier', fromCol: cIdx, fromTier: tIdx, label: `Moving ${tierObj.tag} (${tierObj.category})` };
      } else if (dragColEl) {
        const cIdx = Number(dragColEl.dataset.dragCol);
        const colObj = project.columns[cIdx];
        if (!colObj) return;
        dragInfo = { kind: 'column', fromCol: cIdx, label: `Moving Column: ${colObj.name}` };
      }

      const clearHighlights = () => {
        container.querySelectorAll('.drop-hover').forEach((n) => n.classList.remove('drop-hover'));
        dropLineEl.classList.remove('active', 'vertical');
        dropLineEl.style.height = '';
        dropLineEl.style.width = '';
      };

      const onMove = (me) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        if (!isDragging && Math.hypot(dx, dy) > 5) {
          isDragging = true;
          dragGhostEl.textContent = dragInfo.label;
          dragGhostEl.classList.add('active');
          if (sourceDragEl) sourceDragEl.style.opacity = '0.45';
        }
        if (!isDragging) return;

        dragGhostEl.style.left = `${me.clientX}px`;
        dragGhostEl.style.top = `${me.clientY}px`;
        clearHighlights();

        const under = document.elementFromPoint(me.clientX, me.clientY);
        if (!under) {
          dropTarget = null;
          return;
        }

        const tierHit = under.closest('[data-drop-tier]');
        const colZoneHit = under.closest('[data-drop-col]');
        if (!tierHit && !colZoneHit) {
          dropTarget = null;
          return;
        }

        const targetColIdx = tierHit
          ? Number(tierHit.dataset.dropTier.split(':')[0])
          : Number(colZoneHit.dataset.dropCol);
        const colZone = container.querySelector(`[data-drop-col="${targetColIdx}"]`);
        if (colZone) colZone.classList.add('drop-hover');

        if (dragInfo.kind === 'column') {
          dropTarget = { kind: 'column', toCol: targetColIdx };
          if (colZone) {
            const cr = colZone.getBoundingClientRect();
            const isRight = targetColIdx > dragInfo.fromCol;
            dropLineEl.classList.add('active', 'vertical');
            dropLineEl.style.left = `${Math.round(isRight ? cr.right - 2 : cr.left - 2)}px`;
            dropLineEl.style.top = `${Math.round(cr.top)}px`;
            dropLineEl.style.height = `${Math.round(cr.height)}px`;
            dropLineEl.style.width = '4px';
          }
        } else if (tierHit) {
          const [tc, tt] = tierHit.dataset.dropTier.split(':').map(Number);
          const r = tierHit.getBoundingClientRect();
          const insertAfter = me.clientY > r.top + r.height / 2;
          dropTarget = { kind: 'tier', toCol: tc, toIndex: insertAfter ? tt + 1 : tt };
          dropLineEl.style.left = `${Math.round(r.left)}px`;
          dropLineEl.style.width = `${Math.round(r.width)}px`;
          dropLineEl.style.height = '3px';
          dropLineEl.style.top = `${Math.round(insertAfter ? r.bottom + 2 : r.top - 2)}px`;
          dropLineEl.classList.add('active');
        } else {
          const targetCol = project.columns[targetColIdx];
          dropTarget = { kind: 'tier', toCol: targetColIdx, toIndex: targetCol ? targetCol.tiers.length : 0 };
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        dragGhostEl.classList.remove('active');
        if (sourceDragEl) sourceDragEl.style.opacity = '';
        clearHighlights();

        if (!isDragging) {
          if (selectEl) handleSelectElement(selectEl);
          return;
        }

        if (!dropTarget) return;

        if (dragInfo.kind === 'column' && dropTarget.kind === 'column') {
          if (dragInfo.fromCol !== dropTarget.toCol) {
            pushUndo();
            const [movedCol] = project.columns.splice(dragInfo.fromCol, 1);
            project.columns.splice(dropTarget.toCol, 0, movedCol);
            selection = { type: 'column', colIndex: dropTarget.toCol };
            renderAll();
          }
        } else if (dragInfo.kind === 'tier' && dropTarget.kind === 'tier') {
          const srcCol = project.columns[dragInfo.fromCol];
          const dstCol = project.columns[dropTarget.toCol];
          if (!srcCol || !dstCol) return;

          let insertIdx = dropTarget.toIndex;
          if (dragInfo.fromCol === dropTarget.toCol) {
            if (insertIdx === dragInfo.fromTier || insertIdx === dragInfo.fromTier + 1) return;
            if (insertIdx > dragInfo.fromTier) insertIdx -= 1;
          }

          pushUndo();
          const [movedTier] = srcCol.tiers.splice(dragInfo.fromTier, 1);
          // Ensure destination column has a vertical busbar spec if it didn't have one
          if (!dstCol.verticalBusbar && (movedTier.role === 'feeder' || movedTier.role === 'interconnector')) {
            dstCol.verticalBusbar = JSON.parse(JSON.stringify(project.defaultVerticalBusbar));
          }
          dstCol.tiers.splice(insertIdx, 0, movedTier);
          selection = { type: 'tier', colIndex: dropTarget.toCol, tierIndex: insertIdx };
          renderAll();
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
  }

  function handleSelectElement(el) {
    const type = el.dataset.selectType;
    if (type === 'mainBusbar') {
      selection = { type: 'mainBusbar' };
    } else if (type === 'column') {
      selection = { type: 'column', colIndex: Number(el.dataset.colIndex) };
    } else if (type === 'tier') {
      selection = {
        type: 'tier',
        colIndex: Number(el.dataset.colIndex),
        tierIndex: Number(el.dataset.tierIndex),
      };
    }
    renderAll();
  }

  function addTierToColumn(colIndex, templateId) {
    const col = project.columns[colIndex];
    if (!col) return;
    pushUndo();
    const nextNum = col.tiers.length + 1;
    const isSpare = templateId === 'spare-space';
    const isPlaceholder = templateId === 'placeholder-bay';
    const isAux = templateId === 'aux-chamber';
    const defaultTag = isSpare
      ? `SP-${colIndex + 1}0${nextNum}`
      : isPlaceholder
      ? `PH-${colIndex + 1}0${nextNum}`
      : isAux
      ? `AUX-${colIndex + 1}0${nextNum}`
      : `F-${colIndex + 1}0${nextNum}`;
    const newTier = window.SGState.makeTierFromTemplate(
      templateId || 'mccb-250',
      { tag: defaultTag },
      project.deviceLibrary
    );
    col.tiers.push(newTier);
    selection = { type: 'tier', colIndex, tierIndex: col.tiers.length - 1 };
    renderAll();
  }

  function addNewColumn(kind) {
    pushUndo();
    const num = project.columns.length + 1;
    const titleSuffix =
      kind === 'incomer'
        ? 'Incomer'
        : kind === 'coupler'
        ? 'Bus Coupler'
        : kind === 'interconnector'
        ? 'Interconnector'
        : kind === 'spare'
        ? 'Spare / Future Bay'
        : 'MCC / Feeders';

    const col = {
      id: window.SGState.uid('col'),
      name: `COL-0${num} ${titleSuffix}`,
      widthMm: kind === 'spare' ? 600 : 800,
      verticalBusbar: kind === 'incomer' || kind === 'coupler' ? null : JSON.parse(JSON.stringify(project.defaultVerticalBusbar)),
      tiers: [],
    };
    if (kind === 'incomer') {
      col.tiers.push(window.SGState.makeTierFromTemplate('acb-2500', { tag: `INC-${num}`, role: 'incomer' }, project.deviceLibrary));
    } else if (kind === 'coupler') {
      col.tiers.push(window.SGState.makeTierFromTemplate('coupler-2500', { tag: `BC-${num}`, role: 'bus_coupler', couplerState: 'open' }, project.deviceLibrary));
    } else if (kind === 'interconnector') {
      col.tiers.push(window.SGState.makeTierFromTemplate('interconn-1600', { tag: `IC-${num}`, role: 'interconnector' }, project.deviceLibrary));
    } else if (kind === 'spare') {
      col.tiers.push(window.SGState.makeTierFromTemplate('spare-space', { tag: `SP-${num}01`, heightMm: 500 }, project.deviceLibrary));
      col.tiers.push(window.SGState.makeTierFromTemplate('placeholder-bay', { tag: `PH-${num}02`, heightMm: 500 }, project.deviceLibrary));
    } else {
      col.tiers.push(window.SGState.makeTierFromTemplate('dol-22kw', { tag: `M-${num}01` }, project.deviceLibrary));
      col.tiers.push(window.SGState.makeTierFromTemplate('mccb-250', { tag: `F-${num}02`, operatingCurrentA: 150 }, project.deviceLibrary));
    }
    project.columns.push(col);
    selection = { type: 'column', colIndex: project.columns.length - 1 };
    renderAll();
  }

  // --- Right Context Inspector ---
  function renderInspector(evalRes) {
    const titleEl = document.getElementById('inspector-title');
    const badgeEl = document.getElementById('inspector-badge');
    const bodyEl = document.getElementById('inspector-body');

    if (selection.type === 'mainBusbar') {
      titleEl.textContent = 'Main Horizontal Busbar';
      badgeEl.textContent = 'HBB Physics';
      renderBusbarInspector(bodyEl, project.mainBusbar, evalRes.hbbRes, evalRes.hbbRatedWPerM, true, -1);
    } else if (selection.type === 'column') {
      const col = project.columns[selection.colIndex];
      const cr = evalRes.columns[selection.colIndex];
      if (!col || !cr) {
        selection = { type: 'mainBusbar' };
        return renderInspector(evalRes);
      }
      titleEl.textContent = col.name;
      badgeEl.textContent = `Column ${selection.colIndex + 1}`;
      renderColumnInspector(bodyEl, col, cr, selection.colIndex);
    } else if (selection.type === 'tier') {
      const col = project.columns[selection.colIndex];
      const cr = evalRes.columns[selection.colIndex];
      const tier = col && col.tiers[selection.tierIndex];
      const tr = cr && cr.tiers[selection.tierIndex];
      if (!tier || !tr) {
        selection = { type: 'mainBusbar' };
        return renderInspector(evalRes);
      }
      titleEl.textContent = `${tier.tag} — ${tier.category}`;
      badgeEl.textContent = tier.role.toUpperCase();
      renderTierInspector(bodyEl, col, tier, tr, selection.colIndex, selection.tierIndex);
    }
  }

  function renderBusbarInspector(container, bb, busRes, ratedWPerM, isMain, colIdx) {
    const presets = window.SGCatalog.BUSBAR_PRESETS;
    const matOpts = Object.values(window.SGPhysics.MATERIALS);

    container.innerHTML = `
      <div class="insp-section">
        <div class="insp-section-title">${isMain ? 'Main HBB' : 'Vertical Dropper'} Preset &amp; Type 439 Certificate</div>
        <div class="field">
          ${lbl('Quick Preset (Standard Construction)', 'bb.preset')}
          <select id="bb-preset">
            <option value="">— Custom Construction —</option>
            ${presets.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
          </select>
          <span class="field-hint">Ex: 1600A = 2×75×6mm (900mm²), 2500A = 2×100×10mm</span>
        </div>
        <div class="field">
          ${lbl('Type 439 / IEC 61439 Certificate Ref', 'bb.cert')}
          <input type="text" id="bb-cert" value="${esc(bb.certRef || '')}" placeholder="e.g. BS EN 60439-1 Cert #12345" />
          <span class="field-hint">Ex: BS EN 60439-1 Type 439 Cert — 2×75×6mm Cu</span>
        </div>
        <div class="form-grid">
          <div class="field">
            ${lbl('Rated Current In (A)', 'bb.rated')}
            <input type="number" id="bb-rated" value="${bb.ratedCurrentA}" min="100" step="50" placeholder="1600" />
            <span class="field-hint">Typ: 630–4000 A (HBB) / 400–1600 A (VBB)</span>
          </div>
          <div class="field">
            ${lbl('Conductor Material', 'bb.material')}
            <select id="bb-mat">
              ${matOpts.map((m) => `<option value="${m.id}" ${bb.material === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select>
            <span class="field-hint">Typ: Cu 100% IACS (ρ=0.01724)</span>
          </div>
        </div>
      </div>

      <div class="insp-section">
        <div class="insp-section-title">Conductor Dimensions (Per Phase)</div>
        <div class="form-grid-3">
          <div class="field">
            ${lbl('Bars / Ph', 'bb.bars')}
            <input type="number" id="bb-bars" value="${bb.barsPerPhase}" min="1" max="8" step="1" placeholder="2" />
            <span class="field-hint">Typ: 1–4</span>
          </div>
          <div class="field">
            ${lbl('Width (mm)', 'bb.width')}
            <input type="number" id="bb-w" value="${bb.widthMm}" min="10" max="200" step="5" placeholder="75" />
            <span class="field-hint">Typ: 40–100</span>
          </div>
          <div class="field">
            ${lbl('Thick (mm)', 'bb.thickness')}
            <input type="number" id="bb-t" value="${bb.thicknessMm}" min="3" max="20" step="1" placeholder="6" />
            <span class="field-hint">Typ: 5,6,8,10</span>
          </div>
        </div>
        <div class="form-grid-3">
          <div class="field">
            ${lbl('Bar Gap', 'bb.gap')}
            <input type="number" id="bb-gap" value="${bb.gapMm || bb.thicknessMm}" min="2" max="30" placeholder="6" />
            <span class="field-hint">Typ: = thick</span>
          </div>
          <div class="field">
            ${lbl('Phase Ctr', 'bb.spacing')}
            <input type="number" id="bb-spacing" value="${bb.phaseSpacingMm || 120}" min="40" max="400" step="5" placeholder="120" />
            <span class="field-hint">Typ: 90–160</span>
          </div>
          <div class="field">
            ${lbl('Op Temp °C', 'bb.temp')}
            <input type="number" id="bb-temp" value="${bb.operatingTempC}" min="20" max="125" step="5" placeholder="70" />
            <span class="field-hint">Typ: 70–85°C</span>
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            ${lbl('Bar Orientation', 'bb.orient')}
            <select id="bb-orient">
              <option value="edge" ${bb.orientation !== 'flat' ? 'selected' : ''}>Edge-on (Standard)</option>
              <option value="flat" ${bb.orientation === 'flat' ? 'selected' : ''}>Flat-on</option>
            </select>
            <span class="field-hint">Edge-on gives lower prox &amp; better cooling</span>
          </div>
          <div class="field">
            ${lbl('Neutral Bar Sizing', 'bb.neutral')}
            <select id="bb-neutral">
              <option value="1" ${bb.neutralSizeRatio === 1 ? 'selected' : ''}>100% of Phase</option>
              <option value="0.5" ${bb.neutralSizeRatio === 0.5 ? 'selected' : ''}>50% of Phase</option>
              <option value="0" ${bb.neutralSizeRatio === 0 ? 'selected' : ''}>No Neutral (3P)</option>
            </select>
            <span class="field-hint">Typ: 50% (motors) or 100% (harmonics)</span>
          </div>
        </div>
      </div>

      <div class="insp-section">
        <div class="insp-section-title">DC → AC Conversion (Skin &amp; Proximity)</div>
        <div class="form-grid">
          <div class="field">
            ${lbl('AC Factor Method', 'bb.acmode')}
            <select id="bb-acmode">
              <option value="manual" ${bb.acFactorMode !== 'calculated' ? 'selected' : ''}>Manual Factor (S)</option>
              <option value="calculated" ${bb.acFactorMode === 'calculated' ? 'selected' : ''}>Calculated Skin/Prox</option>
            </select>
            <span class="field-hint">Manual S or calculated skin/prox</span>
          </div>
          <div class="field">
            ${bb.acFactorMode === 'calculated' ? lbl('Enclosure Eddy (ye)', 'bb.ye') : lbl('Manual Factor S', 'bb.manualS')}
            ${
              bb.acFactorMode === 'calculated'
                ? `<input type="number" id="bb-ye" value="${bb.enclosureEddyFactor != null ? bb.enclosureEddyFactor : 0.02}" min="0" max="0.2" step="0.01" placeholder="0.02" />
                   <span class="field-hint">Typ: 0.02–0.05 (steel) / 0 (Al)</span>`
                : `<input type="number" id="bb-manual-s" value="${bb.manualSFactor || 1.2}" min="1.0" max="2.5" step="0.02" placeholder="1.20" />
                   <span class="field-hint">Typ: 1.05 (1-bar), 1.20 (2-bar), 1.40 (3-bar)</span>`
            }
          </div>
        </div>

        <div class="calc-readout explainable" id="bb-calc-readout" title="Click to inspect step-by-step DC→AC busbar derivation">
          <div class="calc-row"><span class="lbl">Cross-Section / Phase:</span><span class="val">${bb.barsPerPhase}×${bb.widthMm}×${bb.thicknessMm} = ${busRes.areaMm2} mm²</span></div>
          <div class="calc-row"><span class="lbl">R_DC (20°C):</span><span class="val">${busRes.rDc20_uOhmPerM.toFixed(2)} µΩ/m</span></div>
          <div class="calc-row"><span class="lbl">R_DC (${busRes.tempC}°C):</span><span class="val">${busRes.rDcT_uOhmPerM.toFixed(2)} µΩ/m</span></div>
          <div class="calc-row"><span class="lbl">Skin Depth δ (${project.config.frequencyHz}Hz):</span><span class="val">${busRes.skinDepthMm.toFixed(2)} mm</span></div>
          <div class="calc-row"><span class="lbl">Calc Skin/Prox/Eddy:</span><span class="val">ys=${busRes.ys.toFixed(3)} · yp=${busRes.yp.toFixed(3)} → ${busRes.kAcCalculated.toFixed(3)}</span></div>
          <div class="calc-row highlight"><span class="lbl">Active k_AC &amp; R_AC:</span><span class="val">×${busRes.kAcUsed.toFixed(3)} → ${busRes.rAcT_uOhmPerM.toFixed(2)} µΩ/m</span></div>
          <div class="calc-row highlight"><span class="lbl">Loss @ Rated ${bb.ratedCurrentA}A (3P):</span><span class="val">${ratedWPerM.toFixed(1)} W/m</span></div>
          <div class="calc-explain-footer"><span>Click to inspect worked steps &amp; commentary</span><span>Analyse ↗</span></div>
        </div>
      </div>
    `;

    document.getElementById('bb-calc-readout').addEventListener('click', () => {
      openExplain('busbar.physics', { scope: isMain ? 'main' : 'column', colIndex: colIdx });
    });

    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { pushUndo(); fn(el.value); renderAll(); });
    };

    bind('bb-preset', (val) => {
      const p = presets.find((x) => x.id === val);
      if (!p) return;
      bb.ratedCurrentA = p.ratedCurrentA;
      bb.material = p.material;
      bb.barsPerPhase = p.barsPerPhase;
      bb.widthMm = p.widthMm;
      bb.thicknessMm = p.thicknessMm;
      bb.gapMm = p.gapMm;
      bb.phaseSpacingMm = p.phaseSpacingMm;
      bb.certRef = p.certRef;
    });
    bind('bb-cert', (v) => (bb.certRef = v));
    bind('bb-rated', (v) => (bb.ratedCurrentA = Number(v) || 1000));
    bind('bb-mat', (v) => (bb.material = v));
    bind('bb-bars', (v) => (bb.barsPerPhase = Math.max(1, parseInt(v, 10) || 1)));
    bind('bb-w', (v) => (bb.widthMm = Math.max(10, Number(v) || 50)));
    bind('bb-t', (v) => (bb.thicknessMm = Math.max(3, Number(v) || 6)));
    bind('bb-gap', (v) => (bb.gapMm = Math.max(2, Number(v) || 6)));
    bind('bb-spacing', (v) => (bb.phaseSpacingMm = Math.max(30, Number(v) || 100)));
    bind('bb-temp', (v) => (bb.operatingTempC = Number(v) || 70));
    bind('bb-orient', (v) => (bb.orientation = v));
    bind('bb-neutral', (v) => (bb.neutralSizeRatio = Number(v)));
    bind('bb-acmode', (v) => (bb.acFactorMode = v));
    bind('bb-manual-s', (v) => (bb.manualSFactor = Math.max(1, Number(v) || 1.2)));
    bind('bb-ye', (v) => (bb.enclosureEddyFactor = Math.max(0, Number(v) || 0)));
  }

  function renderColumnInspector(container, col, cr, colIdx) {
    const vbb = col.verticalBusbar || project.defaultVerticalBusbar;
    const ratedVbbWPerM = window.SGPhysics.calcBusbarLossPerMetre(
      cr.vbbRes,
      vbb.ratedCurrentA,
      project.config.poles,
      project.config.neutralCurrentRatio
    ).wPerMTotal;

    container.innerHTML = `
      <div class="insp-section">
        <div class="insp-section-title">Cubicle / Column Geometry</div>
        <div class="field">
          ${lbl('Column Name', 'col.name')}
          <input type="text" id="col-name" value="${esc(col.name)}" placeholder="e.g. COL-02 MCC Tier 1" />
          <span class="field-hint">Ex: COL-01 Incomer, COL-02 MCC, COL-05 Interconnector</span>
        </div>
        <div class="form-grid">
          <div class="field">
            ${lbl('Cubicle Width (mm)', 'col.width')}
            <input type="number" id="col-width" value="${col.widthMm}" min="300" max="2000" step="50" placeholder="800" />
            <span class="field-hint">Typ: 600, 800, 1000 mm</span>
          </div>
          <div class="field">
            ${lbl('X Centreline (mm)', 'col.xcenter')}
            <input type="text" value="${Math.round(cr.xCenterMm)} mm" disabled />
            <span class="field-hint">Drives HBB segment spans</span>
          </div>
        </div>
        <div class="calc-readout explainable" id="col-calc-readout" title="Click to inspect column thermal breakdown">
          <div class="calc-row"><span class="lbl">Column Total Load:</span><span class="val">${cr.hasIncomer ? 'Incomer ' + cr.incomerSupplyA.toFixed(0) + ' A' : cr.colTotalLoadA.toFixed(1) + ' A'}</span></div>
          <div class="calc-row"><span class="lbl">Vertical Dropper Length:</span><span class="val">${cr.vbbTotalLengthM.toFixed(2)} m</span></div>
          <div class="calc-row"><span class="lbl">Vertical Busbar Loss:</span><span class="val">${cr.vbbTotalLossW.toFixed(1)} W (Peak ${cr.vbbMaxWPerM.toFixed(1)} W/m)</span></div>
          <div class="calc-row highlight"><span class="lbl">Column Total Heat:</span><span class="val">${cr.colTotalLossW.toFixed(1)} W</span></div>
          <div class="calc-explain-footer"><span>Click to analyse column heat breakdown</span><span>Analyse ↗</span></div>
        </div>
        <div class="action-row">
          <button id="col-move-left" class="btn btn-sm btn-secondary" ${colIdx === 0 ? 'disabled' : ''}>← Move Left</button>
          <button id="col-move-right" class="btn btn-sm btn-secondary" ${colIdx === project.columns.length - 1 ? 'disabled' : ''}>Move Right →</button>
          <button id="col-delete" class="btn btn-sm btn-danger" ${project.columns.length <= 1 ? 'disabled' : ''}>Delete Column</button>
        </div>
      </div>

      <div class="insp-section">
        <div class="insp-section-title">Add Compartment / Spare / Placeholder</div>
        <div class="field">
          ${lbl('Select Device / Starter / Spare Template', 'tier.template')}
          <select id="col-add-tpl">
            ${project.deviceLibrary.map((t) => `<option value="${t.id}">[${esc(t.category)}] ${esc(t.name)}</option>`).join('')}
          </select>
          <span class="field-hint">Pick a starter, breaker, spare space, or placeholder bay</span>
        </div>
        <div class="action-row">
          <button id="col-add-tier-btn" class="btn btn-sm btn-primary">+ Add Selected</button>
          <button id="col-add-spare-btn" class="btn btn-sm btn-secondary">+ Spare Space</button>
          <button id="col-add-ph-btn" class="btn btn-sm btn-secondary">+ Placeholder</button>
        </div>
      </div>

      <div id="col-vbb-slot"></div>
    `;

    document.getElementById('col-calc-readout').addEventListener('click', () => {
      openExplain('column.total', { colIndex: colIdx });
    });

    if (!col.verticalBusbar) {
      col.verticalBusbar = JSON.parse(JSON.stringify(project.defaultVerticalBusbar));
    }
    const vbbSlot = document.getElementById('col-vbb-slot');
    renderBusbarInspector(vbbSlot, col.verticalBusbar, cr.vbbRes, ratedVbbWPerM, false, colIdx);

    document.getElementById('col-name').addEventListener('change', (e) => {
      pushUndo();
      col.name = e.target.value;
      renderAll();
    });
    document.getElementById('col-width').addEventListener('change', (e) => {
      pushUndo();
      col.widthMm = Math.max(300, Number(e.target.value) || 800);
      renderAll();
    });
    document.getElementById('col-move-left').addEventListener('click', () => {
      if (colIdx <= 0) return;
      pushUndo();
      const tmp = project.columns[colIdx - 1];
      project.columns[colIdx - 1] = project.columns[colIdx];
      project.columns[colIdx] = tmp;
      selection = { type: 'column', colIndex: colIdx - 1 };
      renderAll();
    });
    document.getElementById('col-move-right').addEventListener('click', () => {
      if (colIdx >= project.columns.length - 1) return;
      pushUndo();
      const tmp = project.columns[colIdx + 1];
      project.columns[colIdx + 1] = project.columns[colIdx];
      project.columns[colIdx] = tmp;
      selection = { type: 'column', colIndex: colIdx + 1 };
      renderAll();
    });
    document.getElementById('col-delete').addEventListener('click', () => {
      if (project.columns.length <= 1) return;
      pushUndo();
      project.columns.splice(colIdx, 1);
      selection = { type: 'mainBusbar' };
      renderAll();
    });
    document.getElementById('col-add-tier-btn').addEventListener('click', () => {
      addTierToColumn(colIdx, document.getElementById('col-add-tpl').value);
    });
    document.getElementById('col-add-spare-btn').addEventListener('click', () => addTierToColumn(colIdx, 'spare-space'));
    document.getElementById('col-add-ph-btn').addEventListener('click', () => addTierToColumn(colIdx, 'placeholder-bay'));
  }

  function renderTierInspector(container, col, tier, tr, colIdx, tierIdx) {
    const dl = tr.deviceLoss || { iOp: 0, iRated: tier.ratedCurrentA, loadRatio: 0, loadRatioSq: 0, pFixedW: 0, pVarW: 0, pTotalW: 0, breakdown: [] };
    const isInterconn = tier.role === 'interconnector';
    const isIncomer = tier.role === 'incomer';
    const isCoupler = tier.role === 'bus_coupler';
    const isFeeder = tier.role === 'feeder';
    const isSpacer = tier.role === 'spacer';

    container.innerHTML = `
      <div class="insp-section">
        <div class="insp-section-title">Compartment Identity &amp; GA Position</div>
        <div class="form-grid">
          <div class="field">
            ${lbl('Tag / Circuit ID', 'tier.tag')}
            <input type="text" id="t-tag" value="${esc(tier.tag)}" placeholder="e.g. M-101 or SP-01" />
            <span class="field-hint">Ex: INC-A, M-101, SP-01</span>
          </div>
          <div class="field">
            ${lbl('Status', 'tier.status')}
            <select id="t-status">
              <option value="active" ${tier.status === 'active' ? 'selected' : ''}>Active (Running)</option>
              <option value="future" ${tier.status === 'future' ? 'selected' : ''}>Future Capacity</option>
              <option value="standby" ${tier.status === 'standby' ? 'selected' : ''}>Standby / Off</option>
            </select>
            <span class="field-hint">Controls scenario activation</span>
          </div>
          <div class="field full">
            ${lbl('Description', 'tier.desc')}
            <input type="text" id="t-desc" value="${esc(tier.description)}" placeholder="e.g. Cooling Water Pump 1 — 55 kW DOL" />
            <span class="field-hint">Shown on schedules &amp; PDF report</span>
          </div>
          <div class="field">
            ${lbl('Role', 'tier.role')}
            <select id="t-role">
              <option value="feeder" ${isFeeder ? 'selected' : ''}>Outgoing Feeder / Starter</option>
              <option value="incomer" ${isIncomer ? 'selected' : ''}>Main Incomer</option>
              <option value="bus_coupler" ${isCoupler ? 'selected' : ''}>Bus-Section Coupler</option>
              <option value="interconnector" ${isInterconn ? 'selected' : ''}>Interconnector (Firm Supply)</option>
              <option value="spacer" ${isSpacer ? 'selected' : ''}>Spare Space / Placeholder</option>
            </select>
            <span class="field-hint">Electrical role on busbar</span>
          </div>
          <div class="field">
            ${lbl('Tier Height (mm)', 'tier.height')}
            <input type="number" id="t-height" value="${tier.heightMm}" min="120" max="1600" step="20" placeholder="300" />
            <span class="field-hint">Typ: 200–350 DOL, 600 VSD</span>
          </div>
        </div>
        <div class="field">
          ${lbl(isSpacer ? 'Convert Spare/Placeholder to Equipment' : 'Apply Device / Starter Template', 'tier.template')}
          <select id="t-template">
            <option value="">— Keep Custom Settings —</option>
            ${project.deviceLibrary.map((t) => `<option value="${t.id}" ${tier.templateId === t.id ? 'selected' : ''}>[${esc(t.category)}] ${esc(t.name)}</option>`).join('')}
          </select>
          <span class="field-hint">Auto-fills typical rated In, Pn (W), fixed W &amp; height</span>
        </div>
        <div class="action-row">
          <button id="t-up" class="btn btn-sm btn-secondary" ${tierIdx === 0 ? 'disabled' : ''}>↑ Up</button>
          <button id="t-down" class="btn btn-sm btn-secondary" ${tierIdx === col.tiers.length - 1 ? 'disabled' : ''}>↓ Down</button>
          <button id="t-dup" class="btn btn-sm btn-secondary">Duplicate</button>
          <button id="t-del" class="btn btn-sm btn-danger">Delete</button>
        </div>
      </div>

      ${
        isSpacer
          ? `<div class="insp-section">
              <div class="insp-section-title">Spare Space / Placeholder Properties</div>
              <div class="field">
                ${lbl('Fixed Auxiliary Heat (W) — Optional', 'tier.pfix')}
                <input type="number" id="t-pfix" value="${tier.fixedLossW || 0}" min="0" step="5" placeholder="0" />
                <span class="field-hint">0 W for blank spare/placeholder; 10–25 W for metering/control chamber</span>
              </div>
              <div class="toolbar-hint">This bay occupies ${tier.heightMm} mm of physical vertical space on the GA so lower compartments maintain accurate busbar dropper lengths. You can drag it anywhere or convert it using the template dropdown above.</div>
            </div>`
          : ''
      }

      ${
        isIncomer
          ? `<div class="insp-section">
              <div class="insp-section-title">Incomer Switching State</div>
              <div class="field">
                ${lbl('Breaker Position', 'tier.incState')}
                <select id="t-inc-state">
                  <option value="closed" ${tier.incomerState !== 'open' ? 'selected' : ''}>CLOSED (Energized / Supplying Bus)</option>
                  <option value="open" ${tier.incomerState === 'open' ? 'selected' : ''}>OPEN (Isolated / Out of Service)</option>
                </select>
                <span class="field-hint">Typ: CLOSED normal; OPEN to simulate Tx outage</span>
              </div>
            </div>`
          : ''
      }

      ${
        isCoupler
          ? `<div class="insp-section">
              <div class="insp-section-title">Bus-Section Coupler State</div>
              <div class="field">
                ${lbl('Coupler Position', 'tier.couplerState')}
                <select id="t-coupler-state">
                  <option value="open" ${tier.couplerState !== 'closed' ? 'selected' : ''}>OPEN (Split Bus Sections)</option>
                  <option value="closed" ${tier.couplerState === 'closed' ? 'selected' : ''}>CLOSED (Coupled / Parallel or Single Incomer)</option>
                </select>
                <span class="field-hint">OPEN under normal dual-Tx; CLOSED for N-1 feed</span>
              </div>
            </div>`
          : ''
      }

      ${
        isInterconn
          ? `<div class="insp-section">
              <div class="insp-section-title">Firm Supply Interconnector (A → B Side)</div>
              <div class="field">
                ${lbl('Remote Switchboard Name', 'tier.remoteBoard')}
                <input type="text" id="t-remote-board" value="${esc(tier.remoteBoardName || 'MSB-B (Firm Supply)')}" placeholder="e.g. MSB-B (Firm Supply)" />
                <span class="field-hint">Ex: MSB-B, Switchboard B-Side</span>
              </div>
              <div class="form-grid">
                <div class="field">
                  ${lbl('Normal Transfer (A)', 'tier.normTransfer')}
                  <input type="number" id="t-norm-a" value="${tier.normalTransferCurrentA || 0}" min="0" step="10" placeholder="0" />
                  <span class="field-hint">Typ: 0 A when A &amp; B split</span>
                </div>
                <div class="field">
                  ${lbl('N-1 Transfer Load (A)', 'tier.n1Transfer')}
                  <input type="number" id="t-n1-a" value="${tier.n1TransferCurrentA || 850}" min="0" step="10" placeholder="850" />
                  <span class="field-hint">Typ: 600–1600 A (B-side load)</span>
                </div>
              </div>
              <div class="insp-section-title" style="margin-top:6px;">Internal Interconnector Cable Entry Loss</div>
              <label class="toggle-chip"><input type="checkbox" id="t-cable-en" ${tier.cableSpec && tier.cableSpec.includeCableLoss ? 'checked' : ''} /> Include internal cable riser heat loss</label>
              <div class="form-grid-3">
                <div class="field">
                  ${lbl('Cables/Ph', 'tier.cableN')}
                  <input type="number" id="t-cable-n" value="${(tier.cableSpec && tier.cableSpec.cablesPerPhase) || 3}" min="1" max="8" placeholder="3" />
                  <span class="field-hint">Typ: 2–4×</span>
                </div>
                <div class="field">
                  ${lbl('CSA (mm²)', 'tier.cableCsa')}
                  <input type="number" id="t-cable-csa" value="${(tier.cableSpec && tier.cableSpec.csaMm2) || 240}" min="16" max="630" placeholder="240" />
                  <span class="field-hint">Typ: 185–300</span>
                </div>
                <div class="field">
                  ${lbl('Length (m)', 'tier.cableLen')}
                  <input type="number" id="t-cable-len" value="${(tier.cableSpec && tier.cableSpec.internalLengthM) || 2.5}" min="0" step="0.5" placeholder="2.5" />
                  <span class="field-hint">Typ: 1.5–3.5m</span>
                </div>
              </div>
            </div>`
          : ''
      }

      ${
        isFeeder
          ? `<div class="insp-section">
              <div class="insp-section-title">Operating Load vs Rated Current</div>
              <div class="form-grid">
                <div class="field">
                  ${lbl('Load Entry Mode', 'tier.loadMode')}
                  <select id="t-load-mode">
                    <option value="kw" ${tier.loadInputMode === 'kw' ? 'selected' : ''}>Motor / Load kW</option>
                    <option value="amps" ${tier.loadInputMode !== 'kw' ? 'selected' : ''}>Direct Amps (Iop)</option>
                  </select>
                  <span class="field-hint">kW for motors, Amps for sub-DBs</span>
                </div>
                <div class="field">
                  ${lbl('Duty / Load Factor', 'tier.loadFactor')}
                  <input type="number" id="t-load-factor" value="${tier.loadFactor != null ? tier.loadFactor : 1.0}" min="0" max="1.25" step="0.05" placeholder="0.85" />
                  <span class="field-hint">Typ: 0.80–0.90 pumps, 1.0 cont.</span>
                </div>
              </div>
              ${
                tier.loadInputMode === 'kw'
                  ? `<div class="form-grid-3">
                      <div class="field">
                        ${lbl('Power (kW)', 'tier.kw')}
                        <input type="number" id="t-kw" value="${tier.loadKw || 0}" min="0" step="0.5" placeholder="37" />
                        <span class="field-hint">Ex: 7.5–110</span>
                      </div>
                      <div class="field">
                        ${lbl('PF (cosφ)', 'tier.pf')}
                        <input type="number" id="t-pf" value="${tier.powerFactor || 0.85}" min="0.2" max="1" step="0.01" placeholder="0.85" />
                        <span class="field-hint">Typ: 0.85</span>
                      </div>
                      <div class="field">
                        ${lbl('Eff (η)', 'tier.eff')}
                        <input type="number" id="t-eff" value="${tier.efficiency || 0.93}" min="0.2" max="1" step="0.01" placeholder="0.93" />
                        <span class="field-hint">Typ: 0.90–0.95</span>
                      </div>
                    </div>`
                  : `<div class="field">
                      ${lbl('Base Operating Current (A)', 'tier.amps')}
                      <input type="number" id="t-amps" value="${tier.operatingCurrentA || 0}" min="0" step="5" placeholder="160" />
                      <span class="field-hint">Typ: 50%–80% of In (${Math.round(tier.ratedCurrentA * 0.5)}–${Math.round(tier.ratedCurrentA * 0.8)} A)</span>
                    </div>`
              }
            </div>`
          : ''
      }

      ${
        !isSpacer
          ? `<div class="insp-section">
              <div class="insp-section-title">Manufacturer Loss Data (P_op = P_fix + P_n·(Iop/In)²)</div>
              <div class="form-grid-3">
                <div class="field">
                  ${lbl('Rated In', 'tier.in')}
                  <input type="number" id="t-in" value="${tier.ratedCurrentA}" min="1" step="10" placeholder="100" />
                  <span class="field-hint">Frame (A)</span>
                </div>
                <div class="field">
                  ${lbl('Rated Pn', 'tier.pn')}
                  <input type="number" id="t-pn" value="${tier.ratedLossW}" min="0" step="1" ${tier.subComponents ? 'disabled title="Summed from sub-components below"' : ''} placeholder="42" />
                  <span class="field-hint">3P W @ In</span>
                </div>
                <div class="field">
                  ${lbl('Fixed W', 'tier.pfix')}
                  <input type="number" id="t-pfix" value="${tier.fixedLossW || 0}" min="0" step="1" ${tier.subComponents ? 'disabled title="Summed from sub-components below"' : ''} placeholder="12" />
                  <span class="field-hint">Coil/aux W</span>
                </div>
              </div>

              ${
                tier.subComponents && tier.subComponents.length
                  ? `<div style="margin-top:4px;">
                      <span class="field-hint" style="display:block;margin-bottom:4px;">Typ DOL: MCCB 15–32W, Contactor 10–35W + 8–15W coil, O/L 6–12W.</span>
                      <div class="subcomp-row" style="color:var(--text-2);font-weight:700;margin-bottom:3px;">
                        <span>Sub-Component</span><span>In(A)</span><span>Pn(W)</span><span>Fix(W)</span><span></span>
                      </div>
                      ${tier.subComponents
                        .map(
                          (sc, sIdx) => `
                        <div class="subcomp-row">
                          <input type="text" data-sc-idx="${sIdx}" data-sc-field="name" value="${esc(sc.name)}" />
                          <input type="number" data-sc-idx="${sIdx}" data-sc-field="ratedCurrentA" value="${sc.ratedCurrentA}" />
                          <input type="number" data-sc-idx="${sIdx}" data-sc-field="ratedLossW" value="${sc.ratedLossW}" />
                          <input type="number" data-sc-idx="${sIdx}" data-sc-field="fixedLossW" value="${sc.fixedLossW || 0}" />
                          <button class="btn btn-sm btn-danger" style="padding:2px 4px;" data-sc-del="${sIdx}">×</button>
                        </div>`
                        )
                        .join('')}
                      <button id="t-add-subcomp" class="btn btn-sm btn-secondary" style="margin-top:6px;">+ Add Sub-Component</button>
                    </div>`
                  : `<button id="t-convert-subcomp" class="btn btn-sm btn-secondary">Break into Sub-Components (Contactor/O/L/Coil)</button>`
              }

              <div class="calc-readout explainable" id="tier-calc-readout" title="Click to inspect step-by-step operating vs rated loss calculation">
                <div class="calc-row"><span class="lbl">Operating Current Iop:</span><span class="val">${tr.iOp.toFixed(1)} A (${(dl.loadRatio * 100).toFixed(0)}% of ${tier.ratedCurrentA}A)</span></div>
                <div class="calc-row"><span class="lbl">Joule Scaling (Iop/In)²:</span><span class="val">${dl.loadRatioSq.toFixed(3)}</span></div>
                <div class="calc-row"><span class="lbl">Device Variable + Fixed:</span><span class="val">${dl.pVarW.toFixed(1)} W + ${dl.pFixedW.toFixed(1)} W = ${dl.pTotalW.toFixed(1)} W</span></div>
                <div class="calc-row"><span class="lbl">Take-off Tail &amp; Joint:</span><span class="val">${(tr.takeoffLossW || 0).toFixed(1)} W (EL +${Math.round(project.config.panelHeightMm - tr.yCenterMm)} mm)</span></div>
                ${tr.cableLoss && tr.cableLoss.totalW > 0 ? `<div class="calc-row"><span class="lbl">Interconn Cable Loss:</span><span class="val">${tr.cableLoss.totalW.toFixed(1)} W (${tr.cableLoss.wPerM.toFixed(1)} W/m)</span></div>` : ''}
                <div class="calc-row highlight"><span class="lbl">Compartment Total Loss:</span><span class="val">${(dl.pTotalW + (tr.takeoffLossW || 0) + (tr.cableLoss ? tr.cableLoss.totalW : 0)).toFixed(1)} W</span></div>
                <div class="calc-explain-footer"><span>Click for full worked steps &amp; commentary</span><span>Analyse ↗</span></div>
              </div>
            </div>`
          : ''
      }
    `;

    const readoutEl = document.getElementById('tier-calc-readout');
    if (readoutEl) {
      readoutEl.addEventListener('click', () => openExplain('tier.loss', { colIndex: colIdx, tierIndex: tierIdx }));
    }

    const on = (id, ev, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(ev, fn);
    };

    on('t-tag', 'change', (e) => { pushUndo(); tier.tag = e.target.value; renderAll(); });
    on('t-status', 'change', (e) => { pushUndo(); tier.status = e.target.value; renderAll(); });
    on('t-desc', 'change', (e) => { pushUndo(); tier.description = e.target.value; renderAll(); });
    on('t-role', 'change', (e) => { pushUndo(); tier.role = e.target.value; renderAll(); });
    on('t-height', 'change', (e) => { pushUndo(); tier.heightMm = Math.max(120, Number(e.target.value) || 250); renderAll(); });
    on('t-in', 'change', (e) => { pushUndo(); tier.ratedCurrentA = Math.max(1, Number(e.target.value) || 100); renderAll(); });
    on('t-pn', 'change', (e) => { pushUndo(); tier.ratedLossW = Math.max(0, Number(e.target.value) || 0); renderAll(); });
    on('t-pfix', 'change', (e) => { pushUndo(); tier.fixedLossW = Math.max(0, Number(e.target.value) || 0); renderAll(); });

    on('t-inc-state', 'change', (e) => { pushUndo(); tier.incomerState = e.target.value; renderAll(); });
    on('t-coupler-state', 'change', (e) => { pushUndo(); tier.couplerState = e.target.value; renderAll(); });
    on('t-remote-board', 'change', (e) => { pushUndo(); tier.remoteBoardName = e.target.value; renderAll(); });
    on('t-norm-a', 'change', (e) => { pushUndo(); tier.normalTransferCurrentA = Math.max(0, Number(e.target.value) || 0); renderAll(); });
    on('t-n1-a', 'change', (e) => { pushUndo(); tier.n1TransferCurrentA = Math.max(0, Number(e.target.value) || 0); renderAll(); });
    on('t-cable-en', 'change', (e) => {
      pushUndo();
      tier.cableSpec = tier.cableSpec || { material: 'cu_100', cablesPerPhase: 3, csaMm2: 240, internalLengthM: 2.5, operatingTempC: 70 };
      tier.cableSpec.includeCableLoss = e.target.checked;
      renderAll();
    });
    on('t-cable-n', 'change', (e) => { pushUndo(); tier.cableSpec.cablesPerPhase = Math.max(1, Number(e.target.value) || 1); renderAll(); });
    on('t-cable-csa', 'change', (e) => { pushUndo(); tier.cableSpec.csaMm2 = Math.max(10, Number(e.target.value) || 240); renderAll(); });
    on('t-cable-len', 'change', (e) => { pushUndo(); tier.cableSpec.internalLengthM = Math.max(0, Number(e.target.value) || 0); renderAll(); });

    on('t-load-mode', 'change', (e) => { pushUndo(); tier.loadInputMode = e.target.value; renderAll(); });
    on('t-load-factor', 'change', (e) => { pushUndo(); tier.loadFactor = Math.max(0, Number(e.target.value)); renderAll(); });
    on('t-kw', 'change', (e) => { pushUndo(); tier.loadKw = Math.max(0, Number(e.target.value) || 0); renderAll(); });
    on('t-pf', 'change', (e) => { pushUndo(); tier.powerFactor = Math.min(1, Math.max(0.1, Number(e.target.value) || 0.85)); renderAll(); });
    on('t-eff', 'change', (e) => { pushUndo(); tier.efficiency = Math.min(1, Math.max(0.1, Number(e.target.value) || 0.93)); renderAll(); });
    on('t-amps', 'change', (e) => { pushUndo(); tier.operatingCurrentA = Math.max(0, Number(e.target.value) || 0); renderAll(); });

    on('t-template', 'change', (e) => {
      const tpl = project.deviceLibrary.find((x) => x.id === e.target.value);
      if (!tpl) return;
      pushUndo();
      const c = window.SGCatalog.cloneTemplate(tpl);
      tier.templateId = c.id;
      tier.category = c.category;
      tier.role = c.role || 'feeder';
      tier.description = c.name;
      tier.ratedCurrentA = c.ratedCurrentA;
      tier.ratedLossW = c.ratedLossW;
      tier.fixedLossW = c.fixedLossW || 0;
      tier.subComponents = c.subComponents || null;
      tier.heightMm = c.defaultHeightMm || tier.heightMm;
      if (c.defaultKw) {
        tier.loadInputMode = 'kw';
        tier.loadKw = c.defaultKw;
      }
      renderAll();
    });

    on('t-up', 'click', () => {
      if (tierIdx <= 0) return;
      pushUndo();
      const tmp = col.tiers[tierIdx - 1];
      col.tiers[tierIdx - 1] = col.tiers[tierIdx];
      col.tiers[tierIdx] = tmp;
      selection = { type: 'tier', colIndex: colIdx, tierIndex: tierIdx - 1 };
      renderAll();
    });
    on('t-down', 'click', () => {
      if (tierIdx >= col.tiers.length - 1) return;
      pushUndo();
      const tmp = col.tiers[tierIdx + 1];
      col.tiers[tierIdx + 1] = col.tiers[tierIdx];
      col.tiers[tierIdx] = tmp;
      selection = { type: 'tier', colIndex: colIdx, tierIndex: tierIdx + 1 };
      renderAll();
    });
    on('t-dup', 'click', () => {
      pushUndo();
      const copy = JSON.parse(JSON.stringify(tier));
      copy.id = window.SGState.uid('tier');
      copy.tag = tier.tag + '-B';
      col.tiers.splice(tierIdx + 1, 0, copy);
      selection = { type: 'tier', colIndex: colIdx, tierIndex: tierIdx + 1 };
      renderAll();
    });
    on('t-del', 'click', () => {
      pushUndo();
      col.tiers.splice(tierIdx, 1);
      selection = { type: 'column', colIndex: colIdx };
      renderAll();
    });

    container.querySelectorAll('[data-sc-field]').forEach((inp) => {
      inp.addEventListener('change', () => {
        pushUndo();
        const sIdx = Number(inp.dataset.scIdx);
        const field = inp.dataset.scField;
        const sc = tier.subComponents[sIdx];
        if (!sc) return;
        sc[field] = field === 'name' ? inp.value : Number(inp.value) || 0;
        tier.ratedLossW = tier.subComponents.reduce((a, b) => a + (Number(b.ratedLossW) || 0), 0);
        tier.fixedLossW = tier.subComponents.reduce((a, b) => a + (Number(b.fixedLossW) || 0), 0);
        renderAll();
      });
    });

    container.querySelectorAll('[data-sc-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        pushUndo();
        tier.subComponents.splice(Number(btn.dataset.scDel), 1);
        if (tier.subComponents.length === 0) tier.subComponents = null;
        renderAll();
      });
    });

    on('t-add-subcomp', 'click', () => {
      pushUndo();
      tier.subComponents.push({ name: 'Aux / Component', ratedCurrentA: tier.ratedCurrentA, ratedLossW: 10, fixedLossW: 2 });
      renderAll();
    });

    on('t-convert-subcomp', 'click', () => {
      pushUndo();
      tier.subComponents = [
        { name: tier.category + ' Main Poles', ratedCurrentA: tier.ratedCurrentA, ratedLossW: tier.ratedLossW, fixedLossW: 0 },
        { name: 'Control / Aux Coil', ratedCurrentA: tier.ratedCurrentA, ratedLossW: 0, fixedLossW: tier.fixedLossW || 5 },
      ];
      renderAll();
    });
  }

  // --- TAB 3: Schedules & Audit View ---
  function renderSchedulesView(evalRes, allScenarios) {
    const el = document.getElementById('schedules-container');
    const hr = evalRes.hbbRes;
    const bb = project.mainBusbar;
    const maxScenarioW = Math.max(100, ...allScenarios.map((s) => s.result.totals.grandTotalW));

    el.innerHTML = `
      <div class="card">
        <h3>
          4-Scenario Heat Output Comparison (kW)
          <button class="explain-chip" data-explain-direct="kpi.grandTotal">Analyse Active Scenario ↗</button>
        </h3>
        <div class="bar-chart">
          ${allScenarios
            .map((sc) => {
              const t = sc.result.totals;
              const pct = (w) => ((w / maxScenarioW) * 100).toFixed(2);
              const activeStyle = sc.id === evalRes.scenario ? 'color:var(--accent);font-weight:700;' : '';
              return `
                <div class="bar-row clickable" data-switch-and-explain="${sc.id}" title="Click to switch to ${esc(sc.label)} and analyse">
                  <div style="${activeStyle}">${esc(sc.label)}</div>
                  <div class="bar-track" title="Total: ${t.grandTotalKW.toFixed(3)} kW">
                    <div class="bar-seg-busbar" style="width:${pct(t.totalBusbarW)}%" title="Busbars & Joints: ${t.totalBusbarW.toFixed(0)} W"></div>
                    <div class="bar-seg-incomer" style="width:${pct(t.totalIncomerDevicesW)}%" title="Incomers/Couplers: ${t.totalIncomerDevicesW.toFixed(0)} W"></div>
                    <div class="bar-seg-starter" style="width:${pct(t.totalStarterDevicesW)}%" title="Starters/VSDs: ${t.totalStarterDevicesW.toFixed(0)} W"></div>
                    <div class="bar-seg-feeder" style="width:${pct(t.totalFeederDevicesW)}%" title="MCCB/Fuse Feeders: ${t.totalFeederDevicesW.toFixed(0)} W"></div>
                    <div class="bar-seg-interconn" style="width:${pct(t.totalInterconnectorDeviceW + t.totalInterconnectorCableW)}%" title="Interconnector: ${(t.totalInterconnectorDeviceW + t.totalInterconnectorCableW).toFixed(0)} W"></div>
                    <div class="bar-seg-aux" style="width:${pct(t.totalAuxW)}%" title="Auxiliaries: ${t.totalAuxW.toFixed(0)} W"></div>
                  </div>
                  <div style="text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--warm);">${t.grandTotalKW.toFixed(3)} kW</div>
                </div>
              `;
            })
            .join('')}
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-swatch bar-seg-busbar"></span>Busbars &amp; Joints</span>
          <span class="legend-item"><span class="legend-swatch bar-seg-incomer"></span>Incomers / Couplers</span>
          <span class="legend-item"><span class="legend-swatch bar-seg-starter"></span>Motor Starters &amp; VSDs</span>
          <span class="legend-item"><span class="legend-swatch bar-seg-feeder"></span>Outgoing MCCBs/Fuses</span>
          <span class="legend-item"><span class="legend-swatch bar-seg-interconn"></span>Interconnector (Device + Cable)</span>
          <span class="legend-item"><span class="legend-swatch bar-seg-aux"></span>Auxiliaries</span>
        </div>
      </div>

      <div class="card">
        <h3>
          Main Horizontal Busbar Physics Audit <span class="card-subtitle">${esc(bb.certRef)}</span>
          <button class="explain-chip" data-explain-hbb="1">Step-by-Step Derivation ↗</button>
        </h3>
        <div class="physics-grid">
          <div class="physics-box explainable" data-explain-hbb="1">
            <div class="p-lbl">Construction / Area</div>
            <div class="p-val">${bb.barsPerPhase} × ${bb.widthMm} × ${bb.thicknessMm} mm</div>
            <div class="p-note">${hr.areaMm2} mm² / phase · ${hr.material.shortName} · Rated ${bb.ratedCurrentA}A</div>
          </div>
          <div class="physics-box explainable" data-explain-hbb="1">
            <div class="p-lbl">DC Resistance (20°C → ${hr.tempC}°C)</div>
            <div class="p-val">${hr.rDc20_uOhmPerM.toFixed(2)} → ${hr.rDcT_uOhmPerM.toFixed(2)} µΩ/m</div>
            <div class="p-note">Temp factor ×${hr.tempFactor.toFixed(3)} · Click to inspect ↗</div>
          </div>
          <div class="physics-box explainable" data-explain-hbb="1">
            <div class="p-lbl">AC Conversion Factor (${hr.acFactorMode})</div>
            <div class="p-val">k_AC = ${hr.kAcUsed.toFixed(3)}</div>
            <div class="p-note">Calc: 1 + ${hr.ys.toFixed(3)} + ${hr.yp.toFixed(3)} + ${hr.ye.toFixed(2)} = ${hr.kAcCalculated.toFixed(3)} (δ=${hr.skinDepthMm.toFixed(1)}mm)</div>
          </div>
          <div class="physics-box explainable" data-explain-hbb="1">
            <div class="p-lbl">AC Resistance &amp; Rated W/m</div>
            <div class="p-val">${hr.rAcT_uOhmPerM.toFixed(2)} µΩ/m</div>
            <div class="p-note">At ${bb.ratedCurrentA}A (3-Ph): ${evalRes.hbbRatedWPerM.toFixed(1)} W/m · Analyse ↗</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Horizontal Busbar Segments (W/m &amp; Segment Losses) <span class="card-subtitle">Click any row to analyse its span length, current &amp; W/m derivation</span></h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>From Column</th>
              <th>To Column</th>
              <th class="num">Length (m)</th>
              <th class="num">Current (A)</th>
              <th class="num">% Rating</th>
              <th class="num">Per Phase (W/m)</th>
              <th class="num">3-Phase (W/m)</th>
              <th class="num">Busbar (W)</th>
              <th class="num">Splice Joint (W)</th>
              <th class="num">Total (W)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${evalRes.hbbSegments
              .map(
                (s, sIdx) => `
              <tr class="clickable" data-explain-hbb-seg="${sIdx}">
                <td>${esc(s.fromColName)}</td>
                <td>${esc(s.toColName)}</td>
                <td class="num">${s.lengthM.toFixed(2)}</td>
                <td class="num">${s.direction === 'right' ? '→ ' : '← '}${s.currentA.toFixed(1)}</td>
                <td class="num" style="color:${s.utilizationPct > 100 ? 'var(--danger)' : 'inherit'}">${s.utilizationPct.toFixed(1)}%</td>
                <td class="num">${s.wPerMPhase.toFixed(1)}</td>
                <td class="num">${s.wPerMTotal.toFixed(1)}</td>
                <td class="num">${s.lossW.toFixed(1)}</td>
                <td class="num">${s.jointLossW.toFixed(1)}</td>
                <td class="num"><strong>${s.totalSegW.toFixed(1)}</strong></td>
                <td><span class="explain-chip">Analyse</span></td>
              </tr>`
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">Total Horizontal Busbar</td>
              <td class="num">${evalRes.totals.totalHbbLenM.toFixed(2)}</td>
              <td class="num">Max ${evalRes.totals.maxHbbCurrentA.toFixed(0)}</td>
              <td></td>
              <td></td>
              <td class="num">Max ${evalRes.totals.maxHbbWPerM.toFixed(1)}</td>
              <td class="num">${evalRes.totals.totalHbbLossW.toFixed(1)}</td>
              <td class="num">${evalRes.hbbSegments.reduce((a, b) => a + b.jointLossW, 0).toFixed(1)}</td>
              <td class="num">${(evalRes.totals.totalHbbLossW + evalRes.hbbSegments.reduce((a, b) => a + b.jointLossW, 0)).toFixed(1)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="card">
        <h3>Vertical Dropper Busbar Segments (Multi-Tier Take-Offs) <span class="card-subtitle">Click any row to analyse tapering current &amp; take-off length</span></h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Span (From → To)</th>
              <th class="num">Take-off EL (mm)</th>
              <th class="num">Span Length (m)</th>
              <th class="num">Current (A)</th>
              <th class="num">% Rating</th>
              <th class="num">3-Phase (W/m)</th>
              <th class="num">Segment Loss (W)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${evalRes.vbbSegments
              .map(
                (s, vIdx) => `
              <tr class="clickable" data-explain-vbb-seg="${vIdx}">
                <td>${esc(s.colName)}</td>
                <td>${esc(s.fromLabel)} → ${esc(s.toLabel)}</td>
                <td class="num">+${s.takeoffElevationMm}</td>
                <td class="num">${s.lengthM.toFixed(2)}</td>
                <td class="num">${s.currentA.toFixed(1)}</td>
                <td class="num" style="color:${s.utilizationPct > 100 ? 'var(--danger)' : 'inherit'}">${s.utilizationPct.toFixed(1)}%</td>
                <td class="num">${s.wPerMTotal.toFixed(1)}</td>
                <td class="num"><strong>${s.lossW.toFixed(1)}</strong></td>
                <td><span class="explain-chip">Analyse</span></td>
              </tr>`
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Total Vertical Droppers</td>
              <td class="num">${evalRes.totals.totalVbbLenM.toFixed(2)}</td>
              <td></td>
              <td></td>
              <td class="num">Max ${evalRes.totals.maxVbbWPerM.toFixed(1)}</td>
              <td class="num">${evalRes.totals.totalVbbLossW.toFixed(1)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="card">
        <h3>Protective Devices, Starters &amp; Interconnector Schedule <span class="card-subtitle">Click a row to edit in Inspector, or click "Analyse" for step-by-step calculation breakdown</span></h3>
        <table class="data-table">
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${evalRes.deviceRows
              .map((r) => {
                const badgeCls =
                  r.role === 'interconnector'
                    ? 'status-interconn'
                    : r.role === 'spacer'
                    ? 'status-standby'
                    : r.status === 'future'
                    ? 'status-future'
                    : r.isActive
                    ? 'status-active'
                    : 'status-standby';
                return `
                  <tr class="clickable" data-jump-tier="${r.colIndex}:${r.tierIndex}">
                    <td>${esc(r.colName.split(' ')[0])}</td>
                    <td><strong>${esc(r.tag)}</strong></td>
                    <td>${esc(r.description)}</td>
                    <td>${esc(r.category)}</td>
                    <td><span class="status-tag ${badgeCls}">${r.role === 'interconnector' ? (r.isActive ? 'N-1 TX' : 'IC IDLE') : r.role === 'spacer' ? 'SPARE' : r.status}</span></td>
                    <td class="num">${r.role === 'spacer' ? '—' : r.ratedCurrentA}</td>
                    <td class="num">${r.iOp.toFixed(1)}</td>
                    <td class="num">${r.role === 'spacer' ? '—' : (r.loadRatio * r.loadRatio).toFixed(2)}</td>
                    <td class="num">${r.fixedLossW.toFixed(1)}</td>
                    <td class="num">${r.varLossW.toFixed(1)}</td>
                    <td class="num">${(r.takeoffLossW + r.cableLossW).toFixed(1)}</td>
                    <td class="num"><strong>${r.totalRowW.toFixed(1)}</strong></td>
                    <td><button class="explain-chip" data-explain-tier="${r.colIndex}:${r.tierIndex}">Analyse</button></td>
                  </tr>`;
              })
              .join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="8">Total Devices, Starters, Take-offs &amp; Interconnector Cable</td>
              <td class="num">${evalRes.deviceRows.reduce((a, b) => a + b.fixedLossW, 0).toFixed(1)}</td>
              <td class="num">${evalRes.deviceRows.reduce((a, b) => a + b.varLossW, 0).toFixed(1)}</td>
              <td class="num">${evalRes.deviceRows.reduce((a, b) => a + b.takeoffLossW + b.cableLossW, 0).toFixed(1)}</td>
              <td class="num">${evalRes.deviceRows.reduce((a, b) => a + b.totalRowW, 0).toFixed(1)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="notice-box">
          <strong>Engineering Basis Note:</strong> Device variable losses are scaled using IEC TR 60890 Joule scaling
          <code>P_op = P_fixed + P_n × (I_op / I_n)²</code> (and IGBT load-curve approximation for VSDs).
          Board-level Rated Diversity Factor (RDF = ${(project.config.diversityFactorRDF * 100).toFixed(0)}%) is applied when summing local feeder currents onto vertical and horizontal busbars; N-1 interconnector transfer current is applied at 100%.
        </div>
      </div>
    `;

    el.querySelectorAll('[data-explain-direct]').forEach((btn) => {
      btn.addEventListener('click', () => openExplain(btn.dataset.explainDirect));
    });
    el.querySelectorAll('[data-switch-and-explain]').forEach((row) => {
      row.addEventListener('click', () => {
        project.activeScenario = row.dataset.switchAndExplain;
        renderAll(true);
        openExplain('kpi.grandTotal');
      });
    });
    el.querySelectorAll('[data-explain-hbb]').forEach((box) => {
      box.addEventListener('click', () => openExplain('busbar.physics', { scope: 'main' }));
    });
    el.querySelectorAll('[data-explain-hbb-seg]').forEach((row) => {
      row.addEventListener('click', () => openExplain('hbb.segment', { segIndex: Number(row.dataset.explainHbbSeg) }));
    });
    el.querySelectorAll('[data-explain-vbb-seg]').forEach((row) => {
      row.addEventListener('click', () => openExplain('vbb.segment', { segIndex: Number(row.dataset.explainVbbSeg) }));
    });
    el.querySelectorAll('[data-explain-tier]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [c, t] = btn.dataset.explainTier.split(':').map(Number);
        selection = { type: 'tier', colIndex: c, tierIndex: t };
        renderInspector(evalRes);
        openExplain('tier.loss', { colIndex: c, tierIndex: t });
      });
    });
    el.querySelectorAll('[data-jump-tier]').forEach((row) => {
      row.addEventListener('click', () => {
        const [c, t] = row.dataset.jumpTier.split(':').map(Number);
        selection = { type: 'tier', colIndex: c, tierIndex: t };
        renderInspector(evalRes);
      });
    });
  }

  // --- TAB 4: Editable Device, Fuse & Starter Library (with Category Filter & Search) ---
  function renderLibraryView() {
    const el = document.getElementById('library-container');
    const categories = ['ALL', ...Array.from(new Set(project.deviceLibrary.map((t) => t.category)))];
    const q = libSearchQuery.trim().toLowerCase();

    const filtered = project.deviceLibrary
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => {
        if (libFilterCategory !== 'ALL' && t.category !== libFilterCategory) return false;
        if (q && !`${t.category} ${t.name} ${t.ratedCurrentA} ${t.notes || ''}`.toLowerCase().includes(q)) return false;
        return true;
      });

    el.innerHTML = `
      <div class="card">
        <h3>
          Editable IEC Protective Device, Eaton HRC Fuse &amp; Starter Library (${project.deviceLibrary.length} items)
          <div class="action-row">
            <button id="lib-sync-btn" class="btn btn-sm btn-secondary" title="Ensure all latest Eaton 2A–1250A HRC fuses & IEC templates are loaded">↻ Sync Default Library</button>
            <button id="lib-add-btn" class="btn btn-sm btn-primary">+ New Custom Device Template</button>
          </div>
        </h3>
        <div class="lib-typ-banner">
          <span><strong>Eaton Bussmann NH gG HRC Fuses (2 A – 1250 A, DS 10164):</strong></span>
          <span>2NHG000B = 3.9 W/link</span>
          <span>16NHG0B = 3.0 W/link</span>
          <span>250NHG1B = 19 W/link</span>
          <span>400NHG2B = 30 W/link</span>
          <span>630NHG3B = 47 W/link</span>
          <span>1250NHG4G = 108 W/link (324 W 3P + base)</span>
        </div>
        <div class="lib-filter-bar">
          <input type="text" id="lib-search" value="${esc(libSearchQuery)}" placeholder="Search part no. or rating (e.g. 1250NHG4G, 16NHG0B, DOL, 400A)…" style="min-width:280px;" />
          ${categories
            .map(
              (cat) =>
                `<button class="btn btn-sm ${libFilterCategory === cat ? 'btn-primary' : 'btn-secondary'}" data-lib-cat="${esc(cat)}">${esc(cat)}</button>`
            )
            .join('')}
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Template Name</th>
              <th class="num"><span class="help-label" data-help="tier.in">Rated In (A)</span></th>
              <th class="num"><span class="help-label" data-help="tier.pn">Rated Pn (W)</span></th>
              <th class="num"><span class="help-label" data-help="tier.pfix">Fixed (W)</span></th>
              <th class="num"><span class="help-label" data-help="tier.height">Height (mm)</span></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map(
                ({ t, idx }) => `
              <tr>
                <td><input type="text" data-lib-idx="${idx}" data-lib-field="category" value="${esc(t.category)}" style="width:120px;" /></td>
                <td><input type="text" data-lib-idx="${idx}" data-lib-field="name" value="${esc(t.name)}" style="width:290px;" /></td>
                <td class="num"><input type="number" data-lib-idx="${idx}" data-lib-field="ratedCurrentA" value="${t.ratedCurrentA}" style="width:72px;" /></td>
                <td class="num"><input type="number" data-lib-idx="${idx}" data-lib-field="ratedLossW" value="${t.ratedLossW}" style="width:72px;" /></td>
                <td class="num"><input type="number" data-lib-idx="${idx}" data-lib-field="fixedLossW" value="${t.fixedLossW || 0}" style="width:65px;" /></td>
                <td class="num"><input type="number" data-lib-idx="${idx}" data-lib-field="defaultHeightMm" value="${t.defaultHeightMm || 250}" style="width:70px;" /></td>
                <td><button class="btn btn-sm btn-danger" data-lib-del="${idx}">Remove</button></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('lib-search').addEventListener('input', (e) => {
      libSearchQuery = e.target.value;
      renderLibraryView();
      const s = document.getElementById('lib-search');
      if (s) {
        s.focus();
        s.setSelectionRange(s.value.length, s.value.length);
      }
    });

    el.querySelectorAll('[data-lib-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        libFilterCategory = btn.dataset.libCat;
        renderLibraryView();
      });
    });

    document.getElementById('lib-sync-btn').addEventListener('click', () => {
      pushUndo();
      project.deviceLibrary = window.SGState.syncLibraryWithDefaults(project.deviceLibrary);
      renderAll();
    });

    el.querySelectorAll('[data-lib-field]').forEach((inp) => {
      inp.addEventListener('change', () => {
        pushUndo();
        const idx = Number(inp.dataset.libIdx);
        const f = inp.dataset.libField;
        const item = project.deviceLibrary[idx];
        if (!item) return;
        item[f] = f === 'name' || f === 'category' ? inp.value : Number(inp.value) || 0;
        if (f === 'ratedLossW' && item.subComponents) item.subComponents = null;
        window.SGState.saveProject(project);
      });
    });

    el.querySelectorAll('[data-lib-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (project.deviceLibrary.length <= 1) return;
        pushUndo();
        project.deviceLibrary.splice(Number(btn.dataset.libDel), 1);
        renderAll();
      });
    });

    document.getElementById('lib-add-btn').addEventListener('click', () => {
      pushUndo();
      project.deviceLibrary.unshift({
        id: window.SGState.uid('tpl'),
        category: 'MCCB',
        name: 'Custom Device 250A (Manufacturer Data)',
        role: 'feeder',
        ratedCurrentA: 250,
        ratedLossW: 45,
        fixedLossW: 3,
        defaultHeightMm: 250,
        notes: 'Custom manufacturer entry',
      });
      renderAll();
    });
  }

  // --- TAB 5: Global Board & Standards Config ---
  function renderConfigView() {
    const el = document.getElementById('config-container');
    const c = project.config;
    const m = project.meta;

    el.innerHTML = `
      <div class="card">
        <h3>Project Metadata</h3>
        <div class="form-grid">
          <div class="field">
            ${lbl('Project / Switchboard Name', 'cfg.projName')}
            <input type="text" id="cfg-proj-name" value="${esc(m.projectName)}" placeholder="e.g. MSB-A — Main LV Switchboard" />
            <span class="field-hint">Ex: MSB-A — Main LV Switchboard (Firm Supply A)</span>
          </div>
          <div class="field">
            ${lbl('Document / Calc Reference', 'cfg.projNum')}
            <input type="text" id="cfg-proj-num" value="${esc(m.projectNumber)}" placeholder="e.g. CEI-TH-001" />
            <span class="field-hint">Used in PDF header &amp; exported filenames</span>
          </div>
          <div class="field">
            ${lbl('Engineer', 'cfg.eng')}
            <input type="text" id="cfg-eng" value="${esc(m.engineer)}" placeholder="e.g. CE&I Engineering" />
            <span class="field-hint">Author shown on printed calculation sheet</span>
          </div>
          <div class="field">
            ${lbl('Revision', 'cfg.rev')}
            <input type="text" id="cfg-rev" value="${esc(m.revision)}" placeholder="e.g. Rev A / P01" />
            <span class="field-hint">Ex: Rev A (Preliminary), Rev C01 (Construction)</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Electrical System &amp; IEC 61439 Diversity Basis</h3>
        <div class="form-grid-3">
          <div class="field">
            ${lbl('System Voltage V_LL (V)', 'cfg.v')}
            <input type="number" id="cfg-v" value="${c.voltageV}" step="5" placeholder="400" />
            <span class="field-hint">Typ: 400 V (IEC/EU) or 415 V (UK)</span>
          </div>
          <div class="field">
            ${lbl('Frequency (Hz)', 'cfg.f')}
            <select id="cfg-f">
              <option value="50" ${c.frequencyHz === 50 ? 'selected' : ''}>50 Hz (IEC / UK / EU)</option>
              <option value="60" ${c.frequencyHz === 60 ? 'selected' : ''}>60 Hz</option>
            </select>
            <span class="field-hint">Drives AC skin depth δ (~10.2 mm @ 50Hz Cu)</span>
          </div>
          <div class="field">
            ${lbl('System Poles', 'cfg.poles')}
            <select id="cfg-poles">
              <option value="3P+N" ${c.poles === '3P+N' ? 'selected' : ''}>3P+N (4-Wire)</option>
              <option value="3P" ${c.poles === '3P' ? 'selected' : ''}>3P (3-Wire)</option>
            </select>
            <span class="field-hint">Typ: 3P+N for mixed sub-DB &amp; MCC boards</span>
          </div>
          <div class="field">
            ${lbl('Neutral Current Ratio (I_N / I_ph)', 'cfg.nratio')}
            <input type="number" id="cfg-nratio" value="${c.neutralCurrentRatio}" min="0" max="1" step="0.05" placeholder="0.10" />
            <span class="field-hint">Typ: 0.00 motors, 0.10–0.25 commercial/VSDs</span>
          </div>
          <div class="field">
            ${lbl('Board Diversity Factor (RDF)', 'cfg.rdf')}
            <input type="number" id="cfg-rdf" value="${c.diversityFactorRDF}" min="0.3" max="1.0" step="0.05" placeholder="0.90" />
            <span class="field-hint">IEC 61439 Table 101 typ: 0.8–0.9, 1.0 worst-case</span>
          </div>
          <div class="field">
            ${lbl('Global Future Load Growth (%)', 'cfg.growth')}
            <input type="number" id="cfg-growth" value="${c.globalFutureGrowthPct}" min="0" max="100" step="5" placeholder="15" />
            <span class="field-hint">Typ: 15–25% growth in Future scenarios</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>General Arrangement Dimensions, Joints &amp; Auxiliaries</h3>
        <div class="form-grid-3">
          <div class="field">
            ${lbl('Panel Height (mm)', 'cfg.h')}
            <input type="number" id="cfg-h" value="${c.panelHeightMm}" min="1400" max="2600" step="50" placeholder="2200" />
            <span class="field-hint">Typ: 2000–2200 mm LV switchboard</span>
          </div>
          <div class="field">
            ${lbl('Panel Depth (mm)', 'cfg.d')}
            <input type="number" id="cfg-d" value="${c.panelDepthMm}" min="400" max="1600" step="50" placeholder="800" />
            <span class="field-hint">Typ: 600–1000 mm (drives cooling Ae)</span>
          </div>
          <div class="field">
            ${lbl('HBB Chamber Height (mm)', 'cfg.hbbh')}
            <input type="number" id="cfg-hbbh" value="${c.hbbChamberHeightMm}" min="200" max="600" step="25" placeholder="350" />
            <span class="field-hint">Typ: 300–450 mm busbar chamber</span>
          </div>
          <div class="field">
            ${lbl('Horizontal Busbar Position', 'cfg.hbbpos')}
            <select id="cfg-hbbpos">
              <option value="top" ${c.hbbPosition === 'top' ? 'selected' : ''}>Top Busbar Chamber</option>
              <option value="bottom" ${c.hbbPosition === 'bottom' ? 'selected' : ''}>Bottom Busbar Chamber</option>
            </select>
            <span class="field-hint">Updates vertical dropper lengths to tiers</span>
          </div>
          <div class="field">
            ${lbl('Take-off Tail Length / Tier (m)', 'cfg.tail')}
            <input type="number" id="cfg-tail" value="${c.takeoffTailLengthM}" min="0" max="2" step="0.05" placeholder="0.35" />
            <span class="field-hint">Typ: 0.25–0.50 m copper link to breaker</span>
          </div>
          <div class="field">
            ${lbl('Bolted Joint Resistance (µΩ)', 'cfg.joint')}
            <input type="number" id="cfg-joint" value="${c.jointResistanceUOhm}" min="0" max="30" step="1" placeholder="5" />
            <span class="field-hint">Typ: 3–10 µΩ per torqued Cu-Cu joint</span>
          </div>
          <div class="field">
            ${lbl('Panel Auxiliary Losses (W)', 'cfg.aux')}
            <input type="number" id="cfg-aux" value="${c.auxiliaryLossesW}" min="0" step="10" placeholder="120" />
            <span class="field-hint">Typ: 80–250 W (meters, PSU, PLC, lamps)</span>
          </div>
          <div class="field">
            ${lbl('Installation Type (IEC 60890 Ae)', 'cfg.inst')}
            <select id="cfg-inst">
              <option value="freestanding" ${c.installationType !== 'wall_backed' ? 'selected' : ''}>Freestanding (Front + Rear exposed)</option>
              <option value="wall_backed" ${c.installationType === 'wall_backed' ? 'selected' : ''}>Wall-Backed (Rear blocked)</option>
            </select>
            <span class="field-hint">Sets effective enclosure surface area Ae</span>
          </div>
          <div class="field">
            ${lbl('HVAC Safety Margin (%)', 'cfg.hvac')}
            <input type="number" id="cfg-hvac" value="${c.hvacSafetyMarginPct}" min="0" max="50" step="5" placeholder="15" />
            <span class="field-hint">Typ: 15–25% contingency for HVAC cooling</span>
          </div>
        </div>
      </div>
    `;

    const bind = (id, fn) => {
      const inp = document.getElementById(id);
      if (inp) inp.addEventListener('change', () => { pushUndo(); fn(inp.value); renderAll(); });
    };

    bind('cfg-proj-name', (v) => (m.projectName = v));
    bind('cfg-proj-num', (v) => (m.projectNumber = v));
    bind('cfg-eng', (v) => (m.engineer = v));
    bind('cfg-rev', (v) => (m.revision = v));
    bind('cfg-v', (v) => (c.voltageV = Number(v) || 400));
    bind('cfg-f', (v) => (c.frequencyHz = Number(v) || 50));
    bind('cfg-poles', (v) => (c.poles = v));
    bind('cfg-nratio', (v) => (c.neutralCurrentRatio = Math.max(0, Number(v) || 0)));
    bind('cfg-rdf', (v) => (c.diversityFactorRDF = Math.min(1, Math.max(0.2, Number(v) || 1))));
    bind('cfg-growth', (v) => (c.globalFutureGrowthPct = Math.max(0, Number(v) || 0)));
    bind('cfg-h', (v) => (c.panelHeightMm = Math.max(1200, Number(v) || 2200)));
    bind('cfg-d', (v) => (c.panelDepthMm = Math.max(400, Number(v) || 800)));
    bind('cfg-hbbh', (v) => (c.hbbChamberHeightMm = Math.max(200, Number(v) || 350)));
    bind('cfg-hbbpos', (v) => (c.hbbPosition = v));
    bind('cfg-tail', (v) => (c.takeoffTailLengthM = Math.max(0, Number(v) || 0)));
    bind('cfg-joint', (v) => (c.jointResistanceUOhm = Math.max(0, Number(v) || 0)));
    bind('cfg-aux', (v) => (c.auxiliaryLossesW = Math.max(0, Number(v) || 0)));
    bind('cfg-inst', (v) => (c.installationType = v));
    bind('cfg-hvac', (v) => (c.hvacSafetyMarginPct = Math.max(0, Number(v) || 0)));
  }

  // --- TAB 6: Configurable Report & Output Builder ---
  function triggerConfiguredPrint(evalRes, allScenarios) {
    const rcfg = window.SGState.ensureReportConfig(project);
    let pageStyle = document.getElementById('dynamic-print-page-style');
    if (!pageStyle) {
      pageStyle = document.createElement('style');
      pageStyle.id = 'dynamic-print-page-style';
      document.head.appendChild(pageStyle);
    }
    pageStyle.textContent = `@media print { @page { size: A4 ${rcfg.orientation || 'landscape'}; margin: 10mm 12mm; } }`;

    document.getElementById('print-report').innerHTML = window.SGReport.buildPrintReportHTML(
      project,
      evalRes,
      allScenarios,
      'print-'
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }

  function renderReportBuilderView(evalRes, allScenarios) {
    const host = document.getElementById('report-builder-container');
    if (!host) return;
    const rcfg = window.SGState.ensureReportConfig(project);
    const sec = rcfg.sections;

    const sectionItems = [
      { key: 'titleBlock', label: 'Title Block & Project Metadata' },
      { key: 'execSummary', label: 'Executive kW & Scenario Summary' },
      { key: 'categoryBreakdown', label: 'Heat Loss Breakdown by Category' },
      { key: 'busbarBasis', label: 'Busbar Electrical & Thermal Basis' },
      { key: 'workedBusbarSteps', label: 'Worked Step-by-Step Busbar Math' },
      { key: 'sldDiagram', label: 'Single Line Diagram (SLD)' },
      { key: 'gaDiagram', label: 'General Arrangement (GA Elevation)' },
      { key: 'columnSummary', label: 'Column-by-Column Heat Summary' },
      { key: 'hbbSchedule', label: 'Horizontal Busbar (HBB) Segments' },
      { key: 'vbbSchedule', label: 'Vertical Dropper (VBB) Segments' },
      { key: 'deviceSchedule', label: 'Devices, Eaton Fuses & Starters Table' },
      { key: 'deviceSubComponents', label: 'Expand Device Sub-Components (DOL/HRC)' },
      { key: 'enclosureAdvisory', label: 'IEC 60890 Surface & Heat Flux Advisory' },
      { key: 'roomVentilation', label: 'Switchroom Cooling, Airflow & ACH Verdict' },
      { key: 'methodologyAppendix', label: 'Governing Equations Appendix' },
      { key: 'signOffBlock', label: 'Custom Notes & Sign-Off Table' },
    ];

    let previewHtml = '';
    let rawTextOut = '';
    if (rcfg.outputFormat === 'formatted') {
      const reportInner = window.SGReport.buildPrintReportHTML(project, evalRes, allScenarios, 'prev-');
      previewHtml = `<div class="report-paper ${rcfg.orientation === 'portrait' ? 'portrait-preview' : ''}">${reportInner}</div>`;
    } else {
      rawTextOut = window.SGReport.buildTextOrMarkdownReport(project, evalRes, allScenarios, rcfg.outputFormat === 'markdown');
      previewHtml = `<pre class="report-text-preview">${esc(rawTextOut)}</pre>`;
    }

    host.innerHTML = `
      <aside class="report-config-sidebar">
        <div class="insp-section">
          <div class="insp-section-title">1. Level of Detail Presets</div>
          <div class="report-preset-grid">
            <button class="btn btn-sm ${rcfg.preset === 'executive' ? 'btn-primary' : 'btn-secondary'}" data-rep-preset="executive">Executive / HVAC</button>
            <button class="btn btn-sm ${rcfg.preset === 'standard' ? 'btn-primary' : 'btn-secondary'}" data-rep-preset="standard">Standard Calc</button>
            <button class="btn btn-sm ${rcfg.preset === 'full_audit' ? 'btn-primary' : 'btn-secondary'}" data-rep-preset="full_audit">Full Audit + Steps</button>
            <button class="btn btn-sm ${rcfg.preset === 'drawings_only' ? 'btn-primary' : 'btn-secondary'}" data-rep-preset="drawings_only">Diagrams Pack</button>
          </div>
          <span class="field-hint">Pick a preset, then customise any section or format below.</span>
        </div>

        <div class="insp-section">
          <div class="insp-section-title">2. Output Format &amp; Presentation</div>
          <div class="form-grid">
            <div class="field">
              <label>Preview Format</label>
              <select id="rep-format">
                <option value="formatted" ${rcfg.outputFormat === 'formatted' ? 'selected' : ''}>Formatted / PDF</option>
                <option value="text" ${rcfg.outputFormat === 'text' ? 'selected' : ''}>Plain Text / Email</option>
                <option value="markdown" ${rcfg.outputFormat === 'markdown' ? 'selected' : ''}>Markdown (.md)</option>
              </select>
            </div>
            <div class="field">
              <label>PDF Orientation</label>
              <select id="rep-orient">
                <option value="landscape" ${rcfg.orientation !== 'portrait' ? 'selected' : ''}>A4 Landscape</option>
                <option value="portrait" ${rcfg.orientation === 'portrait' ? 'selected' : ''}>A4 Portrait</option>
              </select>
            </div>
            <div class="field">
              <label>Power Units</label>
              <select id="rep-units">
                <option value="both" ${rcfg.unitsMode === 'both' ? 'selected' : ''}>kW &amp; W (Both)</option>
                <option value="kw" ${rcfg.unitsMode === 'kw' ? 'selected' : ''}>kW Only</option>
                <option value="w" ${rcfg.unitsMode === 'w' ? 'selected' : ''}>Watts Only</option>
              </select>
            </div>
            <div class="field">
              <label>kW Precision</label>
              <select id="rep-dp">
                <option value="1" ${Number(rcfg.kwDecimals) === 1 ? 'selected' : ''}>1 decimal (0.0)</option>
                <option value="2" ${Number(rcfg.kwDecimals) === 2 ? 'selected' : ''}>2 decimals (0.00)</option>
                <option value="3" ${Number(rcfg.kwDecimals) === 3 ? 'selected' : ''}>3 decimals (0.000)</option>
              </select>
            </div>
            <div class="field">
              <label>Scenarios Shown</label>
              <select id="rep-scenarios">
                <option value="all" ${rcfg.scenarioScope !== 'active' ? 'selected' : ''}>All 4 Scenarios</option>
                <option value="active" ${rcfg.scenarioScope === 'active' ? 'selected' : ''}>Active Scenario Only</option>
              </select>
            </div>
            <div class="field">
              <label>Diagram Colours</label>
              <select id="rep-diag-theme">
                <option value="light" ${rcfg.diagramTheme !== 'active' ? 'selected' : ''}>Light CAD (Print)</option>
                <option value="active" ${rcfg.diagramTheme === 'active' ? 'selected' : ''}>Match App Theme</option>
              </select>
            </div>
          </div>
          <div class="report-check-list" style="margin-top:4px;">
            <label class="report-check-item"><input type="checkbox" id="rep-btu" ${rcfg.includeBtuHvac ? 'checked' : ''} /> Include BTU/hr &amp; HVAC Cooling Margin</label>
            <label class="report-check-item"><input type="checkbox" id="rep-breaks" ${rcfg.pageBreaks ? 'checked' : ''} /> Page Breaks Before Diagrams &amp; Schedules</label>
            <label class="report-check-item"><input type="checkbox" id="rep-inactive" ${rcfg.includeInactiveRows ? 'checked' : ''} /> Include Inactive / Future (OFF) &amp; Spare Rows</label>
          </div>
        </div>

        <div class="insp-section">
          <div class="insp-section-title">3. Sections to Include</div>
          <div class="report-check-list">
            ${sectionItems
              .map(
                (it) =>
                  `<label class="report-check-item"><input type="checkbox" data-rep-sec="${it.key}" ${sec[it.key] ? 'checked' : ''} /> ${esc(it.label)}</label>`
              )
              .join('')}
          </div>
          ${
            sec.gaDiagram
              ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);">
                  <span class="field-hint" style="display:block;margin-bottom:4px;">General Arrangement (GA) Diagram Layers:</span>
                  <div class="action-row">
                    <label class="report-check-item"><input type="checkbox" id="rep-ga-heat" ${rcfg.gaHeatmap ? 'checked' : ''} /> Heatmap</label>
                    <label class="report-check-item"><input type="checkbox" id="rep-ga-dims" ${rcfg.gaDims ? 'checked' : ''} /> Dims</label>
                    <label class="report-check-item"><input type="checkbox" id="rep-ga-bus" ${rcfg.gaBusbars ? 'checked' : ''} /> Busbars</label>
                  </div>
                </div>`
              : ''
          }
        </div>

        <div class="insp-section">
          <div class="insp-section-title">4. Custom Notes &amp; Sign-Off</div>
          <div class="field">
            <label>Notes / Assumptions on Report</label>
            <textarea id="rep-notes" rows="3" placeholder="Enter design basis notes or HVAC assumptions…">${esc(rcfg.customNotes || '')}</textarea>
          </div>
          <div class="form-grid">
            <div class="field"><label>Checked By</label><input type="text" id="rep-checked" value="${esc(rcfg.checkedBy || '')}" placeholder="Name / Initials" /></div>
            <div class="field"><label>Approved By</label><input type="text" id="rep-approved" value="${esc(rcfg.approvedBy || '')}" placeholder="Name / Initials" /></div>
          </div>
        </div>
      </aside>

      <section class="report-preview-pane">
        <div class="canvas-toolbar">
          <div class="toolbar-group">
            <button id="rep-btn-print" class="btn btn-sm btn-primary">🖨 Print / Save PDF</button>
            <button id="rep-btn-copy" class="btn btn-sm btn-secondary">📋 Copy ${rcfg.outputFormat === 'markdown' ? 'Markdown' : 'Text Summary'}</button>
            <button id="rep-btn-dl-html" class="btn btn-sm btn-secondary">⬇ Download HTML</button>
            <button id="rep-btn-dl-txt" class="btn btn-sm btn-secondary">⬇ Download .txt</button>
            <button id="rep-btn-dl-md" class="btn btn-sm btn-secondary">⬇ Download .md</button>
          </div>
          <div class="toolbar-hint">Live WYSIWYG preview — prints 1:1 to ${rcfg.orientation.toUpperCase()} A4 PDF.</div>
        </div>
        <div class="report-preview-scroll">${previewHtml}</div>
      </section>
    `;

    // Bind Preset buttons
    host.querySelectorAll('[data-rep-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        project.reportConfig = window.SGState.applyReportPreset(rcfg, btn.dataset.repPreset);
        renderAll(true);
      });
    });

    // Bind Presentation & Format controls
    const bindRep = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { fn(el); renderAll(true); });
    };
    bindRep('rep-format', (el) => (rcfg.outputFormat = el.value));
    bindRep('rep-orient', (el) => (rcfg.orientation = el.value));
    bindRep('rep-units', (el) => (rcfg.unitsMode = el.value));
    bindRep('rep-dp', (el) => (rcfg.kwDecimals = Number(el.value)));
    bindRep('rep-scenarios', (el) => (rcfg.scenarioScope = el.value));
    bindRep('rep-diag-theme', (el) => (rcfg.diagramTheme = el.value));
    bindRep('rep-btu', (el) => (rcfg.includeBtuHvac = el.checked));
    bindRep('rep-breaks', (el) => (rcfg.pageBreaks = el.checked));
    bindRep('rep-inactive', (el) => (rcfg.includeInactiveRows = el.checked));
    bindRep('rep-ga-heat', (el) => (rcfg.gaHeatmap = el.checked));
    bindRep('rep-ga-dims', (el) => (rcfg.gaDims = el.checked));
    bindRep('rep-ga-bus', (el) => (rcfg.gaBusbars = el.checked));
    bindRep('rep-notes', (el) => (rcfg.customNotes = el.value));
    bindRep('rep-checked', (el) => (rcfg.checkedBy = el.value));
    bindRep('rep-approved', (el) => (rcfg.approvedBy = el.value));

    host.querySelectorAll('[data-rep-sec]').forEach((cb) => {
      cb.addEventListener('change', () => {
        rcfg.sections[cb.dataset.repSec] = cb.checked;
        rcfg.preset = 'custom';
        renderAll(true);
      });
    });

    // Bind Export / Print / Copy Actions
    document.getElementById('rep-btn-print').addEventListener('click', () => triggerConfiguredPrint(evalRes, allScenarios));
    document.getElementById('rep-btn-copy').addEventListener('click', () => {
      const btn = document.getElementById('rep-btn-copy');
      const txt = window.SGReport.buildTextOrMarkdownReport(project, evalRes, allScenarios, rcfg.outputFormat === 'markdown');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✓ Copied!';
          setTimeout(() => (btn.textContent = orig), 1800);
        });
      }
    });
    document.getElementById('rep-btn-dl-html').addEventListener('click', () => window.SGReport.exportStandaloneHTML(project, evalRes, allScenarios));
    document.getElementById('rep-btn-dl-txt').addEventListener('click', () => {
      const txt = window.SGReport.buildTextOrMarkdownReport(project, evalRes, allScenarios, false);
      window.SGReport.exportTextFile(txt, 'txt', 'text/plain;charset=utf-8', project, evalRes);
    });
    document.getElementById('rep-btn-dl-md').addEventListener('click', () => {
      const md = window.SGReport.buildTextOrMarkdownReport(project, evalRes, allScenarios, true);
      window.SGReport.exportTextFile(md, 'md', 'text/markdown;charset=utf-8', project, evalRes);
    });
  }

  // --- Reusable Switchroom Cooling & Ventilation Card (used in BOTH Simple Mode & Detailed Tab 6!) ---
  function renderRoomCoolingCardHTML(rv, rm, prefix) {
    return `
      <div class="card">
        <h3>
          Switchroom Size, Temperatures &amp; Cooling Assessment
          <button class="explain-chip" id="${prefix}-room-analyse">Analyse Airflow &amp; ACH ↗</button>
        </h3>
        <div class="form-grid-3">
          <div class="field">
            ${lbl('Room Length (m)', 'room.dims')}
            <input type="number" id="${prefix}-rm-l" value="${rm.lengthM}" min="1" max="100" step="0.5" placeholder="5" />
            <span class="field-hint">Ex: 5 m (L×W×H = ${rv.volumeM3.toFixed(0)} m³)</span>
          </div>
          <div class="field">
            ${lbl('Room Width (m)', 'room.dims')}
            <input type="number" id="${prefix}-rm-w" value="${rm.widthM}" min="1" max="100" step="0.5" placeholder="5" />
            <span class="field-hint">Ex: 5 m (Floor = ${rv.floorAreaM2.toFixed(0)} m²)</span>
          </div>
          <div class="field">
            ${lbl('Room Height (m)', 'room.dims')}
            <input type="number" id="${prefix}-rm-h" value="${rm.heightM}" min="2" max="30" step="0.5" placeholder="9" />
            <span class="field-hint">Ex: 3.5 m – 9 m</span>
          </div>
          <div class="field">
            ${lbl('Supply / Ambient Temp (°C)', 'room.tamb')}
            <input type="number" id="${prefix}-rm-tamb" value="${rm.ambientTempC}" min="-10" max="55" step="1" placeholder="25" />
            <span class="field-hint">Typ: 25–30 °C outdoor air</span>
          </div>
          <div class="field">
            ${lbl('Max Room Temp (°C)', 'room.tmax')}
            <input type="number" id="${prefix}-rm-tmax" value="${rm.maxRoomTempC}" min="15" max="60" step="1" placeholder="35" />
            <span class="field-hint">IEC 61439: 35°C avg / 40°C max</span>
          </div>
          <div class="field">
            ${lbl('Other Room Heat (kW)', 'room.other')}
            <input type="number" id="${prefix}-rm-other" value="${rm.otherRoomHeatKW}" min="0" max="500" step="0.25" placeholder="0" />
            <span class="field-hint">UPS, Tx, lighting, other boards</span>
          </div>
          <div class="field">
            ${lbl('Louver Free Area (m² ea)', 'room.louver')}
            <input type="number" id="${prefix}-rm-louver" value="${rm.louverFreeAreaM2}" min="0.05" max="20" step="0.1" placeholder="0.5" />
            <span class="field-hint">Typ: 0.3–1.5 m² (inlet &amp; exhaust)</span>
          </div>
          <div class="field">
            ${lbl('Stack Height H_stack (m)', 'room.stack')}
            <input type="number" id="${prefix}-rm-stack" value="${rm.stackHeightM}" min="0.5" max="25" step="0.5" placeholder="6" />
            <span class="field-hint">Vertical sep. between louvers</span>
          </div>
          <div class="field">
            ${lbl('Manual Heat Test Override', 'room.override')}
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="checkbox" id="${prefix}-rm-ov-en" ${rm.useOverrideHeatKW ? 'checked' : ''} style="width:16px;height:16px;flex:0 0 16px;margin:0;cursor:pointer;" title="Check to test any arbitrary kW (e.g. 6 kW)" />
              <input type="number" id="${prefix}-rm-ov-kw" value="${rm.overrideHeatKW}" min="0" step="0.5" style="flex:1;min-width:72px;" ${rm.useOverrideHeatKW ? '' : 'disabled'} placeholder="6.0" />
            </div>
            <span class="field-hint">${rm.useOverrideHeatKW ? 'Using manual test kW!' : 'Auto: ' + rv.baseSwgKW.toFixed(2) + ' kW switchgear'}</span>
          </div>
        </div>

        <div class="verdict-banner" style="margin-top:12px;border-left-color:${rv.verdictColor};">
          <div class="v-tag" style="color:${rv.verdictColor};">Ventilation &amp; Cooling Recommendation</div>
          <div class="v-title">${esc(rv.verdictTitle)}</div>
          <p class="v-detail">${esc(rv.verdictDetail)}</p>
        </div>

        <div class="room-metrics-grid">
          <div class="physics-box explainable" data-room-explain="1">
            <div class="p-lbl">Total Design Heat Load</div>
            <div class="p-val">${rv.designHeatKW.toFixed(2)} kW</div>
            <div class="p-note">${Math.round(rv.designBtuHr).toLocaleString()} BTU/hr · ${rv.heatDensityFloorWm2.toFixed(0)} W/m² floor</div>
          </div>
          <div class="physics-box explainable" data-room-explain="1">
            <div class="p-lbl">Required Airflow (ΔT = ${rv.deltaT.toFixed(1)} K)</div>
            <div class="p-val">${rv.deltaT > 0.5 ? rv.reqFlowLs.toFixed(0) + ' L/s' : 'N/A (AC Req)'}</div>
            <div class="p-note">${rv.reqFlowM3s.toFixed(3)} m³/s · ${rv.reqFlowM3h.toFixed(0)} m³/h · ${rv.reqFlowCfm.toFixed(0)} CFM</div>
          </div>
          <div class="physics-box explainable" data-room-explain="1">
            <div class="p-lbl">Air Change Rate (ACH)</div>
            <div class="p-val">${rv.deltaT > 0.5 ? rv.ach.toFixed(2) + ' ACH' : 'N/A'}</div>
            <div class="p-note">Room Volume: ${rv.volumeM3.toFixed(1)} m³ (Natural ≤6 ACH)</div>
          </div>
          <div class="physics-box explainable" data-room-explain="1">
            <div class="p-lbl">Natural Stack Capacity</div>
            <div class="p-val">${rv.natCapacityKW.toFixed(2)} kW</div>
            <div class="p-note">${rv.natFlowM3h.toFixed(0)} m³/h (${rv.natAch.toFixed(1)} ACH) · Est. Temp ${rv.estNatRoomTempC.toFixed(1)}°C</div>
          </div>
          <div class="physics-box explainable" data-room-explain="1">
            <div class="p-lbl">Louver Area Needed (Natural)</div>
            <div class="p-val">${rv.reqLouverAreaM2 < 100 ? rv.reqLouverAreaM2.toFixed(2) + ' m²' : 'Impractical'}</div>
            <div class="p-note">Free area each (inlet &amp; exhaust) · Current: ${rv.louverAreaM2.toFixed(2)} m²</div>
          </div>
        </div>
      </div>
    `;
  }

  function bindRoomCoolingEvents(container, prefix, swgKW) {
    const rm = project.room;
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { pushUndo(); fn(el); renderAll(); });
    };
    on(`${prefix}-rm-l`, (el) => (rm.lengthM = Math.max(1, Number(el.value) || 5)));
    on(`${prefix}-rm-w`, (el) => (rm.widthM = Math.max(1, Number(el.value) || 5)));
    on(`${prefix}-rm-h`, (el) => (rm.heightM = Math.max(2, Number(el.value) || 9)));
    on(`${prefix}-rm-tamb`, (el) => (rm.ambientTempC = Number(el.value)));
    on(`${prefix}-rm-tmax`, (el) => (rm.maxRoomTempC = Number(el.value) || 35));
    on(`${prefix}-rm-other`, (el) => (rm.otherRoomHeatKW = Math.max(0, Number(el.value) || 0)));
    on(`${prefix}-rm-louver`, (el) => (rm.louverFreeAreaM2 = Math.max(0.05, Number(el.value) || 0.5)));
    on(`${prefix}-rm-stack`, (el) => (rm.stackHeightM = Math.max(0.5, Number(el.value) || 4)));
    on(`${prefix}-rm-ov-en`, (el) => (rm.useOverrideHeatKW = el.checked));
    on(`${prefix}-rm-ov-kw`, (el) => (rm.overrideHeatKW = Math.max(0, Number(el.value) || 0)));

    const openRoomExplain = () => openExplain('room.ventilation', { switchgearKW: swgKW });
    const btn = document.getElementById(`${prefix}-room-analyse`);
    if (btn) btn.addEventListener('click', openRoomExplain);
    container.querySelectorAll('[data-room-explain]').forEach((box) => box.addEventListener('click', openRoomExplain));
  }

  // --- TAB 6 (Detailed Mode): Switchroom Cooling & Airflow ---
  function renderRoomView(evalRes) {
    const el = document.getElementById('room-container');
    if (!el) return;
    const swgKW = evalRes.totals.grandTotalKW;
    const rv = window.SGPhysics.calcRoomVentilation(project.room, swgKW, project.config.hvacSafetyMarginPct);
    el.innerHTML = renderRoomCoolingCardHTML(rv, project.room, 'det');
    bindRoomCoolingEvents(el, 'det', swgKW);
  }

  // --- SIMPLE MODE WORKSPACE (Rapid Assessment + Seamless Upgrade to Detailed Mode) ---
  function renderSimpleWorkspace() {
    const ws = document.getElementById('simple-workspace');
    if (!ws) return;
    const sm = project.simpleMode;
    const sim = window.SGPhysics.evaluateSimpleMode(project);
    const act = sim.active;
    const rv = window.SGPhysics.calcRoomVentilation(project.room, act.totalKW, project.config.hvacSafetyMarginPct);

    const bbPresets = window.SGCatalog.BUSBAR_PRESETS.filter((p) => !p.id.startsWith('bb-v'));
    const dolTemplates = project.deviceLibrary.filter((t) => t.category === 'DOL Starter' || t.category === 'Star-Delta Starter' || t.category === 'Soft Starter');
    const vsdTemplates = project.deviceLibrary.filter((t) => t.category === 'VSD / Inverter');
    const fdrTemplates = project.deviceLibrary.filter((t) => t.category === 'MCCB' || t.category === 'HRC Fuse-Switch' || t.category === 'MCB');

    ws.innerHTML = `
      <div class="simple-grid">
        <!-- LEFT COLUMN: Minimal Rapid Inputs -->
        <div>
          <div class="card">
            <h3>⚡ Simple Mode — Rapid Switchgear Heat Estimate <span class="card-subtitle">Fewer inputs for quick preliminary sizing</span></h3>
            <div class="form-grid">
              <div class="field full">
                ${lbl('Main Busbar Rating & Construction', 'bb.preset')}
                <select id="sm-bb">
                  ${bbPresets.map((p) => `<option value="${p.id}" ${sm.busbarPresetId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                </select>
                <span class="field-hint">Ex: 1600A = 2×75×6mm (900mm²), 2500A = 2×100×10mm</span>
              </div>
              <div class="field full">
                ${lbl('Switchboard Topology', 'simple.topology')}
                <select id="sm-topo">
                  <option value="single" ${sm.topology === 'single' ? 'selected' : ''}>Single Incomer</option>
                  <option value="single_interconn" ${sm.topology === 'single_interconn' ? 'selected' : ''}>Single Incomer + Firm Supply Interconnector (A→B)</option>
                  <option value="dual_coupler" ${sm.topology === 'dual_coupler' ? 'selected' : ''}>Dual Incomer + Bus-Section Coupler</option>
                  <option value="dual_coupler_interconn" ${sm.topology === 'dual_coupler_interconn' ? 'selected' : ''}>Dual Incomer + Bus Coupler + Interconnector</option>
                </select>
                <span class="field-hint">Defines incomer, coupler &amp; A→B interconnector columns</span>
              </div>
              <div class="field">
                ${lbl('Estimated Columns', 'col.width')}
                <input type="number" id="sm-cols" value="${sm.columnCount}" min="2" max="14" step="1" />
                <span class="field-hint">Typ: 4–8 columns (~${sim.boardLenM.toFixed(1)} m busbar)</span>
              </div>
              <div class="field">
                ${lbl('Manual AC Factor (S)', 'bb.manualS')}
                <input type="number" id="sm-s" value="${sm.manualSFactor}" min="1.0" max="2.0" step="0.05" />
                <span class="field-hint">Typ: 1.20 (2-bar Cu)</span>
              </div>
            </div>

            <div class="insp-section-title" style="margin-top:12px;">Quick Circuit &amp; Starter Counts</div>
            <div class="form-grid" style="margin-top:6px;">
              <div class="field">
                ${lbl('Motor Starters (Qty)', 'tier.template')}
                <input type="number" id="sm-dol-n" value="${sm.dolCount}" min="0" max="30" step="1" />
                <span class="field-hint">DOL / Star-Delta / Soft Starters</span>
              </div>
              <div class="field">
                ${lbl('Typical Starter Size', 'tier.template')}
                <select id="sm-dol-tpl">
                  ${dolTemplates.map((t) => `<option value="${t.id}" ${sm.dolTemplateId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                ${lbl('VSD / Inverter Drives (Qty)', 'tier.template')}
                <input type="number" id="sm-vsd-n" value="${sm.vsdCount}" min="0" max="20" step="1" />
                <span class="field-hint">High heat (~2.5–3.5% kW)</span>
              </div>
              <div class="field">
                ${lbl('Typical VSD Size', 'tier.template')}
                <select id="sm-vsd-tpl">
                  ${vsdTemplates.map((t) => `<option value="${t.id}" ${sm.vsdTemplateId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                ${lbl('Outgoing Feeders / Fuses (Qty)', 'tier.template')}
                <input type="number" id="sm-fdr-n" value="${sm.feederCount}" min="0" max="30" step="1" />
                <span class="field-hint">MCCBs or Eaton HRC Fuse-Switches</span>
              </div>
              <div class="field">
                ${lbl('Typical Feeder / HRC Fuse', 'tier.template')}
                <select id="sm-fdr-tpl">
                  ${fdrTemplates.map((t) => `<option value="${t.id}" ${sm.feederTemplateId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-grid-3" style="margin-top:10px;">
              <div class="field">
                ${lbl('Avg Load (%)', 'simple.loadPct')}
                <input type="number" id="sm-load" value="${sm.avgLoadPct}" min="10" max="100" step="5" />
                <span class="field-hint">Typ: 70–80%</span>
              </div>
              <div class="field">
                ${lbl('Board RDF', 'cfg.rdf')}
                <input type="number" id="sm-rdf" value="${sm.rdf}" min="0.4" max="1.0" step="0.05" />
                <span class="field-hint">Typ: 0.80–0.90</span>
              </div>
              <div class="field">
                ${lbl('Future Growth (%)', 'cfg.growth')}
                <input type="number" id="sm-fut" value="${sm.futureGrowthPct}" min="0" max="100" step="5" />
                <span class="field-hint">Typ: 15–25%</span>
              </div>
            </div>
            ${
              sm.topology === 'single_interconn' || sm.topology === 'dual_coupler_interconn'
                ? `<div class="field" style="margin-top:8px;">
                    ${lbl('N-1 Interconnector Transfer Load to B-Side Board (A)', 'tier.n1Transfer')}
                    <input type="number" id="sm-n1" value="${sm.n1TransferA}" min="0" max="4000" step="50" />
                    <span class="field-hint">Typ: 600–1600 A exported during N-1 firm-supply outage</span>
                  </div>`
                : ''
            }
          </div>

          <div class="expand-cta-box">
            <div>
              <div style="font-weight:800;font-size:13.5px;color:var(--text-0);">Ready to refine individual circuits, SLD &amp; GA?</div>
              <div style="font-size:11.5px;color:var(--text-2);">Auto-generates columns, incomers, starters, Eaton HRC fuses &amp; busbars directly from your Simple Mode inputs above.</div>
            </div>
            <button id="sm-expand-btn" class="btn btn-primary">→ Convert &amp; Open Detailed Mode</button>
          </div>
        </div>

        <!-- RIGHT COLUMN: Instant Live kW Results + Switchroom Cooling Assessment -->
        <div>
          <div class="card">
            <h3>
              Estimated Switchgear Heat Output (kW)
              <div class="action-row">
                ${[
                  ['normal', 'Normal'],
                  ['n1_transfer', 'N-1 Transfer'],
                  ['normal_future', 'Norm+Future'],
                  ['worst_case', 'Worst-Case'],
                ]
                  .map(
                    ([sid, slbl]) =>
                      `<button class="btn btn-sm ${project.activeScenario === sid ? 'btn-primary' : 'btn-secondary'}" data-sm-sc="${sid}">${slbl}</button>`
                  )
                  .join('')}
              </div>
            </h3>
            <div class="room-metrics-grid">
              <div class="kpi-card hero">
                <span class="kpi-label">Active Simple Estimate</span>
                <span class="kpi-value">${act.totalKW.toFixed(2)} kW</span>
                <span class="kpi-sub">${act.totalW.toFixed(0)} W · ${Math.round(act.totalW * 3.41214).toLocaleString()} BTU/hr</span>
              </div>
              <div class="kpi-card">
                <span class="kpi-label">Busbars &amp; Joints</span>
                <span class="kpi-value">${(act.busbarW / 1000).toFixed(2)} kW</span>
                <span class="kpi-sub">${act.busbarW.toFixed(0)} W · Peak ${act.hbbPeakWPerM.toFixed(0)} W/m</span>
              </div>
              <div class="kpi-card">
                <span class="kpi-label">Devices &amp; Drives</span>
                <span class="kpi-value">${(act.devicesW / 1000).toFixed(2)} kW</span>
                <span class="kpi-sub">VSD ${act.vsdLoss.toFixed(0)}W · DOL ${act.dolLoss.toFixed(0)}W · Fdr ${act.fdrLoss.toFixed(0)}W</span>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr><th>Scenario</th><th class="num">Total (kW)</th><th class="num">Busbars (W)</th><th class="num">Devices (W)</th><th class="num">Load (A)</th><th class="num">HVAC (+${project.config.hvacSafetyMarginPct}%)</th></tr>
              </thead>
              <tbody>
                ${[
                  ['normal', 'Normal (N)'],
                  ['n1_transfer', 'N-1 Firm Transfer'],
                  ['normal_future', 'Normal + Future'],
                  ['worst_case', 'Worst-Case (N-1 + Future)'],
                ]
                  .map(([sid, slbl]) => {
                    const r = sim.scenarios[sid];
                    const hl = sid === project.activeScenario ? 'font-weight:700;background:var(--accent-dim);' : '';
                    return `<tr style="${hl}">
                      <td>${slbl}</td>
                      <td class="num">${r.totalKW.toFixed(3)}</td>
                      <td class="num">${r.busbarW.toFixed(0)}</td>
                      <td class="num">${r.devicesW.toFixed(0)}</td>
                      <td class="num">${r.totalBoardA.toFixed(0)}</td>
                      <td class="num">${(r.totalKW * (1 + project.config.hvacSafetyMarginPct / 100)).toFixed(2)} kW</td>
                    </tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>

          ${renderRoomCoolingCardHTML(rv, project.room, 'sm')}
        </div>
      </div>
    `;

    // Bind Simple Mode inputs
    const onSm = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { pushUndo(); fn(el.value); renderAll(); });
    };
    onSm('sm-bb', (v) => (sm.busbarPresetId = v));
    onSm('sm-topo', (v) => (sm.topology = v));
    onSm('sm-cols', (v) => (sm.columnCount = Math.max(2, parseInt(v, 10) || 5)));
    onSm('sm-s', (v) => (sm.manualSFactor = Math.max(1.0, Number(v) || 1.2)));
    onSm('sm-dol-n', (v) => (sm.dolCount = Math.max(0, parseInt(v, 10) || 0)));
    onSm('sm-dol-tpl', (v) => (sm.dolTemplateId = v));
    onSm('sm-vsd-n', (v) => (sm.vsdCount = Math.max(0, parseInt(v, 10) || 0)));
    onSm('sm-vsd-tpl', (v) => (sm.vsdTemplateId = v));
    onSm('sm-fdr-n', (v) => (sm.feederCount = Math.max(0, parseInt(v, 10) || 0)));
    onSm('sm-fdr-tpl', (v) => (sm.feederTemplateId = v));
    onSm('sm-load', (v) => (sm.avgLoadPct = Math.min(100, Math.max(10, Number(v) || 75))));
    onSm('sm-rdf', (v) => (sm.rdf = Math.min(1, Math.max(0.3, Number(v) || 0.9))));
    onSm('sm-fut', (v) => (sm.futureGrowthPct = Math.max(0, Number(v) || 0)));
    onSm('sm-n1', (v) => (sm.n1TransferA = Math.max(0, Number(v) || 0)));

    ws.querySelectorAll('[data-sm-sc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        project.activeScenario = btn.dataset.smSc;
        renderAll();
      });
    });

    document.getElementById('sm-expand-btn').addEventListener('click', () => {
      pushUndo();
      window.SGState.applySimpleToDetailed(project);
      selection = { type: 'mainBusbar' };
      activeTab = 'sld';
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'sld'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-sld'));
      renderAll();
    });

    bindRoomCoolingEvents(ws, 'sm', act.totalKW);
  }

  // --- Theme Persistence & Switcher ---
  const THEME_KEY = 'sg_heat_calc_theme_v1';
  function applyTheme(themeId) {
    const t = themeId || 'dark';
    document.documentElement.dataset.theme = t;
    const sel = document.getElementById('theme-select');
    if (sel) sel.value = t;
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch (e) {}
  }

  // --- Wire Static Shell Controls ---
  function initControls() {
    // Load saved theme
    let savedTheme = 'dark';
    try {
      savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    } catch (e) {}
    applyTheme(savedTheme);

    document.getElementById('theme-select').addEventListener('change', (e) => {
      applyTheme(e.target.value);
      renderAll(true);
    });

    // Simple Mode vs Detailed Mode Toggle
    document.getElementById('mode-btn-simple').addEventListener('click', () => {
      project.uiMode = 'simple';
      renderAll();
    });
    document.getElementById('mode-btn-detailed').addEventListener('click', () => {
      project.uiMode = 'detailed';
      renderAll();
    });
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + activeTab));
        renderAll(true);
      });
    });

    // Undo button & Ctrl+Z
    document.getElementById('btn-undo').addEventListener('click', performUndo);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        performUndo();
      }
    });

    document.getElementById('preset-select').addEventListener('change', (e) => {
      const v = e.target.value;
      if (!v) return;
      pushUndo();
      if (v === 'default') project = window.SGState.createDefaultProject();
      else if (v === 'dual') project = window.SGState.createDualIncomerProject();
      else if (v === 'blank') project = window.SGState.createBlankProject();
      selection = { type: 'mainBusbar' };
      e.target.value = '';
      renderAll();
    });

    // SLD toolbar buttons & zoom
    document.getElementById('sld-add-col').addEventListener('click', () => addNewColumn('feeders'));
    document.getElementById('sld-add-spare-col').addEventListener('click', () => addNewColumn('spare'));
    document.getElementById('sld-add-inc').addEventListener('click', () => addNewColumn('incomer'));
    document.getElementById('sld-add-coupler').addEventListener('click', () => addNewColumn('coupler'));
    document.getElementById('sld-add-interconn').addEventListener('click', () => addNewColumn('interconnector'));
    document.getElementById('sld-select-hbb').addEventListener('click', () => {
      selection = { type: 'mainBusbar' };
      renderAll();
    });
    document.getElementById('sld-export-svg').addEventListener('click', () => {
      window.SGReport.exportSVG('sld-svg', `${project.meta.projectNumber || 'switchgear'}_SLD.svg`);
    });
    document.getElementById('sld-zoom-in').addEventListener('click', () => setZoom('sld', sldZoom + 0.15));
    document.getElementById('sld-zoom-out').addEventListener('click', () => setZoom('sld', sldZoom - 0.15));
    document.getElementById('sld-zoom-fit').addEventListener('click', () => fitZoom('sld'));
    document.getElementById('sld-zoom-reset').addEventListener('click', () => setZoom('sld', 1.0));
    document.getElementById('sld-container').addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom('sld', sldZoom + (e.deltaY < 0 ? 0.1 : -0.1));
        }
      },
      { passive: false }
    );

    // GA toolbar buttons & zoom
    document.getElementById('ga-opt-heatmap').addEventListener('change', (e) => {
      gaOptions.showHeatmap = e.target.checked;
      renderAll(true);
    });
    document.getElementById('ga-opt-dims').addEventListener('change', (e) => {
      gaOptions.showDimensions = e.target.checked;
      renderAll(true);
    });
    document.getElementById('ga-opt-busbars').addEventListener('change', (e) => {
      gaOptions.showBusbars = e.target.checked;
      renderAll(true);
    });
    document.getElementById('ga-add-spare-col').addEventListener('click', () => addNewColumn('spare'));
    document.getElementById('ga-export-svg').addEventListener('click', () => {
      window.SGReport.exportSVG('ga-svg', `${project.meta.projectNumber || 'switchgear'}_GA.svg`);
    });
    document.getElementById('ga-zoom-in').addEventListener('click', () => setZoom('ga', gaZoom + 0.15));
    document.getElementById('ga-zoom-out').addEventListener('click', () => setZoom('ga', gaZoom - 0.15));
    document.getElementById('ga-zoom-fit').addEventListener('click', () => fitZoom('ga'));
    document.getElementById('ga-zoom-reset').addEventListener('click', () => setZoom('ga', 1.0));
    document.getElementById('ga-container').addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom('ga', gaZoom + (e.deltaY < 0 ? 0.1 : -0.1));
        }
      },
      { passive: false }
    );

    // File Save / Load / Share / Export / Print
    document.getElementById('btn-save-json').addEventListener('click', () => window.SGReport.exportJSON(project));
    document.getElementById('btn-load-json').addEventListener('click', () => document.getElementById('file-load-json').click());
    document.getElementById('file-load-json').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (parsed && parsed.columns && parsed.mainBusbar) {
            pushUndo();
            project = parsed;
            selection = { type: 'mainBusbar' };
            renderAll();
          } else {
            alert('Invalid project JSON format.');
          }
        } catch (err) {
          alert('Failed to parse JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('btn-share-link').addEventListener('click', () => {
      const btn = document.getElementById('btn-share-link');
      try {
        const json = JSON.stringify(project);
        const b64 = btoa(unescape(encodeURIComponent(json)));
        const base = window.location.href.split('#')[0];
        const shareUrl = `${base}#data=${encodeURIComponent(b64)}`;
        window.history.replaceState(null, '', `#data=${encodeURIComponent(b64)}`);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            btn.textContent = '✓ Link Copied!';
            setTimeout(() => (btn.textContent = 'Share Link'), 2000);
          });
        } else {
          prompt('Copy shareable URL:', shareUrl);
        }
      } catch (err) {
        alert('Could not create share link: ' + err.message);
      }
    });

    document.getElementById('btn-export-csv').addEventListener('click', () => {
      const allScenarios = window.SGPhysics.evaluateAllScenarios(project);
      const activeSc = allScenarios.find((s) => s.id === project.activeScenario) || allScenarios[0];
      window.SGReport.exportCSV(project, activeSc.result, allScenarios);
    });

    document.getElementById('btn-print-report').addEventListener('click', () => {
      const allScenarios = window.SGPhysics.evaluateAllScenarios(project);
      const activeSc = allScenarios.find((s) => s.id === project.activeScenario) || allScenarios[0];
      triggerConfiguredPrint(activeSc.result, allScenarios);
    });

    // Privacy & Data Storage Modal
    document.getElementById('btn-privacy').addEventListener('click', openPrivacyModal);
    document.getElementById('btn-privacy-footer').addEventListener('click', openPrivacyModal);

    // Background Version Check (detects fresh GitHub/Cloudflare deployments automatically)
    checkForAppUpdate();
  }

  function openPrivacyModal() {
    let overlay = document.getElementById('privacy-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'privacy-modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    }

    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Data Privacy, Storage & Security Notice">
        <div class="modal-header">
          <div>
            <span class="pill-badge">Version ${APP_VERSION} · Client-Side Only</span>
            <h2 class="modal-title">🔒 Data Privacy, Storage &amp; Security Notice</h2>
          </div>
          <div class="modal-header-actions">
            <button id="privacy-close-btn" class="btn btn-sm btn-secondary">✕ Close</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="privacy-callout">
            <strong>⚠️ Advisory on Sensitive Information:</strong> Do <strong>NOT</strong> enter confidential, security-classified, critical national infrastructure (CNI), defence, or client-restricted site details (such as real site names, confidential tag trees, or proprietary contract numbers). Use anonymised or generic labels (e.g. <code>MSB-A</code>, <code>Pump 1</code>, <code>Area 1</code>) instead.
          </div>
          <div class="privacy-list">
            <div class="privacy-item">
              <h4>1. Server Storage &amp; Network Transmission: NONE (0 Bytes)</h4>
              <p>This calculator is 100% static client-side HTML, CSS, and JavaScript. There is no backend database, no user account system, no third-party analytics/trackers, and no external CDN scripts. None of your switchboard parameters, circuit loads, or calculations are ever sent to Cloudflare, GitHub, or any remote server.</p>
            </div>
            <div class="privacy-item">
              <h4>2. How Auto-Save Works (Browser localStorage)</h4>
              <p>As you edit, your project state and selected colour theme are saved locally inside <strong>your browser's own <code>localStorage</code></strong> on this computer so work is not lost if you refresh. Data remains strictly on your local device unless you export or clear it.</p>
            </div>
            <div class="privacy-item">
              <h4>3. Manual File Exports (JSON / CSV / SVG / Print PDF)</h4>
              <p>Clicking <strong>Save JSON</strong>, <strong>Export CSV</strong>, <strong>Export SVG</strong>, or <strong>Print / PDF Report</strong> generates files locally in your browser's memory and saves them directly to your computer—nothing is uploaded.</p>
            </div>
            <div class="privacy-item">
              <h4>4. How "Share Link" Works (#data= URL Fragment)</h4>
              <p>Clicking <strong>Share Link</strong> encodes your project JSON into the browser URL hash (<code>#data=...</code>). Although URL hash fragments are not sent in standard HTTP requests to servers, <strong>anyone who receives that link can decode the project data inside it</strong>. Only share links containing non-sensitive, anonymised board data.</p>
            </div>
            <div class="privacy-item">
              <h4>5. Version Tracking &amp; Updates</h4>
              <p>When hosted on the web, the app checks <code>version.json</code> (a read-only static file containing only the release number) with cache disabled so you are alerted immediately whenever a newer GitHub/Cloudflare deployment goes live.</p>
            </div>
          </div>
          <div class="action-row" style="margin-top:8px;justify-content:space-between;align-items:center;">
            <span class="toolbar-hint">Using a shared workstation? Wipe your locally stored project below.</span>
            <button id="privacy-clear-btn" class="btn btn-sm btn-danger">Clear Browser Saved Data &amp; Reset</button>
          </div>
        </div>
      </div>
    `;

    overlay.classList.add('open');
    document.getElementById('privacy-close-btn').addEventListener('click', () => overlay.classList.remove('open'));
    document.getElementById('privacy-clear-btn').addEventListener('click', () => {
      window.SGState.clearSavedData();
      window.history.replaceState(null, '', window.location.pathname);
      project = window.SGState.createDefaultProject();
      selection = { type: 'mainBusbar' };
      undoStack.length = 0;
      applyTheme('dark');
      overlay.classList.remove('open');
      renderAll();
    });
  }

  function checkForAppUpdate() {
    if (window.location.protocol === 'file:') return;
    const statusEl = document.getElementById('update-status');
    const check = () => {
      fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !data.version || !statusEl) return;
          if (data.version !== APP_VERSION) {
            statusEl.textContent = `🔄 New version v${data.version} live — Click to update`;
            statusEl.classList.add('has-update');
            statusEl.onclick = () => {
              const url = new URL(window.location.href);
              url.searchParams.set('v', data.version);
              window.location.href = url.toString();
            };
          } else {
            statusEl.textContent = `v${APP_VERSION} · Up to date`;
            statusEl.classList.remove('has-update');
          }
        })
        .catch(() => {});
    };
    check();
    setInterval(check, 60000);
  }

  initControls();
  renderAll();
})();
