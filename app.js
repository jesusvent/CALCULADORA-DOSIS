// ============================================================
// Utilidades generales
// ============================================================
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function formatNum(n) {
  return Number(n.toFixed(3)).toString().replace(".", ",");
}

// Expresa una cantidad de comprimidos con su valor decimal exacto (ej. 0,34), sin forzar
// a fracciones habituales, ya que no toda dosis se ajusta a 1/4, 1/2 o 3/4 de comprimido.
function fraccionComprimido(cantidad) {
  return Number(cantidad.toFixed(2)).toString().replace(".", ",");
}

function unidadComprimidos(cantidad) {
  return Math.round(cantidad * 100) / 100 === 1 ? "comprimido" : "comprimidos";
}

function textoComprimidos(min, max) {
  const a = fraccionComprimido(min);
  if (min === max) return `${a} ${unidadComprimidos(min)}`;
  const b = fraccionComprimido(max);
  return `${a} – ${b} ${unidadComprimidos(max)}`;
}

// Acorta el nombre oficial de un medicamento de CIMAVET/CIMA (ej. "NICILAN 500 mg
// comprimidos para perros y gatos") a "marca + concentración" (ej. "Nicilan 500")
// para mostrarlo junto a la cantidad en el resumen del paciente.
function marcaCorta(nombreCompleto) {
  if (!nombreCompleto) return null;
  const m = /^(.*?)\s+(\d+(?:[.,]\d+)?)/.exec(nombreCompleto.trim());
  if (!m) return nombreCompleto;
  const marca = m[1].trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return `${marca} ${m[2]}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ============================================================
// Búsqueda local (principio activo / nombre comercial)
// Incluye tanto la base de datos interna (DRUGS) como los
// fármacos personalizados que el usuario añade en "Mi base de datos".
// ============================================================
let customDrugs = []; // cargado desde IndexedDB
let INDICE = [];

function construirIndice(farmacos) {
  const indice = [];
  for (const f of farmacos) {
    indice.push({ termino: f.principioActivo, tipo: "Principio activo", farmaco: f });
    for (const nc of f.nombresComerciales) {
      indice.push({ termino: nc, tipo: "Nombre comercial", farmaco: f });
    }
  }
  return indice;
}

function reconstruirIndice() {
  INDICE = construirIndice(DRUGS.concat(customDrugs));
}
reconstruirIndice();

function buscarLocal(query) {
  const q = normalizar(query.trim());
  if (!q) return [];
  const vistos = new Set();
  const resultados = [];
  for (const entrada of INDICE) {
    if (normalizar(entrada.termino).includes(q)) {
      const key = entrada.farmaco.id + "|" + entrada.termino;
      if (!vistos.has(key)) {
        vistos.add(key);
        resultados.push(entrada);
      }
    }
  }
  resultados.sort((a, b) => {
    const aStarts = normalizar(a.termino).startsWith(q) ? 0 : 1;
    const bStarts = normalizar(b.termino).startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.termino.localeCompare(b.termino, "es");
  });
  return resultados.slice(0, 15);
}

// ============================================================
// Estado de la app
// ============================================================
const paciente = { nombre: "", especie: "perro", peso: null };
let farmacoActivo = null;
let patologiaSeleccionada = null;
let listaPaciente = []; // entradas añadidas para el paciente actual
let comprimidoActivo = null; // { mg } cuando la presentación elegida es sólida (comprimidos), en vez de líquida (ml)
let marcaComercialActiva = null; // nombre del medicamento concreto elegido en CIMAVET (ej. "Nicilan 500"), o null si es una concentración genérica/manual
let indicacionAntibioticoActiva = null; // { indicacion, opcion } seleccionada en el desplegable de indicación
let usoEspecificoActivo = null; // { nombre, datos } seleccionado en el desplegable de uso/procedimiento

// ============================================================
// Referencias al DOM
// ============================================================
const pacienteNombreInput = document.getElementById("paciente-nombre");
const pacienteEspecieSelect = document.getElementById("paciente-especie");
const pacientePesoInput = document.getElementById("paciente-peso");
const pacienteSuperficieCorporalEl = document.getElementById("paciente-superficie-corporal");

const inputBusqueda = document.getElementById("busqueda");
const listaSugerencias = document.getElementById("sugerencias");
const seccionFarmaco = document.getElementById("seccion-farmaco");
const nombreFarmacoEl = document.getElementById("nombre-farmaco");
const categoriaFarmacoEl = document.getElementById("categoria-farmaco");
const composicionFarmacoEl = document.getElementById("composicion-farmaco");
const nombresComercialesEl = document.getElementById("nombres-comerciales");
const productosHospitalEl = document.getElementById("productos-hospital");
const avisoPersonalizadoEl = document.getElementById("aviso-personalizado");
const irEditarBtn = document.getElementById("ir-a-editar-mifarmaco");
const avisoEspecieEl = document.getElementById("aviso-especie");

const comercialSelect = document.getElementById("comercial-cimavet");
const comercialDetalleEl = document.getElementById("comercial-cimavet-detalle");
const avisoNoEnBdEl = document.getElementById("aviso-no-en-bd");
const listadoCompletoBoton = document.getElementById("listado-completo-boton");
const listadoCompletoEl = document.getElementById("listado-completo");
const listadoCompletoFiltroEl = document.getElementById("listado-completo-filtro");
const listadoCompletoListaEl = document.getElementById("listado-completo-lista");

const patologiaSelectorContenedor = document.getElementById("patologia-selector-contenedor");
const patologiaSelector = document.getElementById("patologia-selector");

const bloqueUsoEspecificoEl = document.getElementById("bloque-uso-especifico");
const usoEspecificoSelectorEl = document.getElementById("uso-especifico-selector");
const resultadoUsoEspecificoEl = document.getElementById("resultado-uso-especifico");

const bloqueIndicacionAntibioticoEl = document.getElementById("bloque-indicacion-antibiotico");
const indicacionAntibioticoSelectorEl = document.getElementById("indicacion-antibiotico-selector");
const resultadoIndicacionAntibioticoEl = document.getElementById("resultado-indicacion-antibiotico");
const notasIndicacionAntibioticoEl = document.getElementById("notas-indicacion-antibiotico");
const alternativasIndicacionAntibioticoEl = document.getElementById("alternativas-indicacion-antibiotico");

const resultadoReferenciaEl = document.getElementById("resultado-referencia");
const dosisPersonalizadaValorInput = document.getElementById("dosis-personalizada-valor");
const dosisPersonalizadaUnidadSelect = document.getElementById("dosis-personalizada-unidad");
const resultadoPersonalizadaEl = document.getElementById("resultado-personalizada");
const concentracionInput = document.getElementById("concentracion");
const concentracionCimavetSelect = document.getElementById("concentracion-cimavet");
const concentracionCimavetEstadoEl = document.getElementById("concentracion-cimavet-estado");

const cimavetFarmacoResultadoEl = document.getElementById("cimavet-farmaco-resultado");
const bibliografiaBotonesEl = document.getElementById("bibliografia-botones");

const imagenDescripcionInput = document.getElementById("imagen-descripcion");
const imagenInput = document.getElementById("imagen-input");
const imagenesGaleriaEl = document.getElementById("imagenes-galeria");

const resumenListaEl = document.getElementById("resumen-lista");
const resumenContadorEl = document.getElementById("resumen-contador");
const vaciarResumenBtn = document.getElementById("vaciar-resumen");
const interaccionesEl = document.getElementById("interacciones-lista");

const protocolosListaEl = document.getElementById("protocolos-lista");
const protocolosBuscadorEl = document.getElementById("protocolos-buscador");
protocolosBuscadorEl.addEventListener("input", renderProtocolos);

const cimavetBusquedaInput = document.getElementById("cimavet-busqueda");
const cimavetBuscarBoton = document.getElementById("cimavet-buscar-boton");
const cimavetResultadoGeneralEl = document.getElementById("cimavet-resultado-general");

// ============================================================
// Navegación entre vistas principales
// ============================================================
document.querySelectorAll(".tab-principal").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-principal").forEach((b) => b.classList.remove("activa"));
    btn.classList.add("activa");
    document.querySelectorAll(".vista").forEach((v) => v.classList.add("oculto"));
    document.getElementById("vista-" + btn.dataset.vista).classList.remove("oculto");
    if (btn.dataset.vista === "protocolos") renderProtocolos();
    if (btn.dataset.vista === "misfarmacos") renderMisFarmacos();
    if (btn.dataset.vista === "cri") actualizarCri();
  });
});

// Sub-pestañas dentro de la ficha de fármaco
document.querySelectorAll(".subtab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".subtab").forEach((b) => b.classList.remove("activa"));
    btn.classList.add("activa");
    document.querySelectorAll(".panel").forEach((p) => p.classList.add("oculto"));
    document.getElementById(btn.dataset.panel).classList.remove("oculto");
    if (btn.dataset.panel === "panel-cimavet-farmaco" && farmacoActivo) {
      cargarCimavetParaFarmaco(farmacoActivo);
    }
    if (btn.dataset.panel === "panel-imagenes" && farmacoActivo) {
      renderImagenes();
    }
  });
});

// ============================================================
// Paciente
// ============================================================
[pacienteNombreInput, pacienteEspecieSelect, pacientePesoInput].forEach((el) => {
  el.addEventListener("input", actualizarPaciente);
  el.addEventListener("change", actualizarPaciente);
});

// Superficie corporal (m²) por la fórmula de Meeh, la habitual en oncología veterinaria para
// dosificar quimioterapia (mg/m², no mg/kg, ya que la relación peso-superficie no es lineal):
// BSA (m²) = K × peso(g)^(2/3) / 10000, con K=10.1 en perro y K=10.0 en gato (Kirk's Current
// Veterinary Therapy). Expresado directamente con el peso en kg: BSA = (K/100) × peso(kg)^(2/3).
function calcularSuperficieCorporal(pesoKg, especie) {
  const k = especie === "gato" ? 10.0 : 10.1;
  return (k / 100) * Math.pow(pesoKg, 2 / 3);
}

function actualizarSuperficieCorporal() {
  if (!paciente.peso || paciente.peso <= 0) {
    pacienteSuperficieCorporalEl.textContent = "";
    return;
  }
  const m2 = calcularSuperficieCorporal(paciente.peso, paciente.especie);
  pacienteSuperficieCorporalEl.textContent = `Superficie corporal: ${formatNum(m2)} m² (fórmula de Meeh — para dosificar quimioterapia en mg/m², no incluida en esta calculadora por seguridad; consulta el protocolo específico).`;
}

function actualizarPaciente() {
  paciente.nombre = pacienteNombreInput.value.trim();
  paciente.especie = pacienteEspecieSelect.value;
  paciente.peso = parseFloat(pacientePesoInput.value) || null;
  if (farmacoActivo) actualizarFichaFarmaco();
  actualizarSuperficieCorporal();
  actualizarCri();
}

const nuevoPacienteBoton = document.getElementById("nuevo-paciente-boton");
nuevoPacienteBoton.addEventListener("click", nuevoPaciente);

const cerrarFarmacoBoton = document.getElementById("cerrar-farmaco-boton");
cerrarFarmacoBoton.addEventListener("click", () => {
  cerrarBusquedaFarmaco();
  inputBusqueda.focus();
});

function nuevoPaciente() {
  if (listaPaciente.length && !confirm("¿Empezar con un nuevo paciente? Se borrará el resumen y la búsqueda actuales.")) {
    return;
  }

  // Paciente
  paciente.nombre = "";
  paciente.especie = "perro";
  paciente.peso = null;
  pacienteNombreInput.value = "";
  pacienteEspecieSelect.value = "perro";
  pacientePesoInput.value = "";
  actualizarSuperficieCorporal();

  // Búsqueda de fármaco activa
  cerrarBusquedaFarmaco();

  // Resumen del paciente
  listaPaciente = [];
  renderResumenPaciente();

  // Protocolos (dependen del peso/especie del paciente)
  renderProtocolos();

  pacienteNombreInput.focus();
}

// Descarta el fármaco que se está viendo/buscando (sin tocar el resumen del paciente
// ni sus datos), para poder empezar una nueva búsqueda desde cero.
function cerrarBusquedaFarmaco() {
  farmacoActivo = null;
  patologiaSeleccionada = null;
  comprimidoActivo = null;
  marcaComercialActiva = null;
  inputBusqueda.value = "";
  listaSugerencias.innerHTML = "";
  listaSugerencias.classList.add("oculto");
  seccionFarmaco.classList.add("oculto");
  resetComercialSelect("Escribe el principio activo");
  actualizarConcentracionesDetectadas([]);
  concentracionInput.value = "";
  dosisPersonalizadaValorInput.value = "";
  avisoNoEnBdEl.classList.add("oculto");
}

// ============================================================
// Búsqueda de fármacos (base de datos interna + personalizada)
// y desplegable de nombres comerciales en vivo (CIMAVET)
// ============================================================
inputBusqueda.addEventListener("input", () => {
  const localResultados = buscarLocal(inputBusqueda.value);
  renderSugerencias(localResultados);
  const valor = inputBusqueda.value.trim();
  clearTimeout(inputBusqueda._debounce);
  if (valor.length < 3) {
    resetComercialSelect("Escribe el principio activo");
    actualizarConcentracionesDetectadas([]);
    avisoNoEnBdEl.classList.add("oculto");
    return;
  }
  actualizarAvisoNoEnBd(valor, localResultados);
  inputBusqueda._debounce = setTimeout(() => cargarComercialesParaTexto(valor), 400);
});

// Si el texto buscado no coincide con ningún fármaco (ni de la base de datos interna ni de
// "Mi base de datos"), ofrece un atajo para darlo de alta ahí mismo con dosis por indicación.
function actualizarAvisoNoEnBd(valor, localResultados) {
  if (localResultados.length) {
    avisoNoEnBdEl.classList.add("oculto");
    return;
  }
  avisoNoEnBdEl.classList.remove("oculto");
  avisoNoEnBdEl.innerHTML = `"${escapeHtml(valor)}" no está en tu base de datos de dosis. <button type="button" class="boton-enlace" id="anadir-no-en-bd-boton">+ Añadirlo a Mi base de datos</button>`;
  document.getElementById("anadir-no-en-bd-boton").addEventListener("click", () => {
    document.querySelector('.tab-principal[data-vista="misfarmacos"]').click();
    abrirFormulario();
    cfPrincipioActivo.value = valor.charAt(0).toUpperCase() + valor.slice(1);
  });
}

// ============================================================
// Listado completo de fármacos de la base de datos (base interna + personalizados),
// para poder ver de un vistazo todo lo disponible sin tener que adivinar qué buscar.
// ============================================================
listadoCompletoBoton.addEventListener("click", () => {
  const abrir = listadoCompletoEl.classList.contains("oculto");
  listadoCompletoEl.classList.toggle("oculto");
  listadoCompletoBoton.textContent = abrir ? "📋 Ocultar listado de fármacos" : "📋 Ver todos los fármacos de la base de datos";
  if (abrir) {
    listadoCompletoFiltroEl.value = "";
    renderListadoCompleto();
    listadoCompletoFiltroEl.focus();
  }
});
listadoCompletoFiltroEl.addEventListener("input", renderListadoCompleto);

function renderListadoCompleto() {
  const todos = [...DRUGS, ...customDrugs].slice().sort((a, b) => a.principioActivo.localeCompare(b.principioActivo, "es"));
  const filtro = normalizar(listadoCompletoFiltroEl.value.trim());
  const filtrados = !filtro ? todos : todos.filter((f) =>
    normalizar(f.principioActivo).includes(filtro) ||
    (f.nombresComerciales || []).some((nc) => normalizar(nc).includes(filtro))
  );

  if (!filtrados.length) {
    listadoCompletoListaEl.innerHTML = `<p class="placeholder">Ningún fármaco coincide con el filtro.</p>`;
    return;
  }

  listadoCompletoListaEl.innerHTML = `<p class="ayuda">${filtrados.length} de ${todos.length} fármaco(s)</p>` +
    filtrados.map((f) => `
      <div class="listado-completo-fila" data-id="${f.id}">
        <span class="listado-completo-nombre">${escapeHtml(f.principioActivo)}${f.esPersonalizado ? ` <span class="tipo-tag tipo-tag-personalizado">Personalizado</span>` : ""}</span>
        <span class="listado-completo-comerciales">${escapeHtml((f.nombresComerciales || []).join(", ") || "—")}</span>
        <span class="listado-completo-categoria">${escapeHtml(f.categoria || "")}</span>
      </div>
    `).join("");

  listadoCompletoListaEl.querySelectorAll(".listado-completo-fila").forEach((fila) => {
    fila.addEventListener("click", () => {
      const f = todos.find((x) => x.id === fila.dataset.id);
      if (f) seleccionarFarmaco(f);
      listadoCompletoEl.classList.add("oculto");
      listadoCompletoBoton.textContent = "📋 Ver todos los fármacos de la base de datos";
    });
  });
}
inputBusqueda.addEventListener("focus", () => {
  if (inputBusqueda.value.trim()) renderSugerencias(buscarLocal(inputBusqueda.value));
});

document.addEventListener("click", (e) => {
  if (!listaSugerencias.contains(e.target) && e.target !== inputBusqueda) {
    listaSugerencias.classList.add("oculto");
  }
});

function renderSugerencias(resultados) {
  listaSugerencias.innerHTML = "";
  if (resultados.length === 0) {
    listaSugerencias.classList.add("oculto");
    return;
  }
  for (const r of resultados) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="termino">${escapeHtml(r.termino)}</span> <span class="tipo-tag">${escapeHtml(r.tipo)}</span>` +
      (r.tipo === "Nombre comercial" ? `<span class="submeta">${escapeHtml(r.farmaco.principioActivo)}</span>` : "") +
      (r.farmaco.esPersonalizado ? `<span class="tipo-tag tipo-tag-personalizado">Personalizado</span>` : "");
    li.addEventListener("click", () => seleccionarFarmaco(r.farmaco));
    listaSugerencias.appendChild(li);
  }
  listaSugerencias.classList.remove("oculto");
}

function seleccionarFarmaco(farmaco) {
  farmacoActivo = farmaco;
  patologiaSeleccionada = null;
  comprimidoActivo = null;
  marcaComercialActiva = null;
  inputBusqueda.value = farmaco.principioActivo;
  listaSugerencias.classList.add("oculto");
  avisoNoEnBdEl.classList.add("oculto");

  // Reset a la sub-pestaña "Dosis"
  document.querySelectorAll(".subtab").forEach((b) => b.classList.remove("activa"));
  document.querySelector('.subtab[data-panel="panel-dosis"]').classList.add("activa");
  document.querySelectorAll(".panel").forEach((p) => p.classList.add("oculto"));
  document.getElementById("panel-dosis").classList.remove("oculto");

  // Una nueva búsqueda no debe arrastrar la concentración/comprimido, la dosis
  // personalizada ni los resultados del fármaco anterior: se limpia todo antes
  // de cargar los datos del nuevo fármaco (lo único que se conserva es lo que
  // ya se hubiera añadido al resumen del paciente).
  dosisPersonalizadaValorInput.value = "";
  concentracionInput.value = "";
  concentracionCimavetSelect.innerHTML = "";
  concentracionCimavetSelect.classList.add("oculto");
  concentracionCimavetEstadoEl.textContent = "";
  resultadoReferenciaEl.innerHTML = "";
  resultadoPersonalizadaEl.innerHTML = "";
  cimavetFarmacoResultadoEl.innerHTML = `<p class="placeholder">Cargando...</p>`;

  seccionFarmaco.classList.remove("oculto");
  actualizarFichaFarmaco();
  cargarComercialesParaTexto(principioActivoCorto(farmaco));
}

function actualizarFichaFarmaco() {
  const farmaco = farmacoActivo;
  nombreFarmacoEl.textContent = farmaco.principioActivo;
  categoriaFarmacoEl.textContent = farmaco.categoria;
  nombresComercialesEl.textContent = farmaco.nombresComerciales.length
    ? "Nombres comerciales conocidos: " + farmaco.nombresComerciales.join(", ")
    : "Sin nombres comerciales registrados";

  if (farmaco.composicion) {
    composicionFarmacoEl.textContent = "Composición: " + farmaco.composicion;
    composicionFarmacoEl.classList.remove("oculto");
  } else {
    composicionFarmacoEl.classList.add("oculto");
  }

  if (farmaco.esPersonalizado) {
    avisoPersonalizadoEl.classList.remove("oculto");
    irEditarBtn.onclick = () => {
      document.querySelector('.tab-principal[data-vista="misfarmacos"]').click();
      abrirFormulario(farmaco);
    };
  } else {
    avisoPersonalizadoEl.classList.add("oculto");
  }

  renderBibliografia(farmaco);
  renderProductosHospital(farmaco);
  actualizarSelectorPatologia();
  renderUsosEspecificos(farmaco);
  renderIndicacionesAntibiotico(farmaco);
  calcularReferencia();
  calcularPersonalizada();
}

