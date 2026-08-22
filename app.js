// Configuración
const urlAprobadas = "https://docs.google.com/spreadsheets/d/1msmEunitlatAq01F338OOc-iW5RSbSL-fTtXeHk9AXg/gviz/tq?tqx=out:csv&sheet=TOTAL%20PARCIAL";
const urlEliminadas = "https://docs.google.com/spreadsheets/d/100OcdQ6iZ83TxJVidgTWZkrQTbFSZhmaY8yBk48s78o/gviz/tq?tqx=out:csv&sheet=Resumen%20de%20Errores";
const REFRESH_INTERVAL = 2 * 60 * 60 * 1000;

const urlDetalleFallas = "https://docs.google.com/spreadsheets/d/100OcdQ6iZ83TxJVidgTWZkrQTbFSZhmaY8yBk48s78o/gviz/tq?tqx=out:csv&sheet=Detalle%20de%20Fallas%20por%20Procesador";
const urlDetalleFallasAprobadas = "https://docs.google.com/spreadsheets/d/1msmEunitlatAq01F338OOc-iW5RSbSL-fTtXeHk9AXg/gviz/tq?tqx=out:csv&sheet=Motor%20de%20datos%20(Aprobadas)%20NO%20TOCAR";

// --- CAMBIO CLAVE: Ahora leemos de tu Excel directo, NO del script temporal ---
const urlEvidencias = "https://docs.google.com/spreadsheets/d/1msmEunitlatAq01F338OOc-iW5RSbSL-fTtXeHk9AXg/gviz/tq?tqx=out:csv&sheet=Base%20Evidencias%20(NO%20TOCAR)";

let datosAprobadas = []; 
let datosEliminadas = [];
let datosDetalleFallas = {}; 
let datosDetalleFallasAprobadas = {}; 
let totalesFallasAprobadas = {}; 
let nombresMap = {}; 
let evidenciasMap = {}; 

let chartAprobadas = null;
let chartEliminadas = null;
let chartFallasAprobadas = null;

let currentImages = [];
let currentImageIndex = 0;
let isFetching = false; 

document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.color = '#8b8d96';
    Chart.defaults.font.family = 'Rajdhani, sans-serif';

    cargarDatos(false);
    setInterval(() => cargarDatos(true), REFRESH_INTERVAL);

    const btnRefresh = document.getElementById('btnForceRefresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => cargarDatos(true));
    }

    const buscador = document.getElementById('buscadorProcesadores');
    const sugerenciasBox = document.getElementById('sugerenciasBusqueda');
    const select = document.getElementById('procesadorSelect');

    if (buscador && sugerenciasBox && select) {
        select.addEventListener('change', () => {
            buscador.value = ''; 
            actualizarDetalles(); 
        });

        buscador.addEventListener('input', (e) => {
            const textoBusqueda = e.target.value.toLowerCase().trim();
            sugerenciasBox.innerHTML = ''; 

            if (textoBusqueda === '') {
                sugerenciasBox.style.display = 'none';
                return;
            }

            const nombresFiltrados = Object.keys(nombresMap)
                .sort((a, b) => nombresMap[a].localeCompare(nombresMap[b]))
                .filter(norm => nombresMap[norm].toLowerCase().includes(textoBusqueda));

            if (nombresFiltrados.length > 0) {
                sugerenciasBox.style.display = 'block';
                nombresFiltrados.forEach(norm => {
                    const li = document.createElement('li');
                    li.textContent = nombresMap[norm];
                    li.addEventListener('click', () => {
                        buscador.value = nombresMap[norm]; 
                        sugerenciasBox.style.display = 'none'; 
                        select.value = norm;
                        actualizarDetalles(); 
                    });
                    sugerenciasBox.appendChild(li);
                });
            } else {
                sugerenciasBox.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!buscador.contains(e.target) && !sugerenciasBox.contains(e.target)) {
                sugerenciasBox.style.display = 'none';
            }
        });
    }

    const modal = document.getElementById("imageModal");
    const spanClose = document.getElementsByClassName("close-modal")[0];
    spanClose.onclick = function() { modal.style.display = "none"; }
    window.onclick = function(event) { if (event.target === modal) modal.style.display = "none"; }

    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentImages.length > 0) {
                currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
                actualizarImagenModal();
            }
        });
    }

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentImages.length > 0) {
                currentImageIndex = (currentImageIndex + 1) % currentImages.length;
                actualizarImagenModal();
            }
        });
    }
});

