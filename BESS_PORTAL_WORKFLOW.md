# BESS Portal — Revised Operating Workflow
**UnityESS Sizing, Finance & Project Engine**
Revision 2 — March 2026

---

## 1. Governing Principle

This system is **project-wise**, not model-wise or SKU-wise.

Every sizing run, every financial output, every recommendation exists inside a project context. A project carries its own assumptions, its own tariff basis, its own cycle dataset, and its own approval trail. Changing the SKU master tomorrow must not change what a locked project said yesterday.

The system is one integrated operating flow:

```
Account → Opportunity → Project → Sizing → Recommendation → Finance → Proposal → Approval → Technical Compliance → Client
```

Not two loosely connected systems. Not a calculator bolted onto a CRM.

---

## 2. Module Hierarchy

```
MASTER DATA LAYER (configurable, not hardcoded)
  ├── SKU Master
  ├── Use Case Master
  ├── Tariff Master (state-linked)
  ├── Cycle-Data Master (multiple datasets)
  └── Assumptions Master

ACCOUNT / OPPORTUNITY LAYER
  ├── Accounts
  ├── Contacts (under Account)
  └── Opportunities (under Account)

PROJECT LAYER (core operating unit)
  ├── Project Record (locked to Opportunity)
  ├── Project Assumptions Snapshot
  └── Stage Machine (10 stages)

SIZING ENGINE (runs inside Project)
  ├── Requirement Calculator
  ├── Nameplate vs Dispatchable Logic
  ├── Coverage Table Generator
  └── Recommendation Selector (Economical + Recommended)

FINANCIAL MODEL (runs inside Project, driven by Sizing output)
  ├── Benefit Engine (use-case driven)
  ├── Tariff Linkage (state → tariff master → benefit/kWh)
  ├── Degradation Model (cycle dataset → year-by-year output)
  └── Output Metrics (IRR, payback, break-even, NPV, ROI)

PROPOSAL HANDOFF PACKAGE
  ├── Configuration Snapshot
  ├── Assumptions Snapshot
  ├── Tariff Snapshot
  ├── Financial Summary
  └── Cycle Dataset Reference

WORKFLOW ENGINE
  ├── Stage Machine (transitions, validation)
  ├── Activity Queue (pending)
  ├── Activity Log (completed history)
  └── Approval Record

AI LAYER (Gemini — explanation only)
  └── Commentary on recommendation, trade-offs, regulatory context
```

---

## 3. Data Relationship Structure

```
Account
  │
  ├── Contact (1..N per Account)
  │
  └── Opportunity (1..N per Account)
          │
          └── Project (1 per Opportunity, or N for multi-site)
                  │
                  ├── Sizing Analysis (1..N — versioned runs)
                  │       └── Requirement (validated_kwh, required_kw, sizing_basis)
                  │
                  ├── Recommendation Record (1 per Sizing Analysis)
                  │       ├── Coverage Table (all SKUs vs requirement)
                  │       ├── Economical Configuration
                  │       ├── Recommended Configuration
                  │       └── Selected Configuration
                  │
                  ├── Finance Record (1 per selected Configuration)
                  │       ├── Cashflow Rows (year 1..N)
                  │       ├── Tariff Snapshot (frozen at save)
                  │       ├── Cycle Dataset Snapshot (frozen at save)
                  │       └── Summary Metrics (IRR, payback, break-even, NPV, ROI)
                  │
                  ├── Proposal Handoff Package (generated at Proposal stage)
                  │
                  ├── Approval Record
                  │
                  └── Activity Log (all actions, time-stamped)
```

**Rules:**
- A Contact belongs to an Account, never directly to a Project
- A Project belongs to an Opportunity
- A Sizing Analysis belongs to a Project — not a free-standing calculation
- All master data values (SKU price, tariff, assumptions, cycle data) are **snapshotted** into the project record at the moment of proposal milestone. Changes to masters after that point do not affect the locked project.

---

## 4. Stage Machine

Ten stages, forward-only except ON_HOLD.

