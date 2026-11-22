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

function particleNoise(n: number) {
  'worklet';
  const value = Math.sin(n * 127.1 + 23.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Clip a moving streak against the actual glass so it enters and leaves tip first. */
function rainStreak(index: number, seconds: number, pane: WeatherPane, windowSeed: number) {
  'worklet';
  const width = pane.max[0] - pane.min[0], height = pane.max[1] - pane.min[1];
  const depth = index % 3, seed = index + windowSeed;
  const progress = particleNoise(seed + 13) + seconds * (.63 + .27 * depth + .21 * particleNoise(seed + 41));
  const pass = Math.floor(progress), phase = progress - pass;
  const length = height * (.058 + .035 * depth + .028 * particleNoise(seed + 31));
  const sx = Math.min(width, height) * (.0052 + .0026 * depth);
  const wind = .18 + .068 * Math.sin(seconds * .94 + .3 * Math.sin(seconds * .63)) + .023 * particleNoise(seed);
  const rotation = -Math.atan(wind), ax = -Math.sin(rotation), ay = Math.cos(rotation);
  // Each new drop starts in a fresh lane. Its height and lane have independent seeds.
  const x = pane.min[0] + width * particleNoise(seed * 3 + pass * 73 + 9) - (phase - .5) * height * wind;
  const y = pane.max[1] + length / 2 - phase * (height + length);
  let low = -length / 2, high = length / 2;
  for (let i = 0; i < pane.polygon.length; i++) {
    const a = pane.polygon[i], b = pane.polygon[(i + 1) % pane.polygon.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const clearance = dx * (y - a[1]) - dy * (x - a[0]) - Math.abs(dx * ax + dy * ay) * sx / 2;
    const slope = dx * ay - dy * ax;
    if (Math.abs(slope) < 1e-8) {
      if (clearance < 0) { high = low; break; }
    } else if (slope > 0) low = Math.max(low, -clearance / slope);
    else high = Math.min(high, -clearance / slope);
    if (high <= low) break;
  }
  const middle = (low + high) / 2;
  return { x: x + ax * middle, y: y + ay * middle, z: pane.z + .003 + depth * .0005,
    sx, sy: Math.max(0, high - low), rotation, visible: high - low > .0006 };
}

/** Let snow and leaves appear gradually along the rim, including on round windows. */
function driftingParticle(pane: WeatherPane, x: number, y: number, sx: number, sy: number, rotation: number, z: number) {
  'worklet';
  let clearance = Infinity;
  for (let i = 0; i < pane.polygon.length; i++) {
    const a = pane.polygon[i], b = pane.polygon[(i + 1) % pane.polygon.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    clearance = Math.min(clearance, (dx * (y - a[1]) - dy * (x - a[0])) / Math.hypot(dx, dy));
  }
  const edge = Math.max(0, Math.min(1, clearance / Math.max(.0001, .7 * Math.max(sx, sy))));
  return { x, y, z: pane.z + z, sx: sx * edge, sy: sy * edge, rotation, visible: edge > .035 };
}

/** A leaf briefly shows its narrow edge as it rolls through the broad swing. */
function tumblingLeaf(pane: WeatherPane, x: number, y: number, size: number, swing: number, roll: number) {
  'worklet';
  const face = .18 + .82 * Math.abs(Math.cos(roll));
  return driftingParticle(pane, x, y, size * .70 * face, size, .22 + .92 * Math.sin(swing) + .28 * Math.sin(roll), .005);
}

/** Real-time fall speed stays readable even when the world clock runs fast. */
export function weatherParticle(kind: Exclude<WeatherKind, 'clear'>, index: number, seconds: number, pane: WeatherPane, windowSeed = 0) {
  'worklet';
  if (kind === 'rain') return rainStreak(index, seconds, pane, windowSeed);
  const width = pane.max[0] - pane.min[0], height = pane.max[1] - pane.min[1];
  const unit = Math.min(width, height), seed = windowSeed + index * 11;
  const depth = index % 3;
  const snow = kind === 'snow';
  const speed = (snow ? .083 : .095) + (snow ? .046 : .031) * depth + .024 * particleNoise(seed + 2);
  const progress = particleNoise(seed + 7) + seconds * speed;
  const pass = Math.floor(progress), phase = progress - pass;
  const lane = .06 + .88 * particleNoise(seed + pass * 53 + 31);
  const gust = Math.sin(seconds * .72 + particleNoise(windowSeed) * 6);
  const swing = seconds * (.94 + .32 * depth) + 6.28 * particleNoise(seed + 3);
  const across = snow
    ? lane + .13 * (phase - .5) + .042 * gust + .032 * Math.sin(swing)
    : lane + .26 * (phase - .5) + .063 * gust + .135 * Math.sin(swing);
  const x = pane.min[0] + width * across;
  const y = pane.max[1] - height * (phase + (snow ? 0 : .046 * Math.sin(2 * swing) * Math.sin(Math.PI * phase)));
  if (snow) {
    const size = unit * (.018 + .012 * depth + .009 * particleNoise(seed + 4));
    return driftingParticle(pane, x, y, size, size, .32 * Math.sin(swing), .003 + .0006 * depth);
  }
  const size = unit * (.064 + .022 * depth + .018 * particleNoise(seed + 4));
  return tumblingLeaf(pane, x, y, size, swing, 1.58 * swing + index);
}

/** A single leaf crosses the glass, drops out of view and leaves a pause before the next pass. */
export function windowWatchLeaf(seconds: number, pane: WeatherPane) {
  'worklet';
  const pass = Math.floor(seconds / 6);
  const t = Math.min(1, (seconds % 6) / 3.8);
  const width = pane.max[0] - pane.min[0], height = pane.max[1] - pane.min[1];
  const across = pass % 2 ? 1 - t : t;
  const swing = t * 7 + pass;
  const x = pane.min[0] + width * across;
  const y = pane.max[1] - height * (.18 + .60 * t + .095 * Math.sin(swing) * Math.sin(Math.PI * t));
  const leaf = tumblingLeaf(pane, x, y, Math.min(width, height) * .145, swing, swing * 1.58);
  return { ...leaf, visible: t < 1 && leaf.visible };
}
