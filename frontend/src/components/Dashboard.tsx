import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Group, User } from '../types';
import { formatCurrency } from '../utils/currency';
import { CreateGroupModal } from './CreateGroupModal';
import { JoinGroupModal } from './JoinGroupModal';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Plus,
  ArrowRight,
  Compass,
  Home,
  Heart,
  MoreHorizontal,
  RefreshCw,
  KeyRound,
} from 'lucide-react';

interface DashboardProps {
  currentUser: User;
  activeCurrency: string;
  onSelectGroup: (groupId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, activeCurrency, onSelectGroup }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getGroups();
      setGroups(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Compute overall totals across all groups
  const totalOwedToYouCents = groups
    .filter((g) => g.userNetBalanceCents > 0)
    .reduce((sum, g) => sum + g.userNetBalanceCents, 0);

  const totalYouOweCents = groups
    .filter((g) => g.userNetBalanceCents < 0)
    .reduce((sum, g) => sum + Math.abs(g.userNetBalanceCents), 0);

  const netOverallCents = totalOwedToYouCents - totalYouOweCents;

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'trip':
        return Compass;
      case 'home':
        return Home;
      case 'couple':
        return Heart;
      default:
        return MoreHorizontal;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Welcome & Balance Banner */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 p-5 sm:p-6 rounded-3xl glass-panel relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Personal Dashboard
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-400">{currentUser.email}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Hi, {currentUser.firstName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md">
            {netOverallCents > 0
              ? `Overall you are owed ${formatCurrency(netOverallCents, activeCurrency)} across all your groups.`
              : netOverallCents < 0
              ? `Overall you owe ${formatCurrency(Math.abs(netOverallCents), activeCurrency)} across all your groups.`
              : 'You are completely settled up across all groups!'}
          </p>
        </div>

        {/* Balance Metric Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 relative z-10 w-full sm:w-auto min-w-0">
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-950/30 border border-emerald-500/20 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>You are owed</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-300 font-mono truncate">
              {formatCurrency(totalOwedToYouCents, activeCurrency)}
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-950/30 border border-rose-500/20 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 mb-1">
              <TrendingDown className="w-4 h-4 shrink-0" />
              <span>You owe</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-300 font-mono truncate">
              {formatCurrency(totalYouOweCents, activeCurrency)}
            </div>
          </div>
        </div>

        {/* Ambient subtle glow background */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Groups Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Your Expense Groups</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {groups.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchGroups}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-900 border border-slate-800 transition-colors"
              title="Refresh groups"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowJoinGroup(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all active:scale-95 shadow-sm"
              title="Join a private group using invite code"
            >
              <KeyRound className="w-3.5 h-3.5 text-teal-400" />
              <span>Join with Code</span>
            </button>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Group</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Groups Grid */}
        {groups.length === 0 && !loading ? (
          <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No Expense Groups Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Create your first group to start splitting bills, groceries, and travel expenses without math headache.
              </p>
            </div>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-all shadow-md shadow-emerald-500/20"
            >
              Create First Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => {
              const Icon = getCategoryIcon(group.groupType);
              const isOwed = group.userNetBalanceCents > 0;
              const isDebt = group.userNetBalanceCents < 0;

              return (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                  className="group p-5 rounded-2xl glass-panel hover:border-emerald-500/40 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {group.currencyCode || 'INR'}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {group.groupType}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                      {group.name}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>{group.members.length} members</span>
                      {group.simplifyByDefault && (
                        <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Simplified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                        Your Balance
                      </span>
                      <span
                        className={`text-sm font-bold font-mono ${
                          isOwed ? 'text-emerald-400' : isDebt ? 'text-rose-400' : 'text-slate-400'
                        }`}
                      >
                        {isOwed ? `+${group.userNetBalanceFormatted}` : group.userNetBalanceFormatted}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-emerald-500 transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onGroupCreated={(newGroup) => {
          setGroups([newGroup, ...groups]);
          onSelectGroup(newGroup.id);
        }}
      />

      <JoinGroupModal
        isOpen={showJoinGroup}
        onClose={() => setShowJoinGroup(false)}
        onJoined={(joinedGroup) => {
          fetchGroups();
          onSelectGroup(joinedGroup.id);
        }}
      />
    </div>
  );
};
