import type { WeatherResponse } from './types.js';

const FETCH_TIMEOUT_MS = 8000;

interface OpenWeatherCurrent {
  main: { temp: number; feels_like: number; humidity: number };
  weather: { id: number; description: string }[];
  name?: string;
}

interface OpenWeatherForecastItem {
  dt: number;
  main: { temp: number };
  pop?: number;
}

interface OpenWeatherForecast {
  list: OpenWeatherForecastItem[];
}

interface OpenWeatherGeoResult {
  name: string;
  local_names?: Record<string, string>;
  state?: string;
  country?: string;
}

function localizeCondition(id: number | undefined, fallback: string): string {
  if (id == null) return fallback;
  if (id >= 200 && id < 300) return '雷雨';
  if (id >= 300 && id < 400) return '小雨';
  if (id === 511) return 'みぞれ';
  if (id >= 500 && id < 504) return '雨';
  if (id >= 504 && id < 600) return '強い雨';
  if (id >= 600 && id < 700) return '雪';
  if (id >= 700 && id < 800) return '霧';
  if (id === 800) return '晴れ';
  if (id === 801) return '晴れ';
  if (id === 802) return '晴れ時々曇り';
  if (id === 803) return '曇り時々晴れ';
  if (id === 804) return '曇り';
  return fallback;
}

function formatLocation(geo: OpenWeatherGeoResult | null, fallback: string): string {
  if (!geo) return fallback;
  const city = geo.local_names?.ja || geo.name;
  const state = geo.local_names?.ja ? undefined : geo.state;
  return state ? `${state}・${city}` : city;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OpenWeather request failed: ${res.status}`);
  return (await res.json()) as T;
}

async function reverseGeocode(
  lat: number,
  lon: number,
  apiKey: string,
  signal: AbortSignal,
): Promise<OpenWeatherGeoResult | null> {
  try {
    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=5&appid=${apiKey}`;
    const results = await fetchJson<OpenWeatherGeoResult[]>(url, signal);
    if (!results.length) return null;
    const withJa = results.find((r) => r.local_names?.ja);
    return withJa ?? results[0];
  } catch {
    return null;
  }
}

export function isOpenWeatherConfigured(): boolean {
  return Boolean(process.env.OPENWEATHER_API_KEY);
}

export async function fetchWeatherSnapshot(
  lat: number,
  lon: number,
  fallbackLabel?: string,
): Promise<WeatherResponse> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY is not set');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const base = 'https://api.openweathermap.org/data/2.5';
    const q = `lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja`;
    const [current, forecast, geo] = await Promise.all([
      fetchJson<OpenWeatherCurrent>(`${base}/weather?${q}`, ctrl.signal),
      fetchJson<OpenWeatherForecast>(`${base}/forecast?${q}`, ctrl.signal),
      reverseGeocode(lat, lon, apiKey, ctrl.signal),
    ]);
    const next8 = forecast.list.slice(0, 8);
    const hourly = next8.map((it) => ({ temp: Math.round(it.main.temp), at: it.dt }));
    const precip = Math.round(Math.max(0, ...next8.map((it) => it.pop ?? 0)) * 100);
    return {
      location: formatLocation(geo, current.name || fallbackLabel || '現在地'),
      temp: Math.round(current.main.temp),
      feels: Math.round(current.main.feels_like),
      humidity: current.main.humidity,
      cond: localizeCondition(current.weather[0]?.id, current.weather[0]?.description ?? '—'),
      hourly,
      precip,
      sources: { openWeather: true },
    };
  } finally {
    clearTimeout(timer);
  }
}
