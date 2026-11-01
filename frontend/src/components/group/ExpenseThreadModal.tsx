import { useState, type FormEvent } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { MAX_COMMENT_CHARS, REACTION_EMOJI, commentLength } from '../../lib/reactions';
import { Modal } from '../ui/Modal';
import { Avatar, ErrorNote, PageSpinner } from '../ui/bits';
import { useToast } from '../ui/Toast';
import type { Engagement, Expense, Group } from '../../types';

/** Reactions and a short comment thread for one expense. Plain text only. */
export default function ExpenseThreadModal({ group, expense, canModerate, onClose }: { group: Group; expense: Expense; canModerate: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const readOnly = group.archived;
  const engagementKey = ['group', group.id, 'engagement'];
  const commentsKey = ['expense', expense.id, 'comments'];

  const comments = useQuery({ queryKey: commentsKey, queryFn: () => api.comments(expense.id) });
  const engagement = useQuery({ queryKey: engagementKey, queryFn: () => api.engagement(group.id), select: (all) => all[expense.id] as Engagement | undefined });

  const react = useMutation({
    mutationFn: (emoji: string) => api.react(expense.id, emoji),
    onSuccess: () => { void haptic('tap'); void qc.invalidateQueries({ queryKey: engagementKey }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const send = useMutation({
    mutationFn: (body: string) => api.addComment(expense.id, body),
    onSuccess: () => { setText(''); setError(null); void qc.invalidateQueries({ queryKey: commentsKey }); void qc.invalidateQueries({ queryKey: engagementKey }); },
    onError: (e) => setError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: commentsKey }); void qc.invalidateQueries({ queryKey: engagementKey }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const length = commentLength(text);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (length > 0 && length <= MAX_COMMENT_CHARS) send.mutate(text);
  };

  return (
    <Modal open onClose={onClose} icon={<MessageCircle className="h-5 w-5" />} title={expense.description} subtitle={`${expense.costFormatted} · ${formatDate(expense.date)}`} size="sm">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
          {REACTION_EMOJI.map((emoji) => {
            const count = engagement.data?.reactions[emoji] ?? 0;
            const mine = engagement.data?.mine.includes(emoji) ?? false;
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={mine}
                disabled={readOnly || react.isPending}
                onClick={() => react.mutate(emoji)}
                className={`rounded-xl border px-2.5 py-1.5 text-base transition-all active:scale-90 ${mine ? 'border-emerald-500 bg-emerald-500/15' : 'border-line bg-surface-2'} disabled:opacity-50`}
              >
                {emoji}{count > 0 && <span className="ml-1 font-mono text-xs text-muted">{count}</span>}
              </button>
            );
          })}
        </div>

        <div>
          {comments.isLoading ? <PageSpinner /> : (
            <ul className="space-y-2" aria-live="polite">
              {comments.data?.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <Avatar name={c.userName} size="sm" />
                  <div className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-3 py-2">
                    <p className="text-[11px] font-semibold text-muted">{c.mine ? 'You' : c.userName}</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-fg">{c.body}</p>
                  </div>
                  {!readOnly && (c.mine || canModerate) && (
                    <button type="button" className="btn-ghost p-1.5 text-subtle hover:text-neg" aria-label="Delete comment" onClick={() => remove.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {comments.data?.length === 0 && <li className="py-3 text-center text-xs text-muted">No comments yet. Say something kind (or funny).</li>}
            </ul>
          )}
        </div>

        <ErrorNote message={error ?? (comments.error ? errorMessage(comments.error) : null)} />
        {readOnly ? (
          <p className="text-center text-xs text-muted">This group is archived, so it's read-only.</p>
        ) : (
          <form onSubmit={submit} className="flex items-start gap-2">
            <div className="flex-1">
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" aria-label="Comment" maxLength={400} />
              <p className={`mt-0.5 text-right text-[10px] ${length > MAX_COMMENT_CHARS ? 'text-neg' : 'text-subtle'}`}>{length}/{MAX_COMMENT_CHARS}</p>
            </div>
            <button type="submit" className="btn-primary p-2.5" disabled={length === 0 || length > MAX_COMMENT_CHARS || send.isPending} aria-label="Send comment">
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