// ============================================================
// Productos del hospital: marca, laboratorio y grado de recomendación de compra
// ============================================================
const ORDEN_HOSPITAL_PRIORIDAD = {
  "Recomendado - Primera Opción": 0,
  "Recomendado": 1,
  "Según Necesidad": 2,
  "Fuera de Acuerdo": 3
};

function productosHospitalParaFarmaco(principioActivoFarmaco) {
  const nombreNorm = normalizar(principioActivoFarmaco);
  return PRODUCTOS_HOSPITAL
    .filter((p) => {
      const alias = ALIAS_COMPOSICION_HOSPITAL[p.composicion.trim().toLowerCase()];
      return alias && normalizar(alias) === nombreNorm;
    })
    .sort((a, b) => ORDEN_HOSPITAL_PRIORIDAD[a.orden] - ORDEN_HOSPITAL_PRIORIDAD[b.orden]);
}

// ---- Favoritos: marcas de PRODUCTOS_HOSPITAL que el usuario tiene habitualmente en stock ----
// Se guardan en IndexedDB (independiente del "orden" de recomendación de compra, que no cambia).
// Sirven solo para decidir qué aparece primero al buscar un producto concreto en un desplegable;
// no afectan a la alerta de "recomendado por el hospital / fuera de acuerdo", que sigue igual.
let favoritosHospital = new Set();

async function cargarFavoritosHospital() {
  const filas = await dbGetAll("favoritosHospital");
  favoritosHospital = new Set(filas.map((f) => f.id));
}

function esFavoritoHospital(marca) {
  return favoritosHospital.has(normalizar(marca));
}

// Actualiza el estado en memoria (y por tanto la pantalla) al instante; el guardado en
// IndexedDB se hace en segundo plano sin bloquear la interacción, para que un fallo o
// lentitud del navegador guardando nunca dé la sensación de que el clic "no ha hecho nada".
function toggleFavoritoHospital(marca) {
  const key = normalizar(marca);
  if (favoritosHospital.has(key)) {
    favoritosHospital.delete(key);
    dbDelete("favoritosHospital", key).catch(() => {});
  } else {
    favoritosHospital.add(key);
    dbPut("favoritosHospital", { id: key, marca }).catch(() => {});
  }
}

// ---- Favoritos de CRI: productos concretos de CIMAVET/CIMA marcados desde la pestaña CRI,
// para pedir siempre el mismo a la farmacia. Mismo patrón que favoritosHospital de arriba. ----
let favoritosCri = new Set();

async function cargarFavoritosCri() {
  const filas = await dbGetAll("favoritosCri");
  favoritosCri = new Set(filas.map((f) => f.id));
}

function esFavoritoCri(nombre) {
  return favoritosCri.has(normalizar(nombre));
}

function toggleFavoritoCri(nombre) {
  const key = normalizar(nombre);
  if (favoritosCri.has(key)) {
    favoritosCri.delete(key);
    dbDelete("favoritosCri", key).catch(() => {});
  } else {
    favoritosCri.add(key);
    dbPut("favoritosCri", { id: key, nombre }).catch(() => {});
  }
}

// Reordena una lista de medicamentos (de CIMAVET/CIMA, cada uno con un campo .nombre) poniendo
// primero los que coincidan con una marca marcada como favorita para ese principio activo. Si
// no hay ningún favorito marcado, la lista se devuelve tal cual (comportamiento de siempre).
function marcarYOrdenarFavoritos(lista, principioActivoNombre) {
  const favoritos = principioActivoNombre
    ? productosHospitalParaFarmaco(principioActivoNombre).filter((p) => esFavoritoHospital(p.marca))
    : [];
  if (!favoritos.length) return { lista, esFavorito: () => false };
  const marcasFavoritas = favoritos.map((p) => normalizar(p.marca));
  const esFavorito = (nombre) => {
    const n = normalizar(nombre);
    return marcasFavoritas.some((marca) => n === marca || n.startsWith(marca + " "));
  };
  const favs = lista.filter((it) => esFavorito(it.nombre));
  const resto = lista.filter((it) => !esFavorito(it.nombre));
  return { lista: [...favs, ...resto], esFavorito };
}

function renderProductosHospital(farmaco) {
  const productos = productosHospitalParaFarmaco(farmaco.principioActivo);
  if (!productos.length) {
    productosHospitalEl.classList.add("oculto");
    productosHospitalEl.innerHTML = "";
    return;
  }
  productosHospitalEl.classList.remove("oculto");
  productosHospitalEl.innerHTML = `<p class="ayuda">🏥 Productos disponibles en tu hospital (toca ⭐ los que tengas habitualmente en stock para que salgan primero al buscar):</p>` +
    productos.map((p) => {
      const etiqueta = ETIQUETA_ORDEN_HOSPITAL[p.orden] || { texto: p.orden, clase: "" };
      const esFav = esFavoritoHospital(p.marca);
      // Toda la etiqueta es un único <button>, no solo el símbolo de la estrella, para que el
      // área donde tocar/hacer clic sea grande y cómoda (la estrella sola es un blanco muy pequeño).
      return `<button type="button" class="badge-hospital badge-hospital-${etiqueta.clase} boton-favorito-hospital${esFav ? " es-favorito" : ""}" data-marca="${escapeHtml(p.marca)}" title="${escapeHtml(p.laboratorio)} — ${esFav ? "Quitar de favoritos" : "Marcar como favorito"}">${esFav ? "⭐" : "☆"} ${escapeHtml(p.marca)} · ${etiqueta.texto}</button>`;
    }).join(" ");
  productosHospitalEl.querySelectorAll(".boton-favorito-hospital").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleFavoritoHospital(btn.dataset.marca);
      renderProductosHospital(farmaco);
    });
  });
}

// ============================================================
// Cálculo de dosis de referencia (base de datos interna o personalizada)
// ============================================================
concentracionInput.addEventListener("input", () => {
  comprimidoActivo = null; // el usuario está indicando una concentración líquida manualmente
  marcaComercialActiva = null;
  calcularReferencia();
  calcularPersonalizada();
  calcularDosisUsoEspecifico();
  calcularDosisIndicacion();
});

function actualizarSelectorPatologia() {
  if (!farmacoActivo || !farmacoActivo.esPersonalizado) {
    patologiaSelectorContenedor.classList.add("oculto");
    patologiaSeleccionada = null;
    return;
  }
  const entradas = farmacoActivo.especies[paciente.especie] || [];
  if (entradas.length <= 1) {
    patologiaSelectorContenedor.classList.add("oculto");
    patologiaSeleccionada = entradas.length ? entradas[0].patologia : null;
    return;
  }
  patologiaSelectorContenedor.classList.remove("oculto");
  patologiaSelector.innerHTML = entradas.map((e) => `<option value="${escapeHtml(e.patologia)}">${escapeHtml(e.patologia)}</option>`).join("");
  if (!entradas.some((e) => e.patologia === patologiaSeleccionada)) {
    patologiaSeleccionada = entradas[0].patologia;
  }
  patologiaSelector.value = patologiaSeleccionada;
}
patologiaSelector.addEventListener("change", () => {
  patologiaSeleccionada = patologiaSelector.value;
  calcularReferencia();
});

// ============================================================
// Dosis por indicación para antibióticos (guías de uso cargadas)
// + recomendación de uso responsable según categoría EMA/AMEG
// ============================================================
function categoriaEMADe(principioActivo) {
  const norm = normalizar(principioActivo);
  for (const key in CATEGORIA_EMA_ANTIBIOTICOS) {
    if (normalizar(key) === norm) return CATEGORIA_EMA_ANTIBIOTICOS[key];
  }
  return null;
}

function indicacionesParaFarmaco(principioActivoNombre, especie) {
  const nombreNorm = normalizar(principioActivoNombre);
  const resultado = [];
  for (const indicacion of INDICACIONES_ANTIBIOTICOS) {
    if (!indicacion.especies.includes(especie)) continue;
    const opcion = indicacion.opciones.find((o) => normalizar(o.principioActivo) === nombreNorm);
    if (opcion) resultado.push({ indicacion, opcion });
  }
  return resultado;
}

function renderIndicacionesAntibiotico(farmaco) {
  const esAntibiotico = !!(farmaco.categoria && normalizar(farmaco.categoria).includes("antibiotico"));
  if (!esAntibiotico) {
    bloqueIndicacionAntibioticoEl.classList.add("oculto");
    indicacionAntibioticoActiva = null;
    return;
  }

  const coincidencias = indicacionesParaFarmaco(farmaco.principioActivo, paciente.especie);
  bloqueIndicacionAntibioticoEl.classList.remove("oculto");

  if (!coincidencias.length) {
    indicacionAntibioticoSelectorEl.innerHTML = `<option value="">Sin indicaciones registradas en las guías cargadas para este fármaco/especie</option>`;
    indicacionAntibioticoSelectorEl.disabled = true;
    indicacionAntibioticoSelectorEl._coincidencias = null;
    indicacionAntibioticoActiva = null;
    resultadoIndicacionAntibioticoEl.innerHTML = "";
    notasIndicacionAntibioticoEl.innerHTML = "";
    alternativasIndicacionAntibioticoEl.innerHTML = "";
    return;
  }

  indicacionAntibioticoSelectorEl.disabled = false;
  indicacionAntibioticoSelectorEl.innerHTML = coincidencias.map((c, i) => `<option value="${i}">${escapeHtml(c.indicacion.nombre)}</option>`).join("");
  indicacionAntibioticoSelectorEl._coincidencias = coincidencias;
  indicacionAntibioticoSelectorEl.value = "0";
  indicacionAntibioticoActiva = coincidencias[0];
  renderNotasIndicacionAntibiotico();
  renderAlternativasIndicacionAntibiotico();
}

// ============================================================
// Dosis según uso/procedimiento específico (independiente de los protocolos combinados)
// ============================================================
// Usos con dosis fija guardados como protocolo personalizado: cualquier fármaco con dosis
// propia dentro de un protocolo que el usuario haya creado (ej. "Ecocardiografía gato") se
// ofrece aquí automáticamente, con el nombre del protocolo como indicación — sin necesidad de
// mantenerlo por duplicado en USOS_ESPECIFICOS_FARMACO. Es la fuente que manda: si el usuario
// edita la dosis del protocolo, el desplegable de la calculadora se actualiza con ella.
function usosDeProtocolosPersonalizados(principioActivoNombre, especie) {
  const nombreNorm = normalizar(principioActivoNombre);
  const resultado = [];
  for (const protocolo of customProtocols) {
    if (!protocolo.especies.includes(especie)) continue;
    for (const componenteRaw of protocolo.componentes) {
      if (typeof componenteRaw === "string") continue; // id de DRUGS: usa la dosis estándar del fármaco, no una propia
      const principioReal = componenteRaw.principioActivoReal || componenteRaw.nombre;
      if (!principioReal || normalizar(principioReal) !== nombreNorm) continue;
      resultado.push({
        nombre: protocolo.nombre,
        deProtocolo: true,
        especies: {
          [especie]: {
            dosisMin: componenteRaw.dosisMin, dosisMax: componenteRaw.dosisMax, unidad: componenteRaw.unidad,
            via: componenteRaw.via, frecuencia: componenteRaw.frecuencia, notas: componenteRaw.notas
          }
        }
      });
    }
  }
  return resultado;
}

function usosEspecificosParaFarmaco(principioActivoNombre, especie) {
  const nombreNorm = normalizar(principioActivoNombre);
  const entrada = USOS_ESPECIFICOS_FARMACO.find((e) => normalizar(e.principioActivo) === nombreNorm);
  const usosCurados = entrada ? entrada.usos.filter((u) => u.especies[especie]) : [];
  return [...usosDeProtocolosPersonalizados(principioActivoNombre, especie), ...usosCurados];
}

function renderUsosEspecificos(farmaco) {
  const usos = usosEspecificosParaFarmaco(farmaco.principioActivo, paciente.especie);
  if (!usos.length) {
    bloqueUsoEspecificoEl.classList.add("oculto");
    usoEspecificoActivo = null;
    usoEspecificoSelectorEl._usos = null;
    return;
  }
  bloqueUsoEspecificoEl.classList.remove("oculto");
  usoEspecificoSelectorEl.disabled = false;
  usoEspecificoSelectorEl.innerHTML = usos.map((u, i) => `<option value="${i}">${escapeHtml(u.nombre)}${u.deProtocolo ? " · tu protocolo" : ""}</option>`).join("");
  usoEspecificoSelectorEl._usos = usos;
  usoEspecificoSelectorEl.value = "0";
  usoEspecificoActivo = usos[0];
  calcularDosisUsoEspecifico();
}

usoEspecificoSelectorEl.addEventListener("change", () => {
  const usos = usoEspecificoSelectorEl._usos;
  if (!usos) return;
  usoEspecificoActivo = usos[Number(usoEspecificoSelectorEl.value)];
  calcularDosisUsoEspecifico();
});

function calcularDosisUsoEspecifico() {
  resultadoUsoEspecificoEl.innerHTML = "";
  if (!usoEspecificoActivo) return;
  const datos = usoEspecificoActivo.especies[paciente.especie];
  if (!datos) {
    resultadoUsoEspecificoEl.innerHTML = `<p class="aviso-inline">⚠ Este uso no tiene pauta registrada para "${paciente.especie === "perro" ? "perro" : "gato"}".</p>`;
    return;
  }

  if (!paciente.peso || paciente.peso <= 0) {
    resultadoUsoEspecificoEl.innerHTML = `<p class="placeholder">Introduce el peso del paciente para calcular la dosis.</p>`;
    return;
  }

  const dosisMinTotal = datos.dosisMin * paciente.peso;
  const dosisMaxTotal = datos.dosisMax * paciente.peso;
  const rangoTexto = datos.dosisMin === datos.dosisMax
    ? formatNum(dosisMinTotal) + " " + unidadTotal(datos.unidad)
    : `${formatNum(dosisMinTotal)} – ${formatNum(dosisMaxTotal)} ${unidadTotal(datos.unidad)}`;

  let html = `
    <div class="resultado-card">
      <div class="resultado-dosis">${rangoTexto}</div>
      <div class="resultado-detalle">
        <span>${datos.dosisMin === datos.dosisMax ? datos.dosisMin : datos.dosisMin + "–" + datos.dosisMax} ${datos.unidad}</span>
        <span>·</span><span>${escapeHtml(datos.via)}</span>
        <span>·</span><span>${escapeHtml(datos.frecuencia)}</span>
      </div>
      ${datos.notas ? `<p class="notas">${escapeHtml(datos.notas)}</p>` : ""}
  `;

  const dosisMinBase = datos.unidad === "mcg/kg" ? dosisMinTotal / 1000 : dosisMinTotal;
  const dosisMaxBase = datos.unidad === "mcg/kg" ? dosisMaxTotal / 1000 : dosisMaxTotal;
  const unidadConc = datos.unidad === "UI/kg" ? "UI/ml" : "mg/ml";
  const marcaTexto = marcaComercialActiva ? ` de ${marcaCorta(marcaComercialActiva)}` : "";

  let cantidadTexto = null, detalleAdministracion = null;

  if (comprimidoActivo && datos.unidad !== "UI/kg") {
    const compMin = dosisMinBase / comprimidoActivo.mg;
    const compMax = dosisMaxBase / comprimidoActivo.mg;
    cantidadTexto = textoComprimidos(compMin, compMax) + marcaTexto;
    html += `<div class="resultado-volumen">Comprimidos a administrar (de ${comprimidoActivo.mg} mg/comprimido): <strong>${cantidadTexto}</strong></div>`;
    html += `<button class="boton-anadir" id="boton-anadir-uso-especifico">+ Añadir al paciente (${cantidadTexto})</button>`;
    detalleAdministracion = `${rangoTexto} (${comprimidoActivo.mg} mg/comprimido) · ${datos.via} · ${datos.frecuencia} · Uso: ${usoEspecificoActivo.nombre}`;
  } else {
    const concentracion = parseFloat(concentracionInput.value);
    if (concentracion && concentracion > 0) {
      const volMin = dosisMinBase / concentracion;
      const volMax = dosisMaxBase / concentracion;
      cantidadTexto = (datos.dosisMin === datos.dosisMax
        ? formatNum(volMin) + " ml"
        : `${formatNum(volMin)} – ${formatNum(volMax)} ml`) + marcaTexto;
      html += `<div class="resultado-volumen">Volumen a administrar (a ${concentracion} ${unidadConc}): <strong>${cantidadTexto}</strong></div>`;
      html += `<button class="boton-anadir" id="boton-anadir-uso-especifico">+ Añadir al paciente (${cantidadTexto})</button>`;
      detalleAdministracion = `${rangoTexto} a ${concentracion} ${unidadConc} · ${datos.via} · ${datos.frecuencia} · Uso: ${usoEspecificoActivo.nombre}`;
    } else {
      html += `<p class="aviso-inline">⚠ Indica la concentración del preparado (${unidadConc}) o elige una presentación en comprimidos para poder añadir esta dosis al paciente.</p>`;
    }
  }
  html += `</div>`;
  resultadoUsoEspecificoEl.innerHTML = html;

  const botonAnadirUso = document.getElementById("boton-anadir-uso-especifico");
  if (botonAnadirUso) {
    botonAnadirUso.addEventListener("click", () => {
      añadirAlPaciente({
        principioActivo: farmacoActivo.principioActivo,
        principioActivoReal: farmacoActivo.principioActivo,
        categoria: farmacoActivo.categoria,
        dosisTexto: cantidadTexto,
        detalle: detalleAdministracion,
        origen: (usoEspecificoActivo.deProtocolo ? "Protocolo: " : "Uso: ") + usoEspecificoActivo.nombre
      });
    });
  }
}

indicacionAntibioticoSelectorEl.addEventListener("change", () => {
  const coincidencias = indicacionAntibioticoSelectorEl._coincidencias;
  if (!coincidencias) return;
  indicacionAntibioticoActiva = coincidencias[Number(indicacionAntibioticoSelectorEl.value)];
  renderNotasIndicacionAntibiotico();
  renderAlternativasIndicacionAntibiotico();
  calcularDosisIndicacion();
});

function renderNotasIndicacionAntibiotico() {
  if (!indicacionAntibioticoActiva) { notasIndicacionAntibioticoEl.innerHTML = ""; return; }
  const { indicacion } = indicacionAntibioticoActiva;
  notasIndicacionAntibioticoEl.innerHTML = `
    <p class="notas">${escapeHtml(indicacion.notas)}</p>
    <p class="fuente-cita">Fuente: ${escapeHtml(indicacion.fuente)}</p>
  `;
}

function renderAlternativasIndicacionAntibiotico() {
  if (!indicacionAntibioticoActiva) { alternativasIndicacionAntibioticoEl.innerHTML = ""; return; }
  const { opcion: opcionActual } = indicacionAntibioticoActiva;
  const ordenadas = [...indicacionAntibioticoActiva.indicacion.opciones].sort((a, b) => a.prioridad - b.prioridad);
  const mejorPrioridad = ordenadas[0].prioridad;
  const esOptima = opcionActual.prioridad === mejorPrioridad;

  let html = `<h4 class="subtitulo">Opciones para esta indicación (uso responsable)</h4>`;
  html += ordenadas.map((o) => {
    const cat = categoriaEMADe(o.principioActivo);
    const esActual = o === opcionActual;
    return `
      <div class="opcion-antibiotico ${esActual ? "opcion-antibiotico-actual" : ""}">
        <div class="opcion-antibiotico-nombre">
          ${o.prioridad === mejorPrioridad ? "✅" : "•"} ${escapeHtml(o.principioActivo)}
          ${cat ? `<span class="badge-ema badge-ema-${cat.toLowerCase()}" title="${escapeHtml(ETIQUETA_CATEGORIA_EMA[cat] || "")}">Cat. EMA ${cat}</span>` : ""}
          ${esActual ? `<span class="tipo-tag tipo-tag-personalizado">Fármaco actual</span>` : ""}
        </div>
        <div class="opcion-antibiotico-dosis">${o.dosisMin === o.dosisMax ? o.dosisMin : o.dosisMin + "–" + o.dosisMax} ${o.unidad} · ${escapeHtml(o.via)} · ${escapeHtml(o.frecuencia)}</div>
        ${o.notas ? `<div class="opcion-antibiotico-notas">${escapeHtml(o.notas)}</div>` : ""}
      </div>
    `;
  }).join("");

  if (!esOptima) {
    const mejores = [...new Set(ordenadas.filter((o) => o.prioridad === mejorPrioridad).map((o) => o.principioActivo))].join(" o ");
    html += `<p class="aviso-inline">💡 Para esta indicación, la guía prioriza primero: <strong>${escapeHtml(mejores)}</strong>. "${escapeHtml(opcionActual.principioActivo)}" es una opción de prioridad ${opcionActual.prioridad}ª — resérvala para cuando la de primera línea no sea adecuada, haya fracasado, o el cultivo/antibiograma lo justifique.</p>`;
  } else {
    html += `<p class="ayuda">✅ "${escapeHtml(opcionActual.principioActivo)}" es la opción de primera línea recomendada por la guía para esta indicación.</p>`;
  }

  alternativasIndicacionAntibioticoEl.innerHTML = html;
}

