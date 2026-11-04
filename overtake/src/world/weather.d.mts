export type WeatherMode = 'auto' | 'clear' | 'rain' | 'snow';
export interface WeatherState {
  mode: WeatherMode;
  target: 'clear' | 'rain' | 'snow';
  rain: number;
  snow: number;
  wet: number;
  snowCover: number;
  timer: number;
  elapsed: number;
  wind: number;
}
export const WEATHER_MODES: WeatherMode[];
export function createWeatherState(mode?: WeatherMode): WeatherState;
export function dampExp(current: number, target: number, lambda: number, dt: number): number;
export function autoWeatherTarget(elapsed: number, temperature: number): 'clear' | 'rain' | 'snow';
export function stepWeather(state: WeatherState, dt: number, temperature?: number): WeatherState;
export function weatherGrip(state: WeatherState): number;
export function weatherLabel(state: WeatherState): string;
