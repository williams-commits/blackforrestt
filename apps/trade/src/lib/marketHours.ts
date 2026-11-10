export type MarketHoursState = "OPEN" | "CLOSED" | "WAITING_FOR_QUOTE";
export type MarketCalendar = "US_EQUITY" | "US_FUTURES" | "UK" | "GERMANY" | "FRANCE" | "JAPAN" | "NONE";

/** Recurring baseline sessions; ad-hoc and exceptional exchange closures are not modeled. */
export interface MarketSchedule {
  id: string;
  venue: string;
  timezone: string;
  calendar: MarketCalendar;
  sessions: Partial<Record<number, readonly (readonly [number, number])[]>>;
  alwaysOpen?: boolean;
}

export interface MarketHoursView {
  state: MarketHoursState;
  isOpen: boolean;
  canTrade: boolean;
  venue: string;
  timezone: string;
  nextOpenAt: number | null;
  nextCloseAt: number | null;
}

export function formatNextMarketOpen(view: MarketHoursView, locale = "en-US"): string | null {
  if (view.nextOpenAt == null) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone: view.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(view.nextOpenAt);
}

const MINUTE_MS = 60_000;
const SAMPLE_STEP_MS = 5 * MINUTE_MS;
const MAX_QUOTE_AGE_MS = 60_000;

const ALL_DAY: Partial<Record<number, readonly (readonly [number, number])[]>> = {
  0: [[0, 1440]],
  1: [[0, 1440]],
  2: [[0, 1440]],
  3: [[0, 1440]],
  4: [[0, 1440]],
  5: [[0, 1440]],
  6: [[0, 1440]],
};

const FX_SESSIONS: MarketSchedule["sessions"] = {
  0: [[1025, 1440]],
  1: [[0, 1019], [1025, 1440]],
  2: [[0, 1019], [1025, 1440]],
  3: [[0, 1019], [1025, 1440]],
  4: [[0, 1019], [1025, 1440]],
  5: [[0, 1019]],
};

const CME_SESSIONS: MarketSchedule["sessions"] = {
  0: [[1020, 1440]],
  1: [[0, 960], [1020, 1440]],
  2: [[0, 960], [1020, 1440]],
  3: [[0, 960], [1020, 1440]],
  4: [[0, 960], [1020, 1440]],
  5: [[0, 960]],
};

const US_EQUITY_SESSIONS: MarketSchedule["sessions"] = {
  1: [[570, 960]],
  2: [[570, 960]],
  3: [[570, 960]],
  4: [[570, 960]],
  5: [[570, 960]],
};

const SCHEDULES: Record<string, MarketSchedule> = {
  crypto: {
    id: "crypto",
    venue: "Crypto markets",
    timezone: "UTC",
    calendar: "NONE",
    sessions: ALL_DAY,
    alwaysOpen: true,
  },
  forex: {
    id: "forex",
    venue: "OANDA FX hours",
    timezone: "America/New_York",
    calendar: "NONE",
    sessions: FX_SESSIONS,
  },
  forexNzd: {
    id: "forex-nzd",
    venue: "OANDA FX hours",
    timezone: "America/New_York",
    calendar: "NONE",
    sessions: FX_SESSIONS,
  },
  usEquity: {
    id: "us-equity",
    venue: "US listed markets",
    timezone: "America/New_York",
    calendar: "US_EQUITY",
    sessions: US_EQUITY_SESSIONS,
  },
  usIndex: {
    id: "us-index",
    venue: "US cash-index session",
    timezone: "America/New_York",
    calendar: "US_EQUITY",
    sessions: US_EQUITY_SESSIONS,
  },
  xetra: {
    id: "xetra",
    venue: "Xetra",
    timezone: "Europe/Berlin",
    calendar: "GERMANY",
    sessions: { 1: [[540, 1050]], 2: [[540, 1050]], 3: [[540, 1050]], 4: [[540, 1050]], 5: [[540, 1050]] },
  },
  euronextParis: {
    id: "euronext-paris",
    venue: "Euronext Paris",
    timezone: "Europe/Paris",
    calendar: "FRANCE",
    sessions: { 1: [[540, 1050]], 2: [[540, 1050]], 3: [[540, 1050]], 4: [[540, 1050]], 5: [[540, 1050]] },
  },
  london: {
    id: "london",
    venue: "London Stock Exchange",
    timezone: "Europe/London",
    calendar: "UK",
    sessions: { 1: [[480, 990]], 2: [[480, 990]], 3: [[480, 990]], 4: [[480, 990]], 5: [[480, 990]] },
  },
  jpx: {
    id: "jpx",
    venue: "Tokyo Stock Exchange",
    timezone: "Asia/Tokyo",
    calendar: "JAPAN",
    sessions: { 1: [[540, 690], [750, 930]], 2: [[540, 690], [750, 930]], 3: [[540, 690], [750, 930]], 4: [[540, 690], [750, 930]], 5: [[540, 690], [750, 930]] },
  },
  cme: {
    id: "cme",
    venue: "CME/COMEX/NYMEX reference session",
    timezone: "America/Chicago",
    calendar: "US_FUTURES",
    sessions: CME_SESSIONS,
  },
  ice: {
    id: "ice",
    venue: "ICE Futures Europe reference session",
    timezone: "Europe/London",
    calendar: "UK",
    sessions: { 1: [[60, 1380]], 2: [[60, 1380]], 3: [[60, 1380]], 4: [[60, 1380]], 5: [[60, 1380]] },
  },
};