function convertirUrlDrive(url) {
    if (!url) return "";
    let driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    let openMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (openMatch && openMatch[1] && url.includes('drive.google.com')) return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
    let ucMatch = url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (ucMatch && ucMatch[1]) return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
    return url;
}

function actualizarImagenModal() {
    const modalGallery = document.getElementById("modalGallery");
    const counter = document.getElementById("carouselCounter");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    
    modalGallery.innerHTML = '';
    
    if (currentImages.length === 0) {
        modalGallery.innerHTML = '<p>No hay imágenes</p>';
        if(counter) counter.textContent = '';
        if(prevBtn) prevBtn.style.display = 'none';
        if(nextBtn) nextBtn.style.display = 'none';
        return;
    }

    const ev = currentImages[currentImageIndex];
    let originalUrl = typeof ev === 'object' ? ev.url : ev;
    let name = typeof ev === 'object' ? ev.name : 'Imagen';
    let url = convertirUrlDrive(originalUrl);

    const container = document.createElement("div");
    container.className = "modal-image-container";

    const img = document.createElement("img");
    img.src = url;
    img.alt = name;
    
    let currentZoom = 2;

    img.addEventListener('mousemove', function(e) {
        const xPercent = (e.offsetX / this.offsetWidth) * 100;
        const yPercent = (e.offsetY / this.offsetHeight) * 100;
        this.style.transformOrigin = `${xPercent}% ${yPercent}%`;
        this.style.transform = `scale(${currentZoom})`;
    });

    img.addEventListener('wheel', function(e) {
        e.preventDefault(); 
        if (e.deltaY < 0) currentZoom += 0.5; 
        else currentZoom -= 0.5; 
        if (currentZoom < 1) currentZoom = 1;
        if (currentZoom > 10) currentZoom = 10;
        this.style.transform = `scale(${currentZoom})`;
    });

    img.addEventListener('mouseleave', function() {
        currentZoom = 2; 
        this.style.transformOrigin = 'center center';
        this.style.transform = 'scale(1)';
    });

    const titleLabel = document.createElement("p");
    titleLabel.textContent = name;
    titleLabel.className = "modal-image-title";

    img.onerror = () => {
        img.style.display = 'none';
        titleLabel.style.display = 'none';
        const a = document.createElement('a');
        a.href = originalUrl;
        a.target = "_blank";
        a.textContent = `🔗 ${name} (Clic para abrir en pestaña nueva)`;
        a.className = "modal-drive-link";
        container.appendChild(a);
    };

    container.appendChild(img);
    container.appendChild(titleLabel);
    modalGallery.appendChild(container);

    if(counter) counter.textContent = `${currentImageIndex + 1} de ${currentImages.length}`;
    if(prevBtn) prevBtn.style.display = currentImages.length > 1 ? 'block' : 'none';
    if(nextBtn) nextBtn.style.display = currentImages.length > 1 ? 'block' : 'none';
}

function abrirModal(titulo, evidenciasArray) {
    const modal = document.getElementById("imageModal");
    const modalTitle = document.getElementById("modalTitle");
    modalTitle.textContent = titulo;
    currentImages = evidenciasArray || [];
    currentImageIndex = 0;
    actualizarImagenModal();
    modal.style.display = "block";
}

