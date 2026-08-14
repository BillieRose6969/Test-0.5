// Configuración
const urlAprobadas = "https://docs.google.com/spreadsheets/d/1msmEunitlatAq01F338OOc-iW5RSbSL-fTtXeHk9AXg/gviz/tq?tqx=out:csv&sheet=TOTAL%20PARCIAL";
const urlEliminadas = "https://docs.google.com/spreadsheets/d/100OcdQ6iZ83TxJVidgTWZkrQTbFSZhmaY8yBk48s78o/gviz/tq?tqx=out:csv&sheet=Resumen%20de%20Errores";
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutos en milisegundos

const urlDetalleFallas = "https://docs.google.com/spreadsheets/d/100OcdQ6iZ83TxJVidgTWZkrQTbFSZhmaY8yBk48s78o/gviz/tq?tqx=out:csv&sheet=Detalle%20de%20Fallas%20por%20Procesador";
const urlDetalleFallasAprobadas = "https://docs.google.com/spreadsheets/d/1msmEunitlatAq01F338OOc-iW5RSbSL-fTtXeHk9AXg/gviz/tq?tqx=out:csv&sheet=Motor%20de%20datos%20(Aprobadas)%20NO%20TOCAR";
const urlEvidencias = "https://script.google.com/macros/s/AKfycbw5zZrsSEm2LWuLWngp98zEPNpbXul7KOfcUmKdssUo7tWLxjOP8DjYVARAwYkFVTb2/exec";

// Variables globales para guardar los datos
let datosAprobadas = []; 
let datosEliminadas = [];
let datosDetalleFallas = {}; // key: nombreNormalizado, value: [{tipo, cantidad}] (Eliminadas)
let datosDetalleFallasAprobadas = {}; // key: nombreNormalizado, value: [{tipo, cantidad}] (Aprobadas)
let totalesFallasAprobadas = {}; // key: tipoDeFalla, value: total (para el 3er gráfico)
let nombresMap = {}; // key: nombreNormalizado, value: nombreOriginal (para mostrar)
let evidenciasMap = {}; // key: nombreNormalizado, value: { eliminadas: [{url, name}], aprobadas: [{url, name}] }

let chartAprobadas = null;
let chartEliminadas = null;
let chartFallasAprobadas = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
    
    // Configurar actualización automática
    setInterval(cargarDatos, REFRESH_INTERVAL);

    // Configurar evento del select
    document.getElementById('procesadorSelect').addEventListener('change', actualizarDetalles);

    // Configurar eventos del Modal
    const modal = document.getElementById("imageModal");
    const spanClose = document.getElementsByClassName("close-modal")[0];

    spanClose.onclick = function() {
        modal.style.display = "none";
    }

    // Cerrar modal haciendo clic afuera
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    }
});

