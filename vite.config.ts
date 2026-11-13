import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

const isGitHubPages = process.env["GITHUB_ACTIONS"] === "true";

export default defineConfig({
  base: isGitHubPages ? "/Auto_audit/" : "/",
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(
      isGitHubPages
        ? {
            spa: {
              enabled: true,
              prerender: {
                outputPath: "/index.html",
                crawlLinks: false,
                retryCount: 2,
              },
            },
          }
        : {
            server: { entry: "server" },
          },
    ),
    viteReact(),
    ...(isGitHubPages ? [] : [nitro({ defaultPreset: "cloudflare-module" })]),
  ],
});