| # | Stage | Entry Condition | Key Output |
|---|---|---|---|
| 1 | Lead / Opportunity | Account and contact exist | Opportunity record created |
| 2 | Project Qualification | Use case and site state identified | Project record created, linked to Opportunity |
| 3 | BDA Sizing | Project inputs complete | Sizing analysis run, validated requirement locked |
| 4 | Commercial Review | Sizing locked, configuration selected | Finance record generated, IRR / payback reviewed |
| 5 | Proposal Drafted | Finance reviewed and accepted | Proposal handoff package generated, snapshots frozen |
| 6 | Internal Approval | Proposal drafted | Approval record created, routed for sign-off |
| 7 | Technical Compliance | Approval received | Compliance checklist initiated (IS 16270, IEC 62619, CEA) |
| 8 | Client Submission | Technical compliance complete | Proposal submitted to client |
| 9 | Negotiation / Revision | Client response received | Revision tracked, re-approval if configuration changes |
| 10 | Closed Won / Lost | Final client decision | Project marked won or lost, reason logged |

**Transition rules:**
- Stage 3 (BDA Sizing) cannot be entered without a project record linked to an opportunity
- Stage 5 (Proposal Drafted) triggers snapshot freeze — tariff, assumptions, cycle data, SKU cost all locked
- Stage 6 (Internal Approval) cannot be entered without a completed finance record
- If configuration changes after Stage 5, the stage reverts to Stage 4 and a new snapshot is required
- ON_HOLD can be set from any active stage and returns to the same stage on resume

---

## 5. Sizing Engine Logic

### 5.1 Input Collection

Sizing inputs are tied to the project record, not entered in isolation.

| Field | DG Replacement | ToD Arbitrage |
|---|---|---|
| Critical load (kW) | Required | Optional |
| Backup / runtime hours | Required | — |
| Diesel price (₹/L) | Required | — |
| DG efficiency (L/kWh) | Required | — |
| Operating days/yr | Required | Required |
| Daily dispatch (kWh) | — | Required |
| Peak window (hrs) | — | Required |
| State | Required | Required |
| SKU category | Required | Required |

### 5.2 Requirement Calculation

```
DG REPLACEMENT:
  raw_energy_kwh       = critical_load_kw × runtime_hrs
  dg_cost_per_kwh      = dg_efficiency_l_kwh × diesel_price_rs_l
  grid_charge          = 3.00  (₹/kWh — fixed planning default)
  net_benefit_per_kwh  = dg_cost_per_kwh − grid_charge
  annual_savings       = critical_load_kw × runtime_hrs × days × net_benefit   [only if net > 0]

TOD ARBITRAGE:
  raw_energy_kwh       = dispatch_kwh / (1 − ac_dc_loss)
  annual_savings       = dispatch_kwh × tod_spread × days
  tod_spread           = peak_tariff − offpeak_tariff   [from tariff master, state-linked]

DERATING (both cases):
  derate_factor        = ac_dc_loss_pct + soc_reserve_pct     (default: 5% + 10% = 15%)
  validated_energy_kwh = raw_energy_kwh / (1 − derate_factor)
  required_power_kw    = derived from load or dispatch / window
```

The `validated_energy_kwh` is the only number that flows into SKU matching. It is stored immutably on the sizing analysis record.

### 5.3 Nameplate vs Dispatchable — Explicit Distinction

This distinction drives the difference between the two recommendation types.

| Concept | Definition | Used For |
|---|---|---|
| Nameplate capacity | Rated energy per unit × number of units | Specification, compliance, datasheet |
| Dispatchable energy | Nameplate × SOH × RTE × SOC window | Actual energy available at meter |
| Compliance mode | Meet requirement on nameplate basis | Economical configuration |
| Performance mode | Meet requirement on dispatchable basis | Recommended configuration |

**Example:** 5 MWh nameplate system with SOH 0.96, RTE 0.94, SOC window 0.90 delivers approximately 4.07 MWh dispatchable. For a 4 MWh requirement, economical may just pass compliance. Recommended must ensure 4 MWh actually reaches the meter.

### 5.4 Economical Configuration