// Función para abrir el modal con imágenes
function abrirModal(titulo, evidenciasArray) {
    const modal = document.getElementById("imageModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalGallery = document.getElementById("modalGallery");

    modalTitle.textContent = titulo;
    modalGallery.innerHTML = ''; // Limpiar galería

    evidenciasArray.forEach(ev => {
        // Soporte para objetos {url, name} o urls en texto plano (por compatibilidad)
        const url = typeof ev === 'object' ? ev.url : ev;
        const name = typeof ev === 'object' ? ev.name : 'Enlace externo';

        const container = document.createElement("div");
        container.className = "modal-image-container";

        const img = document.createElement("img");
        img.src = url;
        img.alt = name;

        const titleLabel = document.createElement("p");
        titleLabel.textContent = name;
        titleLabel.className = "modal-image-title";

        // Si hay error cargando la imagen (ej: link roto o permisos), mostramos solo un enlace
        img.onerror = () => {
            img.style.display = 'none';
            titleLabel.style.display = 'none';
            
            const a = document.createElement('a');
            a.href = url;
            a.target = "_blank";
            a.textContent = `🔗 ${name}`;
            a.className = "modal-broken-link";
            container.appendChild(a);
        };

        container.appendChild(img);
        container.appendChild(titleLabel);
        modalGallery.appendChild(container);
    });

    modal.style.display = "block";
}

// Función para normalizar nombres
function normalizarNombre(nombre) {
    if (!nombre) return "";
    
    // 1. Quitar guiones iniciales, puntos y comas, convertir a minúsculas
    let norm = nombre.replace(/^[-]+/, '').replace(/[.,]/g, ' ').trim().toLowerCase();
    
    // 2. Separar en palabras
    let palabras = norm.split(/\s+/).filter(p => p.length > 0);
    
    // 3. Ordenar alfabéticamente las palabras. 
    palabras.sort();
    
    return palabras.join(" ");
}

function registrarNombreOriginal(nombreNormalizado, nombreOriginal) {
    if (!nombresMap[nombreNormalizado]) {
        // Guardar el primer nombre original que encontramos como el "representativo"
        // Convertimos a mayúsculas como fue solicitado
        nombresMap[nombreNormalizado] = nombreOriginal.replace(/^[-]+/, '').trim().toUpperCase();
    }
}

async function cargarDatos() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        console.log("Cargando datos...");
        
        // Cargar todos los CSV en paralelo usando PapaParse y el API de evidencias
        const [resAprobadas, resEliminadas, resFallas, resFallasAprobadas, resEvidencias] = await Promise.all([
            fetchCSV(urlAprobadas),
            fetchCSV(urlEliminadas),
            fetchCSV(urlDetalleFallas),
            fetchCSV(urlDetalleFallasAprobadas),
            fetch(urlEvidencias).then(res => res.json()).catch(err => {
                console.warn("No se pudo cargar el API de Evidencias de Apps Script.", err);
                return {};
            })
        ]);

        procesarDatos(resAprobadas, resEliminadas, resFallas, resFallasAprobadas, resEvidencias);
        renderizarGraficos();
        actualizarSelect();
        
        // Si hay uno seleccionado, actualizar su vista
        if (document.getElementById('procesadorSelect').value) {
            actualizarDetalles();
        }
        
    } catch (error) {
        console.error("Error al cargar los datos:", error);
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: false,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err)
        });
    });
}

// Convertimos URLs de Drive al formato directo
function convertirUrlDrive(url) {
    if (!url) return "";
    let driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
        return `https://drive.google.com/uc?id=${driveMatch[1]}`;
    }
    let openMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (openMatch && openMatch[1] && url.includes('drive.google.com')) {
        return `https://drive.google.com/uc?id=${openMatch[1]}`;
    }
    return url;
}

