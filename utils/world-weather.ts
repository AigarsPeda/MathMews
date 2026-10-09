import { normalizeWeather, worldTime, type WeatherMode, type WorldClock } from '@/utils/world-clock';
import type { AppIconName } from '@/constants/app-icons';

export type WeatherKind = Exclude<WeatherMode, 'auto'>;
const CYCLE: WeatherKind[] = ['rain', 'snow', 'leaves', 'clear', 'clear', 'rain', 'snow', 'clear', 'leaves', 'clear', 'clear', 'rain'];
const WEATHER_INTERVAL = 3 * 3_600_000;

/** A shared outdoor forecast follows world time, including time spent away. */
export function worldWeather(clock: WorldClock, now = Date.now()): WeatherKind {
  const mode = normalizeWeather(clock.weather);
  return mode === 'auto' ? CYCLE[Math.floor(worldTime(clock, now) / WEATHER_INTERVAL) % CYCLE.length] : mode;
}

/** Fictional outdoor Celsius temperature follows this world's weather and sun. */
export function worldWeatherReport(clock: WorldClock, now = Date.now()) {
  const kind = worldWeather(clock, now), time = worldTime(clock, now);
  const hour = (time % 86_400_000) / 3_600_000;
  const night = hour < 6 || hour >= 21;
  const climate = { clear: [18, 6], rain: [12, 4], snow: [-4, 2], leaves: [10, 5] }[kind];
  const temperature = Math.round(climate[0] + climate[1] * Math.cos((hour - 15) / 24 * Math.PI * 2)
    + Math.sin(Math.floor(time / 86_400_000) * 1.7));
  const icon: AppIconName = kind === 'clear' ? night ? 'weather-moon' : 'weather-sun' : `weather-${kind}`;
  return { kind, temperature, night, icon };
}

export function weatherTransmission(kind: WeatherKind): number {
  return kind === 'rain' ? .55 : kind === 'snow' ? .78 : 1;
}

/** Occasional distant lightning uses real seconds, independent of clock speed. */
export function weatherLightning(kind: WeatherKind, seconds: number, reduceMotion = false): number {
  'worklet';
  if (kind !== 'rain' || reduceMotion) return 0;
  const cycle = Math.floor(seconds / 36);
  const time = seconds % 36 - (6 + (cycle * 17) % 19);
  const pulse = (t: number) => t < 0 || t >= .7 ? 0
    : t < .12 ? Math.sin(t / .12 * Math.PI / 2) : Math.pow(1 - (t - .12) / .58, 2);
  return Math.max(pulse(time), .4 * pulse(time - 1));
}

export type WeatherPane = { polygon: number[][]; min: number[]; max: number[]; z: number };
export const WEATHER_PARTICLES = { rain: 24, snow: 12, leaves: 8 } as const;

/** A convex glass outline, inset by the particle's radius, keeps weather outside. */
export function insideWeatherPane(pane: WeatherPane, x: number, y: number, margin: number): boolean {
  'worklet';
  const polygon = pane.polygon;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx * (y - a[1]) - dy * (x - a[0]) < margin * Math.sqrt(dx * dx + dy * dy)) return false;
  }
  return true;
}

/** Real-time fall speed stays readable even when the world clock runs fast. */
export function weatherParticle(kind: Exclude<WeatherKind, 'clear'>, index: number, seconds: number, pane: WeatherPane) {
  'worklet';
  const width = pane.max[0] - pane.min[0], height = pane.max[1] - pane.min[1];
  const seed = ((index + 1) * .61803398875) % 1;
  const speed = kind === 'rain' ? .85 : kind === 'snow' ? .13 : .09;
  const phase = (seed + seconds * speed * (1 + (index % 3) * .12)) % 1;
  const sway = kind === 'rain' ? -.055 * phase : Math.sin(seconds * (kind === 'snow' ? .8 : 1.2) + index * 2.4) * (kind === 'snow' ? .055 : .12);
  const x = pane.min[0] + width * (.08 + (((index + 1) * .38196601125) % 1) * .84 + sway);
  const y = pane.max[1] - height * phase;
  const sx = width * (kind === 'rain' ? .004 : kind === 'snow' ? .018 : .056);
  const sy = height * (kind === 'rain' ? .075 : kind === 'snow' ? .018 : .0392);
  const rotation = kind === 'rain' ? -.16 : kind === 'snow' ? 0 : Math.sin(seconds * 1.6 + index) * .9;
  return { x, y, z: pane.z + .004, sx, sy, rotation,
    visible: insideWeatherPane(pane, x, y, Math.max(sx, sy) * .55) };
}
