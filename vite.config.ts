import { defineConfig } from "vite";

// Base path is configurable so GitHub Pages can serve the game from
// /<repo>/ while local/dev and custom-domain deployments keep "/".
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
});
