# BESS Sizing Portal — UnityESS

Internal tool for BESS system sizing, proposal generation, and project pipeline management.

## Quick Start

```bash
# 1. Install all dependencies (root + workspaces)
npm install

# 2. Start the frontend only
npm run dev:web

# 3. Start both frontend + API concurrently
npm run dev
```

Frontend: http://localhost:5173
API:      http://localhost:4000

## Pages

| Route              | Page               | Description                              |
|--------------------|---------------------|------------------------------------------|
| `/dashboard`       | Dashboard           | KPIs, pipeline chart, projects table     |
| `/clients`         | Clients             | CRM — client cards with stats            |
| `/sites`           | Sites               | Site electrical parameters               |
| `/load-profiles`   | Load Profiles       | EB meter ToD data + charts               |
| `/bess-config`     | BESS Configurator   | Live sizing tool — units, kW/kWh, CAPEX  |
| `/proposals`       | Proposals           | Commercial proposals with IRR/payback    |
| `/projects`        | Projects            | Pipeline tracker with stage progress bar |
| `/tariffs`         | Tariff Structures   | State/DISCOM tariff database             |

## Stack

- **Frontend**: React 18 + Vite 5 + React Router v6
- **Charts**: Recharts
- **Styling**: Tailwind CSS + Chivo font
- **Backend**: Express (placeholder routes — wire to PostgreSQL)
- **Data**: Mock data in `apps/web/src/data/mockData.js`

## Next Steps

1. Set up PostgreSQL and run the schema from `bess-portal-database.html`
2. Replace mock data in `mockData.js` with API calls to `http://localhost:4000/api/...`
3. Implement form handlers for creating clients, sites, proposals
4. Wire the "Generate Proposal" button in BESS Configurator to the proposal PDF skill
