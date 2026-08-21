// Almacenamiento local (IndexedDB): fármacos personalizados e imágenes.
// Todo queda guardado únicamente en este dispositivo/navegador (no hay servidor).

const DB_NAME = "vetDosisDB";
const DB_VERSION = 3;
let dbPromise = null;

function abrirDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("customDrugs")) {
        db.createObjectStore("customDrugs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("imagenes")) {
        const store = db.createObjectStore("imagenes", { keyPath: "id" });
        store.createIndex("farmacoId", "farmacoId", { unique: false });
      }
      if (!db.objectStoreNames.contains("customProtocols")) {
        db.createObjectStore("customProtocols", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("favoritosHospital")) {
        // Marcas de PRODUCTOS_HOSPITAL marcadas por el usuario como habituales en su
        // clínica, para que aparezcan primero al buscar un producto concreto. id = marca
        // normalizada (minúsculas, sin acentos), para poder comparar sin ambigüedad.
        db.createObjectStore("favoritosHospital", { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      // Si se abre una versión más nueva de la base de datos en otra pestaña (p. ej. tras
      // actualizar la app), esta conexión se cierra sola en vez de bloquear a la otra pestaña
      // indefinidamente (lo que antes podía dar la falsa impresión de haber perdido datos:
      // en realidad seguían guardados, simplemente esta pestaña se quedaba colgada sin cargarlos).
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onblocked = () => {
      console.warn("La base de datos local está bloqueada por otra pestaña de la app abierta con una versión anterior. Cierra las demás pestañas y recarga.");
    };
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

async function dbGetAll(storeName) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(storeName, value) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(storeName, id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetByIndex(storeName, indexName, value) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readonly").objectStore(storeName).index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
