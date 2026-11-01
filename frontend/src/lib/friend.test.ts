import { describe, expect, it } from 'vitest';
import { findFriendGroup, nameFromEmail } from './friend';
import type { Group } from '../types';

const g = (id: string, members: { userId: string; email: string }[], archived = false) => ({ id, archived, members }) as unknown as Group;

describe('findFriendGroup', () => {
  const groups = [
    g('a', [{ userId: 'me', email: 'me@x.com' }, { userId: 'f', email: 'Rohan@Gmail.com' }]),
    g('b', [{ userId: 'me', email: 'me@x.com' }, { userId: 'f', email: 'rohan@gmail.com' }, { userId: 'z', email: 'z@x.com' }]),
    g('c', [{ userId: 'me', email: 'me@x.com' }, { userId: 'q', email: 'quin@x.com' }], true),
  ];
  it('matches the two-person group by email, ignoring case', () => {
    expect(findFriendGroup(groups, 'me', ' rohan@gmail.com ')?.id).toBe('a');
  });
  it('ignores bigger and archived groups and strangers', () => {
    expect(findFriendGroup(groups, 'me', 'quin@x.com')).toBeUndefined();
    expect(findFriendGroup(groups, 'me', 'nobody@x.com')).toBeUndefined();
  });
});

describe('nameFromEmail', () => {
  it('makes a readable name', () => {
    expect(nameFromEmail('rohan.k_2@gmail.com')).toBe('Rohan K');
    expect(nameFromEmail('123@x.com')).toBe('Friend');
  });
});
