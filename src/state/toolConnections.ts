import { useSyncExternalStore } from 'react';

export type ToolName = 'github' | 'appStoreConnect' | 'googleCalendar' | 'openWeather' | 'linear';

export type ToolConnectionState = Record<ToolName, boolean>;

let state: ToolConnectionState = {
  github: false,
  appStoreConnect: false,
  googleCalendar: false,
  openWeather: false,
  linear: false,
};

const listeners = new Set<() => void>();

export function setToolConnected(name: ToolName, connected: boolean) {
  if (state[name] === connected) return;
  state = { ...state, [name]: connected };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot() {
  return state;
}

export function useToolConnections() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