function calcularDosisIndicacion() {
  resultadoIndicacionAntibioticoEl.innerHTML = "";
  if (!indicacionAntibioticoActiva) return;
  const { indicacion, opcion } = indicacionAntibioticoActiva;

  if (!paciente.peso || paciente.peso <= 0) {
    resultadoIndicacionAntibioticoEl.innerHTML = `<p class="placeholder">Introduce el peso del paciente para calcular la dosis.</p>`;
    return;
  }

  let dosisMinTotal = opcion.dosisMin * paciente.peso;
  let dosisMaxTotal = opcion.dosisMax * paciente.peso;
  const rangoTexto = opcion.dosisMin === opcion.dosisMax
    ? formatNum(dosisMinTotal) + " " + unidadTotal(opcion.unidad)
    : `${formatNum(dosisMinTotal)} – ${formatNum(dosisMaxTotal)} ${unidadTotal(opcion.unidad)}`;

  let html = `
    <div class="resultado-card">
      <div class="resultado-dosis">${rangoTexto}</div>
      <div class="resultado-detalle">
        <span>${opcion.dosisMin === opcion.dosisMax ? opcion.dosisMin : opcion.dosisMin + "–" + opcion.dosisMax} ${opcion.unidad}</span>
        <span>·</span><span>${escapeHtml(opcion.via)}</span>
        <span>·</span><span>${escapeHtml(opcion.frecuencia)}</span>
      </div>
      ${opcion.notas ? `<p class="notas">${escapeHtml(opcion.notas)}</p>` : ""}
  `;

  const dosisMinBase = opcion.unidad === "mcg/kg" ? dosisMinTotal / 1000 : dosisMinTotal;
  const dosisMaxBase = opcion.unidad === "mcg/kg" ? dosisMaxTotal / 1000 : dosisMaxTotal;
  const unidadConc = opcion.unidad === "UI/kg" ? "UI/ml" : "mg/ml";
  let cantidadTexto = null, detalleAdministracion = null;
  const marcaTexto = marcaComercialActiva ? ` de ${marcaCorta(marcaComercialActiva)}` : "";

  if (comprimidoActivo) {
    cantidadTexto = textoComprimidos(dosisMinBase / comprimidoActivo.mg, dosisMaxBase / comprimidoActivo.mg) + marcaTexto;
    html += `<div class="resultado-volumen">Comprimidos a administrar (de ${comprimidoActivo.mg} mg/comprimido): <strong>${cantidadTexto}</strong></div>`;
    detalleAdministracion = `${rangoTexto} (${comprimidoActivo.mg} mg/comprimido) · ${opcion.via} · ${opcion.frecuencia} · Indicación: ${indicacion.nombre}`;
  } else {
    const concentracion = parseFloat(concentracionInput.value);
    if (concentracion && concentracion > 0) {
      const volMin = dosisMinBase / concentracion;
      const volMax = dosisMaxBase / concentracion;
      cantidadTexto = (opcion.dosisMin === opcion.dosisMax
        ? formatNum(volMin) + " ml"
        : `${formatNum(volMin)} – ${formatNum(volMax)} ml`) + marcaTexto;
      html += `<div class="resultado-volumen">Volumen a administrar (a ${concentracion} ${unidadConc}): <strong>${cantidadTexto}</strong></div>`;
      detalleAdministracion = `${rangoTexto} a ${concentracion} ${unidadConc} · ${opcion.via} · ${opcion.frecuencia} · Indicación: ${indicacion.nombre}`;
    }
  }

  if (cantidadTexto) {
    html += `<button class="boton-anadir" id="boton-anadir-indicacion">+ Añadir al paciente (${cantidadTexto})</button>`;
  } else {
    html += `<p class="aviso-inline">⚠ Indica la concentración del preparado (o elige una presentación en comprimidos) para poder añadir esta dosis al paciente.</p>`;
  }
  html += `</div>`;
  resultadoIndicacionAntibioticoEl.innerHTML = html;

  const botonAnadir = document.getElementById("boton-anadir-indicacion");
  if (botonAnadir) {
    botonAnadir.addEventListener("click", () => {
      añadirAlPaciente({
        principioActivo: farmacoActivo.principioActivo,
        principioActivoReal: farmacoActivo.principioActivo,
        categoria: farmacoActivo.categoria,
        dosisTexto: cantidadTexto,
        detalle: detalleAdministracion,
        origen: "Antibiótico · " + indicacion.nombre
      });
    });
  }
}

function datosEspecieActiva() {
  if (!farmacoActivo) return null;
  const entradas = farmacoActivo.especies[paciente.especie];
  if (!entradas) return null;
  if (farmacoActivo.esPersonalizado) {
    if (!entradas.length) return null;
    return entradas.find((e) => e.patologia === patologiaSeleccionada) || entradas[0];
  }
  return entradas;
}

function unidadTotal(unidad) {
  if (unidad === "mg/kg") return "mg totales";
  if (unidad === "mcg/kg") return "mcg totales";
  if (unidad === "UI/kg") return "UI totales";
  return unidad;
}

function calcularReferencia() {
  resultadoReferenciaEl.innerHTML = "";
  avisoEspecieEl.classList.add("oculto");

  const datos = datosEspecieActiva();
  if (!datos) {
    avisoEspecieEl.textContent = `Este fármaco no tiene pauta registrada para "${paciente.especie === "perro" ? "perro" : "gato"}" en la base de datos.`;
    avisoEspecieEl.classList.remove("oculto");
    return;
  }

  if (!paciente.peso || paciente.peso <= 0) {
    resultadoReferenciaEl.innerHTML = `<p class="placeholder">Introduce el peso del paciente para calcular la dosis.</p>`;
    return;
  }

  if (datos.tipoDosis === "banda") {
    calcularReferenciaBanda(datos);
    return;
  }

  let dosisMinTotal = datos.dosisMin * paciente.peso;
  let dosisMaxTotal = datos.dosisMax * paciente.peso;
  let limitado = false;
  if (datos.dosisMaxima) {
    if (dosisMinTotal > datos.dosisMaxima) { dosisMinTotal = datos.dosisMaxima; limitado = true; }
    if (dosisMaxTotal > datos.dosisMaxima) { dosisMaxTotal = datos.dosisMaxima; limitado = true; }
  }

  const rangoTexto = datos.dosisMin === datos.dosisMax
    ? formatNum(dosisMinTotal) + " " + unidadTotal(datos.unidad)
    : `${formatNum(dosisMinTotal)} – ${formatNum(dosisMaxTotal)} ${unidadTotal(datos.unidad)}`;

  let html = `
    <div class="resultado-card">
      <div class="resultado-dosis">${rangoTexto}</div>
      <div class="resultado-detalle">
        <span>${datos.dosisMin === datos.dosisMax ? datos.dosisMin : datos.dosisMin + "–" + datos.dosisMax} ${datos.unidad}</span>
        <span>·</span><span>${escapeHtml(datos.via)}</span>
        <span>·</span><span>${escapeHtml(datos.frecuencia)}</span>
      </div>
      ${limitado ? `<p class="aviso-inline">⚠ Dosis ajustada al máximo recomendado de ${datos.dosisMaxima} ${unidadTotal(datos.unidad)}.</p>` : ""}
      ${datos.notas ? `<p class="notas">${escapeHtml(datos.notas)}</p>` : ""}
  `;

  // La dosis mg/mcg/UI se convierte siempre a la unidad base (mg o UI) para poder calcular ml o comprimidos.
  const dosisMinBase = datos.unidad === "mcg/kg" ? dosisMinTotal / 1000 : dosisMinTotal;
  const dosisMaxBase = datos.unidad === "mcg/kg" ? dosisMaxTotal / 1000 : dosisMaxTotal;
  const unidadConc = datos.unidad === "UI/kg" ? "UI/ml" : "mg/ml";

  let cantidadTexto = null, detalleAdministracion = null;
  const marcaTexto = marcaComercialActiva ? ` de ${marcaCorta(marcaComercialActiva)}` : "";

  if (comprimidoActivo && datos.unidad !== "UI/kg") {
    const compMin = dosisMinBase / comprimidoActivo.mg;
    const compMax = dosisMaxBase / comprimidoActivo.mg;
    cantidadTexto = textoComprimidos(compMin, compMax) + marcaTexto;
    html += `<div class="resultado-volumen">Comprimidos a administrar (de ${comprimidoActivo.mg} mg/comprimido): <strong>${cantidadTexto}</strong></div>`;
    html += `<button class="boton-anadir" data-origen="referencia">+ Añadir al paciente (${cantidadTexto})</button>`;
    detalleAdministracion = `${rangoTexto} (${comprimidoActivo.mg} mg/comprimido) · ${datos.via} · ${datos.frecuencia}`;
  } else {
    const concentracion = parseFloat(concentracionInput.value);
    if (concentracion && concentracion > 0) {
      const volMin = dosisMinBase / concentracion;
      const volMax = dosisMaxBase / concentracion;
      cantidadTexto = (datos.dosisMin === datos.dosisMax
        ? formatNum(volMin) + " ml"
        : `${formatNum(volMin)} – ${formatNum(volMax)} ml`) + marcaTexto;
      html += `<div class="resultado-volumen">Volumen a administrar (a ${concentracion} ${unidadConc}): <strong>${cantidadTexto}</strong></div>`;
      html += `<button class="boton-anadir" data-origen="referencia">+ Añadir al paciente (${cantidadTexto})</button>`;
      detalleAdministracion = `${rangoTexto} a ${concentracion} ${unidadConc} · ${datos.via} · ${datos.frecuencia}`;
    } else {
      html += `<p class="aviso-inline">⚠ Indica la concentración del preparado (${unidadConc}) o elige una presentación en comprimidos para poder añadir esta dosis al paciente.</p>`;
    }
  }
  html += `</div>`;
  resultadoReferenciaEl.innerHTML = html;

  const botonAnadir = resultadoReferenciaEl.querySelector(".boton-anadir");
  if (botonAnadir) {
    botonAnadir.addEventListener("click", () => {
      añadirAlPaciente({
        principioActivo: farmacoActivo.principioActivo,
        principioActivoReal: farmacoActivo.principioActivo,
        categoria: farmacoActivo.categoria,
        dosisTexto: cantidadTexto,
        detalle: detalleAdministracion + (farmacoActivo.esPersonalizado && patologiaSeleccionada ? ` · ${patologiaSeleccionada}` : ""),
        origen: "Dosis de referencia"
      });
    });
  }
}

// Fármacos con dosis fija por banda de peso (no mg/kg lineal), ej. anticuerpos monoclonales
// como Librela, Cytopoint o Solensia: se busca el tramo de peso del paciente en la tabla oficial.
function calcularReferenciaBanda(datos) {
  if (datos.pesoMinimo && paciente.peso < datos.pesoMinimo) {
    resultadoReferenciaEl.innerHTML = `<p class="aviso-inline">⚠ ${escapeHtml(datos.avisoPesoMinimo || `No usar por debajo de ${datos.pesoMinimo} kg según ficha técnica.`)}</p>`;
    return;
  }

  const banda = datos.bandas.find((b) => paciente.peso >= b.pesoMin && paciente.peso <= b.pesoMax);
  if (!banda) {
    const maxCubierto = datos.bandas[datos.bandas.length - 1].pesoMax;
    resultadoReferenciaEl.innerHTML = `<p class="aviso-inline">⚠ La tabla oficial de dosis por peso de este fármaco no cubre ${formatNum(paciente.peso)} kg (rango cubierto: hasta ${maxCubierto} kg). Consulta la ficha técnica para pautas fuera de rango.</p>`;
    return;
  }

  let cantidadTexto, mgTexto;
  if (banda.formula) {
    const ml = banda.mlPorKg * paciente.peso;
    cantidadTexto = formatNum(ml) + " ml";
    mgTexto = formatNum(ml * banda.concentracion) + " mg";
  } else {
    cantidadTexto = banda.ml + (banda.ml === 1 ? " ml" : " ml");
    mgTexto = banda.mg != null ? banda.mg + " mg" : null;
  }

  let html = `
    <div class="resultado-card">
      <div class="resultado-dosis">${mgTexto ? mgTexto : cantidadTexto}</div>
      <div class="resultado-detalle">
        <span>Dosis fija por banda de peso</span>
        <span>·</span><span>${escapeHtml(datos.via)}</span>
        <span>·</span><span>${escapeHtml(datos.frecuencia)}</span>
      </div>
      <div class="resultado-volumen">Volumen a administrar: <strong>${cantidadTexto}</strong> — ${escapeHtml(banda.descripcion)}</div>
      ${datos.notas ? `<p class="notas">${escapeHtml(datos.notas)}</p>` : ""}
      <button class="boton-anadir" data-origen="referencia-banda">+ Añadir al paciente (${cantidadTexto})</button>
    </div>
  `;
  resultadoReferenciaEl.innerHTML = html;

  const detalleAdministracion = `${banda.descripcion} (banda de peso ${banda.pesoMin}-${banda.pesoMax} kg) · ${datos.via} · ${datos.frecuencia}`;
  const botonAnadir = resultadoReferenciaEl.querySelector(".boton-anadir");
  if (botonAnadir) {
    botonAnadir.addEventListener("click", () => {
      añadirAlPaciente({
        principioActivo: farmacoActivo.principioActivo,
        principioActivoReal: farmacoActivo.principioActivo,
        categoria: farmacoActivo.categoria,
        dosisTexto: cantidadTexto,
        detalle: detalleAdministracion,
        origen: "Dosis de referencia (banda de peso)"
      });
    });
  }
}

// ============================================================
// Cálculo de dosis personalizada (µg/kg – mg/kg – g/kg)
// ============================================================
[dosisPersonalizadaValorInput, dosisPersonalizadaUnidadSelect].forEach((el) => {
  el.addEventListener("input", calcularPersonalizada);
  el.addEventListener("change", calcularPersonalizada);
});

function calcularPersonalizada() {
  resultadoPersonalizadaEl.innerHTML = "";
  if (!farmacoActivo) return;

  const valor = parseFloat(dosisPersonalizadaValorInput.value);
  if (!valor || valor <= 0) {
    resultadoPersonalizadaEl.innerHTML = `<p class="placeholder">Indica una cantidad para calcular la dosis personalizada.</p>`;
    return;
  }
  if (!paciente.peso || paciente.peso <= 0) {
    resultadoPersonalizadaEl.innerHTML = `<p class="placeholder">Introduce el peso del paciente para calcular la dosis.</p>`;
    return;
  }

  const factorAMg = parseFloat(dosisPersonalizadaUnidadSelect.value);
  const etiquetaUnidad = dosisPersonalizadaUnidadSelect.options[dosisPersonalizadaUnidadSelect.selectedIndex].text;
  const dosisMgPorKg = valor * factorAMg;
  const totalMg = dosisMgPorKg * paciente.peso;

  let totalTexto;
  if (totalMg < 1) {
    totalTexto = formatNum(totalMg * 1000) + " µg totales";
  } else if (totalMg >= 1000) {
    totalTexto = formatNum(totalMg / 1000) + " g totales";
  } else {
    totalTexto = formatNum(totalMg) + " mg totales";
  }

  let html = `
    <div class="resultado-card">
      <div class="resultado-dosis">${totalTexto}</div>
      <div class="resultado-detalle"><span>${valor} ${etiquetaUnidad}</span></div>
  `;

  let cantidadTexto = null, detalleAdministracion = null;
  const marcaTexto = marcaComercialActiva ? ` de ${marcaCorta(marcaComercialActiva)}` : "";

  if (comprimidoActivo) {
    const comp = totalMg / comprimidoActivo.mg;
    cantidadTexto = `${fraccionComprimido(comp)} ${unidadComprimidos(comp)}${marcaTexto}`;
    html += `<div class="resultado-volumen">Comprimidos a administrar (de ${comprimidoActivo.mg} mg/comprimido): <strong>${cantidadTexto}</strong></div>`;
    html += `<button class="boton-anadir" data-origen="personalizada">+ Añadir al paciente (${cantidadTexto})</button>`;
    detalleAdministracion = `${totalTexto} (${comprimidoActivo.mg} mg/comprimido, dosis personalizada: ${valor} ${etiquetaUnidad})`;
  } else {
    const concentracion = parseFloat(concentracionInput.value);
    if (concentracion && concentracion > 0) {
      const vol = totalMg / concentracion;
      cantidadTexto = formatNum(vol) + " ml" + marcaTexto;
      html += `<div class="resultado-volumen">Volumen a administrar (a ${concentracion} mg/ml): <strong>${cantidadTexto}</strong></div>`;
      html += `<button class="boton-anadir" data-origen="personalizada">+ Añadir al paciente (${cantidadTexto})</button>`;
      detalleAdministracion = `${totalTexto} a ${concentracion} mg/ml (dosis personalizada: ${valor} ${etiquetaUnidad})`;
    } else {
      html += `<p class="aviso-inline">⚠ Indica la concentración del preparado (mg/ml) o elige una presentación en comprimidos para poder añadir esta dosis al paciente.</p>`;
    }
  }
  html += `</div>`;
  resultadoPersonalizadaEl.innerHTML = html;

  const botonAnadir = resultadoPersonalizadaEl.querySelector(".boton-anadir");
  if (botonAnadir) {
    botonAnadir.addEventListener("click", () => {
      añadirAlPaciente({
        principioActivo: farmacoActivo.principioActivo,
        principioActivoReal: farmacoActivo.principioActivo,
        categoria: farmacoActivo.categoria,
        dosisTexto: cantidadTexto,
        detalle: detalleAdministracion,
        origen: "Dosis personalizada"
      });
    });
  }
}

