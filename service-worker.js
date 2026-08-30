const CACHE_NAME = "dosis-vet-cache-v6";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data.js",
  "./storage.js",
  "./manifest.json",
  "./icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// "Red primero, caché como respaldo": siempre que haya conexión se usa la versión más
// reciente del servidor (y se guarda en caché para la próxima vez); solo si falla la
// petición (sin conexión) se sirve la última copia guardada. Con la estrategia anterior
// ("caché primero") cualquier actualización de la app se quedaba invisible para siempre
// en cuanto un navegador ya tenía el service worker instalado, salvo que se cambiara a mano
// el nombre de CACHE_NAME en cada despliegue — algo fácil de olvidar y que ya ha pasado.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(event.request))
  );
});
