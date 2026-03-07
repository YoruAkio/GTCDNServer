import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const config = defineConfig({
  optimizeDeps: {
    exclude: ["better-auth", "@better-auth/kysely-adapter", "better-auth/crypto"],
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        client: {
          specifiers: ["cloudflare:workers"],
        },
      },
    }),
    viteReact(),
  ],
  environments: {
    client: {
      build: {
        rollupOptions: {
          // @note these are SSR-only node modules pulled in transitively by
          // @tanstack/router-core's ssr/transformStreamWithRouter — they must
          // be declared external for the browser bundle so rollup doesn't choke
          // trying to resolve named exports from __vite-browser-external.
          // cloudflare:workers is Worker-runtime-only and never runs in the browser.
          external: ["node:stream", "node:stream/web", "node:async_hooks", "cloudflare:workers"],
        },
      },
    },
    ssr: {
      optimizeDeps: {
        exclude: ["better-auth", "@better-auth/kysely-adapter", "better-auth/crypto"],
      },
    },
  },
});

export default config;