// ============================================================
// Bibliografía (PubMed) — solo enlaces, sin extracción automática
// ============================================================
// PubMed indexa literatura casi toda en inglés: buscar con el término de indicación en
// español (ej. "Vómito") no encuentra prácticamente nada aunque existan decenas de artículos
// en inglés sobre "vomiting". Este diccionario traduce cada indicación de DRUGS a 1-2
// sinónimos en inglés para construir una búsqueda (X OR Y) más amplia. Si una indicación no
// está aquí, se omite del término en vez de usarla en español (mejor buscar algo más general
// que quedarse sin resultados).
const INDICACION_PUBMED_EN = {
  "Alergia": ["allergy"],
  "Analgesia (CRI)": ["analgesia constant rate infusion"],
  "Analgesia (dosis subanestésicas)": ["subanesthetic analgesia"],
  "Analgesia leve": ["mild pain analgesia"],
  "Analgesia perioperatoria": ["perioperative analgesia"],
  "Analgesia postquirúrgica": ["postoperative analgesia"],
  "Anestesia (co-inducción)": ["co-induction anesthesia"],
  "Anestesia (inducción)": ["anesthesia induction"],
  "Anestesia local": ["local anesthesia"],
  "Ansiedad": ["anxiety"],
  "Ansiedad/estrés en consulta": ["situational anxiety", "fear"],
  "Arritmia supraventricular": ["supraventricular arrhythmia"],
  "Arritmia ventricular": ["ventricular arrhythmia"],
  "Bloqueo regional": ["regional anesthesia", "nerve block"],
  "Bradicardia": ["bradycardia"],
  "Cardiomiopatía": ["cardiomyopathy"],
  "Coadyuvante anticonvulsivo": ["adjunct anticonvulsant"],
  "Convulsiones": ["seizures", "epilepsy"],
  "Dermatitis atópica": ["atopic dermatitis"],
  "Dermatofitosis": ["dermatophytosis", "ringworm"],
  "Desparasitación externa e interna": ["endoparasite", "ectoparasite"],
  "Desparasitación interna (tenias)": ["tapeworm", "cestode"],
  "Desparasitación interna": ["deworming", "anthelmintic"],
  "Diabetes mellitus": ["diabetes mellitus"],
  "Diarrea": ["diarrhea"],
  "Dolor crónico": ["chronic pain"],
  "Dolor cólico/espasmódico": ["colic", "abdominal spasm"],
  "Dolor neuropático": ["neuropathic pain"],
  "Dolor por osteoartritis": ["osteoarthritis pain"],
  "Dolor postquirúrgico": ["postoperative pain"],
  "Dolor": ["pain"],
  "Edema": ["edema"],
  "Ehrlichiosis": ["ehrlichiosis"],
  "Emergencia/RCP": ["cardiopulmonary resuscitation"],
  "Emergencia/sobredosis": ["overdose", "toxicity"],
  "Enfermedad inmunomediada": ["immune-mediated disease"],
  "Enfermedad renal crónica": ["chronic kidney disease"],
  "Enfermedad respiratoria": ["respiratory disease"],
  "Epilepsia": ["epilepsy", "seizures"],
  "Esofagitis": ["esophagitis"],
  "Estreñimiento/megacolon (gato)": ["constipation", "megacolon"],
  "Fiebre": ["fever"],
  "Gastritis": ["gastritis"],
  "Gastroenteritis hemorrágica grave": ["hemorrhagic gastroenteritis"],
  "Giardiasis": ["giardiasis"],
  "Hiperadrenocorticismo (Cushing)": ["hyperadrenocorticism", "Cushing"],
  "Hipertensión arterial sistémica": ["systemic hypertension"],
  "Hipertiroidismo felino": ["feline hyperthyroidism"],
  "Hipomotilidad gastrointestinal": ["gastrointestinal hypomotility", "prokinetic"],
  "Hipotiroidismo": ["hypothyroidism"],
  "Inducción del vómito (perro)": ["emesis induction"],
  "Infección bacteriana anaerobia": ["anaerobic bacterial infection"],
  "Infección bacteriana": ["bacterial infection"],
  "Infección cutánea": ["skin infection", "pyoderma"],
  "Infección dental": ["dental infection"],
  "Infección fúngica": ["fungal infection"],
  "Infección respiratoria": ["respiratory infection"],
  "Infección urinaria": ["urinary tract infection"],
  "Infección ósea": ["osteomyelitis"],
  "Inflamación": ["inflammation"],
  "Insuficiencia cardíaca congestiva": ["congestive heart failure"],
  "Intoxicación por rodenticidas anticoagulantes": ["anticoagulant rodenticide toxicosis"],
  "Malassezia": ["malassezia dermatitis"],
  "Neumonía": ["pneumonia"],
  "Náuseas": ["nausea"],
  "Osteoartritis": ["osteoarthritis"],
  "Piotórax": ["pyothorax"],
  "Premedicación anticolinérgica": ["anticholinergic premedication"],
  "Premedicación": ["anesthetic premedication"],
  "Prevención cinetosis": ["motion sickness"],
  "Prevención de dirofilariosis": ["heartworm prevention"],
  "Prevención de tromboembolismo (cardiomiopatía felina)": ["thromboembolism prevention", "cardiomyopathy"],
  "Profilaxis quirúrgica": ["surgical prophylaxis"],
  "Proteinuria renal": ["renal proteinuria"],
  "Proteinuria": ["proteinuria"],
  "Prurito": ["pruritus", "itching"],
  "Reacción alérgica": ["allergic reaction"],
  "Reflujo": ["reflux"],
  "Reversión de benzodiazepinas (midazolam/diazepam)": ["flumazenil reversal"],
  "Reversión de opioides": ["naloxone reversal"],
  "Reversión de sedación con dexmedetomidina/medetomidina": ["atipamezole reversal"],
  "Sarna demodécica/sarcóptica": ["demodicosis", "sarcoptic mange"],
  "Sedación": ["sedation"],
  "Sepsis/bacteriemia": ["sepsis", "bacteremia"],
  "Shock": ["shock"],
  "Vómito": ["vomiting", "emesis"],
  "Íleo/reflujo": ["ileus", "reflux"],
  "Úlcera gástrica": ["gastric ulcer"]
};

// Construye un término de búsqueda amplio para PubMed: nombre genérico Y nombres comerciales
// (unidos con OR, ya que muchos artículos citan solo la marca) AND especie, y opcionalmente
// AND la indicación ya traducida al inglés. Se evita encadenar muchos conceptos obligatorios
// a la vez (cada AND adicional reduce drásticamente los resultados), por eso NO se exige
// además la palabra "dose"/"dosage": basta con el fármaco + la especie (+ la indicación).
function urlPubMed(farmaco, especie, indicacion) {
  const nombres = [farmaco.principioActivo, ...(farmaco.nombresComerciales || [])].filter(Boolean);
  const nombreTerm = nombres.length > 1 ? `(${nombres.join(" OR ")})` : nombres[0];
  const especieEn = especie === "gato" ? "(cat OR feline)" : "(dog OR canine)";
  const partes = [nombreTerm, especieEn];
  const sinonimos = indicacion ? INDICACION_PUBMED_EN[indicacion] : null;
  if (sinonimos && sinonimos.length) partes.push(`(${sinonimos.join(" OR ")})`);
  return "https://pubmed.ncbi.nlm.nih.gov/?term=" + encodeURIComponent(partes.join(" AND "));
}

function renderBibliografia(farmaco) {
  const especieLabel = paciente.especie === "gato" ? "gato" : "perro";
  const indicaciones = farmaco.indicaciones && farmaco.indicaciones.length ? farmaco.indicaciones : [];
  let html = "";
  for (const ind of indicaciones) {
    html += `<a class="boton-pubmed" target="_blank" rel="noopener" href="${urlPubMed(farmaco, paciente.especie, ind)}">
      🔎 ${escapeHtml(ind)} en ${especieLabel} — buscar en PubMed
    </a>`;
  }
  html += `<a class="boton-pubmed boton-pubmed-general" target="_blank" rel="noopener" href="${urlPubMed(farmaco, paciente.especie, null)}">
      🔎 Búsqueda general en ${especieLabel} — PubMed
    </a>`;
  bibliografiaBotonesEl.innerHTML = html;
}

// ============================================================
// CIMAVET — API pública de la AEMPS (en vivo, sin réplica local)
// ============================================================
const CIMAVET_BASE = "https://cimavet.aemps.es/cimavet/rest/medicamentos";

async function buscarCimavet(query, pagesize) {
  const url = `${CIMAVET_BASE}?multiple=${encodeURIComponent(query)}&cargaprincipiosactivos=true&cargaespecies=true&pagesize=${pagesize || 50}&pagina=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("No se pudo conectar con CIMAVET (HTTP " + r.status + ")");
  return r.json();
}

function estadoTexto(estado) {
  if (!estado) return "Desconocido";
  if (estado.rev) return "Anulado (" + new Date(estado.rev).toLocaleDateString("es-ES") + ")";
  if (estado.aut) return "Autorizado (" + new Date(estado.aut).toLocaleDateString("es-ES") + ")";
  return "Desconocido";
}

function filaCimavetHtml(med) {
  const especies = (med.especies || []).map((e) => e.nombre).join(", ");
  const principios = med.pactivos || (med.principiosActivos || []).map((p) => p.nombre).join(", ");
  const ft = (med.docs || []).find((d) => d.tipo === 1);
  const prospecto = (med.docs || []).find((d) => d.tipo === 2);
  return `
    <div class="cimavet-fila">
      <div class="cimavet-nombre">${escapeHtml(med.nombre)}</div>
      <div class="cimavet-meta">
        <span>${escapeHtml(med.labtitular || "")}</span>
        <span>·</span><span>${escapeHtml(principios)}</span>
        ${especies ? `<span>·</span><span>${escapeHtml(especies)}</span>` : ""}
      </div>
      <div class="cimavet-meta">
        <span>Nº registro: ${escapeHtml(med.nregistro || "-")}</span>
        <span>·</span><span>${escapeHtml(estadoTexto(med.estado))}</span>
        <span>·</span><span class="${med.comerc ? "badge-si" : "badge-no"}">${med.comerc ? "Comercializado" : "No comercializado"}</span>
      </div>
      <div class="cimavet-enlaces">
        ${ft ? `<a href="${ft.url}" target="_blank" rel="noopener">📄 Ficha técnica (posología del laboratorio)</a>` : ""}
        ${prospecto ? `<a href="${prospecto.url}" target="_blank" rel="noopener">📄 Prospecto</a>` : ""}
      </div>
    </div>`;
}

// ============================================================
// CIMA — medicamentos de USO HUMANO (AEMPS). Se consulta como
// respaldo cuando un principio activo no existe como veterinario
// en CIMAVET, para saber si existe una alternativa humana que el
// veterinario pueda valorar usar fuera de ficha técnica (off-label).
// ============================================================
const CIMA_BASE = "https://cima.aemps.es/cima/rest/medicamentos";

async function buscarCimaPor(param, query) {
  const url = `${CIMA_BASE}?${param}=${encodeURIComponent(query)}&pagina=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("No se pudo conectar con CIMA (HTTP " + r.status + ")");
  return r.json();
}

// Busca por principio activo (practiv1) y también por nombre de producto, y combina
// resultados: practiv1 encuentra marcas cuyo nombre comercial no incluye el principio
// activo (ej. "Lanacordin" para digoxina), que una búsqueda solo por nombre no encontraría.
async function buscarCima(query) {
  const [porPrincipioActivo, porNombre] = await Promise.all([
    buscarCimaPor("practiv1", query).catch(() => ({ resultados: [] })),
    buscarCimaPor("nombre", query).catch(() => ({ resultados: [] }))
  ]);
  const vistos = new Map();
  for (const med of [...(porPrincipioActivo.resultados || []), ...(porNombre.resultados || [])]) {
    if (!vistos.has(med.nregistro)) vistos.set(med.nregistro, med);
  }
  return { resultados: [...vistos.values()] };
}

function filaCimaHtml(med) {
  const ft = (med.docs || []).find((d) => d.tipo === 1);
  const prospecto = (med.docs || []).find((d) => d.tipo === 2);
  return `
    <div class="cimavet-fila">
      <div class="cimavet-nombre">${escapeHtml(med.nombre)} <span class="badge-humano">Uso humano</span></div>
      <div class="cimavet-meta">
        <span>${escapeHtml(med.labtitular || "")}</span>
        ${med.dosis ? `<span>·</span><span>${escapeHtml(med.dosis)}</span>` : ""}
        ${med.formaFarmaceutica ? `<span>·</span><span>${escapeHtml(med.formaFarmaceutica.nombre)}</span>` : ""}
      </div>
      <div class="cimavet-meta">
        <span>Nº registro: ${escapeHtml(med.nregistro || "-")}</span>
        <span>·</span><span>${escapeHtml(estadoTexto(med.estado))}</span>
        <span>·</span><span class="${med.comerc ? "badge-si" : "badge-no"}">${med.comerc ? "Comercializado" : "No comercializado"}</span>
      </div>
      <div class="cimavet-enlaces">
        ${ft ? `<a href="${ft.url}" target="_blank" rel="noopener">📄 Ficha técnica</a>` : ""}
        ${prospecto ? `<a href="${prospecto.url}" target="_blank" rel="noopener">📄 Prospecto</a>` : ""}
      </div>
    </div>`;
}

async function buscarEnCimaComoRespaldo(texto, contenedorEl) {
  contenedorEl.innerHTML = `<p class="placeholder">No autorizado como veterinario. Buscando en CIMA (medicina humana)...</p>`;
  try {
    const data = await buscarCima(texto);
    const resultados = (data.resultados || []).slice(0, 20);
    if (!resultados.length) {
      contenedorEl.innerHTML = `<p class="placeholder">"${escapeHtml(texto)}" no se ha encontrado ni como medicamento veterinario (CIMAVET) ni como medicamento de uso humano (CIMA).</p>`;
      return;
    }
    contenedorEl.innerHTML = `<p class="aviso-inline">⚠ "${escapeHtml(texto)}" no es un medicamento veterinario autorizado en España, pero sí existe como medicamento de uso humano en CIMA. Su uso en animales sería fuera de ficha técnica (off-label), bajo prescripción y responsabilidad del veterinario.</p>` +
      resultados.map(filaCimaHtml).join("");
  } catch (err) {
    contenedorEl.innerHTML += `<p class="aviso-inline">⚠ No se ha podido conectar con CIMA (${escapeHtml(err.message)}).</p>`;
  }
}

function principioActivoCorto(farmaco) {
  return farmaco.principioActivo.split("/")[0];
}

// Descarta de un listado de CIMAVET los medicamentos que no estén indicados ni para perros ni
// para gatos (premezclas para pollos, productos para caballos/rumiantes, etc.), ya que esta
// calculadora es solo para pequeños animales. OJO: se mantiene un producto si está indicado
// para CUALQUIERA de las dos especies (perro o gato), no solo la del paciente activo — por
// ejemplo Cerenia en comprimidos solo está autorizado para perros, pero un veterinario viendo
// una ficha de gato puede querer verlo igualmente (p. ej. para valorar un uso off-label). Solo
// se excluyen presentaciones que sean exclusivamente para otras especies (ganado, aves, etc.).
// Si NINGÚN resultado indica perro/gato de forma explícita (dato incompleto en CIMAVET), se
// devuelven todos sin filtrar en vez de vaciar la lista por completo.
function filtrarCimavetPorEspecie(resultados) {
  const filtrados = resultados.filter((m) =>
    (m.especies || []).some((e) => {
      const n = normalizar(e.nombre);
      return n.includes("perro") || n.includes("gato");
    })
  );
  return filtrados.length ? filtrados : resultados;
}

async function cargarCimavetParaFarmaco(farmaco) {
  cimavetFarmacoResultadoEl.innerHTML = `<p class="placeholder">Buscando en CIMAVET...</p>`;
  try {
    const data = await buscarCimavet(principioActivoCorto(farmaco), 100);
    let resultados = data.resultados || [];

    const especieNombre = paciente.especie === "gato" ? "gatos" : "perros";
    const filtrados = resultados.filter((m) =>
      (m.especies || []).some((e) => normalizar(e.nombre).includes(especieNombre))
    );
    const mostrar = filtrarCimavetPorEspecie(resultados);

    let html = "";
    if (!resultados.length) {
      await buscarEnCimaComoRespaldo(principioActivoCorto(farmaco), cimavetFarmacoResultadoEl);
      return;
    } else {
      if (filtrados.length && filtrados.length !== resultados.length) {
        html += `<p class="ayuda">Mostrando ${filtrados.length} de ${resultados.length} presentaciones autorizadas para "${escapeHtml(principioActivoCorto(farmaco))}", filtradas para ${especieNombre}.</p>`;
      } else if (!filtrados.length) {
        html += `<p class="ayuda">Ninguna presentación indica expresamente "${especieNombre}"; se muestran las ${resultados.length} presentaciones encontradas.</p>`;
      } else {
        html += `<p class="ayuda">${resultados.length} presentaciones autorizadas encontradas.</p>`;
      }
      html += mostrar.map(filaCimavetHtml).join("");
    }
    cimavetFarmacoResultadoEl.innerHTML = html;
  } catch (err) {
    cimavetFarmacoResultadoEl.innerHTML = `<p class="aviso-inline">⚠ No se ha podido conectar con CIMAVET ahora mismo (${escapeHtml(err.message)}). Comprueba tu conexión a internet e inténtalo de nuevo.</p>`;
  }
}

// ---- Desplegable de nombre comercial (campo separado, junto a "Principio activo") ----
function resetComercialSelect(mensaje) {
  comercialSelect.innerHTML = `<option value="">${escapeHtml(mensaje)}</option>`;
  comercialSelect.disabled = true;
  comercialSelect._resultados = null;
  comercialDetalleEl.innerHTML = "";
}

// CIMAVET responde a búsquedas parciales (ej. "feno" de camino a "fenobarbital") con
// coincidencias muy amplias y poco relacionadas (carprofeno, fenofloxacino...). Sin esta
// guarda, si esa respuesta parcial llega DESPUÉS que la de la búsqueda completa (habitual:
// una búsqueda más amplia tarda más en resolverse), se queda pintada en pantalla como si
// fuera el resultado de lo que el usuario terminó escribiendo. Solo se aplica la respuesta
// si el texto buscado sigue siendo el que hay en el campo en ese momento.
let comercialesRequestId = 0;
async function cargarComercialesParaTexto(texto) {
  const requestId = ++comercialesRequestId;
  comercialSelect.innerHTML = `<option value="">Buscando en CIMAVET...</option>`;
  comercialSelect.disabled = true;
  try {
    const data = await buscarCimavet(texto, 150);
    if (requestId !== comercialesRequestId) return; // ha llegado una búsqueda más reciente entretanto
    let resultados = data.resultados || [];
    if (!resultados.length) {
      resetComercialSelect("Sin resultados en CIMAVET (no autorizado como veterinario)");
      actualizarConcentracionesDetectadas([]);
      await buscarEnCimaComoRespaldo(texto, comercialDetalleEl);
      return;
    }
    resultados = filtrarCimavetPorEspecie(resultados);
    const principioActivoParaFavoritos = farmacoActivo ? farmacoActivo.principioActivo : texto;
    const { lista: resultadosOrdenados, esFavorito } = marcarYOrdenarFavoritos(resultados, principioActivoParaFavoritos);
    resultados = resultadosOrdenados;
    comercialSelect.innerHTML = `<option value="">— ${resultados.length} medicamento(s), elige uno —</option>` +
      resultados.map((m, i) => `<option value="${i}">${esFavorito(m.nombre) ? "⭐ " : ""}${escapeHtml(m.nombre)}${m.labtitular ? " — " + escapeHtml(m.labtitular) : ""}</option>`).join("");
    comercialSelect.disabled = false;
    comercialSelect._resultados = resultados;
    comercialDetalleEl.innerHTML = "";
    actualizarConcentracionesDetectadas(resultados);
  } catch (err) {
    if (requestId !== comercialesRequestId) return;
    resetComercialSelect("Error al conectar con CIMAVET");
    actualizarConcentracionesDetectadas([]);
  }
}

comercialSelect.addEventListener("change", () => {
  const idx = comercialSelect.value;
  const resultados = comercialSelect._resultados;
  if (idx === "" || !resultados) {
    comercialDetalleEl.innerHTML = "";
    marcaComercialActiva = null;
    calcularReferencia();
    calcularPersonalizada();
    return;
  }
  const med = resultados[idx];
  comercialDetalleEl.innerHTML = filaCimavetHtml(med);

  // Al elegir un medicamento concreto, su presentación manda sobre la detección genérica.
  const datos = datosEspecieActiva();
  const esUI = datos && datos.unidad === "UI/kg";
  const p = extraerPresentacionMed(med);
  const esValida = p && (esUI ? p.unidad === "UI/ml" : (p.unidad === "mg/ml" || p.unidad === "mg/comprimido"));
  if (esValida) {
    concentracionCimavetSelect.classList.add("oculto");
    marcaComercialActiva = med.nombre;
    aplicarPresentacion(p);
    concentracionCimavetEstadoEl.textContent = `Presentación de "${med.nombre}": ${etiquetaPresentacion(p)}` +
      (p.tipo === "solido" ? " — se calculará en fracción de comprimido." : " (CIMAVET).");
  } else {
    marcaComercialActiva = null;
    concentracionCimavetEstadoEl.textContent = `No se ha podido detectar automáticamente la concentración de "${med.nombre}"; indícala manualmente si la conoces.`;
  }
});

// ---- Detección automática de la presentación (mg/ml, UI/ml o mg/comprimido) a partir de CIMAVET ----
// Incluye microgramos/mcg/µg (ej. "FENTADON 50 microgramos/ml..."), muy habituales en CRI
// (fentanilo, dexmedetomidina...); se convierten a mg/ml para mantener un único sistema de
// unidades de concentración en toda la app (igual que ya se hace con las dosis en mcg/kg).
const PATRON_CONCENTRACION_LIQUIDA = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|[uµ]g|microgramos?|UI)\s*\/\s*ml/i;
const PATRON_MG_COMPRIMIDO = /(\d+(?:[.,]\d+)?)\s*mg\b/i;

// A partir del match de PATRON_CONCENTRACION_LIQUIDA, devuelve { valor, unidad } ya
// normalizado a mg/ml o UI/ml (convirtiendo microgramos/mcg/µg dividiendo entre 1000).
function normalizarConcentracionLiquida(match) {
  const valorBruto = parseFloat(match[1].replace(",", "."));
  const unidadRaw = match[2].toLowerCase();
  if (unidadRaw === "ui") return { valor: valorBruto, unidad: "UI/ml" };
  if (unidadRaw === "mg") return { valor: valorBruto, unidad: "mg/ml" };
  return { valor: valorBruto / 1000, unidad: "mg/ml" }; // mcg, µg, ug, microgramo(s)
}

// CIMAVET (veterinario) devuelve la forma farmacéutica en "formasFarmaceuticas" (array);
// CIMA (uso humano) la devuelve en "formaFarmaceutica" (objeto único, sin "s"). Si solo se
// mira el campo de CIMAVET, ningún medicamento de CIMA en comprimido/cápsula se detecta
// nunca como sólido (ej. "URSOBILANE 150 mg CAPSULAS", que solo existe en CIMA).
function esFormaSolida(med) {
  const formas = med.formasFarmaceuticas || (med.formaFarmaceutica ? [med.formaFarmaceutica] : []);
  return formas.some((f) => /comprimid|tableta|c[aá]psula/i.test(f.nombre || ""));
}