```
Purpose: minimum practical solution, nameplate-based
Rule:    units = ceil(validated_energy_kwh / sku.energy_kwh)
Basis:   nameplate capacity meets or exceeds validated requirement
Suitable for: compliance requirements, budget-constrained cases, indicative quotes
```

### 5.5 Recommended Configuration

```
Purpose: practical solution, dispatchable-energy-based, with planning margin
Rule:    dispatch_factor = soh_yr1 × rte_yr1 × soc_window
         units = ceil(validated_energy_kwh × (1 + uplift_pct) / (sku.energy_kwh × dispatch_factor))
Basis:   actual deliverable energy at meter meets requirement after real-world losses
Uplift:  default 15% — treated as a planning assumption, not a fixed formula
         stored in assumptions master, overridable per project
Suitable for: all real performance commitments, client proposals, bankable cases
```

The 15% uplift absorbs: (a) degradation over the first 2–3 years, (b) partial charge cycles, (c) ambient temperature derating, (d) contingency for dispatch scheduling gaps.

### 5.6 Coverage Table

Generated for all active SKUs in the selected category. Shows economical and recommended unit count and CAPEX for every SKU against the same validated requirement. Stored as a JSON snapshot on the recommendation record. Purpose: give the account manager a single view to decide which SKU makes commercial sense for this project.

### 5.7 Best Project Recommendation Output

The coverage table is an internal tool. The output facing the client is:

```
Best Economical Option:
  - Selected SKU + unit count
  - Nameplate kWh / kW
  - CAPEX ex-GST
  - Sizing basis and headroom

Best Recommended Option:
  - Selected SKU + unit count
  - Nameplate kWh / kW
  - Dispatchable kWh (year 1)
  - CAPEX ex-GST
  - Why it was selected for this project

Financial Summary (recommended option):
  - Annual savings Yr-1
  - Simple payback
  - Break-even year
  - IRR (10-yr NPV)
  - Cycle dataset used

Suitability Note (Gemini-generated):
  - Key sizing driver
  - Trade-off commentary
  - Regulatory context
```

---

## 6. Benefit Engine

Benefits are **use-case driven**, not a generic tariff field. Each use case defines its own benefit calculation method.

### 6.1 DG Replacement

```
gross_benefit_per_kwh  = dg_efficiency × diesel_price         (diesel cost avoided)
net_benefit_per_kwh    = gross_benefit_per_kwh − grid_charge  (minus charging cost)
annual_benefit         = dispatch_kwh × net_benefit × operating_days
```

Grid charge default: ₹3/kWh. Fixed by design. Overridable per project in assumptions master.

### 6.2 ToD / Charge-Discharge Arbitrage

```
benefit_per_kwh        = peak_tariff − offpeak_tariff         (from tariff master)
annual_benefit         = dispatch_kwh × benefit_per_kwh × operating_days
```

Tariff values come from the tariff master, state-linked. Manual override allowed per project but must be logged.

### 6.3 Future Use Cases (defined but not yet built)

| Use Case | Benefit Driver | Status |
|---|---|---|
| Peak demand shaving | Demand charge avoided (₹/kVA/month) | Deferred |
| Solar self-consumption | Grid import rate on solar excess | Deferred |
| Backup / UPS | DG avoidance + uptime value | Deferred |
| Hybrid (DG + ToD) | Blended benefit across both modes | Deferred |

Each use case, when added, must define its own benefit formula in the use case master — not hardcoded in the sizing engine.

---

## 7. Tariff → Finance Cascade

Tariff is a **core financial driver**, not a side assumption.

```
Project state selected
    │
    ▼
Tariff master lookup (state + DISCOM + tariff category)
    │
    ▼
peak_tariff, offpeak_tariff, demand_charge fetched
    │
    ▼
tod_spread = peak − offpeak
    │
    ▼
benefit_per_kwh = tod_spread  (ToD case)
    │
    ▼
gross_benefit_yr1 = at_meter_kwh_yr1 × benefit_per_kwh × cycles_per_year
    │
    ▼
annual_savings_yr1 = gross_benefit_yr1 − om_yr1
    │
    ├── Simple payback
    ├── Break-even year
    └── Cashflows[0..N] → IRR, NPV, ROI
```

