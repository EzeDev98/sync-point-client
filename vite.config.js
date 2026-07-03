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

      if (assetUrls.length === 0) {
        console.warn(
          "[version-manifest] No JS/CSS assets found in dist/assets — precache list will be empty."
        );
      }

      // 3. Stamp BUILD_ID and inject the precache asset list into sw.js
      const swPath = "dist/sw.js";
      let swSource = readFileSync(swPath, "utf-8");
      swSource = swSource.replace("__SW_BUILD_ID__", BUILD_ID);

      // IMPORTANT: the placeholder "__PRECACHE_ASSETS__" appears TWICE in
      // sw.js — once inside the explanatory comment above HASHED_ASSETS,
      // and once in the actual `const HASHED_ASSETS = "__PRECACHE_ASSETS__";`
      // line. A plain .replace() only swaps the FIRST occurrence (the
      // comment), leaving the real code line untouched — which is exactly
      // why HASHED_ASSETS was staying a literal string at runtime and
      // nothing beyond the 7 hardcoded STATIC_ASSETS ever got precached.
      // replaceAll() fixes this by swapping every occurrence.
      const placeholderRegex = /"__PRECACHE_ASSETS__"/g;
      const matchCount = (swSource.match(placeholderRegex) || []).length;

      if (matchCount === 0) {
        throw new Error(
          "[version-manifest] __PRECACHE_ASSETS__ placeholder not found in dist/sw.js — nothing was injected. Check that public/sw.js still contains the placeholder and hasn't been overwritten before this plugin runs."
        );
      }

      swSource = swSource.replaceAll(
        '"__PRECACHE_ASSETS__"',
        JSON.stringify(assetUrls)
      );

      writeFileSync(swPath, swSource);

      console.log(
        `[version-manifest] Injected ${assetUrls.length} precache asset(s) into ${matchCount} placeholder occurrence(s) in dist/sw.js.`
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), versionManifestPlugin()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
});