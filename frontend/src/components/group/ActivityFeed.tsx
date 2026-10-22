import { Activity as ActivityIcon } from 'lucide-react';
import { timeAgo } from '../../lib/dates';
import { useActivity } from '../../hooks/queries';
import { Avatar, EmptyState, Spinner } from '../ui/bits';

export function ActivityFeed({ groupId }: { groupId: string }) {
  const { data, isLoading } = useActivity(groupId);
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (!data?.length) {
    return <EmptyState icon={<ActivityIcon className="h-6 w-6" />} title="No activity yet" />;
  }
  return (
    <ol className="card divide-y divide-line">
      {data.map((a) => (
        <li key={a.id} className="flex items-start gap-3 p-3">
          <Avatar name={a.actorName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-fg">{a.summary}</p>
            <time className="text-[11px] text-subtle" dateTime={a.createdAt} title={new Date(a.createdAt).toLocaleString()}>
              {timeAgo(a.createdAt)}
            </time>
          </div>
          {a.amountFormatted && <span className="shrink-0 font-mono text-xs text-muted">{a.amountFormatted}</span>}
        </li>
      ))}
    </ol>
  );
}
