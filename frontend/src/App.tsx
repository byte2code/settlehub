import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { useAuth } from './hooks/useAuth';
import { useNativeBackButton } from './hooks/useNativeBackButton';
import { useGlobalNotifications } from './hooks/useGlobalNotifications';
import { Navbar } from './components/layout/Navbar';
import { WakeBanner } from './components/layout/WakeBanner';
import { UpdatePrompt } from './components/layout/UpdatePrompt';
import { InAppNotificationBanner } from './components/notifications/InAppNotificationBanner';
import { PageSpinner } from './components/ui/bits';
import { Landing } from './pages/Landing';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const GroupPage = lazy(() => import('./pages/GroupPage').then((m) => ({ default: m.GroupPage })));
const JoinPage = lazy(() => import('./pages/JoinPage').then((m) => ({ default: m.JoinPage })));
const AuthModal = lazy(() => import('./components/modals/AuthModal'));

export default function App() {
  const { user, loading } = useAuth();
  const [auth, setAuth] = useState<{ context?: string; signUp?: boolean } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  useNativeBackButton();
  useGlobalNotifications(user);

  // 2.0 invite links looked like /?join=CODE
  useEffect(() => {
    const legacy = new URLSearchParams(location.search).get('join');
    if (legacy) navigate(`/join/${encodeURIComponent(legacy.trim().toUpperCase())}`, { replace: true });
  }, [location.search, navigate]);

  const openAuth = (context?: string, signUp = false) => setAuth({ context, signUp });

  return (
    <div className="flex min-h-screen flex-col bg-app text-fg">
      <InAppNotificationBanner />
      <WakeBanner />
      <Navbar onSignIn={() => openAuth()} />
      <main className="flex-1">
        {loading ? (
          <PageSpinner />
        ) : (
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/" element={user ? <Dashboard /> : <Landing onGetStarted={() => openAuth(undefined, true)} />} />
              <Route path="/groups/:groupId" element={user ? <GroupPage /> : <Navigate to="/" replace />} />
              <Route path="/join/:code" element={<JoinPage onSignIn={openAuth} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        )}
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-subtle">
        SettleHub 3.0 · open source · runs on free infrastructure
      </footer>
      <Suspense fallback={null}>{auth && !user && <AuthModal open context={auth.context} initialMode={auth.signUp ? 'register' : 'login'} onClose={() => setAuth(null)} />}</Suspense>
      <UpdatePrompt />
    </div>
  );
}
