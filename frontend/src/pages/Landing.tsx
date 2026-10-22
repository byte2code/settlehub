import { ArrowRight, Smartphone, Shuffle, ShieldCheck, Sparkles, Wallet, Zap } from 'lucide-react';

const FEATURES = [
  { icon: Shuffle, title: 'Fewest payments', text: 'Debt simplification turns a web of IOUs into the minimum number of transfers.' },
  { icon: Zap, title: 'Live for everyone', text: 'Expenses appear instantly for the whole group — no refreshing.' },
  { icon: Wallet, title: 'Any currency', text: 'Pay in baht, track in rupees. Converted with ECB rates, original kept.' },
  { icon: Smartphone, title: 'UPI & WhatsApp', text: 'One-tap UPI pay links and a ready-to-send WhatsApp summary.' },
  { icon: ShieldCheck, title: 'Private by default', text: 'Only group members can see a group — enforced on every request.' },
  { icon: Sparkles, title: 'Free, really', text: 'No ads, no premium tier. Runs entirely on free infrastructure.' },
];

export function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-14 text-center animate-fade-in sm:py-20">
      <div className="space-y-6">
        <span className="chip mx-auto border-emerald-500/25 bg-emerald-500/10 text-brand-fg">
          <Sparkles className="h-3.5 w-3.5" /> SettleHub 3.0
        </span>
        <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight text-fg sm:text-6xl">
          Split group expenses <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 bg-clip-text text-transparent">without the awkward maths</span>
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Track trips, flats and dinners together. Exact to the paisa, settled in the fewest payments.
        </p>
        <button onClick={onGetStarted} className="btn-primary px-8 py-3.5 text-sm">
          Get started — it’s free <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-brand-fg">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mb-1 text-sm font-bold text-fg">{title}</h3>
            <p className="text-xs text-muted">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