function normalizarNombre(nombre) {
    if (!nombre) return "";
    let norm = nombre.replace(/^[-]+/, '').replace(/[.,]/g, ' ').trim().toLowerCase();
    let palabras = norm.split(/\s+/).filter(p => p.length > 0);
    let nombreUnificado = palabras.join(" ");

    const aliases = {
        "saldanio tomas": "saldaño tomas",
        "saldaño thomas": "saldaño tomas",
        "tomas saldanio": "saldaño tomas",
        "agustin burrieza": "burrieza agustin",
        "agustin gerez": "gerez agustin",
        "agustin viscarra": "viscarra agustin",
        "alan castrilli": "castrilli alan",
        "alan tramannoni": "tramannoni alan",
        "alberto marino": "marino alberto",
        "aldana fleitas": "fleitas aldana",
        "alejandra hidalgo": "hidalgo alejandra",
        "alexander maleckar": "maleckar alexander",
        "andrea tesone": "tesone andrea",
        "augusto marchese": "marchese augusto",
        "aylen gherardi": "gherardi aylen",
        "barbara loza": "loza barbara",
        "benjamin martinez": "martinez benjamin",
        "bruno carabajal": "carabajal bruno",
        "camila humbert": "humbert camila",
        "camila rollin": "rollin camila",
        "celeste vega": "vega celeste",
        "cristhoffer hernandez": "hernandez cristhoffer",
        "cristopher roldan": "roldan cristopher",
        "danyetza sanabria": "sanabria danyetza",
        "diana martinez": "martinez diana",
        "emily billordo": "billordo emily",
        "enzo benito": "benito enzo",
        "erica paijes": "paijes erica",
        "evelin gonzalez": "gonzalez evelin",
        "ezequiel wagner": "wagner ezequiel",
        "facundo moreno": "moreno facundo",
        "guido goyena": "goyena guido",
        "ignacio naya": "naya ignacio",
        "ivana rodriguez": "rodriguez ivana",
        "jacqueline vivas": "vivas jacqueline",
        "jennifer baltazar": "baltazar jennifer",
        "jeremias bagini": "bagini jeremias",
        "jonathan pereyra": "pereyra jonathan",
        "jorge fernandez": "fernandez jorge",
        "juan ozorio": "ozorio juan",
        "juana correa": "correa juana",
        "julia zattara": "zattara julia",
        "julieta iniguez": "iniguez julieta",
        "julieta mastorizzo": "mastorizzo julieta",
        "justin orellana": "orellana justin",
        "lautaro filchel": "filchel lautaro",
        "leandro martinez": "martinez leandro",
        "leon pastoruti": "pastoruti leon",
        "liana maidana": "maidana liana",
        "lisa senradiamante": "senradiamante lisa",
        "lourdes caminos": "caminos lourdes",
        "lucas esquivel": "esquivel lucas",
        "lucas flores": "flores lucas",
        "lucas pariente": "pariente lucas",
        "manuel fontana": "fontana manuel",
        "marcos fernandez": "fernandez marcos",
        "marcos pereyra": "pereyra marcos",
        "maria fennema": "fennema maria",
        "mariana pepek": "pepek mariana",
        "marlene navarrete": "navarrete marlene",
        "matias gonzalez": "gonzalez matias",
        "matias katalinich": "katalinich matias",
        "matias panteon": "panteon matias",
        "matias rovira": "rovira matias",
        "matias torrez": "torrez matias",
        "matias vernola": "vernola matias",
        "maximo arevalo": "arevalo maximo",
        "mayra benitez": "benitez mayra",
        "melany lauro": "lauro melany",
        "milagros grosky": "grosky milagros",
        "noelia errobidart": "errobidart noelia",
        "octavio camacho": "camacho octavio",
        "paloma pirsic": "pirsic paloma",
        "rocio lelliza": "lelliza rocio",
        "romina moller": "moller romina",
        "santiago guerreros": "guerreros santiago",
        "sebastian correa": "correa sebastian",
        "sofia lucas": "lucas sofia",
        "sofia verdoia": "verdoia sofia",
        "tahiel romero": "romero tahiel",
        "teodoro farias": "farias teodoro",
        "thiago antunez": "antunez thiago",
        "thiago valderrama": "valderrama thiago",
        "tobias gallardo": "gallardo tobias",
        "tomas cosenza": "cosenza tomas",
        "tomas martinez": "martinez tomas",
        "uriel cisneros": "cisneros uriel",
        "valentin gonzalez": "gonzalez valentin",
        "valentina giambrone": "giambrone valentina",
        "veronica spoleti": "spoleti veronica",
        "gianfranco ramirez": "ramirez gianfranco",
        "guadalupe diaz": "diaz guadalupe",
        "ivana rodrigues": "rodriguez ivana", 
        "jcqueline vivas": "vivas jacqueline", 
        "milton moller": "moller milton",
        "ignacio rodriguez": "rodriguez ignacio",
        "german pereyra": "pereyra german",
        "hugo patiño": "patiño hugo"
    };

    return aliases[nombreUnificado] || nombreUnificado;
}

