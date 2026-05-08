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

interface WeatherProxyResponse extends WeatherData {
  sources?: { openWeather: boolean };
}

let cachedWeather: { data: WeatherData; at: number } | null = null;
let inFlight: Promise<WeatherData> | null = null;

function getCoords(): Promise<Coords> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(FALLBACK);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(FALLBACK),
      { timeout: FETCH_TIMEOUT_MS, maximumAge: CACHE_TTL_MS },
    );
  });
}

export function getCachedWeather(maxAgeMs = CACHE_TTL_MS): WeatherData | null {
  if (!cachedWeather) return null;
  if (Date.now() - cachedWeather.at > maxAgeMs) return null;
  return cachedWeather.data;
}

export async function fetchWeather(opts?: { force?: boolean }): Promise<WeatherData> {
  if (!opts?.force) {
    const cached = getCachedWeather();
    if (cached) return cached;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const coords = await getCoords();
      const url = `/api/weather?lat=${coords.lat}&lon=${coords.lon}`;
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
      const json = (await res.json()) as WeatherProxyResponse;
      const connected = json.sources?.openWeather ?? true;
      setToolConnected('openWeather', connected);
      const data: WeatherData = {
        location: json.location,
        temp: json.temp,
        feels: json.feels,
        humidity: json.humidity,
        cond: json.cond,
        hourly: json.hourly,
        precip: json.precip,
      };
      cachedWeather = { data, at: Date.now() };
      return data;
    } catch (err) {
      setToolConnected('openWeather', false);
      throw err;
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();
  return inFlight;
}
