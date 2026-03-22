import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Sites from './pages/Sites.jsx';
import BESSConfig from './pages/BESSConfig.jsx';
import Proposals from './pages/Proposals.jsx';
import Projects from './pages/Projects.jsx';
import TariffStructures from './pages/TariffStructures.jsx';
import BDCommandCenter from './pages/BDCommandCenter.jsx';
import BDAccounts from './pages/BDAccounts.jsx';
import BDContacts from './pages/BDContacts.jsx';
import BDOpportunities from './pages/BDOpportunities.jsx';
import BDActivities from './pages/BDActivities.jsx';
import BDFollowUps from './pages/BDFollowUps.jsx';
import BDApprovals from './pages/BDApprovals.jsx';
import BDProposals from './pages/BDProposals.jsx';
import BDImport from './pages/BDImport.jsx';

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
              <Route path="/"                      element={<Navigate to="/dashboard" replace />} />
              {/* BESS */}
              <Route path="/dashboard"             element={<Dashboard />} />
              <Route path="/clients"               element={<Clients />} />
              <Route path="/sites"                 element={<Sites />} />
              <Route path="/bess-config"           element={<BESSConfig />} />
              <Route path="/proposals"             element={<Proposals />} />
              <Route path="/projects"              element={<Projects />} />
              <Route path="/tariffs"               element={<TariffStructures />} />
              {/* BD */}
              <Route path="/bd"                    element={<BDCommandCenter />} />
              <Route path="/bd/accounts"           element={<BDAccounts />} />
              <Route path="/bd/contacts"           element={<BDContacts />} />
              <Route path="/bd/opportunities"      element={<BDOpportunities />} />
              <Route path="/bd/activities"         element={<BDActivities />} />
              <Route path="/bd/follow-ups"         element={<BDFollowUps />} />
              <Route path="/bd/approvals"          element={<BDApprovals />} />
              <Route path="/bd/proposals"          element={<BDProposals />} />
              <Route path="/bd/import"             element={<BDImport />} />
            </Routes>
          </Layout>
        </RequireAuth>
      } />
    </Routes>
  );
}