function registrarNombreOriginal(nombreNormalizado, nombreOriginal) {
    if (!nombresMap[nombreNormalizado]) {
        nombresMap[nombreNormalizado] = nombreNormalizado.toUpperCase();
    }
}

function actualizarTotalesGlobales() {
    let totalAprobadas = datosAprobadas.reduce((suma, d) => suma + d.cantidad, 0);
    let totalEliminadas = datosEliminadas.reduce((suma, d) => suma + d.cantidad, 0);
    const elAprobadas = document.getElementById('globalTotalAprobadas');
    const elEliminadas = document.getElementById('globalTotalEliminadas');
    if(elAprobadas) elAprobadas.textContent = totalAprobadas;
    if(elEliminadas) elEliminadas.textContent = totalEliminadas;
}

async function cargarDatos(forzarActualizacion = false) {
    if (isFetching) return; 
    
    const CACHE_KEY = 'arasakaDashboardDatos';
    const CACHE_TIME_KEY = 'arasakaDashboardTimestamp';
    
    if (!forzarActualizacion) {
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        
        if (cachedData && cachedTime) {
            const age = Date.now() - parseInt(cachedTime);
            if (age < REFRESH_INTERVAL) {
                try {
                    const data = JSON.parse(cachedData);
                    procesarDatos(data.aprobadas, data.eliminadas, data.detalleFallas, data.detalleFallasAprobadas, data.evidencias);
                    actualizarSelect();
                    actualizarTotalesGlobales();
                    renderizarGraficos();
                    
                    if (document.getElementById('buscadorProcesadores').value !== '') {
                        actualizarDetalles();
                    }
                    return; 
                } catch (e) { console.warn("Error leyendo caché", e); }
            }
        }
    }

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
    
    isFetching = true; 

    try {
        // --- CAMBIO: Ahora TODO se trae como CSV rapidísimo ---
        const [aprobadas, eliminadas, detalleFallas, detalleFallasAprobadas, evidenciasCSV] = await Promise.all([
            fetchCSV(urlAprobadas),
            fetchCSV(urlEliminadas),
            fetchCSV(urlDetalleFallas),
            fetchCSV(urlDetalleFallasAprobadas),
            fetchCSV(urlEvidencias) 
        ]);
        
        try {
            const datosParaGuardar = { aprobadas, eliminadas, detalleFallas, detalleFallasAprobadas, evidencias: evidenciasCSV };
            localStorage.setItem(CACHE_KEY, JSON.stringify(datosParaGuardar));
            localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        } catch (e) {}
        
        procesarDatos(aprobadas, eliminadas, detalleFallas, detalleFallasAprobadas, evidenciasCSV);
        actualizarSelect();
        actualizarTotalesGlobales();
        renderizarGraficos();
        
        if (document.getElementById('buscadorProcesadores').value !== '') actualizarDetalles();
    } catch (error) {
        console.error("Error al cargar:", error);
        alert("⏱️ Hubo un error de conexión. Por favor, volvé a intentarlo.");
    } finally {
        isFetching = false; 
        if (overlay) overlay.style.display = 'none'; 
    }
}

function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, { download: true, header: false, complete: (results) => resolve(results.data), error: (err) => reject(err) });
    });
}

