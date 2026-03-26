/**
 * UnityESS Budgetary Proposal Generator
 * =======================================
 * Called by POST /api/bess/generate-proposal-docx
 * Returns a Buffer containing a branded .docx
 */

const fs   = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, HeadingLevel, TabStopType, TabStopPosition,
} = require('docx');

// ── Brand constants ────────────────────────────────────────────────────────
const ORANGE       = 'F26B4E';
const DARK         = '2D2D2D';
const LIGHT_ORANGE = 'FEF0EC';
const MID_ORANGE   = 'FDDDD4';
const WHITE        = 'FFFFFF';
const GREY_BORDER  = 'E0E0E0';
const GREY_TEXT    = '999999';
const FONT         = 'Chivo';
const PAGE_W       = 11906;
const PAGE_H       = 16838;
const MARGIN_LR    = 1080;
const CONTENT_W    = PAGE_W - 2 * MARGIN_LR;  // 9746 DXA

// ── Model specs lookup ─────────────────────────────────────────────────────
const MODEL_SPECS = {
  'A-125-261': {
    cell_config: '1P × 46S × 6S per unit',
    dc_nominal_v: '806.4 V',
    dc_range_v: '705.6 V – 907.2 V',
    grid_voltage: '400V AC (Range: 360V – 440V)',
    pf: '0.99 (Range: −1 to +1)',
    thdu: '< 3%',
    overload: '110% Continuous | 120% for 1 Minute',
    comms: 'RS485 | CAN 2.0 | Ethernet',
    unit_w_mm: 1200, unit_d_mm: 1000, unit_h_mm: 2200, unit_kg: 2200,
    certifications: 'IEC 62619 | IEC 62477 | IS 16270 | BIS',
    cycle_life: '≥6,000 Cycles @ 90% DoD',
    calendar_life: '≥15 Years',
    max_parallel: 12,
  },
  'A2-215-418': {
    cell_config: '1P × 52S × 8S per unit',
    dc_nominal_v: '1,331.2 V',
    dc_range_v: '1,164.8 V – 1,497.6 V',
    grid_voltage: '800V AC (Range: 720V – 880V)',
    pf: '0.99 (Range: −1 to +1)',
    thdu: '< 2%',
    overload: '110% Continuous | 120% for 1 Minute',
    comms: 'RS485 | CAN 2.0 | Ethernet',
    unit_w_mm: 1600, unit_d_mm: 1350, unit_h_mm: 2450, unit_kg: 3700,
    certifications: 'GB/T 36276 | IEC 62619 | IEC 62477 | IEC 61000 | UN38.3',
    cycle_life: '≥6,000 Cycles @ 90% DoD',
    calendar_life: '≥20 Years',
    max_parallel: 12,
  },
};

function getModelSpecs(model) {
  // Direct match first; then strip the "UESS-" prefix the portal prepends
  return MODEL_SPECS[model] || MODEL_SPECS[(model ?? '').replace(/^UESS-/i, '')] || {
    cell_config: 'LFP Cell Stack — per datasheet',
    dc_nominal_v: 'Per datasheet',
    dc_range_v: 'Per datasheet',
    grid_voltage: '400V / 800V AC (per configuration)',
    pf: '0.99 (Range: −1 to +1)',
    thdu: '< 3%',
    overload: '110% Continuous | 120% for 1 Minute',
    comms: 'RS485 | CAN 2.0 | Ethernet',
    unit_w_mm: null, unit_d_mm: null, unit_h_mm: null, unit_kg: null,
    certifications: 'IEC 62619 | IEC 62477 | BIS',
    cycle_life: '≥6,000 Cycles @ 90% DoD',
    calendar_life: '≥15 Years',
    max_parallel: 12,
  };
}

// ── INR formatter — Indian comma grouping ──────────────────────────────────
function inr(n) {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest  = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return '₹' + (rest ? grouped + ',' + last3 : last3);
}

function inrCr(n) {
  const cr = n / 1e7;
  return cr >= 1 ? `₹${cr.toFixed(2)} Cr` : `₹${(n / 1e5).toFixed(2)} L`;
}