const CRYPTO_SYMBOLS = new Set([
  "ADAUSD", "ATOMUSD", "AVAXUSD", "BCHUSD", "BTCUSD", "DOGEUSD", "DOTUSD",
  "ETHUSD", "LINKUSD", "LTCUSD", "POLUSD", "SOLUSD", "UNIUSD", "XRPUSD",
]);
const US_EQUITY_SYMBOLS = new Set([
  "AAPL", "AMD", "AMZN", "CORNUSD", "GOOGL", "JPM", "META", "MSFT", "NVDA",
  "SOYBUSD", "TSLA", "VIXY", "WEATUSD",
]);
const US_INDEX_SYMBOLS = new Set(["NAS100", "SPX500", "US30"]);
const FX_SYMBOLS = new Set([
  "AUDCAD", "AUDJPY", "AUDUSD", "CHFJPY", "EURAUD", "EURCHF", "EURGBP",
  "EURJPY", "EURUSD", "GBPCAD", "GBPJPY", "GBPUSD", "NZDUSD", "USDCAD",
  "USDCHF", "USDJPY",
]);

export function marketScheduleForSymbol(symbol: string): MarketSchedule | null {
  const normalized = symbol.trim().toUpperCase();
  if (CRYPTO_SYMBOLS.has(normalized)) return SCHEDULES.crypto;
  if (FX_SYMBOLS.has(normalized)) return normalized === "NZDUSD" ? SCHEDULES.forexNzd : SCHEDULES.forex;
  if (US_EQUITY_SYMBOLS.has(normalized)) return SCHEDULES.usEquity;
  if (US_INDEX_SYMBOLS.has(normalized)) return SCHEDULES.usIndex;
  if (normalized === "GER40") return SCHEDULES.xetra;
  if (normalized === "FRA40") return SCHEDULES.euronextParis;
  if (normalized === "UK100") return SCHEDULES.london;
  if (normalized === "JPN225") return SCHEDULES.jpx;
  if (["XAUUSD", "XAGUSD", "XPTUSD", "XPDUSD", "HGUSD", "NGUSD", "WTIUSD"].includes(normalized)) {
    return SCHEDULES.cme;
  }
  if (normalized === "XBRUSD") return SCHEDULES.ice;
  return null;
}

export function marketHoursForSymbol(
  symbol: string,
  now = Date.now(),
  quoteTimestamp = now,
  maxQuoteAgeMs = MAX_QUOTE_AGE_MS,
): MarketHoursView {
  const schedule = marketScheduleForSymbol(symbol);
  if (!schedule) {
    return {
      state: "CLOSED",
      isOpen: false,
      canTrade: false,
      venue: "Schedule unavailable",
      timezone: "UTC",
      nextOpenAt: null,
      nextCloseAt: null,
    };
  }

  const isOpen = isMarketOpenAt(schedule, symbol, now);
  const quoteFresh = quoteTimestamp > 0
    && quoteTimestamp <= now + 5_000
    && now - quoteTimestamp <= maxQuoteAgeMs;
  const transitions = schedule.alwaysOpen ? [] : nextTransitions(schedule, symbol, now);
  const nextOpenAt = transitions.find((transition) => transition.opens)?.at ?? null;
  const nextCloseAt = transitions.find((transition) => !transition.opens)?.at ?? null;
  const canTrade = isOpen && quoteFresh;

  return {
    state: !isOpen ? "CLOSED" : quoteFresh ? "OPEN" : "WAITING_FOR_QUOTE",
    isOpen,
    canTrade,
    venue: schedule.venue,
    timezone: schedule.timezone,
    nextOpenAt,
    nextCloseAt,
  };
}

