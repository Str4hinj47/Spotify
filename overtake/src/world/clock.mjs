// Day/night clock. A full cycle takes 10 minutes at speed 1.
export const DAY_LENGTH_SECONDS = 600;

export function createClock(hour = 9.5, speed = 1, running = true) {
  return { hour: ((hour % 24) + 24) % 24, speed, running };
}

export function stepClock(clock, dt) {
  if (!clock.running) return clock;
  clock.hour = (clock.hour + dt * clock.speed * (24 / DAY_LENGTH_SECONDS)) % 24;
  return clock;
}

export function sunAngle(hour) {
  // 06:00 sunrise, 18:00 sunset.
  return ((hour - 6) / 12) * Math.PI;
}

export function dayFactor(hour) {
  const elev = Math.sin(sunAngle(hour));
  const t = Math.max(0, Math.min(1, (elev + 0.12) / 0.3));
  return t * t * (3 - 2 * t);
}

export function formatHour(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
