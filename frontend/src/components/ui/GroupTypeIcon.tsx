import { createElement } from 'react';
import { groupTypeIcon } from '../../lib/groups';

export function GroupTypeIcon({ type, className }: { type: string; className?: string }) {
  return createElement(groupTypeIcon(type), { className, 'aria-hidden': true });
}
