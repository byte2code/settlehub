import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Users } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { keys } from '../hooks/queries';
import { useAuth } from '../hooks/useAuth';
import { ErrorNote, PageSpinner } from '../components/ui/bits';
import { useToast } from '../components/ui/Toast';

export function JoinPage({ onSignIn }: { onSignIn: (context: string) => void }) {
  const { code = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [joining, setJoining] = useState(false);
  const preview = useQuery({ queryKey: ['invite', code], queryFn: () => api.previewInvite(code), enabled: Boolean(user && code), retry: false });

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="card space-y-4 p-6">
          <KeyRound className="mx-auto h-10 w-10 text-brand-fg" />
          <h1 className="text-xl font-bold text-fg">You’ve been invited to a group</h1>
          <p className="text-sm text-muted">Sign in or create a free account to join with code <span className="font-mono font-bold text-fg">{code}</span>.</p>
          <button className="btn-primary w-full py-2.5 text-sm" onClick={() => onSignIn(`Sign in to join the group with code ${code}.`)}>Continue</button>
        </div>
      </div>
    );
  }

  if (preview.isLoading) return <PageSpinner />;

  const join = async () => {
    setJoining(true);
    try {
      const group = await api.joinGroup(code);
      await queryClient.invalidateQueries({ queryKey: keys.groups });
      toast.success(`Welcome to ${group.name}!`);
      navigate(`/groups/${group.id}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      setJoining(false);
    }
  };

  const p = preview.data;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card space-y-4 p-6 text-center">
        <Users className="mx-auto h-10 w-10 text-brand-fg" />
        {preview.error ? (
          <>
            <ErrorNote message={errorMessage(preview.error, 'This invite is not valid')} />
            <button className="btn-secondary w-full" onClick={() => navigate('/')}>Back to my groups</button>
          </>
        ) : p ? (
          <>
            <div>
              <h1 className="text-xl font-bold text-fg">{p.groupName}</h1>
              <p className="text-sm text-muted">{p.memberCount} {p.memberCount === 1 ? 'member' : 'members'} · {p.currencyCode} · {p.groupType}</p>
            </div>
            {p.alreadyMember && p.groupId ? (
              <button className="btn-primary w-full py-2.5 text-sm" onClick={() => navigate(`/groups/${p.groupId}`, { replace: true })}>You’re already in — open group</button>
            ) : (
              <button className="btn-primary w-full py-2.5 text-sm" onClick={join} disabled={joining}>{joining ? 'Joining…' : 'Join group'}</button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
