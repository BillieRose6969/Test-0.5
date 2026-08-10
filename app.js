// Configuración
const urlAprobadas = "https://docs.google.com/spreadsheets/d/1msmEunitlatAq01F338OOc-iW5RSbSL-fTtXeHk9AXg/gviz/tq?tqx=out:csv&sheet=TOTAL%20PARCIAL";
const urlEliminadas = "https://docs.google.com/spreadsheets/d/100OcdQ6iZ83TxJVidgTWZkrQTbFSZhmaY8yBk48s78o/gviz/tq?tqx=out:csv&sheet=Resumen%20de%20Errores";
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutos en milisegundos

const urlDetalleFallas = "https://docs.google.com/spreadsheets/d/100OcdQ6iZ83TxJVidgTWZkrQTbFSZhmaY8yBk48s78o/gviz/tq?tqx=out:csv&sheet=Detalle%20de%20Fallas%20por%20Procesador";

// Variables globales para guardar los datos
let datosAprobadas = []; // Ahora guardará: { nombreNormalizado, nombreOriginal, cantidad }
let datosEliminadas = [];
let datosDetalleFallas = {}; // key: nombreNormalizado, value: [{tipo, cantidad}]
let nombresMap = {}; // key: nombreNormalizado, value: nombreOriginal (para mostrar)
let chartAprobadas = null;
let chartEliminadas = null;

// Funciones de normalización de nombres
function normalizarNombre(nombre) {
    if (!nombre) return "";
    
    // 1. Quitar guiones iniciales, puntos y comas, convertir a minúsculas
    let norm = nombre.replace(/^[-]+/, '').replace(/[.,]/g, ' ').trim().toLowerCase();
    
    // 2. Separar en palabras
    let palabras = norm.split(/\s+/).filter(p => p.length > 0);
    
    // 3. Ordenar alfabéticamente las palabras. 
    // Esto hace que "Castrilli Alan" y "ALAN CASTRILLI" se conviertan en "alan castrilli"
    palabras.sort();
    
    return palabras.join(" ");
}

function registrarNombreOriginal(nombreNormalizado, nombreOriginal) {
    if (!nombresMap[nombreNormalizado]) {
        // Guardar el primer nombre original que encontramos como el "representativo"
        // Le quitamos el guion inicial si lo tiene para que se vea mejor
        nombresMap[nombreNormalizado] = nombreOriginal.replace(/^[-]+/, '').trim();
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
    
    // Configurar actualización automática
    setInterval(cargarDatos, REFRESH_INTERVAL);

    // Configurar evento del select
    document.getElementById('procesadorSelect').addEventListener('change', actualizarDetalles);
});

