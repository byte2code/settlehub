import { Link } from 'react-router';

/** Plain-language privacy notice. Edit the contact line if you publish under your own name. */
export function Privacy() {
  return (
    <article className="prose-sm mx-auto max-w-2xl space-y-4 px-4 py-10 text-sm text-muted">
      <h1 className="text-2xl font-extrabold text-fg">Privacy</h1>
      <p>SettleHub is a free, open-source expense splitter. Here is what it stores and why.</p>
      <h2 className="text-base font-bold text-fg">What we keep</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your name, email address and a hashed password (or your Google email if you sign in with Google).</li>
        <li>Groups, expenses, payments, receipts photos and comments you or your group add.</li>
        <li>Optional profile details: UPI ID, bio, avatar, sound preference.</li>
        <li>If you turn on background alerts: a push subscription for that device.</li>
      </ul>
      <h2 className="text-base font-bold text-fg">What we don’t do</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>No ads, no trackers, no selling or sharing your data.</li>
        <li>Receipt scanning and voice entry run in your browser. Voice entry uses your browser’s own speech service (in Chrome that is Google’s).</li>
      </ul>
      <h2 className="text-base font-bold text-fg">Who can see what</h2>
      <p>Only members of a group see its expenses, receipts, comments and members’ UPI IDs. The people running the service can see aggregate numbers, not your receipts or comments.</p>
      <h2 className="text-base font-bold text-fg">Your controls</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Download my data</strong> and <strong>Sign out other devices</strong> are in Profile.</li>
        <li><strong>Delete my account</strong> (Profile) removes your name and email. Past expenses stay in your groups as “Deleted user” so other people’s balances remain correct.</li>
        <li>Old receipt photos are removed automatically after a year, and old notifications after 90 days.</li>
      </ul>
      <p><Link to="/" className="font-semibold text-brand-fg hover:underline">← Back to SettleHub</Link></p>
    </article>
  );
}
