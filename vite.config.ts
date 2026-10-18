
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  // GitHub Pages is static hosting.
  nitro: isGitHubPages ? false : undefined,

  vite: {
    // Must match the repository name in the GitHub Pages URL.
    base: isGitHubPages ? "/Auto_audit/" : "/",
  },

  tanstackStart: isGitHubPages
    ? {
        spa: {
          enabled: true,
          prerender: {
            outputPath: "/index.html",
            crawlLinks: false,
            retryCount: 2,
            failOnError: true,
          },
        },
      }
    : {
        server: { entry: "server" },
      },
});
