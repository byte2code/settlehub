import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import type { User } from './types';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { GroupDetail } from './components/GroupDetail';
import { AuthModal } from './components/AuthModal';
import { getStoredCurrency, setStoredCurrency, DEFAULT_CURRENCY } from './utils/currency';
import { Layers, Sparkles, ShieldCheck, ArrowRight, Zap } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeCurrency, setActiveCurrency] = useState<string>(
    () => getStoredCurrency() || DEFAULT_CURRENCY
  );

  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const profile = await api.getCurrentUser();
          setUser(profile);
          if (profile.currencyCode) {
            setActiveCurrency(profile.currencyCode);
            setStoredCurrency(profile.currencyCode);
          }
        } catch {
          api.logout();
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode && user) {
      api.joinGroup(joinCode)
        .then((group) => {
          setSelectedGroupId(group.id);
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          console.warn('Auto-join group failed:', err);
        });
    } else if (joinCode && !user && !loading) {
      setShowAuthModal(true);
    }
  }, [user, loading]);

  const handleCurrencyChange = async (newCode: string) => {
    setActiveCurrency(newCode);
    setStoredCurrency(newCode);
    if (user) {
      try {
        const updated = await api.updateCurrency(newCode);
        setUser(updated);
      } catch (e) {
        console.error('Failed to update currency on user profile', e);
      }
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setSelectedGroupId(null);
  };

  const handleAuthSuccess = (loggedUser: User) => {
    setUser(loggedUser);
    if (loggedUser.currencyCode) {
      setActiveCurrency(loggedUser.currencyCode);
      setStoredCurrency(loggedUser.currencyCode);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#090d16]">
        <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      <Navbar
        user={user}
        activeCurrency={activeCurrency}
        onCurrencyChange={handleCurrencyChange}
        onLogout={handleLogout}
        onOpenAuth={() => setShowAuthModal(true)}
        onNavigateHome={() => setSelectedGroupId(null)}
      />

      <main className="flex-1">
        {user ? (
          selectedGroupId ? (
            <GroupDetail
              groupId={selectedGroupId}
              currentUser={user}
              onBack={() => setSelectedGroupId(null)}
            />
          ) : (
            <Dashboard
              currentUser={user}
              activeCurrency={activeCurrency}
              onSelectGroup={(id) => setSelectedGroupId(id)}
            />
          )
        ) : (
          /* Landing Hero Screen for unauthenticated visitors */
          <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full-Stack Cleanroom Splitwise Reimplementation</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight max-w-3xl mx-auto">
              Split expenses with <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">zero rounding errors</span>.
            </h1>

            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              SettleHub features cent-precision integer arithmetic and the dual Max-Heap Min-Cash-Flow algorithm
              to completely eliminate circular debts and simplify repayments down to $N-1$ transactions.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-2xl transition-all shadow-xl shadow-emerald-500/25 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Get Started Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-12 text-left">
              <div className="glass-panel p-5 rounded-2xl">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Dual Max-Heap Solver</h3>
                <p className="text-xs text-slate-400">
                  Resolves circular debts in $O(N \log N)$ time, cutting multi-party transaction counts in half.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Cent-Precision Math</h3>
                <p className="text-xs text-slate-400">
                  Exact integer cent distribution (`divideFairly`) guarantees zero floating-point accumulation drift.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Free-Tier Ready</h3>
                <p className="text-xs text-slate-400">
                  Engineered for Render (512MB RAM Spring Boot 3) + Cloudflare Pages static edge deployment.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>SettleHub Expense Sharing Platform • Multi-Currency Support (Default: INR ₹)</p>
      </footer>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default App;
