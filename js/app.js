/**
 * Main Application Controller
 * Binds UI interactions, live Inspector panels with typical-value hints,
 * click-to-analyse calculation breakdowns (SGExplain), Schedules, Device Library,
 * Config, URL sharing, and Exports.
 */

(function () {
  'use strict';

  function loadInitialProject() {
    try {
      const hash = window.location.hash || '';
      if (hash.startsWith('#data=')) {
        const b64 = decodeURIComponent(hash.slice(6));
        const json = decodeURIComponent(escape(atob(b64)));
        const parsed = JSON.parse(json);
        if (parsed && parsed.columns && parsed.mainBusbar && parsed.config) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not decode shared URL state:', e);
    }
    return window.SGState.loadProject();
  }

  let project = loadInitialProject();
  let selection = { type: 'mainBusbar' }; // { type: 'mainBusbar' } | { type: 'column', colIndex } | { type: 'tier', colIndex, tierIndex }
  let activeTab = 'sld';
  let gaOptions = { showHeatmap: true, showDimensions: true, showBusbars: true };
  let lastEvalRes = null;

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openExplain(key, ctx) {
    if (!lastEvalRes || !window.SGExplain) return;
    window.SGExplain.openModal(key, ctx || {}, project, lastEvalRes);
  }

  function renderAll(skipInspectorRebuild) {
    window.SGState.saveProject(project);
    const allScenarios = window.SGPhysics.evaluateAllScenarios(project);
    const activeScObj = allScenarios.find((s) => s.id === project.activeScenario) || allScenarios[0];
    const evalRes = activeScObj.result;
    lastEvalRes = evalRes;

    renderScenarioBar(allScenarios);
    renderKPIs(evalRes);
    renderSLDView(evalRes);
    renderGAView(evalRes);
    if (activeTab === 'schedules') renderSchedulesView(evalRes, allScenarios);
    if (activeTab === 'library') renderLibraryView();
    if (activeTab === 'config') renderConfigView(evalRes);
    if (!skipInspectorRebuild) renderInspector(evalRes);
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
      `<span class="toolbar-hint" style="margin-left:auto;">Tip: Click any KPI card or calculated figure to inspect its worked formula &amp; commentary.</span>`;

    bar.querySelectorAll('.scenario-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        project.activeScenario = btn.dataset.scenario;
        renderAll();
      });
    });
  }

  // --- KPI Cards (All Clickable to Analyse) ---
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

  // --- SLD View ---
  function renderSLDView(evalRes) {
    const container = document.getElementById('sld-container');
    container.innerHTML = window.SGSLD.renderSLD(project, evalRes, selection);
    bindDiagramEvents(container);
  }

  // --- GA View ---
  function renderGAView(evalRes) {
    const container = document.getElementById('ga-container');
    container.innerHTML = window.SGGA.renderGA(project, evalRes, selection, gaOptions);
    bindDiagramEvents(container);
  }

  function bindDiagramEvents(container) {
    container.querySelectorAll('[data-select-type]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
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
      });
    });

    container.querySelectorAll('[data-action="add-tier"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        addTierToColumn(Number(el.dataset.colIndex), 'dol-22kw');
      });
    });

    container.querySelectorAll('[data-action="add-column"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        addNewColumn('feeders');
      });
    });
  }

  function addTierToColumn(colIndex, templateId) {
    const col = project.columns[colIndex];
    if (!col) return;
    const nextNum = col.tiers.length + 1;
    const newTier = window.SGState.makeTierFromTemplate(
      templateId || 'mccb-250',
      { tag: `F-${colIndex + 1}0${nextNum}` },
      project.deviceLibrary
    );
    col.tiers.push(newTier);
    selection = { type: 'tier', colIndex, tierIndex: col.tiers.length - 1 };
    renderAll();
  }

  function addNewColumn(kind) {
    const num = project.columns.length + 1;
    const col = {
      id: window.SGState.uid('col'),
      name: `COL-0${num} ${kind === 'incomer' ? 'Incomer' : kind === 'coupler' ? 'Bus Coupler' : kind === 'interconnector' ? 'Interconnector' : 'MCC / Feeders'}`,
      widthMm: 800,
      verticalBusbar: kind === 'incomer' || kind === 'coupler' ? null : JSON.parse(JSON.stringify(project.defaultVerticalBusbar)),
      tiers: [],
    };
    if (kind === 'incomer') {
      col.tiers.push(window.SGState.makeTierFromTemplate('acb-2500', { tag: `INC-${num}`, role: 'incomer' }, project.deviceLibrary));
    } else if (kind === 'coupler') {
      col.tiers.push(window.SGState.makeTierFromTemplate('coupler-2500', { tag: `BC-${num}`, role: 'bus_coupler', couplerState: 'open' }, project.deviceLibrary));
    } else if (kind === 'interconnector') {
      col.tiers.push(window.SGState.makeTierFromTemplate('interconn-1600', { tag: `IC-${num}`, role: 'interconnector' }, project.deviceLibrary));
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
          <label>Quick Preset (Standard Construction)</label>
          <select id="bb-preset">
            <option value="">— Custom Construction —</option>
            ${presets.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
          </select>
          <span class="field-hint">Ex: 1600A = 2×75×6mm (900mm²), 2500A = 2×100×10mm, VBB = 1×60×6mm</span>
        </div>
        <div class="field">
          <label>Type 439 / IEC 61439 Certificate Ref</label>
          <input type="text" id="bb-cert" value="${esc(bb.certRef || '')}" placeholder="e.g. ASTA / BS EN 60439-1 Cert #12345" />
          <span class="field-hint">Ex: BS EN 60439-1 Type 439 Cert — 2×75×6mm Cu</span>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Rated Current In (A)</label>
            <input type="number" id="bb-rated" value="${bb.ratedCurrentA}" min="100" step="50" placeholder="1600" />
            <span class="field-hint">Typ: 630–4000 A (HBB) / 400–1600 A (VBB)</span>
          </div>
          <div class="field">
            <label>Conductor Material</label>
            <select id="bb-mat">
              ${matOpts.map((m) => `<option value="${m.id}" ${bb.material === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select>
            <span class="field-hint">Typ: Cu 100% IACS (ρ=0.01724 Ω·mm²/m)</span>
          </div>
        </div>
      </div>

      <div class="insp-section">
        <div class="insp-section-title">Conductor Dimensions (Per Phase)</div>
        <div class="form-grid-3">
          <div class="field">
            <label>Bars / Ph</label>
            <input type="number" id="bb-bars" value="${bb.barsPerPhase}" min="1" max="8" step="1" placeholder="2" />
            <span class="field-hint">Typ: 1–4 bars</span>
          </div>
          <div class="field">
            <label>Width (mm)</label>
            <input type="number" id="bb-w" value="${bb.widthMm}" min="10" max="200" step="5" placeholder="75" />
            <span class="field-hint">Typ: 40–100mm</span>
          </div>
          <div class="field">
            <label>Thick (mm)</label>
            <input type="number" id="bb-t" value="${bb.thicknessMm}" min="3" max="20" step="1" placeholder="6" />
            <span class="field-hint">Typ: 5, 6, 8, 10</span>
          </div>
        </div>
        <div class="form-grid-3">
          <div class="field">
            <label>Bar Gap (mm)</label>
            <input type="number" id="bb-gap" value="${bb.gapMm || bb.thicknessMm}" min="2" max="30" placeholder="6" />
            <span class="field-hint">Typ: = bar thick</span>
          </div>
          <div class="field">
            <label>Phase Ctr (mm)</label>
            <input type="number" id="bb-spacing" value="${bb.phaseSpacingMm || 120}" min="40" max="400" step="5" placeholder="120" />
            <span class="field-hint">Typ: 90–160mm</span>
          </div>
          <div class="field">
            <label>Op Temp (°C)</label>
            <input type="number" id="bb-temp" value="${bb.operatingTempC}" min="20" max="125" step="5" placeholder="70" />
            <span class="field-hint">Typ: 70–85°C</span>
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Bar Orientation</label>
            <select id="bb-orient">
              <option value="edge" ${bb.orientation !== 'flat' ? 'selected' : ''}>Edge-on (Standard)</option>
              <option value="flat" ${bb.orientation === 'flat' ? 'selected' : ''}>Flat-on</option>
            </select>
            <span class="field-hint">Edge-on gives better cooling &amp; lower prox</span>
          </div>
          <div class="field">
            <label>Neutral Bar Sizing</label>
            <select id="bb-neutral">
              <option value="1" ${bb.neutralSizeRatio === 1 ? 'selected' : ''}>100% of Phase</option>
              <option value="0.5" ${bb.neutralSizeRatio === 0.5 ? 'selected' : ''}>50% of Phase</option>
              <option value="0" ${bb.neutralSizeRatio === 0 ? 'selected' : ''}>No Neutral (3P)</option>
            </select>
            <span class="field-hint">Typ: 50% (industrial) or 100% (harmonics)</span>
          </div>
        </div>
      </div>

      <div class="insp-section">
        <div class="insp-section-title">DC → AC Conversion (Skin &amp; Proximity)</div>
        <div class="form-grid">
          <div class="field">
            <label>AC Factor Method</label>
            <select id="bb-acmode">
              <option value="manual" ${bb.acFactorMode !== 'calculated' ? 'selected' : ''}>Manual Factor (S)</option>
              <option value="calculated" ${bb.acFactorMode === 'calculated' ? 'selected' : ''}>Calculated Skin/Prox</option>
            </select>
            <span class="field-hint">Choose manual S or calculated skin/prox</span>
          </div>
          <div class="field">
            <label>${bb.acFactorMode === 'calculated' ? 'Enclosure Eddy (ye)' : 'Manual Factor S'}</label>
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
      if (el) el.addEventListener('change', () => { fn(el.value); renderAll(); });
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
          <label>Column Name</label>
          <input type="text" id="col-name" value="${esc(col.name)}" placeholder="e.g. COL-02 MCC Tier 1" />
          <span class="field-hint">Ex: COL-01 Incomer, COL-02 MCC, COL-05 Interconnector</span>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Cubicle Width (mm)</label>
            <input type="number" id="col-width" value="${col.widthMm}" min="300" max="2000" step="50" placeholder="800" />
            <span class="field-hint">Typ: 600, 800, 1000 mm (drives HBB length)</span>
          </div>
          <div class="field">
            <label>X Centreline (mm)</label>
            <input type="text" value="${Math.round(cr.xCenterMm)} mm" disabled />
            <span class="field-hint">Auto-computed from left edge of board</span>
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
        <div class="insp-section-title">Add Compartment / Tier to Column</div>
        <div class="field">
          <label>Select Device / Starter Template</label>
          <select id="col-add-tpl">
            ${project.deviceLibrary.map((t) => `<option value="${t.id}">[${esc(t.category)}] ${esc(t.name)}</option>`).join('')}
          </select>
          <span class="field-hint">Templates include typical IEC rated &amp; fixed coil losses</span>
        </div>
        <button id="col-add-tier-btn" class="btn btn-sm btn-primary">+ Add Selected Tier to ${esc(col.name)}</button>
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
      col.name = e.target.value;
      renderAll();
    });
    document.getElementById('col-width').addEventListener('change', (e) => {
      col.widthMm = Math.max(300, Number(e.target.value) || 800);
      renderAll();
    });
    document.getElementById('col-move-left').addEventListener('click', () => {
      if (colIdx <= 0) return;
      const tmp = project.columns[colIdx - 1];
      project.columns[colIdx - 1] = project.columns[colIdx];
      project.columns[colIdx] = tmp;
      selection = { type: 'column', colIndex: colIdx - 1 };
      renderAll();
    });
    document.getElementById('col-move-right').addEventListener('click', () => {
      if (colIdx >= project.columns.length - 1) return;
      const tmp = project.columns[colIdx + 1];
      project.columns[colIdx + 1] = project.columns[colIdx];
      project.columns[colIdx] = tmp;
      selection = { type: 'column', colIndex: colIdx + 1 };
      renderAll();
    });
    document.getElementById('col-delete').addEventListener('click', () => {
      if (project.columns.length <= 1) return;
      project.columns.splice(colIdx, 1);
      selection = { type: 'mainBusbar' };
      renderAll();
    });
    document.getElementById('col-add-tier-btn').addEventListener('click', () => {
      const tplId = document.getElementById('col-add-tpl').value;
      addTierToColumn(colIdx, tplId);
    });
  }

  function renderTierInspector(container, col, tier, tr, colIdx, tierIdx) {
    const dl = tr.deviceLoss || { iOp: 0, iRated: tier.ratedCurrentA, loadRatio: 0, loadRatioSq: 0, pFixedW: 0, pVarW: 0, pTotalW: 0, breakdown: [] };
    const isInterconn = tier.role === 'interconnector';
    const isIncomer = tier.role === 'incomer';
    const isCoupler = tier.role === 'bus_coupler';
    const isFeeder = tier.role === 'feeder';

    container.innerHTML = `
      <div class="insp-section">
        <div class="insp-section-title">Compartment Identity &amp; GA Position</div>
        <div class="form-grid">
          <div class="field">
            <label>Tag / Circuit ID</label>
            <input type="text" id="t-tag" value="${esc(tier.tag)}" placeholder="e.g. M-101 or F-301" />
            <span class="field-hint">Ex: INC-A, M-101, VSD-202, IC-AB</span>
          </div>
          <div class="field">
            <label>Status</label>
            <select id="t-status">
              <option value="active" ${tier.status === 'active' ? 'selected' : ''}>Active (Running)</option>
              <option value="future" ${tier.status === 'future' ? 'selected' : ''}>Future Capacity</option>
              <option value="standby" ${tier.status === 'standby' ? 'selected' : ''}>Standby / Off</option>
            </select>
            <span class="field-hint">Future loads activate in Future scenarios</span>
          </div>
          <div class="field full">
            <label>Description</label>
            <input type="text" id="t-desc" value="${esc(tier.description)}" placeholder="e.g. Cooling Water Pump 1 — 55 kW DOL" />
            <span class="field-hint">Shown on schedules &amp; PDF report</span>
          </div>
          <div class="field">
            <label>Role</label>
            <select id="t-role">
              <option value="feeder" ${isFeeder ? 'selected' : ''}>Outgoing Feeder / Starter</option>
              <option value="incomer" ${isIncomer ? 'selected' : ''}>Main Incomer</option>
              <option value="bus_coupler" ${isCoupler ? 'selected' : ''}>Bus-Section Coupler</option>
              <option value="interconnector" ${isInterconn ? 'selected' : ''}>Interconnector (Firm Supply)</option>
            </select>
            <span class="field-hint">Defines current flow direction on busbars</span>
          </div>
          <div class="field">
            <label>Tier Height (mm)</label>
            <input type="number" id="t-height" value="${tier.heightMm}" min="120" max="1600" step="20" placeholder="300" />
            <span class="field-hint">Typ: 200–350 DOL, 600 VSD, 800 ACB</span>
          </div>
        </div>
        <div class="field">
          <label>Apply Device / Starter Template</label>
          <select id="t-template">
            <option value="">— Keep Custom Settings —</option>
            ${project.deviceLibrary.map((t) => `<option value="${t.id}" ${tier.templateId === t.id ? 'selected' : ''}>[${esc(t.category)}] ${esc(t.name)}</option>`).join('')}
          </select>
          <span class="field-hint">Auto-fills typical rated In, Pn (W), fixed coil W &amp; height</span>
        </div>
        <div class="action-row">
          <button id="t-up" class="btn btn-sm btn-secondary" ${tierIdx === 0 ? 'disabled' : ''}>↑ Up</button>
          <button id="t-down" class="btn btn-sm btn-secondary" ${tierIdx === col.tiers.length - 1 ? 'disabled' : ''}>↓ Down</button>
          <button id="t-dup" class="btn btn-sm btn-secondary">Duplicate</button>
          <button id="t-del" class="btn btn-sm btn-danger">Delete</button>
        </div>
      </div>

      ${
        isIncomer
          ? `<div class="insp-section">
              <div class="insp-section-title">Incomer Switching State</div>
              <div class="field">
                <label>Breaker Position</label>
                <select id="t-inc-state">
                  <option value="closed" ${tier.incomerState !== 'open' ? 'selected' : ''}>CLOSED (Energized / Supplying Bus)</option>
                  <option value="open" ${tier.incomerState === 'open' ? 'selected' : ''}>OPEN (Isolated / Out of Service)</option>
                </select>
                <span class="field-hint">Typ: CLOSED normal; OPEN to simulate Tx outage (with closed coupler)</span>
              </div>
              <div class="toolbar-hint">Operating current is automatically summed from all active loads &amp; N-1 interconnector transfer in this electrical section.</div>
            </div>`
          : ''
      }

      ${
        isCoupler
          ? `<div class="insp-section">
              <div class="insp-section-title">Bus-Section Coupler State</div>
              <div class="field">
                <label>Coupler Position</label>
                <select id="t-coupler-state">
                  <option value="open" ${tier.couplerState !== 'closed' ? 'selected' : ''}>OPEN (Split Bus Sections)</option>
                  <option value="closed" ${tier.couplerState === 'closed' ? 'selected' : ''}>CLOSED (Coupled / Single Incomer Feeding Both)</option>
                </select>
                <span class="field-hint">Typ: OPEN under dual-Tx normal, CLOSED during N-1 Tx outage</span>
              </div>
            </div>`
          : ''
      }

      ${
        isInterconn
          ? `<div class="insp-section">
              <div class="insp-section-title">Firm Supply Interconnector (A → B Side)</div>
              <div class="field">
                <label>Remote Switchboard Name</label>
                <input type="text" id="t-remote-board" value="${esc(tier.remoteBoardName || 'MSB-B (Firm Supply)')}" placeholder="e.g. MSB-B (Firm Supply)" />
                <span class="field-hint">Ex: MSB-B, Switchboard B-Side</span>
              </div>
              <div class="form-grid">
                <div class="field">
                  <label>Normal Transfer (A)</label>
                  <input type="number" id="t-norm-a" value="${tier.normalTransferCurrentA || 0}" min="0" step="10" placeholder="0" />
                  <span class="field-hint">Typ: 0 A when A &amp; B run split</span>
                </div>
                <div class="field">
                  <label>N-1 Transfer Load (A)</label>
                  <input type="number" id="t-n1-a" value="${tier.n1TransferCurrentA || 850}" min="0" step="10" placeholder="850" />
                  <span class="field-hint">Typ: 600–1600 A (B-side board load)</span>
                </div>
              </div>
              <div class="insp-section-title" style="margin-top:6px;">Internal Interconnector Cable Entry Loss</div>
              <label class="toggle-chip"><input type="checkbox" id="t-cable-en" ${tier.cableSpec && tier.cableSpec.includeCableLoss ? 'checked' : ''} /> Include internal cable riser heat loss</label>
              <div class="form-grid-3">
                <div class="field">
                  <label>Cables/Ph</label>
                  <input type="number" id="t-cable-n" value="${(tier.cableSpec && tier.cableSpec.cablesPerPhase) || 3}" min="1" max="8" placeholder="3" />
                  <span class="field-hint">Typ: 2–4×/ph</span>
                </div>
                <div class="field">
                  <label>CSA (mm²)</label>
                  <input type="number" id="t-cable-csa" value="${(tier.cableSpec && tier.cableSpec.csaMm2) || 240}" min="16" max="630" placeholder="240" />
                  <span class="field-hint">Typ: 185–300</span>
                </div>
                <div class="field">
                  <label>Length (m)</label>
                  <input type="number" id="t-cable-len" value="${(tier.cableSpec && tier.cableSpec.internalLengthM) || 2.5}" min="0" step="0.5" placeholder="2.5" />
                  <span class="field-hint">Typ: 1.5–3.5 m</span>
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
                  <label>Load Entry Mode</label>
                  <select id="t-load-mode">
                    <option value="kw" ${tier.loadInputMode === 'kw' ? 'selected' : ''}>Motor / Load kW</option>
                    <option value="amps" ${tier.loadInputMode !== 'kw' ? 'selected' : ''}>Direct Amps (Iop)</option>
                  </select>
                  <span class="field-hint">Use kW for motors, Amps for sub-DBs</span>
                </div>
                <div class="field">
                  <label>Duty / Load Factor</label>
                  <input type="number" id="t-load-factor" value="${tier.loadFactor != null ? tier.loadFactor : 1.0}" min="0" max="1.25" step="0.05" placeholder="0.85" />
                  <span class="field-hint">Typ: 0.80–0.90 pumps/fans, 1.0 cont.</span>
                </div>
              </div>
              ${
                tier.loadInputMode === 'kw'
                  ? `<div class="form-grid-3">
                      <div class="field">
                        <label>Power (kW)</label>
                        <input type="number" id="t-kw" value="${tier.loadKw || 0}" min="0" step="0.5" placeholder="37" />
                        <span class="field-hint">Ex: 7.5–110 kW</span>
                      </div>
                      <div class="field">
                        <label>PF (cosφ)</label>
                        <input type="number" id="t-pf" value="${tier.powerFactor || 0.85}" min="0.2" max="1" step="0.01" placeholder="0.85" />
                        <span class="field-hint">Typ: 0.85 (0.95 VSD)</span>
                      </div>
                      <div class="field">
                        <label>Eff (η)</label>
                        <input type="number" id="t-eff" value="${tier.efficiency || 0.93}" min="0.2" max="1" step="0.01" placeholder="0.93" />
                        <span class="field-hint">Typ: 0.90–0.95 IE3</span>
                      </div>
                    </div>`
                  : `<div class="field">
                      <label>Base Operating Current (A)</label>
                      <input type="number" id="t-amps" value="${tier.operatingCurrentA || 0}" min="0" step="5" placeholder="160" />
                      <span class="field-hint">Typ: 50%–80% of breaker rated In (${Math.round(tier.ratedCurrentA * 0.5)}–${Math.round(tier.ratedCurrentA * 0.8)} A)</span>
                    </div>`
              }
            </div>`
          : ''
      }

      <div class="insp-section">
        <div class="insp-section-title">Manufacturer Loss Data (P_op = P_fix + P_n·(Iop/In)²)</div>
        <div class="form-grid-3">
          <div class="field">
            <label>Rated In (A)</label>
            <input type="number" id="t-in" value="${tier.ratedCurrentA}" min="1" step="10" placeholder="100" />
            <span class="field-hint">Device frame In</span>
          </div>
          <div class="field">
            <label>Rated Pn (W)</label>
            <input type="number" id="t-pn" value="${tier.ratedLossW}" min="0" step="1" ${tier.subComponents ? 'disabled title="Summed from sub-components below"' : ''} placeholder="42" />
            <span class="field-hint">3P loss @ In</span>
          </div>
          <div class="field">
            <label>Fixed W</label>
            <input type="number" id="t-pfix" value="${tier.fixedLossW || 0}" min="0" step="1" ${tier.subComponents ? 'disabled title="Summed from sub-components below"' : ''} placeholder="12" />
            <span class="field-hint">Coil/relay/fan</span>
          </div>
        </div>

        ${
          tier.subComponents && tier.subComponents.length
            ? `<div style="margin-top:4px;">
                <span class="field-hint" style="display:block;margin-bottom:4px;">Typ DOL: MCCB 15–32W, Contactor 10–35W + 8–15W coil, O/L 6–12W, Control 3–5W.</span>
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
      </div>
    `;

    document.getElementById('tier-calc-readout').addEventListener('click', () => {
      openExplain('tier.loss', { colIndex: colIdx, tierIndex: tierIdx });
    });

    const on = (id, ev, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(ev, fn);
    };

    on('t-tag', 'change', (e) => { tier.tag = e.target.value; renderAll(); });
    on('t-status', 'change', (e) => { tier.status = e.target.value; renderAll(); });
    on('t-desc', 'change', (e) => { tier.description = e.target.value; renderAll(); });
    on('t-role', 'change', (e) => { tier.role = e.target.value; renderAll(); });
    on('t-height', 'change', (e) => { tier.heightMm = Math.max(120, Number(e.target.value) || 250); renderAll(); });
    on('t-in', 'change', (e) => { tier.ratedCurrentA = Math.max(1, Number(e.target.value) || 100); renderAll(); });
    on('t-pn', 'change', (e) => { tier.ratedLossW = Math.max(0, Number(e.target.value) || 0); renderAll(); });
    on('t-pfix', 'change', (e) => { tier.fixedLossW = Math.max(0, Number(e.target.value) || 0); renderAll(); });

    on('t-inc-state', 'change', (e) => { tier.incomerState = e.target.value; renderAll(); });
    on('t-coupler-state', 'change', (e) => { tier.couplerState = e.target.value; renderAll(); });
    on('t-remote-board', 'change', (e) => { tier.remoteBoardName = e.target.value; renderAll(); });
    on('t-norm-a', 'change', (e) => { tier.normalTransferCurrentA = Math.max(0, Number(e.target.value) || 0); renderAll(); });
    on('t-n1-a', 'change', (e) => { tier.n1TransferCurrentA = Math.max(0, Number(e.target.value) || 0); renderAll(); });
    on('t-cable-en', 'change', (e) => {
      tier.cableSpec = tier.cableSpec || { material: 'cu_100', cablesPerPhase: 3, csaMm2: 240, internalLengthM: 2.5, operatingTempC: 70 };
      tier.cableSpec.includeCableLoss = e.target.checked;
      renderAll();
    });
    on('t-cable-n', 'change', (e) => { tier.cableSpec.cablesPerPhase = Math.max(1, Number(e.target.value) || 1); renderAll(); });
    on('t-cable-csa', 'change', (e) => { tier.cableSpec.csaMm2 = Math.max(10, Number(e.target.value) || 240); renderAll(); });
    on('t-cable-len', 'change', (e) => { tier.cableSpec.internalLengthM = Math.max(0, Number(e.target.value) || 0); renderAll(); });

    on('t-load-mode', 'change', (e) => { tier.loadInputMode = e.target.value; renderAll(); });
    on('t-load-factor', 'change', (e) => { tier.loadFactor = Math.max(0, Number(e.target.value)); renderAll(); });
    on('t-kw', 'change', (e) => { tier.loadKw = Math.max(0, Number(e.target.value) || 0); renderAll(); });
    on('t-pf', 'change', (e) => { tier.powerFactor = Math.min(1, Math.max(0.1, Number(e.target.value) || 0.85)); renderAll(); });
    on('t-eff', 'change', (e) => { tier.efficiency = Math.min(1, Math.max(0.1, Number(e.target.value) || 0.93)); renderAll(); });
    on('t-amps', 'change', (e) => { tier.operatingCurrentA = Math.max(0, Number(e.target.value) || 0); renderAll(); });

    on('t-template', 'change', (e) => {
      const tpl = project.deviceLibrary.find((x) => x.id === e.target.value);
      if (!tpl) return;
      const c = window.SGCatalog.cloneTemplate(tpl);
      tier.templateId = c.id;
      tier.category = c.category;
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
      const tmp = col.tiers[tierIdx - 1];
      col.tiers[tierIdx - 1] = col.tiers[tierIdx];
      col.tiers[tierIdx] = tmp;
      selection = { type: 'tier', colIndex: colIdx, tierIndex: tierIdx - 1 };
      renderAll();
    });
    on('t-down', 'click', () => {
      if (tierIdx >= col.tiers.length - 1) return;
      const tmp = col.tiers[tierIdx + 1];
      col.tiers[tierIdx + 1] = col.tiers[tierIdx];
      col.tiers[tierIdx] = tmp;
      selection = { type: 'tier', colIndex: colIdx, tierIndex: tierIdx + 1 };
      renderAll();
    });
    on('t-dup', 'click', () => {
      const copy = JSON.parse(JSON.stringify(tier));
      copy.id = window.SGState.uid('tier');
      copy.tag = tier.tag + '-B';
      col.tiers.splice(tierIdx + 1, 0, copy);
      selection = { type: 'tier', colIndex: colIdx, tierIndex: tierIdx + 1 };
      renderAll();
    });
    on('t-del', 'click', () => {
      col.tiers.splice(tierIdx, 1);
      selection = { type: 'column', colIndex: colIdx };
      renderAll();
    });

    container.querySelectorAll('[data-sc-field]').forEach((inp) => {
      inp.addEventListener('change', () => {
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
        tier.subComponents.splice(Number(btn.dataset.scDel), 1);
        if (tier.subComponents.length === 0) tier.subComponents = null;
        renderAll();
      });
    });

    on('t-add-subcomp', 'click', () => {
      tier.subComponents.push({ name: 'Aux / Component', ratedCurrentA: tier.ratedCurrentA, ratedLossW: 10, fixedLossW: 2 });
      renderAll();
    });

    on('t-convert-subcomp', 'click', () => {
      tier.subComponents = [
        { name: tier.category + ' Main Poles', ratedCurrentA: tier.ratedCurrentA, ratedLossW: tier.ratedLossW, fixedLossW: 0 },
        { name: 'Control / Aux Coil', ratedCurrentA: tier.ratedCurrentA, ratedLossW: 0, fixedLossW: tier.fixedLossW || 5 },
      ];
      renderAll();
    });
  }

  // --- TAB 3: Schedules & Audit View (Every Row & Box Clickable to Analyse) ---
  function renderSchedulesView(evalRes, allScenarios) {
    const el = document.getElementById('schedules-container');
    const hr = evalRes.hbbRes;
    const bb = project.mainBusbar;
    const maxScenarioW = Math.max(100, ...allScenarios.map((s) => s.result.totals.grandTotalW));

    el.innerHTML = `
      <!-- 1. 4-Scenario Comparison & Stacked Breakdown -->
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

      <!-- 2. Main Busbar Joule Physics Audit -->
      <div class="card">
        <h3>
          Main Horizontal Busbar Physics Audit <span class="card-subtitle">${esc(bb.certRef)}</span>
          <button class="explain-chip" data-explain-hbb="1">Step-by-Step Derivation ↗</button>
        </h3>
        <div class="physics-grid">
          <div class="physics-box explainable" data-explain-hbb="1" title="Click for step-by-step busbar derivation">
            <div class="p-lbl">Construction / Area</div>
            <div class="p-val">${bb.barsPerPhase} × ${bb.widthMm} × ${bb.thicknessMm} mm</div>
            <div class="p-note">${hr.areaMm2} mm² / phase · ${hr.material.shortName} · Rated ${bb.ratedCurrentA}A</div>
          </div>
          <div class="physics-box explainable" data-explain-hbb="1" title="Click for temperature correction steps">
            <div class="p-lbl">DC Resistance (20°C → ${hr.tempC}°C)</div>
            <div class="p-val">${hr.rDc20_uOhmPerM.toFixed(2)} → ${hr.rDcT_uOhmPerM.toFixed(2)} µΩ/m</div>
            <div class="p-note">Temp factor ×${hr.tempFactor.toFixed(3)} · Click to inspect ↗</div>
          </div>
          <div class="physics-box explainable" data-explain-hbb="1" title="Click for skin & proximity effect derivation">
            <div class="p-lbl">AC Conversion Factor (${hr.acFactorMode})</div>
            <div class="p-val">k_AC = ${hr.kAcUsed.toFixed(3)}</div>
            <div class="p-note">Calc: 1 + ${hr.ys.toFixed(3)} + ${hr.yp.toFixed(3)} + ${hr.ye.toFixed(2)} = ${hr.kAcCalculated.toFixed(3)} (δ=${hr.skinDepthMm.toFixed(1)}mm)</div>
          </div>
          <div class="physics-box explainable" data-explain-hbb="1" title="Click for Joule W/m derivation">
            <div class="p-lbl">AC Resistance &amp; Rated W/m</div>
            <div class="p-val">${hr.rAcT_uOhmPerM.toFixed(2)} µΩ/m</div>
            <div class="p-note">At ${bb.ratedCurrentA}A (3-Ph): ${evalRes.hbbRatedWPerM.toFixed(1)} W/m · Analyse ↗</div>
          </div>
        </div>
      </div>

      <!-- 3. Horizontal Busbar Segment Schedule -->
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
              <tr class="clickable" data-explain-hbb-seg="${sIdx}" title="Click to inspect calculation steps for this horizontal busbar span">
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

      <!-- 4. Vertical Busbar Dropper Schedule -->
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
              <tr class="clickable" data-explain-vbb-seg="${vIdx}" title="Click to inspect vertical dropper calculation steps">
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

      <!-- 5. Protective Devices & Starters Schedule -->
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
                    <td><span class="status-tag ${badgeCls}">${r.role === 'interconnector' ? (r.isActive ? 'N-1 TX' : 'IC IDLE') : r.status}</span></td>
                    <td class="num">${r.ratedCurrentA}</td>
                    <td class="num">${r.iOp.toFixed(1)}</td>
                    <td class="num">${(r.loadRatio * r.loadRatio).toFixed(2)}</td>
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
          For certified temperature-rise compliance inside sealed enclosures, verify against manufacturer IEC 61439-1 / 60890 type-test limits.
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

  // --- TAB 4: Editable Device Library ---
  function renderLibraryView() {
    const el = document.getElementById('library-container');
    el.innerHTML = `
      <div class="card">
        <h3>
          Editable IEC Protective Device &amp; Starter Library
          <button id="lib-add-btn" class="btn btn-sm btn-primary">+ New Custom Device Template</button>
        </h3>
        <div class="lib-typ-banner">
          <span><strong>Typical 3P Losses @ In:</strong></span>
          <span>ACB 1600A: ~260W + 15W aux</span>
          <span>ACB 2500A: ~480W + 18W aux</span>
          <span>MCCB 250A: ~42W (~14W/pole)</span>
          <span>MCCB 400A: ~66W (~22W/pole)</span>
          <span>DOL 37kW: ~55W var + 18W coil/aux</span>
          <span>VSD: ~2.5–3.5% of rated kW + 35–80W fan</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Category <span class="field-hint" style="display:block;text-transform:none;">Ex: ACB, MCCB, DOL</span></th>
              <th>Template Name <span class="field-hint" style="display:block;text-transform:none;">Ex: MCCB 250A (3P)</span></th>
              <th class="num">Rated In (A) <span class="field-hint" style="display:block;text-transform:none;">Typ: 25–3200</span></th>
              <th class="num">Rated Loss Pn (W) <span class="field-hint" style="display:block;text-transform:none;">3P loss @ In</span></th>
              <th class="num">Fixed Loss (W) <span class="field-hint" style="display:block;text-transform:none;">Coil / Trip / Fan</span></th>
              <th class="num">Height (mm) <span class="field-hint" style="display:block;text-transform:none;">Typ: 200–800</span></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${project.deviceLibrary
              .map(
                (t, idx) => `
              <tr>
                <td><input type="text" data-lib-idx="${idx}" data-lib-field="category" value="${esc(t.category)}" style="width:115px;" /></td>
                <td><input type="text" data-lib-idx="${idx}" data-lib-field="name" value="${esc(t.name)}" style="width:240px;" /></td>
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

    el.querySelectorAll('[data-lib-field]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const idx = Number(inp.dataset.libIdx);
        const f = inp.dataset.libField;
        const item = project.deviceLibrary[idx];
        if (!item) return;
        item[f] = f === 'name' || f === 'category' ? inp.value : Number(inp.value) || 0;
        if (f === 'ratedLossW' && item.subComponents) {
          item.subComponents = null;
        }
        window.SGState.saveProject(project);
      });
    });

    el.querySelectorAll('[data-lib-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (project.deviceLibrary.length <= 1) return;
        project.deviceLibrary.splice(Number(btn.dataset.libDel), 1);
        renderAll();
      });
    });

    document.getElementById('lib-add-btn').addEventListener('click', () => {
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

  // --- TAB 5: Global Board & Standards Config (Every Field With Typical Values) ---
  function renderConfigView() {
    const el = document.getElementById('config-container');
    const c = project.config;
    const m = project.meta;

    el.innerHTML = `
      <div class="card">
        <h3>Project Metadata</h3>
        <div class="form-grid">
          <div class="field">
            <label>Project / Switchboard Name</label>
            <input type="text" id="cfg-proj-name" value="${esc(m.projectName)}" placeholder="e.g. MSB-A — Main LV Switchboard" />
            <span class="field-hint">Ex: MSB-A — Main LV Switchboard (Firm Supply A)</span>
          </div>
          <div class="field">
            <label>Document / Calc Reference</label>
            <input type="text" id="cfg-proj-num" value="${esc(m.projectNumber)}" placeholder="e.g. CEI-TH-001" />
            <span class="field-hint">Used in PDF header &amp; exported file names</span>
          </div>
          <div class="field">
            <label>Engineer</label>
            <input type="text" id="cfg-eng" value="${esc(m.engineer)}" placeholder="e.g. CE&I Engineering" />
            <span class="field-hint">Author shown on printed calculation sheet</span>
          </div>
          <div class="field">
            <label>Revision</label>
            <input type="text" id="cfg-rev" value="${esc(m.revision)}" placeholder="e.g. Rev A / P01" />
            <span class="field-hint">Ex: Rev A (Preliminary), Rev C01 (For Construction)</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Electrical System &amp; IEC 61439 Diversity Basis</h3>
        <div class="form-grid-3">
          <div class="field">
            <label>System Voltage V_LL (V)</label>
            <input type="number" id="cfg-v" value="${c.voltageV}" step="5" placeholder="400" />
            <span class="field-hint">Typ: 400 V (IEC/EU) or 415 V (UK legacy)</span>
          </div>
          <div class="field">
            <label>Frequency (Hz)</label>
            <select id="cfg-f">
              <option value="50" ${c.frequencyHz === 50 ? 'selected' : ''}>50 Hz (IEC / UK / EU)</option>
              <option value="60" ${c.frequencyHz === 60 ? 'selected' : ''}>60 Hz</option>
            </select>
            <span class="field-hint">Drives AC skin depth δ (~10.2 mm @ 50Hz Cu)</span>
          </div>
          <div class="field">
            <label>System Poles</label>
            <select id="cfg-poles">
              <option value="3P+N" ${c.poles === '3P+N' ? 'selected' : ''}>3P+N (4-Wire)</option>
              <option value="3P" ${c.poles === '3P' ? 'selected' : ''}>3P (3-Wire)</option>
            </select>
            <span class="field-hint">Typ: 3P+N for mixed sub-DB &amp; MCC boards</span>
          </div>
          <div class="field">
            <label>Neutral Current Ratio (I_N / I_ph)</label>
            <input type="number" id="cfg-nratio" value="${c.neutralCurrentRatio}" min="0" max="1" step="0.05" placeholder="0.10" />
            <span class="field-hint">Typ: 0.00 balanced motors, 0.10–0.25 commercial/VSDs</span>
          </div>
          <div class="field">
            <label>Board Diversity Factor (RDF)</label>
            <input type="number" id="cfg-rdf" value="${c.diversityFactorRDF}" min="0.3" max="1.0" step="0.05" placeholder="0.90" />
            <span class="field-hint">IEC 61439 Table 101 typ: 0.8–0.9 (4–9 circuits), 1.0 worst-case</span>
          </div>
          <div class="field">
            <label>Global Future Load Growth (%)</label>
            <input type="number" id="cfg-growth" value="${c.globalFutureGrowthPct}" min="0" max="100" step="5" placeholder="15" />
            <span class="field-hint">Typ: 15–25% growth applied in Future scenarios</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>General Arrangement Dimensions, Joints &amp; Auxiliaries</h3>
        <div class="form-grid-3">
          <div class="field">
            <label>Panel Height (mm)</label>
            <input type="number" id="cfg-h" value="${c.panelHeightMm}" min="1400" max="2600" step="50" placeholder="2200" />
            <span class="field-hint">Typ: 2000–2200 mm standard LV switchboard</span>
          </div>
          <div class="field">
            <label>Panel Depth (mm)</label>
            <input type="number" id="cfg-d" value="${c.panelDepthMm}" min="400" max="1600" step="50" placeholder="800" />
            <span class="field-hint">Typ: 600–1000 mm (drives cooling area Ae)</span>
          </div>
          <div class="field">
            <label>HBB Chamber Height (mm)</label>
            <input type="number" id="cfg-hbbh" value="${c.hbbChamberHeightMm}" min="200" max="600" step="25" placeholder="350" />
            <span class="field-hint">Typ: 300–450 mm top/bottom busbar chamber</span>
          </div>
          <div class="field">
            <label>Horizontal Busbar Position</label>
            <select id="cfg-hbbpos">
              <option value="top" ${c.hbbPosition === 'top' ? 'selected' : ''}>Top Busbar Chamber</option>
              <option value="bottom" ${c.hbbPosition === 'bottom' ? 'selected' : ''}>Bottom Busbar Chamber</option>
            </select>
            <span class="field-hint">Changes vertical dropper lengths to each tier</span>
          </div>
          <div class="field">
            <label>Take-off Tail Length / Tier (m)</label>
            <input type="number" id="cfg-tail" value="${c.takeoffTailLengthM}" min="0" max="2" step="0.05" placeholder="0.35" />
            <span class="field-hint">Typ: 0.25–0.50 m copper link from dropper to breaker</span>
          </div>
          <div class="field">
            <label>Bolted Joint Resistance (µΩ)</label>
            <input type="number" id="cfg-joint" value="${c.jointResistanceUOhm}" min="0" max="30" step="1" placeholder="5" />
            <span class="field-hint">Typ: 3–10 µΩ per torqued Cu-Cu lap joint</span>
          </div>
          <div class="field">
            <label>Panel Auxiliary Losses (W)</label>
            <input type="number" id="cfg-aux" value="${c.auxiliaryLossesW}" min="0" step="10" placeholder="120" />
            <span class="field-hint">Typ: 80–250 W (meters, PSU, PLC, door lamps)</span>
          </div>
          <div class="field">
            <label>Installation Type (IEC 60890 Ae)</label>
            <select id="cfg-inst">
              <option value="freestanding" ${c.installationType !== 'wall_backed' ? 'selected' : ''}>Freestanding (Front + Rear exposed)</option>
              <option value="wall_backed" ${c.installationType === 'wall_backed' ? 'selected' : ''}>Wall-Backed (Rear blocked)</option>
            </select>
            <span class="field-hint">Determines effective enclosure surface area Ae</span>
          </div>
          <div class="field">
            <label>HVAC Safety Margin (%)</label>
            <input type="number" id="cfg-hvac" value="${c.hvacSafetyMarginPct}" min="0" max="50" step="5" placeholder="15" />
            <span class="field-hint">Typ: 15–25% contingency for switchroom cooling</span>
          </div>
        </div>
      </div>
    `;

    const bind = (id, fn) => {
      const inp = document.getElementById(id);
      if (inp) inp.addEventListener('change', () => { fn(inp.value); renderAll(); });
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

  // --- Wire Static Shell Controls ---
  function initControls() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + activeTab));
        renderAll(true);
      });
    });

    document.getElementById('preset-select').addEventListener('change', (e) => {
      const v = e.target.value;
      if (!v) return;
      if (v === 'default') project = window.SGState.createDefaultProject();
      else if (v === 'dual') project = window.SGState.createDualIncomerProject();
      else if (v === 'blank') project = window.SGState.createBlankProject();
      selection = { type: 'mainBusbar' };
      e.target.value = '';
      renderAll();
    });

    document.getElementById('sld-add-col').addEventListener('click', () => addNewColumn('feeders'));
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
    document.getElementById('ga-export-svg').addEventListener('click', () => {
      window.SGReport.exportSVG('ga-svg', `${project.meta.projectNumber || 'switchgear'}_GA.svg`);
    });

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

    // Shareable Web URL (#data=...) for hosted deployments
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
      document.getElementById('print-report').innerHTML = window.SGReport.buildPrintReportHTML(
        project,
        activeSc.result,
        allScenarios
      );
      window.print();
    });
  }

  initControls();
  renderAll();
})();
