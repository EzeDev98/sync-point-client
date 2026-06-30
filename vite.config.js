import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync, readFileSync } from "fs";

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

      // 2. Stamp the same build id into the compiled service worker,
      //    replacing the literal placeholder string.
      const swPath = "dist/sw.js";
      const swSource = readFileSync(swPath, "utf-8");
      writeFileSync(swPath, swSource.replace("__SW_BUILD_ID__", BUILD_ID));
    },
  };
}

export default defineConfig({
  plugins: [react(), versionManifestPlugin()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
});