Any change to tariff input immediately recalculates the entire chain. No intermediate steps, no manual refresh.

At proposal milestone: the tariff row used is snapshotted into the finance record. Future tariff master updates do not affect the locked proposal.

---

## 8. Degradation / Cycle Model

### 8.1 Why Degradation Belongs Near Recommendation, Not Just Finance

Degradation affects how much energy the system can actually deliver. A recommended configuration that looks adequate on day 1 may fail to meet the requirement by year 3 at high cycle rates. The cycle dataset should therefore inform both:
- The recommended unit count (via the dispatchable factor using Yr-1 SOH/RTE)
- The financial model (year-by-year output decay)

### 8.2 Cycle Dataset Structure

```
cycle_dataset {
  dataset_id
  label              // "0.25C · 365 cycles/yr" or "Cell 1", "Cell 2", etc.
  c_rate             // 0.25 | 0.5 | 1.0
  cycles_per_year    // 365 | 730
  chemistry          // "LFP"
  source             // "IEC test" | "manufacturer" | "modelled"
  years[]: {
    year             // 1..N
    soh              // State of Health (decimal)
    rte              // Round-Trip Efficiency (decimal)
  }
}
```

Multiple datasets are available (Cell 1 through Cell 5 or equivalent). One dataset is selected per project. The selection is stored on the recommendation record.

### 8.3 Year-by-Year Output

```
FOR year t IN 1..horizon:
  row            = dataset.years[t] ?? dataset.years[last]   // plateau if beyond dataset
  at_meter_kwh   = nameplate_kwh × row.soh × soc_window × row.rte
  gross_benefit  = at_meter_kwh × benefit_per_kwh × cycles_per_year
  om_cost        = capex × om_rate × (1 + om_escalation)^(t−1)
  net_cashflow   = gross_benefit − om_cost
```

Plateau rule: if horizon exceeds dataset length, last year's SOH/RTE is held constant. No extrapolation.

### 8.4 What the Cycle Dataset Reference Should Say

When a recommendation is presented, the cycle dataset used must be clearly stated:

> "Recommendation based on 0.5C / 365 cycles/yr dataset. At this cycle rate, Yr-1 dispatchable energy is X kWh, declining to Y kWh by Yr-10. IRR assumes this degradation profile."

This is Gemini's job — not the rule engine's.

---

## 9. Financial Output Metrics

| Metric | Formula | Notes |
|---|---|---|
| Annual savings Yr-1 | Gross benefit Yr-1 − O&M Yr-1 | Pre-degradation baseline |
| Simple payback | CAPEX / annual savings Yr-1 | Indicative — does not account for degradation |
| Break-even year | First year cumulative net cashflow ≥ CAPEX | Degradation-adjusted |
| IRR (10-yr) | Newton-Raphson NPV on cashflows[0..10] | Primary investment metric |
| NPV (10-yr) | Σ cashflow[t] / (1+r)^t at 10% discount rate | Absolute value created |
| ROI (10-yr) | Σ net cashflows[1..10] / CAPEX × 100 | Undiscounted return |

Simple payback and IRR will differ. IRR is the more accurate metric because it accounts for the year-by-year decline in output. Both must be shown. Simple payback is for client communication; IRR is for internal investment review.

---

## 10. Proposal Handoff Package

Generated at Stage 5 (Proposal Drafted). Contains everything needed to build the external proposal document. Frozen at this point — no changes without reverting to Stage 4 and re-approving.

```
proposal_handoff_package {
  project_id
  generated_at

  // Configuration (snapshot)
  selected_config        // "economical" | "recommended"
  sku_model
  sku_units
  total_kwh
  total_kw
  capex_ex_gst

  // Assumptions (snapshot)
  soc_window
  ac_dc_loss_pct
  recommended_uplift_pct
  om_rate_pct
  om_escalation_pct
  dg_grid_charge         // if DG use case

  // Tariff (snapshot)
  state
  discom
  tariff_category
  peak_tariff
  offpeak_tariff
  tod_spread
  effective_date

  // Financial summary (snapshot)
  benefit_per_kwh
  annual_savings_yr1
  simple_payback_years
  break_even_year
  irr_10yr_pct
  npv_10yr_rs
  roi_10yr_pct

  // Cycle dataset (snapshot)
  dataset_label
  cycles_per_year
  yr1_soh
  yr1_rte
  yr1_dispatchable_kwh

  // Narrative
  gemini_commentary_id   // FK to stored commentary
  recommendation_notes   // account manager notes

  // Compliance placeholders
  is_16270_applicable
  iec_62619_applicable
  cea_grid_connectivity
  discom_approval_required
}
```

