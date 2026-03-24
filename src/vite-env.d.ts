/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_NEXT_PUBLIC_ZORA_API_KEY?: string;
  readonly VITE_ZORA_API_KEY?: string;
}

declare const umami: {
  track: (event: string, data?: Record<string, unknown>) => void;
};
