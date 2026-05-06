import { useSyncExternalStore } from 'react';

export type ToolName = 'openWeather' | 'appStoreConnect' | 'googlePlay';

export type ToolConnectionState = Record<ToolName, boolean>;

let state: ToolConnectionState = {
  openWeather: false,
  appStoreConnect: false,
  googlePlay: false,
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
