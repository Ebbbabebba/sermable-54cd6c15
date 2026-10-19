import { describe, it, expect } from 'vitest';
import { buildSchedule } from './reviewSchedule';

const start = new Date(2026, 9, 19, 10, 0, 0);

describe('buildSchedule', () => {
  it('first step is 10 minutes after start', () => {
    expect(buildSchedule(start)[0].getTime()).toBe(start.getTime() + 10 * 60 * 1000);
  });
  it('tonight 19:00 and tomorrow 08:00', () => {
    const s = buildSchedule(start);
    expect(s[1]).toEqual(new Date(2026, 9, 19, 19));
    expect(s[2]).toEqual(new Date(2026, 9, 20, 8));
  });
  it('then 2, 3, 5, 7 day gaps at 18:00', () => {
    const s = buildSchedule(start);
    expect(s.slice(3)).toEqual([3, 6, 11, 18].map(d => new Date(2026, 9, 19 + d, 18)));
  });
  it('compresses so last step lands on the target date', () => {
    const target = new Date(2026, 9, 24, 10);
    const s = buildSchedule(start, target);
    expect(s[s.length - 1].getTime()).toBe(target.getTime());
  });
  it('keeps the schedule when the target is far away', () => {
    expect(buildSchedule(start, new Date(2027, 0, 1))).toEqual(buildSchedule(start));
  });
});
