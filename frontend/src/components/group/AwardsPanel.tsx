import { useEffect, useRef } from 'react';
import { Download, Trophy } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadBlob } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { burst } from '../../lib/confetti';
import { drawAwards } from '../../lib/awardsCard';
import { ErrorNote, PageSpinner } from '../ui/bits';
import { useToast } from '../ui/Toast';
import type { Group } from '../../types';

/** Playful end-of-trip awards. An admin reveals them once; everyone then sees the same snapshot. */
export function AwardsPanel({ group }: { group: Group }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canvas = useRef<HTMLCanvasElement>(null);
  const key = ['group', group.id, 'awards'];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.awards(group.id) });
  const isAdmin = group.myRole === 'ADMIN';

  const reveal = useMutation({
    mutationFn: () => api.revealAwards(group.id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); burst('big'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const hide = useMutation({
    mutationFn: () => api.hideAwards(group.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  useEffect(() => {
    if (data?.revealed && canvas.current) drawAwards(canvas.current, group.name, data.awards);
  }, [data, group.name]);

  const save = () => canvas.current?.toBlob((blob) => { if (blob) void downloadBlob(blob, 'SettleHub_Awards.png'); }, 'image/png');

  if (isLoading) return <PageSpinner />;
  return (
    <section className="card space-y-3 p-4" aria-label="Trip awards">
      <h3 className="flex items-center gap-2 text-sm font-bold text-fg"><Trophy className="h-4 w-4 text-amber-500" /> Trip awards</h3>
      <ErrorNote message={error ? errorMessage(error) : null} />
      {!data?.revealed ? (
        <>
          <p className="text-xs text-muted">{data?.eligible ? 'Ready when you are. A group admin can reveal the awards for everyone.' : data?.message}</p>
          {isAdmin && data?.eligible && (
            <button type="button" className="btn-primary" disabled={reveal.isPending} onClick={() => reveal.mutate()}>Reveal the awards 🏆</button>
          )}
          {!isAdmin && data?.eligible && <p className="text-[11px] text-subtle">Ask an admin to reveal them.</p>}
        </>
      ) : (
        <>
          <ul className="space-y-2">
            {data.awards.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
                <span className="text-2xl" aria-hidden>{a.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-fg">{a.title}</p>
                  <p className="truncate text-xs text-muted">{a.winners.join(' & ')} · {a.detail}</p>
                </div>
              </li>
            ))}
            {data.awards.length === 0 && <li className="text-xs text-muted">Nobody qualified for an award this time.</li>}
          </ul>
          <canvas ref={canvas} className="mx-auto w-full max-w-[14rem] rounded-xl border border-line" aria-label="Shareable awards card" />
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" onClick={save}><Download className="h-4 w-4" /> Save as image</button>
            {isAdmin && <button type="button" className="btn-ghost" disabled={hide.isPending} onClick={() => hide.mutate()}>Hide</button>}
          </div>
        </>
      )}
    </section>
  );
}
