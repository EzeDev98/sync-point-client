import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const BUILD_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function versionManifestPlugin() {
  return {
    name: "version-manifest",
    closeBundle() {
      // 1. Write version.json so the running app can fetch it and compare
      writeFileSync(
        "dist/version.json",
        JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() })
      );

      // 2. Discover the real, content-hashed JS/CSS filenames Vite just
      //    emitted for THIS build. These change every build, so they can
      //    never be hardcoded in sw.js — they must be read off disk here,
      //    right after Vite has written them, and injected into the SW's
      //    precache list. This guarantees the Service Worker caches the
      //    exact bundle this build shipped, at install time, instead of
      //    relying on a page load happening to pass through the SW first.
      const assetsDir = resolve("dist/assets");
      let assetUrls = [];
      try {
        assetUrls = readdirSync(assetsDir)
          .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
          .map((f) => `/assets/${f}`);
      } catch (err) {
        console.warn("[version-manifest] Could not read dist/assets:", err);
      }

      // 3. Stamp BUILD_ID and inject the precache asset list into sw.js
      const swPath = "dist/sw.js";
      let swSource = readFileSync(swPath, "utf-8");
      swSource = swSource.replace("__SW_BUILD_ID__", BUILD_ID);
      swSource = swSource.replace(
        '"__PRECACHE_ASSETS__"',
        JSON.stringify(assetUrls)
      );
      writeFileSync(swPath, swSource);
    },
  };
}

export default defineConfig({
  plugins: [react(), versionManifestPlugin()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
});