# BESS Portal — Complete Workflow Reference
**UnityESS Sizing, Finance & Project Engine**
Last updated: March 2026

---

## 1. System Overview

The portal has two parallel tracks that are meant to connect:

```
BESS CONFIGURATOR (sizing + finance)
        │
        └─── saves to DB ──► sizing_analyses
                          ► recommendation_records
                          ► finance_records
                          ► proposals

BD PIPELINE (accounts + opportunities + workflow)
        │
        └─── accounts ──► contacts ──► opportunities
                                    ► activities
                                    ► follow-ups
                                    ► approvals
```

These two tracks are **not yet linked** — connecting a sizing analysis to a BD opportunity is a pending P3 item.

---

## 2. The Sizing Engine — Step by Step

### Step 1: Select use case
User picks one of two use cases in the Sizing Tool tab:
- **DG Replacement** — savings come from displaced diesel
- **ToD Arbitrage** — savings come from peak/off-peak tariff spread

### Step 2: Set inputs

| Use Case | Required Inputs |
|---|---|
| DG Replacement | Critical load (kW), backup duration (hrs), fuel cost (₹/L), DG efficiency (L/kWh), operating days/yr |
| ToD Arbitrage | Daily dispatch (kWh), peak tariff (₹/kWh), off-peak tariff (₹/kWh), peak window (hrs), operating days/yr |

Also set at this step:
- **SKU Category** — Cabinet or Container (filters which SKUs are shown)
- **State** — auto-fills peak/off-peak tariffs from the tariff master for ToD projects
- **Client** — optional, links the analysis to a client record in DB

### Step 3: Engine calculates validated requirement

```
DG case:
  raw_energy_kwh       = load_kw × backup_hrs
  dg_cost_per_kwh      = dg_efficiency × fuel_price       (₹/kWh from DG)
  grid_charge          = ₹3/kWh                           (hardcoded default)
  net_benefit_per_kwh  = dg_cost_per_kwh − 3
  annual_savings       = load_kw × hrs × days × net_benefit  (only if net > 0)

ToD case:
  raw_energy_kwh       = dispatch_kwh / 0.85              (derated for AC losses)
  annual_savings       = dispatch_kwh × (peak − offpeak) × days
```

Then derating is applied:
```
derate_factor          = AC/DC loss (5%) + SOC reserve (10%) = 15%
validated_energy_kwh   = raw_energy_kwh / (1 − 0.15)
```

This validated requirement is the only number the SKU matching uses.

### Step 4: Two configurations generated per SKU

For every active SKU in the selected category:

```
ECONOMICAL:
  units = ceil(validated_energy_kwh / sku.energy_kwh)
  — nameplate-based minimum. Meets requirement on paper.

RECOMMENDED:
  dispatch_factor = yr1_soh × yr1_rte × soc_window   (≈ 0.81 for standard dataset)
  units = ceil(validated_energy_kwh × 1.15 / (sku.energy_kwh × dispatch_factor))
  — based on actual dispatchable energy, with 15% buffer.
  — ensures real-world delivery matches the requirement.
```

This produces a **coverage table** — all SKUs in the category shown side by side with their economical and recommended unit counts and CAPEX.

### Step 5: AI narrative (non-blocking)

After sizing runs, Gemini is called asynchronously with the sizing result. It returns commentary on:
- Why the recommended config is more practical
- What the extra capacity buys operationally
- Whether the IRR is strong/moderate/weak for Indian C&I context
- Any relevant regulatory flags (CERC, IS 16270, CEA)

Gemini does **not** calculate anything. All numbers come from the rule engine above.

### Step 6: Apply or Save

From the result cards, the user can:
- **Apply Economical / Apply Recommended** — loads that unit count into the main BESS Configurator panel, updates the financial model instantly
- **Save** — persists the sizing analysis, recommendation record, and finance record to the database with a full cashflow snapshot

---

## 3. The Financial Model — How It Works

The financial model runs **continuously** in the left panel. Every change to any input recalculates all outputs in real time.

### Inputs that drive the model