---

## 11. Activity Queue vs Activity Log

These are distinct. Using one table for both, filtered by status, is acceptable for MVP but they must be clearly distinguished in logic.

### Activity Queue (pending actions)

```
activity_queue = activities WHERE status = 'pending' ORDER BY due_date ASC
```

Types: `call_pending`, `proposal_pending`, `follow_up_pending`, `approval_pending`, `technical_review_pending`, `client_meeting_pending`

Each has: assigned_to, due_date, project_id, opportunity_id, notes.

Activities in the queue are surfaced per project and globally (all projects for a user).

### Activity Log (completed history)

```
activity_log = activities WHERE status IN ('completed', 'cancelled') ORDER BY completed_at DESC
```

Completing an activity: set `status = completed`, set `completed_at = now()`. Never delete. Immutable after completion.

### Follow-up Queue

A filtered view of the activity queue:
```
follow_up_queue = activity_queue WHERE type IN ('follow_up', 'call_pending')
```

Not a separate table. A separate view.

### Auto-creation Rule

When a stage transition occurs, an activity is automatically created in the queue with a default due date. Default due dates per stage are configurable in a `workflow_config` table, not hardcoded.

---

## 12. Normalized Account / Contact / Project Relationships

```
Account (company)
  ├── company_name, industry, location, tier
  └── N Contacts
        ├── name, role, phone, email
        └── linked to Account, not to Project

Opportunity (commercial engagement)
  ├── linked to Account
  ├── value, stage, probability
  └── N Projects (one per site, or one per bid)

Project (operating unit)
  ├── linked to Opportunity
  ├── site_name, site_state
  ├── use_case, sku_category
  ├── stage (stage machine)
  └── all sizing / finance / proposal records hang here

Contact ↔ Project (junction table)
  └── project_id, contact_id, is_primary_contact
      (contact may be relevant to multiple projects under the same account)
```

Activities and follow-ups belong to either an Opportunity or a Project, not to a Contact directly. A contact is referenced but not the owner.

---

## 13. Master Data Structure

All of these must be configurable records, not hardcoded values. Changes to masters apply to future records only — not to locked project snapshots.

### SKU Master

```
sku { id, model_code, category, power_kw, energy_kwh, chemistry,
      certifications[], price_ex_gst, price_effective_date, is_active }
```

### Use Case Master

```
use_case { id, label, benefit_type, required_inputs[], benefit_formula_id,
           default_cycles_per_year, default_operating_days }
```

### Tariff Master

```
tariff { id, state, discom, tariff_category, energy_charge_peak,
         energy_charge_offpeak, demand_charge_rs_kva, effective_from,
         serc_order_ref, is_active }
```

### Assumptions Master

```
assumptions { id, label, ac_dc_loss_pct, soc_window_pct,
              recommended_uplift_pct, om_rate_pct, om_escalation_pct,
              dg_grid_charge_rs_kwh, default_discount_rate_pct,
              default_horizon_years, is_default }
```

### Cycle-Data Master

```
cycle_dataset { id, label, c_rate, cycles_per_year, chemistry, source,
                years[]: { year, soh, rte } }
```

Currently: 3 datasets hardcoded as JS constants. Must move to DB and be selectable per project.

---

## 14. What Should Change Now vs Later

### Immediate — unblocks production use

| Change | Why |
|---|---|
| Container pricing (6 SKUs at ₹0) | Finance model returns zero for container projects |
| Sizing analysis linked to project record at save | Currently saves to DB but not against a project ID |
| Stage machine on project record | Projects currently have no stage transitions |
| Activity auto-creation on stage transition | Workflow has no automated follow-up triggers |

