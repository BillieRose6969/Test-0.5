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

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
    
    setInterval(cargarDatos, REFRESH_INTERVAL);

    document.getElementById('procesadorSelect').addEventListener('change', actualizarDetalles);

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

// Convertimos URLs de Drive al formato directo
function convertirUrlDrive(url) {
    if (!url) return "";
    let driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    let openMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (openMatch && openMatch[1] && url.includes('drive.google.com')) {
        return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
    }
    let ucMatch = url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (ucMatch && ucMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
    }
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
    
    const titleLabel = document.createElement("p");
    titleLabel.textContent = name;
    titleLabel.className = "modal-image-title";

    // Fallback if image fails to load
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
    palabras.sort();
    return palabras.join(" ");
}

function registrarNombreOriginal(nombreNormalizado, nombreOriginal) {
    if (!nombresMap[nombreNormalizado]) {
        nombresMap[nombreNormalizado] = nombreOriginal.replace(/^[-]+/, '').trim().toUpperCase();
    }
}

async function cargarDatos() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        const [aprobadas, eliminadas, detalleFallas, detalleFallasAprobadas, evidencias] = await Promise.all([
            fetchCSV(urlAprobadas),
            fetchCSV(urlEliminadas),
            fetchCSV(urlDetalleFallas),
            fetchCSV(urlDetalleFallasAprobadas),
            fetch(urlEvidencias).then(res => res.json()).catch(err => {
                console.error("Error cargando evidencias:", err);
                return {};
            })
        ]);
        
        procesarDatos(aprobadas, eliminadas, detalleFallas, detalleFallasAprobadas, evidencias);
        actualizarSelect();
        renderizarGraficos();
        actualizarDetalles(); // Forzar update si hay uno seleccionado
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

function procesarDatos(csvAprobadas, csvEliminadas, csvFallas, csvFallasAprobadas, csvEvidencias) {
    let tempAprobadas = {};
    let tempEliminadas = {};
    datosDetalleFallas = {};
    datosDetalleFallasAprobadas = {};
    totalesFallasAprobadas = {};
    nombresMap = {};
    evidenciasMap = csvEvidencias || {};

    // Procesar Presunciones Mal Aprobadas
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

    // Procesar Presunciones Mal Eliminadas
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

    // Procesar Detalle de Fallas (Mal Eliminadas)
    let lastEliminadasNorm = "";
    for (let i = 1; i < csvFallas.length; i++) {
        const row = csvFallas[i];
        if (row && row.length >= 3) {
            let procesadorCell = row[0] ? row[0].trim() : "";
            
            if (procesadorCell !== "") {
                if (procesadorCell.toUpperCase() !== "TOTAL GENERAL") {
                    lastEliminadasNorm = normalizarNombre(procesadorCell);
                    registrarNombreOriginal(lastEliminadasNorm, procesadorCell);
                } else {
                    lastEliminadasNorm = "";
                }
            }

            const falla = row[1] ? row[1].trim() : "";
            const cantidad = parseInt(row[2]) || 0;
            
            if (lastEliminadasNorm !== "" && falla !== "" && cantidad > 0) {
                if (!datosDetalleFallas[lastEliminadasNorm]) {
                    datosDetalleFallas[lastEliminadasNorm] = [];
                }
                
                let existente = datosDetalleFallas[lastEliminadasNorm].find(f => f.tipo === falla);
                if (existente) {
                    existente.cantidad += cantidad;
                } else {
                    datosDetalleFallas[lastEliminadasNorm].push({ tipo: falla, cantidad: cantidad });
                }
            }
        }
    }

    // Procesar Detalle de Fallas (Mal Aprobadas)
    let headerAprobadas = csvFallasAprobadas[0] || [];
    let procesadorColIndex = -1;
    let fallaColIndex = -1;
    let contadorColIndex = -1;

    // Buscar Diccionario de Siglas si existe en las ultimas columnas
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
        if (col.includes("PROCESADOR") || col.includes("OPERADOR")) {
            procesadorColIndex = i;
        } else if (col.includes("DETALLE DE FALLAS") || col.includes("FALLAS DETECTADAS")) {
            fallaColIndex = i;
        } else if (col.includes("CONTADOR")) {
            contadorColIndex = i;
        }
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
                        lastAprobadasNorm = ""; // Si es total general, ignoramos
                    }
                }

                let siglaError = row[fallaColIndex] ? row[fallaColIndex].trim() : "";
                let cantidadFalla = 0;

                if (contadorColIndex !== -1 && row[contadorColIndex]) {
                    const cant = parseInt(row[contadorColIndex]);
                    if (!isNaN(cant)) {
                        cantidadFalla = cant;
                    }
                }
                
                if (lastAprobadasNorm !== "" && siglaError !== "" && !siglaError.includes("DETALLE DE FALLAS") && cantidadFalla > 0) {
                    let tipoErrorCompleto = diccionarioSiglas[siglaError] || siglaError;
                    
                    if (!datosDetalleFallasAprobadas[lastAprobadasNorm]) {
                        datosDetalleFallasAprobadas[lastAprobadasNorm] = {};
                    }
                    if (!datosDetalleFallasAprobadas[lastAprobadasNorm][tipoErrorCompleto]) {
                        datosDetalleFallasAprobadas[lastAprobadasNorm][tipoErrorCompleto] = 0;
                    }
                    datosDetalleFallasAprobadas[lastAprobadasNorm][tipoErrorCompleto] += cantidadFalla;
                    
                    if (!totalesFallasAprobadas[tipoErrorCompleto]) {
                        totalesFallasAprobadas[tipoErrorCompleto] = 0;
                    }
                    totalesFallasAprobadas[tipoErrorCompleto] += cantidadFalla;
                }
            }
        }
    }

    datosAprobadas = Object.keys(tempAprobadas).map(k => ({ nombreNorm: k, cantidad: tempAprobadas[k] }));
    datosEliminadas = Object.keys(tempEliminadas).map(k => ({ nombreNorm: k, cantidad: tempEliminadas[k] }));
}