// Devuelve { tipo: "liquido"|"solido", valor, unidad } o null si no se puede determinar.
function extraerPresentacionMed(med) {
  const nombre = med.nombre || "";
  if (esFormaSolida(med)) {
    const m = PATRON_MG_COMPRIMIDO.exec(nombre);
    if (!m) return null;
    return { tipo: "solido", valor: parseFloat(m[1].replace(",", ".")), unidad: "mg/comprimido" };
  }
  const m = PATRON_CONCENTRACION_LIQUIDA.exec(nombre);
  if (!m) return null;
  return { tipo: "liquido", ...normalizarConcentracionLiquida(m) };
}

function etiquetaPresentacion(p) {
  return `${formatNum(p.valor)} ${p.unidad}`;
}

// Extrae la presentación líquida directamente de un texto (ej. el nombre de un
// componente de protocolo ya guardado), sin necesitar el objeto completo de
// CIMAVET/CIMA. Sirve de red de seguridad: si el nombre del medicamento ya
// indica la concentración (p. ej. "BUTOMIDOR 10 mg/ml..."), se lee de ahí
// aunque no se capturara al elegirlo en el desplegable.
function extraerPresentacionDeTexto(nombre) {
  const m = PATRON_CONCENTRACION_LIQUIDA.exec(nombre || "");
  if (!m) return null;
  return { tipo: "liquido", ...normalizarConcentracionLiquida(m) };
}

// Presentación de un componente de protocolo: usa la guardada si existe y, si no,
// intenta deducirla igualmente a partir de su nombre (ver extraerPresentacionDeTexto).
function obtenerPresentacionComponente(componenteRaw) {
  if (typeof componenteRaw !== "object" || !componenteRaw) return null;
  if (componenteRaw.presentacion) return componenteRaw.presentacion;
  return extraerPresentacionDeTexto(componenteRaw.nombre);
}

// Categoría terapéutica y principio activo real de un componente de protocolo
// (para el comprobador de interacciones): si es un id de DRUGS, se toma de ahí;
// si es un componente personalizado, de los datos capturados al elegirlo.
function obtenerCategoriaComponente(componenteRaw) {
  if (typeof componenteRaw === "string") {
    const farmaco = DRUGS.find((d) => d.id === componenteRaw);
    return farmaco ? farmaco.categoria : null;
  }
  return (componenteRaw && componenteRaw.categoria) || null;
}

function obtenerPrincipioActivoRealComponente(componenteRaw) {
  if (typeof componenteRaw === "string") {
    const farmaco = DRUGS.find((d) => d.id === componenteRaw);
    return farmaco ? farmaco.principioActivo : null;
  }
  if (!componenteRaw) return null;
  return componenteRaw.principioActivoReal || componenteRaw.nombre || null;
}

// Aplica una presentación detectada: si es sólida, activa el cálculo en comprimidos;
// si es líquida, rellena el campo de concentración (mg/ml o UI/ml) para el cálculo en ml.
function aplicarPresentacion(p) {
  if (p.tipo === "solido") {
    comprimidoActivo = { mg: p.valor };
    concentracionInput.value = "";
  } else {
    comprimidoActivo = null;
    concentracionInput.value = p.valor;
  }
  calcularReferencia();
  calcularPersonalizada();
  calcularDosisUsoEspecifico();
  calcularDosisIndicacion();
}

function extraerPresentaciones(resultados) {
  const vistos = new Map();
  for (const med of resultados || []) {
    const p = extraerPresentacionMed(med);
    if (!p) continue;
    const key = p.tipo + "|" + p.valor + "|" + p.unidad;
    if (!vistos.has(key)) vistos.set(key, p);
  }
  return [...vistos.values()].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "liquido" ? -1 : 1;
    return a.valor - b.valor;
  });
}

function actualizarConcentracionesDetectadas(resultados) {
  const datos = datosEspecieActiva();
  const esUI = datos && datos.unidad === "UI/kg";
  const presentaciones = extraerPresentaciones(resultados).filter((p) =>
    esUI ? p.unidad === "UI/ml" : (p.unidad === "mg/ml" || p.unidad === "mg/comprimido")
  );

  concentracionCimavetSelect.innerHTML = "";
  concentracionCimavetSelect.classList.add("oculto");
  concentracionCimavetSelect._presentaciones = null;

  if (!presentaciones.length) {
    concentracionCimavetEstadoEl.textContent = farmacoActivo
      ? "No se ha detectado una concentración líquida ni un comprimido claro en CIMAVET para este principio activo; indícalo manualmente si lo conoces."
      : "";
    return;
  }

  if (presentaciones.length === 1) {
    const p = presentaciones[0];
    concentracionCimavetEstadoEl.textContent = `Presentación detectada automáticamente en CIMAVET: ${etiquetaPresentacion(p)}` +
      (p.tipo === "solido" ? " (fracción de comprimido)." : ".");
    marcaComercialActiva = null; // concentración detectada entre varios productos, no un medicamento concreto
    aplicarPresentacion(p);
    return;
  }

  concentracionCimavetEstadoEl.textContent = "CIMAVET registra varias presentaciones para este principio activo (líquidas y/o en comprimidos, para distintas especies o tamaños): elige la de tu envase.";
  concentracionCimavetSelect.innerHTML = `<option value="">— Elige la presentación de tu envase —</option>` +
    presentaciones.map((p, i) => `<option value="${i}">${etiquetaPresentacion(p)}${p.tipo === "solido" ? " (comprimido)" : " (líquido)"}</option>`).join("");
  concentracionCimavetSelect.classList.remove("oculto");
  concentracionCimavetSelect._presentaciones = presentaciones;
}

concentracionCimavetSelect.addEventListener("change", () => {
  const idx = concentracionCimavetSelect.value;
  const presentaciones = concentracionCimavetSelect._presentaciones;
  if (idx === "" || !presentaciones) return;
  marcaComercialActiva = null; // concentración elegida de una lista genérica, no un medicamento concreto
  aplicarPresentacion(presentaciones[idx]);
});

// Buscador CIMAVET independiente (catálogo completo, no limitado a la BD interna)
cimavetBuscarBoton.addEventListener("click", ejecutarBusquedaCimavetGeneral);
cimavetBusquedaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") ejecutarBusquedaCimavetGeneral();
});

// A diferencia del buscador de producto dentro de un protocolo (donde CIMA es solo un
// respaldo si CIMAVET no tiene nada, para no distraer con marcas humanas irrelevantes), esta
// pestaña de búsqueda general consulta SIEMPRE las dos fuentes a la vez y muestra ambas por
// separado: aquí el objetivo es explorar qué existe, veterinario y humano, no solo calcular.
async function ejecutarBusquedaCimavetGeneral() {
  const query = cimavetBusquedaInput.value.trim();
  if (!query) return;
  cimavetResultadoGeneralEl.innerHTML = `<p class="placeholder">Buscando en CIMAVET y CIMA...</p>`;

  const [cimavetRes, cimaRes] = await Promise.all([
    buscarCimavet(query, 50).catch((err) => ({ error: err })),
    buscarCima(query).catch((err) => ({ error: err }))
  ]);
  const errorVet = cimavetRes && cimavetRes.error;
  const errorHum = cimaRes && cimaRes.error;
  const resultadosVet = errorVet ? [] : (cimavetRes.resultados || []);
  const resultadosHum = errorHum ? [] : (cimaRes.resultados || []);

  if (!resultadosVet.length && !resultadosHum.length) {
    if (errorVet && errorHum) {
      cimavetResultadoGeneralEl.innerHTML = `<p class="aviso-inline">⚠ No se ha podido conectar ni con CIMAVET ni con CIMA ahora mismo. Comprueba tu conexión a internet e inténtalo de nuevo.</p>`;
    } else {
      cimavetResultadoGeneralEl.innerHTML = `<p class="placeholder">"${escapeHtml(query)}" no se ha encontrado ni como medicamento veterinario (CIMAVET) ni como medicamento de uso humano (CIMA).</p>`;
    }
    return;
  }

  let html = "";
  html += `<h3 class="subtitulo-seccion">CIMAVET — medicamentos veterinarios</h3>`;
  if (errorVet) {
    html += `<p class="aviso-inline">⚠ No se ha podido conectar con CIMAVET ahora mismo.</p>`;
  } else if (resultadosVet.length) {
    html += `<p class="ayuda">${cimavetRes.totalFilas} resultado(s) encontrados en el catálogo oficial` +
      (cimavetRes.totalFilas > resultadosVet.length ? `, mostrando los primeros ${resultadosVet.length}. Refina la búsqueda para acotar más.` : ".") +
      `</p>`;
    html += resultadosVet.map(filaCimavetHtml).join("");
  } else {
    html += `<p class="placeholder">Sin resultados en CIMAVET para "${escapeHtml(query)}".</p>`;
  }

  html += `<h3 class="subtitulo-seccion">CIMA — medicamentos de uso humano</h3>`;
  if (errorHum) {
    html += `<p class="aviso-inline">⚠ No se ha podido conectar con CIMA ahora mismo.</p>`;
  } else if (resultadosHum.length) {
    html += `<p class="aviso-inline">⚠ Uso en animales fuera de ficha técnica (off-label), bajo prescripción y responsabilidad del veterinario.</p>`;
    html += `<p class="ayuda">${resultadosHum.length} resultado(s)` + (resultadosHum.length > 30 ? `, mostrando los primeros 30.` : ".") + `</p>`;
    html += resultadosHum.slice(0, 30).map(filaCimaHtml).join("");
  } else {
    html += `<p class="placeholder">Sin resultados en CIMA para "${escapeHtml(query)}".</p>`;
  }

  cimavetResultadoGeneralEl.innerHTML = html;
}

// ============================================================
// Imágenes por fármaco (fotos de libros/revistas con dosis por patología)
// Guardadas en IndexedDB, solo en este dispositivo/navegador.
// ============================================================
imagenInput.addEventListener("change", async () => {
  if (!farmacoActivo || !imagenInput.files.length) return;
  const descripcion = imagenDescripcionInput.value.trim();
  for (const file of Array.from(imagenInput.files)) {
    try {
      const dataUrl = await redimensionarImagen(file, 1600);
      await dbPut("imagenes", {
        id: generarId(),
        farmacoId: farmacoActivo.id,
        descripcion,
        dataUrl,
        fecha: Date.now()
      });
    } catch (err) {
      // Si una imagen falla al procesarse, se omite y se continúa con el resto.
    }
  }
  imagenInput.value = "";
  imagenDescripcionInput.value = "";
  renderImagenes();
});

function redimensionarImagen(file, maxAncho) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let width = img.width, height = img.height;
        if (width > maxAncho) {
          height = Math.round(height * (maxAncho / width));
          width = maxAncho;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function renderImagenes() {
  if (!farmacoActivo) { imagenesGaleriaEl.innerHTML = ""; return; }
  const imagenes = await dbGetByIndex("imagenes", "farmacoId", farmacoActivo.id);
  if (!imagenes.length) {
    imagenesGaleriaEl.innerHTML = `<p class="placeholder">Todavía no hay imágenes guardadas para este fármaco.</p>`;
    return;
  }
  imagenesGaleriaEl.innerHTML = imagenes.sort((a, b) => b.fecha - a.fecha).map((img) => `
    <div class="imagen-item">
      <img src="${img.dataUrl}" alt="${escapeHtml(img.descripcion || "Imagen")}" class="imagen-miniatura" />
      ${img.descripcion ? `<p class="imagen-descripcion">${escapeHtml(img.descripcion)}</p>` : ""}
      <button class="boton-eliminar-imagen" data-id="${img.id}" type="button">✕ Eliminar</button>
    </div>
  `).join("");

  imagenesGaleriaEl.querySelectorAll(".imagen-miniatura").forEach((el) => {
    el.addEventListener("click", () => el.classList.toggle("imagen-grande"));
  });
  imagenesGaleriaEl.querySelectorAll(".boton-eliminar-imagen").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await dbDelete("imagenes", btn.dataset.id);
      renderImagenes();
    });
  });
}

// ============================================================
// Resumen del paciente (varios fármacos / protocolos a la vez)
// ============================================================
function añadirAlPaciente(entry) {
  listaPaciente.push(Object.assign({ id: generarId() }, entry));
  renderResumenPaciente();
}

function eliminarDelPaciente(id) {
  listaPaciente = listaPaciente.filter((e) => e.id !== id);
  renderResumenPaciente();
}

vaciarResumenBtn.addEventListener("click", () => {
  listaPaciente = [];
  renderResumenPaciente();
});

function renderResumenPaciente() {
  resumenContadorEl.textContent = listaPaciente.length ? `(${listaPaciente.length})` : "";
  vaciarResumenBtn.classList.toggle("oculto", listaPaciente.length === 0);

  if (!listaPaciente.length) {
    resumenListaEl.innerHTML = `<p class="placeholder">Todavía no has añadido ningún fármaco para este paciente.</p>`;
    interaccionesEl.innerHTML = "";
    return;
  }

  const nombrePaciente = paciente.nombre ? escapeHtml(paciente.nombre) : "Paciente sin nombre";
  const cabecera = `<p class="resumen-paciente-info">${nombrePaciente} · ${paciente.especie === "gato" ? "Gato" : "Perro"}${paciente.peso ? " · " + paciente.peso + " kg" : ""}</p>`;

  const filas = listaPaciente.map((e) => `
    <div class="resumen-fila">
      <div>
        <div class="resumen-farmaco">${escapeHtml(e.principioActivo)}</div>
        <div class="resumen-dosis">${escapeHtml(e.dosisTexto)}</div>
        <div class="resumen-detalle">${escapeHtml(e.detalle || "")} <span class="tag-origen">${escapeHtml(e.origen)}</span></div>
      </div>
      <button class="boton-eliminar" data-id="${e.id}" title="Quitar">✕</button>
    </div>
  `).join("");

  resumenListaEl.innerHTML = cabecera + filas;
  resumenListaEl.querySelectorAll(".boton-eliminar").forEach((btn) => {
    btn.addEventListener("click", () => eliminarDelPaciente(btn.dataset.id));
  });

  renderInteracciones();
}

// ============================================================
// Comprobador de interacciones y aviso de mezcla en jeringa/sueroterapia
// ============================================================
// Ver el aviso legal en REGLAS_INTERACCION (data.js): selección curada, no
// exhaustiva, no sustituye la consulta de una fuente de referencia farmacológica.
function coincideGrupo(entry, grupo) {
  if (!grupo) return false;
  const nombreReal = normalizar(entry.principioActivoReal || entry.principioActivo || "");
  if (grupo.categorias && entry.categoria) {
    const categoriaEntry = normalizar(entry.categoria);
    if (grupo.categorias.some((c) => normalizar(c) === categoriaEntry)) return true;
  }
  if (grupo.principiosActivos && nombreReal) {
    if (grupo.principiosActivos.some((p) => nombreReal.includes(normalizar(p)))) return true;
  }
  return false;
}

function evaluarInteracciones(lista) {
  const avisos = [];
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      const nombreA = normalizar(a.principioActivoReal || a.principioActivo || "");
      const nombreB = normalizar(b.principioActivoReal || b.principioActivo || "");
      if (nombreA && nombreA === nombreB) continue; // mismo principio activo añadido dos veces: no es una interacción

      for (const regla of REGLAS_INTERACCION) {
        const directo = coincideGrupo(a, regla.grupoA) && coincideGrupo(b, regla.grupoB);
        const inverso = coincideGrupo(a, regla.grupoB) && coincideGrupo(b, regla.grupoA);
        if (directo || inverso) {
          avisos.push({ farmacoA: a.principioActivo, farmacoB: b.principioActivo, gravedad: regla.gravedad, texto: regla.texto });
        }
      }
    }
  }
  return avisos;
}

const ETIQUETA_GRAVEDAD = { alta: "⛔ Riesgo alto", media: "⚠️ Precaución", baja: "ℹ️ A tener en cuenta" };

function renderInteracciones() {
  if (listaPaciente.length < 2) {
    interaccionesEl.innerHTML = "";
    return;
  }

  const avisos = evaluarInteracciones(listaPaciente);
  let html = `<h3 class="subtitulo-seccion">Comprobación de interacciones</h3>`;

  if (avisos.length) {
    html += avisos.map((a) => `
      <div class="interaccion-aviso interaccion-${a.gravedad}">
        <div class="interaccion-cabecera">${ETIQUETA_GRAVEDAD[a.gravedad] || "Aviso"} — ${escapeHtml(a.farmacoA)} + ${escapeHtml(a.farmacoB)}</div>
        <p>${escapeHtml(a.texto)}</p>
      </div>
    `).join("");
  } else {
    html += `<p class="ayuda">No se ha detectado ninguna interacción conocida entre estos fármacos en la comprobación curada de esta app.</p>`;
  }

  html += `
    <p class="aviso-inline">⚠ Esta comprobación se basa en una selección curada de interacciones conocidas por categoría/principio activo; no es una base de datos exhaustiva. Verifica siempre en una fuente de referencia (ej. Plumb's) o consulta con el veterinario responsable.</p>
    <div class="interaccion-aviso interaccion-info">
      <div class="interaccion-cabecera">💉 Mezcla en la misma jeringa o en la bolsa de sueroterapia</div>
      <p>No se ha comprobado la compatibilidad física/química específica entre estos fármacos (requiere tablas farmacéuticas especializadas que esta app no tiene). Como norma general:</p>
      <ul>
        <li>No mezcles fármacos distintos en la misma jeringa ni los añadas al mismo suero salvo que tengas confirmada su compatibilidad (ficha técnica o tabla de compatibilidad física).</li>
        <li>Si tienes dudas, adminístralos por separado, purgando la vía (o usando llaves de tres pasos distintas) entre uno y otro.</li>
        <li>El diazepam, en concreto, no es compatible con la mayoría de fármacos ni con soluciones de sueroterapia en la misma jeringa/línea (se adsorbe al plástico y puede precipitar): adminístralo siempre solo, por una vía independiente.</li>
        <li>Ten especial cuidado con sueros que contienen calcio (ej. Ringer lactato), ya que pueden ser incompatibles con determinados fármacos y formar precipitados.</li>
      </ul>
    </div>
  `;

  interaccionesEl.innerHTML = html;
}

// ============================================================
// Protocolos combinados (predefinidos + personalizados)
// ============================================================
let customProtocols = []; // cargado desde IndexedDB

async function cargarCustomProtocols() {
  customProtocols = await dbGetAll("customProtocols");
}

// Un "componente" es o bien el id de un fármaco de DRUGS (protocolos predefinidos,
// con dosis por especie), o bien un objeto ya con su propia dosis (protocolos
// personalizados, dosis fija indicada por el usuario para cualquiera de las especies).
function calcularComponenteProtocolo(componente) {
  let nombre, datos;
  if (typeof componente === "string") {
    const farmaco = DRUGS.find((d) => d.id === componente);
    if (!farmaco) return null;
    nombre = farmaco.principioActivo;
    datos = farmaco.especies[paciente.especie];
    if (!datos) return { nombre, datos: null };
  } else {
    nombre = componente.nombre;
    datos = componente;
  }

  let dosisTexto = null, min = null, max = null;
  if (paciente.peso && paciente.peso > 0) {
    min = datos.dosisMin * paciente.peso;
    max = datos.dosisMax * paciente.peso;
    if (datos.dosisMaxima) {
      min = Math.min(min, datos.dosisMaxima);
      max = Math.min(max, datos.dosisMaxima);
    }
    dosisTexto = datos.dosisMin === datos.dosisMax
      ? formatNum(min) + " " + unidadTotal(datos.unidad)
      : `${formatNum(min)} – ${formatNum(max)} ${unidadTotal(datos.unidad)}`;
  }
  return { nombre, datos, dosisTexto, min, max };
}

function etiquetaEspecies(especies) {
  if (especies.includes("perro") && especies.includes("gato")) return "Perro y gato";
  if (especies.includes("perro")) return "Perro";
  if (especies.includes("gato")) return "Gato";
  return "";
}

// Presentación concreta (producto de CIMAVET/CIMA) que el usuario ha elegido para un
// componente de un protocolo YA CREADO (predefinido o personalizado), buscada en vivo desde
// la propia tarjeta del protocolo. No se persiste entre sesiones (se resetea al recargar),
// igual que las demás búsquedas en vivo de la app. Clave: `${protocolo.id}::${idx}`.
// Valor: { presentacion: {tipo,valor,unidad} | null, nombreProducto, fuente }
const protocoloPresentacionesElegidas = {};

