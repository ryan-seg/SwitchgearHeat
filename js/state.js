/**
 * Application State & Preset Switchboard Configurations
 * Single source of truth driving SLD, GA, Calculations, and Exports.
 */

window.SGState = (function () {
  'use strict';

  const STORAGE_KEY = 'sg_heat_calc_project_v1';

  let _uidCounter = 100;
  function uid(prefix) {
    _uidCounter += 1;
    return `${prefix || 'id'}-${Date.now().toString(36)}-${_uidCounter}`;
  }

  function makeTierFromTemplate(tplId, overrides, customLibrary) {
    const lib = customLibrary || window.SGCatalog.DEFAULT_DEVICE_TEMPLATES;
    const tpl = lib.find((t) => t.id === tplId) || lib[0];
    const cloned = window.SGCatalog.cloneTemplate(tpl);
    return Object.assign(
      {
        id: uid('tier'),
        templateId: cloned.id,
        tag: 'F-NEW',
        description: cloned.name,
        role: cloned.role || 'feeder',
        category: cloned.category,
        manufacturer: cloned.manufacturer || 'Generic IEC',
        modelSeries: cloned.modelSeries || '',
        sourceRef: cloned.sourceRef || '',
        sourceUrl: cloned.sourceUrl || '',
        status: 'active', // 'active' | 'future' | 'standby'
        heightMm: cloned.defaultHeightMm || 250,
        ratedCurrentA: cloned.ratedCurrentA,
        ratedLossW: cloned.ratedLossW,
        fixedLossW: cloned.fixedLossW || 0,
        subComponents: cloned.subComponents || null,
        loadInputMode: cloned.defaultKw ? 'kw' : 'amps', // 'amps' | 'kw'
        operatingCurrentA: Math.round(cloned.ratedCurrentA * 0.65),
        loadKw: cloned.defaultKw || 0,
        powerFactor: 0.85,
        efficiency: 0.93,
        phases: '3P',
        loadFactor: 1.0,
        // Special fields for incomer / coupler / interconnector
        incomerState: 'closed', // 'closed' | 'open'
        couplerState: 'open', // 'open' | 'closed'
        normalTransferCurrentA: 0,
        n1TransferCurrentA: 950,
        remoteBoardName: 'MSB-B (Firm Supply)',
        cableSpec: {
          includeCableLoss: true,
          material: 'cu_100',
          cablesPerPhase: 3,
          csaMm2: 240,
          internalLengthM: 2.5,
          operatingTempC: 70,
        },
      },
      overrides || {}
    );
  }

  /**
   * Default industrial demo switchboard matching the user's exact specification:
   * - 400V 50Hz 3P+N LV Switchgear (IEC 60439 / 61439)
   * - Main Horizontal Busbar: 2 x 75 x 6 mm (900 mm²) Copper per phase, Type 439 Cert, S = 1.2
   * - Incomer + Multi-tier MCC (DOL, Star-Delta, VSD, Soft Starter) + Outgoing MCCBs + Future Spaces
   * - Interconnector Feeder supplying B-Side Firm Supply Switchgear
   */
  function createDefaultProject() {
    const lib = window.SGCatalog.DEFAULT_DEVICE_TEMPLATES.map((t) => window.SGCatalog.cloneTemplate(t));

    return {
      meta: {
        projectName: 'MSB-A — Main LV Switchboard (Firm Supply A)',
        projectNumber: 'CEI-TH-001',
        engineer: 'CE&I Engineering',
        revision: 'Rev A',
        date: new Date().toISOString().slice(0, 10),
        notes: 'Approximate switchgear heat output per IEC 60439 / 61439 & Joule loss model.',
      },
      activeScenario: 'normal', // 'normal' | 'n1_transfer' | 'normal_future' | 'worst_case'
      config: {
        voltageV: 400,
        frequencyHz: 50,
        poles: '3P+N',
        neutralCurrentRatio: 0.1, // 10% neutral current ratio for 3P+N
        diversityFactorRDF: 0.9, // IEC 61439-1 RDF applied to local feeders on busbars
        globalFutureGrowthPct: 15, // applied in future scenarios
        ambientTempC: 35,
        panelHeightMm: 2200,
        panelDepthMm: 800,
        hbbChamberHeightMm: 350,
        hbbPosition: 'top', // 'top' | 'bottom'
        takeoffTailLengthM: 0.35,
        jointResistanceUOhm: 5,
        auxiliaryLossesW: 120, // metering, panel lighting, control PSU, relay rack
        installationType: 'freestanding', // 'freestanding' | 'wall_backed'
        hvacSafetyMarginPct: 15,
      },
      mainBusbar: {
        label: 'Main Horizontal Busbar',
        ratedCurrentA: 1250,
        certRef: 'BS EN 60439-1 Type 439 Cert — 2×75×6mm (1250A)',
        material: 'cu_100',
        barsPerPhase: 2,
        widthMm: 75,
        thicknessMm: 6,
        gapMm: 6,
        phaseSpacingMm: 120,
        orientation: 'edge', // 'edge' | 'flat'
        operatingTempC: 70,
        acFactorMode: 'manual', // 'manual' | 'calculated'
        manualSFactor: 1.2,
        enclosureEddyFactor: 0.02,
        neutralSizeRatio: 0.5, // 50% neutral bar
      },
      defaultVerticalBusbar: {
        label: 'Vertical Dropper Busbar',
        ratedCurrentA: 800,
        certRef: 'Type 439 Vertical Riser — 1×60×6mm',
        material: 'cu_100',
        barsPerPhase: 1,
        widthMm: 60,
        thicknessMm: 6,
        gapMm: 6,
        phaseSpacingMm: 95,
        orientation: 'edge',
        operatingTempC: 70,
        acFactorMode: 'manual',
        manualSFactor: 1.15,
        enclosureEddyFactor: 0.02,
        neutralSizeRatio: 0.5,
      },
      columns: [
        {
          id: 'col-1',
          name: 'COL-01 Incomer',
          widthMm: 800,
          verticalBusbar: null, // Incomer connects directly to HBB via incomer riser
          tiers: [
            makeTierFromTemplate(
              'acb-2500',
              {
                id: 'tier-inc-1',
                tag: 'INC-A',
                description: 'Main Incomer ACB 2500A (Tx-A)',
                role: 'incomer',
                heightMm: 900,
                incomerState: 'closed',
              },
              lib
            ),
          ],
        },
        {
          id: 'col-2',
          name: 'COL-02 MCC Tier 1',
          widthMm: 800,
          verticalBusbar: {
            label: 'COL-02 Dropper',
            ratedCurrentA: 800,
            certRef: 'Type 439 Dropper — 1×60×6mm',
            material: 'cu_100',
            barsPerPhase: 1,
            widthMm: 60,
            thicknessMm: 6,
            gapMm: 6,
            phaseSpacingMm: 95,
            orientation: 'edge',
            operatingTempC: 70,
            acFactorMode: 'manual',
            manualSFactor: 1.15,
            enclosureEddyFactor: 0.02,
            neutralSizeRatio: 0.5,
          },
          tiers: [
            makeTierFromTemplate(
              'dol-55kw',
              {
                id: 'tier-2-1',
                tag: 'M-101',
                description: 'Cooling Water Pump 1 — 55 kW DOL',
                loadInputMode: 'kw',
                loadKw: 55,
                powerFactor: 0.87,
                efficiency: 0.94,
                loadFactor: 0.88,
                heightMm: 350,
              },
              lib
            ),
            makeTierFromTemplate(
              'dol-37kw',
              {
                id: 'tier-2-2',
                tag: 'M-102',
                description: 'Process Booster Pump — 37 kW DOL',
                loadInputMode: 'kw',
                loadKw: 37,
                powerFactor: 0.86,
                efficiency: 0.93,
                loadFactor: 0.85,
                heightMm: 300,
              },
              lib
            ),
            makeTierFromTemplate(
              'dol-22kw',
              {
                id: 'tier-2-3',
                tag: 'M-103',
                description: 'Extraction Fan 1 — 22 kW DOL',
                loadInputMode: 'kw',
                loadKw: 22,
                powerFactor: 0.85,
                efficiency: 0.92,
                loadFactor: 0.9,
                heightMm: 260,
              },
              lib
            ),
            makeTierFromTemplate(
              'dol-15kw',
              {
                id: 'tier-2-4',
                tag: 'M-104',
                description: 'Transfer Pump — 15 kW DOL',
                loadInputMode: 'kw',
                loadKw: 15,
                powerFactor: 0.84,
                efficiency: 0.91,
                loadFactor: 0.8,
                heightMm: 240,
              },
              lib
            ),
            makeTierFromTemplate(
              'dol-37kw',
              {
                id: 'tier-2-5',
                tag: 'M-105 (FUT)',
                description: 'Future Process Pump — 37 kW DOL',
                status: 'future',
                loadInputMode: 'kw',
                loadKw: 37,
                powerFactor: 0.86,
                efficiency: 0.93,
                loadFactor: 0.85,
                heightMm: 300,
              },
              lib
            ),
          ],
        },
        {
          id: 'col-3',
          name: 'COL-03 Drives & Starters',
          widthMm: 800,
          verticalBusbar: {
            label: 'COL-03 Dropper',
            ratedCurrentA: 800,
            certRef: 'Type 439 Dropper — 1×60×6mm',
            material: 'cu_100',
            barsPerPhase: 1,
            widthMm: 60,
            thicknessMm: 6,
            gapMm: 6,
            phaseSpacingMm: 95,
            orientation: 'edge',
            operatingTempC: 70,
            acFactorMode: 'manual',
            manualSFactor: 1.15,
            enclosureEddyFactor: 0.02,
            neutralSizeRatio: 0.5,
          },
          tiers: [
            makeTierFromTemplate(
              'sd-75kw',
              {
                id: 'tier-3-1',
                tag: 'M-201',
                description: 'Main Air Compressor — 75 kW Star-Delta',
                loadInputMode: 'kw',
                loadKw: 75,
                powerFactor: 0.88,
                efficiency: 0.94,
                loadFactor: 0.85,
                heightMm: 450,
              },
              lib
            ),
            makeTierFromTemplate(
              'vsd-45kw',
              {
                id: 'tier-3-2',
                tag: 'VSD-202',
                description: 'Variable Speed Blower — 45 kW VSD',
                loadInputMode: 'kw',
                loadKw: 45,
                powerFactor: 0.95,
                efficiency: 0.94,
                loadFactor: 0.82,
                heightMm: 600,
              },
              lib
            ),
            makeTierFromTemplate(
              'ss-30kw',
              {
                id: 'tier-3-3',
                tag: 'SS-203',
                description: 'Chilled Water Pump — 30 kW Soft Starter',
                loadInputMode: 'kw',
                loadKw: 30,
                powerFactor: 0.86,
                efficiency: 0.93,
                loadFactor: 0.85,
                heightMm: 350,
              },
              lib
            ),
            makeTierFromTemplate(
              'vsd-15kw',
              {
                id: 'tier-3-4',
                tag: 'VSD-204 (FUT)',
                description: 'Future Dosing Blower — 15 kW VSD',
                status: 'future',
                loadInputMode: 'kw',
                loadKw: 15,
                powerFactor: 0.95,
                efficiency: 0.93,
                loadFactor: 0.85,
                heightMm: 320,
              },
              lib
            ),
          ],
        },
        {
          id: 'col-4',
          name: 'COL-04 Outgoing Feeders',
          widthMm: 600,
          verticalBusbar: {
            label: 'COL-04 Dropper',
            ratedCurrentA: 800,
            certRef: 'Type 439 Dropper — 1×60×6mm',
            material: 'cu_100',
            barsPerPhase: 1,
            widthMm: 60,
            thicknessMm: 6,
            gapMm: 6,
            phaseSpacingMm: 95,
            orientation: 'edge',
            operatingTempC: 70,
            acFactorMode: 'manual',
            manualSFactor: 1.15,
            enclosureEddyFactor: 0.02,
            neutralSizeRatio: 0.5,
          },
          tiers: [
            makeTierFromTemplate(
              'mccb-400',
              {
                id: 'tier-4-1',
                tag: 'F-301',
                description: 'Sub-DB Process Area 1 (400A MCCB)',
                loadInputMode: 'amps',
                operatingCurrentA: 280,
                loadFactor: 1.0,
                heightMm: 350,
              },
              lib
            ),
            makeTierFromTemplate(
              'mccb-250',
              {
                id: 'tier-4-2',
                tag: 'F-302',
                description: 'HVAC & Switchroom Cooling (250A MCCB)',
                loadInputMode: 'amps',
                operatingCurrentA: 165,
                loadFactor: 1.0,
                heightMm: 300,
              },
              lib
            ),
            makeTierFromTemplate(
              'mccb-160',
              {
                id: 'tier-4-3',
                tag: 'F-303',
                description: 'Lighting & Small Power DB (160A MCCB)',
                loadInputMode: 'amps',
                operatingCurrentA: 95,
                loadFactor: 1.0,
                heightMm: 260,
              },
              lib
            ),
            makeTierFromTemplate(
              'fuse-250',
              {
                id: 'tier-4-4',
                tag: 'F-304',
                description: 'Workshop Sub-Feeder (250A Fuse-Switch)',
                loadInputMode: 'amps',
                operatingCurrentA: 140,
                loadFactor: 1.0,
                heightMm: 300,
              },
              lib
            ),
            makeTierFromTemplate(
              'mccb-250',
              {
                id: 'tier-4-5',
                tag: 'F-305 (FUT)',
                description: 'Future Sub-DB Expansion (250A MCCB)',
                status: 'future',
                loadInputMode: 'amps',
                operatingCurrentA: 180,
                loadFactor: 1.0,
                heightMm: 300,
              },
              lib
            ),
          ],
        },
        {
          id: 'col-5',
          name: 'COL-05 Interconnector',
          widthMm: 800,
          verticalBusbar: {
            label: 'COL-05 Interconnector Riser',
            ratedCurrentA: 1250,
            certRef: 'Type 439 Dropper — 2×75×6mm (1250A)',
            material: 'cu_100',
            barsPerPhase: 2,
            widthMm: 75,
            thicknessMm: 6,
            gapMm: 6,
            phaseSpacingMm: 120,
            orientation: 'edge',
            operatingTempC: 70,
            acFactorMode: 'manual',
            manualSFactor: 1.2,
            enclosureEddyFactor: 0.02,
            neutralSizeRatio: 0.5,
          },
          tiers: [
            makeTierFromTemplate(
              'interconn-1250',
              {
                id: 'tier-5-1',
                tag: 'IC-AB',
                description: 'Interconnector to MSB-B (1250A ACB Firm Supply)',
                role: 'interconnector',
                status: 'active',
                heightMm: 740,
                normalTransferCurrentA: 0,
                n1TransferCurrentA: 850,
                remoteBoardName: 'MSB-B (Firm Supply)',
              },
              lib
            ),
          ],
        },
      ],
      deviceLibrary: lib,
      uiMode: 'detailed',
      simpleMode: createDefaultSimpleMode(),
      room: createDefaultRoomConfig(),
      reportConfig: createDefaultReportConfig(),
    };
  }

  /**
   * Dual Incomer + Bus-Section Coupler preset (Section A + Coupler + Section B + Interconnector)
   */
  function createDualIncomerProject() {
    const p = createDefaultProject();
    const lib = p.deviceLibrary;
    p.meta.projectName = 'MSB-AB — Dual Incomer Switchboard w/ Bus Coupler & Interconnector';
    p.mainBusbar.ratedCurrentA = 2500;
    p.mainBusbar.barsPerPhase = 2;
    p.mainBusbar.widthMm = 100;
    p.mainBusbar.thicknessMm = 10;
    p.mainBusbar.certRef = 'IEC 61439-1 Type Tested — 2×100×10mm (2000mm²)';

    // Insert Bus Coupler between COL-03 and COL-04, and add Incomer B on far right
    const couplerCol = {
      id: 'col-coupler',
      name: 'COL-BC Bus Coupler',
      widthMm: 800,
      verticalBusbar: null,
      tiers: [
        makeTierFromTemplate(
          'coupler-2500',
          {
            id: 'tier-bc-1',
            tag: 'BC-1',
            description: 'Bus-Section Coupler ACB 2500A',
            role: 'bus_coupler',
            couplerState: 'open',
            heightMm: 850,
          },
          lib
        ),
      ],
    };

    const incomerBCol = {
      id: 'col-inc-b',
      name: 'COL-06 Incomer B',
      widthMm: 800,
      verticalBusbar: null,
      tiers: [
        makeTierFromTemplate(
          'acb-2500',
          {
            id: 'tier-inc-b',
            tag: 'INC-B',
            description: 'Main Incomer B ACB 2500A (Tx-B)',
            role: 'incomer',
            incomerState: 'closed',
            heightMm: 900,
          },
          lib
        ),
      ],
    };

    p.columns.splice(3, 0, couplerCol);
    p.columns.push(incomerBCol);
    return p;
  }

  function createBlankProject() {
    const p = createDefaultProject();
    const lib = p.deviceLibrary;
    p.meta.projectName = 'New LV Switchboard';
    p.columns = [
      {
        id: uid('col'),
        name: 'COL-01 Incomer',
        widthMm: 800,
        verticalBusbar: null,
        tiers: [
          makeTierFromTemplate(
            'acb-1600',
            {
              id: uid('tier'),
              tag: 'INC-1',
              description: 'Main Incomer ACB 1600A',
              role: 'incomer',
              heightMm: 800,
              incomerState: 'closed',
            },
            lib
          ),
        ],
      },
      {
        id: uid('col'),
        name: 'COL-02 Feeders',
        widthMm: 800,
        verticalBusbar: JSON.parse(JSON.stringify(p.defaultVerticalBusbar)),
        tiers: [
          makeTierFromTemplate(
            'dol-37kw',
            {
              id: uid('tier'),
              tag: 'M-01',
              description: 'Motor Starter 37 kW DOL',
              loadInputMode: 'kw',
              loadKw: 37,
            },
            lib
          ),
          makeTierFromTemplate(
            'mccb-250',
            {
              id: uid('tier'),
              tag: 'F-01',
              description: 'Outgoing Feeder 250A MCCB',
              loadInputMode: 'amps',
              operatingCurrentA: 160,
            },
            lib
          ),
        ],
      },
    ];
    return p;
  }

  function createDefaultSimpleMode() {
    return {
      busbarPresetId: 'bb-1250',
      material: 'cu_100',
      busbarTempC: 70,
      manualSFactor: 1.2,
      topology: 'single_interconn', // 'single' | 'single_interconn' | 'dual_coupler' | 'dual_coupler_interconn'
      columnCount: 5,
      dolCount: 4,
      dolTemplateId: 'dol-37kw',
      vsdCount: 1,
      vsdTemplateId: 'vsd-45kw',
      feederCount: 4,
      feederTemplateId: 'fuse-250',
      avgLoadPct: 75,
      rdf: 0.9,
      n1TransferA: 850,
      futureGrowthPct: 20,
    };
  }

  function createDefaultRoomConfig() {
    return {
      lengthM: 5.0,
      widthM: 5.0,
      heightM: 9.0,
      ambientTempC: 25,
      maxRoomTempC: 35,
      otherRoomHeatKW: 0.0,
      louverFreeAreaM2: 0.5,
      stackHeightM: 6.0,
      dischargeCoeff: 0.6,
      useOverrideHeatKW: false,
      overrideHeatKW: 6.0,
    };
  }

  function ensureExtras(project) {
    if (!project.uiMode) project.uiMode = 'detailed'; // 'simple' | 'detailed'
    project.simpleMode = Object.assign(createDefaultSimpleMode(), project.simpleMode || {});
    project.room = Object.assign(createDefaultRoomConfig(), project.room || {});
    ensureReportConfig(project);
    return project;
  }

  /**
   * Synthesize a complete Detailed Switchboard (columns, tiers, main busbar,
   * incomer/coupler/interconnector, starters, VSDs, feeders) directly from Simple Mode selections!
   */
  function applySimpleToDetailed(project) {
    ensureExtras(project);
    const sm = project.simpleMode;
    const lib = project.deviceLibrary;
    const presets = window.SGCatalog.BUSBAR_PRESETS;
    const bbPreset = presets.find((p) => p.id === sm.busbarPresetId) || presets[3];

    // 1. Update Main Busbar & Global Config from Simple Mode
    project.mainBusbar.ratedCurrentA = bbPreset.ratedCurrentA;
    project.mainBusbar.material = sm.material || 'cu_100';
    project.mainBusbar.barsPerPhase = bbPreset.barsPerPhase;
    project.mainBusbar.widthMm = bbPreset.widthMm;
    project.mainBusbar.thicknessMm = bbPreset.thicknessMm;
    project.mainBusbar.gapMm = bbPreset.gapMm;
    project.mainBusbar.phaseSpacingMm = bbPreset.phaseSpacingMm;
    project.mainBusbar.certRef = bbPreset.certRef;
    project.mainBusbar.operatingTempC = Number(sm.busbarTempC || 70);
    project.mainBusbar.acFactorMode = 'manual';
    project.mainBusbar.manualSFactor = Number(sm.manualSFactor || 1.2);

    project.config.diversityFactorRDF = Number(sm.rdf || 0.9);
    project.config.globalFutureGrowthPct = Number(sm.futureGrowthPct || 20);

    // 2. Build Columns from Simple Mode Topology & Circuit Counts
    const cols = [];
    const incTplId =
      bbPreset.ratedCurrentA >= 3200 ? 'acb-3200' :
      bbPreset.ratedCurrentA >= 2500 ? 'acb-2500' :
      bbPreset.ratedCurrentA >= 2000 ? 'acb-2000' :
      bbPreset.ratedCurrentA >= 1600 ? 'acb-1600' :
      bbPreset.ratedCurrentA >= 1250 ? 'acb-1250' : 'acb-1000';
    const loadFactor = Math.min(1, Math.max(0.1, Number(sm.avgLoadPct || 75) / 100));

    // COL-01: Main Incomer A
    cols.push({
      id: uid('col'),
      name: 'COL-01 Incomer A',
      widthMm: 800,
      verticalBusbar: null,
      tiers: [
        makeTierFromTemplate(incTplId, {
          tag: 'INC-A',
          description: `Main Incomer ACB ${bbPreset.ratedCurrentA}A`,
          role: 'incomer',
          incomerState: 'closed',
        }, lib),
      ],
    });

    // Motor Starters Column(s) (up to 5 tiers per column)
    const nDol = Math.max(0, parseInt(sm.dolCount, 10) || 0);
    let mNum = 1;
    for (let i = 0; i < nDol; i += 5) {
      const batch = Math.min(5, nDol - i);
      const tiers = [];
      for (let k = 0; k < batch; k++) {
        tiers.push(
          makeTierFromTemplate(sm.dolTemplateId || 'dol-37kw', {
            tag: `M-${100 + mNum}`,
            description: `Motor Starter ${mNum} (from Simple Mode)`,
            loadFactor,
          }, lib)
        );
        mNum += 1;
      }
      cols.push({
        id: uid('col'),
        name: `COL-0${cols.length + 1} MCC Starters`,
        widthMm: 800,
        verticalBusbar: JSON.parse(JSON.stringify(project.defaultVerticalBusbar)),
        tiers,
      });
    }

    // VSD / Drives Column(s) (up to 3 drives per column)
    const nVsd = Math.max(0, parseInt(sm.vsdCount, 10) || 0);
    let vNum = 1;
    for (let i = 0; i < nVsd; i += 3) {
      const batch = Math.min(3, nVsd - i);
      const tiers = [];
      for (let k = 0; k < batch; k++) {
        tiers.push(
          makeTierFromTemplate(sm.vsdTemplateId || 'vsd-45kw', {
            tag: `VSD-${200 + vNum}`,
            description: `Variable Speed Drive ${vNum} (from Simple Mode)`,
            loadFactor,
          }, lib)
        );
        vNum += 1;
      }
      cols.push({
        id: uid('col'),
        name: `COL-0${cols.length + 1} VSD Drives`,
        widthMm: 800,
        verticalBusbar: JSON.parse(JSON.stringify(project.defaultVerticalBusbar)),
        tiers,
      });
    }

    // Optional Bus-Section Coupler in middle
    const isDual = sm.topology === 'dual_coupler' || sm.topology === 'dual_coupler_interconn';
    if (isDual) {
      cols.push({
        id: uid('col'),
        name: `COL-0${cols.length + 1} Bus Coupler`,
        widthMm: 800,
        verticalBusbar: null,
        tiers: [
          makeTierFromTemplate('coupler-2500', {
            tag: 'BC-1',
            description: 'Bus-Section Coupler ACB',
            role: 'bus_coupler',
            couplerState: 'open',
          }, lib),
        ],
      });
    }

    // Outgoing Feeders / HRC Fuses Column(s) (up to 5 per column)
    const nFdr = Math.max(0, parseInt(sm.feederCount, 10) || 0);
    let fNum = 1;
    for (let i = 0; i < nFdr; i += 5) {
      const batch = Math.min(5, nFdr - i);
      const tiers = [];
      for (let k = 0; k < batch; k++) {
        const tpl = lib.find((t) => t.id === (sm.feederTemplateId || 'fuse-250')) || lib[0];
        tiers.push(
          makeTierFromTemplate(tpl.id, {
            tag: `F-${300 + fNum}`,
            description: `Outgoing Feeder ${fNum} (${tpl.category})`,
            loadInputMode: 'amps',
            operatingCurrentA: Math.round(tpl.ratedCurrentA * loadFactor),
            loadFactor: 1.0,
          }, lib)
        );
        fNum += 1;
      }
      cols.push({
        id: uid('col'),
        name: `COL-0${cols.length + 1} Outgoing Feeders`,
        widthMm: 600,
        verticalBusbar: JSON.parse(JSON.stringify(project.defaultVerticalBusbar)),
        tiers,
      });
    }

    // Optional Firm Supply Interconnector Column
    const hasIC = sm.topology === 'single_interconn' || sm.topology === 'dual_coupler_interconn';
    if (hasIC) {
      cols.push({
        id: uid('col'),
        name: `COL-0${cols.length + 1} Interconnector`,
        widthMm: 800,
        verticalBusbar: Object.assign(JSON.parse(JSON.stringify(project.mainBusbar)), { label: 'Interconnector Riser' }),
        tiers: [
          makeTierFromTemplate('interconn-1600', {
            tag: 'IC-AB',
            description: 'Interconnector to MSB-B (Firm Supply Link)',
            role: 'interconnector',
            normalTransferCurrentA: 0,
            n1TransferCurrentA: Number(sm.n1TransferA || 850),
          }, lib),
        ],
      });
    }

    // Optional Incomer B if Dual Incomer topology
    if (isDual) {
      cols.push({
        id: uid('col'),
        name: `COL-0${cols.length + 1} Incomer B`,
        widthMm: 800,
        verticalBusbar: null,
        tiers: [
          makeTierFromTemplate(incTplId, {
            tag: 'INC-B',
            description: `Main Incomer B ACB ${bbPreset.ratedCurrentA}A`,
            role: 'incomer',
            incomerState: 'closed',
          }, lib),
        ],
      });
    }

    project.columns = cols;
    project.uiMode = 'detailed';
    return project;
  }

  function createDefaultReportConfig() {
    return {
      preset: 'standard', // 'executive' | 'standard' | 'full_audit' | 'drawings_only' | 'custom'
      outputFormat: 'formatted', // 'formatted' | 'text' | 'markdown'
      orientation: 'landscape', // 'landscape' | 'portrait'
      unitsMode: 'both', // 'both' | 'kw' | 'w'
      kwDecimals: 3,
      includeBtuHvac: true,
      diagramTheme: 'light', // 'light' | 'active'
      scenarioScope: 'all', // 'all' | 'active'
      pageBreaks: true,
      includeInactiveRows: true,
      gaHeatmap: true,
      gaDims: true,
      gaBusbars: true,
      sections: {
        titleBlock: true,
        execSummary: true,
        categoryBreakdown: true,
        busbarBasis: true,
        workedBusbarSteps: false,
        sldDiagram: true,
        gaDiagram: true,
        hbbSchedule: true,
        vbbSchedule: true,
        columnSummary: true,
        deviceSchedule: true,
        deviceSubComponents: false,
        enclosureAdvisory: true,
        roomVentilation: true,
        methodologyAppendix: false,
        signOffBlock: true,
      },
      customNotes:
        'Approximate switchgear heat output based on IEC 60439 / 61439 Joule busbar calculations and IEC TR 60890 device scaling. For sealed enclosure temperature-rise certification, verify against vendor type-test limits.',
      checkedBy: '',
      approvedBy: '',
    };
  }

  function applyReportPreset(reportConfig, presetId) {
    const base = createDefaultReportConfig();
    const cfg = Object.assign(base, reportConfig || {});
    cfg.preset = presetId;
    if (presetId === 'executive') {
      cfg.orientation = 'portrait';
      cfg.scenarioScope = 'all';
      cfg.pageBreaks = false;
      cfg.includeInactiveRows = false;
      cfg.sections = {
        titleBlock: true,
        execSummary: true,
        categoryBreakdown: true,
        busbarBasis: false,
        workedBusbarSteps: false,
        sldDiagram: false,
        gaDiagram: false,
        hbbSchedule: false,
        vbbSchedule: false,
        columnSummary: true,
        deviceSchedule: false,
        deviceSubComponents: false,
        enclosureAdvisory: true,
        roomVentilation: true,
        methodologyAppendix: false,
        signOffBlock: true,
      };
    } else if (presetId === 'standard') {
      cfg.orientation = 'landscape';
      cfg.scenarioScope = 'all';
      cfg.pageBreaks = true;
      cfg.includeInactiveRows = true;
      cfg.sections = {
        titleBlock: true,
        execSummary: true,
        categoryBreakdown: true,
        busbarBasis: true,
        workedBusbarSteps: false,
        sldDiagram: true,
        gaDiagram: true,
        hbbSchedule: true,
        vbbSchedule: true,
        columnSummary: true,
        deviceSchedule: true,
        deviceSubComponents: false,
        enclosureAdvisory: true,
        roomVentilation: true,
        methodologyAppendix: false,
        signOffBlock: true,
      };
    } else if (presetId === 'full_audit') {
      cfg.orientation = 'landscape';
      cfg.scenarioScope = 'all';
      cfg.pageBreaks = true;
      cfg.includeInactiveRows = true;
      cfg.sections = {
        titleBlock: true,
        execSummary: true,
        categoryBreakdown: true,
        busbarBasis: true,
        workedBusbarSteps: true,
        sldDiagram: true,
        gaDiagram: true,
        hbbSchedule: true,
        vbbSchedule: true,
        columnSummary: true,
        deviceSchedule: true,
        deviceSubComponents: true,
        enclosureAdvisory: true,
        roomVentilation: true,
        methodologyAppendix: true,
        signOffBlock: true,
      };
    } else if (presetId === 'drawings_only') {
      cfg.orientation = 'landscape';
      cfg.scenarioScope = 'active';
      cfg.pageBreaks = true;
      cfg.includeInactiveRows = true;
      cfg.sections = {
        titleBlock: true,
        execSummary: true,
        categoryBreakdown: false,
        busbarBasis: false,
        workedBusbarSteps: false,
        sldDiagram: true,
        gaDiagram: true,
        hbbSchedule: false,
        vbbSchedule: false,
        columnSummary: false,
        deviceSchedule: true,
        deviceSubComponents: false,
        enclosureAdvisory: false,
        roomVentilation: false,
        methodologyAppendix: false,
        signOffBlock: false,
      };
    }
    return cfg;
  }

  function ensureReportConfig(project) {
    const def = createDefaultReportConfig();
    if (!project.reportConfig || typeof project.reportConfig !== 'object') {
      project.reportConfig = def;
    } else {
      Object.keys(def).forEach((k) => {
        if (k === 'sections') return;
        if (project.reportConfig[k] === undefined) {
          project.reportConfig[k] = def[k];
        }
      });
      if (!project.reportConfig.sections || typeof project.reportConfig.sections !== 'object') {
        project.reportConfig.sections = Object.assign({}, def.sections);
      } else {
        Object.keys(def.sections).forEach((sk) => {
          if (project.reportConfig.sections[sk] === undefined) {
            project.reportConfig.sections[sk] = def.sections[sk];
          }
        });
      }
    }
    return project.reportConfig;
  }

  function syncLibraryWithDefaults(deviceLibrary) {
    if (!Array.isArray(deviceLibrary)) {
      return window.SGCatalog.DEFAULT_DEVICE_TEMPLATES.map((t) => window.SGCatalog.cloneTemplate(t));
    }
    const byId = new Map(deviceLibrary.map((t) => [t.id, t]));
    window.SGCatalog.DEFAULT_DEVICE_TEMPLATES.forEach((tpl) => {
      const existing = byId.get(tpl.id);
      if (!existing) {
        deviceLibrary.push(window.SGCatalog.cloneTemplate(tpl));
      } else {
        // Upgrade legacy generic fuse templates to Eaton Bussmann NH gG specs
        if ((tpl.id === 'fuse-250' || tpl.id === 'fuse-400') && existing.category === 'Fuse-Switch') {
          Object.assign(existing, window.SGCatalog.cloneTemplate(tpl));
        } else {
          // Backfill structured sorting & datasheet evidence metadata on older saved libraries
          if (!existing.manufacturer) existing.manufacturer = tpl.manufacturer || 'Generic IEC';
          if (!existing.modelSeries) existing.modelSeries = tpl.modelSeries || '';
          if (existing.sizeValue == null && tpl.sizeValue != null) existing.sizeValue = tpl.sizeValue;
          if (!existing.sizeLabel && tpl.sizeLabel) existing.sizeLabel = tpl.sizeLabel;
          if (!existing.sourceRef && tpl.sourceRef) existing.sourceRef = tpl.sourceRef;
          if (existing.sourceUrl === undefined && tpl.sourceUrl) existing.sourceUrl = tpl.sourceUrl;
          if (tpl.category === 'Spare / Placeholder' && (existing.category === 'Spare Space' || existing.category === 'Placeholder' || existing.category === 'Chamber / Aux')) {
            existing.category = tpl.category;
          }
        }
      }
    });
    return window.SGCatalog.sortDeviceLibrary(deviceLibrary);
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.columns && parsed.mainBusbar && parsed.config) {
          parsed.deviceLibrary = syncLibraryWithDefaults(parsed.deviceLibrary);
          ensureExtras(parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not load saved project from localStorage:', e);
    }
    return createDefaultProject();
  }

  function clearSavedData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('sg_heat_calc_theme_v1');
    } catch (e) {}
  }

  function saveProject(project) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch (e) {
      console.warn('Could not save project to localStorage:', e);
    }
  }

  return {
    uid,
    makeTierFromTemplate,
    createDefaultProject,
    createDualIncomerProject,
    createBlankProject,
    createDefaultSimpleMode,
    createDefaultRoomConfig,
    applySimpleToDetailed,
    ensureExtras,
    createDefaultReportConfig,
    applyReportPreset,
    ensureReportConfig,
    syncLibraryWithDefaults,
    loadProject,
    saveProject,
    clearSavedData,
  };
})();
