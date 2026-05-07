/// <reference types="vite/client" />

interface ImportMetaEnv {
  // No client-side env vars at the moment. All secrets live in the proxy.
  readonly _placeholder?: never;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
