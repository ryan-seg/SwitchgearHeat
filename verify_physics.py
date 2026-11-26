"""
Verification script for Switchgear Heat Loss Calculator physics formulas.
Independently checks DC->AC busbar resistance, W/m losses, skin/proximity approximations,
and IEC TR 60890 operating-vs-rated current scaling.
"""
import math

MU_0 = 4 * math.pi * 1e-7

def verify_busbar(bars, width_mm, thick_mm, temp_c=70, freq_hz=50, manual_s=1.2, spacing_mm=120, rated_a=1600):
    rho20 = 0.017241  # Cu 100% IACS Ohm*mm2/m
    alpha20 = 0.00393
    area = bars * width_mm * thick_mm
    r_dc20 = rho20 / area
    r_dc_t = r_dc20 * (1 + alpha20 * (temp_c - 20))
    rho_t_m = rho20 * (1 + alpha20 * (temp_c - 20)) * 1e-6
    delta_mm = math.sqrt(rho_t_m / (math.pi * freq_hz * MU_0)) * 1000

    # Manual S factor
    r_ac_manual = r_dc_t * manual_s
    w_per_m_3ph_manual = 3 * (rated_a ** 2) * r_ac_manual

    # Calculated skin + proximity + eddy (matching js/physics.js)
    gap = thick_mm
    total_thick = bars * thick_mm
    lam_coupling = 1.0 if bars == 1 else 1.0 + 0.55 * (bars - 1) * math.exp(-gap / (2.5 * thick_mm))
    t_eff = thick_mm * lam_coupling
    xi = t_eff / (2 * delta_mm)
    k_slab = xi * ((math.sinh(2 * xi) + math.sin(2 * xi)) / (math.cosh(2 * xi) - math.cos(2 * xi)))
    ys_slab = max(0.0, k_slab - 1.0)
    width_ratio = width_mm / delta_mm
    aspect_ratio = width_mm / max(1, total_thick)
    ys_edge = 0.0045 * (max(0.0, width_ratio - 1.5) ** 1.35) * min(2.2, math.sqrt(aspect_ratio / 4))
    ys_multi = 0.028 * ((bars - 1) ** 1.55) * ((total_thick / (2 * delta_mm)) ** 1.2) if bars > 1 else 0.0
    ys = ys_slab + ys_edge + ys_multi

    d_eq = math.sqrt(4 * area / math.pi)
    xp2 = ((8 * math.pi * freq_hz * 1e-7) / r_dc_t) * 0.72
    xp4 = xp2 ** 2
    fp = xp4 / (192 + 0.8 * xp4)
    d_over_s = min(0.85, d_eq / spacing_mm)
    yp = fp * (d_over_s ** 2) * (0.312 * (d_over_s ** 2) + 1.18 / (fp + 0.27))
    ye = 0.02
    k_ac_calc = 1.0 + ys + yp + ye

    print(f"{bars}x{width_mm}x{thick_mm}mm ({area}mm2) @ {rated_a}A, {temp_c}C:")
    print(f"  R_DC20 = {r_dc20*1e6:.2f} uOhm/m | R_DC({temp_c}C) = {r_dc_t*1e6:.2f} uOhm/m | delta = {delta_mm:.2f} mm")
    print(f"  Manual S={manual_s:.2f}: R_AC = {r_ac_manual*1e6:.2f} uOhm/m -> {w_per_m_3ph_manual:.1f} W/m (3-ph)")
    print(f"  Calc k_AC = {k_ac_calc:.3f} (ys={ys:.3f}, yp={yp:.3f}, ye={ye:.2f}) -> {3*(rated_a**2)*r_dc_t*k_ac_calc:.1f} W/m (3-ph)")
    return r_dc20, r_dc_t, k_ac_calc, w_per_m_3ph_manual

if __name__ == "__main__":
    print("=== Busbar Physics Verification ===")
    # 1. User's exact example: 2 x 75 x 6 mm (900 mm2) Cu
    r20, r70, k_calc, w_m = verify_busbar(2, 75, 6, temp_c=70, freq_hz=50, manual_s=1.2, spacing_mm=120, rated_a=1600)
    assert abs(r20 * 1e6 - 19.1567) < 0.01, "R_DC20 mismatch"
    assert abs(r70 * 1e6 - 22.921) < 0.02, "R_DC70 mismatch"
    assert 1.10 < k_calc < 1.30, f"Unexpected k_AC for 2x75x6: {k_calc}"
    assert abs(w_m - 211.24) < 0.5, f"Unexpected 3-ph W/m at 1600A: {w_m}"

    # 2. Additional CDA standard sizes check
    _, _, k1, _ = verify_busbar(1, 50, 6, temp_c=70, spacing_mm=100, rated_a=630)
    assert 1.02 < k1 < 1.12, f"1x50x6 k_AC out of expected range: {k1}"

    _, _, k3, _ = verify_busbar(3, 100, 10, temp_c=70, spacing_mm=160, rated_a=3200)
    assert 1.25 < k3 < 1.60, f"3x100x10 k_AC out of expected range: {k3}"

    # 3. DOL Starter operating vs rated scaling check
    # 37kW motor at 400V, PF=0.86, eff=0.93, load_factor=0.85
    i_op = (37000 / (math.sqrt(3) * 400 * 0.86 * 0.93)) * 0.85
    # Rated In=100A, Pn=55W variable, Pfix=18W fixed
    p_op = 18.0 + 55.0 * ((i_op / 100.0) ** 2)
    print(f"\n=== DOL 37kW Scaling Check ===\n  I_op = {i_op:.2f} A (In=100A) -> P_op = {p_op:.2f} W (vs 73.0 W at rated)")
    assert 55.0 < i_op < 60.0
    assert 34.0 < p_op < 38.0

    print("\nALL PHYSICS VERIFICATION CHECKS PASSED!")
