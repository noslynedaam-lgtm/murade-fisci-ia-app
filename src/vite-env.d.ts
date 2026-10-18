/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MURADE_FISCAL_URL?: string;
  readonly VITE_MURADE_CONTABIL_URL?: string;
  readonly VITE_MURADE_DP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