function procesarDatos(csvAprobadas, csvEliminadas, csvFallas, csvFallasAprobadas, csvEvidencias) {
    let tempAprobadas = {};
    let tempEliminadas = {};
    datosDetalleFallas = {};
    datosDetalleFallasAprobadas = {};
    totalesFallasAprobadas = {};
    nombresMap = {};
    evidenciasMap = {};

    // Procesar Presunciones Mal Aprobadas
    for (let i = 1; i < csvAprobadas.length; i++) {
        const row = csvAprobadas[i];
        if (row && row.length >= 2 && row[0] && row[0].trim() !== "" && row[0].trim() !== "OPERADORES") {
            const nombreOriginal = row[0].trim();
            const nombreNorm = normalizarNombre(nombreOriginal);
            const cantidad = parseInt(row[1]) || 0;
            
            registrarNombreOriginal(nombreNorm, nombreOriginal);
            tempAprobadas[nombreNorm] = (tempAprobadas[nombreNorm] || 0) + cantidad;
        }
    }

    // Procesar Presunciones Mal Eliminadas
    for (let i = 1; i < csvEliminadas.length; i++) {
        const row = csvEliminadas[i];
        if (row && row.length >= 2 && row[0] && row[0].trim() !== "" && row[0].trim() !== "Procesador") {
            const nombreOriginal = row[0].trim();
            const nombreNorm = normalizarNombre(nombreOriginal);
            const cantidad = parseInt(row[1]) || 0;
            
            registrarNombreOriginal(nombreNorm, nombreOriginal);
            tempEliminadas[nombreNorm] = (tempEliminadas[nombreNorm] || 0) + cantidad;
        }
    }

    // Convertir mapas temporales a arrays
    datosAprobadas = Object.keys(tempAprobadas).map(k => ({
        nombreNormalizado: k,
        nombre: nombresMap[k],
        cantidad: tempAprobadas[k]
    }));

    datosEliminadas = Object.keys(tempEliminadas).map(k => ({
        nombreNormalizado: k,
        nombre: nombresMap[k],
        cantidad: tempEliminadas[k]
    }));

    // Procesar Detalle de Fallas (Presunciones mal eliminadas detalle)
    let lastProcesadorNorm = "";
    
    for (let i = 1; i < csvFallas.length; i++) {
        const row = csvFallas[i];
        if (!row || row.length < 2) continue;

        let procesadorCell = row[0] ? row[0].trim() : "";
        
        if (procesadorCell !== "") {
            lastProcesadorNorm = normalizarNombre(procesadorCell);
            registrarNombreOriginal(lastProcesadorNorm, procesadorCell);
        }

        const tipoError = row[1] ? row[1].trim() : "";
        if (lastProcesadorNorm !== "" && tipoError !== "") {
            const cantidad = parseInt(row[2]) || 0;

            if (cantidad > 0) {
                if (!datosDetalleFallas[lastProcesadorNorm]) {
                    datosDetalleFallas[lastProcesadorNorm] = [];
                }
                
                let existente = datosDetalleFallas[lastProcesadorNorm].find(f => f.tipo === tipoError);
                if (existente) {
                    existente.cantidad += cantidad;
                } else {
                    datosDetalleFallas[lastProcesadorNorm].push({ tipo: tipoError, cantidad: cantidad });
                }
            }
        }
    }

    // Procesar Detalle de Fallas Aprobadas
    let lastAprobadasNorm = "";
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

    for (let i = 0; i < csvFallasAprobadas.length; i++) {
        const row = csvFallasAprobadas[i];
        if (!row || row.length < 3) continue;

        let procesadorCell = row[0] ? row[0].trim() : "";
        
        if (procesadorCell !== "") {
            let nombrePuro = procesadorCell.replace(/^(?:[A-Z]+\s+)?Procesador\s+/i, '').trim();
            if (nombrePuro !== "") {
                lastAprobadasNorm = normalizarNombre(nombrePuro);
                registrarNombreOriginal(lastAprobadasNorm, nombrePuro);
            }
        }

        let siglaError = row[1] ? row[1].trim() : "";
        let cantidad = parseFloat(row[2]) || 0;

        if (lastAprobadasNorm !== "" && siglaError !== "" && !siglaError.includes("DETALLE DE FALLAS")) {
            let tipoErrorCompleto = diccionarioSiglas[siglaError] || siglaError;
            
            if (cantidad > 0) { 
                if (!datosDetalleFallasAprobadas[lastAprobadasNorm]) {
                    datosDetalleFallasAprobadas[lastAprobadasNorm] = [];
                }
                
                let existente = datosDetalleFallasAprobadas[lastAprobadasNorm].find(f => f.tipo === tipoErrorCompleto);
                if (existente) {
                    existente.cantidad += cantidad;
                } else {
                    datosDetalleFallasAprobadas[lastAprobadasNorm].push({ tipo: tipoErrorCompleto, cantidad: cantidad });
                }

                totalesFallasAprobadas[tipoErrorCompleto] = (totalesFallasAprobadas[tipoErrorCompleto] || 0) + cantidad;
            }
        }
    }

    // Procesar Evidencias (Imágenes desde Google Apps Script API)
    // El API devuelve un objeto JSON directamente: { "procesador norm": { aprobadas: [{url, name}], eliminadas: [{url, name}] } }
    if (csvEvidencias && Object.keys(csvEvidencias).length > 0 && !csvEvidencias.error) {
        for (let proc in csvEvidencias) {
            const nombreNorm = normalizarNombre(proc);
            
            if (!evidenciasMap[nombreNorm]) {
                evidenciasMap[nombreNorm] = { aprobadas: [], eliminadas: [] };
            }
            
            // Soportamos formato string (viejo) o el nuevo formato objeto {url, name}
            const transformList = (list) => list.map(item => {
                if (typeof item === 'object') {
                    return { url: convertirUrlDrive(item.url), name: item.name };
                }
                return { url: convertirUrlDrive(item), name: 'Evidencia' };
            });

            const aprobadasList = csvEvidencias[proc].aprobadas || [];
            const eliminadasList = csvEvidencias[proc].eliminadas || [];
            
            evidenciasMap[nombreNorm].aprobadas.push(...transformList(aprobadasList));
            evidenciasMap[nombreNorm].eliminadas.push(...transformList(eliminadasList));
        }
    }
}

