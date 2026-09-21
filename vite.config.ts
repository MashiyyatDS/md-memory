import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro(),
  ],
  resolve: {
    tsconfigPaths: true
  },
  server: {
    port: 9000
  },
  preview: {
    port: 9000
  }
});
