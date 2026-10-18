import React, { useState } from 'react';
import type { User } from '../types';
import { SUPPORTED_CURRENCIES } from '../types';
import { getCurrencyOption } from '../utils/currency';
import { Layers, LogOut, ChevronDown, Server } from 'lucide-react';
import { ServerConfigModal } from './ServerConfigModal';

interface NavbarProps {
  user: User | null;
  activeCurrency: string;
  onCurrencyChange: (currencyCode: string) => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onNavigateHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeCurrency,
  onCurrencyChange,
  onLogout,
  onOpenAuth,
  onNavigateHome,
}) => {
  const [showServerModal, setShowServerModal] = useState(false);
  const currentOption = getCurrencyOption(activeCurrency);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 overflow-hidden">
        {/* Brand Logo */}
        <div
          onClick={onNavigateHome}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink min-w-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg sm:text-xl tracking-tight text-white truncate">
                Settle<span className="text-emerald-400">Hub</span>
              </span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block truncate">Debt Minimization & Expense Sharing</p>
          </div>
        </div>

        {/* Right Section: Currency + Server Config + User Nav */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Currency Switcher Dropdown */}
          <div className="relative group">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 shadow-sm cursor-pointer">
              <span className="text-sm">{currentOption.flag}</span>
              <span className="font-bold text-emerald-400">{currentOption.symbol}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <select
              aria-label="Preferred Currency"
              value={activeCurrency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
            >
              {SUPPORTED_CURRENCIES.map((cur) => (
                <option key={cur.code} value={cur.code} className="bg-slate-900 text-white">
                  {cur.flag} {cur.code} ({cur.symbol}) - {cur.name}
                </option>
              ))}
            </select>
          </div>

          {/* Backend Server Settings Button */}
          <button
            type="button"
            onClick={() => setShowServerModal(true)}
            className="p-2 text-slate-400 hover:text-emerald-400 rounded-xl hover:bg-slate-900 border border-slate-800 transition-colors shrink-0"
            title="Configure Backend Server Endpoint"
          >
            <Server className="w-4 h-4" />
          </button>

          {/* User Profile / Sign In */}
          {user ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-sm">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-semibold text-xs shrink-0">
                  {user.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-medium text-slate-200">{user.fullName}</div>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95 shrink-0"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      <ServerConfigModal
        isOpen={showServerModal}
        onClose={() => setShowServerModal(false)}
      />
    </header>
  );
};
