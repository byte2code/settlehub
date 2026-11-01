import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, downloadBlob } from '../../lib/api';
import { computeWrapped, drawWrapped } from '../../lib/wrapped';
import { useGroups } from '../../hooks/queries';
import { useCurrentUser } from '../../hooks/useAuth';
import { PageSpinner } from '../ui/bits';

export default function WrappedPanel() {
  const user = useCurrentUser();
  const canvas = useRef<HTMLCanvasElement>(null);
  const groups = useGroups();
  const badges = useQuery({ queryKey: ['badges'], queryFn: api.badges });

  useEffect(() => {
    if (canvas.current && groups.data && badges.data) drawWrapped(canvas.current, computeWrapped(user, groups.data, badges.data));
  }, [user, groups.data, badges.data]);

  const save = () =>
    canvas.current?.toBlob((blob) => {
      if (blob) void downloadBlob(blob, 'SettleHub_Wrapped.png');
    }, 'image/png');

  if (groups.isLoading || badges.isLoading) return <PageSpinner />;
  return (
    <div className="space-y-3">
      <canvas ref={canvas} className="mx-auto w-full max-w-xs rounded-2xl border border-line shadow-lg" aria-label="Your SettleHub Wrapped card" />
      <button type="button" className="btn-primary w-full" onClick={save}><Download className="h-4 w-4" /> Save as image</button>
    </div>
  );
}
