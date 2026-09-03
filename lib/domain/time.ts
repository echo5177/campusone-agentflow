/**
 * Every campus rule and every rendered timestamp is evaluated in the campus's own
 * wall clock, not the viewer's or the worker's. A Cloudflare worker runs in UTC,
 * so reading hours off a `Date` directly would put a 19:00 booking at 11:00 and
 * quietly change which rules pass.
 */
export const CAMPUS_TIME_ZONE = 'Asia/Shanghai';

const campusParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAMPUS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export type CampusWallClock = {
  /** Calendar day on campus, `YYYY-MM-DD`. */
  day: string;
  /** Minutes since midnight on campus. */
  minutes: number;
};

export function campusWallClock(value: Date): CampusWallClock {
  const parts = campusParts.formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return {
    day: `${pick('year')}-${pick('month')}-${pick('day')}`,
    minutes: Number(pick('hour')) * 60 + Number(pick('minute')),
  };
}

/** Parses a venue's `HH:MM` opening hour into minutes since midnight. */
export function openingMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