export function isMarketOpenAt(schedule: MarketSchedule, symbol: string, timestamp: number): boolean {
  if (schedule.alwaysOpen) return true;
  const local = localParts(timestamp, schedule.timezone);
  if (isHoliday(schedule.calendar, local.date)) return false;
  const intervals = intervalsForDate(schedule, local.date, local.weekday);
  const open = intervals.some(([start, end]) => local.minute >= start && local.minute < end);
  if (!open) return false;

  if (schedule.id === "forex-nzd") {
    const auckland = localParts(timestamp, "Pacific/Auckland");
    if (auckland.weekday >= 1 && auckland.weekday <= 5 && auckland.minute >= 419 && auckland.minute < 425) {
      return false;
    }
  }
  return true;
}

interface LocalParts {
  date: string;
  weekday: number;
  minute: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function localParts(timestamp: number, timezone: string): LocalParts {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timezone, formatter);
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday ?? "");
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function nextTransitions(
  schedule: MarketSchedule,
  symbol: string,
  now: number,
): Array<{ at: number; opens: boolean }> {
  const minute = Math.floor(now / MINUTE_MS);
  const cached = transitionCache.get(schedule.id);
  if (cached?.minute === minute) return cached.transitions;

  const transitions: Array<{ at: number; opens: boolean }> = [];
  let previousAt = now;
  let previousState = isMarketOpenAt(schedule, symbol, now);
  const limit = now + 9 * 24 * 60 * MINUTE_MS;

  for (let sampleAt = now + SAMPLE_STEP_MS; sampleAt <= limit; sampleAt += SAMPLE_STEP_MS) {
    const sampleState = isMarketOpenAt(schedule, symbol, sampleAt);
    if (sampleState !== previousState) {
      let transitionAt = Math.floor(previousAt / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
      while (transitionAt <= sampleAt) {
        if (isMarketOpenAt(schedule, symbol, transitionAt) !== previousState) break;
        transitionAt += MINUTE_MS;
      }
      transitions.push({ at: transitionAt, opens: sampleState });
      if (transitions.length === 2) break;
      previousState = sampleState;
    }
    previousAt = sampleAt;
  }
  transitionCache.set(schedule.id, { minute, transitions });
  return transitions;
}

function intervalsForDate(schedule: MarketSchedule, date: string, weekday: number): readonly (readonly [number, number])[] {
  const intervals = schedule.sessions[weekday] ?? [];
  if (schedule.calendar !== "US_EQUITY" || intervals.length === 0) return intervals;
  const earlyClose = usEquityEarlyClose(date);
  return earlyClose == null
    ? intervals
    : intervals.map(([start, end]) => [start, Math.min(end, earlyClose)] as const);
}

function usEquityEarlyClose(date: string): number | null {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = weekdayOf(date);
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  const dayAfterThanksgiving = addDays(thanksgiving, 1);
  if (date === dayAfterThanksgiving) return 13 * 60;
  if (month === 7 && day === 3 && weekday >= 1 && weekday <= 5) return 13 * 60;
  if (month === 12 && day === 24 && weekday >= 1 && weekday <= 5) return 13 * 60;
  return null;
}

function isHoliday(calendar: MarketCalendar, date: string): boolean {
  if (calendar === "NONE") return false;
  const year = Number(date.slice(0, 4));
  const holidays = holidaysForYear(calendar, year);
  return holidays.has(date);
}

const holidayCache = new Map<string, Set<string>>();
const transitionCache = new Map<string, {
  minute: number;
  transitions: Array<{ at: number; opens: boolean }>;
}>();

function holidaysForYear(calendar: MarketCalendar, year: number): Set<string> {
  const key = `${calendar}:${year}`;
  const cached = holidayCache.get(key);
  if (cached) return cached;

  const dates = new Set<string>();
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);
  const easterMonday = addDays(easter, 1);

  if (calendar === "US_EQUITY") {
    addSet(dates, observedNewYear(year));
    addSet(dates, observedNewYear(year + 1));
    addSet(dates, [nthWeekday(year, 1, 1, 3), nthWeekday(year, 2, 1, 3), goodFriday]);
    addSet(dates, [lastWeekday(year, 5, 1)]);
    if (year >= 2022) addSet(dates, [observedFixedDate(year, 6, 19)]);
    addSet(dates, [observedFixedDate(year, 7, 4), nthWeekday(year, 9, 1, 1), nthWeekday(year, 11, 4, 4)]);
    addSet(dates, [observedFixedDate(year, 12, 25)]);
  } else if (calendar === "US_FUTURES") {
    addSet(dates, observedNewYear(year));
    addSet(dates, observedNewYear(year + 1));
    addSet(dates, [
      goodFriday,
      lastWeekday(year, 5, 1),
      observedFixedDate(year, 7, 4),
      nthWeekday(year, 9, 1, 1),
      nthWeekday(year, 11, 4, 4),
      observedFixedDate(year, 12, 25),
    ]);
  } else if (calendar === "UK") {
    addSet(dates, ukBankHolidays(year));
  } else if (calendar === "GERMANY") {
    addSet(dates, [
      observedFixedDate(year, 1, 1),
      goodFriday,
      easterMonday,
      dateKey(year, 5, 1),
      dateKey(year, 12, 24),
      dateKey(year, 12, 25),
      dateKey(year, 12, 26),
      dateKey(year, 12, 31),
    ]);
  } else if (calendar === "FRANCE") {
    addSet(dates, [
      observedFixedDate(year, 1, 1),
      goodFriday,
      easterMonday,
      dateKey(year, 5, 1),
      dateKey(year, 12, 25),
      dateKey(year, 12, 26),
    ]);
  } else if (calendar === "JAPAN") {
    addSet(dates, japanHolidays(year));
  }

  holidayCache.set(key, dates);
  return dates;
}

