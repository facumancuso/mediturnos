export type WeekdayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type WorkingHourBreak = {
  start: string;
  end: string;
};

export type WorkingDayConfig = {
  enabled: boolean;
  start: string;
  end: string;
  breaks: WorkingHourBreak[];
};

export type WorkingHoursConfig = {
  appointmentDuration: number;
  days: Record<WeekdayKey, WorkingDayConfig>;
};

const DEFAULT_START = '09:00';
const DEFAULT_END = '18:00';
const DEFAULT_BREAKS: WorkingHourBreak[] = [{ start: '13:00', end: '14:00' }];
const DEFAULT_DURATION = 30;

export const WEEKDAY_KEYS: WeekdayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const WEEKDAY_KEY_BY_DATE_INDEX: WeekdayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function normalizeBreaks(value: unknown): WorkingHourBreak[] {
  if (!Array.isArray(value)) {
    return DEFAULT_BREAKS;
  }

  const clean = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const breakEntry = entry as { start?: unknown; end?: unknown };
      if (typeof breakEntry.start !== 'string' || typeof breakEntry.end !== 'string') return null;
      return { start: breakEntry.start, end: breakEntry.end };
    })
    .filter((entry): entry is WorkingHourBreak => entry !== null);

  return clean.length > 0 ? clean : DEFAULT_BREAKS;
}

function toPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function defaultEnabledForDay(day: WeekdayKey) {
  return day !== 'saturday' && day !== 'sunday';
}

export function parseWorkingHoursConfig(raw: string | null | undefined, fallbackDuration = DEFAULT_DURATION): WorkingHoursConfig {
  let parsed: Record<string, unknown> = {};

  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const json = JSON.parse(raw) as Record<string, unknown>;
      if (json && typeof json === 'object') {
        parsed = json;
      }
    } catch {
      parsed = {};
    }
  }

  const legacyStart = typeof parsed.start === 'string' ? parsed.start : DEFAULT_START;
  const legacyEnd = typeof parsed.end === 'string' ? parsed.end : DEFAULT_END;
  const legacyBreaks = normalizeBreaks(parsed.breaks);
  const parsedDays = (parsed.days && typeof parsed.days === 'object' ? parsed.days : {}) as Record<string, unknown>;

  const days = WEEKDAY_KEYS.reduce((acc, day) => {
    const dayValue = parsedDays[day] && typeof parsedDays[day] === 'object'
      ? (parsedDays[day] as { enabled?: unknown; start?: unknown; end?: unknown; breaks?: unknown })
      : {};

    acc[day] = {
      enabled:
        typeof dayValue.enabled === 'boolean'
          ? dayValue.enabled
          : defaultEnabledForDay(day),
      start: typeof dayValue.start === 'string' ? dayValue.start : legacyStart,
      end: typeof dayValue.end === 'string' ? dayValue.end : legacyEnd,
      breaks: normalizeBreaks(dayValue.breaks ?? legacyBreaks),
    };

    return acc;
  }, {} as Record<WeekdayKey, WorkingDayConfig>);

  return {
    appointmentDuration: toPositiveNumber(parsed.appointmentDuration, fallbackDuration),
    days,
  };
}

export function getWeekdayKey(date: Date): WeekdayKey {
  return WEEKDAY_KEY_BY_DATE_INDEX[date.getDay()] || 'monday';
}

export function getWorkingHoursForDate(
  raw: string | null | undefined,
  date: Date,
  fallbackDuration = DEFAULT_DURATION
) {
  const config = parseWorkingHoursConfig(raw, fallbackDuration);
  const dayKey = getWeekdayKey(date);
  const dayConfig = config.days[dayKey];

  return {
    enabled: dayConfig.enabled,
    start: dayConfig.start,
    end: dayConfig.end,
    breaks: dayConfig.breaks,
    appointmentDuration: config.appointmentDuration,
    dayKey,
  };
}
