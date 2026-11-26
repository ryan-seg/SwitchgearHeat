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
        ratedCurrentA: 1600,
        certRef: 'BS EN 60439-1 Type 439 Cert — 2×75×6mm',
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
            ratedCurrentA: 1600,
            certRef: 'Type 439 Dropper — 2×75×6mm',
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
              'interconn-1600',
              {
                id: 'tier-5-1',
                tag: 'IC-AB',
                description: 'Interconnector to MSB-B (Firm Supply Link)',
                role: 'interconnector',
                status: 'active',
                heightMm: 850,
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

  function syncLibraryWithDefaults(deviceLibrary) {
    if (!Array.isArray(deviceLibrary)) {
      return window.SGCatalog.DEFAULT_DEVICE_TEMPLATES.map((t) => window.SGCatalog.cloneTemplate(t));
    }
    const byId = new Map(deviceLibrary.map((t) => [t.id, t]));
    window.SGCatalog.DEFAULT_DEVICE_TEMPLATES.forEach((tpl) => {
      const existing = byId.get(tpl.id);
      if (!existing) {
        deviceLibrary.push(window.SGCatalog.cloneTemplate(tpl));
      } else if ((tpl.id === 'fuse-250' || tpl.id === 'fuse-400') && existing.category === 'Fuse-Switch') {
        // Upgrade legacy generic fuse templates to Eaton Bussmann NH gG specs
        Object.assign(existing, window.SGCatalog.cloneTemplate(tpl));
      }
    });
    return deviceLibrary;
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.columns && parsed.mainBusbar && parsed.config) {
          parsed.deviceLibrary = syncLibraryWithDefaults(parsed.deviceLibrary);
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
    syncLibraryWithDefaults,
    loadProject,
    saveProject,
    clearSavedData,
  };
})();