function procesarDatos(csvAprobadas, csvEliminadas, csvFallas, csvFallasAprobadas, csvEvidencias) {
    let tempAprobadas = {};
    let tempEliminadas = {};
    datosDetalleFallas = {};
    datosDetalleFallasAprobadas = {};
    totalesFallasAprobadas = {};
    nombresMap = {};
    
    // --- CAMBIO: Parseo ultrarrápido del nuevo CSV de evidencias ---
    evidenciasMap = {};
    if (csvEvidencias && csvEvidencias.length > 1) {
        for (let i = 1; i < csvEvidencias.length; i++) {
            let row = csvEvidencias[i];
            if (row && row.length >= 4) {
                let procOriginal = row[0] ? row[0].trim() : "";
                if (!procOriginal) continue;
                
                let procNorm = normalizarNombre(procOriginal);
                registrarNombreOriginal(procNorm, procOriginal);
                
                let tipo = row[1] ? row[1].trim().toLowerCase() : "aprobadas";
                let falla = row[2] ? row[2].trim() : "Evidencia";
                let url = row[3] ? row[3].trim() : "";

                if (!evidenciasMap[procNorm]) {
                    evidenciasMap[procNorm] = { aprobadas: [], eliminadas: [] };
                }
                
                if (tipo === 'aprobadas') {
                    evidenciasMap[procNorm].aprobadas.push({ name: falla, url: url });
                } else {
                    evidenciasMap[procNorm].eliminadas.push({ name: falla, url: url });
                }
            }
        }
    }

    for (let i = 1; i < csvAprobadas.length; i++) {
        const row = csvAprobadas[i];
        if (row && row.length >= 2 && row[0] && row[0].trim() !== "" && row[0].trim() !== "OPERADORES") {
            const nombreOriginal = row[0].trim();
            const nombreNorm = normalizarNombre(nombreOriginal);
            const cantidad = parseInt(row[1]) || 0;
            if (nombreOriginal.toUpperCase() !== "TOTAL GENERAL" && cantidad > 0) {
                tempAprobadas[nombreNorm] = cantidad;
                registrarNombreOriginal(nombreNorm, nombreOriginal);
            }
        }
    }

    for (let i = 1; i < csvEliminadas.length; i++) {
        const row = csvEliminadas[i];
        if (row && row.length >= 2 && row[0] && row[0].trim() !== "") {
            const nombreOriginal = row[0].trim();
            const nombreNorm = normalizarNombre(nombreOriginal);
            const cantidad = parseInt(row[1]) || 0;
            if (nombreOriginal.toUpperCase() !== "TOTAL GENERAL" && cantidad > 0) {
                tempEliminadas[nombreNorm] = cantidad;
                registrarNombreOriginal(nombreNorm, nombreOriginal);
            }
        }
    }

    let lastEliminadasNorm = "";
    for (let i = 1; i < csvFallas.length; i++) {
        const row = csvFallas[i];
        if (row && row.length >= 3) {
            let procesadorCell = row[0] ? row[0].trim() : "";
            if (procesadorCell !== "") {
                if (procesadorCell.toUpperCase() !== "TOTAL GENERAL") {
                    lastEliminadasNorm = normalizarNombre(procesadorCell);
                    registrarNombreOriginal(lastEliminadasNorm, procesadorCell);
                } else { lastEliminadasNorm = ""; }
            }
            const falla = row[1] ? row[1].trim() : "";
            const cantidad = parseInt(row[2]) || 0;
            
            if (lastEliminadasNorm !== "" && falla !== "" && cantidad > 0) {
                if (!datosDetalleFallas[lastEliminadasNorm]) datosDetalleFallas[lastEliminadasNorm] = [];
                let existente = datosDetalleFallas[lastEliminadasNorm].find(f => f.tipo === falla);
                if (existente) existente.cantidad += cantidad;
                else datosDetalleFallas[lastEliminadasNorm].push({ tipo: falla, cantidad: cantidad });
            }
        }
    }

    let headerAprobadas = csvFallasAprobadas[0] || [];
    let procesadorColIndex = -1;
    let fallaColIndex = -1;
    let contadorColIndex = -1;
    let diccionarioSiglas = {};
    
    for (let i = 0; i < csvFallasAprobadas.length; i++) {
        const row = csvFallasAprobadas[i];
        if (row && row.length >= 10) {
            let sigla = row[8] ? row[8].trim() : "";
            let nombreCompleto = row[9] ? row[9].trim() : "";
            if (sigla !== "" && nombreCompleto !== "" && sigla !== "SIGLA") { 
                diccionarioSiglas[sigla] = nombreCompleto;
            }
        }
    }

    for (let i = 0; i < headerAprobadas.length; i++) {
        let col = headerAprobadas[i] ? headerAprobadas[i].toUpperCase().trim() : "";
        if (col.includes("PROCESADOR") || col.includes("OPERADOR")) procesadorColIndex = i;
        else if (col.includes("DETALLE DE FALLAS") || col.includes("FALLAS DETECTADAS")) fallaColIndex = i;
        else if (col.includes("CONTADOR")) contadorColIndex = i;
    }

    if (procesadorColIndex !== -1 && fallaColIndex !== -1) {
        let lastAprobadasNorm = "";
        for (let i = 1; i < csvFallasAprobadas.length; i++) {
            const row = csvFallasAprobadas[i];
            if (row && row.length > Math.max(procesadorColIndex, fallaColIndex)) {
                let procesadorCell = row[procesadorColIndex] ? row[procesadorColIndex].trim() : "";
                
                if (procesadorCell !== "") {
                    let nombrePuro = procesadorCell.replace(/^(?:[A-Z]+\s+)?Procesador\s+/i, '').trim();
                    if (nombrePuro !== "" && !nombrePuro.includes("TOTAL GENERAL") && !nombrePuro.includes("Total general")) {
                        lastAprobadasNorm = normalizarNombre(nombrePuro);
                        registrarNombreOriginal(lastAprobadasNorm, nombrePuro);
                    } else if (nombrePuro.includes("TOTAL GENERAL") || nombrePuro.includes("Total general")) {
                        lastAprobadasNorm = ""; 
                    }
                }

                let siglaError = row[fallaColIndex] ? row[fallaColIndex].trim() : "";
                let cantidadFalla = 0;

                if (contadorColIndex !== -1 && row[contadorColIndex]) {
                    const cant = parseInt(row[contadorColIndex]);
                    if (!isNaN(cant)) cantidadFalla = cant;
                }
                
                if (lastAprobadasNorm !== "" && siglaError !== "" && !siglaError.includes("DETALLE DE FALLAS") && cantidadFalla > 0) {
                    let tipoErrorCompleto = diccionarioSiglas[siglaError] || siglaError;
                    
                    if (!datosDetalleFallasAprobadas[lastAprobadasNorm]) datosDetalleFallasAprobadas[lastAprobadasNorm] = {};
                    if (!datosDetalleFallasAprobadas[lastAprobadasNorm][tipoErrorCompleto]) datosDetalleFallasAprobadas[lastAprobadasNorm][tipoErrorCompleto] = 0;
                    datosDetalleFallasAprobadas[lastAprobadasNorm][tipoErrorCompleto] += cantidadFalla;
                    
                    if (!totalesFallasAprobadas[tipoErrorCompleto]) totalesFallasAprobadas[tipoErrorCompleto] = 0;
                    totalesFallasAprobadas[tipoErrorCompleto] += cantidadFalla;
                }
            }
        }
    }

    datosAprobadas = Object.keys(tempAprobadas).map(k => ({ nombreNorm: k, cantidad: tempAprobadas[k] }));
    datosEliminadas = Object.keys(tempEliminadas).map(k => ({ nombreNorm: k, cantidad: tempEliminadas[k] }));
}

