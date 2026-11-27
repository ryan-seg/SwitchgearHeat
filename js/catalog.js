/**
 * Generic IEC 60439 / 61439 Protective Device, Starter, Eaton HRC Fuse & Busbar Standard Library
 * Representative manufacturer power dissipation values at rated current In (3-pole, 400V 50Hz).
 * Sorted strictly by: Type (category) -> Manufacturer -> Model / Series -> Size (numeric rating).
 * Every device includes optional sourceRef & sourceUrl evidence links; all entries are editable.
 */

window.SGCatalog = (function () {
  'use strict';

  const SOURCE_URLS = {
    eatonNH: 'https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/data-sheets/bus-ele-ds-10164-nh-fuse-links-500vac.pdf',
    iec60947_2: 'https://webstore.iec.ch/en/publication/59761',
    iec60898_1: 'https://webstore.iec.ch/en/publication/59854',
    iec60947_4_1: 'https://webstore.iec.ch/en/publication/60559',
    iec61800_9: 'https://webstore.iec.ch/en/publication/29909',
    iec61439_1: 'https://webstore.iec.ch/en/publication/62019',
  };

  const BUSBAR_PRESETS = [
    {
      id: 'bb-630',
      name: '630 A — 1 × 50 × 6 mm Cu (300 mm²)',
      ratedCurrentA: 630,
      material: 'cu_100',
      barsPerPhase: 1,
      widthMm: 50,
      thicknessMm: 6,
      gapMm: 6,
      phaseSpacingMm: 100,
      certRef: 'IEC 60439-1 / 61439-1 Type Tested 630A',
    },
    {
      id: 'bb-800',
      name: '800 A — 1 × 60 × 8 mm Cu (480 mm²)',
      ratedCurrentA: 800,
      material: 'cu_100',
      barsPerPhase: 1,
      widthMm: 60,
      thicknessMm: 8,
      gapMm: 8,
      phaseSpacingMm: 100,
      certRef: 'IEC 60439-1 / 61439-1 Type Tested 800A',
    },
    {
      id: 'bb-1000',
      name: '1000 A — 2 × 50 × 6 mm Cu (600 mm²)',
      ratedCurrentA: 1000,
      material: 'cu_100',
      barsPerPhase: 2,
      widthMm: 50,
      thicknessMm: 6,
      gapMm: 6,
      phaseSpacingMm: 110,
      certRef: 'IEC 60439-1 / 61439-1 Type Tested 1000A',
    },
    {
      id: 'bb-1250',
      name: '1250 A — 2 × 75 × 6 mm Cu (900 mm²)',
      ratedCurrentA: 1250,
      material: 'cu_100',
      barsPerPhase: 2,
      widthMm: 75,
      thicknessMm: 6,
      gapMm: 6,
      phaseSpacingMm: 120,
      certRef: 'BS EN 60439-1 Type 439 Cert — 2×75×6mm (1250A)',
    },
    {
      id: 'bb-1600',
      name: '1600 A — 2 × 80 × 8 mm Cu (1280 mm²)',
      ratedCurrentA: 1600,
      material: 'cu_100',
      barsPerPhase: 2,
      widthMm: 80,
      thicknessMm: 8,
      gapMm: 8,
      phaseSpacingMm: 125,
      certRef: 'IEC 61439-1 Type Tested 1600A — 2×80×8mm',
    },
    {
      id: 'bb-2000',
      name: '2000 A — 2 × 80 × 10 mm Cu (1600 mm²)',
      ratedCurrentA: 2000,
      material: 'cu_100',
      barsPerPhase: 2,
      widthMm: 80,
      thicknessMm: 10,
      gapMm: 10,
      phaseSpacingMm: 130,
      certRef: 'IEC 61439-1 Type Tested 2000A',
    },
    {
      id: 'bb-2500',
      name: '2500 A — 2 × 100 × 10 mm Cu (2000 mm²)',
      ratedCurrentA: 2500,
      material: 'cu_100',
      barsPerPhase: 2,
      widthMm: 100,
      thicknessMm: 10,
      gapMm: 10,
      phaseSpacingMm: 140,
      certRef: 'IEC 61439-1 Type Tested 2500A',
    },
    {
      id: 'bb-3200',
      name: '3200 A — 3 × 100 × 10 mm Cu (3000 mm²)',
      ratedCurrentA: 3200,
      material: 'cu_100',
      barsPerPhase: 3,
      widthMm: 100,
      thicknessMm: 10,
      gapMm: 10,
      phaseSpacingMm: 160,
      certRef: 'IEC 61439-1 Type Tested 3200A',
    },
    {
      id: 'bb-4000',
      name: '4000 A — 4 × 100 × 10 mm Cu (4000 mm²)',
      ratedCurrentA: 4000,
      material: 'cu_100',
      barsPerPhase: 4,
      widthMm: 100,
      thicknessMm: 10,
      gapMm: 10,
      phaseSpacingMm: 180,
      certRef: 'IEC 61439-1 Type Tested 4000A',
    },
    {
      id: 'bb-v400',
      name: '400 A Vertical — 1 × 30 × 6 mm Cu (180 mm²)',
      ratedCurrentA: 400,
      material: 'cu_100',
      barsPerPhase: 1,
      widthMm: 30,
      thicknessMm: 6,
      gapMm: 6,
      phaseSpacingMm: 80,
      certRef: 'Vertical Dropper 400A',
    },
    {
      id: 'bb-v800',
      name: '800 A Vertical — 1 × 60 × 6 mm Cu (360 mm²)',
      ratedCurrentA: 800,
      material: 'cu_100',
      barsPerPhase: 1,
      widthMm: 60,
      thicknessMm: 6,
      gapMm: 6,
      phaseSpacingMm: 95,
      certRef: 'Vertical Dropper 800A',
    },
    {
      id: 'bb-v1250',
      name: '1250 A Vertical — 2 × 75 × 6 mm Cu (900 mm²)',
      ratedCurrentA: 1250,
      material: 'cu_100',
      barsPerPhase: 2,
      widthMm: 75,
      thicknessMm: 6,
      gapMm: 6,
      phaseSpacingMm: 120,
      certRef: 'Vertical Dropper 1250A — 2×75×6mm (900mm²)',
    },
    {
      id: 'bb-v1600',
      name: '1600 A Vertical — 2 × 80 × 8 mm Cu (1280 mm²)',
      ratedCurrentA: 1600,
      material: 'cu_100',
      barsPerPhase: 2,
      widthMm: 80,
      thicknessMm: 8,
      gapMm: 8,
      phaseSpacingMm: 125,
      certRef: 'Vertical Dropper 1600A — 2×80×8mm',
    },
  ];

  // --- Helper builders for clean, consistent structured library items ---
  function makeAcb(id, role, modelSeries, labelPrefix, amps, pn, pfix, h, notes) {
    return {
      id,
      category: 'ACB',
      manufacturer: 'Generic IEC',
      modelSeries,
      frameSize: `${amps}A Frame (${modelSeries.replace('IEC 60947-2 ', '')})`,
      phases: '3P',
      sizeValue: amps,
      sizeLabel: `${amps} A`,
      name: `${labelPrefix} ${amps}A Drawout (3P/4P)`,
      role,
      ratedCurrentA: amps,
      ratedLossW: pn,
      fixedLossW: pfix,
      defaultHeightMm: h,
      notes,
      sourceRef: 'IEC 60947-2 / Representative Drawout ACB Catalogues (Emax / MasterPact / 3WA / IZMX)',
      sourceUrl: SOURCE_URLS.iec60947_2,
      subComponents: [
        { name: `${labelPrefix} Main Poles & Cradle Contacts (${amps}A)`, ratedCurrentA: amps, ratedLossW: pn, fixedLossW: 0 },
        { name: 'Electronic Trip Unit, Interlocks & Auxiliaries', ratedCurrentA: amps, ratedLossW: 0, fixedLossW: pfix },
      ],
    };
  }

  function makeMccb(id, amps, modelSeries, pn, pfix, h, notes) {
    const frameLabel = amps <= 125 ? '125A Frame (3P)' : `${amps}A Frame (3P)`;
    return {
      id,
      category: 'MCCB',
      manufacturer: 'Generic IEC',
      modelSeries,
      frameSize: frameLabel,
      phases: '3P',
      sizeValue: amps,
      sizeLabel: `${amps} A`,
      name: `MCCB ${amps}A (${modelSeries})`,
      role: 'feeder',
      ratedCurrentA: amps,
      ratedLossW: pn,
      fixedLossW: pfix,
      defaultHeightMm: h,
      notes,
      sourceRef: 'IEC 60947-2 / IEC TR 60890 Typical 3-Pole MCCB Losses',
      sourceUrl: SOURCE_URLS.iec60947_2,
    };
  }

  function makeMcb(id, amps, pn, h) {
    return {
      id,
      category: 'MCB',
      manufacturer: 'Generic IEC',
      modelSeries: 'IEC 60898-1 3P',
      frameSize: '3P DIN (400V)',
      phases: '3P',
      sizeValue: amps,
      sizeLabel: `${amps} A`,
      name: `MCB ${amps}A 3P (Miniature Circuit Breaker)`,
      role: 'feeder',
      ratedCurrentA: amps,
      ratedLossW: pn,
      fixedLossW: 0,
      defaultHeightMm: h,
      notes: `Generic ${amps}A 3-Pole Miniature Circuit Breaker (~${(pn / 3).toFixed(1)}W/pole at In)`,
      sourceRef: 'IEC 60898-1 Table 6 / IEC TR 60890 Typical 3P MCB Losses',
      sourceUrl: SOURCE_URLS.iec60898_1,
    };
  }

  function makeMcb1P(id, amps, pn, h) {
    return {
      id,
      category: 'MCB',
      manufacturer: 'Generic IEC',
      modelSeries: 'IEC 60898-1 1P (230V)',
      frameSize: '1P DIN (230V)',
      phases: '1P',
      sizeValue: amps,
      sizeLabel: `${amps} A (1P)`,
      name: `MCB ${amps}A 1P (230V Single-Phase)`,
      role: 'feeder',
      ratedCurrentA: amps,
      ratedLossW: pn,
      fixedLossW: 0,
      defaultHeightMm: h,
      notes: `Single-phase 230V ${amps}A 1-Pole MCB (${pn.toFixed(1)}W at In) for lighting, sockets, trace heating, or control supplies`,
      sourceRef: 'IEC 60898-1 Table 6 / IEC TR 60890 Typical 1P MCB Losses',
      sourceUrl: SOURCE_URLS.iec60898_1,
    };
  }

  function makeRcbo1P(id, amps, pn, pfix, h) {
    return {
      id,
      category: 'RCBO (1P+N)',
      manufacturer: 'Generic IEC',
      modelSeries: 'IEC 61009-1 1P+N (230V)',
      frameSize: '1P+N DIN (230V)',
      phases: '1P',
      sizeValue: amps,
      sizeLabel: `${amps} A (1P+N)`,
      name: `RCBO ${amps}A 1P+N 30mA (230V Single-Phase)`,
      role: 'feeder',
      ratedCurrentA: amps,
      ratedLossW: pn,
      fixedLossW: pfix,
      defaultHeightMm: h,
      notes: `Single-phase 230V ${amps}A 1P+N RCBO (${pn.toFixed(1)}W poles + ${pfix.toFixed(1)}W electronic sensing)`,
      sourceRef: 'IEC 61009-1 Typical 1P+N RCBO Power Loss Data',
      sourceUrl: SOURCE_URLS.iec60898_1,
    };
  }

  function makeHeater1P(id, amps, kw, mcbW, contW, coilW, h) {
    const totalVar = Math.round((mcbW + contW) * 10) / 10;
    return {
      id,
      category: '1P Control / Heater',
      manufacturer: 'Generic IEC',
      modelSeries: '1P+N Contactor Circuit (230V)',
      frameSize: '1P+N DIN / Contactor (230V)',
      phases: '1P',
      sizeValue: amps,
      sizeLabel: `${amps} A (${kw} kW 1P)`,
      name: `1P Contactor / Heater Circuit ${amps}A (${kw} kW, 230V)`,
      role: 'feeder',
      ratedCurrentA: amps,
      ratedLossW: totalVar,
      fixedLossW: coilW,
      defaultKw: kw,
      defaultHeightMm: h,
      notes: `Single-phase 230V ${amps}A circuit: 1P MCB + 2P Contactor + Holding Coil (lighting, trace heating, space heaters)`,
      sourceRef: 'IEC 60947-4-1 / IEC 60898-1 Single-Phase Contactor Circuit Losses',
      sourceUrl: SOURCE_URLS.iec60947_4_1,
      subComponents: [
        { name: `1P MCB Isolator (${amps}A)`, ratedCurrentA: amps, ratedLossW: mcbW, fixedLossW: 0 },
        { name: `2P AC-1 Contactor (${amps}A Poles + Coil)`, ratedCurrentA: amps, ratedLossW: contW, fixedLossW: coilW },
      ],
    };
  }

  function makeDol1P(id, kw, frameA, mcbW, contW, coilW, olW, h) {
    const totalVar = Math.round((mcbW + contW + olW) * 10) / 10;
    return {
      id,
      category: 'DOL Starter',
      manufacturer: 'Generic IEC',
      modelSeries: 'IEC 60947-4-1 1P DOL (230V)',
      frameSize: '1P DOL (230V)',
      phases: '1P',
      sizeValue: kw,
      sizeLabel: `${kw} kW 1P (${frameA}A)`,
      name: `DOL Starter 1P ${kw} kW (230V, ${frameA}A frame)`,
      role: 'feeder',
      ratedCurrentA: frameA,
      ratedLossW: totalVar,
      fixedLossW: coilW,
      defaultKw: kw,
      defaultHeightMm: h,
      notes: `Single-phase 230V ${kw} kW Direct-On-Line motor starter: 1P MCB + 2P Contactor + Overload + Coil`,
      sourceRef: 'IEC 60947-4-1 Single-Phase DOL Starter Dissipation',
      sourceUrl: SOURCE_URLS.iec60947_4_1,
      subComponents: [
        { name: `1P MCB / MPCB Isolator (${frameA}A)`, ratedCurrentA: frameA, ratedLossW: mcbW, fixedLossW: 0 },
        { name: `2P Contactor (${frameA}A Poles + Coil)`, ratedCurrentA: frameA, ratedLossW: contW, fixedLossW: coilW },
        { name: 'Thermal Overload Relay (1P)', ratedCurrentA: frameA, ratedLossW: olW, fixedLossW: 0 },
      ],
    };
  }

  function makeDol(id, kw, frameA, mpcbW, contW, coilW, olW, auxW, h) {
    const totalVar = Math.round((mpcbW + contW + olW) * 10) / 10;
    const totalFix = Math.round((coilW + auxW) * 10) / 10;
    return {
      id,
      category: 'DOL Starter',
      manufacturer: 'Generic IEC',
      modelSeries: 'IEC 60947-4-1 AC-3 DOL',
      frameSize: '3P DOL (400V)',
      phases: '3P',
      sizeValue: kw,
      sizeLabel: `${kw} kW (${frameA}A)`,
      name: `DOL Starter ${kw} kW (${frameA}A frame)`,
      role: 'feeder',
      ratedCurrentA: frameA,
      ratedLossW: totalVar,
      fixedLossW: totalFix,
      defaultKw: kw,
      defaultHeightMm: h,
      notes: `Direct-On-Line ${kw} kW motor starter: MPCB/MCCB + AC-3 Contactor + Overload + Control Aux`,
      sourceRef: 'IEC 60947-4-1 / IEC TR 60890 Motor Starter Assembly Dissipation',
      sourceUrl: SOURCE_URLS.iec60947_4_1,
      subComponents: [
        { name: `MPCB / MCCB Isolator (${frameA}A)`, ratedCurrentA: frameA, ratedLossW: mpcbW, fixedLossW: 0 },
        { name: `Main AC-3 Contactor (${frameA}A Poles + Coil)`, ratedCurrentA: frameA, ratedLossW: contW, fixedLossW: coilW },
        { name: 'Thermal / Electronic Overload Relay', ratedCurrentA: frameA, ratedLossW: olW, fixedLossW: 0 },
        { name: 'Control Circuit / Pilot Lamps / Aux', ratedCurrentA: frameA, ratedLossW: 0, fixedLossW: auxW },
      ],
    };
  }

  function makeStarDelta(id, kw, frameA, mccbW, contW, coilsW, olW, auxW, h) {
    const totalVar = Math.round((mccbW + contW + olW) * 10) / 10;
    const totalFix = Math.round((coilsW + auxW) * 10) / 10;
    return {
      id,
      category: 'Star-Delta Starter',
      manufacturer: 'Generic IEC',
      modelSeries: 'IEC 60947-4-1 Star-Delta',
      frameSize: `${frameA}A Frame (3P)`,
      phases: '3P',
      sizeValue: kw,
      sizeLabel: `${kw} kW (${frameA}A)`,
      name: `Star-Delta Starter ${kw} kW (${frameA}A frame)`,
      role: 'feeder',
      ratedCurrentA: frameA,
      ratedLossW: totalVar,
      fixedLossW: totalFix,
      defaultKw: kw,
      defaultHeightMm: h,
      notes: `Star-Delta ${kw} kW: MCCB + Main & Delta Contactors in steady run (58% current each) + Overload + Timer`,
      sourceRef: 'IEC 60947-4-1 / IEC TR 60890 Star-Delta Run-Mode Losses',
      sourceUrl: SOURCE_URLS.iec60947_4_1,
      subComponents: [
        { name: `MCCB Isolator (${frameA}A)`, ratedCurrentA: frameA, ratedLossW: mccbW, fixedLossW: 0 },
        { name: 'Main + Delta Contactors (Run Mode, 2 Coils)', ratedCurrentA: frameA, ratedLossW: contW, fixedLossW: coilsW },
        { name: 'Overload Relay (Phase-Leg)', ratedCurrentA: frameA, ratedLossW: olW, fixedLossW: 0 },
        { name: 'Control Circuit & Star-Delta Timer', ratedCurrentA: frameA, ratedLossW: 0, fixedLossW: auxW },
      ],
    };
  }

  function makeSoftStarter(id, kw, frameA, mccbW, bypassW, elecW, h, nonBypassed) {
    const modelSeries = nonBypassed ? 'IEC 60947-4-2 Non-Bypassed SCR' : 'IEC 60947-4-2 Bypassed Run';
    const suffix = nonBypassed ? 'Non-Bypassed SCR' : 'Bypassed Run';
    const totalVar = Math.round((mccbW + bypassW) * 10) / 10;
    return {
      id,
      category: 'Soft Starter',
      manufacturer: 'Generic IEC',
      modelSeries,
      frameSize: `${suffix} (${frameA}A)`,
      phases: '3P',
      sizeValue: kw,
      sizeLabel: `${kw} kW (${frameA}A)`,
      name: `Soft Starter ${kw} kW (${suffix}, ${frameA}A)`,
      role: 'feeder',
      ratedCurrentA: frameA,
      ratedLossW: totalVar,
      fixedLossW: elecW,
      defaultKw: kw,
      defaultHeightMm: h,
      notes: nonBypassed
        ? `Continuous SCR conduction (~3.5 W/A across 3 phases) + MCCB + cooling fan`
        : `MCCB + Soft Starter with internal bypass contactor closed in steady-state run`,
      sourceRef: 'IEC 60947-4-2 Semiconductor Motor Controller Thermal Data',
      sourceUrl: SOURCE_URLS.iec60947_4_1,
      subComponents: [
        { name: `MCCB Isolator (${frameA}A)`, ratedCurrentA: frameA, ratedLossW: mccbW, fixedLossW: 0 },
        {
          name: nonBypassed ? 'Continuous SCR Thyristor Power Stage' : 'Soft Starter Internal Bypass Poles',
          ratedCurrentA: frameA,
          ratedLossW: bypassW,
          fixedLossW: 0,
          lossModel: nonBypassed ? 'vsd_efficiency' : 'bypassed_soft_starter',
        },
        { name: 'Soft Starter Control Electronics & Cooling Fan', ratedCurrentA: frameA, ratedLossW: 0, fixedLossW: elecW },
      ],
    };
  }

  function makeVsd(id, kw, frameA, pctLoss, mccbW, fanW, h) {
    const totalPowerStageW = Math.round(kw * 1000 * (pctLoss / 100));
    const totalVar = mccbW + totalPowerStageW;
    return {
      id,
      category: 'VSD / Inverter',
      manufacturer: 'Generic IEC',
      modelSeries: 'IEC 61800-9-2 VSD (IE2)',
      frameSize: `${frameA}A Frame (3P VSD)`,
      phases: '3P',
      sizeValue: kw,
      sizeLabel: `${kw} kW (${frameA}A)`,
      name: `VSD / Inverter Drive ${kw} kW (${pctLoss.toFixed(1)}% loss)`,
      role: 'feeder',
      ratedCurrentA: frameA,
      ratedLossW: totalVar,
      fixedLossW: fanW,
      defaultKw: kw,
      defaultHeightMm: h,
      notes: `High heat source! ${pctLoss.toFixed(1)}% of rated motor kW dissipated in rectifier/IGBT stage + input MCCB + cooling fans`,
      sourceRef: 'IEC 61800-9-2 Reference Complete Drive Module (CDM) Losses',
      sourceUrl: SOURCE_URLS.iec61800_9,
      subComponents: [
        { name: `Input MCCB / Fuse Isolator (${frameA}A)`, ratedCurrentA: frameA, ratedLossW: mccbW, fixedLossW: 0 },
        { name: `VSD Rectifier & IGBT Power Stage (${pctLoss.toFixed(1)}%)`, ratedCurrentA: frameA, ratedLossW: totalPowerStageW, fixedLossW: 0, lossModel: 'vsd_efficiency' },
        { name: 'VSD Control Board & Cooling Fans', ratedCurrentA: frameA, ratedLossW: 0, fixedLossW: fanW },
      ],
    };
  }

  const RAW_DEVICE_TEMPLATES = [
    // =========================================================================
    // 1. ACBs — Air Circuit Breakers (Incomers, Interconnectors & Bus Couplers)
    //    Includes 800A, 1000A, 1250A, 1600A, 2000A, 2500A, 3200A, 4000A!
    // =========================================================================
    makeAcb('acb-800',  'incomer', 'IEC 60947-2 Incomer ACB', 'ACB Incomer', 800,  110, 12, 700, 'Representative 800A drawout Incomer ACB with electronic trip unit'),
    makeAcb('acb-1000', 'incomer', 'IEC 60947-2 Incomer ACB', 'ACB Incomer', 1000, 145, 13, 720, 'Representative 1000A drawout Incomer ACB with electronic trip unit'),
    makeAcb('acb-1250', 'incomer', 'IEC 60947-2 Incomer ACB', 'ACB Incomer', 1250, 195, 14, 740, 'Representative 1250A drawout Incomer ACB with electronic trip unit'),
    makeAcb('acb-1600', 'incomer', 'IEC 60947-2 Incomer ACB', 'ACB Incomer', 1600, 260, 15, 750, 'Representative 1600A drawout Incomer ACB (e.g., MasterPact / Emax / 3WA)'),
    makeAcb('acb-2000', 'incomer', 'IEC 60947-2 Incomer ACB', 'ACB Incomer', 2000, 360, 16, 780, 'Representative 2000A drawout Incomer ACB'),
    makeAcb('acb-2500', 'incomer', 'IEC 60947-2 Incomer ACB', 'ACB Incomer', 2500, 480, 18, 800, 'Representative 2500A drawout Incomer ACB'),
    makeAcb('acb-3200', 'incomer', 'IEC 60947-2 Incomer ACB', 'ACB Incomer', 3200, 680, 20, 900, 'Representative 3200A drawout Incomer ACB'),
    makeAcb('acb-4000', 'incomer', 'IEC 60947-2 Incomer ACB', 'ACB Incomer', 4000, 880, 22, 950, 'Representative 4000A drawout Incomer ACB'),

    makeAcb('interconn-800',  'interconnector', 'IEC 60947-2 Interconnector ACB', 'Interconnector ACB', 800,  110, 12, 700, 'Outgoing 800A Interconnector ACB supplying remote firm-supply board'),
    makeAcb('interconn-1000', 'interconnector', 'IEC 60947-2 Interconnector ACB', 'Interconnector ACB', 1000, 145, 13, 720, 'Outgoing 1000A Interconnector ACB supplying remote firm-supply board'),
    makeAcb('interconn-1250', 'interconnector', 'IEC 60947-2 Interconnector ACB', 'Interconnector ACB', 1250, 195, 14, 740, 'Outgoing 1250A Interconnector ACB supplying remote B-Side firm-supply board'),
    makeAcb('interconn-1600', 'interconnector', 'IEC 60947-2 Interconnector ACB', 'Interconnector ACB', 1600, 260, 15, 750, 'Outgoing 1600A Interconnector ACB supplying remote B-Side firm-supply board'),
    makeAcb('interconn-2000', 'interconnector', 'IEC 60947-2 Interconnector ACB', 'Interconnector ACB', 2000, 360, 16, 780, 'Outgoing 2000A Interconnector ACB supplying remote B-Side firm-supply board'),
    makeAcb('interconn-2500', 'interconnector', 'IEC 60947-2 Interconnector ACB', 'Interconnector ACB', 2500, 480, 18, 800, 'Outgoing 2500A Interconnector ACB supplying remote B-Side firm-supply board'),
    makeAcb('interconn-3200', 'interconnector', 'IEC 60947-2 Interconnector ACB', 'Interconnector ACB', 3200, 680, 20, 900, 'Outgoing 3200A Interconnector ACB supplying remote B-Side firm-supply board'),

    makeAcb('coupler-800',  'bus_coupler', 'IEC 60947-2 Bus-Section Coupler ACB', 'Bus-Section Coupler ACB', 800,  100, 12, 700, '800A Bus-section coupler between Section A and Section B'),
    makeAcb('coupler-1250', 'bus_coupler', 'IEC 60947-2 Bus-Section Coupler ACB', 'Bus-Section Coupler ACB', 1250, 180, 14, 740, '1250A Bus-section coupler between Section A and Section B'),
    makeAcb('coupler-1600', 'bus_coupler', 'IEC 60947-2 Bus-Section Coupler ACB', 'Bus-Section Coupler ACB', 1600, 240, 15, 750, '1600A Bus-section coupler between Section A and Section B'),
    makeAcb('coupler-2000', 'bus_coupler', 'IEC 60947-2 Bus-Section Coupler ACB', 'Bus-Section Coupler ACB', 2000, 330, 15, 780, '2000A Bus-section coupler between Section A and Section B'),
    makeAcb('coupler-2500', 'bus_coupler', 'IEC 60947-2 Bus-Section Coupler ACB', 'Bus-Section Coupler ACB', 2500, 440, 15, 800, '2500A Bus-section coupler between Section A and Section B'),
    makeAcb('coupler-3200', 'bus_coupler', 'IEC 60947-2 Bus-Section Coupler ACB', 'Bus-Section Coupler ACB', 3200, 630, 18, 900, '3200A Bus-section coupler between Section A and Section B'),

    // =========================================================================
    // 2. DOL Starters — Complete IEC 400V 3-Phase Series (0.75 kW – 55 kW)
    // =========================================================================
    makeDol('dol-0.75kw', 0.75, 4,   4.0,  1.2,  3.5,  2.5, 2.0, 180),
    makeDol('dol-1.5kw',  1.5,  6,   4.5,  1.5,  3.5,  3.0, 2.0, 180),
    makeDol('dol-2.2kw',  2.2,  9,   5.0,  2.0,  4.0,  3.5, 2.0, 180),
    makeDol('dol-4kw',    4.0,  12,  5.5,  3.0,  4.5,  4.5, 2.5, 190),
    makeDol('dol-5.5kw',  5.5,  16,  6.2,  4.0,  5.0,  5.2, 2.5, 190),
    makeDol('dol-7.5kw',  7.5,  25,  7.0,  5.0,  6.0,  6.0, 3.0, 200),
    makeDol('dol-11kw',   11.0, 32,  9.0,  7.0,  7.0,  6.5, 3.5, 210),
    makeDol('dol-15kw',   15.0, 40,  11.0, 9.0,  8.0,  7.0, 4.0, 220),
    makeDol('dol-18.5kw', 18.5, 50,  13.0, 11.0, 9.0,  7.5, 4.5, 240),
    makeDol('dol-22kw',   22.0, 63,  15.0, 13.0, 10.0, 8.0, 5.0, 250),
    makeDol('dol-30kw',   30.0, 80,  19.0, 17.0, 11.0, 9.0, 5.0, 280),
    makeDol('dol-37kw',   37.0, 100, 24.0, 21.0, 12.0, 10.0, 6.0, 300),
    makeDol('dol-45kw',   45.0, 125, 28.0, 27.0, 13.5, 11.0, 6.5, 320),
    makeDol('dol-55kw',   55.0, 160, 32.0, 34.0, 15.0, 12.0, 7.0, 350),
    // Single-Phase 230V DOL Starters
    makeDol1P('dol1p-0.75kw', 0.75, 10, 1.8, 1.2, 4.0, 2.0, 170),
    makeDol1P('dol1p-1.5kw',  1.5,  16, 2.2, 1.8, 4.5, 2.5, 170),
    makeDol1P('dol1p-2.2kw',  2.2,  20, 2.5, 2.4, 5.0, 3.0, 180),
    makeDol1P('dol1p-3kw',    3.0,  25, 3.0, 3.0, 5.5, 3.5, 180),

    // =========================================================================
    // 2b. 1P Control, Lighting & Trace Heating Contactor Circuits (230V 1P+N)
    // =========================================================================
    makeHeater1P('htr1p-16', 16, 3.5, 2.2, 1.8, 4.5, 160),
    makeHeater1P('htr1p-32', 32, 7.0, 3.3, 3.4, 6.0, 170),
    makeHeater1P('htr1p-63', 63, 14.0, 5.4, 6.5, 8.0, 190),

    // =========================================================================
    // 3. HRC Fuse-Switches — Complete Eaton Bussmann NH gG Series (2A – 1250A)
    //    Source: Eaton Bussmann Data Sheet 10164 (500V AC gG)
    // =========================================================================
    ...[
      { id: 'hrc-2',      part: '2NHG000B',   size: 'NH000', amps: 2,    wLink: 3.9,   wBase: 0.6,  h: 160 },
      { id: 'hrc-4',      part: '4NHG000B',   size: 'NH000', amps: 4,    wLink: 1.8,   wBase: 0.6,  h: 160 },
      { id: 'hrc-6',      part: '6NHG000B',   size: 'NH000', amps: 6,    wLink: 2.0,   wBase: 0.9,  h: 160 },
      { id: 'hrc-10',     part: '10NHG000B',  size: 'NH000', amps: 10,   wLink: 1.5,   wBase: 1.2,  h: 160 },
      { id: 'hrc-16-000', part: '16NHG000B',  size: 'NH000', amps: 16,   wLink: 2.3,   wBase: 1.5,  h: 160 },
      { id: 'hrc-16',     part: '16NHG0B',    size: 'NH0',   amps: 16,   wLink: 3.0,   wBase: 1.5,  h: 180 },
      { id: 'hrc-20',     part: '20NHG000B',  size: 'NH000', amps: 20,   wLink: 2.6,   wBase: 1.8,  h: 160 },
      { id: 'hrc-25',     part: '25NHG000B',  size: 'NH000', amps: 25,   wLink: 3.1,   wBase: 2.1,  h: 160 },
      { id: 'hrc-32',     part: '32NHG000B',  size: 'NH000', amps: 32,   wLink: 3.4,   wBase: 2.4,  h: 160 },
      { id: 'hrc-35',     part: '35NHG000B',  size: 'NH000', amps: 35,   wLink: 3.6,   wBase: 2.7,  h: 160 },
      { id: 'hrc-40',     part: '40NHG000B',  size: 'NH000', amps: 40,   wLink: 3.9,   wBase: 3.0,  h: 180 },
      { id: 'hrc-50',     part: '50NHG000B',  size: 'NH000', amps: 50,   wLink: 4.2,   wBase: 3.6,  h: 180 },
      { id: 'hrc-63',     part: '63NHG000B',  size: 'NH000', amps: 63,   wLink: 4.6,   wBase: 4.5,  h: 180 },
      { id: 'hrc-80',     part: '80NHG000B',  size: 'NH000', amps: 80,   wLink: 6.1,   wBase: 6.0,  h: 200 },
      { id: 'hrc-100',    part: '100NHG000B', size: 'NH000', amps: 100,  wLink: 7.4,   wBase: 7.5,  h: 200 },
      { id: 'hrc-125',    part: '125NHG00B',  size: 'NH00',  amps: 125,  wLink: 8.8,   wBase: 9.0,  h: 220 },
      { id: 'hrc-160',    part: '160NHG00B',  size: 'NH00',  amps: 160,  wLink: 10.0,  wBase: 12.0, h: 240 },
      { id: 'hrc-200',    part: '200NHG1B',   size: 'NH1',   amps: 200,  wLink: 15.5,  wBase: 15.0, h: 280 },
      { id: 'hrc-224',    part: '224NHG1B',   size: 'NH1',   amps: 224,  wLink: 17.5,  wBase: 16.5, h: 280 },
      { id: 'fuse-250',   part: '250NHG1B',   size: 'NH1',   amps: 250,  wLink: 19.0,  wBase: 18.0, h: 300 },
      { id: 'hrc-300',    part: '300NHG2B',   size: 'NH2',   amps: 300,  wLink: 22.5,  wBase: 20.0, h: 320 },
      { id: 'hrc-315',    part: '315NHG2B',   size: 'NH2',   amps: 315,  wLink: 24.0,  wBase: 21.0, h: 320 },
      { id: 'hrc-355',    part: '355NHG2B',   size: 'NH2',   amps: 355,  wLink: 27.0,  wBase: 23.0, h: 340 },
      { id: 'fuse-400',   part: '400NHG2B',   size: 'NH2',   amps: 400,  wLink: 30.0,  wBase: 25.0, h: 350 },
      { id: 'hrc-425',    part: '425NHG3B',   size: 'NH3',   amps: 425,  wLink: 33.0,  wBase: 27.0, h: 380 },
      { id: 'hrc-500',    part: '500NHG3B',   size: 'NH3',   amps: 500,  wLink: 38.0,  wBase: 30.0, h: 400 },
      { id: 'hrc-630',    part: '630NHG3B',   size: 'NH3',   amps: 630,  wLink: 47.0,  wBase: 36.0, h: 420 },
      { id: 'hrc-710',    part: '710NHG4G',   size: 'NH4',   amps: 710,  wLink: 58.0,  wBase: 42.0, h: 480 },
      { id: 'hrc-800',    part: '800NHG4G',   size: 'NH4',   amps: 800,  wLink: 68.0,  wBase: 48.0, h: 500 },
      { id: 'hrc-1000',   part: '1000NHG4G',  size: 'NH4',   amps: 1000, wLink: 80.0,  wBase: 60.0, h: 550 },
      { id: 'hrc-1250',   part: '1250NHG4G',  size: 'NH4',   amps: 1250, wLink: 108.0, wBase: 75.0, h: 600 },
    ].map((f) => {
      const links3P = Math.round(f.wLink * 3 * 10) / 10;
      const totalPn = Math.round((links3P + f.wBase) * 10) / 10;
      return {
        id: f.id,
        category: 'HRC Fuse-Switch',
        manufacturer: 'Eaton Bussmann',
        modelSeries: `${f.size} gG HRC`,
        frameSize: `${f.size} (3P)`,
        phases: '3P',
        sizeValue: f.amps,
        sizeLabel: `${f.amps} A`,
        name: `Eaton ${f.part} — ${f.amps}A ${f.size} gG HRC (${f.wLink}W/link)`,
        role: 'feeder',
        ratedCurrentA: f.amps,
        ratedLossW: totalPn,
        fixedLossW: 0,
        defaultHeightMm: f.h,
        notes: `Eaton Bussmann Data Sheet 10164 (500V AC gG): 3×${f.part} (${f.wLink}W/link = ${links3P}W) + Fuse-Switch/Base contacts (${f.wBase}W)`,
        sourceRef: `Eaton Bussmann Data Sheet 10164 — ${f.part} (${f.size} gG 500V AC)`,
        sourceUrl: SOURCE_URLS.eatonNH,
        subComponents: [
          { name: `3× Eaton ${f.part} HRC Links (${f.wLink}W ea)`, ratedCurrentA: f.amps, ratedLossW: links3P, fixedLossW: 0 },
          { name: `${f.size} Fuse-Switch / Base Contacts (3P)`, ratedCurrentA: f.amps, ratedLossW: f.wBase, fixedLossW: 0 },
        ],
      };
    }),
    // Single-Phase 230V Eaton Bussmann NH gG HRC Fuse-Switches (1 link + 1P base)
    ...[
      { id: 'hrc1p-16',  part: '16NHG000B',  size: 'NH000', amps: 16,  wLink: 2.3,  wBase1P: 0.6, h: 150 },
      { id: 'hrc1p-32',  part: '32NHG000B',  size: 'NH000', amps: 32,  wLink: 3.4,  wBase1P: 0.9, h: 150 },
      { id: 'hrc1p-63',  part: '63NHG000B',  size: 'NH000', amps: 63,  wLink: 4.6,  wBase1P: 1.6, h: 160 },
      { id: 'hrc1p-100', part: '100NHG000B', size: 'NH000', amps: 100, wLink: 7.4,  wBase1P: 2.6, h: 180 },
      { id: 'hrc1p-125', part: '125NHG00B',  size: 'NH00',  amps: 125, wLink: 8.8,  wBase1P: 3.2, h: 200 },
      { id: 'hrc1p-160', part: '160NHG00B',  size: 'NH00',  amps: 160, wLink: 10.0, wBase1P: 4.0, h: 220 },
    ].map((f) => {
      const totalPn = Math.round((f.wLink + f.wBase1P) * 10) / 10;
      return {
        id: f.id,
        category: 'HRC Fuse-Switch',
        manufacturer: 'Eaton Bussmann',
        modelSeries: `1P ${f.size} gG HRC (230V)`,
        frameSize: `${f.size} (1P 230V)`,
        phases: '1P',
        sizeValue: f.amps,
        sizeLabel: `${f.amps} A (1P)`,
        name: `Eaton ${f.part} 1P — ${f.amps}A ${f.size} gG HRC (230V, ${f.wLink}W/link)`,
        role: 'feeder',
        ratedCurrentA: f.amps,
        ratedLossW: totalPn,
        fixedLossW: 0,
        defaultHeightMm: f.h,
        notes: `Single-phase 230V Eaton Bussmann DS 10164: 1×${f.part} (${f.wLink}W) + 1P base contacts (${f.wBase1P}W)`,
        sourceRef: `Eaton Bussmann Data Sheet 10164 — ${f.part} (1P ${f.size} gG)`,
        sourceUrl: SOURCE_URLS.eatonNH,
        subComponents: [
          { name: `1× Eaton ${f.part} HRC Link (${f.wLink}W)`, ratedCurrentA: f.amps, ratedLossW: f.wLink, fixedLossW: 0 },
          { name: `${f.size} 1P Fuse-Base Contacts`, ratedCurrentA: f.amps, ratedLossW: f.wBase1P, fixedLossW: 0 },
        ],
      };
    }),

    // =========================================================================
    // 4. MCBs — Miniature Circuit Breakers (3P 6A–125A + 1P 230V 6A–63A)
    // =========================================================================
    makeMcb('mcb-6',   6,   4.5,  150),
    makeMcb('mcb-10',  10,  5.4,  150),
    makeMcb('mcb-16',  16,  6.6,  150),
    makeMcb('mcb-20',  20,  7.5,  150),
    makeMcb('mcb-32',  32,  9.9,  150),
    makeMcb('mcb-40',  40,  11.7, 150),
    makeMcb('mcb-63',  63,  16.0, 150),
    makeMcb('mcb-80',  80,  21.0, 160),
    makeMcb('mcb-100', 100, 25.5, 160),
    makeMcb('mcb-125', 125, 31.5, 170),
    makeMcb1P('mcb1p-6',  6,  1.5, 140),
    makeMcb1P('mcb1p-10', 10, 1.8, 140),
    makeMcb1P('mcb1p-16', 16, 2.2, 140),
    makeMcb1P('mcb1p-20', 20, 2.5, 140),
    makeMcb1P('mcb1p-25', 25, 2.9, 140),
    makeMcb1P('mcb1p-32', 32, 3.3, 140),
    makeMcb1P('mcb1p-40', 40, 3.9, 140),
    makeMcb1P('mcb1p-50', 50, 4.6, 150),
    makeMcb1P('mcb1p-63', 63, 5.4, 150),

    // =========================================================================
    // 4b. RCBOs — Single-Phase 1P+N Residual Current Breakers (230V 6A–40A)
    // =========================================================================
    makeRcbo1P('rcbo1p-6',  6,  2.4, 0.5, 150),
    makeRcbo1P('rcbo1p-10', 10, 2.8, 0.5, 150),
    makeRcbo1P('rcbo1p-16', 16, 3.4, 0.5, 150),
    makeRcbo1P('rcbo1p-20', 20, 3.9, 0.5, 150),
    makeRcbo1P('rcbo1p-32', 32, 5.1, 0.5, 150),
    makeRcbo1P('rcbo1p-40', 40, 6.2, 0.5, 150),

    // =========================================================================
    // 5. MCCBs — Moulded Case Circuit Breakers (16A – 1600A)
    // =========================================================================
    makeMccb('mccb-16',   16,   '3P Thermal-Mag', 9.0,   0, 180, 'Generic 16A MCCB (~3W/pole at In)'),
    makeMccb('mccb-25',   25,   '3P Thermal-Mag', 10.5,  0, 180, 'Generic 25A MCCB (~3.5W/pole at In)'),
    makeMccb('mccb-32',   32,   '3P Thermal-Mag', 12.0,  0, 180, 'Generic 32A MCCB (~4W/pole at In)'),
    makeMccb('mccb-40',   40,   '3P Thermal-Mag', 13.5,  0, 180, 'Generic 40A MCCB (~4.5W/pole at In)'),
    makeMccb('mccb-63',   63,   '3P Thermal-Mag', 18.0,  0, 190, 'Generic 63A MCCB (~6W/pole at In)'),
    makeMccb('mccb-100',  100,  '3P Thermal-Mag', 24.0,  0, 200, 'Generic 100A frame MCCB (~8W/pole at In)'),
    makeMccb('mccb-125',  125,  '3P Thermal-Mag', 27.0,  0, 200, 'Generic 125A frame MCCB (~9W/pole at In)'),
    makeMccb('mccb-160',  160,  '3P Electronic',  30.0,  2, 200, 'Generic 160A frame MCCB (~10W/pole at In)'),
    makeMccb('mccb-250',  250,  '3P Electronic',  42.0,  2, 250, 'Generic 250A frame MCCB (~14W/pole at In)'),
    makeMccb('mccb-400',  400,  '3P Electronic',  66.0,  3, 300, 'Generic 400A frame MCCB (~22W/pole at In)'),
    makeMccb('mccb-630',  630,  '3P Electronic',  114.0, 4, 400, 'Generic 630A frame MCCB (~38W/pole at In)'),
    makeMccb('mccb-800',  800,  '3P Electronic',  165.0, 5, 450, 'Generic 800A frame MCCB (~55W/pole at In)'),
    makeMccb('mccb-1000', 1000, '3P Electronic',  210.0, 6, 500, 'Generic 1000A frame MCCB (~70W/pole at In)'),
    makeMccb('mccb-1250', 1250, '3P Electronic',  270.0, 8, 550, 'Generic 1250A frame MCCB (~90W/pole at In)'),
    makeMccb('mccb-1600', 1600, '3P Electronic',  360.0, 10, 600, 'Generic 1600A frame MCCB (~120W/pole at In)'),

    // =========================================================================
    // 6. Soft Starters — Bypassed Run (7.5 kW – 250 kW) + Non-Bypassed SCR
    // =========================================================================
    makeSoftStarter('ss-7.5kw',   7.5,  25,  7,   6,   15, 260, false),
    makeSoftStarter('ss-11kw',    11.0, 32,  9,   7,   18, 280, false),
    makeSoftStarter('ss-15kw',    15.0, 40,  11,  8,   20, 300, false),
    makeSoftStarter('ss-18.5kw',  18.5, 50,  13,  10,  22, 310, false),
    makeSoftStarter('ss-22kw',    22.0, 63,  16,  11,  22, 320, false),
    makeSoftStarter('ss-30kw',    30.0, 80,  22,  14,  25, 350, false),
    makeSoftStarter('ss-37kw',    37.0, 100, 24,  17,  28, 360, false),
    makeSoftStarter('ss-45kw',    45.0, 125, 28,  20,  32, 380, false),
    makeSoftStarter('ss-55kw',    55.0, 160, 34,  25,  35, 420, false),
    makeSoftStarter('ss-75kw',    75.0, 200, 42,  32,  42, 460, false),
    makeSoftStarter('ss-90kw',    90.0, 250, 50,  38,  48, 500, false),
    makeSoftStarter('ss-110kw',   110,  250, 55,  45,  55, 540, false),
    makeSoftStarter('ss-132kw',   132,  315, 65,  54,  60, 580, false),
    makeSoftStarter('ss-160kw',   160,  400, 75,  64,  68, 620, false),
    makeSoftStarter('ss-200kw',   200,  400, 92,  80,  75, 680, false),
    makeSoftStarter('ss-250kw',   250,  630, 118, 102, 85, 740, false),
    makeSoftStarter('ss-nb-30kw', 30.0, 80,  22,  210, 35, 400, true),
    makeSoftStarter('ss-nb-75kw', 75.0, 200, 42,  520, 55, 520, true),

    // =========================================================================
    // 7. Spare Spaces, Placeholders & Auxiliary Chambers
    // =========================================================================
    {
      id: 'spare-space',
      category: 'Spare / Placeholder',
      manufacturer: 'Switchgear Enclosure',
      modelSeries: 'Blank Reserve Bay',
      sizeValue: 0,
      sizeLabel: '0 W',
      name: 'Spare Space / Blank Reserve Bay (0 W)',
      role: 'spacer',
      ratedCurrentA: 1,
      ratedLossW: 0,
      fixedLossW: 0,
      defaultHeightMm: 250,
      notes: 'Physical blank/equipped spare space occupying cubicle height on GA (0 A, 0 W)',
      sourceRef: 'IEC 61439-1 Physical Compartment Allocation',
      sourceUrl: SOURCE_URLS.iec61439_1,
    },
    {
      id: 'placeholder-bay',
      category: 'Spare / Placeholder',
      manufacturer: 'Switchgear Enclosure',
      modelSeries: 'Future Placeholder',
      sizeValue: 0,
      sizeLabel: '0 W',
      name: 'Equipment Placeholder Bay (0 W)',
      role: 'spacer',
      ratedCurrentA: 1,
      ratedLossW: 0,
      fixedLossW: 0,
      defaultHeightMm: 300,
      notes: 'Reserves physical space on GA for undefined future equipment or marshalling',
      sourceRef: 'IEC 61439-1 Physical Compartment Allocation',
      sourceUrl: SOURCE_URLS.iec61439_1,
    },
    {
      id: 'aux-chamber',
      category: 'Spare / Placeholder',
      manufacturer: 'Switchgear Enclosure',
      modelSeries: 'Metering / Control Aux',
      sizeValue: 15,
      sizeLabel: '15 W aux',
      name: 'Metering / Marshalling Chamber (15 W aux)',
      role: 'spacer',
      ratedCurrentA: 1,
      ratedLossW: 0,
      fixedLossW: 15,
      defaultHeightMm: 300,
      notes: 'Control, metering, or cable marshalling compartment with small fixed auxiliary heat',
      sourceRef: 'Typical Panel Metering / Control PSU Allowance',
      sourceUrl: SOURCE_URLS.iec61439_1,
    },

    // =========================================================================
    // 8. Star-Delta Starters — Complete IEC 400V Series (11 kW – 160 kW)
    // =========================================================================
    makeStarDelta('sd-11kw',   11.0, 32,  9,   14,  14, 6,  5,  300),
    makeStarDelta('sd-15kw',   15.0, 40,  11,  17,  15, 7,  5,  320),
    makeStarDelta('sd-18.5kw', 18.5, 50,  13,  20,  16, 8,  6,  340),
    makeStarDelta('sd-22kw',   22.0, 63,  16,  23,  17, 9,  6,  360),
    makeStarDelta('sd-30kw',   30.0, 80,  20,  28,  18, 10, 6,  380),
    makeStarDelta('sd-37kw',   37.0, 100, 24,  33,  20, 11, 7,  400),
    makeStarDelta('sd-45kw',   45.0, 125, 29,  39,  21, 13, 7,  420),
    makeStarDelta('sd-55kw',   55.0, 160, 34,  45,  22, 14, 8,  430),
    makeStarDelta('sd-75kw',   75.0, 200, 40,  52,  24, 16, 10, 450),
    makeStarDelta('sd-90kw',   90.0, 250, 48,  64,  26, 18, 10, 500),
    makeStarDelta('sd-110kw',  110,  250, 56,  76,  28, 21, 12, 540),
    makeStarDelta('sd-132kw',  132,  315, 66,  90,  30, 24, 12, 580),
    makeStarDelta('sd-160kw',  160,  400, 78,  108, 34, 28, 14, 620),

    // =========================================================================
    // 9. VSD / Variable Speed Drives — Complete Series (0.75 kW – 250 kW)
    // =========================================================================
    makeVsd('vsd-0.75kw', 0.75, 4,   4.5, 4,   12, 260),
    makeVsd('vsd-1.5kw',  1.5,  6,   4.2, 5,   15, 280),
    makeVsd('vsd-2.2kw',  2.2,  9,   4.0, 6,   18, 300),
    makeVsd('vsd-4kw',    4.0,  12,  3.8, 7,   22, 320),
    makeVsd('vsd-5.5kw',  5.5,  16,  3.5, 8,   25, 340),
    makeVsd('vsd-7.5kw',  7.5,  20,  3.3, 9,   28, 360),
    makeVsd('vsd-11kw',   11.0, 25,  3.1, 11,  32, 380),
    makeVsd('vsd-15kw',   15.0, 32,  3.0, 12,  35, 400),
    makeVsd('vsd-18.5kw', 18.5, 40,  2.9, 14,  40, 440),
    makeVsd('vsd-22kw',   22.0, 50,  2.9, 16,  45, 480),
    makeVsd('vsd-30kw',   30.0, 63,  2.8, 20,  52, 520),
    makeVsd('vsd-37kw',   37.0, 80,  2.8, 24,  58, 560),
    makeVsd('vsd-45kw',   45.0, 90,  2.8, 28,  65, 600),
    makeVsd('vsd-55kw',   55.0, 125, 2.7, 34,  75, 660),
    makeVsd('vsd-75kw',   75.0, 160, 2.6, 44,  90, 740),
    makeVsd('vsd-90kw',   90.0, 200, 2.6, 52,  105, 820),
    makeVsd('vsd-110kw',  110,  250, 2.5, 64,  120, 900),
    makeVsd('vsd-132kw',  132,  315, 2.5, 76,  135, 980),
    makeVsd('vsd-160kw',  160,  400, 2.4, 92,  155, 1080),
    makeVsd('vsd-200kw',  200,  400, 2.4, 115, 180, 1200),
    makeVsd('vsd-250kw',  250,  630, 2.3, 145, 210, 1320),
  ];

  function naturalCompare(a, b) {
    return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
  }

  /**
   * Sort device library strictly by:
   *   1. Type (category)
   *   2. Manufacturer
   *   3. Model Type / Series
   *   4. Size (numeric kW or A ascending)
   */
  function sortDeviceLibrary(list) {
    return [...(list || [])].sort((a, b) => {
      const c1 = naturalCompare(a.category, b.category);
      if (c1 !== 0) return c1;
      const m1 = naturalCompare(a.manufacturer || 'Generic IEC', b.manufacturer || 'Generic IEC');
      if (m1 !== 0) return m1;
      const s1 = naturalCompare(a.modelSeries || '', b.modelSeries || '');
      if (s1 !== 0) return s1;
      const szA = Number(a.sizeValue != null ? a.sizeValue : a.defaultKw != null ? a.defaultKw : a.ratedCurrentA) || 0;
      const szB = Number(b.sizeValue != null ? b.sizeValue : b.defaultKw != null ? b.defaultKw : b.ratedCurrentA) || 0;
      if (szA !== szB) return szA - szB;
      return (Number(a.ratedCurrentA) || 0) - (Number(b.ratedCurrentA) || 0);
    });
  }

  const DEFAULT_DEVICE_TEMPLATES = sortDeviceLibrary(RAW_DEVICE_TEMPLATES);

  function cloneTemplate(tpl) {
    return JSON.parse(JSON.stringify(tpl));
  }

  return {
    SOURCE_URLS,
    BUSBAR_PRESETS,
    DEFAULT_DEVICE_TEMPLATES,
    sortDeviceLibrary,
    cloneTemplate,
  };
})();