### Next — makes the engine commercially complete

| Change | Why |
|---|---|
| Assumptions master moved to DB | Currently hardcoded — not auditable |
| Cycle datasets moved to DB | Currently a JS constant — not configurable |
| Proposal handoff package generator | Currently no structured output at proposal stage |
| Snapshot freeze at Stage 5 | Currently snapshots exist but are not enforced |
| Opportunity → Project linkage | Sizing saves against client only, not opportunity |

### Later — enhances depth

| Change | Why |
|---|---|
| Additional use cases (peak shaving, solar) | Benefit engine supports it but formulas not built |
| Post-tax IRR | Needs corporate tax rate input per project |
| Multi-dataset comparison view | Side-by-side IRR for different cycle datasets |
| Auto-generated proposal document (PDF/DOCX) | From the handoff package |
| DISCOM approval status tracking | Per-state compliance workflow |

### Explicitly deferred (not in MVP)

- Mixed SKU combinations (cabinet + container)
- Auto SKU selection (engine picks SKU automatically)
- Sensitivity / scenario tables
- ERP or external CRM sync
- Cumulative cashflow chart

---

## 15. Redline Section — Current vs Recommended

### R1 — Sizing as a standalone calculator
**Current:** Sizing tool runs independently. Saving an analysis links to a client and optionally a site, but not to an opportunity or project stage.
**Why weak:** Results are orphaned. No audit trail. No connection to commercial context. Same client can have 10 unlinked sizing runs with no way to know which one became a proposal.
**Replace with:** Sizing must be initiated from within a project record. Project record must be linked to an opportunity before sizing can be saved. Every sizing run is version-tagged against that project.

### R2 — Recommended config described as "economical + 15%"
**Current:** `recom_units = ceil(nominal_kwh × 1.15 / sku.energy_kwh)`. The 1.15 is applied to the nameplate requirement, not to the dispatchable requirement.
**Why weak:** The 15% is arbitrary and applied to the wrong quantity. A system sized at nameplate × 1.15 may still under-deliver in real operation because it doesn't account for actual SOH × RTE × SOC window losses.
**Replace with:** `recom_units = ceil(validated_kwh × (1 + uplift) / (sku.energy_kwh × dispatch_factor))` where `dispatch_factor = soh_yr1 × rte_yr1 × soc_window`. The uplift (default 15%) is applied on top of the dispatchable-adjusted requirement, not the nameplate requirement.

### R3 — Tariff as a slider input
**Current:** Left panel has a `tariffDiff` slider defaulting to 4.5 ₹/kWh. State selector auto-fills it but it's still treated as a manual override field.
**Why weak:** Nothing enforces that the tariff used in the financial model matches the state of the project. Two analysts can produce different IRRs for the same project by sliding the tariff differently.
**Replace with:** Tariff is fetched deterministically from the tariff master using project state + DISCOM + tariff category. Manual override is allowed but must be flagged and logged as a deviation. The tariff row ID is stored on the finance record.

### R4 — BD pipeline and sizing engine as two separate systems
**Current:** `bd.*` schema and `bess.*` schema exist as parallel structures. No foreign key connects a sizing analysis to a BD opportunity.
**Why weak:** The commercial team has no view of which sizing analyses belong to which deal. A deal can close without any sizing analysis being formally attached to it.
**Replace with:** Add `opportunity_id` column to `bess.projects`. Add `project_id` column to `bess.sizing_analyses` (currently has only `client_id`). Stage machine on the project record drives both BD and sizing progress from one record.

### R5 — Degradation only in finance
**Current:** Cycle dataset is used only in the cashflow calculation. The recommendation unit count uses only Yr-1 SOH/RTE as a static factor.
**Why weak:** The recommendation doesn't communicate the long-term delivery profile. A client comparing two configurations won't see that one degrades 25% faster over 10 years.
**Replace with:** Recommendation output explicitly states: which cycle dataset was used, Yr-1 dispatchable vs Yr-5 dispatchable vs Yr-10 dispatchable, and the IRR sensitivity to cycle rate. Gemini commentary must reference the specific dataset chosen.