// ── Table helpers ──────────────────────────────────────────────────────────
const thinBorder  = { style: BorderStyle.SINGLE, size: 1, color: GREY_BORDER };
const borders     = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const cellMargins = { top: 65, bottom: 65, left: 100, right: 100 };

function hCell(text, width, leftAlign) {
  return new TableCell({
    borders, margins: cellMargins,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: ORANGE, type: ShadingType.CLEAR },
    verticalAlign: 'center',
    children: [new Paragraph({
      alignment: leftAlign ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text, font: FONT, size: 16, bold: true, color: WHITE })],
    })],
  });
}

function dCell(text, width, opts = {}) {
  const { bold, align, shade } = opts;
  return new TableCell({
    borders, margins: cellMargins,
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { fill: shade, type: ShadingType.CLEAR } : undefined,
    verticalAlign: 'center',
    children: [new Paragraph({
      alignment: align || AlignmentType.LEFT,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: String(text ?? '—'), font: FONT, size: 16, bold: !!bold, color: DARK })],
    })],
  });
}

const rs = i => (i % 2 === 0 ? LIGHT_ORANGE : undefined);

function kv2(rows) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3400, 6346],
    rows: rows.map((r, i) => new TableRow({ children: [
      dCell(r[0], 3400, { bold: true, shade: rs(i) }),
      dCell(r[1], 6346, { shade: rs(i) }),
    ]})),
  });
}

function kv2WithHeader(headerLabel, specLabel, rows) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [3400, 6346],
    rows: [
      new TableRow({ tableHeader: true, children: [hCell(headerLabel, 3400, true), hCell(specLabel, 6346, true)] }),
      ...rows.map((r, i) => new TableRow({ children: [
        dCell(r[0], 3400, { bold: true, shade: rs(i) }),
        dCell(r[1], 6346, { shade: rs(i) }),
      ]})),
    ],
  });
}

// ── Paragraph helpers ──────────────────────────────────────────────────────
function h1(text, extraBefore) {
  return new Paragraph({
    spacing: { before: extraBefore ? 400 : 300, after: 200 },
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: FONT, size: 28, bold: true, color: ORANGE })],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, font: FONT, size: 18, color: DARK, ...opts })],
  });
}

function italic(text) {
  return new Paragraph({
    spacing: { before: 0, after: 200 },
    children: [new TextRun({ text, font: FONT, size: 18, italics: true, color: '666666' })],
  });
}

function subhead(text) {
  return body(text, { bold: true, color: ORANGE });
}

function sp(after = 200) { return new Paragraph({ spacing: { after }, children: [] }); }

function meta(label, value, isFirst) {
  return new Paragraph({
    spacing: { before: isFirst ? 100 : 0, after: 40 },
    tabStops: [{ type: TabStopType.LEFT, position: 2800 }],
    children: [
      new TextRun({ text: label, font: FONT, size: 18, bold: true, color: DARK }),
      new TextRun({ text: '\t' + value, font: FONT, size: 18, color: DARK }),
    ],
  });
}

function note(n, text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 }, indent: { left: 360 },
    children: [
      new TextRun({ text: `${n}.  `, font: FONT, size: 18, bold: true, color: ORANGE }),
      new TextRun({ text, font: FONT, size: 18, color: DARK }),
    ],
  });
}

// ── Use-case label lookup ──────────────────────────────────────────────────
const USE_CASE_LABELS = {
  tod_arbitrage:      'ToD Tariff Optimisation',
  peak_shaving:       'Peak Demand Shaving',
  solar_self_consume: 'Solar Self-Consumption',
  backup_power:       'Backup Power / Critical Load',
  hybrid:             'Hybrid — ToD + Solar Self-Consumption',
};

