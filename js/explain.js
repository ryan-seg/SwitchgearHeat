/**
 * Universal Interactive Calculation Analyser & Engineering Commentary Engine
 * Click ANY calculated number to inspect its exact formula, substituted inputs,
 * step-by-step arithmetic, and commentary — AND edit any input parameter live
 * right inside the modal with immediate two-way sync across the entire switchboard!
 */

window.SGExplain = (function () {
  'use strict';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(num, dp) {
    return Number(num || 0).toFixed(dp != null ? dp : 2);
  }

  function buildExplanation(key, ctx, project, evalRes) {
    const cfg = project.config;
    const t = evalRes.totals;
    const hr = evalRes.hbbRes;
    const bb = project.mainBusbar;

    // 1. KPI: Total Switchgear Heat Loss
    if (key === 'kpi.grandTotal') {
      return {
        title: 'Total Switchgear Heat Output (kW & W)',
        badge: `Scenario: ${evalRes.scenario.toUpperCase()}`,
        resultText: `${fmt(t.grandTotalKW, 3)} kW (${fmt(t.grandTotalW, 1)} W · ${Math.round(t.btuPerHr).toLocaleString()} BTU/hr)`,
        formula: 'P_total = P_busbars + P_devices + P_interconn_cable + P_auxiliaries',
        inputs: [
          { name: 'Main Horizontal Busbar (HBB)', val: `${fmt(t.totalHbbLossW, 1)} W`, note: `Sum of ${evalRes.hbbSegments.length} spans (${fmt(t.totalHbbLenM, 2)} m)` },
          { name: 'Vertical Dropper Busbars (VBB)', val: `${fmt(t.totalVbbLossW, 1)} W`, note: `Sum of ${evalRes.vbbSegments.length} vertical spans (${fmt(t.totalVbbLenM, 2)} m)` },
          {
            name: 'Take-off Tail Length per Tier',
            helpKey: 'cfg.tail',
            val: `${cfg.takeoffTailLengthM} m`,
            note: `Contributes to ${fmt(t.totalTakeoffAndJointW, 1)} W take-off/joint losses`,
            edit: { type: 'number', value: cfg.takeoffTailLengthM, min: 0, max: 2, step: 0.05, unit: 'm', apply: (v) => (cfg.takeoffTailLengthM = Math.max(0, Number(v) || 0)) },
          },
          {
            name: 'Bolted Joint Resistance',
            helpKey: 'cfg.joint',
            val: `${cfg.jointResistanceUOhm} µΩ`,
            note: 'Per bolted 3-phase copper lap joint',
            edit: { type: 'number', value: cfg.jointResistanceUOhm, min: 0, max: 30, step: 1, unit: 'µΩ', apply: (v) => (cfg.jointResistanceUOhm = Math.max(0, Number(v) || 0)) },
          },
          {
            name: 'Board Rated Diversity Factor (RDF)',
            helpKey: 'cfg.rdf',
            val: `${cfg.diversityFactorRDF}`,
            note: 'Applied when summing local feeders onto busbars',
            edit: { type: 'number', value: cfg.diversityFactorRDF, min: 0.3, max: 1.0, step: 0.05, unit: 'pu', apply: (v) => (cfg.diversityFactorRDF = Math.min(1, Math.max(0.2, Number(v) || 1))) },
          },
          {
            name: 'Panel Auxiliary Losses',
            helpKey: 'cfg.aux',
            val: `${fmt(t.totalAuxW, 0)} W`,
            note: 'Meters, 24V DC PSU, PLC/SCADA, panel lighting',
            edit: { type: 'number', value: cfg.auxiliaryLossesW, min: 0, max: 5000, step: 10, unit: 'W', apply: (v) => (cfg.auxiliaryLossesW = Math.max(0, Number(v) || 0)) },
          },
          { name: 'Protective Devices & Starters', val: `${fmt(t.totalDevicesW, 1)} W`, note: `Incomers ${fmt(t.totalIncomerDevicesW, 0)}W · Starters/VSD ${fmt(t.totalStarterDevicesW, 0)}W · Feeders ${fmt(t.totalFeederDevicesW, 0)}W · IC ${fmt(t.totalInterconnectorDeviceW, 0)}W` },
          { name: 'Interconnector Internal Cable', val: `${fmt(t.totalInterconnectorCableW, 1)} W`, note: 'Internal cable riser inside cubicle' },
        ],
        steps: [
          {
            label: 'Step 1 — Sum Total Busbar System Losses',
            math: `P_busbars = ${fmt(t.totalHbbLossW, 1)} (HBB) + ${fmt(t.totalVbbLossW, 1)} (VBB) + ${fmt(t.totalTakeoffAndJointW, 1)} (Tails & Joints) = ${fmt(t.totalBusbarW, 1)} W`,
            note: 'Combines horizontal busbars, tapering vertical droppers, take-off tails, and bolted splice/tap joints.',
          },
          {
            label: 'Step 2 — Sum All Protective Devices, HRC Fuses & Starters',
            math: `P_devices = ${fmt(t.totalIncomerDevicesW, 1)} + ${fmt(t.totalStarterDevicesW, 1)} + ${fmt(t.totalFeederDevicesW, 1)} + ${fmt(t.totalInterconnectorDeviceW, 1)} = ${fmt(t.totalDevicesW, 1)} W`,
            note: 'Every device is evaluated at its actual operating current I_op using IEC TR 60890 scaling.',
          },
          {
            label: 'Step 3 — Grand Total in Watts & Kilowatts',
            math: `P_total = ${fmt(t.totalBusbarW, 1)} + ${fmt(t.totalDevicesW, 1)} + ${fmt(t.totalInterconnectorCableW, 1)} + ${fmt(t.totalAuxW, 1)} = ${fmt(t.grandTotalW, 1)} W = ${fmt(t.grandTotalKW, 3)} kW`,
            note: 'Dividing Watts by 1,000 gives Kilowatts (kW).',
          },
          {
            label: 'Step 4 — Thermal Equivalent (British Thermal Units per Hour, BTU/hr)',
            math: `Q_BTU = ${fmt(t.grandTotalW, 1)} W × 3.41214 = ${Math.round(t.btuPerHr).toLocaleString()} BTU/hr`,
            note: '1 W = 3.41214 BTU/hr for Heating, Ventilation, and Air Conditioning (HVAC) sizing.',
          },
        ],
        commentary: [
          `In this scenario (${evalRes.scenario}), busbars & joints produce ${fmt((t.totalBusbarW / Math.max(1, t.grandTotalW)) * 100, 1)}% of heat output, while protective devices, fuses & starters produce ${fmt((t.totalDevicesW / Math.max(1, t.grandTotalW)) * 100, 1)}%.`,
          'Edit any input above (such as RDF, bolted joint resistance, or panel auxiliaries) to immediately see the sensitivity across the entire switchboard.',
        ],
      };
    }

    // 2. KPI: Busbar & Joint Losses
    if (key === 'kpi.busbars') {
      const hbbJointsW = evalRes.hbbSegments.reduce((a, b) => a + b.jointLossW, 0);
      const tierTakeoffsW = t.totalTakeoffAndJointW - hbbJointsW;
      return {
        title: 'Total Busbar, Dropper & Joint Losses',
        badge: 'Joule Heating (I²R_AC)',
        resultText: `${fmt(t.totalBusbarW / 1000, 3)} kW (${fmt(t.totalBusbarW, 1)} W)`,
        formula: 'P_busbars = Σ(P_HBB_seg) + Σ(P_VBB_seg) + Σ(P_splice_joints) + Σ(P_takeoff_tails)',
        inputs: [
          {
            name: 'Main HBB Manual AC Factor (S)',
            helpKey: 'bb.manualS',
            val: `${bb.manualSFactor}`,
            note: `Active mode: ${hr.acFactorMode} (effective k_AC = ${fmt(hr.kAcUsed, 3)})`,
            edit: { type: 'number', value: bb.manualSFactor, min: 1.0, max: 2.5, step: 0.02, unit: '×', apply: (v) => { bb.acFactorMode = 'manual'; bb.manualSFactor = Math.max(1, Number(v) || 1.2); } },
          },
          {
            name: 'Main HBB Operating Temp',
            helpKey: 'bb.temp',
            val: `${bb.operatingTempC} °C`,
            note: `R_AC = ${fmt(hr.rAcT_uOhmPerM, 2)} µΩ/m`,
            edit: { type: 'number', value: bb.operatingTempC, min: 20, max: 125, step: 5, unit: '°C', apply: (v) => (bb.operatingTempC = Number(v) || 70) },
          },
          {
            name: 'Board Diversity Factor (RDF)',
            helpKey: 'cfg.rdf',
            val: `${cfg.diversityFactorRDF}`,
            note: 'Applied to local feeders summed onto HBB & VBB',
            edit: { type: 'number', value: cfg.diversityFactorRDF, min: 0.3, max: 1.0, step: 0.05, unit: 'pu', apply: (v) => (cfg.diversityFactorRDF = Math.min(1, Math.max(0.2, Number(v) || 1))) },
          },
          {
            name: 'Take-off Tail Length / Tier',
            helpKey: 'cfg.tail',
            val: `${cfg.takeoffTailLengthM} m`,
            note: 'Connection link from dropper to protective device',
            edit: { type: 'number', value: cfg.takeoffTailLengthM, min: 0, max: 2, step: 0.05, unit: 'm', apply: (v) => (cfg.takeoffTailLengthM = Math.max(0, Number(v) || 0)) },
          },
          {
            name: 'Bolted Joint Resistance',
            helpKey: 'cfg.joint',
            val: `${cfg.jointResistanceUOhm} µΩ`,
            note: 'Typical clean torqued Cu-Cu joint: 3–10 µΩ',
            edit: { type: 'number', value: cfg.jointResistanceUOhm, min: 0, max: 30, step: 1, unit: 'µΩ', apply: (v) => (cfg.jointResistanceUOhm = Math.max(0, Number(v) || 0)) },
          },
        ],
        steps: [
          {
            label: 'Step 1 — Main Horizontal Busbar (HBB) Conductor Loss',
            math: `Σ(3 · I_seg² · R_AC,HBB · L_seg) = ${fmt(t.totalHbbLossW, 1)} W (${fmt(t.totalHbbLenM, 2)} m total)`,
            note: `Peak HBB density = ${fmt(t.maxHbbWPerM, 1)} W/m at ${fmt(t.maxHbbCurrentA, 0)} A.`,
          },
          {
            label: 'Step 2 — Vertical Dropper Busbar (VBB) Conductor Loss',
            math: `Σ(3 · I_vseg² · R_AC,VBB · L_vseg) = ${fmt(t.totalVbbLossW, 1)} W (${fmt(t.totalVbbLenM, 2)} m total)`,
            note: `Peak VBB density = ${fmt(t.maxVbbWPerM, 1)} W/m.`,
          },
          {
            label: 'Step 3 — Splice Joints & Tier Take-off Tails/Risers',
            math: `P_joints_tails = ${fmt(hbbJointsW, 1)} W (HBB splices) + ${fmt(tierTakeoffsW, 1)} W (incomer riser + tails & taps) = ${fmt(t.totalTakeoffAndJointW, 1)} W`,
            note: 'Accounts for bolted busbar joints and compartment tap-off tails.',
          },
          {
            label: 'Step 4 — Total Busbar System Heat Output',
            math: `P_busbars = ${fmt(t.totalHbbLossW, 1)} + ${fmt(t.totalVbbLossW, 1)} + ${fmt(t.totalTakeoffAndJointW, 1)} = ${fmt(t.totalBusbarW, 1)} W`,
            note: '',
          },
        ],
        commentary: [
          'Busbar Joule losses scale with current squared (I²): halving the horizontal span length to a heavy interconnector or upgrading bar cross-section reduces busbar heat dramatically.',
        ],
      };
    }

    // 3. KPI: Devices & Starters
    if (key === 'kpi.devices') {
      const activeCount = evalRes.deviceRows.filter((r) => r.isActive).length;
      const fixedSum = evalRes.deviceRows.reduce((a, b) => a + b.fixedLossW, 0);
      const varSum = evalRes.deviceRows.reduce((a, b) => a + b.varLossW, 0);
      return {
        title: 'Protective Devices, HRC Fuses & Starters Heat Loss',
        badge: 'IEC TR 60890 Scaling',
        resultText: `${fmt(t.totalDevicesW / 1000, 3)} kW (${fmt(t.totalDevicesW, 1)} W across ${activeCount} active compartments)`,
        formula: 'P_devices = Σ [ P_fixed + P_n · (I_op / I_n)² ]',
        inputs: [
          {
            name: 'System Voltage (V_LL)',
            helpKey: 'cfg.v',
            val: `${cfg.voltageV} V`,
            note: 'Drives motor kW → Operating Current (I_op)',
            edit: { type: 'number', value: cfg.voltageV, min: 200, max: 1000, step: 5, unit: 'V', apply: (v) => (cfg.voltageV = Math.max(200, Number(v) || 400)) },
          },
          {
            name: 'Global Future Load Growth',
            helpKey: 'cfg.growth',
            val: `${cfg.globalFutureGrowthPct}%`,
            note: 'Applied in Normal+Future and Worst-Case scenarios',
            edit: { type: 'number', value: cfg.globalFutureGrowthPct, min: 0, max: 100, step: 5, unit: '%', apply: (v) => (cfg.globalFutureGrowthPct = Math.max(0, Number(v) || 0)) },
          },
          { name: 'Incomers & Bus Couplers', val: `${fmt(t.totalIncomerDevicesW, 1)} W`, note: 'Main Air Circuit Breakers (ACBs)' },
          { name: 'Motor Starters & VSDs', val: `${fmt(t.totalStarterDevicesW, 1)} W`, note: 'DOL, Star-Delta, Soft Starters, Variable Speed Drives' },
          { name: 'Outgoing Feeders & HRC Fuses', val: `${fmt(t.totalFeederDevicesW, 1)} W`, note: 'MCCBs, MCBs, Eaton NH gG HRC Fuse-Switches' },
          { name: 'Interconnector Switchgear Device', val: `${fmt(t.totalInterconnectorDeviceW, 1)} W`, note: 'Active during N-1 transfer' },
        ],
        steps: [
          {
            label: 'Step 1 — Fixed (Standby / Coil / Electronic) vs Load-Dependent Losses',
            math: `Σ P_fixed = ${fmt(fixedSum, 1)} W   |   Σ P_variable(I_op) = ${fmt(varSum, 1)} W`,
            note: 'Holding coils, electronic trip units, and VSD fans remain constant; main poles & HRC fuse links scale with (I_op/I_n)².',
          },
          {
            label: 'Step 2 — Sum Category Subtotals',
            math: `P_devices = ${fmt(t.totalIncomerDevicesW, 1)} + ${fmt(t.totalStarterDevicesW, 1)} + ${fmt(t.totalFeederDevicesW, 1)} + ${fmt(t.totalInterconnectorDeviceW, 1)} = ${fmt(t.totalDevicesW, 1)} W`,
            note: 'Click any individual device row in Tab 3 or on the SLD/GA to edit its exact rating and watts loss.',
          },
        ],
        commentary: [
          'Scaling rated datasheet losses by (I_op / I_n)² prevents massively overestimating breaker and HRC fuse heat when circuits operate at typical 50–80% load.',
        ],
      };
    }

    // 4. KPI: Incomer Load & Peak W/m
    if (key === 'kpi.incomer') {
      return {
        title: 'Total Incomer Current & Peak Busbar Heat Density',
        badge: 'Load Summation',
        resultText: `${Math.round(t.totalIncomerCurrentA)} A · Peak HBB ${fmt(t.maxHbbWPerM, 1)} W/m`,
        formula: 'I_incomer = (Σ I_local_active × RDF) + I_interconnector_transfer',
        inputs: [
          {
            name: 'Board Rated Diversity Factor (RDF)',
            helpKey: 'cfg.rdf',
            val: `${cfg.diversityFactorRDF}`,
            note: 'Applied to local loads summed onto busbars',
            edit: { type: 'number', value: cfg.diversityFactorRDF, min: 0.3, max: 1.0, step: 0.05, unit: 'pu', apply: (v) => (cfg.diversityFactorRDF = Math.min(1, Math.max(0.2, Number(v) || 1))) },
          },
          {
            name: 'Main HBB Rated Current (In)',
            helpKey: 'bb.rated',
            val: `${bb.ratedCurrentA} A`,
            note: `Peak utilization = ${fmt((t.maxHbbCurrentA / Math.max(1, bb.ratedCurrentA)) * 100, 1)}%`,
            edit: { type: 'number', value: bb.ratedCurrentA, min: 200, max: 6300, step: 100, unit: 'A', apply: (v) => (bb.ratedCurrentA = Math.max(100, Number(v) || 1600)) },
          },
          { name: 'Diversified Local Loads', val: `${fmt(t.totalLocalLoadA, 1)} A`, note: `RDF = ${(cfg.diversityFactorRDF * 100).toFixed(0)}%` },
          { name: 'Interconnector Transfer Load (A→B)', val: `${fmt(t.totalInterconnectorLoadA, 1)} A`, note: evalRes.isN1Transfer ? 'N-1 Transfer ACTIVE (100%)' : 'Normal operation' },
        ],
        steps: [
          {
            label: 'Step 1 — Sum Diversified Local Column Loads',
            math: `I_local,div = ${evalRes.columns.map((c) => `${fmt(c.colLocalDiversifiedA, 0)}A`).join(' + ')} = ${fmt(t.totalLocalLoadA, 1)} A`,
            note: 'Active local feeder currents multiplied by board RDF.',
          },
          {
            label: 'Step 2 — Add Interconnector Firm-Supply Transfer',
            math: `I_incomer = ${fmt(t.totalLocalLoadA, 1)} + ${fmt(t.totalInterconnectorLoadA, 1)} = ${fmt(t.totalIncomerCurrentA, 1)} A`,
            note: 'Split sections with an open Bus Coupler are solved independently.',
          },
          {
            label: 'Step 3 — Peak Horizontal Busbar W/m',
            math: `Max HBB W/m = 3 × (${fmt(t.maxHbbCurrentA, 1)} A)² × ${fmt(hr.rAcT_uOhmPerM, 2)} µΩ/m${cfg.poles === '3P+N' && cfg.neutralCurrentRatio > 0 ? ' + P_neutral' : ''} = ${fmt(t.maxHbbWPerM, 1)} W/m`,
            note: `Busbar rated dissipation at ${bb.ratedCurrentA} A is ${fmt(evalRes.hbbRatedWPerM, 1)} W/m.`,
          },
        ],
        commentary: [
          'If peak HBB current exceeds 100% of rated capacity under N-1 transfer, consider upgrading busbar cross-section or reducing N-1 transfer load.',
        ],
      };
    }

    // 5. KPI: HVAC Cooling & Enclosure Heat Flux
    if (key === 'kpi.hvac') {
      const W = evalRes.totalWidthMm / 1000;
      const H = evalRes.panelHeightMm / 1000;
      const D = (Number(cfg.panelDepthMm) || 800) / 1000;
      const isWall = cfg.installationType === 'wall_backed';
      return {
        title: 'Recommended HVAC Cooling & Enclosure Heat Flux',
        badge: 'IEC 60890 / HVAC',
        resultText: `${fmt(t.recommendedCoolingKW, 2)} kW cooling · ${fmt(t.heatFluxWPerM2, 0)} W/m² flux`,
        formula: 'Q_HVAC = P_total × (1 + Margin%)   |   q_flux = P_total / A_e',
        inputs: [
          { name: 'Total Switchgear Heat Output', val: `${fmt(t.grandTotalKW, 3)} kW (${fmt(t.grandTotalW, 1)} W)`, note: `Active scenario: ${evalRes.scenario}` },
          {
            name: 'HVAC Safety Margin',
            helpKey: 'cfg.hvac',
            val: `${cfg.hvacSafetyMarginPct}%`,
            note: 'Typical switchroom contingency: 15–25%',
            edit: { type: 'number', value: cfg.hvacSafetyMarginPct, min: 0, max: 50, step: 5, unit: '%', apply: (v) => (cfg.hvacSafetyMarginPct = Math.max(0, Number(v) || 0)) },
          },
          {
            name: 'Panel Height',
            helpKey: 'cfg.h',
            val: `${cfg.panelHeightMm} mm`,
            note: 'Drives Effective Cooling Area (Ae)',
            edit: { type: 'number', value: cfg.panelHeightMm, min: 1200, max: 2600, step: 50, unit: 'mm', apply: (v) => (cfg.panelHeightMm = Math.max(1200, Number(v) || 2200)) },
          },
          {
            name: 'Panel Depth',
            helpKey: 'cfg.d',
            val: `${cfg.panelDepthMm} mm`,
            note: 'Front-to-rear enclosure depth',
            edit: { type: 'number', value: cfg.panelDepthMm, min: 400, max: 1600, step: 50, unit: 'mm', apply: (v) => (cfg.panelDepthMm = Math.max(400, Number(v) || 800)) },
          },
          {
            name: 'Installation Type (IEC 60890)',
            helpKey: 'cfg.inst',
            val: isWall ? 'Wall-Backed' : 'Freestanding',
            note: 'Rear face blocked vs exposed',
            edit: {
              type: 'select',
              value: cfg.installationType || 'freestanding',
              options: [
                { value: 'freestanding', label: 'Freestanding (Front + Rear)' },
                { value: 'wall_backed', label: 'Wall-Backed (Rear Blocked)' },
              ],
              apply: (v) => (cfg.installationType = v),
            },
          },
        ],
        steps: [
          {
            label: 'Step 1 — Apply HVAC Safety Margin',
            math: `Q_HVAC = ${fmt(t.grandTotalKW, 3)} kW × (1 + ${cfg.hvacSafetyMarginPct}/100) = ${fmt(t.recommendedCoolingKW, 3)} kW`,
            note: `Equivalent to ${Math.round(t.recommendedCoolingKW * 3412.14).toLocaleString()} BTU/hr sensible cooling.`,
          },
          {
            label: 'Step 2 — Effective Cooling Surface Area A_e (IEC 60890 Table 1)',
            math: isWall
              ? `A_e = 0.9·(W·H) + 1.4·(W·D) + 1.8·(D·H) = 0.9·(${fmt(W * H, 2)}) + 1.4·(${fmt(W * D, 2)}) + 1.8·(${fmt(D * H, 2)}) = ${fmt(t.effectiveAreaM2, 2)} m²`
              : `A_e = 1.8·(W·H) + 1.4·(W·D) + 1.8·(D·H) = 1.8·(${fmt(W * H, 2)}) + 1.4·(${fmt(W * D, 2)}) + 1.8·(${fmt(D * H, 2)}) = ${fmt(t.effectiveAreaM2, 2)} m²`,
            note: 'Front/Rear/Sides weighted ×0.9; Top weighted ×1.4.',
          },
          {
            label: 'Step 3 — Average Surface Heat Flux',
            math: `q_flux = ${fmt(t.grandTotalW, 1)} W / ${fmt(t.effectiveAreaM2, 2)} m² = ${fmt(t.heatFluxWPerM2, 1)} W/m²`,
            note: 'Naturally cooled IP4X/IP54 boards typically handle ~150–250 W/m² for ΔT ≈ 20–30 K.',
          },
        ],
        commentary: [
          'Remember to add other switchroom heat sources (transformers, UPS, lighting, solar gain) when sizing total room HVAC plant.',
        ],
      };
    }

    // 6. Busbar Physics (Main or Column Vertical) — Fully Editable!
    if (key === 'busbar.physics') {
      const isMain = ctx.scope === 'main';
      const spec = isMain ? project.mainBusbar : (evalRes.columns[ctx.colIndex] ? evalRes.columns[ctx.colIndex].vbbSpec : project.defaultVerticalBusbar);
      const res = isMain ? evalRes.hbbRes : (evalRes.columns[ctx.colIndex] ? evalRes.columns[ctx.colIndex].vbbRes : evalRes.hbbRes);
      const ratedLoss = window.SGPhysics.calcBusbarLossPerMetre(res, spec.ratedCurrentA, cfg.poles, cfg.neutralCurrentRatio);
      const matOpts = Object.values(window.SGPhysics.MATERIALS).map((m) => ({ value: m.id, label: m.name }));

      return {
        title: `${isMain ? 'Main Horizontal' : 'Vertical Dropper'} Busbar — DC to AC Physics Breakdown`,
        badge: `${spec.barsPerPhase}×${spec.widthMm}×${spec.thicknessMm} mm (${res.areaMm2} mm²)`,
        resultText: `R_AC = ${fmt(res.rAcT_uOhmPerM, 2)} µΩ/m · ${fmt(ratedLoss.wPerMTotal, 1)} W/m @ ${spec.ratedCurrentA} A (3-Ph)`,
        formula: 'R_AC(T) = (ρ_20 / A) × [1 + α_20·(T_op − 20)] × k_AC   |   P/L = 3 · I² · R_AC(T)',
        inputs: [
          {
            name: 'Conductor Material',
            helpKey: 'bb.material',
            val: res.material.name,
            note: `ρ_20 = ${res.material.rho20} Ω·mm²/m, α_20 = ${res.material.alpha20} /K`,
            edit: { type: 'select', value: spec.material, options: matOpts, apply: (v) => (spec.material = v) },
          },
          {
            name: 'Parallel Bars per Phase (n)',
            helpKey: 'bb.bars',
            val: `${spec.barsPerPhase}`,
            note: `Area A = ${spec.barsPerPhase} × ${spec.widthMm} × ${spec.thicknessMm} = ${res.areaMm2} mm²`,
            edit: { type: 'number', value: spec.barsPerPhase, min: 1, max: 8, step: 1, unit: 'bars', apply: (v) => (spec.barsPerPhase = Math.max(1, parseInt(v, 10) || 1)) },
          },
          {
            name: 'Bar Width (w)',
            helpKey: 'bb.width',
            val: `${spec.widthMm} mm`,
            note: 'Wide face of each rectangular bar',
            edit: { type: 'number', value: spec.widthMm, min: 10, max: 200, step: 5, unit: 'mm', apply: (v) => (spec.widthMm = Math.max(10, Number(v) || 50)) },
          },
          {
            name: 'Bar Thickness (t)',
            helpKey: 'bb.thickness',
            val: `${spec.thicknessMm} mm`,
            note: 'Thickness of each bar lamination',
            edit: { type: 'number', value: spec.thicknessMm, min: 3, max: 20, step: 1, unit: 'mm', apply: (v) => (spec.thicknessMm = Math.max(3, Number(v) || 6)) },
          },
          {
            name: 'Operating Temperature (T_op)',
            helpKey: 'bb.temp',
            val: `${res.tempC} °C`,
            note: `Temp correction factor = ×${fmt(res.tempFactor, 4)}`,
            edit: { type: 'number', value: spec.operatingTempC, min: 20, max: 125, step: 5, unit: '°C', apply: (v) => (spec.operatingTempC = Number(v) || 70) },
          },
          {
            name: 'AC Conversion Method',
            helpKey: 'bb.acmode',
            val: res.acFactorMode,
            note: `Calc k_AC = ${fmt(res.kAcCalculated, 3)} vs Manual S = ${fmt(res.manualS, 2)}`,
            edit: {
              type: 'select',
              value: spec.acFactorMode || 'manual',
              options: [
                { value: 'manual', label: 'Manual Factor (S)' },
                { value: 'calculated', label: 'Calculated Skin/Proximity' },
              ],
              apply: (v) => (spec.acFactorMode = v),
            },
          },
          {
            name: spec.acFactorMode === 'calculated' ? 'Phase Spacing (D)' : 'Manual AC Factor (S)',
            helpKey: spec.acFactorMode === 'calculated' ? 'bb.spacing' : 'bb.manualS',
            val: spec.acFactorMode === 'calculated' ? `${spec.phaseSpacingMm} mm` : `${spec.manualSFactor}`,
            note: spec.acFactorMode === 'calculated' ? 'Centre-to-centre phase spacing' : 'Multiplier R_AC = S × R_DC(T)',
            edit: spec.acFactorMode === 'calculated'
              ? { type: 'number', value: spec.phaseSpacingMm || 120, min: 40, max: 400, step: 5, unit: 'mm', apply: (v) => (spec.phaseSpacingMm = Math.max(30, Number(v) || 120)) }
              : { type: 'number', value: spec.manualSFactor || 1.2, min: 1.0, max: 2.5, step: 0.02, unit: '×', apply: (v) => (spec.manualSFactor = Math.max(1, Number(v) || 1.2)) },
          },
          {
            name: 'Rated Current (In)',
            helpKey: 'bb.rated',
            val: `${spec.ratedCurrentA} A`,
            note: 'Reference current for rated W/m & % utilization',
            edit: { type: 'number', value: spec.ratedCurrentA, min: 100, max: 6300, step: 50, unit: 'A', apply: (v) => (spec.ratedCurrentA = Math.max(100, Number(v) || 1000)) },
          },
        ],
        steps: [
          {
            label: 'Step 1 — Conductor Cross-Sectional Area (per Phase)',
            math: `A = n × w × t = ${spec.barsPerPhase} × ${spec.widthMm} × ${spec.thicknessMm} = ${res.areaMm2} mm²`,
            note: `Certificate Ref: ${spec.certRef || 'Not specified'}`,
          },
          {
            label: 'Step 2 — Direct Current Resistance at 20 °C (R_DC,20)',
            math: `R_DC,20 = ρ_20 / A = ${res.material.rho20} / ${res.areaMm2} = ${fmt(res.rDc20_uOhmPerM, 3)} µΩ/m`,
            note: 'Baseline DC resistance per metre of one phase conductor at 20 °C.',
          },
          {
            label: `Step 3 — Temperature Correction to ${res.tempC} °C`,
            math: `R_DC(${res.tempC}°C) = ${fmt(res.rDc20_uOhmPerM, 3)} × [1 + ${res.material.alpha20} × (${res.tempC} − 20)] = ${fmt(res.rDc20_uOhmPerM, 3)} × ${fmt(res.tempFactor, 4)} = ${fmt(res.rDcT_uOhmPerM, 3)} µΩ/m`,
            note: 'Resistivity increases ~0.39% per °C in Copper.',
          },
          {
            label: `Step 4 — AC Skin Depth δ & Skin/Proximity Factor (${cfg.frequencyHz} Hz)`,
            math: `δ = √(ρ(T) / (π·f·μ₀)) = ${fmt(res.skinDepthMm, 2)} mm  →  Calc k_AC = 1 + y_s(${fmt(res.ys, 3)}) + y_p(${fmt(res.yp, 3)}) + y_e(${fmt(res.ye, 3)}) = ${fmt(res.kAcCalculated, 3)}`,
            note: res.acFactorMode === 'calculated'
              ? `Active Mode = CALCULATED → using k_AC = ${fmt(res.kAcUsed, 3)}.`
              : `Active Mode = MANUAL → using S = ${fmt(res.manualS, 2)} (calculated reference is ${fmt(res.kAcCalculated, 3)}).`,
          },
          {
            label: 'Step 5 — Alternating Current Resistance per Metre (R_AC)',
            math: `R_AC(${res.tempC}°C) = ${fmt(res.rDcT_uOhmPerM, 3)} µΩ/m × ${fmt(res.kAcUsed, 3)} = ${fmt(res.rAcT_uOhmPerM, 3)} µΩ/m`,
            note: 'Effective AC resistance used in Joule\'s Law P = I² · R_AC.',
          },
          {
            label: `Step 6 — Reference 3-Phase Heat Loss at Rated ${spec.ratedCurrentA} A`,
            math: `P/L = 3 × (${spec.ratedCurrentA})² × ${fmt(res.rAcT_uOhmPerM, 3)}×10⁻⁶ = ${fmt(ratedLoss.wPerMPhase * 3, 1)} W/m${ratedLoss.wPerMNeutral > 0 ? ` + ${fmt(ratedLoss.wPerMNeutral, 1)} W/m (Neutral) = ${fmt(ratedLoss.wPerMTotal, 1)} W/m` : ''}`,
            note: `Per phase: ${fmt(ratedLoss.wPerMPhase, 1)} W/m.`,
          },
        ],
        commentary: [
          'Edit any busbar dimension, temperature, or AC factor right above to see instant updates to R_AC, W/m, and total switchgear kW everywhere.',
          `At ${cfg.frequencyHz} Hz in Copper at ${res.tempC} °C, skin depth δ ≈ ${fmt(res.skinDepthMm, 1)} mm.`,
        ],
      };
    }

    // 7. Horizontal Busbar Segment — Editable!
    if (key === 'hbb.segment') {
      const seg = evalRes.hbbSegments[ctx.segIndex];
      if (!seg) return null;
      const fromCol = project.columns[seg.fromColIndex];
      const toCol = project.columns[seg.toColIndex];
      const jointUOhm = Number(cfg.jointResistanceUOhm != null ? cfg.jointResistanceUOhm : 5);
      return {
        title: `Horizontal Busbar Span: ${seg.fromColName} → ${seg.toColName}`,
        badge: `HBB Segment #${ctx.segIndex + 1}`,
        resultText: `${fmt(seg.totalSegW, 1)} W total (${fmt(seg.wPerMTotal, 1)} W/m × ${fmt(seg.lengthM, 2)} m + ${fmt(seg.jointLossW, 1)} W joint)`,
        formula: 'P_seg = [ 3 · I² · R_AC + P_neutral ] × L_seg + 3 · I² · R_joint',
        inputs: [
          {
            name: `${fromCol.name} Width`,
            helpKey: 'col.width',
            val: `${fromCol.widthMm} mm`,
            note: 'Contributes half-width to span length L_seg',
            edit: { type: 'number', value: fromCol.widthMm, min: 300, max: 2000, step: 50, unit: 'mm', apply: (v) => (fromCol.widthMm = Math.max(300, Number(v) || 800)) },
          },
          {
            name: `${toCol.name} Width`,
            helpKey: 'col.width',
            val: `${toCol.widthMm} mm`,
            note: 'Contributes half-width to span length L_seg',
            edit: { type: 'number', value: toCol.widthMm, min: 300, max: 2000, step: 50, unit: 'mm', apply: (v) => (toCol.widthMm = Math.max(300, Number(v) || 800)) },
          },
          {
            name: 'Main HBB Manual AC Factor (S)',
            helpKey: 'bb.manualS',
            val: `${bb.manualSFactor}`,
            note: `R_AC = ${fmt(hr.rAcT_uOhmPerM, 2)} µΩ/m`,
            edit: { type: 'number', value: bb.manualSFactor, min: 1.0, max: 2.5, step: 0.02, unit: '×', apply: (v) => { bb.acFactorMode = 'manual'; bb.manualSFactor = Math.max(1, Number(v) || 1.2); } },
          },
          {
            name: 'Board Diversity Factor (RDF)',
            helpKey: 'cfg.rdf',
            val: `${cfg.diversityFactorRDF}`,
            note: `Segment current I_seg = ${fmt(seg.currentA, 1)} A (${fmt(seg.utilizationPct, 1)}% of ${bb.ratedCurrentA} A)`,
            edit: { type: 'number', value: cfg.diversityFactorRDF, min: 0.3, max: 1.0, step: 0.05, unit: 'pu', apply: (v) => (cfg.diversityFactorRDF = Math.min(1, Math.max(0.2, Number(v) || 1))) },
          },
          {
            name: 'Splice Bolted Joint Resistance',
            helpKey: 'cfg.joint',
            val: `${jointUOhm} µΩ`,
            note: '1 bolted panel-to-panel busbar splice per boundary',
            edit: { type: 'number', value: jointUOhm, min: 0, max: 30, step: 1, unit: 'µΩ', apply: (v) => (cfg.jointResistanceUOhm = Math.max(0, Number(v) || 0)) },
          },
        ],
        steps: [
          {
            label: 'Step 1 — Span Length from General Arrangement Column Widths',
            math: `L_seg = (${fromCol.widthMm}/2 + ${toCol.widthMm}/2) / 1000 = (${Math.round(seg.x2Mm)} − ${Math.round(seg.x1Mm)}) / 1000 = ${fmt(seg.lengthM, 3)} m`,
            note: 'Measured centreline-to-centreline between adjacent cubicles.',
          },
          {
            label: 'Step 2 — Per-Phase & 3-Phase Heat Density (W/m)',
            math: `P_ph/m = (${fmt(seg.currentA, 1)})² × ${fmt(hr.rAcT_uOhmPerM, 2)}×10⁻⁶ = ${fmt(seg.wPerMPhase, 2)} W/m  →  3-Ph (+N) = ${fmt(seg.wPerMTotal, 2)} W/m`,
            note: `Direction: ${seg.direction === 'right' ? 'Left → Right' : 'Right → Left'}.`,
          },
          {
            label: 'Step 3 — Conductor Span Loss (W)',
            math: `P_cond = ${fmt(seg.wPerMTotal, 2)} W/m × ${fmt(seg.lengthM, 3)} m = ${fmt(seg.lossW, 2)} W`,
            note: '',
          },
          {
            label: 'Step 4 — Bolted Splice Joint Loss (W)',
            math: `P_joint = 3 × (${fmt(seg.currentA, 1)})² × ${jointUOhm}×10⁻⁶ = ${fmt(seg.jointLossW, 2)} W`,
            note: '',
          },
          {
            label: 'Step 5 — Total Span Heat Output',
            math: `P_seg,total = ${fmt(seg.lossW, 2)} + ${fmt(seg.jointLossW, 2)} = ${fmt(seg.totalSegW, 2)} W`,
            note: '',
          },
        ],
        commentary: [
          seg.utilizationPct > 100
            ? 'WARNING: This segment exceeds 100% of the main busbar rated current! Upgrade bar construction or limit N-1 transfer load.'
            : 'Changing either column width or busbar factor above immediately updates the GA drawing and total switchboard kW.',
        ],
      };
    }

    // 8. Vertical Dropper Busbar Segment — Editable!
    if (key === 'vbb.segment') {
      const seg = evalRes.vbbSegments[ctx.segIndex];
      if (!seg) return null;
      const colObj = project.columns[seg.colIndex];
      const cr = evalRes.columns[seg.colIndex];
      if (!colObj.verticalBusbar) colObj.verticalBusbar = JSON.parse(JSON.stringify(project.defaultVerticalBusbar));
      const vSpec = colObj.verticalBusbar;
      const vRes = cr.vbbRes;

      return {
        title: `Vertical Dropper Span: ${seg.colName} (${seg.fromLabel} → ${seg.toLabel})`,
        badge: `Take-off EL +${seg.takeoffElevationMm} mm`,
        resultText: `${fmt(seg.lossW, 2)} W (${fmt(seg.wPerMTotal, 1)} W/m × ${fmt(seg.lengthM, 2)} m)`,
        formula: 'P_vseg = [ 3 · I_vseg² · R_AC,VBB + P_neutral ] × Δy',
        inputs: [
          {
            name: 'VBB Parallel Bars / Phase',
            helpKey: 'bb.bars',
            val: `${vSpec.barsPerPhase}`,
            note: `Area = ${vRes.areaMm2} mm² · R_AC = ${fmt(vRes.rAcT_uOhmPerM, 2)} µΩ/m`,
            edit: { type: 'number', value: vSpec.barsPerPhase, min: 1, max: 4, step: 1, unit: 'bars', apply: (v) => (vSpec.barsPerPhase = Math.max(1, parseInt(v, 10) || 1)) },
          },
          {
            name: 'VBB Width',
            helpKey: 'bb.width',
            val: `${vSpec.widthMm} mm`,
            note: 'Vertical dropper width',
            edit: { type: 'number', value: vSpec.widthMm, min: 15, max: 150, step: 5, unit: 'mm', apply: (v) => (vSpec.widthMm = Math.max(15, Number(v) || 50)) },
          },
          {
            name: 'VBB Thickness',
            helpKey: 'bb.thickness',
            val: `${vSpec.thicknessMm} mm`,
            note: 'Vertical dropper thickness',
            edit: { type: 'number', value: vSpec.thicknessMm, min: 3, max: 15, step: 1, unit: 'mm', apply: (v) => (vSpec.thicknessMm = Math.max(3, Number(v) || 6)) },
          },
          {
            name: 'VBB Manual AC Factor (S)',
            helpKey: 'bb.manualS',
            val: `${vSpec.manualSFactor}`,
            note: `Active k_AC = ${fmt(vRes.kAcUsed, 3)}`,
            edit: { type: 'number', value: vSpec.manualSFactor || 1.15, min: 1.0, max: 2.0, step: 0.02, unit: '×', apply: (v) => { vSpec.acFactorMode = 'manual'; vSpec.manualSFactor = Math.max(1, Number(v) || 1.15); } },
          },
          {
            name: 'Board Diversity Factor (RDF)',
            helpKey: 'cfg.rdf',
            val: `${cfg.diversityFactorRDF}`,
            note: `Tapering span current = ${fmt(seg.currentA, 1)} A`,
            edit: { type: 'number', value: cfg.diversityFactorRDF, min: 0.3, max: 1.0, step: 0.05, unit: 'pu', apply: (v) => (cfg.diversityFactorRDF = Math.min(1, Math.max(0.2, Number(v) || 1))) },
          },
        ],
        steps: [
          {
            label: 'Step 1 — Vertical Span Length Δy from GA Take-off Elevations',
            math: `Δy = |${Math.round(seg.y2Mm)} − ${Math.round(seg.y1Mm)}| / 1000 = ${fmt(seg.lengthM, 3)} m`,
            note: `Tap-off elevation = FFL +${seg.takeoffElevationMm} mm.`,
          },
          {
            label: 'Step 2 — Tapering Dropper Current Summation',
            math: `I_vseg = Σ(diversified currents of "${seg.toLabel}" and all lower tiers) = ${fmt(seg.currentA, 1)} A`,
            note: `${fmt(seg.utilizationPct, 1)}% of ${vSpec.ratedCurrentA} A vertical busbar rating.`,
          },
          {
            label: 'Step 3 — 3-Phase Heat Density (W/m) & Span Loss (W)',
            math: `P/L = 3 × (${fmt(seg.currentA, 1)})² × ${fmt(vRes.rAcT_uOhmPerM, 2)}×10⁻⁶ = ${fmt(seg.wPerMTotal, 2)} W/m  →  × ${fmt(seg.lengthM, 3)} m = ${fmt(seg.lossW, 2)} W`,
            note: '',
          },
        ],
        commentary: [
          'Dragging high-current tiers closer to the horizontal busbar chamber shortens the high-current top segment of the vertical dropper.',
        ],
      };
    }

    // 9. Individual Tier / Device / HRC Fuse / Starter / Interconnector — Fully Editable!
    if (key === 'tier.loss') {
      const cr = evalRes.columns[ctx.colIndex];
      const tr = cr && cr.tiers[ctx.tierIndex];
      if (!tr) return null;
      const tier = tr.tier;
      const dl = tr.deviceLoss || { iOp: 0, iRated: tier.ratedCurrentA, loadRatio: 0, loadRatioSq: 0, pFixedW: 0, pVarW: 0, pTotalW: 0, breakdown: [] };
      const totalRowW = dl.pTotalW + (tr.takeoffLossW || 0) + (tr.cableLoss ? tr.cableLoss.totalW : 0);
      const isFutureOff = tier.status === 'future' && !tr.isActive;

      const inputs = [];
      if (tier.role === 'feeder') {
        if (tier.loadInputMode === 'kw') {
          inputs.push({
            name: 'Motor / Load Power (kW)',
            helpKey: 'tier.kw',
            val: `${tier.loadKw} kW`,
            note: 'Nameplate or absorbed kW',
            edit: { type: 'number', value: tier.loadKw, min: 0, max: 2000, step: 0.5, unit: 'kW', apply: (v) => (tier.loadKw = Math.max(0, Number(v) || 0)) },
          });
          inputs.push({
            name: 'Power Factor (PF, cos φ)',
            helpKey: 'tier.pf',
            val: `${tier.powerFactor}`,
            note: 'Typical: 0.85 motor / 0.95 VSD',
            edit: { type: 'number', value: tier.powerFactor, min: 0.2, max: 1.0, step: 0.01, unit: '', apply: (v) => (tier.powerFactor = Math.min(1, Math.max(0.1, Number(v) || 0.85))) },
          });
          inputs.push({
            name: 'Motor Efficiency (η)',
            helpKey: 'tier.eff',
            val: `${tier.efficiency}`,
            note: 'Typical: 0.90–0.95 IE3 motor',
            edit: { type: 'number', value: tier.efficiency, min: 0.2, max: 1.0, step: 0.01, unit: '', apply: (v) => (tier.efficiency = Math.min(1, Math.max(0.1, Number(v) || 0.93))) },
          });
        } else {
          inputs.push({
            name: 'Base Operating Current (I_op)',
            helpKey: 'tier.amps',
            val: `${tier.operatingCurrentA} A`,
            note: 'Running current before duty factor',
            edit: { type: 'number', value: tier.operatingCurrentA, min: 0, max: 5000, step: 5, unit: 'A', apply: (v) => (tier.operatingCurrentA = Math.max(0, Number(v) || 0)) },
          });
        }
        inputs.push({
          name: 'Duty / Load Factor',
          helpKey: 'tier.loadFactor',
          val: `${tier.loadFactor}`,
          note: `Effective I_op = ${fmt(tr.iOp, 1)} A`,
          edit: { type: 'number', value: tier.loadFactor, min: 0, max: 1.25, step: 0.05, unit: 'pu', apply: (v) => (tier.loadFactor = Math.max(0, Number(v))) },
        });
      } else if (tier.role === 'interconnector') {
        inputs.push({
          name: 'Normal Transfer Current',
          helpKey: 'tier.normTransfer',
          val: `${tier.normalTransferCurrentA || 0} A`,
          note: 'Used in Normal (N) scenario',
          edit: { type: 'number', value: tier.normalTransferCurrentA || 0, min: 0, max: 4000, step: 10, unit: 'A', apply: (v) => (tier.normalTransferCurrentA = Math.max(0, Number(v) || 0)) },
        });
        inputs.push({
          name: 'N-1 Firm Transfer Current',
          helpKey: 'tier.n1Transfer',
          val: `${tier.n1TransferCurrentA || 850} A`,
          note: `Used in N-1 / Worst-Case → ${tier.remoteBoardName || 'MSB-B'}`,
          edit: { type: 'number', value: tier.n1TransferCurrentA || 850, min: 0, max: 4000, step: 10, unit: 'A', apply: (v) => (tier.n1TransferCurrentA = Math.max(0, Number(v) || 0)) },
        });
      }

      if (tier.role !== 'spacer') {
        inputs.push({
          name: 'Device Rated Current (In)',
          helpKey: 'tier.in',
          val: `${tier.ratedCurrentA} A`,
          note: `${tier.category} nominal rating`,
          edit: {
            type: 'number',
            value: tier.ratedCurrentA,
            min: 1,
            max: 6300,
            step: 10,
            unit: 'A',
            apply: (v) => {
              const nv = Math.max(1, Number(v) || 100);
              tier.ratedCurrentA = nv;
              if (tier.subComponents) tier.subComponents.forEach((sc) => (sc.ratedCurrentA = nv));
            },
          },
        });

        if (tier.subComponents && tier.subComponents.length > 0) {
          tier.subComponents.forEach((sc) => {
            inputs.push({
              name: `Sub-Comp: ${sc.name}`,
              helpKey: 'tier.pn',
              val: `Pn=${sc.ratedLossW} W, Fix=${sc.fixedLossW || 0} W`,
              note: 'Edit rated 3P variable watts loss Pn',
              edit: {
                type: 'number',
                value: sc.ratedLossW,
                min: 0,
                max: 5000,
                step: 1,
                unit: 'W',
                apply: (v) => {
                  sc.ratedLossW = Math.max(0, Number(v) || 0);
                  tier.ratedLossW = tier.subComponents.reduce((a, b) => a + (Number(b.ratedLossW) || 0), 0);
                },
              },
            });
          });
        } else {
          inputs.push({
            name: 'Rated Variable Loss (Pn)',
            helpKey: 'tier.pn',
            val: `${tier.ratedLossW} W`,
            note: '3-Pole manufacturer loss at rated In',
            edit: { type: 'number', value: tier.ratedLossW, min: 0, max: 5000, step: 1, unit: 'W', apply: (v) => (tier.ratedLossW = Math.max(0, Number(v) || 0)) },
          });
          inputs.push({
            name: 'Fixed / Standby Loss',
            helpKey: 'tier.pfix',
            val: `${tier.fixedLossW || 0} W`,
            note: 'Coils, trip unit, control PSU, fans',
            edit: { type: 'number', value: tier.fixedLossW || 0, min: 0, max: 1000, step: 1, unit: 'W', apply: (v) => (tier.fixedLossW = Math.max(0, Number(v) || 0)) },
          });
        }
      }

      const steps = [];
      if (tier.role === 'spacer') {
        steps.push({
          label: 'Physical Reserve Bay',
          math: `Height = ${tier.heightMm} mm · Current = 0 A · Aux Loss = ${fmt(tier.fixedLossW || 0, 1)} W`,
          note: 'Reserves physical vertical height on the GA so lower compartments maintain exact dropper lengths.',
        });
      } else if (tier.role === 'incomer') {
        steps.push({
          label: 'Step 1 — Incomer Operating Current',
          math: `I_op = ${fmt(tr.iOp, 1)} A (auto-summed from section loads)`,
          note: `Breaker position: ${tier.incomerState === 'open' ? 'OPEN (0 A)' : 'CLOSED'}.`,
        });
      } else if (tier.role === 'bus_coupler') {
        steps.push({
          label: 'Step 1 — Bus-Section Coupler Through-Current',
          math: `I_op = ${fmt(tr.iOp, 1)} A`,
          note: `Coupler state: ${tier.couplerState === 'closed' ? 'CLOSED' : 'OPEN (0 A)'}.`,
        });
      } else if (tier.role === 'interconnector') {
        steps.push({
          label: 'Step 1 — Interconnector Transfer Current',
          math: `I_op = ${fmt(tr.iOp, 1)} A`,
          note: evalRes.isN1Transfer
            ? `N-1 Firm Transfer active → supplying ${tier.remoteBoardName || 'MSB-B'} at ${tier.n1TransferCurrentA} A.`
            : `Normal operation → transfer set to ${tier.normalTransferCurrentA || 0} A.`,
        });
      } else if (tier.loadInputMode === 'kw') {
        const is1or2P = tier.phases === '1P' || tier.phases === '2P';
        const vPh = cfg.voltageV / Math.sqrt(3);
        const rawA = is1or2P
          ? (tier.loadKw * 1000) / (vPh * tier.powerFactor * tier.efficiency)
          : (tier.loadKw * 1000) / (Math.sqrt(3) * cfg.voltageV * tier.powerFactor * tier.efficiency);
        const growthMul = evalRes.includeFuture && tier.status === 'active' && cfg.globalFutureGrowthPct > 0 ? 1 + cfg.globalFutureGrowthPct / 100 : 1;
        const phLabel = tier.phases === '1P' ? `1-Phase (${Math.round(vPh)}V · 1 fuse/pole)` : tier.phases === '2P' ? `Double Pole 2P (${Math.round(vPh)}V · 2 fuses/poles)` : `3-Phase (${cfg.voltageV}V · 3 fuses/poles)`;
        steps.push({
          label: `Step 1 — Operating Current I_op from Load Power (${phLabel})`,
          math: is1or2P
            ? `I_flc(${tier.phases}) = (${tier.loadKw} × 1000) / (${fmt(vPh, 1)}V × ${tier.powerFactor} × ${tier.efficiency}) = ${fmt(rawA, 1)} A → × Duty(${tier.loadFactor})${growthMul > 1 ? ` × Future(${fmt(growthMul, 2)})` : ''} = ${fmt(tr.iOp, 1)} A`
            : `I_flc(3P) = (${tier.loadKw} × 1000) / (√3 × ${cfg.voltageV}V × ${tier.powerFactor} × ${tier.efficiency}) = ${fmt(rawA, 1)} A → × Duty(${tier.loadFactor})${growthMul > 1 ? ` × Future(${fmt(growthMul, 2)})` : ''} = ${fmt(tr.iOp, 1)} A`,
          note: isFutureOff
            ? 'Tier is marked FUTURE and off in this scenario → 0 A.'
            : `${fmt(dl.loadRatio * 100, 1)}% of ${tier.ratedCurrentA} A rated device${tier.frameSize ? ' (' + tier.frameSize + ')' : ''}.${is1or2P ? ` Contributes ${fmt(tr.iOp / 3, 1)} A/ph equivalent to 3P busbars & incomer.` : ''}`,
        });
      } else {
        const is1or2P = tier.phases === '1P' || tier.phases === '2P';
        const growthMul = evalRes.includeFuture && tier.status === 'active' && cfg.globalFutureGrowthPct > 0 ? 1 + cfg.globalFutureGrowthPct / 100 : 1;
        steps.push({
          label: `Step 1 — Operating Current I_op (Direct Amperes, ${tier.phases || '3P'})`,
          math: `I_op = ${tier.operatingCurrentA} A × Duty(${tier.loadFactor})${growthMul > 1 ? ` × Future(${fmt(growthMul, 2)})` : ''} = ${fmt(tr.iOp, 1)} A`,
          note: isFutureOff
            ? 'Tier is marked FUTURE and off in this scenario → 0 A.'
            : `${fmt(dl.loadRatio * 100, 1)}% of ${tier.ratedCurrentA} A rated device${tier.frameSize ? ' (' + tier.frameSize + ')' : ''}.${is1or2P ? ` Contributes ${fmt(tr.iOp / 3, 1)} A/ph equivalent to 3P busbars & incomer.` : ''}`,
        });
      }

      const isVsdCurve =
        tier.lossModel === 'vsd_efficiency' ||
        (Array.isArray(tier.subComponents) && tier.subComponents.some((sc) => sc.lossModel === 'vsd_efficiency'));

      if (tier.role !== 'spacer') {
        if (isVsdCurve) {
          const vsdFactor = dl.iOp > 0 || tr.isActive ? 0.25 + 0.75 * dl.loadRatio : 0;
          steps.push({
            label: 'Step 2 — Semiconductor / IGBT Power Stage Load Scaling (IEC 61800-9-2)',
            math: `k_VSD = 0.25 + 0.75 × (I_op / I_n) = 0.25 + 0.75 × (${fmt(tr.iOp, 1)} / ${tier.ratedCurrentA}) = ${fmt(vsdFactor, 4)}   |   Input Breaker (I_op / I_n)² = ${fmt(dl.loadRatioSq, 4)}`,
            note: 'IGBT switching & rectifier conduction losses retain a ~25% switching floor when energized rather than dropping purely quadratically.',
          });
        } else {
          steps.push({
            label: 'Step 2 — Quadratic Load & Pole/Fuse Scaling Factor (IEC TR 60890)',
            math: `(I_op / I_n)² = (${fmt(tr.iOp, 1)} / ${tier.ratedCurrentA})² = ${fmt(dl.loadRatioSq, 4)}${dl.poleScale && Math.abs(dl.poleScale - 1) > 0.01 ? `  ×  Pole/Fuse Count (${dl.activePoles}/${dl.nativePoles} = ${fmt(dl.poleScale, 3)})` : ''}`,
            note: 'Resistive losses in breaker poles, HRC fuse links, contactors, and overloads scale quadratically with current and linearly with active poles/fuses (1P = 1 fuse, 2P = 2 fuses, 3P = 3 fuses).',
          });
        }

        if (dl.breakdown && dl.breakdown.length > 0) {
          const subLines = dl.breakdown
            .map((b) => `${b.name}: ${fmt(b.opLossW, 1)} W (fix ${b.fixedLossW}W + var ${fmt(b.opLossW - b.fixedLossW, 1)}W from Pn=${b.ratedLossW}W)`)
            .join(' | ');
          steps.push({
            label: 'Step 3 — Device & Sub-Component Losses',
            math: `P_device = ${fmt(dl.pFixedW, 1)} W (fixed) + ${fmt(dl.pVarW, 1)} W (variable) = ${fmt(dl.pTotalW, 1)} W`,
            note: subLines,
          });
        }

        steps.push({
          label: 'Step 4 — Take-off Tail, Bolted Joint & Cable Loss',
          math: `P_takeoff = ${fmt(tr.takeoffLossW || 0, 2)} W${tr.cableLoss && tr.cableLoss.totalW > 0 ? `  |  P_cable = ${fmt(tr.cableLoss.wPerM, 1)} W/m × ${tr.cableLoss.lengthM} m = ${fmt(tr.cableLoss.totalW, 1)} W` : ''}`,
          note: `Elevation EL +${Math.round(evalRes.panelHeightMm - tr.yCenterMm)} mm · Tail ${cfg.takeoffTailLengthM} m · Joint ${cfg.jointResistanceUOhm} µΩ.`,
        });

        steps.push({
          label: 'Step 5 — Total Compartment Heat Output',
          math: `P_compartment = ${fmt(dl.pTotalW, 1)} + ${fmt(tr.takeoffLossW || 0, 1)}${tr.cableLoss && tr.cableLoss.totalW > 0 ? ` + ${fmt(tr.cableLoss.totalW, 1)}` : ''} = ${fmt(totalRowW, 1)} W`,
          note: '',
        });
      }

      const commentary = [
        `At full rated current (${tier.ratedCurrentA} A), this assembly dissipates ~${fmt((tier.ratedLossW || 0) + (tier.fixedLossW || 0), 1)} W; at ${fmt(tr.iOp, 1)} A operating current it dissipates ${fmt(dl.pTotalW, 1)} W.`,
        'You can edit any load or rated watts loss value above and immediately watch both this worked breakdown and the whole switchboard update.',
      ];

      return {
        title: `${tier.tag} — ${tier.description}`,
        badge: `${tier.category} · ${cr.col.name}`,
        resultText: `${fmt(totalRowW, 1)} W (${fmt(tr.iOp, 1)} A operating vs ${tier.ratedCurrentA} A rated)`,
        formula: isVsdCurve
          ? 'P_comp = P_fixed + P_IGBT · (0.25 + 0.75 · I_op/I_n) + P_MCCB · (I_op/I_n)² + P_takeoff_joint'
          : 'P_comp = [ P_fixed + Σ P_var,n · (I_op / I_n)² ] + P_takeoff_joint + P_cable',
        inputs,
        steps,
        commentary,
      };
    }

    // 10. Column Summary — Editable!
    if (key === 'column.total') {
      const colObj = project.columns[ctx.colIndex];
      const cr = evalRes.columns[ctx.colIndex];
      if (!cr || !colObj) return null;
      return {
        title: `${cr.col.name} — Column Thermal Summary`,
        badge: `Width ${cr.widthMm} mm · X = ${Math.round(cr.xCenterMm)} mm`,
        resultText: `${fmt(cr.colTotalLossW, 1)} W total (${fmt(cr.colTotalLoadA, 1)} A net load)`,
        formula: 'P_col = P_devices + P_VBB + P_takeoffs + P_cable',
        inputs: [
          {
            name: 'Cubicle Width',
            helpKey: 'col.width',
            val: `${colObj.widthMm} mm`,
            note: 'Drives adjacent horizontal busbar lengths',
            edit: { type: 'number', value: colObj.widthMm, min: 300, max: 2000, step: 50, unit: 'mm', apply: (v) => (colObj.widthMm = Math.max(300, Number(v) || 800)) },
          },
          {
            name: 'Board Diversity Factor (RDF)',
            helpKey: 'cfg.rdf',
            val: `${cfg.diversityFactorRDF}`,
            note: 'Applied to local circuits summed on this column',
            edit: { type: 'number', value: cfg.diversityFactorRDF, min: 0.3, max: 1.0, step: 0.05, unit: 'pu', apply: (v) => (cfg.diversityFactorRDF = Math.min(1, Math.max(0.2, Number(v) || 1))) },
          },
          { name: 'Column Devices & Starters', val: `${fmt(cr.colDevicesW, 1)} W`, note: `${cr.tiers.length} compartments` },
          { name: 'Vertical Dropper Busbar (VBB)', val: `${fmt(cr.vbbTotalLossW, 1)} W`, note: `${fmt(cr.vbbTotalLengthM, 2)} m run, peak ${fmt(cr.vbbMaxWPerM, 1)} W/m` },
          { name: 'Take-off Tails & Joints', val: `${fmt(cr.colTakeoffW, 1)} W`, note: 'Internal tap-off links & bolted joints' },
        ],
        steps: [
          {
            label: 'Step 1 — Column Net Diversified Current',
            math: `I_col = (${fmt(cr.colLocalRawA, 1)} A × RDF ${cfg.diversityFactorRDF}) + ${fmt(cr.colInterconnectorA, 1)} A (IC) = ${fmt(cr.colTotalLoadA, 1)} A`,
            note: cr.hasIncomer ? `Incomer supplies ${fmt(cr.incomerSupplyA, 1)} A to Main Horizontal Busbar.` : 'Drawn from Main Horizontal Busbar.',
          },
          {
            label: 'Step 2 — Sum All Column Heat Sources',
            math: `P_col = ${fmt(cr.colDevicesW, 1)} + ${fmt(cr.vbbTotalLossW, 1)} + ${fmt(cr.colTakeoffW, 1)} + ${fmt(cr.colCableW, 1)} = ${fmt(cr.colTotalLossW, 1)} W`,
            note: 'Main HBB losses passing through the top/bottom chamber are listed separately in the HBB schedule.',
          },
        ],
        commentary: [
          'Reviewing heat per column highlights hot cubicles (such as VSDs or 1250 A HRC fuse-switches) that may need forced roof fans or extra louvers.',
        ],
      };
    }

    // 11. Switchroom Cooling, Airflow, ACH & Natural vs Mechanical Ventilation — Fully Editable!
    if (key === 'room.ventilation') {
      window.SGState.ensureExtras(project);
      const rm = project.room;
      const baseSwgKW = ctx.switchgearKW != null ? ctx.switchgearKW : t.grandTotalKW;
      const rv = window.SGPhysics.calcRoomVentilation(rm, baseSwgKW, cfg.hvacSafetyMarginPct);
      return {
        title: 'Switchroom Cooling, Airflow, Air Change Rate (ACH) & Ventilation Verdict',
        badge: rv.verdictTitle,
        resultText: `${fmt(rv.reqFlowLs, 0)} L/s (${fmt(rv.reqFlowM3h, 0)} m³/h · ${fmt(rv.ach, 1)} ACH) — ${rv.verdictCode === 'natural' ? 'Natural OK' : rv.verdictCode === 'mechanical' ? 'Mechanical Required' : 'Active AC Required'}`,
        formula: 'V̇_req = Q_design / (ρ · c_p · ΔT)   |   ACH = (V̇_req × 3600) / V_room   |   V̇_nat = C_d · A_eff · √(2g · H_stack · ΔT / T_amb,K)',
        inputs: [
          {
            name: 'Room Length (L)',
            helpKey: 'room.dims',
            val: `${rv.L} m`,
            note: `Volume = ${fmt(rv.volumeM3, 1)} m³ · Floor = ${fmt(rv.floorAreaM2, 1)} m²`,
            edit: { type: 'number', value: rm.lengthM, min: 1, max: 100, step: 0.5, unit: 'm', apply: (v) => (rm.lengthM = Math.max(1, Number(v) || 5)) },
          },
          {
            name: 'Room Width (W)',
            helpKey: 'room.dims',
            val: `${rv.W} m`,
            note: 'Internal room width',
            edit: { type: 'number', value: rm.widthM, min: 1, max: 100, step: 0.5, unit: 'm', apply: (v) => (rm.widthM = Math.max(1, Number(v) || 5)) },
          },
          {
            name: 'Room Height (H)',
            helpKey: 'room.dims',
            val: `${rv.H} m`,
            note: 'Floor-to-ceiling internal height',
            edit: { type: 'number', value: rm.heightM, min: 2, max: 30, step: 0.5, unit: 'm', apply: (v) => (rm.heightM = Math.max(2, Number(v) || 9)) },
          },
          {
            name: 'Outdoor / Supply Temp (T_amb)',
            helpKey: 'room.tamb',
            val: `${rv.tAmb} °C`,
            note: `Allowable rise ΔT = ${fmt(rv.deltaT, 1)} K`,
            edit: { type: 'number', value: rm.ambientTempC, min: -10, max: 55, step: 1, unit: '°C', apply: (v) => (rm.ambientTempC = Number(v)) },
          },
          {
            name: 'Max Permitted Room Temp (T_max)',
            helpKey: 'room.tmax',
            val: `${rv.tMax} °C`,
            note: 'IEC 61439-1 standard: 35 °C avg / 40 °C max',
            edit: { type: 'number', value: rm.maxRoomTempC, min: 15, max: 60, step: 1, unit: '°C', apply: (v) => (rm.maxRoomTempC = Number(v) || 35) },
          },
          {
            name: 'Other Room Heat Gains',
            helpKey: 'room.other',
            val: `${fmt(rv.otherHeatKW, 2)} kW`,
            note: `Design Total Q = ${fmt(rv.baseSwgKW, 3)}×(1+${rv.marginPct}%) + ${fmt(rv.otherHeatKW, 2)} = ${fmt(rv.designHeatKW, 3)} kW`,
            edit: { type: 'number', value: rm.otherRoomHeatKW, min: 0, max: 500, step: 0.25, unit: 'kW', apply: (v) => (rm.otherRoomHeatKW = Math.max(0, Number(v) || 0)) },
          },
          {
            name: 'Natural Louver Free Area (Each)',
            helpKey: 'room.louver',
            val: `${fmt(rv.louverAreaM2, 2)} m²`,
            note: `Inlet & Exhaust each (${fmt(rv.louverAreaM2 / Math.SQRT2, 2)} m² effective)`,
            edit: { type: 'number', value: rm.louverFreeAreaM2, min: 0.05, max: 20, step: 0.1, unit: 'm²', apply: (v) => (rm.louverFreeAreaM2 = Math.max(0.05, Number(v) || 0.5)) },
          },
          {
            name: 'Vertical Stack Height (H_stack)',
            helpKey: 'room.stack',
            val: `${fmt(rv.stackHeightM, 1)} m`,
            note: 'Height between low inlet & high exhaust centrelines',
            edit: { type: 'number', value: rm.stackHeightM, min: 0.5, max: 25, step: 0.5, unit: 'm', apply: (v) => (rm.stackHeightM = Math.max(0.5, Number(v) || 4)) },
          },
        ],
        steps: [
          {
            label: 'Step 1 — Switchroom Volume & Total Design Heat Rejection',
            math: `V = ${rv.L} × ${rv.W} × ${rv.H} = ${fmt(rv.volumeM3, 1)} m³   |   Q_design = ${fmt(rv.baseSwgKW, 3)} × (1 + ${rv.marginPct}%) + ${fmt(rv.otherHeatKW, 2)} = ${fmt(rv.designHeatKW, 3)} kW (${Math.round(rv.designBtuHr).toLocaleString()} BTU/hr)`,
            note: `Floor density = ${fmt(rv.heatDensityFloorWm2, 1)} W/m² · Volumetric density = ${fmt(rv.heatDensityVolWm3, 1)} W/m³.`,
          },
          {
            label: 'Step 2 — Temperature Rise ΔT & Moist-Air Properties',
            math: `ΔT = T_max − T_amb = ${rv.tMax} − ${rv.tAmb} = ${fmt(rv.deltaT, 1)} K   |   ρ = ${fmt(rv.rhoAir, 3)} kg/m³ · c_p = ${rv.cpAir} kJ/(kg·K) → ρ·c_p = ${fmt(rv.rhoCp, 3)} kJ/(m³·K)`,
            note: 'Air density corrected for mean switchroom operating temperature.',
          },
          {
            label: 'Step 3 — Required Cooling Airflow Rate (Sensible Heat Balance)',
            math: rv.deltaT > 0.5
              ? `V̇_req = ${fmt(rv.designHeatKW, 3)} / (${fmt(rv.rhoCp, 3)} × ${fmt(rv.deltaT, 1)}) = ${fmt(rv.reqFlowM3s, 3)} m³/s = ${fmt(rv.reqFlowLs, 0)} L/s = ${fmt(rv.reqFlowM3h, 0)} m³/h (${fmt(rv.reqFlowCfm, 0)} CFM)`
              : 'ΔT ≤ 0.5 K — Outside-air ventilation cannot cool the room; Active Refrigeration / Air Conditioning required.',
            note: 'Airflow required to hold room exhaust temperature at or below T_max.',
          },
          {
            label: 'Step 4 — Required Air Change Rate per Hour (ACH)',
            math: `ACH = V̇_req (m³/h) / V_room (m³) = ${fmt(rv.reqFlowM3h, 0)} / ${fmt(rv.volumeM3, 1)} = ${fmt(rv.ach, 2)} ACH`,
            note: 'Natural ventilation is generally practical up to ~6 ACH; mechanical fans up to ~15–20 ACH.',
          },
          {
            label: 'Step 5 — Natural Stack-Effect Buoyancy Check (CIBSE Guide A / AM10)',
            math: `V̇_nat = ${rv.cd} × (${fmt(rv.louverAreaM2, 2)}/√2) × √(2 × 9.81 × ${fmt(rv.stackHeightM, 1)} × ${fmt(Math.max(0, rv.deltaT), 1)} / (${rv.tAmb}+273.15)) = ${fmt(rv.natFlowM3s, 3)} m³/s (${fmt(rv.natFlowM3h, 0)} m³/h · ${fmt(rv.natCapacityKW, 2)} kW capacity)`,
            note: `Required louver free area for natural alone ≈ ${rv.reqLouverAreaM2 < 100 ? fmt(rv.reqLouverAreaM2, 2) + ' m² each' : 'Impractical'}. Estimated steady room temp with current louvers only ≈ ${fmt(rv.estNatRoomTempC, 1)} °C.`,
          },
        ],
        commentary: [
          rv.verdictDetail,
          'Remember to size louvers for ~50% aerodynamic free area (e.g., 0.50 m² free area requires ~1.0 m² gross weather-louver opening) and check fire-damper / vermin-mesh pressure drops.',
        ],
      };
    }

    return null;
  }

  function toPlainText(exp) {
    const lines = [];
    lines.push(`=== ${exp.title} [${exp.badge}] ===`);
    lines.push(`Result: ${exp.resultText}`);
    lines.push(`Formula: ${exp.formula}`);
    lines.push('');
    lines.push('Inputs:');
    exp.inputs.forEach((i) => lines.push(`  - ${i.name}: ${i.val}${i.note ? ' (' + i.note + ')' : ''}`));
    lines.push('');
    lines.push('Worked Steps:');
    exp.steps.forEach((s) => {
      lines.push(`  ${s.label}`);
      lines.push(`    ${s.math}`);
      if (s.note) lines.push(`    Note: ${s.note}`);
    });
    lines.push('');
    lines.push('Engineering Commentary:');
    exp.commentary.forEach((c) => lines.push(`  * ${c}`));
    return lines.join('\n');
  }

  let activeModalState = null;

  function renderModalContent() {
    if (!activeModalState) return;
    const { key, ctx, project, onMutate } = activeModalState;
    const evalRes = activeModalState.evalRes;
    const exp = buildExplanation(key, ctx || {}, project, evalRes);
    if (!exp) return;

    const overlay = document.getElementById('explain-modal-overlay');
    if (!overlay) return;

    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(exp.title)}">
        <div class="modal-header">
          <div>
            <span class="pill-badge">${esc(exp.badge)}</span>
            <h2 class="modal-title">${esc(exp.title)}</h2>
          </div>
          <div class="modal-header-actions">
            <button id="explain-copy-btn" class="btn btn-sm btn-secondary">Copy Worked Calc</button>
            <button id="explain-close-btn" class="btn btn-sm btn-secondary">✕ Close</button>
          </div>
        </div>

        <div class="modal-result-banner">
          <div>
            <div class="m-lbl">Calculated Result (Live)</div>
            <div class="m-val">${esc(exp.resultText)}</div>
          </div>
          <div class="m-formula">
            <div class="m-lbl">Governing Equation</div>
            <code>${esc(exp.formula)}</code>
          </div>
        </div>

        <div class="modal-body">
          <div class="explain-block">
            <h4>1. Input Values Used <span style="font-weight:400;text-transform:none;color:var(--text-2);">— Edit any highlighted input directly to recalculate &amp; sync everywhere</span></h4>
            <table class="data-table">
              <thead><tr><th>Parameter</th><th>Value (Editable)</th><th>Basis / Reference</th></tr></thead>
              <tbody>
                ${exp.inputs
                  .map((inp, idx) => {
                    const nameHtml = inp.helpKey
                      ? `<span class="help-label" data-help="${esc(inp.helpKey)}"><strong>${esc(inp.name)}</strong></span>`
                      : `<strong>${esc(inp.name)}</strong>`;
                    let valHtml = `<span style="font-family:var(--font-mono);color:var(--accent);">${esc(inp.val)}</span>`;
                    if (inp.edit) {
                      if (inp.edit.type === 'select') {
                        valHtml = `<select class="explain-inline-input" data-exp-edit="${idx}">
                          ${inp.edit.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(inp.edit.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
                        </select>`;
                      } else {
                        valHtml = `<span class="explain-edit-wrap">
                          <input type="number" class="explain-inline-input" data-exp-edit="${idx}" value="${inp.edit.value}"
                            ${inp.edit.min != null ? `min="${inp.edit.min}"` : ''}
                            ${inp.edit.max != null ? `max="${inp.edit.max}"` : ''}
                            ${inp.edit.step != null ? `step="${inp.edit.step}"` : ''} />
                          ${inp.edit.unit ? `<span class="explain-unit">${esc(inp.edit.unit)}</span>` : ''}
                        </span>`;
                      }
                    }
                    return `<tr>
                      <td>${nameHtml}</td>
                      <td>${valHtml}</td>
                      <td style="color:var(--text-2);">${esc(inp.note || '')}</td>
                    </tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>

          <div class="explain-block">
            <h4>2. Step-by-Step Worked Calculation</h4>
            <div class="steps-list">
              ${exp.steps
                .map(
                  (st) => `
                <div class="step-item">
                  <div class="step-label">${esc(st.label)}</div>
                  <div class="step-math">${esc(st.math)}</div>
                  ${st.note ? `<div class="step-note">${esc(st.note)}</div>` : ''}
                </div>`
                )
                .join('')}
            </div>
          </div>

          <div class="explain-block">
            <h4>3. Engineering Commentary</h4>
            <ul class="commentary-list">
              ${exp.commentary.map((c) => `<li>${esc(c)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;

    // Wire live inline editing with two-way sync!
    overlay.querySelectorAll('[data-exp-edit]').forEach((inputEl) => {
      inputEl.addEventListener('change', () => {
        const idx = Number(inputEl.dataset.expEdit);
        const inp = exp.inputs[idx];
        if (!inp || !inp.edit || !inp.edit.apply) return;
        if (typeof onMutate === 'function') {
          const updatedEval = onMutate(() => inp.edit.apply(inputEl.value));
          if (updatedEval) activeModalState.evalRes = updatedEval;
        } else {
          inp.edit.apply(inputEl.value);
        }
        renderModalContent();
      });
    });

    document.getElementById('explain-close-btn').addEventListener('click', closeModal);
    document.getElementById('explain-copy-btn').addEventListener('click', () => {
      const btn = document.getElementById('explain-copy-btn');
      const txt = toPlainText(exp);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
          btn.textContent = '✓ Copied!';
          setTimeout(() => (btn.textContent = 'Copy Worked Calc'), 1800);
        });
      }
    });
  }

  function openModal(key, ctx, project, evalRes, onMutate) {
    let overlay = document.getElementById('explain-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'explain-modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
      });
    }

    activeModalState = { key, ctx: ctx || {}, project, evalRes, onMutate };
    renderModalContent();
    overlay.classList.add('open');
  }

  function closeModal() {
    const overlay = document.getElementById('explain-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    activeModalState = null;
  }

  return {
    openModal,
    closeModal,
    buildExplanation,
  };
})();