function generarColores(cantidad) {
    const colores = ['#ff2a2a', '#8b0000', '#4a0000', '#ff4a4a', '#15161a', '#2a2b33', '#e2e2e5', '#8b8d96', '#ff7f7f', '#3a0000'];
    let result = [];
    for(let i=0; i<cantidad; i++) result.push(colores[i % colores.length]);
    return result;
}

function renderizarGraficos() {
    const aprobadasSorted = [...datosAprobadas].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
    const labelsAprobadas = aprobadasSorted.map(d => nombresMap[d.nombreNorm] || d.nombreNorm);
    const dataAprobadas = aprobadasSorted.map(d => d.cantidad);

    const ctxAprobadas = document.getElementById('aprobadasChart').getContext('2d');
    const configAprobadas = { type: 'pie', data: { labels: labelsAprobadas, datasets: [{ data: dataAprobadas, backgroundColor: generarColores(dataAprobadas.length), borderWidth: 1, borderColor: '#15161a' }] }, options: { color: '#e2e2e5', responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } } };

    const eliminadasSorted = [...datosEliminadas].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
    const labelsEliminadas = eliminadasSorted.map(d => nombresMap[d.nombreNorm] || d.nombreNorm);
    const dataEliminadas = eliminadasSorted.map(d => d.cantidad);

    const ctxEliminadas = document.getElementById('eliminadasChart').getContext('2d');
    const configEliminadas = { type: 'pie', data: { labels: labelsEliminadas, datasets: [{ data: dataEliminadas, backgroundColor: generarColores(dataEliminadas.length), borderWidth: 1, borderColor: '#15161a' }] }, options: { color: '#e2e2e5', responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } } };

    let fallasArray = [];
    for (let f in totalesFallasAprobadas) {
        if(totalesFallasAprobadas[f] > 0) fallasArray.push({ falla: f, cantidad: totalesFallasAprobadas[f] });
    }
    fallasArray.sort((a, b) => b.cantidad - a.cantidad);
    const topFallas = fallasArray.slice(0, 10);

    const labelsFallas = topFallas.map(f => f.falla);
    const dataFallas = topFallas.map(f => f.cantidad);

    const ctxFallasAprobadas = document.getElementById('fallasAprobadasChart').getContext('2d');
    const configFallasAprobadas = { type: 'pie', data: { labels: labelsFallas, datasets: [{ data: dataFallas, backgroundColor: generarColores(dataFallas.length), borderWidth: 1, borderColor: '#15161a' }] }, options: { color: '#e2e2e5', responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } } };

    if (chartAprobadas) chartAprobadas.destroy();
    if (chartEliminadas) chartEliminadas.destroy();
    if (chartFallasAprobadas) chartFallasAprobadas.destroy();

    chartAprobadas = new Chart(ctxAprobadas, configAprobadas);
    chartEliminadas = new Chart(ctxEliminadas, configEliminadas);
    chartFallasAprobadas = new Chart(ctxFallasAprobadas, configFallasAprobadas);
}

