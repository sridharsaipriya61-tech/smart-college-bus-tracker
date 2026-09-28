import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import Layout from './components/Layout.jsx';
import { Spinner, Button } from './components/ui.jsx';

import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LiveMapPage from './pages/LiveMapPage.jsx';
import BusesPage from './pages/BusesPage.jsx';
import StopsPage from './pages/StopsPage.jsx';
import RoutesPage from './pages/RoutesPage.jsx';
import NotesPage from './pages/NotesPage.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import DriverConsole from './pages/DriverConsole.jsx';
import EventsPage from './pages/EventsPage.jsx';
import FleetAdmin from './pages/FleetAdmin.jsx';
import UsersAdmin from './pages/UsersAdmin.jsx';
import ReportsPage from './pages/ReportsPage.jsx';

function Booting() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner label="Starting Smart College Bus Tracker" />
    </div>
  );
}

function RequireAuth({ children, role }) {
  const { user, booting } = useAuth();
  if (booting) return <Booting />;
  if (!user) return <AuthPage />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function PublicOnly({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <Booting />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <p className="text-6xl font-extrabold tracking-tight text-brand-200">404</p>
        <h1 className="mt-2 text-xl font-extrabold text-ink">This stop does not exist</h1>
        <p className="mt-1.5 text-sm text-ink-mute">The page you were looking for is not on this route.</p>
        <Button className="mt-5" onClick={() => (window.location.href = '/')}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <AuthPage />
                </PublicOnly>
              }
            />

            <Route
              path="/"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/map"
              element={
                <RequireAuth>
                  <LiveMapPage />
                </RequireAuth>
              }
            />
            <Route
              path="/buses"
              element={
                <RequireAuth>
                  <BusesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/stops"
              element={
                <RequireAuth>
                  <StopsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/routes"
              element={
                <RequireAuth>
                  <RoutesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/notes"
              element={
                <RequireAuth>
                  <NotesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/assistant"
              element={
                <RequireAuth>
                  <AssistantPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/drive"
              element={
                <RequireAuth role="driver">
                  <DriverConsole />
                </RequireAuth>
              }
            />
            <Route
              path="/events"
              element={
                <RequireAuth>
                  <EventsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/fleet"
              element={
                <RequireAuth role="admin">
                  <FleetAdmin />
                </RequireAuth>
              }
            />
            <Route
              path="/users"
              element={
                <RequireAuth role="admin">
                  <UsersAdmin />
                </RequireAuth>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireAuth role="admin">
                  <ReportsPage />
                </RequireAuth>
              }
            />

            <Route
              path="*"
              element={
                <RequireAuth>
                  <NotFound />
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
