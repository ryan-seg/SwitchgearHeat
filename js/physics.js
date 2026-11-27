/**
 * Switchgear Heat Loss Physics & Electrical Calculation Engine
 * Standards basis: IEC 60439-1 / IEC 61439-1, IEC TR 60890, IEC 60287, CDA Pub 22
 */

window.SGPhysics = (function () {
  'use strict';

  const MU_0 = 4 * Math.PI * 1e-7; // H/m

  const MATERIALS = {
    cu_100: {
      id: 'cu_100',
      name: 'Copper (Cu-ETP 100% IACS)',
      shortName: 'Cu 100%',
      rho20: 0.017241, // Ohm·mm²/m
      alpha20: 0.00393, // 1/K
    },
    cu_98: {
      id: 'cu_98',
      name: 'Copper (Cu Busbar 98% IACS)',
      shortName: 'Cu 98%',
      rho20: 0.017593,
      alpha20: 0.00385,
    },
    al_61: {
      id: 'al_61',
      name: 'Aluminium (EC Grade 61% IACS)',
      shortName: 'Al 61%',
      rho20: 0.028264,
      alpha20: 0.00403,
    },
    al_55: {
      id: 'al_55',
      name: 'Aluminium (6101-T6 55% IACS)',
      shortName: 'Al 55%',
      rho20: 0.031347,
      alpha20: 0.00360,
    },
  };

  /**
   * Compute DC and AC resistance per metre (Ohm/m) and skin/proximity factors
   * for a rectangular laminated busbar per phase.
   */
  function calcBusbarResistance(spec, freqHz) {
    const mat = MATERIALS[spec.material] || MATERIALS.cu_100;
    const n = Math.max(1, Number(spec.barsPerPhase) || 1);
    const w = Math.max(1, Number(spec.widthMm) || 50);
    const t = Math.max(1, Number(spec.thicknessMm) || 6);
    const gap = spec.gapMm != null && spec.gapMm > 0 ? Number(spec.gapMm) : t;
    const phaseSpacing = Math.max(20, Number(spec.phaseSpacingMm) || 120);
    const tempC = Number(spec.operatingTempC != null ? spec.operatingTempC : 70);
    const f = Number(freqHz || 50);

    const areaMm2 = n * w * t;
    const tempFactor = 1 + mat.alpha20 * (tempC - 20);
    const rhoT_ohmMm2PerM = mat.rho20 * tempFactor;
    const rhoT_ohmM = rhoT_ohmMm2PerM * 1e-6;

    // DC resistance per metre (Ohm/m)
    const rDc20 = mat.rho20 / areaMm2;
    const rDcT = rhoT_ohmMm2PerM / areaMm2;

    // Skin depth (mm)
    const skinDepthM = Math.sqrt(rhoT_ohmM / (Math.PI * f * MU_0));
    const skinDepthMm = skinDepthM * 1000;

    // Calculated AC factor: k_AC = 1 + ys + yp + ye
    // 1. Skin effect (ys):
    // Combine classical slab skin formula across effective thickness + rectangular edge effect
    // + multi-lamination current sharing penalty (calibrated against CDA Pub 22 / Dwight rectangular bar curves)
    const totalMetalThick = n * t;
    // Effective depth parameter for laminated group: gaps reduce eddy-current coupling vs solid block
    const lamCoupling = n === 1 ? 1.0 : 1.0 + 0.55 * (n - 1) * Math.exp(-gap / (2.5 * t));
    const tEff = t * lamCoupling;
    const xi = tEff / (2 * skinDepthMm);

    let kSlab = 1.0;
    if (xi > 0.01) {
      const twoXi = 2 * xi;
      if (twoXi > 20) {
        kSlab = xi;
      } else {
        kSlab = xi * ((Math.sinh(twoXi) + Math.sin(twoXi)) / (Math.cosh(twoXi) - Math.cos(twoXi)));
      }
    }
    const ysSlab = Math.max(0, kSlab - 1);

    // Rectangular edge concentration (Dwight effect: wider bars relative to skin depth have edge crowding)
    const widthRatio = w / skinDepthMm;
    const aspectRatio = w / Math.max(1, totalMetalThick);
    const ysEdge = 0.0045 * Math.pow(Math.max(0, widthRatio - 1.5), 1.35) * Math.min(2.2, Math.sqrt(aspectRatio / 4));

    // Multi-bar outer-bar crowding factor (for 2, 3, 4 parallel bars per phase at 50/60 Hz)
    const ysMulti = n > 1 ? 0.028 * Math.pow(n - 1, 1.55) * Math.pow(totalMetalThick / (2 * skinDepthMm), 1.2) : 0;

    const ys = ysSlab + ysEdge + ysMulti;

    // 2. Proximity effect (yp) per IEC 60287 adapted for rectangular phase groups
    const dEqMm = Math.sqrt((4 * areaMm2) / Math.PI);
    const orientationFactor = spec.orientation === 'flat' ? 1.0 : 0.72; // edge-on has lower proximity than flat-on
    const xp2 = ((8 * Math.PI * f * 1e-7) / rDcT) * orientationFactor;
    const xp4 = xp2 * xp2;
    const fp = xp4 / (192 + 0.8 * xp4);
    const dOverS = Math.min(0.85, dEqMm / phaseSpacing);
    const yp = fp * (dOverS * dOverS) * (0.312 * dOverS * dOverS + 1.18 / (fp + 0.27));

    // 3. Enclosure eddy current allowance (ye)
    const ye = spec.enclosureEddyFactor != null ? Number(spec.enclosureEddyFactor) : 0.02;

    const kAcCalculated = 1 + ys + yp + ye;
    const manualS = Math.max(1.0, Number(spec.manualSFactor) || 1.2);
    const useCalculated = spec.acFactorMode === 'calculated';
    const kAcUsed = useCalculated ? kAcCalculated : manualS;

    const rAcT = rDcT * kAcUsed;

    // Neutral busbar resistance (if 3P+N)
    const neutralFactor = spec.neutralSizeRatio != null ? Number(spec.neutralSizeRatio) : 1.0;
    const rNeutralAcT = neutralFactor > 0 ? rAcT / neutralFactor : 0;

    return {
      material: mat,
      areaMm2,
      tempC,
      tempFactor,
      rDc20, // Ohm/m
      rDcT, // Ohm/m
      rAcT, // Ohm/m
      rNeutralAcT, // Ohm/m
      rDc20_uOhmPerM: rDc20 * 1e6,
      rDcT_uOhmPerM: rDcT * 1e6,
      rAcT_uOhmPerM: rAcT * 1e6,
      skinDepthMm,
      ys,
      yp,
      ye,
      kAcCalculated,
      manualS,
      kAcUsed,
      acFactorMode: useCalculated ? 'calculated' : 'manual',
    };
  }

  /**
   * Compute W/m heat loss for a busbar carrying current I (Amps)
   */
  function calcBusbarLossPerMetre(busRes, currentA, poles, neutralCurrentRatio) {
    const I = Math.max(0, Number(currentA) || 0);
    const wPerMPhase = I * I * busRes.rAcT;
    const phaseCount = poles === '1P' ? 2 : 3;
    let wPerMNeutral = 0;
    if (poles === '3P+N' && busRes.rNeutralAcT > 0 && neutralCurrentRatio > 0) {
      const iN = I * neutralCurrentRatio;
      wPerMNeutral = iN * iN * busRes.rNeutralAcT;
    }
    const wPerMTotal = wPerMPhase * phaseCount + wPerMNeutral;
    return {
      wPerMPhase,
      wPerMNeutral,
      wPerMTotal,
    };
  }

  /**
   * Compute operating current for a feeder/tier given either direct Amps or kW/PF/Efficiency
   */
  function calcFeederCurrent(tier, voltageV) {
    const V = Number(voltageV || 400);
    const duty = tier.loadFactor != null ? Number(tier.loadFactor) : 1.0;
    let baseAmps = 0;

    if (tier.loadInputMode === 'kw') {
      const kw = Math.max(0, Number(tier.loadKw) || 0);
      const pf = Math.min(1, Math.max(0.1, Number(tier.powerFactor) || 0.85));
      const eff = Math.min(1, Math.max(0.1, Number(tier.efficiency) || 0.93));
      if (tier.phases === '1P' || tier.phases === '2P') {
        const vPh = V / Math.sqrt(3);
        baseAmps = (kw * 1000) / (vPh * pf * eff);
      } else {
        baseAmps = (kw * 1000) / (Math.sqrt(3) * V * pf * eff);
      }
    } else {
      baseAmps = Math.max(0, Number(tier.operatingCurrentA) || 0);
    }

    return baseAmps * duty;
  }

  /**
   * Compute heat loss of a protective device or starter at operating current Iop
   * P_op = P_fixed + P_var_rated * (Iop / In)^2 + (optional VSD linear % loss)
   */
  function calcDeviceLoss(device, operatingCurrentA, voltageV, isActive) {
    if (!isActive) {
      return {
        iOp: 0,
        iRated: Number(device.ratedCurrentA) || 1,
        loadRatio: 0,
        loadRatioSq: 0,
        pFixedW: 0,
        pVarW: 0,
        pTotalW: 0,
        breakdown: [],
      };
    }

    const iRated = Math.max(1, Number(device.ratedCurrentA) || 1);
    const iOp = Math.max(0, Number(operatingCurrentA) || 0);
    const loadRatio = iOp / iRated;
    const loadRatioSq = loadRatio * loadRatio;

    // Automatic pole / fuse-count scaling when switching a device between 1P, 2P (Double Pole), and 3P:
    // Resistive fuse links / breaker poles scale linearly with active poles (activePoles / nativePoles),
    // while fixed coils/electronics and VSD IGBT stages do not scale by fuse count.
    const activePoles = device.phases === '1P' ? 1 : device.phases === '2P' ? 2 : 3;
    const nativePoles = Number(device.templatePoles) || (String(device.templateId || '').includes('1p') ? 1 : 3);
    const poleScale = device.role === 'feeder' ? activePoles / nativePoles : 1;

    let pFixedW = 0;
    let pVarW = 0;
    const breakdown = [];

    if (Array.isArray(device.subComponents) && device.subComponents.length > 0) {
      device.subComponents.forEach((sc) => {
        const scRated = Math.max(1, Number(sc.ratedCurrentA) || iRated);
        const r = iOp / scRated;
        const rSq = r * r;
        const fixed = Math.max(0, Number(sc.fixedLossW) || 0);
        let variable = 0;

        if (sc.lossModel === 'vsd_efficiency') {
          // VSD power stage: losses scale ~linearly + slightly quadratically with output kW/current
          const pNom = Math.max(0, Number(sc.ratedLossW) || 0);
          variable = pNom * (0.25 + 0.75 * r); // realistic IGBT switching + conduction curve
        } else if (sc.lossModel === 'bypassed_soft_starter') {
          // Soft starter with internal bypass contactor: low running loss (bypass poles)
          variable = Math.max(0, Number(sc.ratedLossW) || 0) * rSq * poleScale;
        } else {
          // Standard Joule scaling (IEC TR 60890): P = P_n * (I_op / I_n)^2 * (activePoles / nativePoles)
          variable = Math.max(0, Number(sc.ratedLossW) || 0) * rSq * poleScale;
        }

        pFixedW += fixed;
        pVarW += variable;
        breakdown.push({
          name: sc.name,
          ratedLossW: Number(sc.ratedLossW) || 0,
          fixedLossW: fixed,
          opLossW: fixed + variable,
        });
      });
    } else {
      pFixedW = Math.max(0, Number(device.fixedLossW) || 0);
      if (device.lossModel === 'vsd_efficiency') {
        pVarW = Math.max(0, Number(device.ratedLossW) || 0) * (0.25 + 0.75 * loadRatio);
      } else {
        pVarW = Math.max(0, Number(device.ratedLossW) || 0) * loadRatioSq * poleScale;
      }
      breakdown.push({
        name: device.name || device.category,
        ratedLossW: Number(device.ratedLossW) || 0,
        fixedLossW: pFixedW,
        opLossW: pFixedW + pVarW,
      });
    }

    return {
      iOp,
      iRated,
      loadRatio,
      loadRatioSq,
      activePoles,
      nativePoles,
      poleScale,
      pFixedW,
      pVarW,
      pTotalW: pFixedW + pVarW,
      breakdown,
    };
  }

  /**
   * Compute interconnector cable internal/optional termination loss if configured
   */
  function calcCableLoss(cableSpec, currentA, isActive) {
    if (!isActive || !cableSpec || !cableSpec.includeCableLoss) {
      return { lengthM: 0, wPerM: 0, totalW: 0 };
    }
    const I = Math.max(0, Number(currentA) || 0);
    const nCables = Math.max(1, Number(cableSpec.cablesPerPhase) || 1);
    const csa = Math.max(10, Number(cableSpec.csaMm2) || 240);
    const lenM = Math.max(0, Number(cableSpec.internalLengthM) || 0);
    const mat = MATERIALS[cableSpec.material] || MATERIALS.cu_100;
    const tempC = Number(cableSpec.operatingTempC || 70);
    const rPerM = (mat.rho20 * (1 + mat.alpha20 * (tempC - 20))) / (nCables * csa);
    const kAc = 1.05; // typical stranded XLPE cable skin/proximity at 50Hz
    const wPerM = 3 * I * I * rPerM * kAc;
    return {
      lengthM: lenM,
      wPerM,
      totalW: wPerM * lenM,
    };
  }

  /**
   * Evaluate the complete switchgear thermal & electrical model for a given scenario.
   * Scenarios:
   *   'normal'          - Active local loads only (interconnector at normal transfer, typically 0)
   *   'n1_transfer'     - Active local loads + N-1 interconnector firm-supply transfer to B-side board
   *   'normal_future'   - Active + Future local loads (plus optional global future growth %)
   *   'worst_case'      - Active + Future local loads + N-1 interconnector transfer
   */
  function evaluateSwitchgear(project, scenarioId) {
    const scenario = scenarioId || project.activeScenario || 'normal';
    const includeFuture = scenario === 'normal_future' || scenario === 'worst_case';
    const isN1Transfer = scenario === 'n1_transfer' || scenario === 'worst_case';

    const cfg = project.config;
    const freqHz = Number(cfg.frequencyHz || 50);
    const voltageV = Number(cfg.voltageV || 400);
    const poles = cfg.poles || '3P+N';
    const neutralRatio = Number(cfg.neutralCurrentRatio || 0);
    const boardRdf = Math.min(1.0, Math.max(0.2, Number(cfg.diversityFactorRDF != null ? cfg.diversityFactorRDF : 1.0)));
    const futureGrowthPct = includeFuture ? Math.max(0, Number(cfg.globalFutureGrowthPct) || 0) / 100 : 0;

    // Main horizontal busbar physics
    const hbbRes = calcBusbarResistance(project.mainBusbar, freqHz);

    // Joint resistance (uOhm per bolted joint, 3 phases)
    const jointR_ohm = (Number(cfg.jointResistanceUOhm != null ? cfg.jointResistanceUOhm : 5) * 1e-6);
    const takeoffTailM = Math.max(0, Number(cfg.takeoffTailLengthM != null ? cfg.takeoffTailLengthM : 0.35));

    // Step 1: Compute column geometry (x coordinates, horizontal busbar elevation)
    const panelHeightMm = Number(cfg.panelHeightMm || 2200);
    const hbbChamberMm = Number(cfg.hbbChamberHeightMm || 350);
    const hbbPosition = cfg.hbbPosition || 'top'; // 'top' or 'bottom'
    const hbbCenterYMm = hbbPosition === 'top' ? hbbChamberMm / 2 : panelHeightMm - hbbChamberMm / 2;

    let cursorX = 0;
    const columnResults = project.columns.map((col, colIndex) => {
      const widthMm = Math.max(300, Number(col.widthMm) || 800);
      const xStartMm = cursorX;
      const xCenterMm = cursorX + widthMm / 2;
      cursorX += widthMm;

      // Vertical busbar resistance for this column (falls back to default vertical busbar)
      const vbbSpec = col.verticalBusbar || project.defaultVerticalBusbar;
      const vbbRes = calcBusbarResistance(vbbSpec, freqHz);

      // Compute tier vertical positions (from top of functional zone downward)
      const usableTopMm = hbbPosition === 'top' ? hbbChamberMm : 100;
      const usableBottomMm = hbbPosition === 'top' ? panelHeightMm - 100 : panelHeightMm - hbbChamberMm;
      let cursorY = usableTopMm;

      const tierResults = (col.tiers || []).map((tier, tIndex) => {
        const tierHeightMm = Math.max(120, Number(tier.heightMm) || 300);
        const yTopMm = cursorY;
        const yCenterMm = cursorY + tierHeightMm / 2;
        cursorY += tierHeightMm;

        // Determine if tier is active in this scenario
        let isActive = false;
        if (tier.status === 'active') isActive = true;
        else if (tier.status === 'future' && includeFuture) isActive = true;
        else if (tier.status === 'standby') isActive = false;

        // Special handling for Interconnector feeder & Spacer/Placeholder bays
        let iOp = 0;
        if (tier.role === 'spacer') {
          isActive = tier.status !== 'standby' && (Number(tier.fixedLossW) || 0) > 0;
          iOp = 0;
        } else if (tier.role === 'interconnector') {
          if (isN1Transfer) {
            isActive = true;
            iOp = Math.max(0, Number(tier.n1TransferCurrentA) || 0);
          } else {
            const normI = Math.max(0, Number(tier.normalTransferCurrentA) || 0);
            isActive = tier.status === 'active' && normI > 0;
            iOp = isActive ? normI : 0;
          }
        } else if (tier.role === 'incomer' || tier.role === 'bus_coupler') {
          // Currents for incomers and bus couplers are solved after summing loads!
          isActive = tier.status !== 'standby';
          iOp = 0;
        } else {
          // Standard outgoing feeder / starter
          iOp = isActive ? calcFeederCurrent(tier, voltageV) : 0;
          if (isActive && tier.status === 'active' && futureGrowthPct > 0 && tier.role === 'feeder') {
            iOp = iOp * (1 + futureGrowthPct);
          }
        }

        const deviceLoss = (tier.role === 'incomer' || tier.role === 'bus_coupler')
          ? null
          : calcDeviceLoss(tier, iOp, voltageV, isActive);

        // Take-off tail + bolted joint loss for outgoing feeders & interconnectors
        // Single-phase (1P) circuits use 2 conductors (1 Phase + 1 Neutral); 3P circuits use 3 phases (+ optional N)
        let takeoffLossW = 0;
        if (isActive && iOp > 0 && tier.role !== 'incomer' && tier.role !== 'bus_coupler' && tier.role !== 'spacer') {
          const takeoffRes = calcBusbarResistance(
            tier.takeoffBusbar || vbbSpec,
            freqHz
          );
          if (tier.phases === '1P' || tier.phases === '2P') {
            const tailLoss = 2 * iOp * iOp * takeoffRes.rAcT * takeoffTailM;
            const jointLoss = 2 * iOp * iOp * jointR_ohm; // 2-wire L+N (1P or 2P DP) joints
            takeoffLossW = tailLoss + jointLoss;
          } else {
            const tailLoss = calcBusbarLossPerMetre(takeoffRes, iOp, poles, neutralRatio).wPerMTotal * takeoffTailM;
            const jointLoss = 3 * iOp * iOp * jointR_ohm; // 1 joint set (3 phases) at dropper tap-off
            takeoffLossW = tailLoss + jointLoss;
          }
        }

        // Optional interconnector cable internal loss
        let cableLoss = { lengthM: 0, wPerM: 0, totalW: 0 };
        if (tier.role === 'interconnector') {
          cableLoss = calcCableLoss(tier.cableSpec, iOp, isActive && iOp > 0);
        }

        return {
          tier,
          tierIndex: tIndex,
          yTopMm,
          yCenterMm,
          heightMm: tierHeightMm,
          distanceFromHbbMm: Math.abs(yCenterMm - hbbCenterYMm),
          isActive,
          iOp,
          deviceLoss,
          takeoffLossW,
          cableLoss,
        };
      });

      // Column net outgoing load current (with board RDF applied to local feeders, NOT interconnector)
      // Single-phase (1P) circuits contribute I_1P / 3 equivalent per-phase current to the 3-phase busbars & incomer (exact kVA conservation)
      let colLocalRawA = 0;
      let colInterconnectorA = 0;
      tierResults.forEach((tr) => {
        if (tr.tier.role === 'feeder' && tr.isActive) {
          colLocalRawA += (tr.tier.phases === '1P' || tr.tier.phases === '2P') ? tr.iOp / 3 : tr.iOp;
        } else if (tr.tier.role === 'interconnector' && tr.isActive) {
          colInterconnectorA += tr.iOp;
        }
      });

      const colLocalDiversifiedA = colLocalRawA * boardRdf;
      const colTotalLoadA = colLocalDiversifiedA + colInterconnectorA;

      // Determine column type
      const hasIncomer = tierResults.some((tr) => tr.tier.role === 'incomer');
      const hasCoupler = tierResults.some((tr) => tr.tier.role === 'bus_coupler');

      return {
        col,
        colIndex,
        widthMm,
        xStartMm,
        xCenterMm,
        xEndMm: cursorX,
        usableTopMm,
        usableBottomMm,
        vbbSpec,
        vbbRes,
        tiers: tierResults,
        colLocalRawA,
        colLocalDiversifiedA,
        colInterconnectorA,
        colTotalLoadA,
        hasIncomer,
        hasCoupler,
        incomerSupplyA: 0, // populated in Step 2
        vbbSegments: [], // populated in Step 3
        vbbTotalLossW: 0,
        vbbTotalLengthM: 0,
        vbbMaxWPerM: 0,
      };
    });

    const totalWidthMm = cursorX;

    // Step 2: Solve Electrical Sections, Incomer Currents & Horizontal Busbar Segment Currents
    // Find bus couplers that are OPEN to split the board into electrical sections
    const openCouplerIndices = [];
    columnResults.forEach((cr, idx) => {
      const couplerTier = cr.tiers.find((t) => t.tier.role === 'bus_coupler');
      if (couplerTier && couplerTier.tier.couplerState === 'open') {
        openCouplerIndices.push(idx);
      }
    });

    // Build contiguous electrical sections
    const sections = [];
    let startIdx = 0;
    openCouplerIndices.forEach((cIdx) => {
      sections.push({ start: startIdx, end: cIdx }); // includes coupler boundary
      startIdx = cIdx + 1;
    });
    if (startIdx < columnResults.length) {
      sections.push({ start: startIdx, end: columnResults.length - 1 });
    }

    // Solve each electrical section: sum all load columns, distribute across active incomer tiers in section
    const hbbSegments = [];
    const warnings = [];
    let totalIncomerCurrentA = 0;

    sections.forEach((sec, secIdx) => {
      const secCols = columnResults.slice(sec.start, sec.end + 1);
      const potentialSecLoadA = secCols.reduce((sum, c) => sum + c.colTotalLoadA, 0);

      // Find all active closed incomer tiers in this electrical section (supports multiple incomers even in same column)
      const activeIncomerTiers = [];
      secCols.forEach((c) => {
        c.tiers.forEach((t) => {
          if (t.tier.role === 'incomer' && t.tier.status !== 'standby' && t.tier.incomerState !== 'open') {
            activeIncomerTiers.push({ colRes: c, tierRes: t });
          } else if (t.tier.role === 'incomer') {
            t.iOp = 0;
            t.isActive = false;
            t.deviceLoss = calcDeviceLoss(t.tier, 0, voltageV, false);
            t.takeoffLossW = 0;
          }
        });
      });

      // If NO active closed incomer feeds this section, the section busbar is de-energised (0 V, 0 A, 0 W)!
      if (activeIncomerTiers.length === 0) {
        if (potentialSecLoadA > 0.1) {
          warnings.push(`Busbar Section ${secIdx + 1} (${secCols[0].col.name} → ${secCols[secCols.length - 1].col.name}) has ${Math.round(potentialSecLoadA)} A of connected load but NO active closed Incomer — section is de-energised (0 A, 0 W).`);
        }
        secCols.forEach((c) => {
          c.colLocalRawA = 0;
          c.colLocalDiversifiedA = 0;
          c.colInterconnectorA = 0;
          c.colTotalLoadA = 0;
          c.incomerSupplyA = 0;
          c.tiers.forEach((t) => {
            if (t.tier.role !== 'spacer') {
              t.isActive = false;
              t.iOp = 0;
              t.deviceLoss = calcDeviceLoss(t.tier, 0, voltageV, false);
              t.takeoffLossW = 0;
              if (t.cableLoss) t.cableLoss = { lengthM: 0, wPerM: 0, totalW: 0 };
            }
          });
        });
      } else {
        const perIncomerA = potentialSecLoadA / activeIncomerTiers.length;
        activeIncomerTiers.forEach(({ colRes, tierRes }) => {
          colRes.incomerSupplyA += perIncomerA;
          totalIncomerCurrentA += perIncomerA;
          tierRes.iOp = perIncomerA;
          tierRes.isActive = true;
          tierRes.deviceLoss = calcDeviceLoss(tierRes.tier, perIncomerA, voltageV, true);
          const riserLenM = Math.max(0.3, Math.abs(tierRes.yCenterMm - hbbCenterYMm) / 1000);
          const riserLoss = calcBusbarLossPerMetre(hbbRes, perIncomerA, poles, neutralRatio).wPerMTotal * riserLenM;
          const jointLoss = 3 * perIncomerA * perIncomerA * jointR_ohm * 2; // breaker terminals + HBB tee
          tierRes.takeoffLossW = riserLoss + jointLoss;
        });
      }

      // Compute Horizontal Busbar current flowing between column i and i+1 inside this section
      // Net current injected into HBB at column k is: (incomerSupplyA - colTotalLoadA)
      // Current flowing right from k to k+1 is running prefix sum!
      let runningCurrentRightA = 0;
      for (let i = sec.start; i <= sec.end; i++) {
        const cr = columnResults[i];
        runningCurrentRightA += cr.incomerSupplyA - cr.colTotalLoadA;

        // If this column is a CLOSED bus coupler, its current is the through-current
        const couplerTier = cr.tiers.find((t) => t.tier.role === 'bus_coupler');
        if (couplerTier) {
          if (couplerTier.tier.couplerState === 'closed') {
            const cCurrent = Math.abs(runningCurrentRightA);
            couplerTier.iOp = cCurrent;
            couplerTier.isActive = true;
            couplerTier.deviceLoss = calcDeviceLoss(couplerTier.tier, cCurrent, voltageV, true);
            couplerTier.takeoffLossW = 3 * cCurrent * cCurrent * jointR_ohm * 2;
          } else {
            couplerTier.iOp = 0;
            couplerTier.isActive = false;
            couplerTier.deviceLoss = calcDeviceLoss(couplerTier.tier, 0, voltageV, false);
            couplerTier.takeoffLossW = 0;
          }
        }

        if (i < sec.end) {
          const nextCr = columnResults[i + 1];
          const segCurrentA = Math.abs(runningCurrentRightA);
          const direction = runningCurrentRightA >= 0 ? 'right' : 'left';
          const lengthMm = nextCr.xCenterMm - cr.xCenterMm;
          const lengthM = lengthMm / 1000;
          const lossInfo = calcBusbarLossPerMetre(hbbRes, segCurrentA, poles, neutralRatio);
          const lossW = lossInfo.wPerMTotal * lengthM;
          const jointLossW = 3 * segCurrentA * segCurrentA * jointR_ohm; // 1 splice joint per panel boundary
          const ratingA = Number(project.mainBusbar.ratedCurrentA) || 2500;

          hbbSegments.push({
            id: `hbb-${i}-${i + 1}`,
            sectionIndex: secIdx,
            fromColIndex: i,
            toColIndex: i + 1,
            fromColName: cr.col.name,
            toColName: nextCr.col.name,
            x1Mm: cr.xCenterMm,
            x2Mm: nextCr.xCenterMm,
            yMm: hbbCenterYMm,
            lengthM,
            currentA: segCurrentA,
            direction,
            utilizationPct: (segCurrentA / ratingA) * 100,
            wPerMPhase: lossInfo.wPerMPhase,
            wPerMTotal: lossInfo.wPerMTotal,
            lossW,
            jointLossW,
            totalSegW: lossW + jointLossW,
          });
        }
      }
    });

    // Step 3: Compute Vertical Dropper Busbar Segments for each column
    // Sort active load tiers in order of distance from HBB (nearest to farthest)
    const allVbbSegments = [];
    columnResults.forEach((cr) => {
      const loadTiers = cr.tiers
        .filter((tr) => tr.tier.role === 'feeder' || tr.tier.role === 'interconnector')
        .sort((a, b) => a.distanceFromHbbMm - b.distanceFromHbbMm);

      if (loadTiers.length === 0) return;

      // Remaining downstream current at each tap-off point (1P circuits contribute I_1P / 3 per phase on 3P VBB)
      const tierEffectiveAmps = loadTiers.map((tr) => {
        if (!tr.isActive) return 0;
        if (tr.tier.role === 'interconnector') return tr.iOp;
        const busEquivA = (tr.tier.phases === '1P' || tr.tier.phases === '2P') ? tr.iOp / 3 : tr.iOp;
        return busEquivA * boardRdf;
      });

      let prevYMm = hbbCenterYMm;
      let colVbbLossW = 0;
      let colVbbLenM = 0;
      let colVbbMaxWPerM = 0;
      const vbbRatingA = Number(cr.vbbSpec.ratedCurrentA) || 800;

      for (let idx = 0; idx < loadTiers.length; idx++) {
        const tr = loadTiers[idx];
        // Current flowing in the vertical segment from prevYMm to tr.yCenterMm
        // equals the sum of currents of tier idx and all tiers further away from HBB
        let segCurrentA = 0;
        for (let k = idx; k < loadTiers.length; k++) {
          segCurrentA += tierEffectiveAmps[k];
        }

        const segLenMm = Math.abs(tr.yCenterMm - prevYMm);
        const segLenM = segLenMm / 1000;
        const lossInfo = calcBusbarLossPerMetre(cr.vbbRes, segCurrentA, poles, neutralRatio);
        const lossW = lossInfo.wPerMTotal * segLenM;

        const vSeg = {
          id: `vbb-${cr.colIndex}-${idx}`,
          colIndex: cr.colIndex,
          colName: cr.col.name,
          fromLabel: idx === 0 ? 'Main HBB' : loadTiers[idx - 1].tier.tag,
          toLabel: tr.tier.tag,
          y1Mm: prevYMm,
          y2Mm: tr.yCenterMm,
          takeoffElevationMm: Math.round(panelHeightMm - tr.yCenterMm), // height from floor
          lengthM: segLenM,
          currentA: segCurrentA,
          utilizationPct: (segCurrentA / vbbRatingA) * 100,
          wPerMPhase: lossInfo.wPerMPhase,
          wPerMTotal: lossInfo.wPerMTotal,
          lossW,
        };

        cr.vbbSegments.push(vSeg);
        allVbbSegments.push(vSeg);
        colVbbLossW += lossW;
        colVbbLenM += segLenM;
        if (lossInfo.wPerMTotal > colVbbMaxWPerM) colVbbMaxWPerM = lossInfo.wPerMTotal;

        prevYMm = tr.yCenterMm;
      }

      cr.vbbTotalLossW = colVbbLossW;
      cr.vbbTotalLengthM = colVbbLenM;
      cr.vbbMaxWPerM = colVbbMaxWPerM;
    });

    // Step 4: Aggregate All Heat Losses
    let totalHbbLossW = 0;
    let totalHbbJointW = 0;
    let totalHbbLenM = 0;
    let maxHbbWPerM = 0;
    let maxHbbCurrentA = 0;
    hbbSegments.forEach((s) => {
      totalHbbLossW += s.lossW;
      totalHbbJointW += s.jointLossW;
      totalHbbLenM += s.lengthM;
      if (s.wPerMTotal > maxHbbWPerM) maxHbbWPerM = s.wPerMTotal;
      if (s.currentA > maxHbbCurrentA) maxHbbCurrentA = s.currentA;
    });

    let totalVbbLossW = 0;
    let totalVbbLenM = 0;
    let maxVbbWPerM = 0;
    allVbbSegments.forEach((s) => {
      totalVbbLossW += s.lossW;
      totalVbbLenM += s.lengthM;
      if (s.wPerMTotal > maxVbbWPerM) maxVbbWPerM = s.wPerMTotal;
    });

    let totalTakeoffAndJointW = totalHbbJointW;
    let totalIncomerDevicesW = 0;
    let totalFeederDevicesW = 0;
    let totalStarterDevicesW = 0;
    let totalInterconnectorDeviceW = 0;
    let totalInterconnectorCableW = 0;
    let totalSpacerAuxW = 0;
    let totalLocalLoadA = 0;
    let totalInterconnectorLoadA = 0;

    // Automated Engineering Rating & Geometry Checks
    hbbSegments.forEach((s) => {
      if (s.utilizationPct > 100.1) {
        warnings.push(`Main HBB span (${s.fromColName} → ${s.toColName}) carries ${Math.round(s.currentA)} A (${s.utilizationPct.toFixed(0)}% of ${project.mainBusbar.ratedCurrentA} A rating).`);
      }
    });
    allVbbSegments.forEach((s) => {
      if (s.utilizationPct > 100.1) {
        warnings.push(`Vertical Busbar in ${s.colName} (${s.fromLabel} → ${s.toLabel}) carries ${Math.round(s.currentA)} A (${s.utilizationPct.toFixed(0)}% of rating).`);
      }
    });

    const deviceRows = [];

    columnResults.forEach((cr) => {
      let colDevicesW = 0;
      let colTakeoffW = 0;
      let colCableW = 0;
      const usableColHeightMm = cr.usableBottomMm - cr.usableTopMm;
      const stackedHeightMm = cr.tiers.reduce((sum, t) => sum + t.heightMm, 0);
      if (stackedHeightMm > usableColHeightMm + 1) {
        warnings.push(`${cr.col.name}: Stacked compartment height (${stackedHeightMm} mm) exceeds usable cubicle zone (${usableColHeightMm} mm).`);
      }

      totalLocalLoadA += cr.colLocalDiversifiedA;
      totalInterconnectorLoadA += cr.colInterconnectorA;

      cr.tiers.forEach((tr) => {
        const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;
        colDevicesW += devW;
        colTakeoffW += tr.takeoffLossW || 0;
        colCableW += tr.cableLoss ? tr.cableLoss.totalW : 0;
        totalTakeoffAndJointW += tr.takeoffLossW || 0;

        if (tr.isActive && tr.tier.role !== 'spacer' && tr.iOp > (Number(tr.tier.ratedCurrentA) || 1) * 1.002) {
          warnings.push(`${tr.tier.tag} (${cr.col.name}): Operating current ${tr.iOp.toFixed(0)} A exceeds device rating ${tr.tier.ratedCurrentA} A.`);
        }

        if (tr.tier.role === 'spacer') {
          totalSpacerAuxW += devW;
        } else if (tr.tier.role === 'incomer' || tr.tier.role === 'bus_coupler') {
          totalIncomerDevicesW += devW;
        } else if (tr.tier.role === 'interconnector') {
          totalInterconnectorDeviceW += devW;
          totalInterconnectorCableW += tr.cableLoss ? tr.cableLoss.totalW : 0;
        } else if (
          tr.tier.category === 'DOL Starter' ||
          tr.tier.category === 'Star-Delta Starter' ||
          tr.tier.category === 'Soft Starter' ||
          tr.tier.category === 'VSD / Inverter'
        ) {
          totalStarterDevicesW += devW;
        } else {
          totalFeederDevicesW += devW;
        }

        deviceRows.push({
          colIndex: cr.colIndex,
          colName: cr.col.name,
          tierIndex: tr.tierIndex,
          tierId: tr.tier.id,
          tag: tr.tier.tag,
          description: tr.tier.description,
          role: tr.tier.role,
          category: tr.tier.category,
          status: tr.tier.status,
          isActive: tr.isActive,
          ratedCurrentA: tr.tier.ratedCurrentA,
          iOp: tr.iOp,
          loadRatio: tr.deviceLoss ? tr.deviceLoss.loadRatio : 0,
          ratedLossW: tr.tier.subComponents
            ? tr.tier.subComponents.reduce((a, b) => a + (Number(b.ratedLossW) || 0), 0)
            : Number(tr.tier.ratedLossW) || 0,
          fixedLossW: tr.deviceLoss ? tr.deviceLoss.pFixedW : 0,
          varLossW: tr.deviceLoss ? tr.deviceLoss.pVarW : 0,
          deviceLossW: devW,
          takeoffLossW: tr.takeoffLossW || 0,
          cableLossW: tr.cableLoss ? tr.cableLoss.totalW : 0,
          totalRowW: devW + (tr.takeoffLossW || 0) + (tr.cableLoss ? tr.cableLoss.totalW : 0),
          takeoffElevationMm: Math.round(panelHeightMm - tr.yCenterMm),
          breakdown: tr.deviceLoss ? tr.deviceLoss.breakdown : [],
        });
      });

      cr.colDevicesW = colDevicesW;
      cr.colTakeoffW = colTakeoffW;
      cr.colCableW = colCableW;
      cr.colTotalLossW = colDevicesW + colTakeoffW + colCableW + cr.vbbTotalLossW;
    });

    const totalAuxW = Math.max(0, Number(cfg.auxiliaryLossesW) || 0) + totalSpacerAuxW; // metering, panel lights, PLC, reserve aux chambers
    const totalBusbarW = totalHbbLossW + totalVbbLossW + totalTakeoffAndJointW;
    const totalDevicesW =
      totalIncomerDevicesW + totalFeederDevicesW + totalStarterDevicesW + totalInterconnectorDeviceW;
    const grandTotalW = totalBusbarW + totalDevicesW + totalInterconnectorCableW + totalAuxW;
    const grandTotalKW = grandTotalW / 1000;

    // Enclosure surface area estimate (IEC 60890 simplified effective cooling area for freestanding front/back/top/ends)
    const widthM = totalWidthMm / 1000;
    const heightM = panelHeightMm / 1000;
    const depthM = (Number(cfg.panelDepthMm) || 800) / 1000;
    // IEC 60890 Table 1 approximate effective cooling surface Ae (wall-mounted vs freestanding)
    const installationType = cfg.installationType || 'freestanding';
    let effectiveAreaM2 = 0;
    if (installationType === 'wall_backed') {
      // Front (0.9) + Top (1.4) + 2 Sides (0.9 each)
      effectiveAreaM2 = 0.9 * (widthM * heightM) + 1.4 * (widthM * depthM) + 2 * 0.9 * (depthM * heightM);
    } else {
      // Freestanding: Front (0.9) + Rear (0.9) + Top (1.4) + 2 Sides (0.9 each)
      effectiveAreaM2 = 2 * 0.9 * (widthM * heightM) + 1.4 * (widthM * depthM) + 2 * 0.9 * (depthM * heightM);
    }
    const heatFluxWPerM2 = effectiveAreaM2 > 0 ? grandTotalW / effectiveAreaM2 : 0;

    // HVAC equivalent
    const btuPerHr = grandTotalW * 3.41214;
    const hvacMarginPct = Number(cfg.hvacSafetyMarginPct != null ? cfg.hvacSafetyMarginPct : 15);
    const recommendedCoolingKW = grandTotalKW * (1 + hvacMarginPct / 100);

    // Reference rated-current W/m for main busbar
    const hbbRatedLoss = calcBusbarLossPerMetre(hbbRes, project.mainBusbar.ratedCurrentA, poles, neutralRatio);

    return {
      scenario,
      includeFuture,
      isN1Transfer,
      totalWidthMm,
      panelHeightMm,
      hbbCenterYMm,
      hbbChamberMm,
      hbbPosition,
      hbbRes,
      hbbRatedWPerM: hbbRatedLoss.wPerMTotal,
      hbbSegments,
      vbbSegments: allVbbSegments,
      columns: columnResults,
      deviceRows,
      warnings,
      totals: {
        totalIncomerCurrentA,
        totalLocalLoadA,
        totalInterconnectorLoadA,
        totalHbbLossW,
        totalHbbLenM,
        maxHbbWPerM,
        maxHbbCurrentA,
        totalVbbLossW,
        totalVbbLenM,
        maxVbbWPerM,
        totalTakeoffAndJointW,
        totalBusbarW,
        totalIncomerDevicesW,
        totalFeederDevicesW,
        totalStarterDevicesW,
        totalInterconnectorDeviceW,
        totalInterconnectorCableW,
        totalDevicesW,
        totalAuxW,
        grandTotalW,
        grandTotalKW,
        btuPerHr,
        recommendedCoolingKW,
        effectiveAreaM2,
        heatFluxWPerM2,
      },
    };
  }

  /**
   * Evaluate all 4 operating scenarios for comparison
   */
  function evaluateAllScenarios(project) {
    const scenarios = [
      { id: 'normal', label: 'Normal (N)', subtitle: 'Local active loads only' },
      { id: 'n1_transfer', label: 'N-1 Firm Transfer', subtitle: 'Supplying B-Side via interconnector' },
      { id: 'normal_future', label: 'Normal + Future', subtitle: 'Includes future/spare loads & growth' },
      { id: 'worst_case', label: 'Worst-Case (N-1 + Future)', subtitle: 'Full transfer + future capacity' },
    ];
    return scenarios.map((sc) => ({
      ...sc,
      result: evaluateSwitchgear(project, sc.id),
    }));
  }

  /**
   * Switchroom Cooling, Airflow, Air Change Rate (ACH) & Natural vs Mechanical Ventilation Engine
   * Basis: Sensible heat balance Q = V_dot * rho * cp * dT and CIBSE Guide A / AM10 stack buoyancy.
   */
  function calcRoomVentilation(room, switchgearKW, hvacMarginPct) {
    const L = Math.max(1, Number(room.lengthM) || 5);
    const W = Math.max(1, Number(room.widthM) || 5);
    const H = Math.max(2, Number(room.heightM) || 9);
    const volumeM3 = L * W * H;
    const floorAreaM2 = L * W;

    const tAmb = Number(room.ambientTempC != null ? room.ambientTempC : 25);
    const tMax = Number(room.maxRoomTempC != null ? room.maxRoomTempC : 35);
    const deltaT = tMax - tAmb;

    const otherHeatKW = Math.max(0, Number(room.otherRoomHeatKW) || 0);
    const marginPct = Math.max(0, Number(hvacMarginPct != null ? hvacMarginPct : 15));
    const useOverride = Boolean(room.useOverrideHeatKW);
    const baseSwgKW = useOverride ? Math.max(0, Number(room.overrideHeatKW) || 0) : Math.max(0, Number(switchgearKW) || 0);
    const designHeatKW = baseSwgKW * (1 + marginPct / 100) + otherHeatKW;
    const designHeatW = designHeatKW * 1000;
    const designBtuHr = designHeatW * 3.41214;

    // Air properties at average room temperature
    const tAvgC = (tAmb + Math.max(tAmb + 1, tMax)) / 2;
    const rhoAir = 353 / (tAvgC + 273.15); // kg/m³ (~1.16–1.20 kg/m³)
    const cpAir = 1.005; // kJ/(kg·K)
    const rhoCp = rhoAir * cpAir; // kJ/(m³·K)

    // Required airflow (only valid when deltaT > 0)
    const canVentilate = deltaT > 0.5;
    const reqFlowM3s = canVentilate ? designHeatKW / (rhoCp * deltaT) : 0;
    const reqFlowLs = reqFlowM3s * 1000;
    const reqFlowM3h = reqFlowM3s * 3600;
    const reqFlowCfm = reqFlowM3h * 0.58858;
    const ach = volumeM3 > 0 ? reqFlowM3h / volumeM3 : 0;

    // Natural Stack-Effect Buoyancy Ventilation (CIBSE Guide A / AM10)
    // Equal low-level inlet and high-level exhaust louvers of free area A_louver each:
    // Effective combined area A_eff = A_louver / sqrt(2), discharge coeff Cd = 0.60
    const louverAreaM2 = Math.max(0.05, Number(room.louverFreeAreaM2) || 0.5);
    const stackHeightM = Math.max(0.5, Math.min(H, Number(room.stackHeightM) || Math.max(1.5, H - 1.5)));
    const cd = Math.min(0.8, Math.max(0.3, Number(room.dischargeCoeff) || 0.6));
    const g = 9.81;
    const aEff = louverAreaM2 / Math.SQRT2;

    const natFlowM3s =
      canVentilate
        ? cd * aEff * Math.sqrt((2 * g * stackHeightM * deltaT) / (tAmb + 273.15))
        : 0;
    const natFlowLs = natFlowM3s * 1000;
    const natFlowM3h = natFlowM3s * 3600;
    const natAch = volumeM3 > 0 ? natFlowM3h / volumeM3 : 0;
    const natCapacityKW = canVentilate ? natFlowM3s * rhoCp * deltaT : 0;

    // Required louver free area (each: inlet & exhaust) to achieve natural ventilation alone
    const reqLouverAreaM2 =
      canVentilate && stackHeightM > 0
        ? (reqFlowM3s * Math.SQRT2) / (cd * Math.sqrt((2 * g * stackHeightM * deltaT) / (tAmb + 273.15)))
        : 999;

    // Resulting steady-state room temperature under natural ventilation alone:
    // Q = Cd * A_eff * rhoCp * sqrt(2*g*H/(Tamb+273.15)) * dT^(3/2)  =>  dT_nat = (Q / K)^(2/3)
    const kNat = cd * aEff * rhoCp * Math.sqrt((2 * g * stackHeightM) / (tAmb + 273.15));
    const estNatDeltaT = kNat > 0 && designHeatKW > 0 ? Math.pow(designHeatKW / kNat, 2 / 3) : 0;
    const estNatRoomTempC = tAmb + estNatDeltaT;

    // Engineering Verdict: Natural vs Mechanical Ventilation vs Active Cooling (AC)
    let verdictCode = 'natural';
    let verdictTitle = 'Natural Ventilation Sufficient';
    let verdictColor = '#22c55e';
    let verdictDetail = '';

    if (deltaT <= 2.0) {
      verdictCode = 'active_ac';
      verdictTitle = 'Active Cooling (Air Conditioning / Chilled Water) Required';
      verdictColor = '#ef4444';
      verdictDetail = `Allowable temperature rise ΔT = ${deltaT.toFixed(1)} K is too narrow (ambient ${tAmb}°C vs max ${tMax}°C). Outside-air ventilation alone cannot cool the room; install DX air conditioning or chilled-water cooling sized for ≥ ${designHeatKW.toFixed(2)} kW sensible heat.`;
    } else if (natFlowM3s >= reqFlowM3s && ach <= 6.0) {
      verdictCode = 'natural';
      verdictTitle = 'Natural Ventilation Sufficient';
      verdictColor = '#22c55e';
      verdictDetail = `Stack-effect buoyancy through ${louverAreaM2.toFixed(2)} m² low/high louvers provides ${natFlowM3h.toFixed(0)} m³/h (${natCapacityKW.toFixed(2)} kW capacity), exceeding the ${reqFlowM3h.toFixed(0)} m³/h (${ach.toFixed(1)} ACH) needed to hold room temperature ≤ ${tMax}°C (est. ${estNatRoomTempC.toFixed(1)}°C).`;
    } else if (ach <= 20.0 && deltaT >= 5.0) {
      verdictCode = 'mechanical';
      verdictTitle = 'Mechanical Ventilation (Forced Extract / Supply Fans) Required';
      verdictColor = '#f59e0b';
      verdictDetail = `Natural ventilation capacity (${natCapacityKW.toFixed(2)} kW, est. room temp ${estNatRoomTempC.toFixed(1)}°C) is below the ${designHeatKW.toFixed(2)} kW heat load. Provide duty/standby mechanical ventilation fans rated for ${reqFlowLs.toFixed(0)} L/s (${reqFlowM3h.toFixed(0)} m³/h · ${ach.toFixed(1)} ACH)${ach > 12 ? ' — note >12 ACH may warrant noise/filtration checks or Active DX cooling.' : '.'}`;
    } else {
      verdictCode = 'active_ac';
      verdictTitle = 'Active Cooling (Air Conditioning) Recommended';
      verdictColor = '#ef4444';
      verdictDetail = `Required air change rate (${ach.toFixed(1)} ACH / ${reqFlowM3h.toFixed(0)} m³/h) or narrow ΔT (${deltaT.toFixed(1)} K) makes fresh-air mechanical ventilation impractical. Install active DX/chilled-water cooling rated for ≥ ${designHeatKW.toFixed(2)} kW sensible cooling.`;
    }

    return {
      L, W, H,
      volumeM3,
      floorAreaM2,
      tAmb,
      tMax,
      deltaT,
      baseSwgKW,
      useOverride,
      otherHeatKW,
      marginPct,
      designHeatKW,
      designHeatW,
      designBtuHr,
      heatDensityFloorWm2: floorAreaM2 > 0 ? designHeatW / floorAreaM2 : 0,
      heatDensityVolWm3: volumeM3 > 0 ? designHeatW / volumeM3 : 0,
      rhoAir,
      cpAir,
      rhoCp,
      reqFlowM3s,
      reqFlowLs,
      reqFlowM3h,
      reqFlowCfm,
      ach,
      louverAreaM2,
      stackHeightM,
      cd,
      natFlowM3s,
      natFlowLs,
      natFlowM3h,
      natAch,
      natCapacityKW,
      reqLouverAreaM2,
      estNatRoomTempC,
      verdictCode,
      verdictTitle,
      verdictColor,
      verdictDetail,
    };
  }

  /**
   * Rapid Crude Assessment Engine for Simple Mode
   * Uses a handful of high-level entries and produces live 4-scenario kW estimates
   * consistent with the Detailed Mode physics.
   */
  function evaluateSimpleMode(project) {
    const sm = project.simpleMode;
    const cfg = project.config;
    const presets = window.SGCatalog.BUSBAR_PRESETS;
    const bbPreset = presets.find((p) => p.id === sm.busbarPresetId) || presets[3]; // default 1600A 2x75x6

    const hbbSpec = {
      material: sm.material || 'cu_100',
      barsPerPhase: bbPreset.barsPerPhase,
      widthMm: bbPreset.widthMm,
      thicknessMm: bbPreset.thicknessMm,
      gapMm: bbPreset.gapMm,
      phaseSpacingMm: bbPreset.phaseSpacingMm,
      orientation: 'edge',
      operatingTempC: Number(sm.busbarTempC || 70),
      acFactorMode: 'manual',
      manualSFactor: Number(sm.manualSFactor || 1.2),
      enclosureEddyFactor: 0.02,
      neutralSizeRatio: 0.5,
      ratedCurrentA: bbPreset.ratedCurrentA,
    };
    const hbbRes = calcBusbarResistance(hbbSpec, cfg.frequencyHz || 50);

    const vbbPreset = presets.find((p) => p.id === 'bb-v800') || presets[0];
    const vbbSpec = {
      material: sm.material || 'cu_100',
      barsPerPhase: vbbPreset.barsPerPhase,
      widthMm: vbbPreset.widthMm,
      thicknessMm: vbbPreset.thicknessMm,
      gapMm: vbbPreset.gapMm,
      phaseSpacingMm: vbbPreset.phaseSpacingMm,
      orientation: 'edge',
      operatingTempC: Number(sm.busbarTempC || 70),
      acFactorMode: 'manual',
      manualSFactor: 1.15,
      enclosureEddyFactor: 0.02,
      neutralSizeRatio: 0.5,
      ratedCurrentA: 800,
    };
    const vbbRes = calcBusbarResistance(vbbSpec, cfg.frequencyHz || 50);

    const V = Number(cfg.voltageV || 400);
    const rdf = Math.min(1, Math.max(0.3, Number(sm.rdf != null ? sm.rdf : 0.9)));
    const futurePct = Math.max(0, Number(sm.futureGrowthPct || 0)) / 100;
    const loadPct = Math.min(1.0, Math.max(0.1, Number(sm.avgLoadPct || 75) / 100));

    // Look up representative starter / VSD / feeder templates from catalog
    const lib = project.deviceLibrary || window.SGCatalog.DEFAULT_DEVICE_TEMPLATES;
    const findTpl = (id) => lib.find((t) => t.id === id) || lib[0];

    // --- NEW: Tier-by-Tier Simple Mode (Rules-of-Thumb Board Assessment + Live SLD/GA!) ---
    if (sm.inputStyle !== 'counts' && Array.isArray(sm.tierGrid) && sm.tierGrid.length > 0) {
      const nRows = Math.max(1, Math.min(8, Number(sm.tierRows) || 6));
      let fCount = 1;
      let incCount = 1;
      const tempCols = sm.tierGrid.map((gCol, cIdx) => {
        const tiers = [];
        let hasIc = false;
        let hasFeeder = false;
        for (let tIdx = 0; tIdx < nRows; tIdx++) {
          const tplId = (gCol.tiers && gCol.tiers[tIdx]) || '';
          if (!tplId) continue;
          const tpl = lib.find((t) => t.id === tplId);
          if (!tpl) continue;
          const isInc = tpl.role === 'incomer';
          const isIc = tpl.role === 'interconnector';
          const isCpl = tpl.role === 'bus_coupler';
          const isSp = tpl.role === 'spacer';
          if (isIc) hasIc = true;
          if (tpl.role === 'feeder') hasFeeder = true;
          const tag = isInc
            ? `INC-${String.fromCharCode(64 + incCount++)}`
            : isIc
            ? 'IC-AB'
            : isCpl
            ? 'BC-1'
            : isSp
            ? `SP-${cIdx + 1}0${tIdx + 1}`
            : tpl.category === 'VSD / Inverter'
            ? `VSD-${(cIdx + 1) * 100 + tIdx + 1}`
            : tpl.defaultKw
            ? `M-${(cIdx + 1) * 100 + tIdx + 1}`
            : `F-${(cIdx + 1) * 100 + fCount++}`;

          const cellPhase = (gCol.phases && gCol.phases[tIdx]) || tpl.phases || '3P';
          const rawLoad = gCol.loads && gCol.loads[tIdx];
          const hasManualAmps = !isInc && !isIc && !isCpl && !isSp && rawLoad !== '' && rawLoad != null && Number.isFinite(Number(rawLoad));

          tiers.push({
            id: `sm-${cIdx}-${tIdx}`,
            gridCol: cIdx,
            gridTier: tIdx,
            templateId: tpl.id,
            tag,
            description: tpl.name,
            role: tpl.role || 'feeder',
            category: tpl.category,
            frameSize: tpl.frameSize || tpl.modelSeries || '',
            status: 'active',
            heightMm: tpl.defaultHeightMm || 250,
            ratedCurrentA: tpl.ratedCurrentA,
            ratedLossW: tpl.ratedLossW,
            fixedLossW: tpl.fixedLossW || 0,
            subComponents: tpl.subComponents ? JSON.parse(JSON.stringify(tpl.subComponents)) : null,
            phases: cellPhase,
            templatePoles: tpl.phases === '1P' ? 1 : tpl.phases === '2P' ? 2 : 3,
            loadInputMode: hasManualAmps ? 'amps' : (tpl.defaultKw ? 'kw' : 'amps'),
            loadKw: tpl.defaultKw || 0,
            operatingCurrentA: hasManualAmps ? Math.max(0, Number(rawLoad)) : Math.round(tpl.ratedCurrentA * loadPct),
            powerFactor: tpl.category === 'VSD / Inverter' ? 0.95 : 0.86,
            efficiency: tpl.category === 'VSD / Inverter' ? 0.94 : 0.93,
            loadFactor: hasManualAmps ? 1.0 : (tpl.defaultKw ? loadPct : 1.0),
            incomerState: 'closed',
            couplerState: 'open',
            normalTransferCurrentA: 0,
            n1TransferCurrentA: Math.max(0, Number(sm.n1TransferA) || 0),
            remoteBoardName: 'MSB-B (Firm Supply)',
            cableSpec: { includeCableLoss: true, material: 'cu_100', cablesPerPhase: 3, csaMm2: 240, internalLengthM: 2.5, operatingTempC: 70 },
          });
        }
        return {
          id: `sm-col-${cIdx}`,
          name: gCol.name || `COL-0${cIdx + 1}`,
          widthMm: 800,
          verticalBusbar: hasIc ? Object.assign({}, hbbSpec, { label: 'Interconnector Riser' }) : hasFeeder ? Object.assign({}, vbbSpec) : null,
          tiers,
        };
      });

      const tempProject = {
        meta: project.meta || { projectName: 'Simple Mode Switchboard', projectNumber: 'SM-001' },
        activeScenario: project.activeScenario || 'normal',
        config: Object.assign({}, cfg, {
          diversityFactorRDF: rdf,
          globalFutureGrowthPct: futurePct * 100,
        }),
        mainBusbar: hbbSpec,
        defaultVerticalBusbar: vbbSpec,
        columns: tempCols,
      };

      function mapEvalToSimple(ev) {
        const t = ev.totals;
        let vsdLoss = 0, dolLoss = 0, fdrLoss = 0, incLoss = 0, icLoss = 0;
        ev.columns.forEach((cr) => {
          cr.tiers.forEach((tr) => {
            const w = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;
            if (tr.tier.role === 'incomer') incLoss += w;
            else if (tr.tier.role === 'interconnector') icLoss += w;
            else if (tr.tier.category === 'VSD / Inverter') vsdLoss += w;
            else if (tr.tier.category && tr.tier.category.includes('Starter')) dolLoss += w;
            else fdrLoss += w;
          });
        });
        return {
          totalBoardA: t.totalIncomerCurrentA,
          localDivA: Math.max(0, t.totalIncomerCurrentA - (ev.isN1Transfer ? Number(sm.n1TransferA || 0) : 0)),
          icA: ev.isN1Transfer ? Number(sm.n1TransferA || 0) : 0,
          hbbPeakWPerM: t.maxHbbWPerM,
          busbarW: t.totalBusbarW,
          hbbLossW: t.totalHbbLossW || 0,
          vbbLossW: t.totalVbbLossW || 0,
          jointsW: t.totalTakeoffAndJointW || 0,
          devicesW: t.totalDevicesW,
          dolLoss,
          vsdLoss,
          fdrLoss,
          incLoss,
          icLoss,
          icCableW: t.totalInterconnCableW,
          auxW: t.totalAuxW,
          totalW: t.grandTotalW,
          totalKW: t.grandTotalKW,
          evalRes: ev,
        };
      }

      const evNormal = evaluateSwitchgear(tempProject, 'normal');
      const evN1 = evaluateSwitchgear(tempProject, 'n1_transfer');
      const evFut = evaluateSwitchgear(tempProject, 'normal_future');
      const evWorst = evaluateSwitchgear(tempProject, 'worst_case');

      const scenarios = {
        normal: mapEvalToSimple(evNormal),
        n1_transfer: mapEvalToSimple(evN1),
        normal_future: mapEvalToSimple(evFut),
        worst_case: mapEvalToSimple(evWorst),
      };
      const active = scenarios[project.activeScenario] || scenarios.normal;

      // Map (col, tier) -> live { iOp, totalW } for instant cell badges
      const cellMap = {};
      active.evalRes.columns.forEach((cr) => {
        cr.tiers.forEach((tr) => {
          const w = (tr.deviceLoss ? tr.deviceLoss.pTotalW : 0) + (tr.takeoffLossW || 0) + (tr.cableLoss ? tr.cableLoss.totalW : 0);
          cellMap[`${tr.tier.gridCol}:${tr.tier.gridTier}`] = { iOp: tr.iOp, totalW: w, isActive: tr.isActive };
        });
      });

      return {
        bbPreset,
        hbbRes,
        boardLenM: Math.max(1.2, tempCols.length * 0.8),
        scenarios,
        active,
        tempProject,
        activeEvalRes: active.evalRes,
        cellMap,
      };
    }

    const dolTpl = findTpl(sm.dolTemplateId || 'dol-37kw');
    const vsdTpl = findTpl(sm.vsdTemplateId || 'vsd-45kw');
    const fdrTpl = findTpl(sm.feederTemplateId || 'mccb-250');
    const incTpl = findTpl(bbPreset.ratedCurrentA >= 2500 ? 'acb-2500' : bbPreset.ratedCurrentA >= 1600 ? 'acb-1600' : 'acb-1250');
    const icTpl  = findTpl(bbPreset.ratedCurrentA <= 1250 ? 'interconn-1250' : 'interconn-1600');

    const nDol = Math.max(0, parseInt(sm.dolCount, 10) || 0);
    const nVsd = Math.max(0, parseInt(sm.vsdCount, 10) || 0);
    const nFdr = Math.max(0, parseInt(sm.feederCount, 10) || 0);
    const hasInterconn = sm.topology === 'single_interconn' || sm.topology === 'dual_coupler_interconn';
    const nIncomers = sm.topology === 'dual_coupler' || sm.topology === 'dual_coupler_interconn' ? 2 : 1;
    const n1TransferA = hasInterconn ? Math.max(0, Number(sm.n1TransferA) || 0) : 0;

    // Per-unit operating currents
    const iDolBase = dolTpl.defaultKw
      ? ((dolTpl.defaultKw * 1000) / (Math.sqrt(3) * V * 0.86 * 0.93)) * loadPct
      : dolTpl.ratedCurrentA * loadPct;
    const iVsdBase = vsdTpl.defaultKw
      ? ((vsdTpl.defaultKw * 1000) / (Math.sqrt(3) * V * 0.95 * 0.94)) * loadPct
      : vsdTpl.ratedCurrentA * loadPct;
    const iFdrBase = fdrTpl.ratedCurrentA * loadPct;

    const boardLenM = Math.max(1.2, (Number(sm.columnCount) || 5) * 0.78);
    const vbbLenTotalM = Math.max(1.0, ((Number(sm.columnCount) || 5) - nIncomers) * 1.35);

    function solveOne(includeFuture, isN1) {
      const mul = includeFuture ? 1 + futurePct : 1;
      const iDol = iDolBase * mul;
      const iVsd = iVsdBase * mul;
      const iFdr = iFdrBase * mul;

      const dolLoss = calcDeviceLoss(dolTpl, iDol, V, nDol > 0).pTotalW * nDol;
      const vsdLoss = calcDeviceLoss(vsdTpl, iVsd, V, nVsd > 0).pTotalW * nVsd;
      const fdrLoss = calcDeviceLoss(fdrTpl, iFdr, V, nFdr > 0).pTotalW * nFdr;

      const localDivA = (nDol * iDol + nVsd * iVsd + nFdr * iFdr) * rdf;
      const icA = isN1 ? n1TransferA : 0;
      const totalBoardA = localDivA + icA;
      const perIncA = totalBoardA / nIncomers;

      const incLoss = calcDeviceLoss(incTpl, perIncA, V, true).pTotalW * nIncomers;
      const icLoss = icA > 0 ? calcDeviceLoss(icTpl, icA, V, true).pTotalW : 0;

      // Tapered effective HBB current: local loads taper linearly (~1/sqrt(3) RMS average along board)
      // while N-1 interconnector carries full icA across the board length!
      const hbbRmsA = Math.sqrt((localDivA * localDivA) / 3 + icA * icA + localDivA * icA);
      const hbbLossW = calcBusbarLossPerMetre(hbbRes, hbbRmsA, cfg.poles || '3P+N', cfg.neutralCurrentRatio || 0.1).wPerMTotal * boardLenM;
      const hbbPeakWPerM = calcBusbarLossPerMetre(hbbRes, totalBoardA, cfg.poles || '3P+N', cfg.neutralCurrentRatio || 0.1).wPerMTotal;

      // Tapering VBB loss across load columns
      const loadCols = Math.max(1, (Number(sm.columnCount) || 5) - nIncomers);
      const avgColA = localDivA / loadCols;
      const vbbLossW = calcBusbarLossPerMetre(vbbRes, avgColA * 0.65, cfg.poles || '3P+N', cfg.neutralCurrentRatio || 0.1).wPerMTotal * vbbLenTotalM;

      // Bolted joints + take-off tails + optional interconnector cable allowance
      const jointR = (Number(cfg.jointResistanceUOhm != null ? cfg.jointResistanceUOhm : 5)) * 1e-6;
      const jointsW = 3 * (hbbRmsA * hbbRmsA) * jointR * Math.max(1, (Number(sm.columnCount) || 5) - 1) + 6 * (perIncA * perIncA) * jointR * nIncomers;
      const icCableW = icA > 0 ? 3 * icA * icA * (0.017241 * 1.1965 / (3 * 240)) * 1.05 * 2.5 : 0;
      const auxW = Number(cfg.auxiliaryLossesW || 120);

      const busbarW = hbbLossW + vbbLossW + jointsW;
      const devicesW = dolLoss + vsdLoss + fdrLoss + incLoss + icLoss;
      const totalW = busbarW + devicesW + icCableW + auxW;

      return {
        totalBoardA,
        localDivA,
        icA,
        hbbPeakWPerM,
        busbarW,
        hbbLossW,
        vbbLossW,
        jointsW,
        devicesW,
        dolLoss,
        vsdLoss,
        fdrLoss,
        incLoss,
        icLoss,
        icCableW,
        auxW,
        totalW,
        totalKW: totalW / 1000,
      };
    }

    const scenarios = {
      normal: solveOne(false, false),
      n1_transfer: solveOne(false, true),
      normal_future: solveOne(true, false),
      worst_case: solveOne(true, true),
    };
    const active = scenarios[project.activeScenario] || scenarios.normal;

    return {
      bbPreset,
      hbbRes,
      boardLenM,
      scenarios,
      active,
    };
  }

  return {
    MATERIALS,
    calcBusbarResistance,
    calcBusbarLossPerMetre,
    calcFeederCurrent,
    calcDeviceLoss,
    calcCableLoss,
    calcRoomVentilation,
    evaluateSimpleMode,
    evaluateSwitchgear,
    evaluateAllScenarios,
  };
})();
