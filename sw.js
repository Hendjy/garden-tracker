self.addEventListener("install", (e) => {
  console.log("Service Worker installé.");
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  console.log("Service Worker activé.");
});

// Ici on ne met pas de cache complexe, juste un SW minimal