function actualizarSelect() {
    const select = document.getElementById('procesadorSelect');
    const valorActual = select.value;
    select.innerHTML = '<option value="">-- Seleccione --</option>';

    let todosNombres = Object.keys(nombresMap).sort((a, b) => nombresMap[a].localeCompare(nombresMap[b]));

    todosNombres.forEach(norm => {
        const opt = document.createElement('option');
        opt.value = norm;
        opt.textContent = nombresMap[norm];
        select.appendChild(opt);
    });

    if (valorActual && nombresMap[valorActual]) select.value = valorActual;
}

function actualizarDetalles() {
    const select = document.getElementById('procesadorSelect');
    if (!select) return;

    const norm = select.value;
    const detailsCard = document.getElementById('detailsCard');
    const fallasWrapper = document.getElementById('fallasWrapper');

    if (!norm) {
        if(detailsCard) detailsCard.style.display = 'none';
        return;
    }

    if(detailsCard) detailsCard.style.display = 'block';
    if(fallasWrapper) fallasWrapper.style.display = 'flex';
    document.getElementById('detailsName').textContent = nombresMap[norm] || norm;

    const dAprob = datosAprobadas.find(d => d.nombreNorm === norm);
    document.getElementById('statAprobadas').textContent = dAprob ? dAprob.cantidad : 0;
    
    const dElim = datosEliminadas.find(d => d.nombreNorm === norm);
    document.getElementById('statEliminadas').textContent = dElim ? dElim.cantidad : 0;

    const fallasAprobadasRaw = datosDetalleFallasAprobadas[norm] || {};
    const fallasEliminadas = datosDetalleFallas[norm] || [];
    
    const fallasAprobadas = Object.entries(fallasAprobadasRaw).map(([falla, cantidad]) => ({ tipo: falla, cantidad: cantidad }));
        
    const hayAprobadas = fallasAprobadas.length > 0;
    const hayEliminadas = fallasEliminadas.length > 0;

    const fallasContainerAprobadas = document.getElementById('fallasContainerAprobadas');
    const fallasListAprobadas = document.getElementById('fallasListAprobadas');
    const fallasContainer = document.getElementById('fallasContainer');
    const fallasList = document.getElementById('fallasList');
    const galleryAprobadas = document.getElementById('galleryAprobadas');
    const galleryEliminadas = document.getElementById('galleryEliminadas');
    
    let evidencias = evidenciasMap[norm] || { aprobadas: [], eliminadas: [] };

    if (hayEliminadas || evidencias.eliminadas.length > 0) {
        if(fallasContainer) fallasContainer.style.display = 'block';
        if(fallasList) fallasList.innerHTML = ''; 
        if(fallasEliminadas && fallasList) {
            fallasEliminadas.sort((a, b) => b.cantidad - a.cantidad);
            fallasEliminadas.forEach(f => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="falla-tipo">${f.tipo}</span> <span class="falla-cantidad">${f.cantidad}</span>`;
                fallasList.appendChild(li);
            });
        }
        
        if(galleryEliminadas) {
            galleryEliminadas.innerHTML = '';
            if (evidencias.eliminadas.length > 0) {
                const btn = document.createElement('button');
                btn.className = 'btn-evidencia btn-evidencia-eliminada';
                btn.textContent = `🖼️ Ver Galería (${evidencias.eliminadas.length} enlaces)`;
                btn.onclick = () => abrirModal(`Evidencias Mal Eliminadas - ${nombresMap[norm]}`, evidencias.eliminadas);
                galleryEliminadas.appendChild(btn);
            }
        }
    } else {
        if(fallasContainer) fallasContainer.style.display = 'none';
    }

    if (hayAprobadas || evidencias.aprobadas.length > 0) {
        if(fallasContainerAprobadas) fallasContainerAprobadas.style.display = 'block';
        if(fallasListAprobadas) fallasListAprobadas.innerHTML = ''; 
        if (fallasAprobadas && fallasListAprobadas) {
            fallasAprobadas.sort((a, b) => b.cantidad - a.cantidad);
            fallasAprobadas.forEach(f => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="falla-tipo">${f.tipo}</span> <span class="falla-cantidad">${f.cantidad}</span>`;
                fallasListAprobadas.appendChild(li);
            });
        }
        
        if(galleryAprobadas) {
            galleryAprobadas.innerHTML = '';
            if (evidencias.aprobadas.length > 0) {
                const btn = document.createElement('button');
                btn.className = 'btn-evidencia btn-evidencia-aprobada';
                btn.textContent = `🖼️ Ver Galería (${evidencias.aprobadas.length} enlaces)`;
                btn.onclick = () => abrirModal(`Evidencias Mal Aprobadas - ${nombresMap[norm]}`, evidencias.aprobadas);
                galleryAprobadas.appendChild(btn);
            }
        }
    } else {
        if(fallasContainerAprobadas) fallasContainerAprobadas.style.display = 'none';
    }
}

setInterval(generarGlitchNombre, 1200); 

function generarGlitchNombre() {
    const container = document.getElementById('glitch-background');
    if (!container) return;
    const nombres = Object.values(nombresMap);
    if (nombres.length === 0) return;
    const randomName = nombres[Math.floor(Math.random() * nombres.length)];
    const span = document.createElement('span');
    span.className = 'glitch-name';
    span.textContent = randomName;
    const x = Math.random() * 90;
    const y = Math.random() * 90;
    span.style.left = `${x}vw`;
    span.style.top = `${y}vh`;
    span.style.fontSize = `${Math.random() * 2 + 1}rem`;
    container.appendChild(span);
    setTimeout(() => { span.remove(); }, 800);
}

document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', function(e) {
    if(e.keyCode == 123) { e.preventDefault(); return false; }
    if(e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) { e.preventDefault(); return false; }
    if(e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) { e.preventDefault(); return false; }
    if(e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) { e.preventDefault(); return false; }
});
