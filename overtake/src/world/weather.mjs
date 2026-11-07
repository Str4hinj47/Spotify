// Weather state machine with damped transitions, wetness and snow cover.
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D(() => 0.1337);

export const WEATHER_MODES = ['auto', 'clear', 'rain', 'snow'];

export function createWeatherState(mode = 'auto') {
  return {
    mode, target: 'clear', rain: 0, snow: 0, wet: 0, snowCover: 0,
    timer: 20, elapsed: 0, wind: 0,
  };
}

export function dampExp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export function autoWeatherTarget(elapsed, temperature) {
  const n = noise2D(elapsed * 0.015, temperature * 3.1);
  if (temperature < 0.28) return n > -0.25 ? 'snow' : 'clear';
  if (n > 0.2) return 'rain';
  return 'clear';
}

export function stepWeather(state, dt, temperature = 0.5) {
  state.elapsed += dt;
  state.wind = noise2D(state.elapsed * 0.05, 9.2);
  if (state.mode === 'auto') {
    state.timer -= dt;
    if (state.timer <= 0) {
      state.target = autoWeatherTarget(state.elapsed, temperature);
      state.timer = 45 + Math.abs(noise2D(state.elapsed * 0.02, 3.3)) * 60;
    }
  } else {
    state.target = state.mode;
  }
  const rainTarget = state.target === 'rain' ? 1 : 0;
  const snowTarget = state.target === 'snow' ? 1 : 0;
  state.rain = dampExp(state.rain, rainTarget, 0.18, dt);
  state.snow = dampExp(state.snow, snowTarget, 0.18, dt);
  state.wet = dampExp(state.wet, state.rain > 0.05 ? Math.max(state.rain, 0.35) : 0, state.rain > 0.05 ? 0.12 : 0.03, dt);
  state.snowCover = dampExp(state.snowCover, state.snow > 0.05 ? Math.max(state.snow, 0.3) : 0, state.snow > 0.05 ? 0.08 : 0.02, dt);
  if (state.rain < 0.001) state.rain = 0;
  if (state.snow < 0.001) state.snow = 0;
  return state;
}

export function weatherGrip(state) {
  return Math.max(0.55, 1 - state.wet * 0.18 - state.snowCover * 0.35);
}

export function weatherLabel(state) {
  if (state.snow > 0.4) return 'Snow';
  if (state.rain > 0.4) return 'Rain';
  if (state.snow > 0.05) return 'Flurries';
  if (state.rain > 0.05) return 'Drizzle';
  return 'Clear';
}
