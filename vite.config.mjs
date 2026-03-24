import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { createPushRuntime } from "./script/pushRuntime.mjs";
import { createVerificationRuntime } from "./script/verificationRuntime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pushRuntime = createPushRuntime({ rootDir: __dirname });
const verificationRuntime = createVerificationRuntime({ rootDir: __dirname });

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
    tailwindcss(),
    {
      configureServer(server) {
        pushRuntime.start();
        verificationRuntime.start();
        server.middlewares.use(async (request, response, next) => {
          const handled = await pushRuntime.handleApiRequest(request, response);

          if (handled) {
            return;
          }

          const verificationHandled =
            await verificationRuntime.handleApiRequest(request, response);

          if (verificationHandled) {
            return;
          }

          next();
        });
      },
      name: "every1-browser-push"
    }
  ],
  preview: { allowedHosts: true }
});