| Input | Where Set | Effect |
|---|---|---|
| Number of units | Unit selector / Apply button | Changes CAPEX, nameplate kWh, all savings |
| Selected SKU | Unit selector | Changes energy/power/price |
| State | State selector (Financial Assumptions) | Auto-sets Tariff Δ from tariff master |
| DISCOM | DISCOM selector (if multiple in state) | Refines Tariff Δ |
| Tariff Δ (₹/kWh) | Direct input — auto-filled but overridable | Drives all savings calculations |
| Cycle dataset | Degradation Profile selector | Controls year-by-year SOH/RTE decay |

### Tariff linkage — the cascade

```
State selected
    │
    ▼
Tariff master lookup (bess.tariff_structures)
    │
    ▼
tariffDiff = energy_charge_peak − energy_charge_offpeak
    │
    ▼
grossSavYr1 = atMeterYr1 × tariffDiff × cyclesPerYear
    │
    ▼
annualSavings = grossSavYr1 − omYr1
    │
    ▼
cashflows[0..10] recalculated with degradation
    │
    ├── IRR (Newton-Raphson NPV)
    ├── Simple payback
    ├── Break-even year
    ├── NPV at 10% discount rate
    └── 10-yr ROI
```

Every output updates within the same render cycle. No button to press.

### Degradation model

Three cycle datasets are available (IEC-certified LFP test data):

| Dataset | C-Rate | Cycles/yr | Use Case |
|---|---|---|---|
| `q25c_365` | 0.25C | 365 | Standard C&I ToD — once-daily |
| `h5c_365` | 0.5C | 365 | Heavy-duty C&I |
| `h5c_730` | 0.5C | 730 | Twice-daily arbitrage |

Each dataset has a year-by-year SOH and RTE table. At year N:
```
at_meter_kwh[N] = nameplate_kwh × soh[N] × soc_window × rte[N]
gross_benefit[N] = at_meter_kwh[N] × tariffDiff × cycles_per_year
om_cost[N]       = capex × 1.5% × (1.03)^(N−1)    (escalates 3%/yr)
net_cashflow[N]  = gross_benefit[N] − om_cost[N]
```

If the project horizon exceeds the dataset length, the last year's SOH/RTE is held flat (conservative plateau, no extrapolation).

### Output metrics

| Metric | Formula | Notes |
|---|---|---|
| Annual savings (Yr-1) | Gross benefit − O&M Yr-1 | Used for simple payback |
| Simple payback | CAPEX / annual savings Yr-1 | Pre-degradation, indicative |
| Break-even year | First year cumulative net ≥ CAPEX | Degradation-adjusted |
| IRR (10-yr) | Newton-Raphson on cashflows[0..10] | Most accurate metric |
| NPV (10-yr) | Discounted at 10% | Absolute value created |
| ROI (10-yr) | Sum(net cashflows) / CAPEX × 100 | Undiscounted return |

---

## 4. Tariff Master

**14 states seeded, 27 tariff rows total.**

States: Andhra Pradesh, Bihar, Delhi, Gujarat, Haryana, Karnataka, Kerala, Madhya Pradesh, Maharashtra, Punjab, Rajasthan, Tamil Nadu, Telangana, Uttar Pradesh.

Each row stores: `state`, `discom`, `tariff_category`, `energy_charge_peak`, `energy_charge_offpeak`, `demand_charge`, `fixed_charge`, `effective_date`.

The spread (`peak − offpeak`) is computed at runtime — not stored as a column.

---

## 5. What Gets Saved to the Database

When the user clicks **Save** on a sizing result card, three records are written atomically:

### `bess.sizing_analyses`
The locked validated requirement — what the engine calculated before SKU matching.
- use case, state, category, all raw inputs
- raw_energy_kwh, validated_energy_kwh, required_power_kw
- assumptions snapshot (soc_window, derate, uplift %)

