import { useEffect, useState } from 'react';
import { Check, Copy, Download, FileSpreadsheet, FileText, Mail, MessageSquare, Share2 } from 'lucide-react';
import { api, downloadBlob, safeFileName } from '../../lib/api';
import { toCsv } from '../../lib/csv';
import { formatDate } from '../../lib/dates';
import { errorMessage } from '../../lib/errors';
import { getCategory } from '../../lib/categories';
import { useExpenses } from '../../hooks/queries';
import type { Group } from '../../types';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

type Tab = 'whatsapp' | 'files' | 'email';

export default function ExportModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const toast = useToast();
  const { data: expenses = [] } = useExpenses(group.id);
  const [tab, setTab] = useState<Tab>('whatsapp');
  const [summary, setSummary] = useState('Preparing summary…');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .whatsappSummary(group.id)
      .then((res) => !cancelled && setSummary(res.summaryText))
      .catch(() => !cancelled && setSummary('Could not load the summary right now.'));
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const downloadCsv = () =>
    run('csv', async () => {
      const rows = [
        ['Date', 'Description', 'Category', `Amount (${group.currencyCode})`, 'Original', 'Paid by', 'Split between', 'Notes'],
        ...expenses.map((e) => [
          formatDate(e.date),
          e.description,
          getCategory(e.category).label,
          (e.costCents / 100).toFixed(2),
          e.originalFormatted ?? '',
          e.payers.map((p) => `${p.userName} ${p.paidFormatted}`).join('; '),
          e.splits.map((s) => `${s.userName} ${s.owedFormatted}`).join('; '),
          e.notes ?? '',
        ]),
      ];
      await downloadBlob(new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${safeFileName(group.name)}_SettleHub.csv`);
    });

  const TABS: { id: Tab; label: string; icon: typeof Mail }[] = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'files', label: 'Excel / CSV', icon: FileSpreadsheet },
    { id: 'email', label: 'Email', icon: Mail },
  ];

  return (
    <Modal open onClose={onClose} size="lg" icon={<Share2 className="h-5 w-5" />} title="Share & export" subtitle={group.name}>
      <div className="space-y-4">
        <div className="segmented w-full" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={tab === id} className="flex-1 justify-center" onClick={() => setTab(id)}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === 'whatsapp' && (
          <div className="space-y-3">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-line bg-surface-2 p-3.5 font-mono text-xs leading-relaxed text-fg">{summary}</pre>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button className="btn-secondary py-2.5" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy text'}
              </button>
              <a className="btn bg-[#25D366] py-2.5 text-white hover:bg-[#20ba59]" href={`https://wa.me/?text=${encodeURIComponent(summary)}`} target="_blank" rel="noopener noreferrer">
                <Share2 className="h-4 w-4" /> Open WhatsApp
              </a>
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div className="space-y-3">
            <button className="card flex w-full items-center gap-3 p-4 text-left hover:border-emerald-500/40" disabled={busy !== null} onClick={() => run('xlsx', () => api.downloadExcel(group.id, group.name))}>
              <FileSpreadsheet className="h-8 w-8 text-brand-fg" />
              <span className="flex-1">
                <span className="block text-sm font-bold text-fg">Excel workbook (.xlsx)</span>
                <span className="block text-xs text-muted">Transactions, balances, who-pays-whom and settlement history</span>
              </span>
              <Download className="h-4 w-4 text-subtle" />
            </button>
            <button className="card flex w-full items-center gap-3 p-4 text-left hover:border-emerald-500/40" disabled={busy !== null} onClick={downloadCsv}>
              <FileText className="h-8 w-8 text-sky-500" />
              <span className="flex-1">
                <span className="block text-sm font-bold text-fg">CSV (.csv)</span>
                <span className="block text-xs text-muted">Works offline; opens in Sheets, Numbers or Excel</span>
              </span>
              <Download className="h-4 w-4 text-subtle" />
            </button>
            {busy && <p className="text-center text-xs text-muted">Preparing file…</p>}
          </div>
        )}

        {tab === 'email' && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Emails the full Excel report + balance summary to all {group.members.length} member(s) in this group.
            </p>
            <button
              className="btn-primary w-full py-2.5 text-sm"
              disabled={busy !== null}
              onClick={() =>
                run('email', async () => {
                  const res = await api.emailReport(group.id);
                  if (res.success) {
                    toast.success(res.message);
                  } else {
                    // Show a clear message — don't silently swallow "not configured"
                    toast.error(res.message);
                  }
                })
              }
            >
              <Mail className="h-4 w-4" /> {busy === 'email' ? 'Sending…' : 'Email the report'}
            </button>
            <p className="text-xs text-muted">
              💡 Email requires a free{' '}
              <a
                href="https://app.brevo.com/settings/keys/api"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-fg"
              >
                Brevo API key
              </a>{' '}
              set as <code className="rounded bg-surface-2 px-1">BREVO_API_KEY</code> in your Render environment variables.
              No key? Use the Excel download above — it works offline too.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
