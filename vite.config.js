import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync, readFileSync, readdirSync, mkdirSync } from "fs";
import { resolve } from "path";

const BUILD_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function versionManifestPlugin() {
  return {
    name: "version-manifest",
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir || "dist";
      mkdirSync(outDir, { recursive: true });

      // 1. Write version.json so the running app can fetch it and compare
      writeFileSync(
        resolve(outDir, "version.json"),
        JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() })
      );

      // 2. Discover the real, content-hashed JS/CSS filenames Vite just emitted
      const assetsDir = resolve(outDir, "assets");
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
      const swPath = resolve(outDir, "sw.js");
      let swSource = readFileSync(swPath, "utf-8");
      swSource = swSource.replace("__SW_BUILD_ID__", BUILD_ID);

      const placeholderRegex = /"__PRECACHE_ASSETS__"/g;
      const matchCount = (swSource.match(placeholderRegex) || []).length;

      if (matchCount === 0) {
        throw new Error(
          "[version-manifest] __PRECACHE_ASSETS__ placeholder not found in dist/sw.js — nothing was injected."
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