// Convierte la dosis en mg/kg (o mcg/kg, UI/kg) ya calculada de un componente de protocolo
// (resultado de calcularComponenteProtocolo) a una dosis práctica de administración (ml o
// fracción de comprimido) según una presentación/concentración concreta — ya sea detectada
// automáticamente en CIMAVET/CIMA o indicada manualmente. La usan tanto la tarjeta del
// protocolo (para mostrarla) como aplicarProtocolo (al añadirla al paciente), para que el
// cálculo sea siempre exactamente el mismo.
function formatearDosisPractica(c, presentacion) {
  const concentracion = presentacion.valor;
  const unidadConc = presentacion.unidad;
  const esComprimido = presentacion.tipo === "solido";
  const minBase = c.datos.unidad === "mcg/kg" ? c.min / 1000 : c.min;
  const maxBase = c.datos.unidad === "mcg/kg" ? c.max / 1000 : c.max;

  let texto;
  if (esComprimido) {
    texto = textoComprimidos(minBase / concentracion, maxBase / concentracion);
  } else {
    const volMin = minBase / concentracion;
    const volMax = maxBase / concentracion;
    texto = c.datos.dosisMin === c.datos.dosisMax
      ? formatNum(volMin) + " ml"
      : `${formatNum(volMin)} – ${formatNum(volMax)} ml`;
  }
  const detalle = esComprimido
    ? `${c.dosisTexto} (${concentracion} mg/comprimido) · ${c.datos.via} · ${c.datos.frecuencia}`
    : `${c.dosisTexto} a ${concentracion} ${unidadConc} · ${c.datos.via} · ${c.datos.frecuencia}`;
  return { texto, detalle };
}

function renderTarjetaProtocolo(protocolo) {
  const esPersonalizado = !!protocolo.personalizado;
  const aplicaEspecie = protocolo.especies.includes(paciente.especie);

  if (!aplicaEspecie) {
    const especieActualTexto = paciente.especie === "gato" ? "Gato" : "Perro";
    return `
      <div class="tarjeta protocolo-card protocolo-card-deshabilitada" data-id="${protocolo.id}" data-tipo="${esPersonalizado ? "custom" : "predefinido"}">
        <h3 class="titulo-tarjeta">${escapeHtml(protocolo.nombre)}${esPersonalizado ? ' <span class="tipo-tag tipo-tag-personalizado">Personalizado</span>' : ""}</h3>
        <p class="categoria">${escapeHtml(protocolo.indicacion)}</p>
        ${protocolo.notas ? `<p class="notas">${escapeHtml(protocolo.notas)}</p>` : ""}
        <div class="aviso-inline">⚠ Este protocolo está definido solo para <strong>${escapeHtml(etiquetaEspecies(protocolo.especies))}</strong>. No se puede calcular para el paciente actual (${especieActualTexto}).</div>
        <button class="boton-primario boton-protocolo" disabled>+ Añadir todos al paciente</button>
        ${esPersonalizado ? `
        <div class="fila-botones-form">
          <button type="button" class="boton-secundario boton-editar-protocolo" data-id="${protocolo.id}">Editar</button>
          <button type="button" class="boton-secundario boton-eliminar-protocolo" data-id="${protocolo.id}">Eliminar</button>
        </div>` : ""}
      </div>
    `;
  }

  const filas = protocolo.componentes
    .map((componenteRaw, idx) => ({ componenteRaw, idx, c: calcularComponenteProtocolo(componenteRaw) }))
    .filter((f) => f.c);

  let faltaAlgunaConcentracion = false;

  const filasComponentes = filas.map(({ componenteRaw, idx, c }) => {
    const key = protocolo.id + "::" + idx;
    const presentacionAuto = obtenerPresentacionComponente(componenteRaw);
    const elegida = protocoloPresentacionesElegidas[key];
    const presentacionEfectiva = presentacionAuto || (elegida && elegida.presentacion) || null;
    const unidadConc = c.datos && c.datos.unidad === "UI/kg" ? "UI/ml" : "mg/ml";

    let dosisMostrar = c.dosisTexto ? escapeHtml(c.dosisTexto) : (c.datos ? "Introduce el peso del paciente" : "Sin pauta para esta especie");
    if (c.datos && c.dosisTexto && presentacionEfectiva) {
      const practico = formatearDosisPractica(c, presentacionEfectiva);
      dosisMostrar = `${escapeHtml(practico.texto)} <span class="protocolo-dosis-mgkg">(${escapeHtml(c.dosisTexto)})</span>`;
    }

    let bloqueConcentracion = "";
    if (c.datos && presentacionAuto) {
      bloqueConcentracion = `<p class="ayuda presentacion-detectada">📐 ${escapeHtml(etiquetaPresentacion(presentacionAuto))} (detectada automáticamente, no hace falta indicarla)</p>`;
    } else if (c.datos && elegida) {
      bloqueConcentracion = `
        <p class="ayuda presentacion-detectada">📐 ${escapeHtml(elegida.nombreProducto)}${elegida.presentacion ? " — " + escapeHtml(etiquetaPresentacion(elegida.presentacion)) : ""}
          <button type="button" class="boton-enlace protocolo-comp-cambiar" data-key="${escapeHtml(key)}">Cambiar</button>
        </p>` +
        (!elegida.presentacion ? `<div class="protocolo-concentracion">
          <label>No se detectó la concentración de "${escapeHtml(elegida.nombreProducto)}": indícala (${unidadConc})</label>
          <input type="number" step="0.01" min="0" class="protocolo-concentracion-input" data-idx="${idx}" placeholder="Ej. 10" />
        </div>` : "");
      if (!elegida.presentacion) faltaAlgunaConcentracion = true;
    } else if (c.datos) {
      faltaAlgunaConcentracion = true;
      bloqueConcentracion = `
        <div class="protocolo-comp-buscador campo-busqueda" data-key="${escapeHtml(key)}" data-principio-activo="${escapeHtml(obtenerPrincipioActivoRealComponente(componenteRaw) || c.nombre)}">
          <label>Busca el producto concreto (tu base de datos, CIMAVET o CIMA)</label>
          <input type="text" class="protocolo-comp-buscador-input" placeholder="Ej. ${escapeHtml(c.nombre)}" autocomplete="off" />
          <ul class="protocolo-comp-sugerencias sugerencias oculto"></ul>
        </div>
        <div class="protocolo-concentracion">
          <label>...o indica la concentración manualmente (${unidadConc})</label>
          <input type="number" step="0.01" min="0" class="protocolo-concentracion-input" data-idx="${idx}" placeholder="Ej. 10" />
        </div>`;
    }

    return `
    <div class="protocolo-componente">
      <span class="protocolo-componente-nombre">${escapeHtml(c.nombre)}</span>
      <span class="protocolo-componente-dosis">${dosisMostrar}</span>
      <span class="protocolo-componente-via">${c.datos ? escapeHtml(c.datos.via + " · " + c.datos.frecuencia) : ""}</span>
      ${bloqueConcentracion}
    </div>
  `;
  }).join("");

  return `
    <div class="tarjeta protocolo-card" data-id="${protocolo.id}" data-tipo="${esPersonalizado ? "custom" : "predefinido"}">
      <h3 class="titulo-tarjeta">${escapeHtml(protocolo.nombre)}${esPersonalizado ? ' <span class="tipo-tag tipo-tag-personalizado">Personalizado</span>' : ""}</h3>
      <p class="categoria">${escapeHtml(protocolo.indicacion)}</p>
      ${protocolo.notas ? `<p class="notas">${escapeHtml(protocolo.notas)}</p>` : ""}
      <div class="protocolo-componentes">${filasComponentes}</div>
      <button class="boton-primario boton-protocolo" data-id="${protocolo.id}" data-tipo="${esPersonalizado ? "custom" : "predefinido"}" ${paciente.peso ? "" : "disabled"}>
        + Añadir todos al paciente
      </button>
      ${paciente.peso
        ? (faltaAlgunaConcentracion ? `<p class="ayuda">Indica la concentración de los fármacos que lo necesiten para poder añadirlos.</p>` : "")
        : `<p class="aviso-inline">Introduce el peso del paciente en la pestaña Calculadora para poder añadir este protocolo.</p>`}
      ${esPersonalizado ? `
      <div class="fila-botones-form">
        <button type="button" class="boton-secundario boton-editar-protocolo" data-id="${protocolo.id}">Editar</button>
        <button type="button" class="boton-secundario boton-eliminar-protocolo" data-id="${protocolo.id}">Eliminar</button>
      </div>` : ""}
    </div>
  `;
}

// Texto de búsqueda de un protocolo: nombre, indicación y los fármacos que lo componen
// (por principio activo y nombres comerciales), para poder filtrar por cualquiera de ellos.
function textoBusquedaProtocolo(protocolo) {
  const partes = [protocolo.nombre, protocolo.indicacion || ""];
  for (const componenteRaw of protocolo.componentes) {
    if (typeof componenteRaw === "string") {
      const farmaco = DRUGS.find((d) => d.id === componenteRaw);
      if (farmaco) partes.push(farmaco.principioActivo, ...(farmaco.nombresComerciales || []));
    } else if (componenteRaw) {
      partes.push(componenteRaw.nombre || "", componenteRaw.principioActivoReal || "");
    }
  }
  return normalizar(partes.join(" "));
}

function renderProtocolos() {
  if (!PROTOCOLS.length && !customProtocols.length) {
    protocolosListaEl.innerHTML = `<p class="placeholder">Todavía no hay ningún protocolo.</p>`;
    return;
  }

  const filtro = normalizar(protocolosBuscadorEl.value.trim());
  const coincide = (p) => !filtro || textoBusquedaProtocolo(p).includes(filtro);
  const customFiltrados = customProtocols.filter(coincide);
  const predefinidosFiltrados = PROTOCOLS.filter(coincide);

  if (filtro && !customFiltrados.length && !predefinidosFiltrados.length) {
    protocolosListaEl.innerHTML = `<p class="placeholder">Ningún protocolo coincide con "${escapeHtml(protocolosBuscadorEl.value.trim())}".</p>`;
    return;
  }

  // Se muestran todos los protocolos que coinciden con el filtro, incluso los que no
  // aplican a la especie actual del paciente: esos quedan visibles pero bloqueados,
  // con un aviso, en vez de desaparecer silenciosamente de la lista.
  let html = "";
  if (customFiltrados.length) {
    html += `<h3 class="subtitulo-seccion">Tus protocolos personalizados</h3>`;
    html += customFiltrados.map(renderTarjetaProtocolo).join("");
  }
  if (predefinidosFiltrados.length) {
    if (customFiltrados.length) html += `<h3 class="subtitulo-seccion">Protocolos predefinidos</h3>`;
    html += predefinidosFiltrados.map(renderTarjetaProtocolo).join("");
  }
  protocolosListaEl.innerHTML = html;

  protocolosListaEl.querySelectorAll(".boton-protocolo").forEach((btn) => {
    btn.addEventListener("click", () => {
      const protocolo = btn.dataset.tipo === "custom"
        ? customProtocols.find((p) => p.id === btn.dataset.id)
        : PROTOCOLS.find((p) => p.id === btn.dataset.id);
      aplicarProtocolo(protocolo, btn.closest(".protocolo-card"));
    });
  });
  protocolosListaEl.querySelectorAll(".boton-editar-protocolo").forEach((btn) => {
    btn.addEventListener("click", () => abrirFormularioProtocolo(customProtocols.find((p) => p.id === btn.dataset.id)));
  });
  protocolosListaEl.querySelectorAll(".boton-eliminar-protocolo").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este protocolo personalizado?")) return;
      await dbDelete("customProtocols", btn.dataset.id);
      await cargarCustomProtocols();
      renderProtocolos();
    });
  });

  // Buscador de producto concreto (CIMAVET/CIMA/tu base de datos) para cada componente
  // que aún no tiene una concentración detectada automáticamente ni elegida por el usuario.
  protocolosListaEl.querySelectorAll(".protocolo-comp-buscador").forEach((div) => {
    const key = div.dataset.key;
    const input = div.querySelector(".protocolo-comp-buscador-input");
    const sugerenciasEl = div.querySelector(".protocolo-comp-sugerencias");
    let debounceTimer = null;
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const texto = input.value.trim();
      if (texto.length < 3) {
        sugerenciasEl.innerHTML = "";
        sugerenciasEl.classList.add("oculto");
        return;
      }
      debounceTimer = setTimeout(() => buscarProductoParaComponenteProtocolo(texto, key, div), 400);
    });
    input.addEventListener("focus", () => {
      if (sugerenciasEl.innerHTML && input.value.trim().length >= 3) sugerenciasEl.classList.remove("oculto");
    });
  });
  protocolosListaEl.querySelectorAll(".protocolo-comp-cambiar").forEach((btn) => {
    btn.addEventListener("click", () => {
      delete protocoloPresentacionesElegidas[btn.dataset.key];
      renderProtocolos();
    });
  });
}

// Cierra cualquier desplegable de sugerencias de producto (buscador por componente de
// protocolo) si se hace clic fuera de su campo de búsqueda.
document.addEventListener("click", (e) => {
  document.querySelectorAll(".protocolo-comp-sugerencias:not(.oculto)").forEach((ul) => {
    const wrap = ul.closest(".protocolo-comp-buscador");
    if (wrap && !wrap.contains(e.target)) ul.classList.add("oculto");
  });
});

function aplicarProtocolo(protocolo, cardEl) {
  if (!protocolo || !paciente.peso) return;
  if (!protocolo.especies.includes(paciente.especie)) {
    alert(`Este protocolo es solo para ${etiquetaEspecies(protocolo.especies)} y no se puede aplicar a un paciente de especie "${paciente.especie === "gato" ? "Gato" : "Perro"}".`);
    return;
  }
  const faltanConcentracion = [];
  protocolo.componentes.forEach((componenteRaw, idx) => {
    const c = calcularComponenteProtocolo(componenteRaw);
    if (!c || !c.datos || !c.dosisTexto) return;

    const key = protocolo.id + "::" + idx;
    const presentacionAuto = obtenerPresentacionComponente(componenteRaw);
    const elegida = protocoloPresentacionesElegidas[key];
    let presentacion = presentacionAuto || (elegida && elegida.presentacion) || null;

    if (!presentacion) {
      const input = cardEl.querySelector(`.protocolo-concentracion-input[data-idx="${idx}"]`);
      const valor = input ? parseFloat(input.value) : NaN;
      if (!valor || valor <= 0) {
        faltanConcentracion.push(c.nombre);
        return;
      }
      presentacion = { tipo: "liquido", valor, unidad: c.datos.unidad === "UI/kg" ? "UI/ml" : "mg/ml" };
    }

    const { texto: dosisTextoFinal, detalle: detalleBase } = formatearDosisPractica(c, presentacion);
    const detalleFinal = elegida && elegida.nombreProducto ? `${detalleBase} · Producto: ${elegida.nombreProducto}` : detalleBase;

    añadirAlPaciente({
      principioActivo: c.nombre,
      principioActivoReal: obtenerPrincipioActivoRealComponente(componenteRaw),
      categoria: obtenerCategoriaComponente(componenteRaw),
      dosisTexto: dosisTextoFinal,
      detalle: detalleFinal,
      origen: "Protocolo: " + protocolo.nombre
    });
  });
  if (faltanConcentracion.length) {
    alert("No se han añadido al paciente (falta indicar su concentración): " + faltanConcentracion.join(", "));
  }
}

// ---- Formulario de protocolo personalizado ----
const nuevoProtocoloBoton = document.getElementById("nuevo-protocolo-boton");
const formularioProtocoloEl = document.getElementById("formulario-protocolo");
const formularioProtocoloTituloEl = document.getElementById("formulario-protocolo-titulo");
const cpNombreInput = document.getElementById("cp-nombre");
const cpIndicacionInput = document.getElementById("cp-indicacion");
const cpEspeciePerro = document.getElementById("cp-especie-perro");
const cpEspecieGato = document.getElementById("cp-especie-gato");
const cpNotasInput = document.getElementById("cp-notas");
const cpComponentesLista = document.getElementById("cp-componentes-lista");
const cpAnadirComponente = document.getElementById("cp-anadir-componente");
const cpGuardar = document.getElementById("cp-guardar");
const cpCancelar = document.getElementById("cp-cancelar");

let editandoProtocoloId = null;

nuevoProtocoloBoton.addEventListener("click", () => abrirFormularioProtocolo());
cpCancelar.addEventListener("click", cerrarFormularioProtocolo);
cpAnadirComponente.addEventListener("click", () => cpComponentesLista.appendChild(crearFilaComponenteProtocolo()));