function generarColores(cantidad) {
    const colores = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#E7E9ED', '#8AC926', '#1982C4', '#6A4C93'
    ];
    let result = [];
    for(let i=0; i<cantidad; i++) {
        result.push(colores[i % colores.length]);
    }
    return result;
}

function renderizarGraficos() {
    // 1. Gráfico Presunciones Mal Aprobadas
    const aprobadasSorted = [...datosAprobadas].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
    const labelsAprobadas = aprobadasSorted.map(d => nombresMap[d.nombreNorm] || d.nombreNorm);
    const dataAprobadas = aprobadasSorted.map(d => d.cantidad);

    const ctxAprobadas = document.getElementById('aprobadasChart').getContext('2d');
    
    const configAprobadas = {
        type: 'pie',
        data: {
            labels: labelsAprobadas,
            datasets: [{
                data: dataAprobadas,
                backgroundColor: generarColores(dataAprobadas.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
            }
        }
    };

    // 2. Gráfico Presunciones Mal Eliminadas
    const eliminadasSorted = [...datosEliminadas].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
    const labelsEliminadas = eliminadasSorted.map(d => nombresMap[d.nombreNorm] || d.nombreNorm);
    const dataEliminadas = eliminadasSorted.map(d => d.cantidad);

    const ctxEliminadas = document.getElementById('eliminadasChart').getContext('2d');
    
    const configEliminadas = {
        type: 'pie',
        data: {
            labels: labelsEliminadas,
            datasets: [{
                data: dataEliminadas,
                backgroundColor: generarColores(dataEliminadas.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
            }
        }
    };

    // 3. Gráfico Top 10 Fallas (Mal Aprobadas)
    let fallasArray = [];
    for (let f in totalesFallasAprobadas) {
        if(totalesFallasAprobadas[f] > 0) {
            fallasArray.push({ falla: f, cantidad: totalesFallasAprobadas[f] });
        }
    }
    fallasArray.sort((a, b) => b.cantidad - a.cantidad);
    const topFallas = fallasArray.slice(0, 10);

    const labelsFallas = topFallas.map(f => f.falla);
    const dataFallas = topFallas.map(f => f.cantidad);

    const ctxFallasAprobadas = document.getElementById('fallasAprobadasChart').getContext('2d');
    
    const configFallasAprobadas = {
        type: 'pie',
        data: {
            labels: labelsFallas,
            datasets: [{
                data: dataFallas,
                backgroundColor: generarColores(dataFallas.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } }
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
    const valorActual = select.value;
    select.innerHTML = '<option value="">-- Seleccione --</option>';

    let todosNombres = Object.keys(nombresMap);
    todosNombres.sort();

    todosNombres.forEach(norm => {
        const opt = document.createElement('option');
        opt.value = norm;
        opt.textContent = nombresMap[norm];
        select.appendChild(opt);
    });

    if (valorActual && nombresMap[valorActual]) {
        select.value = valorActual;
    }
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

    // Totales
    const dAprob = datosAprobadas.find(d => d.nombreNorm === norm);
    document.getElementById('statAprobadas').textContent = dAprob ? dAprob.cantidad : 0;
    
    const dElim = datosEliminadas.find(d => d.nombreNorm === norm);
    document.getElementById('statEliminadas').textContent = dElim ? dElim.cantidad : 0;

    // Obtener detalles de fallas
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

    // Llenar eliminadas
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

    // Llenar aprobadas
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
