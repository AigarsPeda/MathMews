export const WEATHER_MODES = ['auto', 'clear', 'rain', 'snow', 'leaves'] as const;
export type WeatherMode = typeof WEATHER_MODES[number];
export function normalizeWeather(value: unknown): WeatherMode {
  return WEATHER_MODES.includes(value as WeatherMode) ? value as WeatherMode : 'auto';
}

export type WorldClock = { worldMs: number; realMs: number; speed: number; weather?: WeatherMode };
export type WorldPeriod = 'morning' | 'day' | 'evening' | 'night';
export const WORLD_CLOCK_SPEEDS = [1, 60, 300] as const;
export const WORLD_DAY_MS = 24 * 60 * 60 * 1000;

export function createWorldClock(now = Date.now()): WorldClock {
  return { worldMs: 9 * 60 * 60 * 1000, realMs: now, speed: 60 };
}

export function normalizeWorldClock(value: unknown, now = Date.now()): WorldClock {
  const clock = value as Partial<WorldClock> | null;
  if (!clock || !Number.isFinite(clock.worldMs) || clock.worldMs! < 0 ||
    !Number.isFinite(clock.realMs) || clock.realMs! <= 0 || !WORLD_CLOCK_SPEEDS.includes(clock.speed as 1 | 60 | 300)) return createWorldClock(now);
  return { worldMs: clock.worldMs!, realMs: clock.realMs!, speed: clock.speed!, weather: normalizeWeather(clock.weather) };
}

export function worldTime(clock: WorldClock, now = Date.now()): number {
  'worklet';
  return clock.worldMs + Math.max(0, now - clock.realMs) * clock.speed;
}

/** Re-anchor before changing speed so time never jumps backwards or skips ahead. */
export function changeWorldClock(clock: WorldClock, speed: number, minuteOfDay?: number, now = Date.now()): WorldClock {
  const current = worldTime(clock, now);
  const worldMs = minuteOfDay === undefined || !Number.isFinite(minuteOfDay) ? current
    : Math.floor(current / WORLD_DAY_MS) * WORLD_DAY_MS + Math.max(0, Math.min(1439, minuteOfDay)) * 60_000;
  return { worldMs, realMs: now, speed: WORLD_CLOCK_SPEEDS.includes(speed as 1 | 60 | 300) ? speed : clock.speed, weather: clock.weather };
}

export function worldClockReading(clock: WorldClock, now = Date.now()) {
  const ms = worldTime(clock, now), minute = Math.floor(ms / 60_000) % 1440;
  const hour = minute / 60;
  const period: WorldPeriod = hour < 6 || hour >= 21 ? 'night' : hour < 10 ? 'morning' : hour < 18 ? 'day' : 'evening';
  return { day: Math.floor(ms / WORLD_DAY_MS) + 1, minute, period,
    time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}` };
}

export function worldDaylight(clock: WorldClock, now = Date.now()): number {
  const hour = (worldTime(clock, now) % WORLD_DAY_MS) / 3_600_000;
  const sunrise = Math.max(0, Math.min(1, (hour - 5) / 3));
  const sunset = Math.max(0, Math.min(1, (21 - hour) / 3));
  const level = Math.min(sunrise, sunset);
  return level * level * (3 - 2 * level);
}

export function worldClockHandAngles(clock: WorldClock, now = Date.now()) {
  'worklet';
  const minutes = (worldTime(clock, now) % 43_200_000) / 60_000;
  return { hour: Math.atan2(.12, .23) - minutes / 720 * Math.PI * 2,
    minute: Math.atan2(-.32, .05) - (minutes % 60) / 60 * Math.PI * 2 };
}
