/**
 * Universal Step-by-Step Calculation Analyser & Engineering Commentary Engine
 * Allows clicking ANY calculated number in the app to inspect its exact formula,
 * substituted inputs, intermediate worked steps, and IEC engineering commentary.
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

  /**
   * Build structured explanation object for any supported metric key + context.
   */
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
          { name: 'Main Horizontal Busbar (HBB)', val: `${fmt(t.totalHbbLossW, 1)} W`, note: `Sum of ${evalRes.hbbSegments.length} column-to-column spans (${fmt(t.totalHbbLenM, 2)} m)` },
          { name: 'Vertical Dropper Busbars (VBB)', val: `${fmt(t.totalVbbLossW, 1)} W`, note: `Sum of ${evalRes.vbbSegments.length} vertical tier spans (${fmt(t.totalVbbLenM, 2)} m)` },
          { name: 'Take-off Tails, Risers & Bolted Joints', val: `${fmt(t.totalTakeoffAndJointW, 1)} W`, note: `${cfg.takeoffTailLengthM} m tail/tier + ${cfg.jointResistanceUOhm} µΩ/bolted joint` },
          { name: 'Incomers & Bus Couplers', val: `${fmt(t.totalIncomerDevicesW, 1)} W`, note: 'Active ACB/coupler pole + electronic trip losses' },
          { name: 'Motor Starters & VSDs', val: `${fmt(t.totalStarterDevicesW, 1)} W`, note: 'DOL, Star-Delta, Soft Starters, VSDs' },
          { name: 'Outgoing Protective Feeders', val: `${fmt(t.totalFeederDevicesW, 1)} W`, note: 'MCCBs, MCBs, Fuse-Switches' },
          { name: 'Interconnector Device + Internal Cable', val: `${fmt(t.totalInterconnectorDeviceW + t.totalInterconnectorCableW, 1)} W`, note: `Device ${fmt(t.totalInterconnectorDeviceW, 1)} W + Cable ${fmt(t.totalInterconnectorCableW, 1)} W` },
          { name: 'Panel Auxiliaries', val: `${fmt(t.totalAuxW, 1)} W`, note: 'Metering, control PSUs, relays, panel lighting' },
        ],
        steps: [
          {
            label: 'Step 1 — Sum Total Busbar System Losses',
            math: `P_busbars = ${fmt(t.totalHbbLossW, 1)} + ${fmt(t.totalVbbLossW, 1)} + ${fmt(t.totalTakeoffAndJointW, 1)} = ${fmt(t.totalBusbarW, 1)} W`,
            note: 'Combines horizontal busbar runs, tapering vertical droppers, take-off tails, and bolted splice/tap joints.',
          },
          {
            label: 'Step 2 — Sum All Protective Devices & Starters',
            math: `P_devices = ${fmt(t.totalIncomerDevicesW, 1)} + ${fmt(t.totalStarterDevicesW, 1)} + ${fmt(t.totalFeederDevicesW, 1)} + ${fmt(t.totalInterconnectorDeviceW, 1)} = ${fmt(t.totalDevicesW, 1)} W`,
            note: 'Each device is evaluated at its actual operating current I_op (not blindly at rated I_n).',
          },
          {
            label: 'Step 3 — Grand Total in Watts & Kilowatts',
            math: `P_total = ${fmt(t.totalBusbarW, 1)} + ${fmt(t.totalDevicesW, 1)} + ${fmt(t.totalInterconnectorCableW, 1)} + ${fmt(t.totalAuxW, 1)} = ${fmt(t.grandTotalW, 1)} W = ${fmt(t.grandTotalKW, 3)} kW`,
            note: 'Dividing Watts by 1,000 yields kW.',
          },
          {
            label: 'Step 4 — Thermal Equivalent (BTU/hr)',
            math: `Q_BTU = ${fmt(t.grandTotalW, 1)} W × 3.41214 = ${Math.round(t.btuPerHr).toLocaleString()} BTU/hr`,
            note: '1 W = 3.41214 BTU/hr for HVAC equipment sizing.',
          },
        ],
        commentary: [
          `In this scenario (${evalRes.scenario}), busbars & joints account for ${fmt((t.totalBusbarW / Math.max(1, t.grandTotalW)) * 100, 1)}% of heat output, while protective devices & starters account for ${fmt((t.totalDevicesW / Math.max(1, t.grandTotalW)) * 100, 1)}%.`,
          'Because Joule losses scale with I², heavily loaded horizontal busbars (such as during N-1 firm-supply transfer to a B-side switchboard) and high-loss power electronics (such as VSDs) typically dominate total switchroom heat rejection.',
          'For room HVAC sizing, use the Worst-Case (N-1 + Future) scenario if cooling must maintain switchroom temperature during sustained feeder/transformer outages.',
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
          { name: 'Main HBB Spec', val: `${bb.barsPerPhase}×${bb.widthMm}×${bb.thicknessMm} mm (${hr.areaMm2} mm²)`, note: `R_AC = ${fmt(hr.rAcT_uOhmPerM, 2)} µΩ/m (k_AC = ${fmt(hr.kAcUsed, 3)})` },
          { name: 'Total HBB Active Length', val: `${fmt(t.totalHbbLenM, 2)} m`, note: 'Centreline-to-centreline between columns' },
          { name: 'Total VBB Active Length', val: `${fmt(t.totalVbbLenM, 2)} m`, note: 'Sum of vertical dropper runs to all active/future tiers' },
          { name: 'Board Diversity Factor (RDF)', val: `${fmt(cfg.diversityFactorRDF, 2)}`, note: 'Applied to local feeder currents summed onto busbars' },
          { name: 'Bolted Joint Resistance', val: `${cfg.jointResistanceUOhm} µΩ / phase`, note: 'Typical clean bolted Cu-Cu busbar lap joint: 3–10 µΩ' },
        ],
        steps: [
          {
            label: 'Step 1 — Horizontal Busbar Conductor Loss',
            math: `Σ(3 · I_seg² · R_AC,HBB · L_seg) = ${fmt(t.totalHbbLossW, 1)} W`,
            note: `Peak HBB heat density is ${fmt(t.maxHbbWPerM, 1)} W/m across the highest-current span (${fmt(t.maxHbbCurrentA, 0)} A).`,
          },
          {
            label: 'Step 2 — Vertical Dropper Conductor Loss',
            math: `Σ(3 · I_vseg² · R_AC,VBB · L_vseg) = ${fmt(t.totalVbbLossW, 1)} W`,
            note: `Current tapers down each vertical column as tiers tap off; peak VBB density is ${fmt(t.maxVbbWPerM, 1)} W/m.`,
          },
          {
            label: 'Step 3 — HBB Splice Joints & Tier Take-off Tails/Risers',
            math: `P_joints_tails = ${fmt(hbbJointsW, 1)} W (HBB splices) + ${fmt(tierTakeoffsW, 1)} W (incomer riser + ${cfg.takeoffTailLengthM} m tier tails & taps) = ${fmt(t.totalTakeoffAndJointW, 1)} W`,
            note: 'Accounts for short busbar/cable connections between droppers and device terminals plus bolted joint resistance.',
          },
          {
            label: 'Step 4 — Total Busbar System Heat Loss',
            math: `P_busbars = ${fmt(t.totalHbbLossW, 1)} + ${fmt(t.totalVbbLossW, 1)} + ${fmt(t.totalTakeoffAndJointW, 1)} = ${fmt(t.totalBusbarW, 1)} W`,
            note: 'Click any individual HBB or VBB segment in Tab 3 for its exact span-level calculation.',
          },
        ],
        commentary: [
          'Busbar losses vary with the SQUARE of current (I²): doubling the busbar current quadruples the W/m heat generation.',
          'Positioning heavy loads (or the N-1 Interconnector) closer to the Incomer column significantly reduces both horizontal busbar length and total kW heat loss.',
        ],
      };
    }

    // 3. KPI: Devices & Starters
    if (key === 'kpi.devices') {
      const activeCount = evalRes.deviceRows.filter((r) => r.isActive).length;
      const fixedSum = evalRes.deviceRows.reduce((a, b) => a + b.fixedLossW, 0);
      const varSum = evalRes.deviceRows.reduce((a, b) => a + b.varLossW, 0);
      return {
        title: 'Protective Devices & Starters Heat Loss',
        badge: 'IEC TR 60890 Scaling',
        resultText: `${fmt(t.totalDevicesW / 1000, 3)} kW (${fmt(t.totalDevicesW, 1)} W across ${activeCount} active compartments)`,
        formula: 'P_devices = Σ [ P_fixed + P_n · (I_op / I_n)² ]',
        inputs: [
          { name: 'Incomers & Bus Couplers', val: `${fmt(t.totalIncomerDevicesW, 1)} W`, note: 'Main ACBs carrying section net current' },
          { name: 'Motor Starters & VSDs', val: `${fmt(t.totalStarterDevicesW, 1)} W`, note: 'DOL, Star-Delta, Soft Starters, VSD drives' },
          { name: 'Outgoing Feeders (MCCB/MCB/Fuse)', val: `${fmt(t.totalFeederDevicesW, 1)} W`, note: 'Distribution sub-feeders' },
          { name: 'Interconnector Switchgear Device', val: `${fmt(t.totalInterconnectorDeviceW, 1)} W`, note: 'Active during N-1 transfer (or normal transfer if >0 A)' },
        ],
        steps: [
          {
            label: 'Step 1 — Separate Fixed (Standby/Coil) vs Load-Dependent Losses',
            math: `Σ P_fixed = ${fmt(fixedSum, 1)} W   |   Σ P_variable(I_op) = ${fmt(varSum, 1)} W`,
            note: 'Contactor holding coils, electronic trip units, control transformers, and VSD fans dissipate fixed heat whenever energized.',
          },
          {
            label: 'Step 2 — Sum Category Subtotals',
            math: `P_devices = ${fmt(t.totalIncomerDevicesW, 1)} + ${fmt(t.totalStarterDevicesW, 1)} + ${fmt(t.totalFeederDevicesW, 1)} + ${fmt(t.totalInterconnectorDeviceW, 1)} = ${fmt(t.totalDevicesW, 1)} W`,
            note: 'Click any individual device row in Tab 3 or compartment on the SLD/GA to inspect its sub-component scaling.',
          },
        ],
        commentary: [
          'Manufacturer catalogues quote maximum power loss P_n at full rated current I_n. Because protective devices are typically selected with 20–50% margin above operating current I_op, quadratic scaling (I_op / I_n)² prevents severely overestimating passive switchgear losses.',
          'VSDs (Variable Speed Drives) are a major exception: semiconductor switching losses do not vanish quadratically at light load, so VSD power stages use a realistic ~25% base + 75% linear load curve.',
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
          { name: 'Diversified Local Loads (Σ I_local × RDF)', val: `${fmt(t.totalLocalLoadA, 1)} A`, note: `Board RDF = ${(cfg.diversityFactorRDF * 100).toFixed(0)}%` },
          { name: 'Interconnector Transfer Load (A→B)', val: `${fmt(t.totalInterconnectorLoadA, 1)} A`, note: evalRes.isN1Transfer ? 'N-1 Transfer ACTIVE (100% un-diversified)' : 'Normal operation (interconnector idle/normal)' },
          { name: 'Main Busbar Rated Capacity', val: `${bb.ratedCurrentA} A`, note: `Peak HBB utilization = ${fmt((t.maxHbbCurrentA / Math.max(1, bb.ratedCurrentA)) * 100, 1)}%` },
        ],
        steps: [
          {
            label: 'Step 1 — Sum Diversified Local Column Loads',
            math: `I_local,div = ${evalRes.columns.map((c) => `${fmt(c.colLocalDiversifiedA, 0)}A`).join(' + ')} = ${fmt(t.totalLocalLoadA, 1)} A`,
            note: 'Each active local feeder current is multiplied by board RDF before summing onto the main busbar.',
          },
          {
            label: 'Step 2 — Add Firm Supply Interconnector Transfer',
            math: `I_incomer = ${fmt(t.totalLocalLoadA, 1)} + ${fmt(t.totalInterconnectorLoadA, 1)} = ${fmt(t.totalIncomerCurrentA, 1)} A`,
            note: 'In dual-incomer boards with an open bus coupler, load is solved independently per electrical section.',
          },
          {
            label: 'Step 3 — Peak Horizontal Busbar W/m',
            math: `Max HBB W/m = 3 × (${fmt(t.maxHbbCurrentA, 1)} A)² × ${fmt(hr.rAcT_uOhmPerM, 2)} µΩ/m = ${fmt(t.maxHbbWPerM, 1)} W/m`,
            note: 'Compare against busbar rated dissipation of ' + fmt(evalRes.hbbRatedWPerM, 1) + ' W/m at ' + bb.ratedCurrentA + ' A.',
          },
        ],
        commentary: [
          'If peak HBB current exceeds 100% of the main busbar rating during N-1 transfer, the busbar segment highlights in RED on both SLD and GA to warn of thermal overloading.',
          'Check whether the incomer ACB and horizontal busbar rating have been sized for N-1 transfer of the adjacent firm-supply switchboard.',
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
          { name: 'HVAC Design Safety Margin', val: `${cfg.hvacSafetyMarginPct}%`, note: 'Typical switchroom HVAC margin: 15–25%' },
          { name: 'Switchboard Overall Dimensions', val: `${fmt(W, 2)} m (W) × ${fmt(H, 2)} m (H) × ${fmt(D, 2)} m (D)`, note: `Installation: ${isWall ? 'Wall-Backed (rear blocked)' : 'Freestanding (all faces exposed)'}` },
        ],
        steps: [
          {
            label: 'Step 1 — Apply HVAC Safety Margin',
            math: `Q_HVAC = ${fmt(t.grandTotalKW, 3)} kW × (1 + ${cfg.hvacSafetyMarginPct}/100) = ${fmt(t.recommendedCoolingKW, 3)} kW`,
            note: `Equivalent to ${Math.round(t.recommendedCoolingKW * 3412.14).toLocaleString()} BTU/hr sensible cooling capacity required for the switchboard alone.`,
          },
          {
            label: 'Step 2 — Estimate Effective Cooling Surface Area A_e (IEC 60890 Table 1)',
            math: isWall
              ? `A_e = 0.9·(W·H) + 1.4·(W·D) + 2·0.9·(D·H) = 0.9·(${fmt(W * H, 2)}) + 1.4·(${fmt(W * D, 2)}) + 1.8·(${fmt(D * H, 2)}) = ${fmt(t.effectiveAreaM2, 2)} m²`
              : `A_e = 2·0.9·(W·H) + 1.4·(W·D) + 2·0.9·(D·H) = 1.8·(${fmt(W * H, 2)}) + 1.4·(${fmt(W * D, 2)}) + 1.8·(${fmt(D * H, 2)}) = ${fmt(t.effectiveAreaM2, 2)} m²`,
            note: 'IEC 60890 weighting factors: Front/Rear/Ends = 0.9, Top = 1.4 (natural convection rises to roof).',
          },
          {
            label: 'Step 3 — Average Surface Heat Flux',
            math: `q_flux = ${fmt(t.grandTotalW, 1)} W / ${fmt(t.effectiveAreaM2, 2)} m² = ${fmt(t.heatFluxWPerM2, 1)} W/m²`,
            note: 'Rule of thumb: naturally cooled IP4X/IP54 panels handle ~150–250 W/m² for ΔT ≈ 20–30K; higher densities or VSD cubicles typically require forced ventilation or internal fans.',
          },
        ],
        commentary: [
          'Remember that switchroom HVAC must reject heat from ALL equipment in the room (switchgear + transformers/UPS + lighting + solar/fabric gains).',
          'Individual compartments with high local heat flux (especially VSD cubicles) should be checked separately for forced fan airflow requirements.',
        ],
      };
    }

    // 6. Busbar Physics (Main or Column Vertical)
    if (key === 'busbar.physics') {
      const isMain = ctx.scope === 'main';
      const spec = isMain ? project.mainBusbar : (evalRes.columns[ctx.colIndex] ? evalRes.columns[ctx.colIndex].vbbSpec : project.defaultVerticalBusbar);
      const res = isMain ? evalRes.hbbRes : (evalRes.columns[ctx.colIndex] ? evalRes.columns[ctx.colIndex].vbbRes : evalRes.hbbRes);
      const ratedLoss = window.SGPhysics.calcBusbarLossPerMetre(res, spec.ratedCurrentA, cfg.poles, cfg.neutralCurrentRatio);

      return {
        title: `${isMain ? 'Main Horizontal' : 'Vertical Dropper'} Busbar — DC to AC Physics Breakdown`,
        badge: `${spec.barsPerPhase}×${spec.widthMm}×${spec.thicknessMm} mm (${res.areaMm2} mm²)`,
        resultText: `R_AC = ${fmt(res.rAcT_uOhmPerM, 2)} µΩ/m · ${fmt(ratedLoss.wPerMTotal, 1)} W/m @ ${spec.ratedCurrentA} A (3-Ph)`,
        formula: 'R_AC(T) = (ρ_20 / A) × [1 + α_20·(T_op − 20)] × k_AC   |   P/L = 3 · I² · R_AC(T)',
        inputs: [
          { name: 'Conductor Material', val: res.material.name, note: `ρ_20 = ${res.material.rho20} Ω·mm²/m, α_20 = ${res.material.alpha20} /K` },
          { name: 'Bar Construction / Phase', val: `${spec.barsPerPhase} × ${spec.widthMm} mm × ${spec.thicknessMm} mm`, note: `Total Area A = ${res.areaMm2} mm² · Gap = ${spec.gapMm || spec.thicknessMm} mm · Phase Ctr = ${spec.phaseSpacingMm || 120} mm` },
          { name: 'Operating Busbar Temperature', val: `${res.tempC} °C`, note: 'Typ: 70°C normal design (IEC 61439 max 105°C / 35°C amb + 70K rise)' },
          { name: 'System Frequency', val: `${cfg.frequencyHz} Hz`, note: 'Determines AC skin depth δ and proximity reactance' },
          { name: 'AC Conversion Mode', val: res.acFactorMode === 'calculated' ? `Calculated (k_AC = ${fmt(res.kAcCalculated, 3)})` : `Manual Factor S = ${fmt(res.manualS, 2)}`, note: 'Switchable between Manual S and Calculated Skin/Proximity in Inspector' },
        ],
        steps: [
          {
            label: 'Step 1 — Conductor Cross-Sectional Area (per Phase)',
            math: `A = n × w × t = ${spec.barsPerPhase} × ${spec.widthMm} × ${spec.thicknessMm} = ${res.areaMm2} mm²`,
            note: `Certificate Ref: ${spec.certRef || 'Not specified'}`,
          },
          {
            label: 'Step 2 — DC Resistance at 20 °C',
            math: `R_DC,20 = ρ_20 / A = ${res.material.rho20} / ${res.areaMm2} = ${fmt(res.rDc20_uOhmPerM, 3)} µΩ/m`,
            note: 'Baseline pure DC resistance per metre of one phase conductor at 20°C.',
          },
          {
            label: `Step 3 — Temperature Correction to ${res.tempC} °C`,
            math: `R_DC(${res.tempC}°C) = ${fmt(res.rDc20_uOhmPerM, 3)} × [1 + ${res.material.alpha20} × (${res.tempC} − 20)] = ${fmt(res.rDc20_uOhmPerM, 3)} × ${fmt(res.tempFactor, 4)} = ${fmt(res.rDcT_uOhmPerM, 3)} µΩ/m`,
            note: 'Metal resistivity rises ~0.39% per °C; ignoring temperature rise underestimates heat losses by ~20% at 70°C.',
          },
          {
            label: `Step 4 — AC Skin Depth δ & Skin/Proximity Factor (${cfg.frequencyHz} Hz)`,
            math: `δ = √(ρ(T) / (π·f·μ₀)) = ${fmt(res.skinDepthMm, 2)} mm  →  Calc k_AC = 1 + y_s(${fmt(res.ys, 3)}) + y_p(${fmt(res.yp, 3)}) + y_e(${fmt(res.ye, 3)}) = ${fmt(res.kAcCalculated, 3)}`,
            note: res.acFactorMode === 'calculated'
              ? `Active Mode = CALCULATED → using k_AC = ${fmt(res.kAcUsed, 3)}.`
              : `Active Mode = MANUAL → using S = ${fmt(res.manualS, 2)} (calculated reference is ${fmt(res.kAcCalculated, 3)}).`,
          },
          {
            label: 'Step 5 — AC Resistance per Metre',
            math: `R_AC(${res.tempC}°C) = ${fmt(res.rDcT_uOhmPerM, 3)} µΩ/m × ${fmt(res.kAcUsed, 3)} = ${fmt(res.rAcT_uOhmPerM, 3)} µΩ/m`,
            note: 'Effective AC resistance used in Joule\'s Law P = I² · R_AC.',
          },
          {
            label: `Step 6 — Reference 3-Phase Heat Loss at Rated ${spec.ratedCurrentA} A`,
            math: `P/L = 3 × (${spec.ratedCurrentA})² × ${fmt(res.rAcT_uOhmPerM, 3)}×10⁻⁶ = ${fmt(ratedLoss.wPerMPhase * 3, 1)} W/m${ratedLoss.wPerMNeutral > 0 ? ` + ${fmt(ratedLoss.wPerMNeutral, 1)} W/m (Neutral) = ${fmt(ratedLoss.wPerMTotal, 1)} W/m` : ''}`,
            note: `Per phase: ${fmt(ratedLoss.wPerMPhase, 1)} W/m. Actual segment W/m scales with (I_seg / ${spec.ratedCurrentA})².`,
          },
        ],
        commentary: [
          `At ${cfg.frequencyHz} Hz in copper at ${res.tempC}°C, skin depth δ ≈ ${fmt(res.skinDepthMm, 1)} mm. Single thin bars (≤ 6 mm) have low skin effect (k_AC ≈ 1.05–1.10), while 3 or 4 parallel bars per phase suffer strong mutual crowding (k_AC ≈ 1.35–1.65).`,
          'Using S = 1.20 is a widely accepted conservative rule-of-thumb for 2-bar laminated copper busbars (such as 2×75×6 mm) inside steel switchboard enclosures.',
        ],
      };
    }

    // 7. Horizontal Busbar Segment
    if (key === 'hbb.segment') {
      const seg = evalRes.hbbSegments[ctx.segIndex];
      if (!seg) return null;
      const jointUOhm = Number(cfg.jointResistanceUOhm != null ? cfg.jointResistanceUOhm : 5);
      return {
        title: `Horizontal Busbar Span: ${seg.fromColName} → ${seg.toColName}`,
        badge: `HBB Segment #${ctx.segIndex + 1}`,
        resultText: `${fmt(seg.totalSegW, 1)} W total (${fmt(seg.wPerMTotal, 1)} W/m × ${fmt(seg.lengthM, 2)} m + ${fmt(seg.jointLossW, 1)} W joint)`,
        formula: 'P_seg = [ 3 · I² · R_AC + P_neutral ] × L_seg + 3 · I² · R_joint',
        inputs: [
          { name: 'From Column Centreline X₁', val: `${Math.round(seg.x1Mm)} mm`, note: seg.fromColName },
          { name: 'To Column Centreline X₂', val: `${Math.round(seg.x2Mm)} mm`, note: seg.toColName },
          { name: 'Segment Current I_seg', val: `${fmt(seg.currentA, 1)} A (${seg.direction === 'right' ? 'Left → Right' : 'Right → Left'})`, note: `${fmt(seg.utilizationPct, 1)}% of ${bb.ratedCurrentA} A busbar rating` },
          { name: 'Main HBB R_AC', val: `${fmt(hr.rAcT_uOhmPerM, 2)} µΩ/m`, note: `${bb.barsPerPhase}×${bb.widthMm}×${bb.thicknessMm} mm (${hr.areaMm2} mm²), k_AC=${fmt(hr.kAcUsed, 3)}` },
          { name: 'Panel Splice Joint Resistance', val: `${jointUOhm} µΩ / phase`, note: '1 bolted panel-to-panel busbar splice per boundary' },
        ],
        steps: [
          {
            label: 'Step 1 — Span Length from General Arrangement',
            math: `L_seg = (X₂ − X₁) / 1000 = (${Math.round(seg.x2Mm)} − ${Math.round(seg.x1Mm)}) / 1000 = ${fmt(seg.lengthM, 3)} m`,
            note: 'Derived automatically from half the width of each adjacent cubicle.',
          },
          {
            label: 'Step 2 — Per-Phase & 3-Phase Heat Density (W/m)',
            math: `P_ph/m = (${fmt(seg.currentA, 1)})² × ${fmt(hr.rAcT_uOhmPerM, 2)}×10⁻⁶ = ${fmt(seg.wPerMPhase, 2)} W/m  →  3-Ph (+N) = ${fmt(seg.wPerMTotal, 2)} W/m`,
            note: cfg.poles === '3P+N' && cfg.neutralCurrentRatio > 0
              ? `Includes neutral current at ${(cfg.neutralCurrentRatio * 100).toFixed(0)}% of phase current.`
              : 'Balanced 3-phase loading (no neutral current heat).',
          },
          {
            label: 'Step 3 — Conductor Segment Loss (W)',
            math: `P_cond = ${fmt(seg.wPerMTotal, 2)} W/m × ${fmt(seg.lengthM, 3)} m = ${fmt(seg.lossW, 2)} W`,
            note: 'Heat generated along the horizontal copper/aluminium bars in this span.',
          },
          {
            label: 'Step 4 — Bolted Busbar Splice Joint Loss (W)',
            math: `P_joint = 3 × (${fmt(seg.currentA, 1)})² × ${jointUOhm}×10⁻⁶ = ${fmt(seg.jointLossW, 2)} W`,
            note: 'Contact resistance at the panel-to-panel bolted fishplate splice.',
          },
          {
            label: 'Step 5 — Total Span Heat Output',
            math: `P_seg,total = ${fmt(seg.lossW, 2)} + ${fmt(seg.jointLossW, 2)} = ${fmt(seg.totalSegW, 2)} W`,
            note: '',
          },
        ],
        commentary: [
          'Segment current is solved by Kirchhoff\'s Current Law across the electrical section: net current flowing past column k equals the sum of all downstream diversified loads (plus N-1 interconnector transfer if active).',
          seg.utilizationPct > 100
            ? 'WARNING: This segment exceeds 100% of the main busbar rated current! Upgrade the busbar construction or limit N-1 transfer load.'
            : seg.utilizationPct > 80
            ? 'Notice: Segment loading exceeds 80% of rated capacity. Check busbar chamber ventilation and bolted joint torque.'
            : 'Busbar current utilization is well within rated thermal limits.',
        ],
      };
    }

    // 8. Vertical Dropper Busbar Segment
    if (key === 'vbb.segment') {
      const seg = evalRes.vbbSegments[ctx.segIndex];
      if (!seg) return null;
      const cr = evalRes.columns[seg.colIndex];
      const vSpec = cr.vbbSpec;
      const vRes = cr.vbbRes;
      return {
        title: `Vertical Dropper Span: ${seg.colName} (${seg.fromLabel} → ${seg.toLabel})`,
        badge: `Take-off EL +${seg.takeoffElevationMm} mm`,
        resultText: `${fmt(seg.lossW, 2)} W (${fmt(seg.wPerMTotal, 1)} W/m × ${fmt(seg.lengthM, 2)} m)`,
        formula: 'P_vseg = [ 3 · I_vseg² · R_AC,VBB + P_neutral ] × Δy',
        inputs: [
          { name: 'Column Vertical Busbar Spec', val: `${vSpec.barsPerPhase}×${vSpec.widthMm}×${vSpec.thicknessMm} mm (${vRes.areaMm2} mm²)`, note: `Rated ${vSpec.ratedCurrentA} A · R_AC = ${fmt(vRes.rAcT_uOhmPerM, 2)} µΩ/m (k_AC=${fmt(vRes.kAcUsed, 3)})` },
          { name: 'Vertical Span Δy', val: `${fmt(seg.lengthM, 3)} m (${Math.round(Math.abs(seg.y2Mm - seg.y1Mm))} mm)`, note: `From ${seg.fromLabel} to ${seg.toLabel} (FFL +${seg.takeoffElevationMm} mm)` },
          { name: 'Tapering Dropper Current I_vseg', val: `${fmt(seg.currentA, 1)} A`, note: `${fmt(seg.utilizationPct, 1)}% of ${vSpec.ratedCurrentA} A dropper rating` },
        ],
        steps: [
          {
            label: 'Step 1 — Span Length from GA Take-off Coordinates',
            math: `Δy = |y₂ − y₁| / 1000 = |${Math.round(seg.y2Mm)} − ${Math.round(seg.y1Mm)}| / 1000 = ${fmt(seg.lengthM, 3)} m`,
            note: 'Measured from Main HBB centreline (for top tier) or preceding tier take-off centreline.',
          },
          {
            label: 'Step 2 — Tapering Vertical Current Summation',
            math: `I_vseg = Σ (diversified currents of "${seg.toLabel}" and all tiers further from HBB) = ${fmt(seg.currentA, 1)} A`,
            note: 'Top spans carry the full column load; lower spans carry progressively less current as upper tiers tap off.',
          },
          {
            label: 'Step 3 — 3-Phase Heat Loss per Metre (W/m)',
            math: `P/L = 3 × (${fmt(seg.currentA, 1)})² × ${fmt(vRes.rAcT_uOhmPerM, 2)}×10⁻⁶ = ${fmt(seg.wPerMTotal, 2)} W/m`,
            note: `Per phase: ${fmt(seg.wPerMPhase, 2)} W/m.`,
          },
          {
            label: 'Step 4 — Segment Heat Loss (W)',
            math: `P_vseg = ${fmt(seg.wPerMTotal, 2)} W/m × ${fmt(seg.lengthM, 3)} m = ${fmt(seg.lossW, 2)} W`,
            note: '',
          },
        ],
        commentary: [
          'Placing the highest-current motor starters or outgoing MCCBs in the tiers closest to the horizontal busbar chamber minimizes high-current vertical dropper length and reduces heat output.',
        ],
      };
    }

    // 9. Individual Tier / Device / Starter / Incomer / Interconnector
    if (key === 'tier.loss') {
      const cr = evalRes.columns[ctx.colIndex];
      const tr = cr && cr.tiers[ctx.tierIndex];
      if (!tr) return null;
      const tier = tr.tier;
      const dl = tr.deviceLoss || { iOp: 0, iRated: tier.ratedCurrentA, loadRatio: 0, loadRatioSq: 0, pFixedW: 0, pVarW: 0, pTotalW: 0, breakdown: [] };
      const totalRowW = dl.pTotalW + (tr.takeoffLossW || 0) + (tr.cableLoss ? tr.cableLoss.totalW : 0);
      const isFutureOff = tier.status === 'future' && !tr.isActive;

      const steps = [];
      // Step 1: Operating Current Derivation
      if (tier.role === 'incomer') {
        steps.push({
          label: 'Step 1 — Incomer Operating Current',
          math: `I_op = ${fmt(tr.iOp, 1)} A (sum of active loads in electrical section)`,
          note: `Breaker state: ${tier.incomerState === 'open' ? 'OPEN (0 A)' : 'CLOSED'}.`,
        });
      } else if (tier.role === 'bus_coupler') {
        steps.push({
          label: 'Step 1 — Bus Coupler Through-Current',
          math: `I_op = ${fmt(tr.iOp, 1)} A`,
          note: `Coupler state: ${tier.couplerState === 'closed' ? 'CLOSED' : 'OPEN (0 A)'}.`,
        });
      } else if (tier.role === 'interconnector') {
        steps.push({
          label: 'Step 1 — Interconnector Transfer Current',
          math: `I_op = ${fmt(tr.iOp, 1)} A`,
          note: evalRes.isN1Transfer
            ? `N-1 Firm Transfer scenario active → supplying ${tier.remoteBoardName || 'MSB-B'} at ${tier.n1TransferCurrentA} A.`
            : `Normal scenario → normal transfer set to ${tier.normalTransferCurrentA || 0} A.`,
        });
      } else if (tier.loadInputMode === 'kw') {
        const rawA = (tier.loadKw * 1000) / (Math.sqrt(3) * cfg.voltageV * tier.powerFactor * tier.efficiency);
        const growthMul = evalRes.includeFuture && tier.status === 'active' && cfg.globalFutureGrowthPct > 0 ? 1 + cfg.globalFutureGrowthPct / 100 : 1;
        steps.push({
          label: 'Step 1 — Operating Current I_op from Motor / Load Power (kW)',
          math: `I_flc = (${tier.loadKw} × 1000) / (√3 × ${cfg.voltageV} × ${tier.powerFactor} × ${tier.efficiency}) = ${fmt(rawA, 1)} A  →  × Duty(${tier.loadFactor})${growthMul > 1 ? ` × Future(${fmt(growthMul, 2)})` : ''} = ${fmt(tr.iOp, 1)} A`,
          note: isFutureOff ? 'Tier is marked FUTURE and excluded in Normal/N-1 scenarios → I_op = 0 A.' : `Running at ${fmt(dl.loadRatio * 100, 1)}% of ${tier.ratedCurrentA} A device rating.`,
        });
      } else {
        const growthMul = evalRes.includeFuture && tier.status === 'active' && cfg.globalFutureGrowthPct > 0 ? 1 + cfg.globalFutureGrowthPct / 100 : 1;
        steps.push({
          label: 'Step 1 — Operating Current I_op (Direct Amps)',
          math: `I_op = ${tier.operatingCurrentA} A × Duty(${tier.loadFactor})${growthMul > 1 ? ` × Future(${fmt(growthMul, 2)})` : ''} = ${fmt(tr.iOp, 1)} A`,
          note: isFutureOff ? 'Tier is marked FUTURE and inactive in this scenario → I_op = 0 A.' : `Running at ${fmt(dl.loadRatio * 100, 1)}% of ${tier.ratedCurrentA} A device rating.`,
        });
      }

      // Step 2: Load Ratio & Device Loss Scaling
      steps.push({
        label: 'Step 2 — Quadratic Load Scaling Factor (IEC TR 60890)',
        math: `(I_op / I_n)² = (${fmt(tr.iOp, 1)} / ${tier.ratedCurrentA})² = (${fmt(dl.loadRatio, 3)})² = ${fmt(dl.loadRatioSq, 4)}`,
        note: 'Joule losses in contacts, bimetallic overloads, fuse links, and poles scale with the square of current.',
      });

      // Step 3: Sub-components breakdown
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

      // Step 4: Take-off & Cable Losses
      steps.push({
        label: 'Step 4 — Take-off Connection Tail, Bolted Joint & Cable Loss',
        math: `P_takeoff = ${fmt(tr.takeoffLossW || 0, 2)} W${tr.cableLoss && tr.cableLoss.totalW > 0 ? `  |  P_cable = ${fmt(tr.cableLoss.wPerM, 1)} W/m × ${tr.cableLoss.lengthM} m = ${fmt(tr.cableLoss.totalW, 1)} W` : ''}`,
        note: `Take-off elevation EL +${Math.round(evalRes.panelHeightMm - tr.yCenterMm)} mm; includes ${cfg.takeoffTailLengthM} m tail & ${cfg.jointResistanceUOhm} µΩ bolted joint.`,
      });

      steps.push({
        label: 'Step 5 — Total Compartment Heat Output',
        math: `P_compartment = ${fmt(dl.pTotalW, 1)} + ${fmt(tr.takeoffLossW || 0, 1)}${tr.cableLoss && tr.cableLoss.totalW > 0 ? ` + ${fmt(tr.cableLoss.totalW, 1)}` : ''} = ${fmt(totalRowW, 1)} W`,
        note: '',
      });

      const commentary = [
        `Notice the difference between operating vs rated losses: at full rated current (${tier.ratedCurrentA} A), this assembly dissipates ~${fmt((tier.ratedLossW || 0) + (tier.fixedLossW || 0), 0)} W, whereas at ${fmt(tr.iOp, 1)} A operating current it dissipates ${fmt(dl.pTotalW, 1)} W.`,
      ];
      if (tier.category === 'DOL Starter' || tier.category === 'Star-Delta Starter') {
        commentary.push('For motor starters, contactor holding coils and control transformers generate constant heat whenever running, even at light motor loads, while main poles and overload heaters scale with I².');
      } else if (tier.category === 'VSD / Inverter') {
        commentary.push('VSDs typically dissipate 2.5%–3.5% of running motor kW inside the cubicle and are frequently the single hottest compartment in an MCC.');
      } else if (tier.role === 'interconnector') {
        commentary.push('Interconnector feeders carry zero or low current in normal split operation, but become a major thermal load during N-1 firm-supply transfer to the partner switchboard.');
      }

      return {
        title: `${tier.tag} — ${tier.description}`,
        badge: `${tier.category} · ${cr.col.name}`,
        resultText: `${fmt(totalRowW, 1)} W (${fmt(tr.iOp, 1)} A operating vs ${tier.ratedCurrentA} A rated)`,
        formula: 'P_comp = [ P_fixed + Σ P_var,n · (I_op / I_n)² ] + P_takeoff_joint + P_cable',
        inputs: [
          { name: 'Device Frame Rating I_n', val: `${tier.ratedCurrentA} A`, note: tier.category },
          { name: 'Operating Current I_op', val: `${fmt(tr.iOp, 1)} A`, note: `${fmt(dl.loadRatio * 100, 1)}% of rated current` },
          { name: 'Rated Variable Loss P_n', val: `${fmt(tier.subComponents ? tier.subComponents.reduce((a, b) => a + (Number(b.ratedLossW) || 0), 0) : tier.ratedLossW, 1)} W`, note: 'Manufacturer datasheet loss at I_n' },
          { name: 'Fixed Standby / Coil Loss', val: `${fmt(dl.pFixedW, 1)} W`, note: 'Coils, trip unit, control PSU, VSD fans' },
          { name: 'Status in Active Scenario', val: tr.isActive ? 'ACTIVE' : tier.status.toUpperCase() + ' (OFF)', note: `Scenario: ${evalRes.scenario}` },
        ],
        steps,
        commentary,
      };
    }

    // 10. Column Summary
    if (key === 'column.total') {
      const cr = evalRes.columns[ctx.colIndex];
      if (!cr) return null;
      return {
        title: `${cr.col.name} — Column Thermal Summary`,
        badge: `Width ${cr.widthMm} mm · X = ${Math.round(cr.xCenterMm)} mm`,
        resultText: `${fmt(cr.colTotalLossW, 1)} W total (${fmt(cr.colTotalLoadA, 1)} A net load)`,
        formula: 'P_col = P_devices + P_VBB + P_takeoffs + P_cable',
        inputs: [
          { name: 'Column Devices & Starters', val: `${fmt(cr.colDevicesW, 1)} W`, note: `${cr.tiers.length} compartments` },
          { name: 'Vertical Dropper Busbar (VBB)', val: `${fmt(cr.vbbTotalLossW, 1)} W`, note: `${fmt(cr.vbbTotalLengthM, 2)} m total run, peak ${fmt(cr.vbbMaxWPerM, 1)} W/m` },
          { name: 'Take-off Tails & Joints', val: `${fmt(cr.colTakeoffW, 1)} W`, note: 'Internal tap-off links & bolted joints' },
          { name: 'Internal Interconnector Cable', val: `${fmt(cr.colCableW, 1)} W`, note: 'If interconnector cable loss enabled' },
        ],
        steps: [
          {
            label: 'Step 1 — Column Net Diversified Current',
            math: `I_col = (${fmt(cr.colLocalRawA, 1)} A × RDF ${cfg.diversityFactorRDF}) + ${fmt(cr.colInterconnectorA, 1)} A (IC) = ${fmt(cr.colTotalLoadA, 1)} A`,
            note: cr.hasIncomer ? `Incomer supplies ${fmt(cr.incomerSupplyA, 1)} A to the horizontal busbar.` : 'Drawn from Main Horizontal Busbar into this column.',
          },
          {
            label: 'Step 2 — Sum All Column Heat Sources',
            math: `P_col = ${fmt(cr.colDevicesW, 1)} + ${fmt(cr.vbbTotalLossW, 1)} + ${fmt(cr.colTakeoffW, 1)} + ${fmt(cr.colCableW, 1)} = ${fmt(cr.colTotalLossW, 1)} W`,
            note: 'Note: Main horizontal busbar losses passing through the top/bottom chamber are accounted for separately in the HBB schedule.',
          },
        ],
        commentary: [
          'Checking heat loss per column identifies local hot spots (such as a VSD column dissipating >1.5 kW inside an 800 mm cubicle) that may require dedicated roof extractor fans or louvering even when average board heat flux looks modest.',
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

  function openModal(key, ctx, project, evalRes) {
    const exp = buildExplanation(key, ctx || {}, project, evalRes);
    if (!exp) return;

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
            <div class="m-lbl">Calculated Result</div>
            <div class="m-val">${esc(exp.resultText)}</div>
          </div>
          <div class="m-formula">
            <div class="m-lbl">Governing Equation</div>
            <code>${esc(exp.formula)}</code>
          </div>
        </div>

        <div class="modal-body">
          <div class="explain-block">
            <h4>1. Input Values Used</h4>
            <table class="data-table">
              <thead><tr><th>Parameter</th><th>Value</th><th>Basis / Reference</th></tr></thead>
              <tbody>
                ${exp.inputs
                  .map(
                    (inp) => `<tr>
                      <td><strong>${esc(inp.name)}</strong></td>
                      <td style="font-family:var(--font-mono);color:var(--accent);">${esc(inp.val)}</td>
                      <td style="color:var(--text-2);">${esc(inp.note || '')}</td>
                    </tr>`
                  )
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

    overlay.classList.add('open');

    document.getElementById('explain-close-btn').addEventListener('click', closeModal);
    document.getElementById('explain-copy-btn').addEventListener('click', () => {
      const btn = document.getElementById('explain-copy-btn');
      const txt = toPlainText(exp);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
          btn.textContent = '✓ Copied!';
          setTimeout(() => (btn.textContent = 'Copy Worked Calc'), 1800);
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = txt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = '✓ Copied!';
        setTimeout(() => (btn.textContent = 'Copy Worked Calc'), 1800);
      }
    });
  }

  function closeModal() {
    const overlay = document.getElementById('explain-modal-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  return {
    openModal,
    closeModal,
    buildExplanation,
  };
})();
