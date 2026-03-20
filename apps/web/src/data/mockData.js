// ─── Clients ────────────────────────────────────────────────────────────────
export const clients = [
  { id: 1, company_name: 'SunSure Energy', contact_person: 'Rajiv Mehta',     email: 'rajiv@sunsure.in',        phone: '9810001001', city: 'Gurugram',   state: 'Haryana',       gstin: '06AAACS1234A1Z5', created_at: '2025-11-10' },
  { id: 2, company_name: 'Bijlee Solar',   contact_person: 'Priya Sharma',    email: 'priya@bijleesolar.com',   phone: '9820002002', city: 'Pune',       state: 'Maharashtra',   gstin: '27AAACB5678B1Z1', created_at: '2025-12-02' },
  { id: 3, company_name: 'Amrita Hospitals', contact_person: 'Dr. K. Nair',   email: 'knair@amritahospitals.org', phone: '9830003003', city: 'Coimbatore', state: 'Tamil Nadu', gstin: '33AAACA9012C1Z8', created_at: '2026-01-15' },
  { id: 4, company_name: 'BSPGCL',         contact_person: 'Arun Kumar',      email: 'akumar@bspgcl.bih.nic.in', phone: '9840004004', city: 'Patna',      state: 'Bihar',         gstin: '10AAACB3456D1Z2', created_at: '2026-02-01' },
];

// ─── Sites ───────────────────────────────────────────────────────────────────
export const sites = [
  { id: 1, client_id: 1, site_name: 'SunSure Gurugram Plant',   state: 'Haryana',     discom: 'DHBVN', tariff_category: 'HT', sanctioned_load_kva: 1500, contract_demand_kva: 1200, connection_voltage_kv: 11 },
  { id: 2, client_id: 2, site_name: 'Bijlee Solar Pune Facility', state: 'Maharashtra', discom: 'MSEDCL', tariff_category: 'LT', sanctioned_load_kva: 500,  contract_demand_kva: 400,  connection_voltage_kv: 0.415 },
  { id: 3, client_id: 3, site_name: 'Amrita Hospitals Coimbatore', state: 'Tamil Nadu', discom: 'TANGEDCO', tariff_category: 'HT', sanctioned_load_kva: 2000, contract_demand_kva: 1800, connection_voltage_kv: 11 },
  { id: 4, client_id: 4, site_name: 'BSPGCL Bihar Grid Point', state: 'Bihar', discom: 'BSPHCL', tariff_category: 'EHT', sanctioned_load_kva: 50000, contract_demand_kva: 40000, connection_voltage_kv: 132 },
];

// ─── BESS Configurations ─────────────────────────────────────────────────────
export const bessConfigs = [
  { id: 1, site_id: 1, config_name: 'SunSure 2×UESS-125-261',  num_units: 2, total_power_kw: 250,   total_energy_kwh: 522,    coupling_type: 'AC', application: 'tod_arbitrage', soc_min: 10, soc_max: 90 },
  { id: 2, site_id: 2, config_name: 'Bijlee 1×UESS-125-261',   num_units: 1, total_power_kw: 125,   total_energy_kwh: 261,    coupling_type: 'AC', application: 'peak_shaving',  soc_min: 15, soc_max: 90 },
  { id: 3, site_id: 3, config_name: 'Amrita 1×UESS-125-261',   num_units: 1, total_power_kw: 125,   total_energy_kwh: 261,    coupling_type: 'AC', application: 'backup',        soc_min: 20, soc_max: 90 },
  { id: 4, site_id: 4, config_name: 'BSPGCL 40×UESS-125-261', num_units: 40, total_power_kw: 5000, total_energy_kwh: 10440,  coupling_type: 'AC', application: 'grid_support',  soc_min: 10, soc_max: 95 },
];

// ─── Proposals ───────────────────────────────────────────────────────────────
export const proposals = [
  { id: 1, client_id: 1, site_id: 1, bess_config_id: 1, proposal_number: 'UESS-2025-001', proposal_date: '2025-11-20', status: 'negotiation', capex_ex_gst: 18000000,  annual_savings: 3200000,  payback_years: 6.2, irr_percent: 14.8, validity_days: 90 },
  { id: 2, client_id: 2, site_id: 2, bess_config_id: 2, proposal_number: 'UESS-2025-002', proposal_date: '2025-12-10', status: 'sent',        capex_ex_gst: 9000000,   annual_savings: 1650000,  payback_years: 6.5, irr_percent: 13.9, validity_days: 60 },
  { id: 3, client_id: 3, site_id: 3, bess_config_id: 3, proposal_number: 'UESS-2026-001', proposal_date: '2026-01-22', status: 'sent',        capex_ex_gst: 9000000,   annual_savings: 1480000,  payback_years: 7.1, irr_percent: 12.6, validity_days: 60 },
  { id: 4, client_id: 4, site_id: 4, bess_config_id: 4, proposal_number: 'UESS-2026-002', proposal_date: '2026-02-05', status: 'analysis',    capex_ex_gst: 360000000, annual_savings: 62000000, payback_years: 6.8, irr_percent: 13.4, validity_days: 120 },
];

// ─── Projects ────────────────────────────────────────────────────────────────
export const projects = [
  { id: 1, client_id: 1, site_id: 1, proposal_id: 1, project_code: 'BESS-2025-001', status: 'negotiation',   po_value_inr: null,      installation_date: null,       commissioning_date: null },
  { id: 2, client_id: 2, site_id: 2, proposal_id: 2, project_code: 'BESS-2025-002', status: 'proposal',      po_value_inr: null,      installation_date: null,       commissioning_date: null },
  { id: 3, client_id: 3, site_id: 3, proposal_id: 3, project_code: 'BESS-2026-001', status: 'proposal',      po_value_inr: null,      installation_date: null,       commissioning_date: null },
  { id: 4, client_id: 4, site_id: 4, proposal_id: 4, project_code: 'BESS-2026-002', status: 'analysis',      po_value_inr: null,      installation_date: null,       commissioning_date: null },
];