### R6 — No snapshot enforcement
**Current:** Snapshots are written to DB columns at save time but there is no enforcement preventing a proposal from being regenerated with updated master data.
**Why weak:** If SKU price increases after a proposal is drafted, nothing stops the system from recalculating the finance record with the new price. The original quoted CAPEX is lost.
**Replace with:** At Stage 5 (Proposal Drafted), write a `proposal_handoff_package` record with all inputs frozen. Mark the finance record as `is_locked = true`. Any subsequent change to master data does not affect locked records. Reversion to Stage 4 required to unlock.

### R7 — Activity queue not automated
**Current:** Activities can be manually created. No activities are auto-created on stage transitions.
**Why weak:** Follow-up discipline depends entirely on the account manager remembering to log actions. Stage transitions produce no automated reminders.
**Replace with:** On every stage transition, auto-create a pending activity with the next recommended action and a default due date from `workflow_config`. The account manager can modify or dismiss it, but the queue is always populated.

---

## 16. Top 10 Workflow Corrections

In priority order:

1. **Link sizing to project, project to opportunity.** Sizing runs must not float as client-level calculations.
2. **Fix recommended config formula.** Apply uplift to the dispatchable-adjusted requirement, not the nameplate requirement.
3. **Enforce snapshot at proposal milestone.** Locked finance records must not change when master data changes.
4. **Add stage machine to project record.** 10 stages, transition rules, forward-only except ON_HOLD.
5. **Auto-create activity on stage transition.** Workflow cannot depend on manual discipline.
6. **Move assumptions and cycle datasets to DB.** Hardcoded constants are not auditable.
7. **Tariff deviation logging.** When tariff is manually overridden, log the deviation against the finance record.
8. **Container pricing.** Six container SKUs at ₹0 block the finance model for any utility/large-scale project.
9. **Proposal handoff package.** Structured JSON record with all inputs frozen at proposal stage.
10. **Normalize opportunity → project → sizing chain.** Add `opportunity_id` to projects, `project_id` to sizing analyses.

---

## 17. Revised Final Workflow — One-Line Arrow Format

```
Account → Contact → Opportunity → Project (stage 1)
  → Qualification (stage 2)
  → Sizing: validated_kwh + coverage table + economical/recommended configs (stage 3)
  → Finance: tariff-linked benefit + degradation cashflows + IRR/payback/break-even (stage 4)
  → Proposal handoff package + snapshot freeze (stage 5)
  → Internal approval (stage 6)
  → Technical compliance (stage 7)
  → Client submission (stage 8)
  → Negotiation (stage 9)
  → Closed Won / Lost (stage 10)
```

AI layer sits at Stage 3→4 boundary only: explains recommendation, does not calculate.

---

## 18. Cleanest MVP Structure

The minimum structure that makes the system commercially usable and auditable:

**DB tables required:**
```
accounts, contacts, opportunities                     (BD layer — exists)
projects          + opportunity_id column              (link to BD)
sizing_analyses   + project_id column                 (link to project)
recommendation_records                                (exists)
finance_records   + is_locked column                  (add lock flag)
proposal_packages                                     (new — snapshot container)
activities        (queue + log via status field)       (exists in bd.*)
tariff_structures                                     (exists, 27 rows)
bess.units        + category column                   (done)
assumptions_master                                    (move from hardcode to DB)
cycle_data_master                                     (move from hardcode to DB)
```

**Rules that must be enforced in code:**
1. `sizing_analyses.project_id` cannot be null on save
2. `projects.opportunity_id` cannot be null on save
3. `finance_records.is_locked = true` once project reaches Stage 5
4. Stage transitions write an activity record automatically
5. Recommended config uses dispatchable factor, not nameplate × 1.15

**What stays hardcoded for now (acceptable):**
- Grid charge: ₹3/kWh (confirmed by Fateh — intentional)
- IRR method: Newton-Raphson NPV (fixed by design)
- Discount rate: 10% for NPV (single value, low sensitivity)

---

*Portal: unityess-bess-portal.vercel.app | API: unityess-bess-api.vercel.app | Repo: github.com/anushthashalin/unityess-bess-portal*
