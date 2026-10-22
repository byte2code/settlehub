import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import { Layers, LogOut, Moon, Server, Sun, MonitorSmartphone, UserRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, type ThemePreference } from '../../hooks/useTheme';
import { Avatar } from '../ui/bits';

const ServerConfigModal = lazy(() => import('../modals/ServerConfigModal'));
const ProfileModal = lazy(() => import('../modals/ProfileModal'));

const NEXT_THEME: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON = { system: MonitorSmartphone, light: Sun, dark: Moon };

export function Navbar({ onSignIn }: { onSignIn: () => void }) {
  const { user, signOut } = useAuth();
  const { preference, setTheme } = useTheme();
  const [showServer, setShowServer] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const ThemeIcon = THEME_ICON[preference];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-app/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-md">
            <Layers className="h-5 w-5" />
          </span>
          <span className="truncate text-lg font-bold tracking-tight text-fg">
            Settle<span className="text-brand-fg">Hub</span>
          </span>
          <span className="chip hidden border-emerald-500/25 bg-emerald-500/10 text-brand-fg sm:inline-flex">3.0</span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => setTheme(NEXT_THEME[preference])}
            title={`Theme: ${preference}`}
            aria-label={`Theme: ${preference}. Switch theme`}
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
          <button type="button" className="btn-ghost p-2" onClick={() => setShowServer(true)} title="Server settings" aria-label="Server settings">
            <Server className="h-4 w-4" />
          </button>
          {user ? (
            <>
              <button
                type="button"
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 text-sm hover:border-line-strong"
                aria-label="Your profile"
              >
                <Avatar name={user.fullName} size="sm" />
                <span className="hidden max-w-32 truncate text-xs font-medium text-fg md:block">{user.fullName}</span>
                <UserRound className="h-3.5 w-3.5 text-subtle md:hidden" />
              </button>
              <button type="button" onClick={signOut} className="btn-ghost p-2 hover:text-neg" title="Sign out" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button type="button" onClick={onSignIn} className="btn-primary">
              Sign in
            </button>
          )}
        </nav>
      </div>

      <Suspense fallback={null}>
        {showServer && <ServerConfigModal open onClose={() => setShowServer(false)} />}
        {showProfile && <ProfileModal open onClose={() => setShowProfile(false)} />}
      </Suspense>
    </header>
  );
}
