import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';

// BESS pages
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Sites from './pages/Sites.jsx';
import BESSConfig from './pages/BESSConfig.jsx';
import Proposals from './pages/Proposals.jsx';
import Projects from './pages/Projects.jsx';
import LoadProfiles from './pages/LoadProfiles.jsx';
import TariffStructures from './pages/TariffStructures.jsx';

// BD pages (shared component, used under both /bess/bd/* and /epc/bd/*)
import BDCommandCenter from './pages/BDCommandCenter.jsx';
import BDAccounts from './pages/BDAccounts.jsx';
import BDContacts from './pages/BDContacts.jsx';
import BDOpportunities from './pages/BDOpportunities.jsx';
import BDActivities from './pages/BDActivities.jsx';
import BDFollowUps from './pages/BDFollowUps.jsx';
import BDApprovals from './pages/BDApprovals.jsx';
import BDProposals from './pages/BDProposals.jsx';
import BDImport from './pages/BDImport.jsx';

// EPC pages
import EPCDashboard from './pages/EPCDashboard.jsx';
import EPCConfig from './pages/EPCConfig.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Chivo', sans-serif", color: '#888', fontSize: 14 }}>
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <RequireAuth>
          <Layout>
            <Routes>
              {/* Root redirect */}
              <Route path="/" element={<Navigate to="/bess/dashboard" replace />} />

              {/* Legacy redirects — keep old URLs working */}
              <Route path="/dashboard"    element={<Navigate to="/bess/dashboard" replace />} />
              <Route path="/bess-command" element={<Navigate to="/bess/dashboard" replace />} />
              <Route path="/bess-config"  element={<Navigate to="/bess/config"    replace />} />
              <Route path="/proposals"    element={<Navigate to="/bess/proposals" replace />} />
              <Route path="/projects"     element={<Navigate to="/bess/projects"  replace />} />
              <Route path="/clients"      element={<Navigate to="/bess/clients"   replace />} />
              <Route path="/sites"        element={<Navigate to="/bess/sites"     replace />} />
              <Route path="/tariffs"      element={<Navigate to="/bess/tariffs"   replace />} />
              <Route path="/load-profiles" element={<Navigate to="/bess/load-profiles" replace />} />
              <Route path="/bd"           element={<Navigate to="/bess/bd"        replace />} />
              <Route path="/bd/*"         element={<Navigate to="/bess/bd"        replace />} />

              {/* ── BESS Sizing ── */}
              <Route path="/bess/dashboard"     element={<Dashboard />} />
              <Route path="/bess/command"       element={<Navigate to="/bess/dashboard" replace />} />
              <Route path="/bess/config"        element={<BESSConfig />} />
              <Route path="/bess/proposals"     element={<Proposals />} />
              <Route path="/bess/projects"      element={<Projects />} />
              <Route path="/bess/clients"       element={<Clients />} />
              <Route path="/bess/sites"         element={<Sites />} />
              <Route path="/bess/tariffs"       element={<TariffStructures />} />
              <Route path="/bess/load-profiles" element={<LoadProfiles />} />

              {/* BESS BD */}
              <Route path="/bess/bd"                    element={<BDCommandCenter product="bess" />} />
              <Route path="/bess/bd/accounts"           element={<BDAccounts      product="bess" />} />
              <Route path="/bess/bd/contacts"           element={<BDContacts      product="bess" />} />
              <Route path="/bess/bd/opportunities"      element={<BDOpportunities product="bess" />} />
              <Route path="/bess/bd/activities"         element={<BDActivities    product="bess" />} />
              <Route path="/bess/bd/follow-ups"         element={<BDFollowUps     product="bess" />} />
              <Route path="/bess/bd/approvals"          element={<BDApprovals     product="bess" />} />
              <Route path="/bess/bd/proposals"          element={<BDProposals     product="bess" />} />
              <Route path="/bess/bd/import"             element={<BDImport        product="bess" />} />

              {/* ── Solar EPC ── */}
              <Route path="/epc/dashboard"     element={<EPCDashboard />} />
              <Route path="/epc/command"       element={<Navigate to="/epc/dashboard" replace />} />
              <Route path="/epc/config"        element={<EPCConfig />} />
              <Route path="/epc/proposals"     element={<Proposals product="epc" />} />
              <Route path="/epc/projects"      element={<Projects product="epc" />} />
              <Route path="/epc/clients"       element={<Clients product="epc" />} />
              <Route path="/epc/sites"         element={<Sites product="epc" />} />
              <Route path="/epc/tariffs"       element={<TariffStructures product="epc" />} />
              <Route path="/epc/load-profiles" element={<LoadProfiles product="epc" />} />

              {/* EPC BD */}
              <Route path="/epc/bd"                    element={<BDCommandCenter product="epc" />} />
              <Route path="/epc/bd/accounts"           element={<BDAccounts      product="epc" />} />
              <Route path="/epc/bd/contacts"           element={<BDContacts      product="epc" />} />
              <Route path="/epc/bd/opportunities"      element={<BDOpportunities product="epc" />} />
              <Route path="/epc/bd/activities"         element={<BDActivities    product="epc" />} />
              <Route path="/epc/bd/follow-ups"         element={<BDFollowUps     product="epc" />} />
              <Route path="/epc/bd/approvals"          element={<BDApprovals     product="epc" />} />
              <Route path="/epc/bd/proposals"          element={<BDProposals     product="epc" />} />
              <Route path="/epc/bd/import"             element={<BDImport        product="epc" />} />
            </Routes>
          </Layout>
        </RequireAuth>
      } />
    </Routes>
  );
}
