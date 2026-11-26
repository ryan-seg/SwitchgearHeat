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
      if (tier.phases === '1P') {
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
          variable = Math.max(0, Number(sc.ratedLossW) || 0) * rSq;
        } else {
          // Standard Joule scaling (IEC TR 60890): P = P_n * (I_op / I_n)^2
          variable = Math.max(0, Number(sc.ratedLossW) || 0) * rSq;
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
        pVarW = Math.max(0, Number(device.ratedLossW) || 0) * loadRatioSq;
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

        // Special handling for Interconnector feeder
        let iOp = 0;
        if (tier.role === 'interconnector') {
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
        let takeoffLossW = 0;
        if (isActive && iOp > 0 && tier.role !== 'incomer' && tier.role !== 'bus_coupler') {
          // Take-off links sized roughly to column vertical busbar or feeder rating
          const takeoffRes = calcBusbarResistance(
            tier.takeoffBusbar || vbbSpec,
            freqHz
          );
          const tailLoss = calcBusbarLossPerMetre(takeoffRes, iOp, poles, neutralRatio).wPerMTotal * takeoffTailM;
          const jointLoss = 3 * iOp * iOp * jointR_ohm; // 1 joint set (3 phases) at dropper tap-off
          takeoffLossW = tailLoss + jointLoss;
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
      let colLocalRawA = 0;
      let colInterconnectorA = 0;
      tierResults.forEach((tr) => {
        if (tr.tier.role === 'feeder' && tr.isActive) {
          colLocalRawA += tr.iOp;
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

    // Solve each electrical section: sum all load columns, distribute across active incomers in section
    const hbbSegments = [];
    let totalIncomerCurrentA = 0;

    sections.forEach((sec, secIdx) => {
      const secCols = columnResults.slice(sec.start, sec.end + 1);
      const totalSecLoadA = secCols.reduce((sum, c) => sum + c.colTotalLoadA, 0);

      // Find active incomers in this section
      const activeIncomerCols = secCols.filter((c) =>
        c.tiers.some((t) => t.tier.role === 'incomer' && t.tier.status !== 'standby' && t.tier.incomerState !== 'open')
      );

      // Distribute load equally among active incomers in the section
      if (activeIncomerCols.length > 0) {
        const perIncomerA = totalSecLoadA / activeIncomerCols.length;
        activeIncomerCols.forEach((ic) => {
          ic.incomerSupplyA = perIncomerA;
          totalIncomerCurrentA += perIncomerA;
          ic.tiers.forEach((t) => {
            if (t.tier.role === 'incomer' && t.tier.status !== 'standby' && t.tier.incomerState !== 'open') {
              t.iOp = perIncomerA;
              t.isActive = true;
              t.deviceLoss = calcDeviceLoss(t.tier, perIncomerA, voltageV, true);
              // Incomer riser connection & joint loss
              const riserLenM = Math.max(0.3, Math.abs(t.yCenterMm - hbbCenterYMm) / 1000);
              const riserLoss = calcBusbarLossPerMetre(hbbRes, perIncomerA, poles, neutralRatio).wPerMTotal * riserLenM;
              const jointLoss = 3 * perIncomerA * perIncomerA * jointR_ohm * 2; // breaker terminals + HBB tee
              t.takeoffLossW = riserLoss + jointLoss;
            } else if (t.tier.role === 'incomer') {
              t.iOp = 0;
              t.isActive = false;
              t.deviceLoss = calcDeviceLoss(t.tier, 0, voltageV, false);
              t.takeoffLossW = 0;
            }
          });
        });
      } else {
        // Still initialize inactive incomer device losses to 0
        secCols.forEach((c) => {
          c.tiers.forEach((t) => {
            if (t.tier.role === 'incomer') {
              t.iOp = 0;
              t.isActive = false;
              t.deviceLoss = calcDeviceLoss(t.tier, 0, voltageV, false);
            }
          });
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

      // Remaining downstream current at each tap-off point
      const tierEffectiveAmps = loadTiers.map((tr) => {
        if (!tr.isActive) return 0;
        return tr.tier.role === 'interconnector' ? tr.iOp : tr.iOp * boardRdf;
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
    let totalLocalLoadA = 0;
    let totalInterconnectorLoadA = 0;

    const deviceRows = [];

    columnResults.forEach((cr) => {
      let colDevicesW = 0;
      let colTakeoffW = 0;
      let colCableW = 0;

      totalLocalLoadA += cr.colLocalDiversifiedA;
      totalInterconnectorLoadA += cr.colInterconnectorA;

      cr.tiers.forEach((tr) => {
        const devW = tr.deviceLoss ? tr.deviceLoss.pTotalW : 0;
        colDevicesW += devW;
        colTakeoffW += tr.takeoffLossW || 0;
        colCableW += tr.cableLoss ? tr.cableLoss.totalW : 0;
        totalTakeoffAndJointW += tr.takeoffLossW || 0;

        if (tr.tier.role === 'incomer' || tr.tier.role === 'bus_coupler') {
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

    const totalAuxW = Math.max(0, Number(cfg.auxiliaryLossesW) || 0); // metering, panel lights, PLC, fans
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

  return {
    MATERIALS,
    calcBusbarResistance,
    calcBusbarLossPerMetre,
    calcFeederCurrent,
    calcDeviceLoss,
    calcCableLoss,
    evaluateSwitchgear,
    evaluateAllScenarios,
  };
})();
