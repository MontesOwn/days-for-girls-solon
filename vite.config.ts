import { defineConfig } from "vite";
import { resolve } from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        createNewEvent: resolve(__dirname, "create-new-event.html"),
        donate: resolve(__dirname, "donate.html"),
        eventSignUp: resolve(__dirname, "event-sign-up.html"),
        events: resolve(__dirname, "events.html"),
        inventory: resolve(__dirname, "inventory.html"),
        inventoryLog: resolve(__dirname, "inventoryLog.html"),
        mailingList: resolve(__dirname, "mailing-list.html"),
        manageEvent: resolve(__dirname, "manage-event.html"),
      },
    },
  },
  plugins: [
    VitePWA({
      //Web App Manifest configuration
      registerType: "autoUpdate",
      injectRegister: "auto",
      //Workbox configuration
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm,json}"],
        cleanupOutdatedCaches: true,
        ignoreURLParametersMatching: [/^id$/, /^utm_/, /^fbclid$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
});
