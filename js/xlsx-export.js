/**
 * Client-Side Live Excel Workbook (.xlsx) Exporter
 * Patches the embedded 10-sheet, 100% macro-free, protected Excel calculator template
 * directly in the browser (zero external libraries, works 100% offline & on Cloudflare).
 *
 * Preserves ALL formulas, charts, Conditional Formatting Heat Maps (Live SLD & GA),
 * Data Validations, Hyperlinks, Print Layouts, and Sheet Protection (only blue entry
 * cells selectable; formulas hidden; admin password: CEI).
 */

window.SGXlsxExport = (function () {
  'use strict';

  const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

  // --- Standard IEEE 802.3 CRC-32 ---
  const CRC_TABLE = (function () {
    const tbl = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      tbl[i] = c >>> 0;
    }
    return tbl;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function inflateRaw(compressedBytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser does not support native DecompressionStream for .xlsx export.');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }

  function parseZip(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // Find End of Central Directory (EOCD) signature 0x06054b50
    let eocdPos = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdPos = i;
        break;
      }
    }
    if (eocdPos < 0) throw new Error('Invalid .xlsx template archive (EOCD not found).');

    const totalEntries = view.getUint16(eocdPos + 10, true);
    const cdOffset = view.getUint32(eocdPos + 16, true);
    const dec = new TextDecoder('utf-8');
    const entries = [];

    let pos = cdOffset;
    for (let i = 0; i < totalEntries; i++) {
      if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Invalid ZIP central directory entry.');
      const flags = view.getUint16(pos + 8, true);
      const method = view.getUint16(pos + 10, true);
      const modTime = view.getUint16(pos + 12, true);
      const modDate = view.getUint16(pos + 14, true);
      const crc = view.getUint32(pos + 16, true);
      const compSize = view.getUint32(pos + 20, true);
      const uncompSize = view.getUint32(pos + 24, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const extAttr = view.getUint32(pos + 38, true);
      const localOffset = view.getUint32(pos + 42, true);

      const nameBytes = bytes.subarray(pos + 46, pos + 46 + nameLen);
      const name = dec.decode(nameBytes);

      // Locate compressed payload from local file header
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const compData = bytes.subarray(dataStart, dataStart + compSize);

      entries.push({
        name,
        nameBytes,
        flags: flags & ~0x08, // clear data descriptor bit when rebuilding
        method,
        modTime,
        modDate,
        crc,
        compSize,
        uncompSize,
        extAttr,
        compData,
      });

      pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  function buildZip(entries) {
    const localParts = [];
    const cdParts = [];
    let offset = 0;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const nameLen = e.nameBytes.length;

      // Local File Header (30 bytes + name)
      const lh = new Uint8Array(30 + nameLen);
      const lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true); // version needed
      lv.setUint16(6, e.flags, true);
      lv.setUint16(8, e.method, true);
      lv.setUint16(10, e.modTime, true);
      lv.setUint16(12, e.modDate, true);
      lv.setUint32(14, e.crc, true);
      lv.setUint32(18, e.compSize, true);
      lv.setUint32(22, e.uncompSize, true);
      lv.setUint16(26, nameLen, true);
      lv.setUint16(28, 0, true);
      lh.set(e.nameBytes, 30);

      localParts.push(lh, e.compData);

      // Central Directory Entry (46 bytes + name)
      const cd = new Uint8Array(46 + nameLen);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); // version made by
      cv.setUint16(6, 20, true); // version needed
      cv.setUint16(8, e.flags, true);
      cv.setUint16(10, e.method, true);
      cv.setUint16(12, e.modTime, true);
      cv.setUint16(14, e.modDate, true);
      cv.setUint32(16, e.crc, true);
      cv.setUint32(20, e.compSize, true);
      cv.setUint32(24, e.uncompSize, true);
      cv.setUint16(28, nameLen, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, e.extAttr, true);
      cv.setUint32(42, offset, true);
      cd.set(e.nameBytes, 46);
      cdParts.push(cd);

      offset += lh.length + e.compData.length;
    }

    const cdStart = offset;
    let cdSize = 0;
    cdParts.forEach((p) => (cdSize += p.length));

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdStart, true);
    ev.setUint16(20, 0, true);

    const totalLen = cdStart + cdSize + 22;
    const result = new Uint8Array(totalLen);
    let cursor = 0;
    for (const p of localParts) {
      result.set(p, cursor);
      cursor += p.length;
    }
    for (const p of cdParts) {
      result.set(p, cursor);
      cursor += p.length;
    }
    result.set(eocd, cursor);
    return result;
  }

  // --- XML Worksheet Cell Helpers (DOM-based, zero regex corruption) ---
  function indexCells(doc) {
    const map = new Map();
    const cells = doc.getElementsByTagNameNS(NS_MAIN, 'c');
    for (let i = 0; i < cells.length; i++) {
      const ref = cells[i].getAttribute('r');
      if (ref) map.set(ref, cells[i]);
    }
    return map;
  }

  function getCellText(cellEl) {
    if (!cellEl) return '';
    const tNodes = cellEl.getElementsByTagNameNS(NS_MAIN, 't');
    if (tNodes.length > 0) return tNodes[0].textContent || '';
    const vNodes = cellEl.getElementsByTagNameNS(NS_MAIN, 'v');
    if (vNodes.length > 0) return vNodes[0].textContent || '';
    return '';
  }

  function clearCellChildren(cellEl) {
    while (cellEl.firstChild) cellEl.removeChild(cellEl.firstChild);
    cellEl.removeAttribute('t');
  }

  function setCellValue(doc, cellMap, ref, val) {
    const c = cellMap.get(ref);
    if (!c) return;
    clearCellChildren(c);
    if (val === null || val === undefined || val === '') {
      return;
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
      const v = doc.createElementNS(NS_MAIN, 'v');
      v.textContent = String(val);
      c.appendChild(v);
    } else {
      c.setAttribute('t', 'inlineStr');
      const isEl = doc.createElementNS(NS_MAIN, 'is');
      const tEl = doc.createElementNS(NS_MAIN, 't');
      const s = String(val);
      if (s.startsWith(' ') || s.endsWith(' ') || s.includes('\n')) {
        tEl.setAttribute('xml:space', 'preserve');
      }
      tEl.textContent = s;
      isEl.appendChild(tEl);
      c.appendChild(isEl);
    }
  }

  // --- Mappings between Web App state and Excel workbook dropdown strings ---
  const MATERIAL_TO_EXCEL = {
    cu_100: 'Copper (Cu 100% IACS)',
    cu_98: 'Copper (Cu 98% IACS)',
    al_61: 'Aluminium (Al 61% IACS)',
    al_55: 'Aluminium (Al 55% IACS)',
  };

  const SCENARIO_TO_EXCEL = {
    normal: 'Normal (N)',
    n1_transfer: 'N-1 Firm Transfer',
    normal_future: 'Normal + Future',
    worst_case: 'Worst-Case (N-1 + Future)',
  };

  const BB_PRESET_TO_EXCEL = {
    'bb-630': '630 A — 1×50×6 mm Cu (300 mm²)',
    'bb-800': '800 A — 1×60×8 mm Cu (480 mm²)',
    'bb-1000': '1000 A — 2×50×6 mm Cu (600 mm²)',
    'bb-1250': '1250 A — 2×75×6 mm Cu (900 mm²)',
    'bb-1600': '1600 A — 2×80×8 mm Cu (1280 mm²)',
    'bb-2000': '2000 A — 2×80×10 mm Cu (1600 mm²)',
    'bb-2500': '2500 A — 2×100×10 mm Cu (2000 mm²)',
    'bb-3200': '3200 A — 3×100×10 mm Cu (3000 mm²)',
    'bb-4000': '4000 A — 4×100×10 mm Cu (4000 mm²)',
  };

  const TOPO_TO_EXCEL = {
    single: 'Single Incomer',
    single_interconn: 'Single Incomer + Interconnector (A→B)',
    dual_coupler: 'Dual Incomer + Bus Coupler',
    dual_coupler_interconn: 'Single Incomer + Interconnector (A→B)',
  };

  const ROLE_TO_EXCEL = {
    incomer: 'Incomer',
    feeder: 'Feeder',
    interconnector: 'Interconnector',
    bus_coupler: 'Bus Coupler',
    spacer: 'Spare / Placeholder',
  };

  const STATUS_TO_EXCEL = {
    active: 'Active',
    future: 'Future',
    standby: 'Standby',
  };

  function stripWildcards(str) {
    return String(str || '').replace(/[~*?]/g, '');
  }

  function detectLossModel(tierOrTpl) {
    if (tierOrTpl.lossModel === 'vsd_efficiency') return 'vsd';
    if (Array.isArray(tierOrTpl.subComponents)) {
      if (tierOrTpl.subComponents.some((sc) => sc.lossModel === 'vsd_efficiency')) return 'vsd';
    }
    if (String(tierOrTpl.category || '').toLowerCase().includes('vsd')) return 'vsd';
    return 'quadratic';
  }

  function writeBusbarColumn(doc, map, colL, bb) {
    if (!bb) return;
    setCellValue(doc, map, `${colL}37`, bb.certRef || bb.label || 'Custom Busbar');
    setCellValue(doc, map, `${colL}38`, Number(bb.ratedCurrentA) || 1250);
    setCellValue(doc, map, `${colL}39`, MATERIAL_TO_EXCEL[bb.material] || 'Copper (Cu 100% IACS)');
    setCellValue(doc, map, `${colL}40`, Math.max(1, Number(bb.barsPerPhase) || 1));
    setCellValue(doc, map, `${colL}41`, Math.max(10, Number(bb.widthMm) || 60));
    setCellValue(doc, map, `${colL}42`, Math.max(3, Number(bb.thicknessMm) || 6));
    setCellValue(doc, map, `${colL}43`, Math.max(2, Number(bb.gapMm || bb.thicknessMm) || 6));
    setCellValue(doc, map, `${colL}44`, Math.max(30, Number(bb.phaseSpacingMm) || 120));
    setCellValue(doc, map, `${colL}45`, bb.orientation === 'flat' ? 'Flat' : 'Edge');
    setCellValue(doc, map, `${colL}46`, Number(bb.operatingTempC != null ? bb.operatingTempC : 70));
    setCellValue(doc, map, `${colL}47`, Number(bb.neutralSizeRatio != null ? bb.neutralSizeRatio : 0.5));
    setCellValue(doc, map, `${colL}48`, bb.acFactorMode === 'calculated' ? 'Calculated' : 'Manual');
    setCellValue(doc, map, `${colL}49`, Math.max(1, Number(bb.manualSFactor) || 1.2));
    setCellValue(doc, map, `${colL}50`, Math.max(0, Number(bb.enclosureEddyFactor != null ? bb.enclosureEddyFactor : 0.02)));
  }

  async function buildXlsxBytes(project) {
    if (!window.SGXlsxTemplateB64) {
      throw new Error('Embedded Excel template data (xlsx-template-data.js) is not loaded.');
    }

    const tplBytes = b64ToBytes(window.SGXlsxTemplateB64);
    const entries = parseZip(tplBytes);
    const entryMap = new Map(entries.map((e) => [e.name, e]));
    const dec = new TextDecoder('utf-8');
    const enc = new TextEncoder();
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    async function loadSheetDoc(path) {
      const e = entryMap.get(path);
      if (!e) throw new Error('Missing worksheet in Excel template: ' + path);
      const raw = e.method === 0 ? e.compData : await inflateRaw(e.compData);
      const xmlStr = dec.decode(raw);
      return parser.parseFromString(xmlStr, 'application/xml');
    }

    function saveSheetDoc(path, doc) {
      const e = entryMap.get(path);
      const xmlStr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + serializer.serializeToString(doc);
      const bytes = enc.encode(xmlStr);
      e.method = 0; // STORE (100% standard PKZIP, zero browser compat risk)
      e.compData = bytes;
      e.compSize = bytes.length;
      e.uncompSize = bytes.length;
      e.crc = crc32(bytes);
    }

    // Load the 6 input/library worksheets
    const [docSmp, docSum, docBus, docFed, docLib, docRm] = await Promise.all([
      loadSheetDoc('xl/worksheets/sheet1.xml'),
      loadSheetDoc('xl/worksheets/sheet2.xml'),
      loadSheetDoc('xl/worksheets/sheet3.xml'),
      loadSheetDoc('xl/worksheets/sheet4.xml'),
      loadSheetDoc('xl/worksheets/sheet8.xml'),
      loadSheetDoc('xl/worksheets/sheet9.xml'),
    ]);

    const mapSmp = indexCells(docSmp);
    const mapSum = indexCells(docSum);
    const mapBus = indexCells(docBus);
    const mapFed = indexCells(docFed);
    const mapLib = indexCells(docLib);
    const mapRm  = indexCells(docRm);

    // 1. Read existing library catalog in sheet8 (06_Device_&_Fuse_Library, rows 5..215)
    const excelLib = new Map(); // name -> { inA, pnW, fixW, model }
    let nextCustomLibRow = 5;
    for (let r = 5; r <= 215; r++) {
      const name = getCellText(mapLib.get(`A${r}`)).trim();
      if (name) {
        excelLib.set(name, {
          inA: Number(getCellText(mapLib.get(`G${r}`))) || 0,
          pnW: Number(getCellText(mapLib.get(`H${r}`))) || 0,
          fixW: Number(getCellText(mapLib.get(`I${r}`))) || 0,
          model: getCellText(mapLib.get(`J${r}`)).trim() || 'quadratic',
        });
        nextCustomLibRow = r + 1;
      }
    }

    function ensureLibraryMatch(item, fallbackLabel) {
      const cleanName = stripWildcards(item.name || item.description || fallbackLabel || 'Custom Device');
      const wantIn = Math.max(1, Number(item.ratedCurrentA) || 1);
      const wantPn = Math.round((Number(item.ratedLossW) || 0) * 10) / 10;
      const wantFix = Math.round((Number(item.fixedLossW) || 0) * 10) / 10;
      const wantMod = detectLossModel(item);

      // Check exact name match + matching thermal parameters
      const exact = excelLib.get(cleanName);
      if (
        exact &&
        Math.abs(exact.inA - wantIn) < 0.5 &&
        Math.abs(exact.pnW - wantPn) < 0.6 &&
        Math.abs(exact.fixW - wantFix) < 0.6 &&
        exact.model === wantMod
      ) {
        return cleanName;
      }

      // Also check by matching the web catalog template ID's canonical name
      if (item.templateId && project.deviceLibrary) {
        const tpl = project.deviceLibrary.find((t) => t.id === item.templateId);
        if (tpl) {
          const tplClean = stripWildcards(tpl.name);
          const exTpl = excelLib.get(tplClean);
          if (
            exTpl &&
            Math.abs(exTpl.inA - wantIn) < 0.5 &&
            Math.abs(exTpl.pnW - wantPn) < 0.6 &&
            Math.abs(exTpl.fixW - wantFix) < 0.6 &&
            exTpl.model === wantMod
          ) {
            return tplClean;
          }
        }
      }

      // Otherwise register a custom entry in the empty custom rows of 06_Device_&_Fuse_Library!
      let customKey = cleanName;
      if (excelLib.has(customKey)) {
        customKey = stripWildcards(`${item.tag || 'Custom'} — ${cleanName} (${wantIn}A, ${wantPn}W)`);
      }
      if (!excelLib.has(customKey) && nextCustomLibRow <= 215) {
        const rr = nextCustomLibRow++;
        setCellValue(docLib, mapLib, `A${rr}`, customKey);
        setCellValue(docLib, mapLib, `B${rr}`, item.category || 'Custom');
        setCellValue(docLib, mapLib, `C${rr}`, item.manufacturer || 'Web Export');
        setCellValue(docLib, mapLib, `D${rr}`, item.modelSeries || 'Custom Spec');
        setCellValue(docLib, mapLib, `E${rr}`, item.defaultKw ? `${item.defaultKw} kW` : `${wantIn} A`);
        setCellValue(docLib, mapLib, `F${rr}`, ROLE_TO_EXCEL[item.role] || 'Feeder');
        setCellValue(docLib, mapLib, `G${rr}`, wantIn);
        setCellValue(docLib, mapLib, `H${rr}`, wantPn);
        setCellValue(docLib, mapLib, `I${rr}`, wantFix);
        setCellValue(docLib, mapLib, `J${rr}`, wantMod);
        setCellValue(docLib, mapLib, `K${rr}`, Number(item.heightMm || item.defaultHeightMm) || 250);
        setCellValue(docLib, mapLib, `L${rr}`, item.sourceRef || 'Exported from Web App');
        setCellValue(docLib, mapLib, `M${rr}`, item.sourceUrl || '');
        excelLib.set(customKey, { inA: wantIn, pnW: wantPn, fixW: wantFix, model: wantMod });
      }
      return customKey;
    }

    // 2. Patch 00_Simple_Mode (sheet1.xml)
    const sm = project.simpleMode || {};
    const lib = project.deviceLibrary || [];
    const findTpl = (id) => lib.find((t) => t.id === id) || {};
    setCellValue(docSmp, mapSmp, 'B6', BB_PRESET_TO_EXCEL[sm.busbarPresetId] || '1250 A — 2×75×6 mm Cu (900 mm²)');
    setCellValue(docSmp, mapSmp, 'B7', TOPO_TO_EXCEL[sm.topology] || 'Single Incomer + Interconnector (A→B)');
    setCellValue(docSmp, mapSmp, 'B8', Math.max(1, Number(sm.columnCount) || 5));
    setCellValue(docSmp, mapSmp, 'B9', Math.max(1, Number(sm.manualSFactor) || 1.2));
    setCellValue(docSmp, mapSmp, 'B10', Math.max(0, Number(sm.dolCount) || 0));
    setCellValue(docSmp, mapSmp, 'B11', ensureLibraryMatch(findTpl(sm.dolTemplateId), 'DOL Starter 37 kW (100A frame)'));
    setCellValue(docSmp, mapSmp, 'B12', Math.max(0, Number(sm.vsdCount) || 0));
    setCellValue(docSmp, mapSmp, 'B13', ensureLibraryMatch(findTpl(sm.vsdTemplateId), 'VSD / Inverter Drive 45 kW (2.8% loss)'));
    setCellValue(docSmp, mapSmp, 'B14', Math.max(0, Number(sm.feederCount) || 0));
    setCellValue(docSmp, mapSmp, 'B15', ensureLibraryMatch(findTpl(sm.feederTemplateId), 'Eaton 250NHG1B — 250A NH1 gG HRC (19.0W/link)'));
    setCellValue(docSmp, mapSmp, 'B16', Math.max(0.05, Math.min(1.25, (Number(sm.avgLoadPct) || 75) / 100)));
    setCellValue(docSmp, mapSmp, 'B17', Math.max(0.2, Math.min(1.0, Number(sm.rdf) || 0.9)));
    setCellValue(docSmp, mapSmp, 'B18', Math.max(0, (Number(sm.futureGrowthPct) || 20) / 100));
    setCellValue(docSmp, mapSmp, 'B19', Math.max(0, Number(sm.n1TransferA) || 850));
    setCellValue(docSmp, mapSmp, 'B20', sm.inputStyle === 'counts' ? 'Quick Counts' : 'Tier Grid');
    const smGrid = Array.isArray(sm.tierGrid) ? sm.tierGrid : [];
    const smColLetters = ['B', 'C', 'D', 'E', 'F', 'G'];
    for (let tIdx = 0; tIdx < 6; tIdx++) {
      for (let cIdx = 0; cIdx < 6; cIdx++) {
        const colL = smColLetters[cIdx];
        const gCol = smGrid[cIdx];
        const tplId = gCol && Array.isArray(gCol.tiers) ? gCol.tiers[tIdx] : '';
        if (tplId) {
          setCellValue(docSmp, mapSmp, `${colL}${49 + tIdx}`, ensureLibraryMatch(findTpl(tplId), ''));
        } else {
          setCellValue(docSmp, mapSmp, `${colL}${49 + tIdx}`, '');
        }
        const ovAmps = gCol && Array.isArray(gCol.loads) && gCol.loads[tIdx] !== '' && gCol.loads[tIdx] != null ? Number(gCol.loads[tIdx]) : '';
        const ovPhase = gCol && Array.isArray(gCol.phases) && gCol.phases[tIdx] ? gCol.phases[tIdx] : '';
        setCellValue(docSmp, mapSmp, `${colL}${59 + tIdx}`, ovAmps);
        setCellValue(docSmp, mapSmp, `${colL}${67 + tIdx}`, ovPhase);
      }
    }

    // 3. Patch 01_Summary (sheet2.xml)
    const isSimple = project.uiMode === 'simple';
    setCellValue(docSum, mapSum, 'C8', isSimple ? 'Simple Mode' : 'Detailed Mode');
    setCellValue(docSum, mapSum, 'C9', SCENARIO_TO_EXCEL[project.activeScenario] || 'Normal (N)');
    if (project.reportConfig) {
      setCellValue(docSum, mapSum, 'D52', project.reportConfig.checkedBy || '');
      setCellValue(docSum, mapSum, 'F52', project.reportConfig.approvedBy || '');
    }

    // 4. Patch 02_Board_&_Busbars (sheet3.xml)
    const m = project.meta || {};
    const cfg = project.config || {};
    setCellValue(docBus, mapBus, 'B5', m.projectName || 'LV Switchboard');
    setCellValue(docBus, mapBus, 'B6', m.projectNumber || 'CEI-TH-001');
    setCellValue(docBus, mapBus, 'B7', m.engineer || 'CE&I Engineering');
    setCellValue(docBus, mapBus, 'B8', `${m.revision || 'Rev A'}  |  ${m.date || new Date().toISOString().slice(0, 10)}`);
    // In Detailed Mode set Inherit = No so exact website busbar/RDF/growth values are preserved verbatim!
    setCellValue(docBus, mapBus, 'B9', isSimple ? 'Yes' : 'No');

    setCellValue(docBus, mapBus, 'B12', Number(cfg.voltageV) || 400);
    setCellValue(docBus, mapBus, 'B13', Number(cfg.frequencyHz) || 50);
    setCellValue(docBus, mapBus, 'B14', cfg.poles === '3P' ? '3P' : '3P+N');
    setCellValue(docBus, mapBus, 'B15', Number(cfg.neutralCurrentRatio != null ? cfg.neutralCurrentRatio : 0.1));
    setCellValue(docBus, mapBus, 'B16', Number(cfg.diversityFactorRDF != null ? cfg.diversityFactorRDF : 0.9));
    setCellValue(docBus, mapBus, 'B17', (Number(cfg.globalFutureGrowthPct != null ? cfg.globalFutureGrowthPct : 15)) / 100);
    setCellValue(docBus, mapBus, 'B18', Number(cfg.panelHeightMm) || 2200);
    setCellValue(docBus, mapBus, 'B19', Number(cfg.panelDepthMm) || 800);
    setCellValue(docBus, mapBus, 'B20', Number(cfg.hbbChamberHeightMm) || 350);
    setCellValue(docBus, mapBus, 'B21', cfg.hbbPosition === 'bottom' ? 'Bottom' : 'Top');
    setCellValue(docBus, mapBus, 'B22', Number(cfg.takeoffTailLengthM != null ? cfg.takeoffTailLengthM : 0.35));
    setCellValue(docBus, mapBus, 'B23', Number(cfg.jointResistanceUOhm != null ? cfg.jointResistanceUOhm : 5));
    setCellValue(docBus, mapBus, 'B24', Number(cfg.auxiliaryLossesW != null ? cfg.auxiliaryLossesW : 120));
    setCellValue(docBus, mapBus, 'B25', cfg.installationType === 'wall_backed' ? 'Wall-Backed' : 'Freestanding');
    setCellValue(docBus, mapBus, 'B26', (Number(cfg.hvacSafetyMarginPct != null ? cfg.hvacSafetyMarginPct : 15)) / 100);

    // Main HBB (Col B), VBB-Std (Col C), VBB-Heavy (Col D)
    writeBusbarColumn(docBus, mapBus, 'B', project.mainBusbar);
    writeBusbarColumn(docBus, mapBus, 'C', project.defaultVerticalBusbar);
    const heavyCol = (project.columns || []).find(
      (c) => c.verticalBusbar && (c.tiers || []).some((t) => t.role === 'interconnector')
    );
    writeBusbarColumn(docBus, mapBus, 'D', (heavyCol && heavyCol.verticalBusbar) || project.mainBusbar);

    // 5. Patch 03_Feeder_Schedule (sheet4.xml) — Columns (Rows 6..13) + Tiers (Rows 17..51)
    const cols = (project.columns || []).slice(0, 8);
    const stdArea = (project.defaultVerticalBusbar.barsPerPhase || 1) * (project.defaultVerticalBusbar.widthMm || 60) * (project.defaultVerticalBusbar.thicknessMm || 6);

    for (let ci = 0; ci < 8; ci++) {
      const r = 6 + ci;
      const col = cols[ci];
      if (!col) {
        setCellValue(docFed, mapFed, `B${r}`, '');
        setCellValue(docFed, mapFed, `C${r}`, 0);
        setCellValue(docFed, mapFed, `D${r}`, 'None');
      } else {
        setCellValue(docFed, mapFed, `B${r}`, col.name || `COL-0${ci + 1}`);
        setCellValue(docFed, mapFed, `C${r}`, Number(col.widthMm) || 800);
        const hasVbbLoad = (col.tiers || []).some((t) => t.role === 'feeder' || t.role === 'interconnector');
        let vbbType = 'None';
        if (hasVbbLoad) {
          const vb = col.verticalBusbar || project.defaultVerticalBusbar;
          const vArea = (vb.barsPerPhase || 1) * (vb.widthMm || 60) * (vb.thicknessMm || 6);
          const hasIc = (col.tiers || []).some((t) => t.role === 'interconnector');
          vbbType = hasIc || vArea > stdArea * 1.25 ? 'VBB-Heavy' : 'VBB-Std';
        }
        setCellValue(docFed, mapFed, `D${r}`, vbbType);
      }
    }

    // Flatten tiers into rows 17..51 (up to 35 compartments)
    const flatTiers = [];
    cols.forEach((col, ci) => {
      const colId = `COL-0${ci + 1}`;
      (col.tiers || []).forEach((tier, ti) => {
        if (flatTiers.length < 35) {
          flatTiers.push({ colId, tierNum: ti + 1, tier });
        }
      });
    });

    for (let idx = 0; idx < 35; idx++) {
      const r = 17 + idx;
      if (idx >= flatTiers.length) {
        for (const colL of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']) {
          setCellValue(docFed, mapFed, `${colL}${r}`, '');
        }
        continue;
      }
      const { colId, tierNum, tier } = flatTiers[idx];
      const roleEx = ROLE_TO_EXCEL[tier.role] || 'Feeder';
      let statusEx = STATUS_TO_EXCEL[tier.status] || 'Active';
      if (tier.role === 'incomer' && tier.incomerState === 'open') statusEx = 'Standby';

      const tplNameEx = ensureLibraryMatch(tier, tier.description);
      const is1P = tier.phases === '1P';
      const loadModeEx =
        tier.role === 'incomer' || tier.role === 'bus_coupler'
          ? 'Auto'
          : tier.role === 'interconnector'
          ? 'Amps'
          : tier.loadInputMode === 'kw'
          ? (is1P ? 'kW (1P)' : 'kW')
          : (is1P ? 'Amps (1P)' : 'Amps');
      const baseLoad =
        tier.role === 'incomer' || tier.role === 'bus_coupler' || tier.role === 'spacer'
          ? 0
          : tier.role === 'interconnector'
          ? Number(tier.normalTransferCurrentA) || 0
          : tier.loadInputMode === 'kw'
          ? Number(tier.loadKw) || 0
          : Number(tier.operatingCurrentA) || 0;
      const n1Val = tier.role === 'interconnector' ? Number(tier.n1TransferCurrentA) || 0 : 0;

      setCellValue(docFed, mapFed, `A${r}`, colId);
      setCellValue(docFed, mapFed, `B${r}`, tierNum);
      setCellValue(docFed, mapFed, `C${r}`, tier.tag || `T-${idx + 1}`);
      setCellValue(docFed, mapFed, `D${r}`, tier.description || tplNameEx);
      setCellValue(docFed, mapFed, `E${r}`, roleEx);
      setCellValue(docFed, mapFed, `F${r}`, statusEx);
      setCellValue(docFed, mapFed, `G${r}`, tplNameEx);
      setCellValue(docFed, mapFed, `H${r}`, Math.max(120, Number(tier.heightMm) || 250));
      setCellValue(docFed, mapFed, `I${r}`, loadModeEx);
      setCellValue(docFed, mapFed, `J${r}`, baseLoad);
      setCellValue(docFed, mapFed, `K${r}`, n1Val);
      setCellValue(docFed, mapFed, `L${r}`, Number(tier.powerFactor) || 0.85);
      setCellValue(docFed, mapFed, `M${r}`, Number(tier.efficiency) || 0.93);
      setCellValue(docFed, mapFed, `N${r}`, tier.loadFactor != null ? Number(tier.loadFactor) : 1.0);
    }

    // 6. Patch 07_Room_Ventilation (sheet9.xml)
    const rm = project.room || {};
    setCellValue(docRm, mapRm, 'B6', Number(rm.lengthM) || 5.0);
    setCellValue(docRm, mapRm, 'B7', Number(rm.widthM) || 5.0);
    setCellValue(docRm, mapRm, 'B8', Number(rm.heightM) || 9.0);
    setCellValue(docRm, mapRm, 'B9', Number(rm.ambientTempC != null ? rm.ambientTempC : 25));
    setCellValue(docRm, mapRm, 'B10', Number(rm.maxRoomTempC != null ? rm.maxRoomTempC : 35));
    setCellValue(docRm, mapRm, 'B11', Number(rm.otherRoomHeatKW) || 0);
    setCellValue(docRm, mapRm, 'B12', Number(rm.louverFreeAreaM2) || 0.5);
    setCellValue(docRm, mapRm, 'B13', Number(rm.stackHeightM) || 6.0);
    setCellValue(docRm, mapRm, 'B14', Number(rm.dischargeCoeff) || 0.6);
    setCellValue(docRm, mapRm, 'B15', rm.useOverrideHeatKW ? 'Yes' : 'No');
    setCellValue(docRm, mapRm, 'B16', Number(rm.overrideHeatKW) || 6.0);

    // Save patched XML sheets back into ZIP entries
    saveSheetDoc('xl/worksheets/sheet1.xml', docSmp);
    saveSheetDoc('xl/worksheets/sheet2.xml', docSum);
    saveSheetDoc('xl/worksheets/sheet3.xml', docBus);
    saveSheetDoc('xl/worksheets/sheet4.xml', docFed);
    saveSheetDoc('xl/worksheets/sheet8.xml', docLib);
    saveSheetDoc('xl/worksheets/sheet9.xml', docRm);

    return buildZip(entries);
  }

  async function exportExcelWorkbook(project) {
    const bytes = await buildXlsxBytes(project);
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const base = (project.meta && project.meta.projectNumber ? project.meta.projectNumber : 'Switchgear').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${base}_Heat_Loss_Calculator.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return bytes.length;
  }

  return {
    buildXlsxBytes,
    exportExcelWorkbook,
  };
})();