function abrirFormularioProtocolo(protocolo) {
  editandoProtocoloId = protocolo ? protocolo.id : null;
  formularioProtocoloTituloEl.textContent = protocolo ? "Editar protocolo" : "Nuevo protocolo";
  cpNombreInput.value = protocolo ? protocolo.nombre : "";
  cpIndicacionInput.value = protocolo ? (protocolo.indicacion || "") : "";
  cpEspeciePerro.checked = protocolo ? protocolo.especies.includes("perro") : true;
  cpEspecieGato.checked = protocolo ? protocolo.especies.includes("gato") : true;
  cpNotasInput.value = protocolo ? (protocolo.notas || "") : "";
  cpComponentesLista.innerHTML = "";

  if (protocolo && protocolo.componentes.length) {
    protocolo.componentes.forEach((c) => cpComponentesLista.appendChild(crearFilaComponenteProtocolo(c)));
  } else {
    cpComponentesLista.appendChild(crearFilaComponenteProtocolo());
  }

  formularioProtocoloEl.classList.remove("oculto");
  formularioProtocoloEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cerrarFormularioProtocolo() {
  formularioProtocoloEl.classList.add("oculto");
  editandoProtocoloId = null;
}

function etiquetaFuente(fuente) {
  if (fuente === "local") return "tu base de datos";
  if (fuente === "cimavet") return "CIMAVET (veterinario)";
  if (fuente === "cima") return "CIMA (uso humano)";
  return "";
}

function crearFilaComponenteProtocolo(datos) {
  const div = document.createElement("div");
  div.className = "patologia-fila";
  div.dataset.fuente = (datos && datos.fuente) || "";
  div.innerHTML = `
    <div class="campo campo-busqueda">
      <label>Fármaco</label>
      <input type="text" class="cpf-nombre" placeholder="Busca en tu base de datos, CIMAVET o CIMA..." autocomplete="off" />
      <ul class="cpf-sugerencias sugerencias oculto"></ul>
      <p class="cpf-fuente-texto ayuda"></p>
    </div>
    <div class="fila">
      <div class="campo"><label>Dosis mín. (por kg)</label><input type="number" class="cpf-min" step="any" /></div>
      <div class="campo"><label>Dosis máx. (por kg)</label><input type="number" class="cpf-max" step="any" /></div>
    </div>
    <div class="fila">
      <div class="campo"><label>Unidad</label>
        <select class="cpf-unidad">
          <option value="mg/kg">mg/kg</option>
          <option value="mcg/kg">µg/kg (mcg/kg)</option>
          <option value="UI/kg">UI/kg</option>
        </select>
      </div>
      <div class="campo"><label>Vía</label><input type="text" class="cpf-via" placeholder="Ej. IV/IM" /></div>
    </div>
    <div class="campo"><label>Frecuencia</label><input type="text" class="cpf-frecuencia" placeholder="Ej. dosis única" /></div>
    <div class="campo"><label>Notas (opcional)</label><input type="text" class="cpf-notas" /></div>
    <button type="button" class="boton-eliminar-patologia cpf-quitar">✕ Quitar este fármaco</button>
  `;

  const nombreInput = div.querySelector(".cpf-nombre");
  const sugerenciasEl = div.querySelector(".cpf-sugerencias");
  const fuenteTextoEl = div.querySelector(".cpf-fuente-texto");

  div.dataset.presentacion = (datos && datos.presentacion) ? JSON.stringify(datos.presentacion) : "";
  div.dataset.categoria = (datos && datos.categoria) || "";
  div.dataset.principioActivoReal = (datos && datos.principioActivoReal) || "";

  if (datos) {
    nombreInput.value = datos.nombre || "";
    div.querySelector(".cpf-min").value = datos.dosisMin ?? "";
    div.querySelector(".cpf-max").value = datos.dosisMax ?? "";
    div.querySelector(".cpf-unidad").value = datos.unidad || "mg/kg";
    div.querySelector(".cpf-via").value = datos.via || "";
    div.querySelector(".cpf-frecuencia").value = datos.frecuencia || "";
    div.querySelector(".cpf-notas").value = datos.notas || "";
    if (datos.fuente) {
      fuenteTextoEl.textContent = "Fuente: " + etiquetaFuente(datos.fuente) +
        (datos.presentacion ? ` · ${etiquetaPresentacion(datos.presentacion)} (detectada automáticamente)` : "");
    }
  }

  let debounceTimer = null;
  nombreInput.addEventListener("input", () => {
    div.dataset.fuente = "";
    div.dataset.presentacion = "";
    fuenteTextoEl.textContent = "";
    clearTimeout(debounceTimer);
    const texto = nombreInput.value.trim();
    if (texto.length < 3) {
      sugerenciasEl.innerHTML = "";
      sugerenciasEl.classList.add("oculto");
      return;
    }
    debounceTimer = setTimeout(() => buscarParaComponenteProtocolo(texto, div), 400);
  });
  nombreInput.addEventListener("focus", () => {
    if (sugerenciasEl.innerHTML && nombreInput.value.trim().length >= 3) {
      sugerenciasEl.classList.remove("oculto");
    }
  });
  document.addEventListener("click", (e) => {
    if (!sugerenciasEl.contains(e.target) && e.target !== nombreInput) sugerenciasEl.classList.add("oculto");
  });

  div.querySelector(".cpf-quitar").addEventListener("click", () => div.remove());
  return div;
}

async function buscarParaComponenteProtocolo(texto, filaEl) {
  const nombreInput = filaEl.querySelector(".cpf-nombre");
  const sugerenciasEl = filaEl.querySelector(".cpf-sugerencias");
  const fuenteTextoEl = filaEl.querySelector(".cpf-fuente-texto");

  sugerenciasEl.innerHTML = `<li class="sugerencia-info">Buscando en tu base de datos, CIMAVET y CIMA...</li>`;
  sugerenciasEl.classList.remove("oculto");

  const localResultados = buscarLocal(texto).slice(0, 6);
  let cimavetResultados = [], cimaResultados = [];
  try {
    const data = await buscarCimavet(texto, 20);
    cimavetResultados = (data.resultados || []).slice(0, 6);
  } catch (e) { /* si CIMAVET falla, seguimos con lo demás */ }
  try {
    const data = await buscarCima(texto);
    cimaResultados = (data.resultados || []).slice(0, 6);
  } catch (e) { /* si CIMA falla, seguimos con lo demás */ }

  // Si el usuario ha seguido escribiendo mientras llegaban los resultados, se descartan.
  if (nombreInput.value.trim() !== texto) return;

  const items = [
    ...localResultados.map((r) => ({
      nombre: r.termino, fuente: "local",
      detalle: r.farmaco.principioActivo !== r.termino ? r.farmaco.principioActivo : (r.farmaco.categoria || ""),
      presentacion: null, farmaco: r.farmaco,
      categoria: r.farmaco.categoria, principioActivoReal: r.farmaco.principioActivo
    })),
    ...cimavetResultados.map((m) => ({
      nombre: m.nombre, fuente: "cimavet", detalle: m.labtitular || "",
      presentacion: extraerPresentacionMed(m),
      categoria: null, principioActivoReal: m.pactivos || (m.principiosActivos || []).map((p) => p.nombre).join(", ")
    })),
    ...cimaResultados.map((m) => ({
      nombre: m.nombre, fuente: "cima", detalle: m.labtitular || "",
      presentacion: extraerPresentacionMed(m),
      categoria: null, principioActivoReal: m.vtm ? m.vtm.nombre : null
    }))
  ];

  if (!items.length) {
    sugerenciasEl.innerHTML = `<li class="sugerencia-info">Sin resultados. Puedes escribir el nombre igualmente.</li>`;
    return;
  }

  sugerenciasEl.innerHTML = items.map((it, i) => `
    <li data-idx="${i}">
      <span class="termino">${escapeHtml(it.nombre)}</span>
      <span class="tipo-tag ${it.fuente === "local" ? "tipo-tag-personalizado" : ""}">${escapeHtml(etiquetaFuente(it.fuente))}</span>
      ${it.detalle ? `<span class="submeta">${escapeHtml(it.detalle)}</span>` : ""}
      ${it.presentacion ? `<span class="submeta">📐 ${escapeHtml(etiquetaPresentacion(it.presentacion))} — se rellenará solo</span>` : ""}
    </li>
  `).join("");

  sugerenciasEl.querySelectorAll("li[data-idx]").forEach((li) => {
    li.addEventListener("click", async () => {
      const it = items[Number(li.dataset.idx)];
      nombreInput.value = it.nombre;
      filaEl.dataset.fuente = it.fuente;
      filaEl.dataset.presentacion = it.presentacion ? JSON.stringify(it.presentacion) : "";
      filaEl.dataset.categoria = it.categoria || "";
      filaEl.dataset.principioActivoReal = it.principioActivoReal || "";
      fuenteTextoEl.textContent = "Fuente: " + etiquetaFuente(it.fuente) +
        (it.presentacion ? ` · ${etiquetaPresentacion(it.presentacion)} (detectada automáticamente)` : "");
      sugerenciasEl.classList.add("oculto");

      // Un fármaco de "tu base de datos" no tiene una concentración propia (es un
      // principio activo, no un producto concreto): buscamos en CIMAVET si hay una
      // única presentación inequívoca para rellenarla igualmente sin preguntar.
      if (it.fuente === "local" && it.farmaco) {
        fuenteTextoEl.textContent = "Fuente: " + etiquetaFuente(it.fuente) + " · buscando su concentración en CIMAVET...";
        try {
          const data = await buscarCimavet(principioActivoCorto(it.farmaco), 100);
          if (nombreInput.value !== it.nombre) return; // el usuario ha cambiado de selección mientras tanto
          const presentaciones = extraerPresentaciones(data.resultados || []);
          if (presentaciones.length === 1) {
            filaEl.dataset.presentacion = JSON.stringify(presentaciones[0]);
            fuenteTextoEl.textContent = "Fuente: " + etiquetaFuente(it.fuente) + ` · ${etiquetaPresentacion(presentaciones[0])} (detectada automáticamente en CIMAVET)`;
          } else if (presentaciones.length > 1) {
            fuenteTextoEl.textContent = "Fuente: " + etiquetaFuente(it.fuente) + " · CIMAVET tiene varias concentraciones para este principio activo; indícala manualmente abajo.";
          } else {
            fuenteTextoEl.textContent = "Fuente: " + etiquetaFuente(it.fuente) + " · no se ha encontrado una concentración en CIMAVET; indícala manualmente abajo.";
          }
        } catch (e) {
          fuenteTextoEl.textContent = "Fuente: " + etiquetaFuente(it.fuente);
        }
      }
    });
  });
}

// ---- Buscador de producto concreto para un componente de un protocolo YA CREADO ----
// (a diferencia de buscarParaComponenteProtocolo, que sirve para definir un componente nuevo
// al crear/editar un protocolo personalizado, esta busca solo la PRESENTACIÓN/concentración
// de un producto concreto para una dosis mg/kg que ya está fijada, y no toca esa dosis).
async function buscarProductoParaComponenteProtocolo(texto, key, contenedorEl) {
  const input = contenedorEl.querySelector(".protocolo-comp-buscador-input");
  const sugerenciasEl = contenedorEl.querySelector(".protocolo-comp-sugerencias");

  sugerenciasEl.innerHTML = `<li class="sugerencia-info">Buscando en tu base de datos, CIMAVET y CIMA...</li>`;
  sugerenciasEl.classList.remove("oculto");

  const localResultados = buscarLocal(texto).slice(0, 6);
  let cimavetResultados = [];
  try {
    const data = await buscarCimavet(texto, 30);
    // Descarta primero productos que no sean para perros/gatos (premezclas para pollos,
    // productos de caballos/rumiantes, etc.) para que no desplacen a los que sí interesan.
    cimavetResultados = filtrarCimavetPorEspecie(data.resultados || []).slice(0, 10);
  } catch (e) { /* si CIMAVET falla, seguimos con lo demás */ }

  // CIMA (medicina humana) solo se consulta como respaldo si CIMAVET no tiene nada para este
  // texto: la mayoría de fármacos SÍ están autorizados como veterinarios, y mezclar ambas
  // fuentes siempre añade ruido (marcas humanas que no aportan nada si ya hay veterinarias).
  let cimaResultados = [];
  if (!cimavetResultados.length) {
    try {
      const data = await buscarCima(texto);
      cimaResultados = (data.resultados || []).slice(0, 8);
    } catch (e) { /* si CIMA falla, seguimos con lo demás */ }
  }

  if (input.value.trim() !== texto) return; // el usuario ha seguido escribiendo mientras tanto

  let items = [
    ...localResultados.map((r) => ({
      nombre: r.termino, fuente: "local",
      detalle: r.farmaco.principioActivo !== r.termino ? r.farmaco.principioActivo : (r.farmaco.categoria || ""),
      presentacion: null
    })),
    ...cimavetResultados.map((m) => {
      const especies = (m.especies || []).map((e) => e.nombre).join(", ");
      return {
        nombre: m.nombre, fuente: "cimavet",
        detalle: [m.labtitular || "", especies].filter(Boolean).join(" · "),
        presentacion: extraerPresentacionMed(m)
      };
    }),
    ...cimaResultados.map((m) => ({
      nombre: m.nombre, fuente: "cima", detalle: m.labtitular || "",
      presentacion: extraerPresentacionMed(m)
    }))
  ];

  if (!items.length) {
    sugerenciasEl.innerHTML = `<li class="sugerencia-info">Sin resultados en tu base de datos, CIMAVET ni CIMA para "${escapeHtml(texto)}".</li>`;
    return;
  }

  const principioActivoParaFavoritos = contenedorEl.dataset.principioActivo || texto;
  const { lista: itemsOrdenados, esFavorito } = marcarYOrdenarFavoritos(items, principioActivoParaFavoritos);
  items = itemsOrdenados;

  sugerenciasEl.innerHTML = items.map((it, i) => `
    <li data-idx="${i}">
      <span class="termino">${esFavorito(it.nombre) ? "⭐ " : ""}${escapeHtml(it.nombre)}</span>
      <span class="tipo-tag ${it.fuente === "local" ? "tipo-tag-personalizado" : ""}">${escapeHtml(etiquetaFuente(it.fuente))}</span>
      ${it.detalle ? `<span class="submeta">${escapeHtml(it.detalle)}</span>` : ""}
      ${it.presentacion
        ? `<span class="submeta">📐 ${escapeHtml(etiquetaPresentacion(it.presentacion))} — se calculará solo</span>`
        : `<span class="submeta">Concentración no detectada automáticamente: habrá que indicarla a mano</span>`}
    </li>
  `).join("");

  sugerenciasEl.querySelectorAll("li[data-idx]").forEach((li) => {
    li.addEventListener("click", () => {
      const it = items[Number(li.dataset.idx)];
      protocoloPresentacionesElegidas[key] = { presentacion: it.presentacion, nombreProducto: it.nombre, fuente: it.fuente };
      renderProtocolos();
    });
  });
}

cpGuardar.addEventListener("click", async () => {
  const nombre = cpNombreInput.value.trim();
  if (!nombre) { alert("Indica un nombre para el protocolo."); return; }

  const especies = [];
  if (cpEspeciePerro.checked) especies.push("perro");
  if (cpEspecieGato.checked) especies.push("gato");
  if (!especies.length) { alert("Selecciona al menos una especie."); return; }

  const componentes = [];
  cpComponentesLista.querySelectorAll(".patologia-fila").forEach((fila) => {
    const nombreFarmaco = fila.querySelector(".cpf-nombre").value.trim();
    const min = parseFloat(fila.querySelector(".cpf-min").value);
    const max = parseFloat(fila.querySelector(".cpf-max").value);
    if (!nombreFarmaco || isNaN(min) || isNaN(max)) return;
    componentes.push({
      nombre: nombreFarmaco,
      fuente: fila.dataset.fuente || "manual",
      presentacion: fila.dataset.presentacion ? JSON.parse(fila.dataset.presentacion) : null,
      categoria: fila.dataset.categoria || null,
      principioActivoReal: fila.dataset.principioActivoReal || null,
      dosisMin: min,
      dosisMax: max,
      unidad: fila.querySelector(".cpf-unidad").value,
      via: fila.querySelector(".cpf-via").value.trim() || "-",
      frecuencia: fila.querySelector(".cpf-frecuencia").value.trim() || "-",
      notas: fila.querySelector(".cpf-notas").value.trim()
    });
  });
  if (!componentes.length) {
    alert("Añade al menos un fármaco completo (nombre, dosis mín. y máx. por kg).");
    return;
  }

  const protocolo = {
    id: editandoProtocoloId || ("protocolo-" + generarId()),
    nombre,
    indicacion: cpIndicacionInput.value.trim() || "Personalizado",
    especies,
    notas: cpNotasInput.value.trim(),
    componentes,
    personalizado: true
  };

  await dbPut("customProtocols", protocolo);
  await cargarCustomProtocols();
  cerrarFormularioProtocolo();
  renderProtocolos();
});

// ============================================================
// CRI — Infusión a ritmo constante (Constant Rate Infusion)
// Dos calculadoras independientes que comparten la misma fórmula:
//   dosis total por minuto (mg o UI) = dosis por kg y minuto × peso
//   ml/h = (dosis total por minuto × 60) / concentración de la mezcla (por ml)
// La única diferencia es qué dato se conoce (la concentración ya preparada, o el
// ritmo de la bomba ya fijado) y cuál se despeja.
// ============================================================

// Factor para convertir cada unidad de dosis a "por kg y por minuto" (misma familia,
// mg o UI, que la unidad del fármaco elegida). Todas las unidades mg-family se muestran
// si se elige "mg"; las UI-family, si se elige "UI".
const CRI_UNIDADES_DOSIS = {
  mg: [
    { value: "mcgkgmin", label: "µg/kg/min", factor: 1 / 1000 },
    { value: "mcgkgh", label: "µg/kg/h", factor: 1 / 1000 / 60 },
    { value: "mgkgmin", label: "mg/kg/min", factor: 1 },
    { value: "mgkgh", label: "mg/kg/h", factor: 1 / 60 },
    { value: "mgkgdia", label: "mg/kg/día", factor: 1 / 1440 }
  ],
  UI: [
    { value: "uikgh", label: "UI/kg/h", factor: 1 / 60 },
    { value: "uikgdia", label: "UI/kg/día", factor: 1 / 1440 }
  ]
};

function poblarUnidadesDosisCri(selectUnidadFarmaco, selectDosisUnidad) {
  const opciones = CRI_UNIDADES_DOSIS[selectUnidadFarmaco.value] || CRI_UNIDADES_DOSIS.mg;
  const valorPrevio = selectDosisUnidad.value;
  selectDosisUnidad.innerHTML = opciones.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  if (opciones.some((o) => o.value === valorPrevio)) selectDosisUnidad.value = valorPrevio;
}

function factorDosisCri(unidadFarmaco, dosisUnidadValue) {
  const opciones = CRI_UNIDADES_DOSIS[unidadFarmaco] || CRI_UNIDADES_DOSIS.mg;
  const opcion = opciones.find((o) => o.value === dosisUnidadValue);
  return opcion ? opcion.factor : null;
}

const criAvisoPesoEl = document.getElementById("cri-aviso-peso");

const criANombreInput = document.getElementById("cri-a-nombre");
const criASugerenciasEl = document.getElementById("cri-a-sugerencias");
const criAConcentracionEstadoEl = document.getElementById("cri-a-concentracion-estado");
const criAUnidadFarmacoSelect = document.getElementById("cri-a-unidad-farmaco");
const criAConcVialInput = document.getElementById("cri-a-conc-vial");
const criAVolExtraidoInput = document.getElementById("cri-a-vol-extraido");
const criAVolTotalInput = document.getElementById("cri-a-vol-total");
const criADosisValorInput = document.getElementById("cri-a-dosis-valor");
const criADosisUnidadSelect = document.getElementById("cri-a-dosis-unidad");
const criAResultadoEl = document.getElementById("cri-a-resultado");

const criBNombreInput = document.getElementById("cri-b-nombre");
const criBSugerenciasEl = document.getElementById("cri-b-sugerencias");
const criBConcentracionEstadoEl = document.getElementById("cri-b-concentracion-estado");
const criBUnidadFarmacoSelect = document.getElementById("cri-b-unidad-farmaco");
const criBConcVialInput = document.getElementById("cri-b-conc-vial");
const criBRitmoInput = document.getElementById("cri-b-ritmo");
const criBVolTotalInput = document.getElementById("cri-b-vol-total");
const criBDosisValorInput = document.getElementById("cri-b-dosis-valor");
const criBDosisUnidadSelect = document.getElementById("cri-b-dosis-unidad");
const criBResultadoEl = document.getElementById("cri-b-resultado");

poblarUnidadesDosisCri(criAUnidadFarmacoSelect, criADosisUnidadSelect);
poblarUnidadesDosisCri(criBUnidadFarmacoSelect, criBDosisUnidadSelect);
criAUnidadFarmacoSelect.addEventListener("change", () => { poblarUnidadesDosisCri(criAUnidadFarmacoSelect, criADosisUnidadSelect); calcularCriA(); });
criBUnidadFarmacoSelect.addEventListener("change", () => { poblarUnidadesDosisCri(criBUnidadFarmacoSelect, criBDosisUnidadSelect); calcularCriB(); });

// ---- Buscador de fármaco para CRI (CIMAVET primero, CIMA como respaldo si no hay nada) ----
// La mayoría de fármacos usados en CRI (fentanilo, ketamina, dopamina, nitroprusiato...) son
// de uso humano, así que aquí SIEMPRE tiene sentido buscar en CIMA aunque haya resultados en
// CIMAVET (a diferencia del buscador de protocolos, donde CIMA es solo un respaldo puro).
// Al elegir un producto se detecta su concentración líquida (mg/ml o UI/ml) automáticamente;
// las presentaciones sólidas (comprimidos/cápsulas) no sirven para una infusión IV, así que
// en ese caso se avisa en vez de rellenar nada.
function crearBuscadorFarmacoCri(nombreInput, sugerenciasEl, estadoEl, unidadFarmacoSelect, dosisUnidadSelect, concVialInput, recalcular) {
  let debounceTimer = null;
  nombreInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const texto = nombreInput.value.trim();
    estadoEl.textContent = "";
    if (texto.length < 3) {
      sugerenciasEl.innerHTML = "";
      sugerenciasEl.classList.add("oculto");
      return;
    }
    debounceTimer = setTimeout(() => buscarFarmacoParaCri(texto, { nombreInput, sugerenciasEl, estadoEl, unidadFarmacoSelect, dosisUnidadSelect, concVialInput, recalcular }), 400);
  });
  nombreInput.addEventListener("focus", () => {
    if (sugerenciasEl.innerHTML && nombreInput.value.trim().length >= 3) sugerenciasEl.classList.remove("oculto");
  });
}

async function buscarFarmacoParaCri(texto, ctx) {
  const { nombreInput, sugerenciasEl, estadoEl, unidadFarmacoSelect, dosisUnidadSelect, concVialInput, recalcular } = ctx;
  sugerenciasEl.innerHTML = `<li class="sugerencia-info">Buscando en CIMAVET y CIMA...</li>`;
  sugerenciasEl.classList.remove("oculto");

  let cimavetResultados = [];
  try {
    const data = await buscarCimavet(texto, 30);
    cimavetResultados = filtrarCimavetPorEspecie(data.resultados || []).slice(0, 10);
  } catch (e) { /* seguimos */ }

  let cimaResultados = [];
  try {
    const data = await buscarCima(texto);
    cimaResultados = (data.resultados || []).slice(0, 10);
  } catch (e) { /* seguimos */ }

  if (nombreInput.value.trim() !== texto) return; // el usuario ha seguido escribiendo mientras tanto

  let items = [
    ...cimavetResultados.map((m) => ({ nombre: m.nombre, fuente: "cimavet", detalle: m.labtitular || "", presentacion: extraerPresentacionMed(m) })),
    ...cimaResultados.map((m) => ({ nombre: m.nombre, fuente: "cima", detalle: m.labtitular || "", presentacion: extraerPresentacionMed(m) }))
  ];
  items.sort((a, b) => (esFavoritoCri(b.nombre) ? 1 : 0) - (esFavoritoCri(a.nombre) ? 1 : 0));

  if (!items.length) {
    sugerenciasEl.innerHTML = `<li class="sugerencia-info">Sin resultados en CIMAVET ni CIMA para "${escapeHtml(texto)}".</li>`;
    return;
  }

  sugerenciasEl.innerHTML = items.map((it, i) => {
    const esLiquido = it.presentacion && it.presentacion.tipo === "liquido";
    const esFav = esFavoritoCri(it.nombre);
    return `
    <li data-idx="${i}">
      <button type="button" class="cri-favorito-boton${esFav ? " es-favorito" : ""}" data-nombre="${escapeHtml(it.nombre)}" title="${esFav ? "Quitar de favoritos" : "Marcar como favorito para pedir siempre este a la farmacia"}">${esFav ? "⭐" : "☆"}</button>
      <span class="termino">${escapeHtml(it.nombre)}</span>
      <span class="tipo-tag">${escapeHtml(etiquetaFuente(it.fuente))}</span>
      ${it.detalle ? `<span class="submeta">${escapeHtml(it.detalle)}</span>` : ""}
      ${esLiquido
        ? `<span class="submeta">📐 ${escapeHtml(etiquetaPresentacion(it.presentacion))} — se rellenará solo</span>`
        : `<span class="submeta">⚠ No es una presentación líquida detectada; para CRI hace falta el vial inyectable, indica la concentración a mano</span>`}
    </li>`;
  }).join("");

  sugerenciasEl.querySelectorAll(".cri-favorito-boton").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavoritoCri(btn.dataset.nombre);
      buscarFarmacoParaCri(texto, ctx); // re-pinta con el orden/estrella actualizados
    });
  });

  sugerenciasEl.querySelectorAll("li[data-idx]").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.closest(".cri-favorito-boton")) return;
      const it = items[Number(li.dataset.idx)];
      nombreInput.value = it.nombre;
      sugerenciasEl.classList.add("oculto");
      if (it.presentacion && it.presentacion.tipo === "liquido") {
        unidadFarmacoSelect.value = it.presentacion.unidad === "UI/ml" ? "UI" : "mg";
        poblarUnidadesDosisCri(unidadFarmacoSelect, dosisUnidadSelect);
        concVialInput.value = it.presentacion.valor;
        estadoEl.textContent = `📐 Concentración detectada: ${etiquetaPresentacion(it.presentacion)} (${it.nombre}).`;
      } else {
        estadoEl.textContent = `⚠ No se ha detectado una concentración líquida para "${it.nombre}"; indícala manualmente si conoces el vial inyectable.`;
      }
      recalcular();
    });
  });
}

