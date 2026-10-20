import React, { useState, useEffect } from 'react';
import type { Group, GroupBalanceSummary } from '../types';
import { api } from '../services/api';
import { X, FileSpreadsheet, Share2, Mail, Copy, Check, MessageSquare, Download, AlertCircle, Sparkles } from 'lucide-react';

interface ExportSummaryModalProps {
  isOpen: boolean;
  group: Group;
  balanceSummary: GroupBalanceSummary | null;
  onClose: () => void;
}

export const ExportSummaryModal: React.FC<ExportSummaryModalProps> = ({
  isOpen,
  group,
  balanceSummary,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'excel' | 'email'>('whatsapp');
  const [summaryText, setSummaryText] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Generate fallback local WhatsApp text if server summary is loading
  const generateClientSummary = () => {
    const debts = balanceSummary?.simplifiedDebts || [];
    let text = `📊 *SettleHub — ${group.name}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👥 *Members (${group.members.length}):* ${group.members.map(m => m.name).join(', ')}\n\n`;

    text += `*👤 Member Net Balances:*\n`;
    group.members.forEach(m => {
      const isOwed = m.netBalanceCents > 0;
      const isDebt = m.netBalanceCents < 0;
      if (isOwed) {
        text += ` • ${m.name}: *+${m.netBalanceFormatted}* (gets back)\n`;
      } else if (isDebt) {
        text += ` • ${m.name}: *${m.netBalanceFormatted}* (owes)\n`;
      } else {
        text += ` • ${m.name}: settled up\n`;
      }
    });

    text += `\n`;
    if (debts.length === 0) {
      text += `✅ *All settled up!* No outstanding repayments.\n`;
    } else {
      text += `*🤝 Minimized Settlements (Who Pays Whom):*\n`;
      debts.forEach(d => {
        text += ` • *${d.fromUserName}* ➡️ *${d.toUserName}*: ${d.amountFormatted}\n`;
      });
    }

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (group.inviteCode) {
      text += `🔗 Join group: ${window.location.origin}/?join=${group.inviteCode}\n`;
    }
    text += `✨ _Generated via SettleHub 2.0_`;
    return text;
  };

  useEffect(() => {
    if (!isOpen) return;
    const fetchSummary = async () => {
      try {
        setLoadingSummary(true);
        const res = await api.getWhatsAppSummary(group.id);
        if (res?.summaryText) {
          setSummaryText(res.summaryText);
        } else {
          setSummaryText(generateClientSummary());
        }
      } catch {
        setSummaryText(generateClientSummary());
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [isOpen, group.id]);

  if (!isOpen) return null;

  const currentSummary = summaryText || generateClientSummary();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(currentSummary);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      await api.downloadExcelReport(group.id, group.name);
    } catch (err: any) {
      alert(err.message || 'Failed to download Excel report.');
    } finally {
      setDownloading(false);
    }
  };

  const handleEmailMembers = async () => {
    try {
      setEmailing(true);
      setEmailResult(null);
      const res = await api.emailGroupReport(group.id);
      setEmailResult({ success: res.success, message: res.message });
    } catch (err: any) {
      setEmailResult({
        success: false,
        message: err.message || 'Failed to email report. You can download the Excel file directly.',
      });
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>Export & Share</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  2.0
                </span>
              </h2>
              <p className="text-xs text-slate-400">Send WhatsApp summary or download complete Excel sheet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 mt-3 bg-slate-950/80 rounded-xl border border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'excel'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'email'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Report</span>
          </button>
        </div>

        {/* Tab 1: WhatsApp Share */}
        {activeTab === 'whatsapp' && (
          <div className="flex-1 flex flex-col min-h-0 pt-4 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium">Live WhatsApp Preview:</span>
              <span className="text-[11px] text-emerald-400">Formatted for WhatsApp bold & emoji</span>
            </div>

            <div className="flex-1 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono text-emerald-300/90 whitespace-pre-wrap overflow-y-auto leading-relaxed shadow-inner max-h-56">
              {loadingSummary ? 'Generating summary...' : currentSummary}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopy}
                className="w-full sm:w-1/2 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all active:scale-95"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Summary Text'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="w-full sm:w-1/2 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white shadow-lg shadow-[#25D366]/20 transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>Share on WhatsApp</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Excel Export */}
        {activeTab === 'excel' && (
          <div className="flex-1 flex flex-col justify-between pt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Full Trip Excel Workbook (.xlsx)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">3 detailed sheets prepared with Apache POI</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs text-slate-300">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="font-semibold text-emerald-400 block mb-0.5">Sheet 1: Transactions</span>
                  <span className="text-[11px] text-slate-500">Dates, descriptions, costs, payers & split breakdowns</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="font-semibold text-teal-400 block mb-0.5">Sheet 2: Balances</span>
                  <span className="text-[11px] text-slate-500">Member net balances & minimized debt settlement chain</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="font-semibold text-cyan-400 block mb-0.5">Sheet 3: Settlements</span>
                  <span className="text-[11px] text-slate-500">All recorded payments, timestamps & status</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadExcel}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Preparing Excel File...' : 'Download Excel Spreadsheet (.xlsx)'}</span>
            </button>
          </div>
        )}

        {/* Tab 3: Email Members */}
        {activeTab === 'email' && (
          <div className="flex-1 flex flex-col justify-between pt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Email Excel & Summary to All Members</h3>
                  <p className="text-xs text-slate-400">Sends the spreadsheet attachment + HTML summary</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-medium text-slate-400">Recipients ({group.members.length}):</span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {group.members.map(m => (
                    <span
                      key={m.userId}
                      className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
                    >
                      {m.name} ({m.email})
                    </span>
                  ))}
                </div>
              </div>

              {emailResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    emailResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{emailResult.message}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={emailing}
              onClick={handleEmailMembers}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              <Mail className="w-4 h-4 text-emerald-400" />
              <span>{emailing ? 'Sending Emails...' : 'Send Excel & Summary to All Members'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
