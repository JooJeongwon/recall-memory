import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "recall-memory",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-10",
    assets: { notFoundHandling: "none" },
    observability: { enabled: true, redactQueryString: true, logs: { invocationLogs: false }, traces: { enabled: false } },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      APP_BASE_URL: bindings.secret(),
      NEXT_PUBLIC_SUPABASE_URL: bindings.secret(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.secret(),
      SUPABASE_SERVER_SECRET_KEY: bindings.secret(),
    },
  }),
});
