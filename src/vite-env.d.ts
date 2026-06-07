/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SHOW_EITAA_AUTO_CALL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