function renderizarGraficos() {
    const topAprobadas = [...datosAprobadas].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
    const topEliminadas = [...datosEliminadas].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);

    const arrayFallasAprobadas = Object.keys(totalesFallasAprobadas).map(tipo => ({
        tipo: tipo,
        cantidad: totalesFallasAprobadas[tipo]
    }));
    const topTiposAprobadas = arrayFallasAprobadas.sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);

    const ctxAprobadas = document.getElementById('aprobadasChart').getContext('2d');
    const ctxEliminadas = document.getElementById('eliminadasChart').getContext('2d');
    const ctxFallasAprobadas = document.getElementById('fallasAprobadasChart').getContext('2d');

    const configAprobadas = {
        type: 'pie',
        data: {
            labels: topAprobadas.map(d => d.nombre),
            datasets: [{
                label: 'Errores',
                data: topAprobadas.map(d => d.cantidad),
                backgroundColor: generarColores(topAprobadas.length)
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right' }
            }
        }
    };

    const configEliminadas = {
        type: 'pie',
        data: {
            labels: topEliminadas.map(d => d.nombre),
            datasets: [{
                label: 'Errores',
                data: topEliminadas.map(d => d.cantidad),
                backgroundColor: generarColores(topEliminadas.length)
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right' }
            }
        }
    };

    const configFallasAprobadas = {
        type: 'pie',
        data: {
            labels: topTiposAprobadas.map(d => d.tipo),
            datasets: [{
                label: 'Cantidad',
                data: topTiposAprobadas.map(d => d.cantidad),
                backgroundColor: generarColores(topTiposAprobadas.length)
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right' }
            }
        }
    };

    if (chartAprobadas) chartAprobadas.destroy();
    if (chartEliminadas) chartEliminadas.destroy();
    if (chartFallasAprobadas) chartFallasAprobadas.destroy();

    chartAprobadas = new Chart(ctxAprobadas, configAprobadas);
    chartEliminadas = new Chart(ctxEliminadas, configEliminadas);
    chartFallasAprobadas = new Chart(ctxFallasAprobadas, configFallasAprobadas);
}

function actualizarSelect() {
    const select = document.getElementById('procesadorSelect');
    const valorActualNorm = select.value;
    
    const normalizados = Object.keys(nombresMap).sort((a, b) => {
        return nombresMap[a].localeCompare(nombresMap[b]);
    });

    select.innerHTML = '<option value="">-- Seleccione --</option>';
    normalizados.forEach(norm => {
        const option = document.createElement('option');
        option.value = norm;
        option.textContent = nombresMap[norm]; 
        select.appendChild(option);
    });

    if (normalizados.includes(valorActualNorm)) {
        select.value = valorActualNorm;
    }
}

function actualizarDetalles() {
    const select = document.getElementById('procesadorSelect');
    const card = document.getElementById('detailsCard');
    const nameEl = document.getElementById('detailsName');
    const statAprobadasEl = document.getElementById('statAprobadas');
    const statEliminadasEl = document.getElementById('statEliminadas');
    
    const fallasWrapper = document.getElementById('fallasWrapper');
    const fallasContainer = document.getElementById('fallasContainer');
    const fallasList = document.getElementById('fallasList');
    
    const fallasContainerAprobadas = document.getElementById('fallasContainerAprobadas');
    const fallasListAprobadas = document.getElementById('fallasListAprobadas');

    const galleryAprobadas = document.getElementById('galleryAprobadas');
    const galleryEliminadas = document.getElementById('galleryEliminadas');

    const norm = select.value;

    if (!norm) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    nameEl.textContent = nombresMap[norm]; 

    const dataAprobada = datosAprobadas.find(d => d.nombreNormalizado === norm);
    const dataEliminada = datosEliminadas.find(d => d.nombreNormalizado === norm);

    statAprobadasEl.textContent = dataAprobada ? dataAprobada.cantidad : '0';
    statEliminadasEl.textContent = dataEliminada ? dataEliminada.cantidad : '0';

    const fallasEliminadas = datosDetalleFallas[norm];
    const fallasAprobadas = datosDetalleFallasAprobadas[norm];
    
    let hayEliminadas = fallasEliminadas && fallasEliminadas.length > 0;
    let hayAprobadas = fallasAprobadas && fallasAprobadas.length > 0;

    const evidencias = evidenciasMap[norm] || { aprobadas: [], eliminadas: [] };

    if (hayEliminadas || hayAprobadas || evidencias.aprobadas.length > 0 || evidencias.eliminadas.length > 0) {
        fallasWrapper.style.display = 'flex';
    } else {
        fallasWrapper.style.display = 'none';
    }

    // Llenar eliminadas
    if (hayEliminadas || evidencias.eliminadas.length > 0) {
        fallasContainer.style.display = 'block';
        fallasList.innerHTML = ''; 
        if (fallasEliminadas) {
            fallasEliminadas.sort((a, b) => b.cantidad - a.cantidad);
            fallasEliminadas.forEach(f => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="falla-tipo">${f.tipo}</span>
                    <span class="falla-cantidad">${f.cantidad}</span>
                `;
                fallasList.appendChild(li);
            });
        }
        
        galleryEliminadas.innerHTML = '';
        if (evidencias.eliminadas.length > 0) {
            const btn = document.createElement('button');
            btn.className = 'btn-evidencia btn-evidencia-eliminada';
            btn.textContent = `🖼️ Ver Galería (${evidencias.eliminadas.length} enlaces)`;
            btn.onclick = () => abrirModal(`Evidencias Mal Eliminadas - ${nombresMap[norm]}`, evidencias.eliminadas);
            galleryEliminadas.appendChild(btn);
        }
    } else {
        fallasContainer.style.display = 'none';
    }

    // Llenar aprobadas
    if (hayAprobadas || evidencias.aprobadas.length > 0) {
        fallasContainerAprobadas.style.display = 'block';
        fallasListAprobadas.innerHTML = ''; 
        if (fallasAprobadas) {
            fallasAprobadas.sort((a, b) => b.cantidad - a.cantidad);
            fallasAprobadas.forEach(f => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="falla-tipo">${f.tipo}</span>
                    <span class="falla-cantidad">${f.cantidad}</span>
                `;
                fallasListAprobadas.appendChild(li);
            });
        }
        
        galleryAprobadas.innerHTML = '';
        if (evidencias.aprobadas.length > 0) {
            const btn = document.createElement('button');
            btn.className = 'btn-evidencia btn-evidencia-aprobada';
            btn.textContent = `🖼️ Ver Galería (${evidencias.aprobadas.length} enlaces)`;
            btn.onclick = () => abrirModal(`Evidencias Mal Aprobadas - ${nombresMap[norm]}`, evidencias.aprobadas);
            galleryAprobadas.appendChild(btn);
        }
    } else {
        fallasContainerAprobadas.style.display = 'none';
    }
}

function generarColores(cantidad) {
    const colores = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#E7E9ED', '#8AC926', '#1982C4', '#6A4C93'
    ];
    return colores.slice(0, cantidad);
}