async function cargarDatos() {
    try {
        console.log("Cargando datos...");
        
        // Cargar todos los CSV en paralelo usando PapaParse
        const [resAprobadas, resEliminadas, resFallas] = await Promise.all([
            fetchCSV(urlAprobadas),
            fetchCSV(urlEliminadas),
            fetchCSV(urlDetalleFallas)
        ]);

        procesarDatos(resAprobadas, resEliminadas, resFallas);
        renderizarGraficos();
        actualizarSelect();
        
        // Si hay uno seleccionado, actualizar su vista
        actualizarDetalles();
        
    } catch (error) {
        console.error("Error al cargar los datos:", error);
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

function procesarDatos(csvAprobadas, csvEliminadas, csvFallas) {
    let tempAprobadas = {};
    let tempEliminadas = {};
    datosDetalleFallas = {};
    nombresMap = {};

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
    // Formato: Fila 0 -> "Procesador", "Tipo de Error (Unificado)", "Cantidad de Veces"
    let lastProcesadorNorm = "";
    
    for (let i = 1; i < csvFallas.length; i++) {
        const row = csvFallas[i];
        if (!row || row.length < 2) continue;

        let procesadorCell = row[0] ? row[0].trim() : "";
        
        // Si hay procesador en esta fila, actualizar el último visto
        if (procesadorCell !== "") {
            lastProcesadorNorm = normalizarNombre(procesadorCell);
            registrarNombreOriginal(lastProcesadorNorm, procesadorCell);
        }

        // Si tenemos un procesador activo y un tipo de error
        const tipoError = row[1] ? row[1].trim() : "";
        if (lastProcesadorNorm !== "" && tipoError !== "") {
            const cantidad = parseInt(row[2]) || 0;

            if (!datosDetalleFallas[lastProcesadorNorm]) {
                datosDetalleFallas[lastProcesadorNorm] = [];
            }
            
            // Buscar si ya existe este tipo de error para sumarlo (por si acaso hay repetidos)
            let existente = datosDetalleFallas[lastProcesadorNorm].find(f => f.tipo === tipoError);
            if (existente) {
                existente.cantidad += cantidad;
            } else {
                datosDetalleFallas[lastProcesadorNorm].push({ tipo: tipoError, cantidad: cantidad });
            }
        }
    }
}

function renderizarGraficos() {
    // Top 10 Aprobadas
    const topAprobadas = [...datosAprobadas].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
    
    // Top 10 Eliminadas
    const topEliminadas = [...datosEliminadas].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);

    // Preparar datos para Chart.js
    const ctxAprobadas = document.getElementById('aprobadasChart').getContext('2d');
    const ctxEliminadas = document.getElementById('eliminadasChart').getContext('2d');

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

    if (chartAprobadas) chartAprobadas.destroy();
    if (chartEliminadas) chartEliminadas.destroy();

    chartAprobadas = new Chart(ctxAprobadas, configAprobadas);
    chartEliminadas = new Chart(ctxEliminadas, configEliminadas);
}

function actualizarSelect() {
    const select = document.getElementById('procesadorSelect');
    const valorActualNorm = select.value; // Ahora guardamos el nombreNormalizado como value
    
    // Obtener todos los nombres normalizados únicos y ordenarlos por el nombre original (mostrar)
    const normalizados = Object.keys(nombresMap).sort((a, b) => {
        return nombresMap[a].localeCompare(nombresMap[b]);
    });

    // Reconstruir opciones
    select.innerHTML = '<option value="">-- Seleccione --</option>';
    normalizados.forEach(norm => {
        const option = document.createElement('option');
        option.value = norm; // Key = nombreNormalizado
        option.textContent = nombresMap[norm]; // Text = nombreOriginal
        select.appendChild(option);
    });

    // Restaurar selección si existe
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
    const fallasContainer = document.getElementById('fallasContainer');
    const fallasList = document.getElementById('fallasList');

    const norm = select.value;

    if (!norm) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    nameEl.textContent = nombresMap[norm]; // Mostrar el nombre original

    // Buscar en los arrays consolidados
    const dataAprobada = datosAprobadas.find(d => d.nombreNormalizado === norm);
    const dataEliminada = datosEliminadas.find(d => d.nombreNormalizado === norm);

    statAprobadasEl.textContent = dataAprobada ? dataAprobada.cantidad : '0';
    statEliminadasEl.textContent = dataEliminada ? dataEliminada.cantidad : '0';

    // Actualizar Detalle de Fallas
    const fallas = datosDetalleFallas[norm];
    if (fallas && fallas.length > 0) {
        fallasContainer.style.display = 'block';
        fallasList.innerHTML = ''; // Limpiar lista
        
        // Ordenar fallas de mayor a menor cantidad
        fallas.sort((a, b) => b.cantidad - a.cantidad);

        fallas.forEach(f => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="falla-tipo">${f.tipo}</span>
                <span class="falla-cantidad">${f.cantidad}</span>
            `;
            fallasList.appendChild(li);
        });
    } else {
        fallasContainer.style.display = 'none';
    }
}

function generarColores(cantidad) {
    const colores = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#E7E9ED', '#8AC926', '#1982C4', '#6A4C93'
    ];
    // Repetir o extender si es necesario, pero maximo son 10 en top10
    return colores.slice(0, cantidad);
}