### `bess.recommendation_records`
The two configurations for the selected SKU.
- sku snapshot (model, kWh, kW, price at save time)
- economical: units, total kWh/kW, CAPEX
- recommended: units, total kWh/kW, CAPEX, dispatchable kWh yr-1
- selected_config — which one the user chose
- coverage_table — all SKUs vs requirement, stored as JSON
- gemini_commentary — AI narrative, stored to avoid re-calling

### `bess.finance_records`
Full 10-year cashflow model for the chosen configuration.
- all inputs snapshot: CAPEX, benefit/kWh, cycles/yr, O&M rates
- cashflow_rows: year-by-year array (at_meter_kwh, gross, O&M, net)
- summary: payback, break-even year, IRR, NPV, ROI

---

## 6. BD Pipeline — Current State

Separate from the sizing engine. Lives at `/bd/*` routes.

```
Accounts (companies)
    │
    ├── Contacts (people at the account)
    │
    └── Opportunities (deals)
            │
            ├── Activities (calls, emails, meetings — time-stamped log)
            ├── Follow-ups (pending queue with due dates)
            └── Approvals (internal sign-off records)
```

### Dashboard metrics (live)
- Pipeline value by stage
- Overdue follow-ups
- Pending approvals
- Stale deals (no activity in N days)
- Hot deals (recent activity, high value)

### What is NOT yet connected
The BD pipeline and the BESS sizing engine are separate. A BESS sizing analysis cannot currently be attached to a BD opportunity. This is the P3 workflow linkage item.

---

## 7. What is Still Missing (Honest State)

| Item | Priority | Current State |
|---|---|---|
| Container pricing | P0 | 6 SKUs at ₹0 — finance model shows ₹0 for containers |
| BD ↔ Sizing linkage | P3 | Two separate systems — no bridge |
| Assumptions master in DB | P2 | Hardcoded: soc=90%, uplift=15%, O&M=1.5%, escalation=3% |
| Cycle datasets in DB | P2 | Hardcoded JS constant — not editable without a code deploy |
| Snapshot immutability | P2 | SKU prices at save time are captured but master price changes are not blocked from affecting old records |
| Use case master in DB | P2 | Hardcoded in frontend |
| Workflow stage machine | P3 | Projects table has no stage field or transition validation |

---

## 8. Data Flow Diagram

```
USER INPUT
    │
    ├─► STATE SELECTOR ──► Tariff master lookup ──► tariffDiff ──► All finance outputs
    │
    ├─► SIZING TOOL
    │       │
    │       ├─► Use case + inputs
    │       ├─► Validated requirement (rule engine)
    │       ├─► Coverage table (all SKUs vs requirement)
    │       ├─► Economical config (nameplate-based)
    │       ├─► Recommended config (dispatchable-based)
    │       ├─► Gemini narrative (async, non-blocking)
    │       └─► Save ──► sizing_analyses + recommendation_records + finance_records
    │
    └─► MAIN CONFIGURATOR (left panel)
            │
            ├─► Unit selector ──► kWh/kW/CAPEX
            ├─► Cycle dataset ──► SOH/RTE year-by-year
            ├─► Tariff Δ ──► (auto-filled from state, overridable)
            │
            └─► FINANCE MODEL (always live)
                    ├─► Annual savings Yr-1
                    ├─► Break-even year
                    ├─► Simple payback
                    ├─► IRR (10-yr NPV)
                    ├─► NPV at 10%
                    └─► ROI (10-yr)
```

---

## 9. Key Rules That Never Change

These are hardcoded by design (per Fateh confirmation) and must not be moved to configurable inputs without an explicit decision:

- **Grid charge for DG replacement**: ₹3/kWh (the cost of charging from grid instead of DG)
- **IRR method**: NPV-based Newton-Raphson (not simple ROI)
- **O&M default**: 1.5% of CAPEX, escalating 3%/yr
- **SOC window**: 10% top + 10% bottom = 80% usable (0.90 net)
- **Recommended uplift**: 15% over economical
- **AC/DC conversion loss**: 5%
- **Gemini role**: Narrative only — never calculates, never overrides numbers

---

*Portal: unityess-bess-portal.vercel.app | API: unityess-bess-api.vercel.app*