// ─── Units (UnityESS Product Catalogue) ──────────────────────────────────────
export const units = [
  { id: 1, model: 'UESS-125-261',   power_kw: 125,  energy_kwh: 261,   chemistry: 'LFP', dimensions_mm: '20ft Container', weight_kg: 18000, price_ex_gst: 9000000,   is_active: true },
  { id: 2, model: 'UESS-200-418',   power_kw: 200,  energy_kwh: 418,   chemistry: 'LFP', dimensions_mm: '20ft Container', weight_kg: 22000, price_ex_gst: 14500000,  is_active: true },
  { id: 3, model: 'UESS-250-522',   power_kw: 250,  energy_kwh: 522,   chemistry: 'LFP', dimensions_mm: '40ft Container', weight_kg: 28000, price_ex_gst: 18000000,  is_active: true },
  { id: 4, model: 'UESS-500-1044',  power_kw: 500,  energy_kwh: 1044,  chemistry: 'LFP', dimensions_mm: '40ft Container', weight_kg: 42000, price_ex_gst: 34000000,  is_active: false },
];

// ─── Tariff Structures ───────────────────────────────────────────────────────
export const tariffs = [
  { id: 1, state: 'Haryana',      discom: 'DHBVN',    tariff_category: 'HT',  energy_charge_peak: 9.50, energy_charge_offpeak: 5.50, demand_charge: 350, effective_date: '2024-04-01' },
  { id: 2, state: 'Maharashtra',  discom: 'MSEDCL',   tariff_category: 'LT',  energy_charge_peak: 10.20, energy_charge_offpeak: 6.10, demand_charge: 380, effective_date: '2024-04-01' },
  { id: 3, state: 'Tamil Nadu',   discom: 'TANGEDCO', tariff_category: 'HT',  energy_charge_peak: 8.80, energy_charge_offpeak: 5.20, demand_charge: 320, effective_date: '2024-04-01' },
  { id: 4, state: 'Bihar',        discom: 'BSPHCL',   tariff_category: 'EHT', energy_charge_peak: 7.90, energy_charge_offpeak: 4.80, demand_charge: 290, effective_date: '2024-04-01' },
];

// ─── Load Profiles (sample months for site 1) ────────────────────────────────
export const loadProfiles = [
  { id: 1, site_id: 1, month: 10, year: 2025, total_units_kwh: 182400, max_demand_kw: 920, tod_peak_kwh: 73000, tod_offpeak_kwh: 62000, tod_night_kwh: 47400 },
  { id: 2, site_id: 1, month: 11, year: 2025, total_units_kwh: 176800, max_demand_kw: 890, tod_peak_kwh: 70500, tod_offpeak_kwh: 60200, tod_night_kwh: 46100 },
  { id: 3, site_id: 1, month: 12, year: 2025, total_units_kwh: 168000, max_demand_kw: 850, tod_peak_kwh: 67000, tod_offpeak_kwh: 57500, tod_night_kwh: 43500 },
  { id: 4, site_id: 1, month:  1, year: 2026, total_units_kwh: 171000, max_demand_kw: 860, tod_peak_kwh: 68200, tod_offpeak_kwh: 58500, tod_night_kwh: 44300 },
  { id: 5, site_id: 1, month:  2, year: 2026, total_units_kwh: 155200, max_demand_kw: 820, tod_peak_kwh: 61800, tod_offpeak_kwh: 53000, tod_night_kwh: 40400 },
  { id: 6, site_id: 1, month:  3, year: 2026, total_units_kwh: 165000, max_demand_kw: 840, tod_peak_kwh: 65800, tod_offpeak_kwh: 56500, tod_night_kwh: 42700 },
];

// ─── Pipeline chart data ──────────────────────────────────────────────────────
export const pipelineStages = [
  { stage: 'Lead',        count: 0, value_cr: 0 },
  { stage: 'Analysis',    count: 1, value_cr: 36 },
  { stage: 'Proposal',    count: 2, value_cr: 1.8 },
  { stage: 'Negotiation', count: 1, value_cr: 1.8 },
  { stage: 'PO Received', count: 0, value_cr: 0 },
  { stage: 'Commissioned',count: 0, value_cr: 0 },
];

// ─── Monthly activity ─────────────────────────────────────────────────────────
export const monthlyActivity = [
  { month: 'Oct 25', proposals: 1, won: 0 },
  { month: 'Nov 25', proposals: 1, won: 0 },
  { month: 'Dec 25', proposals: 1, won: 0 },
  { month: 'Jan 26', proposals: 1, won: 0 },
  { month: 'Feb 26', proposals: 1, won: 0 },
  { month: 'Mar 26', proposals: 0, won: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const fmt = {
  inr: (v) => {
    if (!v && v !== 0) return '—';
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)} Cr`;
    if (v >= 100000)   return `₹${(v / 100000).toFixed(1)} L`;
    return `₹${v.toLocaleString('en-IN')}`;
  },
  num: (v, unit = '') => v != null ? `${v.toLocaleString('en-IN')}${unit ? ' ' + unit : ''}` : '—',
};

export const clientName   = (id) => clients.find(c => c.id === id)?.company_name  ?? '—';
export const siteName     = (id) => sites.find(s => s.id === id)?.site_name        ?? '—';
export const configName   = (id) => bessConfigs.find(b => b.id === id)?.config_name ?? '—';
export const proposalNum  = (id) => proposals.find(p => p.id === id)?.proposal_number ?? '—';