crearBuscadorFarmacoCri(criANombreInput, criASugerenciasEl, criAConcentracionEstadoEl, criAUnidadFarmacoSelect, criADosisUnidadSelect, criAConcVialInput, calcularCriA);
crearBuscadorFarmacoCri(criBNombreInput, criBSugerenciasEl, criBConcentracionEstadoEl, criBUnidadFarmacoSelect, criBDosisUnidadSelect, criBConcVialInput, calcularCriB);

document.addEventListener("click", (e) => {
  [criASugerenciasEl, criBSugerenciasEl].forEach((ul) => {
    if (!ul.classList.contains("oculto") && !ul.contains(e.target) && e.target !== ul.previousElementSibling) {
      ul.classList.add("oculto");
    }
  });
});

[criAConcVialInput, criAVolExtraidoInput, criAVolTotalInput, criADosisValorInput, criADosisUnidadSelect].forEach((el) => {
  el.addEventListener("input", calcularCriA);
  el.addEventListener("change", calcularCriA);
});
[criBConcVialInput, criBRitmoInput, criBVolTotalInput, criBDosisValorInput, criBDosisUnidadSelect].forEach((el) => {
  el.addEventListener("input", calcularCriB);
  el.addEventListener("change", calcularCriB);
});

function actualizarCri() {
  criAvisoPesoEl.classList.toggle("oculto", !!(paciente.peso && paciente.peso > 0));
  calcularCriA();
  calcularCriB();
}

// Calculadora A: mezcla ya preparada (concentración conocida) -> ritmo de la bomba (ml/h)
function calcularCriA() {
  const peso = paciente.peso;
  const unidadFarmaco = criAUnidadFarmacoSelect.value;
  const concVial = parseFloat(criAConcVialInput.value);
  const volExtraido = parseFloat(criAVolExtraidoInput.value);
  const volTotal = parseFloat(criAVolTotalInput.value);
  const dosisValor = parseFloat(criADosisValorInput.value);
  const factor = factorDosisCri(unidadFarmaco, criADosisUnidadSelect.value);

  if (!peso || !concVial || !volExtraido || !volTotal || !dosisValor || !factor) {
    criAResultadoEl.classList.add("oculto");
    criAResultadoEl.innerHTML = "";
    return;
  }

  const cantidadAnadida = concVial * volExtraido;
  const concentracionFinal = cantidadAnadida / volTotal;
  const dosisPorKgMin = dosisValor * factor;
  const dosisTotalPorMin = dosisPorKgMin * peso;
  const ritmoMlH = (dosisTotalPorMin * 60) / concentracionFinal;

  if (!isFinite(ritmoMlH) || ritmoMlH <= 0) {
    criAResultadoEl.classList.add("oculto");
    criAResultadoEl.innerHTML = "";
    return;
  }

  criAResultadoEl.classList.remove("oculto");
  criAResultadoEl.innerHTML = `
    <div class="resultado-dosis">${formatNum(ritmoMlH)} ml/h</div>
    <div class="resultado-detalle">
      <span>Mezcla: ${formatNum(cantidadAnadida)} ${unidadFarmaco} en ${formatNum(volTotal)} ml → ${formatNum(concentracionFinal)} ${unidadFarmaco}/ml</span>
    </div>
    <div class="resultado-volumen">Programa la bomba/perfusor a <strong>${formatNum(ritmoMlH)} ml/h</strong> para un paciente de ${formatNum(peso)} kg.</div>
    <button class="boton-anadir" id="cri-a-anadir-boton">+ Añadir al paciente</button>
  `;
  document.getElementById("cri-a-anadir-boton").addEventListener("click", () => {
    añadirAlPaciente({
      principioActivo: criANombreInput.value.trim() || "CRI",
      principioActivoReal: criANombreInput.value.trim() || null,
      categoria: "CRI (infusión a ritmo constante)",
      dosisTexto: `${formatNum(ritmoMlH)} ml/h`,
      detalle: `Mezcla ${formatNum(cantidadAnadida)} ${unidadFarmaco} en ${formatNum(volTotal)} ml (${formatNum(concentracionFinal)} ${unidadFarmaco}/ml) · dosis ${dosisValor} ${criADosisUnidadSelect.selectedOptions[0].textContent}`,
      origen: "CRI"
    });
  });
}

// Calculadora B: ritmo de bomba ya fijado -> cuánto fármaco añadir a la bolsa/jeringa
function calcularCriB() {
  const peso = paciente.peso;
  const unidadFarmaco = criBUnidadFarmacoSelect.value;
  const ritmoMlH = parseFloat(criBRitmoInput.value);
  const volTotal = parseFloat(criBVolTotalInput.value);
  const dosisValor = parseFloat(criBDosisValorInput.value);
  const concVial = parseFloat(criBConcVialInput.value); // opcional
  const factor = factorDosisCri(unidadFarmaco, criBDosisUnidadSelect.value);

  if (!peso || !ritmoMlH || !volTotal || !dosisValor || !factor) {
    criBResultadoEl.classList.add("oculto");
    criBResultadoEl.innerHTML = "";
    return;
  }

  const dosisPorKgMin = dosisValor * factor;
  const dosisTotalPorMin = dosisPorKgMin * peso;
  const concentracionNecesaria = (dosisTotalPorMin * 60) / ritmoMlH; // por ml
  const cantidadAnadir = concentracionNecesaria * volTotal;
  const duracionHoras = volTotal / ritmoMlH;

  if (!isFinite(cantidadAnadir) || cantidadAnadir <= 0) {
    criBResultadoEl.classList.add("oculto");
    criBResultadoEl.innerHTML = "";
    return;
  }

  const volDelVialTexto = concVial ? ` (= ${formatNum(cantidadAnadir / concVial)} ml del vial de ${formatNum(concVial)} ${unidadFarmaco}/ml)` : "";

  criBResultadoEl.classList.remove("oculto");
  criBResultadoEl.innerHTML = `
    <div class="resultado-dosis">${formatNum(cantidadAnadir)} ${unidadFarmaco}</div>
    <div class="resultado-detalle">
      <span>Añadir a los ${formatNum(volTotal)} ml de la bolsa/jeringa${volDelVialTexto}</span>
    </div>
    <div class="resultado-volumen">A ${formatNum(ritmoMlH)} ml/h, la mezcla dura ${formatNum(duracionHoras)} h para un paciente de ${formatNum(peso)} kg.</div>
    <button class="boton-anadir" id="cri-b-anadir-boton">+ Añadir al paciente</button>
  `;
  document.getElementById("cri-b-anadir-boton").addEventListener("click", () => {
    añadirAlPaciente({
      principioActivo: criBNombreInput.value.trim() || "CRI",
      principioActivoReal: criBNombreInput.value.trim() || null,
      categoria: "CRI (infusión a ritmo constante)",
      dosisTexto: `${formatNum(cantidadAnadir)} ${unidadFarmaco}${volDelVialTexto}`,
      detalle: `Añadido a ${formatNum(volTotal)} ml, a pasar a ${formatNum(ritmoMlH)} ml/h · dosis ${dosisValor} ${criBDosisUnidadSelect.selectedOptions[0].textContent}`,
      origen: "CRI"
    });
  });
}

// ============================================================
// Mi base de datos: fármacos personalizados con dosis por patología
// ============================================================
const nuevoFarmacoBoton = document.getElementById("nuevo-farmaco-boton");
const formularioFarmacoEl = document.getElementById("formulario-farmaco");
const formularioFarmacoTituloEl = document.getElementById("formulario-farmaco-titulo");
const cfPrincipioActivo = document.getElementById("cf-principio-activo");
const cfComposicion = document.getElementById("cf-composicion");
const cfCategoria = document.getElementById("cf-categoria");
const cfComerciales = document.getElementById("cf-comerciales");
const cfPatologiasLista = document.getElementById("cf-patologias-lista");
const cfAnadirPatologia = document.getElementById("cf-anadir-patologia");
const cfGuardar = document.getElementById("cf-guardar");
const cfCancelar = document.getElementById("cf-cancelar");
const misFarmacosListaEl = document.getElementById("mis-farmacos-lista");

let editandoId = null;

nuevoFarmacoBoton.addEventListener("click", () => abrirFormulario());
cfCancelar.addEventListener("click", cerrarFormulario);
cfAnadirPatologia.addEventListener("click", () => cfPatologiasLista.appendChild(crearFilaPatologia()));

function abrirFormulario(farmaco) {
  editandoId = farmaco ? farmaco.id : null;
  formularioFarmacoTituloEl.textContent = farmaco ? "Editar fármaco" : "Nuevo fármaco";
  cfPrincipioActivo.value = farmaco ? farmaco.principioActivo : "";
  cfComposicion.value = farmaco ? (farmaco.composicion || "") : "";
  cfCategoria.value = farmaco ? (farmaco.categoria || "") : "";
  cfComerciales.value = farmaco ? farmaco.nombresComerciales.join(", ") : "";
  cfPatologiasLista.innerHTML = "";

  if (farmaco) {
    const filas = [];
    for (const especie of ["perro", "gato"]) {
      for (const entrada of (farmaco.especies[especie] || [])) {
        filas.push(Object.assign({ especie }, entrada));
      }
    }
    if (filas.length) filas.forEach((f) => cfPatologiasLista.appendChild(crearFilaPatologia(f)));
    else cfPatologiasLista.appendChild(crearFilaPatologia());
  } else {
    cfPatologiasLista.appendChild(crearFilaPatologia());
  }

  formularioFarmacoEl.classList.remove("oculto");
  formularioFarmacoEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cerrarFormulario() {
  formularioFarmacoEl.classList.add("oculto");
  editandoId = null;
}

function crearFilaPatologia(datos) {
  const div = document.createElement("div");
  div.className = "patologia-fila";
  div.innerHTML = `
    <div class="fila">
      <div class="campo"><label>Patología / indicación</label><input type="text" class="pf-patologia" placeholder="Ej. Sedación" /></div>
      <div class="campo"><label>Especie</label>
        <select class="pf-especie"><option value="perro">Perro</option><option value="gato">Gato</option></select>
      </div>
    </div>
    <div class="fila">
      <div class="campo"><label>Dosis mín.</label><input type="number" class="pf-min" step="any" /></div>
      <div class="campo"><label>Dosis máx.</label><input type="number" class="pf-max" step="any" /></div>
    </div>
    <div class="fila">
      <div class="campo"><label>Unidad</label>
        <select class="pf-unidad">
          <option value="mg/kg">mg/kg</option>
          <option value="mcg/kg">µg/kg (mcg/kg)</option>
          <option value="UI/kg">UI/kg</option>
        </select>
      </div>
      <div class="campo"><label>Vía</label><input type="text" class="pf-via" placeholder="Ej. VO" /></div>
    </div>
    <div class="campo"><label>Frecuencia</label><input type="text" class="pf-frecuencia" placeholder="Ej. cada 12 h" /></div>
    <div class="campo"><label>Notas (opcional)</label><input type="text" class="pf-notas" /></div>
    <button type="button" class="boton-eliminar-patologia">✕ Quitar esta patología</button>
  `;
  if (datos) {
    div.querySelector(".pf-patologia").value = datos.patologia || "";
    div.querySelector(".pf-especie").value = datos.especie || "perro";
    div.querySelector(".pf-min").value = datos.dosisMin ?? "";
    div.querySelector(".pf-max").value = datos.dosisMax ?? "";
    div.querySelector(".pf-unidad").value = datos.unidad || "mg/kg";
    div.querySelector(".pf-via").value = datos.via || "";
    div.querySelector(".pf-frecuencia").value = datos.frecuencia || "";
    div.querySelector(".pf-notas").value = datos.notas || "";
  }
  div.querySelector(".boton-eliminar-patologia").addEventListener("click", () => div.remove());
  return div;
}

cfGuardar.addEventListener("click", async () => {
  const principioActivo = cfPrincipioActivo.value.trim();
  if (!principioActivo) { alert("Indica el principio activo."); return; }

  const especies = {};
  const filas = cfPatologiasLista.querySelectorAll(".patologia-fila");
  for (const fila of filas) {
    const especie = fila.querySelector(".pf-especie").value;
    const min = parseFloat(fila.querySelector(".pf-min").value);
    const max = parseFloat(fila.querySelector(".pf-max").value);
    const patologia = fila.querySelector(".pf-patologia").value.trim();
    if (!patologia || isNaN(min) || isNaN(max)) continue;
    if (!especies[especie]) especies[especie] = [];
    especies[especie].push({
      patologia,
      dosisMin: min,
      dosisMax: max,
      unidad: fila.querySelector(".pf-unidad").value,
      via: fila.querySelector(".pf-via").value.trim() || "-",
      frecuencia: fila.querySelector(".pf-frecuencia").value.trim() || "-",
      notas: fila.querySelector(".pf-notas").value.trim()
    });
  }
  if (!Object.keys(especies).length) {
    alert("Añade al menos una dosis completa (patología, especie, dosis mín. y máx.).");
    return;
  }

  const farmaco = {
    id: editandoId || ("custom-" + generarId()),
    esPersonalizado: true,
    principioActivo,
    composicion: cfComposicion.value.trim(),
    categoria: cfCategoria.value.trim() || "Personalizado",
    nombresComerciales: cfComerciales.value.split(",").map((s) => s.trim()).filter(Boolean),
    indicaciones: [...new Set(Object.values(especies).flat().map((e) => e.patologia))],
    especies
  };

  await dbPut("customDrugs", farmaco);
  await cargarCustomDrugs();
  cerrarFormulario();
  renderMisFarmacos();
});

function renderMisFarmacos() {
  if (!customDrugs.length) {
    misFarmacosListaEl.innerHTML = `<p class="placeholder">Todavía no has añadido ningún fármaco propio.</p>`;
    return;
  }
  misFarmacosListaEl.innerHTML = customDrugs.map((f) => {
    const filas = [];
    for (const especie of ["perro", "gato"]) {
      for (const e of (f.especies[especie] || [])) {
        filas.push(`<div class="protocolo-componente">
          <span class="protocolo-componente-nombre">${escapeHtml(e.patologia)} (${especie === "gato" ? "Gato" : "Perro"})</span>
          <span class="protocolo-componente-dosis">${e.dosisMin}${e.dosisMin !== e.dosisMax ? "–" + e.dosisMax : ""} ${escapeHtml(e.unidad)}</span>
          <span class="protocolo-componente-via">${escapeHtml(e.via)} · ${escapeHtml(e.frecuencia)}</span>
        </div>`);
      }
    }
    return `
      <div class="tarjeta">
        <h3 class="titulo-tarjeta">${escapeHtml(f.principioActivo)}</h3>
        ${f.composicion ? `<p class="categoria">${escapeHtml(f.composicion)}</p>` : ""}
        ${f.nombresComerciales.length ? `<p class="comerciales">Nombres comerciales: ${escapeHtml(f.nombresComerciales.join(", "))}</p>` : ""}
        <div class="protocolo-componentes">${filas.join("")}</div>
        <div class="fila-botones-form">
          <button type="button" class="boton-secundario boton-editar-mifarmaco" data-id="${f.id}">Editar</button>
          <button type="button" class="boton-secundario boton-eliminar-mifarmaco" data-id="${f.id}">Eliminar</button>
        </div>
      </div>
    `;
  }).join("");

  misFarmacosListaEl.querySelectorAll(".boton-editar-mifarmaco").forEach((btn) => {
    btn.addEventListener("click", () => abrirFormulario(customDrugs.find((f) => f.id === btn.dataset.id)));
  });
  misFarmacosListaEl.querySelectorAll(".boton-eliminar-mifarmaco").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este fármaco de tu base de datos? Las imágenes asociadas no se eliminarán automáticamente.")) return;
      await dbDelete("customDrugs", btn.dataset.id);
      await cargarCustomDrugs();
      renderMisFarmacos();
    });
  });
}

async function cargarCustomDrugs() {
  customDrugs = await dbGetAll("customDrugs");
  reconstruirIndice();
}

// ============================================================
// Copia de seguridad: exportar/importar mis datos personalizados
// (fármacos, protocolos y favoritos del hospital), ya que se guardan solo en
// este dispositivo/navegador y no hay servidor con el que sincronizarlos.
// ============================================================
const exportarDatosBoton = document.getElementById("exportar-datos-boton");
const importarDatosBoton = document.getElementById("importar-datos-boton");
const importarDatosInput = document.getElementById("importar-datos-input");
const importarDatosEstadoEl = document.getElementById("importar-datos-estado");

exportarDatosBoton.addEventListener("click", async () => {
  const [drugs, protocolos, favoritos, favoritosCriExport] = await Promise.all([
    dbGetAll("customDrugs"),
    dbGetAll("customProtocols"),
    dbGetAll("favoritosHospital"),
    dbGetAll("favoritosCri")
  ]);
  const backup = {
    tipo: "calculadora-dosis-backup",
    version: 1,
    exportadoEl: new Date().toISOString(),
    customDrugs: drugs,
    customProtocols: protocolos,
    favoritosHospital: favoritos,
    favoritosCri: favoritosCriExport
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `calculadora-dosis-backup-${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  importarDatosEstadoEl.textContent = `Exportado: ${drugs.length} fármaco(s), ${protocolos.length} protocolo(s), ${favoritos.length} favorito(s) del hospital y ${favoritosCriExport.length} favorito(s) de CRI.`;
});

importarDatosBoton.addEventListener("click", () => importarDatosInput.click());

importarDatosInput.addEventListener("change", async () => {
  const file = importarDatosInput.files[0];
  importarDatosInput.value = "";
  if (!file) return;
  importarDatosEstadoEl.textContent = "Importando...";
  try {
    const texto = await file.text();
    const backup = JSON.parse(texto);
    if (backup.tipo !== "calculadora-dosis-backup") {
      importarDatosEstadoEl.textContent = "⚠ Este archivo no parece una copia de seguridad de esta app.";
      return;
    }
    // Se añaden/actualizan (por id) sin borrar lo que ya hubiera en este dispositivo,
    // para no perder por accidente datos propios de este dispositivo al importar.
    for (const f of backup.customDrugs || []) await dbPut("customDrugs", f);
    for (const p of backup.customProtocols || []) await dbPut("customProtocols", p);
    for (const fav of backup.favoritosHospital || []) await dbPut("favoritosHospital", fav);
    for (const fav of backup.favoritosCri || []) await dbPut("favoritosCri", fav);
    await cargarCustomDrugs();
    await cargarCustomProtocols();
    await cargarFavoritosHospital();
    await cargarFavoritosCri();
    renderMisFarmacos();
    renderProtocolos();
    importarDatosEstadoEl.textContent = `Importado: ${(backup.customDrugs || []).length} fármaco(s), ${(backup.customProtocols || []).length} protocolo(s), ${(backup.favoritosHospital || []).length} favorito(s) del hospital y ${(backup.favoritosCri || []).length} favorito(s) de CRI.`;
  } catch (e) {
    importarDatosEstadoEl.textContent = "⚠ No se ha podido leer el archivo (¿es un backup exportado desde esta misma app?).";
  }
});

// ============================================================
// Service worker (uso sin conexión / instalación como app)
// ============================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

// ============================================================
// Los campos numéricos (peso, dosis, concentración...) solo deben cambiar de
// valor al escribir con el teclado: se desactiva el "scroll" del ratón, que
// por defecto del navegador incrementa/decrementa el número bajo el cursor
// y hace que sea muy fácil alterarlo sin querer al desplazar la página.
// ============================================================
document.addEventListener("wheel", () => {
  if (document.activeElement && document.activeElement.type === "number") {
    document.activeElement.blur();
  }
}, { passive: true });

// ============================================================
// Arranque
// ============================================================
actualizarPaciente();
cargarCustomDrugs().then(renderMisFarmacos);
cargarCustomProtocols();
cargarFavoritosHospital();
cargarFavoritosCri();