function ukBankHolidays(year: number): Set<string> {
  const dates = new Set<string>();
  const add = (date: string) => dates.add(date);
  add(observedFixedDate(year, 1, 1));
  const easter = easterSunday(year);
  add(addDays(easter, -2));
  add(addDays(easter, 1));
  add(nthWeekday(year, 5, 1, 1));
  add(lastWeekday(year, 5, 1));
  add(lastWeekday(year, 8, 1));

  const christmas = dateKey(year, 12, 25);
  const boxingDay = dateKey(year, 12, 26);
  if (weekdayOf(christmas) === 0 || weekdayOf(christmas) === 6) {
    add(nextWeekdayDate(christmas, dates));
  } else {
    add(christmas);
  }
  if (weekdayOf(boxingDay) === 0 || weekdayOf(boxingDay) === 6 || dates.has(boxingDay)) {
    add(nextWeekdayDate(boxingDay, dates));
  } else {
    add(boxingDay);
  }
  return dates;
}

function japanHolidays(year: number): Set<string> {
  const dates = new Set<string>([
    dateKey(year, 1, 1),
    dateKey(year, 1, 2),
    dateKey(year, 1, 3),
    nthWeekday(year, 1, 1, 2),
    dateKey(year, 2, 11),
    dateKey(year, 2, 23),
    dateKey(year, 3, japanVernalEquinox(year)),
    dateKey(year, 4, 29),
    dateKey(year, 5, 3),
    dateKey(year, 5, 4),
    dateKey(year, 5, 5),
    nthWeekday(year, 7, 1, 3),
    dateKey(year, 8, 11),
    nthWeekday(year, 9, 1, 3),
    dateKey(year, 9, japanAutumnEquinox(year)),
    nthWeekday(year, 10, 1, 2),
    dateKey(year, 11, 3),
    dateKey(year, 11, 23),
    dateKey(year, 12, 31),
  ]);
  for (const date of Array.from(dates)) {
    if (weekdayOf(date) === 0) dates.add(addDays(date, 1));
  }
  for (let day = 2; day <= 31; day += 1) {
    const date = dateKey(year, 9, day);
    if (
      weekdayOf(date) >= 1 && weekdayOf(date) <= 5 &&
      dates.has(addDays(date, -1)) && dates.has(addDays(date, 1))
    ) {
      dates.add(date);
    }
  }
  return dates;
}

function addSet(target: Set<string>, values: Iterable<string>): void {
  for (const value of values) target.add(value);
}

function observedNewYear(year: number): string {
  const date = dateKey(year, 1, 1);
  return observedFixedDate(year, 1, 1) === date
    ? date
    : dateKey(year - 1, 12, 31);
}

function observedFixedDate(year: number, month: number, day: number): string {
  const date = dateKey(year, month, day);
  const weekday = weekdayOf(date);
  if (weekday === 6) return addDays(date, -1);
  if (weekday === 0) return addDays(date, 1);
  return date;
}

function nextWeekdayDate(date: string, holidays: Set<string>): string {
  let candidate = addDays(date, 1);
  while (weekdayOf(candidate) === 0 || weekdayOf(candidate) === 6 || holidays.has(candidate)) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const firstWeekday = weekdayOf(dateKey(year, month, 1));
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return dateKey(year, month, day);
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastWeekdayValue = weekdayOf(dateKey(year, month, lastDay));
  const day = lastDay - ((lastWeekdayValue - weekday + 7) % 7);
  return dateKey(year, month, day);
}

function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return dateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateKey(year, month, day);
}

function japanVernalEquinox(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function japanAutumnEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}