// ── Main generator ─────────────────────────────────────────────────────────
async function generateBessProposalDocx(cfg) {
  const {
    client_name   = 'Valued Client',
    num_units     = 1,
    unit_model    = 'UnityESS BESS',
    unit_kw       = 125,
    unit_kwh      = 261,
    unit_price    = 0,
    use_case      = 'tod_arbitrage',
    peak_tariff   = 10.50,
    offpeak_tariff = 5.50,
    roundtrip_eff  = 0.90,
    dod            = 0.90,
    state          = '',
    proposal_number = `OS/BESS/${new Date().getFullYear()}-XX`,
    doc_date       = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
    validity       = '30 Days from Date of Issue',
    solar_phase    = 'Future Phase',
    signatory_name  = 'Aditya Goel',
    signatory_title = 'Executive Director',
    delivery_days   = 90,
    warranty_years  = 5,
  } = cfg;

  const specs      = getModelSpecs(unit_model);
  const useCaseLabel = USE_CASE_LABELS[use_case] || use_case;
  const n          = parseInt(num_units)   || 1;
  const kw         = parseFloat(unit_kw)   || 125;
  const kwh        = parseFloat(unit_kwh)  || 261;
  const unitPr     = parseFloat(unit_price) || 0;
  const peakT      = parseFloat(peak_tariff)    || 10.50;
  const offpeakT   = parseFloat(offpeak_tariff) || 5.50;
  const rte        = parseFloat(roundtrip_eff)  || 0.90;
  const dodR       = parseFloat(dod)            || 0.90;

  const totalKw    = n * kw;
  const totalKwh   = n * kwh;
  const usableKwh  = totalKwh * dodR;
  const totalPrice = n * unitPr;
  const gstAmt     = totalPrice * 0.18;
  const totalWithGst = totalPrice + gstAmt;

  const stateStr = state ? ` — ${state}` : '';

  // ToD scenarios
  function todScenario(dispKwh) {
    const net = (dispKwh * peakT) - ((dispKwh / rte) * offpeakT);
    return { kwh: dispKwh, net_daily: net, annual: net * 365 };
  }
  const scenarios = [200, 500, 1000, usableKwh].map(todScenario);
  const payback   = totalPrice > 0 && scenarios[3].annual > 0
    ? (totalPrice / scenarios[3].annual).toFixed(1) : '—';

  // Logos
  const assetDir  = path.join(__dirname, 'assets');
  const ornateLogo = fs.readFileSync(path.join(assetDir, 'logo_ornate.png'));
  const unityLogo  = fs.readFileSync(path.join(assetDir, 'logo_unity.png'));

  // ── Header & Footer ──────────────────────────────────────────────────────
  const brandedHeader = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: { after: 100 },
        children: [
          new ImageRun({ type: 'png', data: ornateLogo, transformation: { width: 100, height: 36 },
            altText: { title: 'Ornate Solar', description: 'Ornate Solar Logo', name: 'ornate' } }),
          new TextRun('\t'),
          new ImageRun({ type: 'png', data: unityLogo, transformation: { width: 140, height: 27 },
            altText: { title: 'UnityESS', description: 'UnityESS Logo', name: 'unity' } }),
        ],
      }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ORANGE, space: 1 } },
        spacing: { after: 0 }, children: [],
      }),
    ],
  });

  const brandedFooter = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: GREY_BORDER, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: 'CONFIDENTIAL  |  Ornate Solar Pvt. Ltd.', font: FONT, size: 14, color: GREY_TEXT }),
          new TextRun('\t'),
          new TextRun({ text: 'Page ', font: FONT, size: 14, color: GREY_TEXT }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 14, color: GREY_TEXT }),
        ],
      }),
    ],
  });

  // ── Section 0: Title Block ───────────────────────────────────────────────
  const titleBlock = [
    new Paragraph({
      spacing: { before: 200, after: 0 },
      children: [new TextRun({ text: 'BUDGETARY COMMERCIAL PROPOSAL', font: FONT, size: 36, bold: true, color: DARK })],
    }),
    new Paragraph({
      spacing: { before: 60, after: 40 },
      children: [new TextRun({
        text: `UnityESS Model ${unit_model}  |  ${n} × ${kw} kW / ${kwh} kWh Battery Energy Storage System`,
        font: FONT, size: 20, color: ORANGE,
      })],
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ORANGE, space: 1 } },
      spacing: { after: 200 }, children: [],
    }),
    meta('Document Ref:', proposal_number, true),
    meta('Date:', doc_date),
    meta('Prepared for:', client_name),
    meta('Product:', `UnityESS Model ${unit_model} (${n} Unit${n > 1 ? 's' : ''})`),
    meta('Currency:', 'INR — Indian Rupees (Ex-GST)'),
    meta('Validity:', validity),
    sp(200),
  ];

  // ── Section 1: Cover Letter ──────────────────────────────────────────────
  const solarNote = solar_phase === 'Future Phase'
    ? ' It is also designed to integrate with rooftop solar PV in a future phase, enabling self-consumption arbitrage in addition to ToD optimisation.'
    : solar_phase === 'Included'
    ? ' This configuration includes provision for solar PV integration.'
    : '';

  const coverLetter = [
    h1(`1. Dear ${client_name},`),
    body(`We are pleased to present this Budgetary Commercial Proposal for the supply and commissioning of ${n === 1 ? 'one (1) unit' : `${n} units`} of the UnityESS Model ${unit_model} Battery Energy Storage System (BESS), constituting a combined ${totalKw} kW / ${totalKwh} kWh grid-tied energy storage installation${stateStr}.`),
    sp(100),
    body(`The UnityESS Model ${unit_model} is an all-in-one C&I BESS cabinet using LFP (Lithium Iron Phosphate) chemistry with active liquid cooling, certified to ${specs.certifications}. It is designed and manufactured in India by Ornate Solar Pvt. Ltd. under the UnityESS brand, and is scalable to ${specs.max_parallel} units in parallel — positioning this installation as a foundation for future capacity expansion.${solarNote}`),
    sp(100),
    body(`The proposed configuration is optimised for ${useCaseLabel}. Based on indicative ToD tariff data for ${state || 'your state'}, the system is projected to deliver annual savings of approximately ${inrCr(scenarios[3].annual)}, with an estimated payback of ${payback} years at full capacity utilisation — subject to actual DISCOM tariff schedule and site load profile.`),
    sp(100),
    body('We remain available to present this proposal in detail and look forward to your consideration.'),
    sp(200),
    body('Warm regards,', { bold: true }),
    body(signatory_name, { bold: true }),
    body(signatory_title, { color: ORANGE }),
    body('Ornate Solar Pvt. Ltd.  |  ornatesolar.com', { color: '888888' }),
    sp(100),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── Section 2: Technical Specifications ─────────────────────────────────
  const overviewRows = [
    ['BESS Configuration',     `${n} × UnityESS Model ${unit_model} (Parallel)`],
    ['Total Rated Power',      `${totalKw} kW AC`],
    ['Total Nameplate Energy', `${totalKwh.toLocaleString('en-IN')} kWh`],
    [`Usable Energy (${Math.round(dodR * 100)}% DoD)`, `${usableKwh.toLocaleString('en-IN')} kWh per cycle`],
    ['Battery Chemistry',      'LFP — Lithium Iron Phosphate'],
    ['Cooling System',         'Liquid Cooling (Active)'],
    ['Grid Interface',         specs.grid_voltage],
    ['Scalability',            `Up to ${specs.max_parallel} units in parallel`],
    ['Use Case',               useCaseLabel + (solar_phase === 'Future Phase' ? ' + Solar-Ready (Future Phase)' : '')],
    ['Certifications',         specs.certifications],
  ];

  const dcRows = [
    ['Battery Chemistry',     'LFP (Lithium Iron Phosphate)'],
    ['Cell Configuration',    specs.cell_config],
    ['Nominal DC Voltage',    specs.dc_nominal_v],
    ['DC Operating Range',    specs.dc_range_v],
    ['Energy per Unit',       `${kwh} kWh`],
    ['C-Rate',                '0.5C Charge / 0.5P Discharge'],
    ['Cycle Life',            specs.cycle_life],
    ['Calendar Life',         specs.calendar_life],
    ['Fire Suppression',      'Aerosol (Cabin-Level) + Optional Water System'],
    ['Operating Temperature', 'Discharge: −30°C to +55°C | Charge: 0°C to +55°C'],
  ];

  const pcsRows = [
    ['Rated AC Power',        `${kw} kW per unit / ${totalKw} kW total`],
    ['Grid Voltage',          specs.grid_voltage],
    ['Grid Configuration',    '3-Phase / N / PE'],
    ['Power Factor',          specs.pf],
    ['AC THD (Voltage)',      specs.thdu],
    ['Overload Capacity',     specs.overload],
    ['Conversion Efficiency', `Round-Trip ≥${Math.round(rte * 100)}%`],
    ['Communication',         specs.comms],
    ['Frequency',             '50 / 60 Hz (Selectable)'],
  ];

  const encRowsData = [];
  if (specs.unit_w_mm) {
    encRowsData.push(['Dimensions (per unit)', `${specs.unit_w_mm} mm (W) × ${specs.unit_d_mm} mm (D) × ${specs.unit_h_mm} mm (H)`]);
    encRowsData.push(['Weight (per unit)', `${specs.unit_kg.toLocaleString('en-IN')} kg`]);
    encRowsData.push([`Total Weight (${n} units)`, `${(n * specs.unit_kg).toLocaleString('en-IN')} kg`]);
  }
  const encRows = [
    ['Enclosure Rating',      'IP54 (System Cabinet) / IP66 (Battery Pack Top)'],
    ['Anti-Corrosion Class',  'C3-M / C4 / C5'],
    ['Noise Level',           '< 76 dB(A)'],
    ...encRowsData,
  ];

  const techSection = [
    h1('2. System Scope & Technical Specifications'),
    italic(`${n} UnityESS Model ${unit_model} unit${n > 1 ? 's' : ''} in parallel — ${totalKw} kW / ${totalKwh} kWh total. Specifications sourced from certified Model ${unit_model} datasheet.`),
    subhead('2a.  System Overview'), sp(80),
    kv2(overviewRows), sp(240),
    subhead('2b.  Technical Specifications by Sub-System'), sp(100),
    kv2WithHeader('DC Block / Battery Pack', 'Specification', dcRows), sp(160),
    kv2WithHeader('Power Conversion System (PCS)', 'Specification', pcsRows), sp(160),
    kv2WithHeader('Enclosure & Safety', 'Specification', encRows), sp(100),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── Section 3: ToD Savings ───────────────────────────────────────────────
  const todRows = scenarios.map((s, i) => {
    const label = i === 3 ? `${usableKwh.toFixed(1)} kWh\n(Full Capacity)` : `${Math.round(s.kwh)} kWh`;
    const chgCost = (s.kwh / rte) * offpeakT;
    const pkSave  = s.kwh * peakT;
    const rtLoss  = pkSave - s.net_daily - chgCost; // should be ~0 with simplified formula
    return new TableRow({ children: [
      dCell(label,            1900, { bold: true, shade: rs(i) }),
      dCell(inr(chgCost),     1600, { shade: rs(i), align: AlignmentType.RIGHT }),
      dCell(inr(pkSave),      1700, { shade: rs(i), align: AlignmentType.RIGHT }),
      dCell(inr(Math.abs(rtLoss)), 1400, { shade: rs(i), align: AlignmentType.RIGHT }),
      dCell(inr(s.net_daily), 1550, { shade: rs(i), align: AlignmentType.RIGHT }),
      dCell(inr(s.annual),    1596, { bold: true, shade: i === 3 ? MID_ORANGE : rs(i), align: AlignmentType.RIGHT }),
    ]});
  });

  const todTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1900, 1600, 1700, 1400, 1550, 1596],
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('Daily Discharge', 1900),
        hCell(`Off-Peak Charge (${inr(offpeakT)}/kWh)`, 1600),
        hCell(`Peak Saving (${inr(peakT)}/kWh)`, 1700),
        hCell('RT Loss', 1400),
        hCell('Net Daily Saving', 1550),
        hCell('Annual Saving', 1596),
      ]}),
      ...todRows,
    ],
  });

  const todSection = [
    h1('3. Indicative ToD Tariff Savings Analysis', true),
    italic('Scenario-based analysis showing annual savings at varying BESS utilisation levels. Based on indicative Indian industrial ToD tariff differential — actual savings subject to applicable DISCOM tariff schedule.'),
    todTable, sp(200),
    note(1, `Off-peak charge tariff assumed at ₹${offpeakT.toFixed(2)}/kWh (10PM – 6AM). Peak discharge tariff assumed at ₹${peakT.toFixed(2)}/kWh (6PM – 10PM). Net tariff differential: ₹${(peakT - offpeakT).toFixed(2)}/kWh.`),
    note(2, `Round-trip efficiency applied at ${Math.round(rte * 100)}% (per IEC 62619 rated specification). Actual RT efficiency may vary with ambient temperature and state-of-charge operating range.`),
    note(3, 'A complete load profile assessment including 30-day billing data and Maximum Demand (MD) register history is recommended to establish the correct utilisation tier for this savings model.'),
    note(4, `At full capacity utilisation (${usableKwh.toFixed(1)} kWh/day, 1 cycle/day), the ${n}-unit configuration delivers an indicative annual saving of ${inrCr(scenarios[3].annual)} — representing a payback period of approximately ${payback} years on the ex-GST system cost, subject to actual tariff and utilisation profile.`),
    solar_phase === 'Future Phase'
      ? note(5, 'Future integration of rooftop solar PV (planned Phase 2) will enable self-consumption arbitrage in addition to ToD optimisation, materially improving utilisation rates and shortening payback.')
      : sp(0),
    sp(100),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── Section 4: Commercial Offer ──────────────────────────────────────────
  const bomTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [500, 2400, 2800, 500, 500, 1400, 1246],
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('S.No', 500), hCell('Item Description', 2400), hCell('Technical Scope', 2800),
        hCell('UOM', 500), hCell('Qty', 500),
        hCell('Unit Price (Ex-GST)', 1400), hCell('Total (Ex-GST)', 1246),
      ]}),
      new TableRow({ children: [
        dCell('1', 500, { shade: rs(0), align: AlignmentType.CENTER }),
        dCell(`UnityESS Model ${unit_model}\nBattery Energy Storage System`, 2400, { bold: true, shade: rs(0) }),
        dCell(`${kw} kW / ${kwh} kWh | LFP | Liquid Cooled\nAll-in-One Cabinet | IP54 | C3–C5`, 2800, { shade: rs(0) }),
        dCell('Nos', 500, { shade: rs(0), align: AlignmentType.CENTER }),
        dCell(String(n), 500, { shade: rs(0), align: AlignmentType.CENTER }),
        dCell(unitPr > 0 ? inr(unitPr) : 'As Quoted', 1400, { shade: rs(0), align: AlignmentType.RIGHT }),
        dCell(unitPr > 0 ? inr(totalPrice) : 'As Quoted', 1246, { bold: true, shade: rs(0), align: AlignmentType.RIGHT }),
      ]}),
      new TableRow({ children: [
        dCell('2', 500, { shade: rs(1), align: AlignmentType.CENTER }),
        dCell('Factory Acceptance Testing (FAT)\nPer Unit Documentation Package', 2400, { bold: true, shade: rs(1) }),
        dCell('Cell / Pack Traceability | BCU Data\nFAT Certificate | QC Sign-off', 2800, { shade: rs(1) }),
        dCell('Lot', 500, { shade: rs(1), align: AlignmentType.CENTER }),
        dCell('1', 500, { shade: rs(1), align: AlignmentType.CENTER }),
        dCell('Included', 1400, { shade: rs(1), align: AlignmentType.RIGHT }),
        dCell('Included', 1246, { bold: true, shade: rs(1), align: AlignmentType.RIGHT }),
      ]}),
      new TableRow({ children: [
        dCell('3', 500, { shade: rs(2), align: AlignmentType.CENTER }),
        dCell('Commissioning & Site Integration\n(TBD with Site Survey)', 2400, { bold: true, shade: rs(2) }),
        dCell('PCS Commissioning | BMS Integration\nProtection Relay Coordination | Trial Run', 2800, { shade: rs(2) }),
        dCell('Lot', 500, { shade: rs(2), align: AlignmentType.CENTER }),
        dCell('1', 500, { shade: rs(2), align: AlignmentType.CENTER }),
        dCell('TBD', 1400, { shade: rs(2), align: AlignmentType.RIGHT }),
        dCell('TBD', 1246, { bold: true, shade: rs(2), align: AlignmentType.RIGHT }),
      ]}),
      ...(unitPr > 0 ? [
        new TableRow({ children: [
          dCell('', 500, { shade: MID_ORANGE }), dCell('Sub-Total (Ex-GST)', 2400, { bold: true, shade: MID_ORANGE }),
          dCell('', 2800, { shade: MID_ORANGE }), dCell('', 500, { shade: MID_ORANGE }),
          dCell('', 500, { shade: MID_ORANGE }), dCell('', 1400, { shade: MID_ORANGE }),
          dCell(inr(totalPrice), 1246, { bold: true, shade: MID_ORANGE, align: AlignmentType.RIGHT }),
        ]}),
        new TableRow({ children: [
          dCell('', 500, { shade: LIGHT_ORANGE }), dCell('GST @ 18%', 2400, { shade: LIGHT_ORANGE }),
          dCell('', 2800, { shade: LIGHT_ORANGE }), dCell('', 500, { shade: LIGHT_ORANGE }),
          dCell('', 500, { shade: LIGHT_ORANGE }), dCell('', 1400, { shade: LIGHT_ORANGE }),
          dCell(inr(gstAmt), 1246, { shade: LIGHT_ORANGE, align: AlignmentType.RIGHT }),
        ]}),
        new TableRow({ children: [
          dCell('', 500, { shade: MID_ORANGE }), dCell('TOTAL (Inclusive of GST)', 2400, { bold: true, shade: MID_ORANGE }),
          dCell('', 2800, { shade: MID_ORANGE }), dCell('', 500, { shade: MID_ORANGE }),
          dCell('', 500, { shade: MID_ORANGE }), dCell('', 1400, { shade: MID_ORANGE }),
          dCell(inr(totalWithGst), 1246, { bold: true, shade: MID_ORANGE, align: AlignmentType.RIGHT }),
        ]}),
      ] : []),
    ],
  });

  const termsRows = [
    ['Payment Terms',     '40% advance with Purchase Order | 60% prior to dispatch'],
    ['Delivery Schedule', `Ex-Works, Ornate Solar Factory | ${delivery_days} days from PO + advance receipt`],
    ['Warranty',          `${warranty_years} Years Comprehensive (Parts + Labour) from date of commissioning`],
    ['Proposal Validity', `${validity} (${doc_date})`],
  ];

  const exclusionRows = [
    ['Solar PV System',       'Any rooftop or ground-mount PV installation' + (solar_phase === 'Future Phase' ? ' (proposed as Phase 2)' : '')],
    ['Civil Works',           'Foundation pad, cable trenching, and civil infrastructure beyond standard BESS pad'],
    ['Grid Connectivity',     'HT/LT switchgear, transformer, and DISCOM interconnection works'],
    ['Metering & Protection', 'Energy metering, CT/PT, feeder protection relay (if not part of BESS scope)'],
    ['DISCOM Approvals',      'Net metering, grid interconnection approvals, and statutory fees'],
    ['Transportation',        'Freight from factory to site — to be quoted separately on site confirmation'],
  ];

  const exclusionTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [2800, 6946],
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('Exclusion Item', 2800), hCell('Detail', 6946)] }),
      ...exclusionRows.map((r, i) => new TableRow({ children: [
        dCell(r[0], 2800, { bold: true, shade: rs(i) }),
        dCell(r[1], 6946, { shade: rs(i) }),
      ]})),
    ],
  });

  const commercialSection = [
    h1('4. Commercial Offer'),
    italic(`Budgetary pricing for ${n} × UnityESS Model ${unit_model}. All prices in Indian Rupees (INR), exclusive of GST unless stated. Indian number formatting (Lakhs/Crores) applied.`),
    subhead('4a.  Bill of Materials'), sp(80),
    bomTable, sp(240),
    subhead('4b.  Commercial Terms'), sp(80),
    kv2(termsRows), sp(240),
    subhead('4c.  Exclusions from Scope'), sp(80),
    exclusionTable, sp(100),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── Section 5: Project Notes ─────────────────────────────────────────────
  const projectNotes = [
    `The ${n}-unit parallel configuration (${totalKw} kW / ${totalKwh} kWh) is designed within the UnityESS scalability envelope of ${specs.max_parallel} units maximum. This installation can be expanded to up to ${specs.max_parallel * kwh} kWh (${specs.max_parallel} × ${kwh} kWh) without architectural redesign.`,
    solar_phase === 'Future Phase'
      ? 'Solar PV integration (Phase 2) will require a DC-coupled or AC-coupled interface design. Ornate Solar can provide an integrated solar+storage proposal upon receipt of site irradiance data and shadow analysis.'
      : 'Solar PV integration scope (if applicable) will be detailed in a separate addendum upon receipt of site irradiance and shadow analysis data.',
    'A site assessment is required prior to final order to confirm: (a) available floor loading capacity, (b) adequate ventilation for liquid cooling heat rejection, (c) HT/LT switchgear configuration and interconnection point, and (d) applicable DISCOM tariff schedule for accurate ToD savings modelling.',
    'All units will be supplied with a Factory Acceptance Test (FAT) package covering cell traceability, pack traceability, MES manufacturing data, and BCU charge-discharge verification curves.',
    'Final pricing, delivery schedule, and technical scope are subject to site survey and detailed engineering review. This proposal is budgetary and indicative in nature.',
  ];

  // ── Section 6: Acceptance ────────────────────────────────────────────────
  const acceptTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [4873, 4873],
    rows: [
      new TableRow({ tableHeader: true, children: [
        hCell('For Ornate Solar Pvt. Ltd.', 4873), hCell('For Customer / Client', 4873),
      ]}),
      new TableRow({ children: [
        dCell('Signature: _________________________', 4873, { shade: LIGHT_ORANGE }),
        dCell('Signature: _________________________', 4873, { shade: LIGHT_ORANGE }),
      ]}),
      new TableRow({ children: [
        dCell(`Name:  ${signatory_name}`, 4873),
        dCell(`Name:  ${client_name}`, 4873),
      ]}),
      new TableRow({ children: [
        dCell(`Designation:  ${signatory_title}`, 4873, { shade: LIGHT_ORANGE }),
        dCell('Designation: ______________________', 4873, { shade: LIGHT_ORANGE }),
      ]}),
      new TableRow({ children: [
        dCell('Date: ____________________________', 4873),
        dCell('Date: ____________________________', 4873),
      ]}),
      new TableRow({ children: [
        dCell('Company Seal:', 4873, { shade: LIGHT_ORANGE }),
        dCell('Company Seal:', 4873, { shade: LIGHT_ORANGE }),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders, margins: cellMargins, width: { size: 4873, type: WidthType.DXA },
          children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: '', font: FONT, size: 40 })] })] }),
        new TableCell({ borders, margins: cellMargins, width: { size: 4873, type: WidthType.DXA },
          children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: '', font: FONT, size: 40 })] })] }),
      ]}),
    ],
  });

  // ── Assemble document ────────────────────────────────────────────────────
  const allContent = [
    ...titleBlock,
    ...coverLetter,
    ...techSection,
    ...todSection,
    ...commercialSection,
    h1('5. Project Notes & Technical Clarifications'),
    italic('Site-specific considerations and technical flags relevant to this configuration.'),
    ...projectNotes.map((n_, i) => note(i + 1, n_)),
    sp(240),
    h1('6. Acceptance', true),
    italic('Signature of both parties below constitutes acceptance of this budgetary proposal and its terms.'),
    acceptTable,
    new Paragraph({
      spacing: { before: 400, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: GREY_BORDER, space: 8 } },
      children: [
        new TextRun({ text: 'DISCLAIMER: ', font: FONT, size: 16, bold: true, color: ORANGE }),
        new TextRun({ text: 'This proposal is budgetary and indicative. Final pricing, delivery schedule, and technical scope are subject to site survey, detailed engineering review, and formal Purchase Order. All prices are ex-GST unless otherwise stated. Savings projections are based on indicative tariff data and are not guaranteed. Ornate Solar Pvt. Ltd. reserves the right to revise pricing after proposal validity expiry.', font: FONT, size: 16, color: '888888' }),
      ],
    }),
  ];

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 20, color: DARK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: FONT, color: ORANGE },
          paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: 1800, bottom: 1200, left: MARGIN_LR, right: MARGIN_LR },
        },
      },
      headers: { default: brandedHeader },
      footers: { default: brandedFooter },
      children: allContent,
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateBessProposalDocx };
