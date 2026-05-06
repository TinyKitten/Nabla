import type { WeatherData } from '../types';
import { setToolConnected } from '../state/toolConnections';

interface Coords {
  lat: number;
  lon: number;
  fallbackLabel?: string;
}

const FALLBACK: Coords = { lat: 35.6812, lon: 139.7671, fallbackLabel: '東京駅' };
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface OpenWeatherCurrent {
  main: { temp: number; feels_like: number };
  weather: { id: number; description: string }[];
  name?: string;
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

interface OpenWeatherForecastItem {
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

let cachedWeather: { data: WeatherData; at: number } | null = null;

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

function formatLocation(geo: OpenWeatherGeoResult | null, fallback: string): string {
  if (!geo) return fallback;
  const city = geo.local_names?.ja || geo.name;
  const state = geo.local_names?.ja ? undefined : geo.state;
  return state ? `${state}・${city}` : city;
}

function getCoords(): Promise<Coords> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(FALLBACK);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(FALLBACK),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OpenWeather request failed: ${res.status}`);
  return (await res.json()) as T;
}

export function getCachedWeather(maxAgeMs = CACHE_TTL_MS): WeatherData | null {
  if (!cachedWeather) return null;
  if (Date.now() - cachedWeather.at > maxAgeMs) return null;
  return cachedWeather.data;
}

export async function fetchWeather(): Promise<WeatherData> {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
  if (!apiKey) {
    setToolConnected('openWeather', false);
    throw new Error('VITE_OPENWEATHER_API_KEY is not set');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const coords = await getCoords();
    const base = 'https://api.openweathermap.org/data/2.5';
    const q = `lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}&units=metric&lang=ja`;
    const [current, forecast, geo] = await Promise.all([
      fetchJson<OpenWeatherCurrent>(`${base}/weather?${q}`, ctrl.signal),
      fetchJson<OpenWeatherForecast>(`${base}/forecast?${q}`, ctrl.signal),
      reverseGeocode(coords.lat, coords.lon, apiKey, ctrl.signal),
    ]);
    const next8 = forecast.list.slice(0, 8);
    const hourly = next8.map((it) => Math.round(it.main.temp));
    const precip = Math.round(Math.max(0, ...next8.map((it) => it.pop ?? 0)) * 100);
    const data: WeatherData = {
      location: formatLocation(geo, current.name || coords.fallbackLabel || '現在地'),
      temp: Math.round(current.main.temp),
      feels: Math.round(current.main.feels_like),
      cond: localizeCondition(current.weather[0]?.id, current.weather[0]?.description ?? '—'),
      hourly,
      precip,
    };
    cachedWeather = { data, at: Date.now() };
    setToolConnected('openWeather', true);
    return data;
  } catch (err) {
    setToolConnected('openWeather', false);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
