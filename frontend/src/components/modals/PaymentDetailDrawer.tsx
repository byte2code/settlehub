import { useState } from 'react';
import { Link } from 'react-router';
import { MessageCircle, Zap } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { Avatar, EmptyState, ErrorNote, PageSpinner } from '../ui/bits';
import { formatMoney } from '../../lib/money';
import { buildUpiLink } from '../../lib/upi';
import { buildWhatsAppReminder } from '../../lib/remind';
import { errorMessage } from '../../lib/errors';
import { usePaymentSummary } from '../../hooks/queries';
import type { PersonPayment } from '../../types';

export type PaymentTab = 'owe' | 'owed';

function GroupChips({ person, onNavigate }: { person: PersonPayment; onNavigate: () => void }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {person.groupBreakdown.map((g) => (
        <li key={g.groupId}>
          <Link to={`/groups/${g.groupId}`} onClick={onNavigate} className="chip border-line text-muted hover:text-fg">
            {g.groupName} · {formatMoney(g.amountCents, person.currencyCode)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PersonCard({ person, tab, onNavigate }: { person: PersonPayment; tab: PaymentTab; onNavigate: () => void }) {
  const amount = formatMoney(person.totalAmountCents, person.currencyCode);
  const groupNames = person.groupBreakdown.map((g) => g.groupName);
  const canUpi = tab === 'owe' && person.currencyCode === 'INR' && !!person.upiId;

  return (
    <li className="rounded-2xl border border-line bg-surface-2 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={person.userName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">
            {tab === 'owe' ? `You owe ${person.userName}` : `${person.userName} owes you`}
          </p>
          <p className={`font-mono text-lg font-black ${tab === 'owe' ? 'text-neg' : 'text-pos'}`}>{amount}</p>
        </div>
      </div>
      <GroupChips person={person} onNavigate={onNavigate} />
      {tab === 'owe' && (
        canUpi ? (
          <a
            className="btn-primary mt-3 w-full justify-center"
            href={buildUpiLink({
              upiId: person.upiId!,
              payeeName: person.userName,
              amountCents: person.totalAmountCents,
              note: `SettleHub: ${groupNames.join(', ')}`,
            })}
          >
            <Zap className="h-4 w-4" /> Pay via UPI
          </a>
        ) : (
          <p className="mt-3 text-xs text-subtle">
            {person.currencyCode !== 'INR' ? 'UPI works for ₹ only.' : `${person.userName.split(' ')[0]} hasn’t added a UPI ID yet.`} Open a group above to settle up.
          </p>
        )
      )}
      {tab === 'owed' && (
        <a
          className="btn-secondary mt-3 w-full justify-center"
          href={buildWhatsAppReminder({ debtorName: person.userName, amountCents: person.totalAmountCents, currency: person.currencyCode, groupNames })}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="h-4 w-4" /> Remind via WhatsApp
        </a>
      )}
    </li>
  );
}

function Totals({ totals, tone }: { totals: Record<string, number>; tone: 'pos' | 'neg' }) {
  const entries = Object.entries(totals);
  if (!entries.length) return null;
  return (
    <p className={`mb-3 font-mono text-sm font-bold ${tone === 'pos' ? 'text-pos' : 'text-neg'}`}>
      {entries.map(([code, cents]) => formatMoney(cents, code)).join(' + ')}
    </p>
  );
}

export default function PaymentDetailDrawer({ open, onClose, initialTab }: { open: boolean; onClose: () => void; initialTab: PaymentTab }) {
  const [tab, setTab] = useState<PaymentTab>(initialTab);
  const { data, isLoading, error } = usePaymentSummary(open);

  const people = tab === 'owe' ? data?.peopleYouOwe : data?.peopleWhoOweYou;

  return (
    <Drawer open={open} onClose={onClose} title="Payment summary" subtitle="Across all your active groups">
      <div className="segmented mb-4 w-full" role="tablist">
        <button role="tab" aria-selected={tab === 'owe'} onClick={() => setTab('owe')} className="flex-1">Who you owe</button>
        <button role="tab" aria-selected={tab === 'owed'} onClick={() => setTab('owed')} className="flex-1">Who owes you</button>
      </div>
      <ErrorNote message={error ? errorMessage(error) : null} />
      {isLoading ? (
        <PageSpinner />
      ) : data && people ? (
        <>
          <Totals totals={tab === 'owe' ? data.totalOweByCurrency : data.totalReceivableByCurrency} tone={tab === 'owe' ? 'neg' : 'pos'} />
          {people.length === 0 ? (
            <EmptyState icon={<Zap className="h-6 w-6" />} title="All clear">
              {tab === 'owe' ? 'You don’t owe anyone right now.' : 'Nobody owes you right now.'}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {people.map((p) => <PersonCard key={`${p.userId}-${p.currencyCode}`} person={p} tab={tab} onNavigate={onClose} />)}
            </ul>
          )}
        </>
      ) : null}
    </Drawer>
  );
}
