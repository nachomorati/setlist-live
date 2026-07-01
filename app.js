// app.js

let canciones = JSON.parse(localStorage.getItem('setlist_canciones')) || [
    {
        id: 1,
        titulo: "Un pacto (muestra)",
        duracion: 240,
        letra: "Un pacto para vivir\nOdiándonos sol a sol\nRevolviendo más\nEn los restos de un amor\nCon un camino recto\nA la desesperación\nDesenlace en un cuento de terror\n\nSeis años así\nEscapando a un mismo lugar\nCon mi fantasía Buscando otro cuerpo, otra voz Fui consumiendo infiernos Para salir de vos Intoxicado, loco y sin humor"
    }
];

// Variables de estado del scroll
let currentSongId = null;
let scrollInterval = null;
let isScrolling = false;
let songDurationMs = 0;
let timeElapsed = 0; 
let lastTimestamp = null;
let maxScrollTop = 0;

// Variables de manejo de pausas instrumentales incorporadas
let activePauseRemaining = 0;
let linesWithPosition = [];

// Elementos del DOM
const screenList = document.getElementById('screen-list');
const screenLyrics = document.getElementById('screen-lyrics');
const screenForm = document.getElementById('screen-form');
const setlistContainer = document.getElementById('setlist-container');
const lyricsContainer = document.getElementById('lyrics-container');
const lyricsContent = document.getElementById('lyrics-content');
const songTitle = document.getElementById('song-title');
const pauseIndicator = document.getElementById('pause-indicator');
const pauseCountdown = document.getElementById('pause-countdown');

// Botones y Controles
const btnAddSong = document.getElementById('btn-add-song');
const btnEditSong = document.getElementById('btn-edit-song');
const btnBack = document.getElementById('btn-back');
const btnCancelForm = document.getElementById('btn-cancel-form');
const songForm = document.getElementById('song-form');
const btnPlay = document.getElementById('btn-play-scroll');
const btnReset = document.getElementById('btn-reset-scroll');

const formId = document.getElementById('form-id');
const formTitulo = document.getElementById('form-titulo');
const formDuracion = document.getElementById('form-duracion');
const formLetra = document.getElementById('form-letra');
const formTitleHead = document.getElementById('form-title');

function guardarEnStorage() {
    localStorage.setItem('setlist_canciones', JSON.stringify(canciones));
}

// 1. RENDERIZAR LISTA CON DRAG & DROP NATIVO
function init() {
    setlistContainer.innerHTML = '';
    canciones.forEach((cancion, index) => {
        const minutes = Math.floor(cancion.duracion / 60);
        const seconds = cancion.duracion % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const li = document.createElement('li');
        li.id = `song-${cancion.id}`;
        li.setAttribute('draggable', true);
        li.innerHTML = `<span>☰ &nbsp; ${cancion.titulo}</span> <span class="duration-tag">${timeStr}</span>`;
        
        // Click para abrir canción
        li.addEventListener('click', (e) => {
            if (!li.classList.contains('dragging')) {
                cargarCancion(cancion);
            }
        });

        // Eventos Drag and Drop
        li.addEventListener('dragstart', () => li.classList.add('dragging'));
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            guardarNuevoOrden();
        });

        setlistContainer.appendChild(li);
    });
}

// Lógica para detectar dónde se suelta el elemento arrastrado
setlistContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(setlistContainer, e.clientY);
    const draggingElement = document.querySelector('.dragging');
    if (afterElement == null) {
        setlistContainer.appendChild(draggingElement);
    } else {
        setlistContainer.insertBefore(draggingElement, afterElement);
    }
});

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function guardarNuevoOrden() {
    const listItems = [...setlistContainer.querySelectorAll('li')];
    const nuevoOrdenIds = listItems.map(item => parseInt(item.id.replace('song-', '')));
    
    // Reordenar el array principal basándose en el DOM
    canciones = nuevoOrdenIds.map(id => canciones.find(c => c.id === id));
    guardarEnStorage();
}

// 2. PROCESAR LETRA E INYECTAR PAUSAS
function cargarCancion(cancion) {
    currentSongId = cancion.id;
    songTitle.textContent = cancion.titulo;
    songDurationMs = cancion.duracion * 1000;
    timeElapsed = 0;
    lastTimestamp = null; 
    activePauseRemaining = 0;
    pauseIndicator.classList.add('hidden');

    // Procesar la letra línea por línea
    lyricsContent.innerHTML = '';
    const lineasRaw = cancion.letra.split('\n');
    
    lineasRaw.forEach(textoLinea => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        
        const matchPausa = textoLinea.match(/\[pause=(\d+)\]/i);
        if (matchPausa) {
            const segundosPausa = parseInt(matchPausa[1]);
            div.classList.add('pause-marker');
            div.textContent = `⏱ PAUSA DE ${segundosPausa} SEGUNDOS`;
            div.dataset.pauseDuration = segundosPausa;
        } else {
            div.textContent = textoLinea || ' ';
        }
        lyricsContent.appendChild(div);
    });

    stopAutoscroll();

    // Cambiamos primero la visibilidad de las pantallas...
    screenList.classList.add('hidden');
    screenLyrics.classList.remove('hidden');

    // 🔥 SOLUCIÓN AL DETALLE 2: Forzamos el reset del scroll acá, 
    // con la pantalla ya visible para que el navegador responda sí o sí
    lyricsContainer.scrollTop = 0;

    // Aplicamos los estilos directos anti-caché
    lyricsContent.style.fontSize = "2.6rem";
    lyricsContent.style.lineHeight = "1.7";
    lyricsContent.style.paddingBottom = "80vh";

    setTimeout(() => {
        maxScrollTop = lyricsContainer.scrollHeight - lyricsContainer.clientHeight;
        mapearPosicionesLineas();
        // Doble reaseguro por si el renderizado tardó un milisegundo
        lyricsContainer.scrollTop = 0;
    }, 100);
}

function mapearPosicionesLineas() {
    linesWithPosition = [];
    // Buscamos todas las marcas de pausa que están renderizadas en pantalla
    const nodosLineas = lyricsContent.querySelectorAll('.lyric-line.pause-marker');
    nodosLineas.forEach(nodo => {
        linesWithPosition.push({
            elemento: nodo, // Guardamos la referencia directa al elemento del DOM
            duration: parseInt(nodo.dataset.pauseDuration) * 1000,
            triggered: false
        });
    });
}

function autoScrollWorker(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Manejo de la pausa instrumental activa
    if (activePauseRemaining > 0) {
        activePauseRemaining -= delta;
        pauseCountdown.textContent = Math.ceil(activePauseRemaining / 1000);
        
        if (activePauseRemaining <= 0) {
            pauseIndicator.classList.add('hidden');
        }
        
        if (isScrolling) scrollInterval = requestAnimationFrame(autoScrollWorker);
        return;
    }

    // Avanzar el tiempo real de la canción
    timeElapsed += delta;
    const progresoCancion = Math.min(timeElapsed / songDurationMs, 1);
    
    const scrollMaximo = maxScrollTop > 0 ? maxScrollTop : (lyricsContainer.scrollHeight - lyricsContainer.clientHeight);
    
    // Mover el contenedor de la letra
    const targetScroll = scrollMaximo * progresoCancion;
    
    // REFUERZO DE SCROLL: Forzamos el movimiento en ambos contenedores por si acaso
    lyricsContainer.scrollTop = targetScroll;
    lyricsContent.scrollTop = targetScroll; // <--- Línea de seguridad para el Flexbox

    // Obtener la posición del borde superior de la caja de letras
    const contenedorTop = lyricsContainer.getBoundingClientRect().top;

    if (timeElapsed > 200) {
        for (let pausa of linesWithPosition) {
            if (!pausa.triggered) {
                const marcaTop = pausa.elemento.getBoundingClientRect().top;
                
                // Si la marca cruza o toca el techo del contenedor
                if (marcaTop <= contenedorTop + 5) { 
                    pausa.triggered = true;
                    activePauseRemaining = pausa.duration;
                    pauseIndicator.classList.remove('hidden');
                    pauseCountdown.textContent = Math.ceil(activePauseRemaining / 1000);
                    break; 
                }
            }
        }
    }

    if (progresoCancion < 1 && isScrolling) {
        scrollInterval = requestAnimationFrame(autoScrollWorker);
    } else if (progresoCancion >= 1) {
        stopAutoscroll();
    }
}

function anisotropyFix(duration) {
    // Pequeño parche para compensar la fluidez del refresco de pantalla
    return duration > 0 ? duration : 0;
}

function startAutoscroll() {
    maxScrollTop = lyricsContainer.scrollHeight - lyricsContainer.clientHeight;
    
    // Sincronizar el reloj si moviste la letra con el dedo
    if (lyricsContainer.scrollTop > 0 && maxScrollTop > 0) {
        const posicionActual = lyricsContainer.scrollTop;
        const porcentajeLeido = posicionActual / maxScrollTop;
        
        timeElapsed = songDurationMs * porcentajeLeido;
    }

    mapearPosicionesLineas();

    // 🔥 SOLUCIÓN AL DETALLE 1: Saltar automáticamente las pausas instrumentales pasadas
    const contenedorTop = lyricsContainer.getBoundingClientRect().top;
    linesWithPosition.forEach(p => {
        if (p.elemento) {
            const marcaTop = p.elemento.getBoundingClientRect().top;
            // Si la marca de pausa ya está por encima del techo actual del contenedor, la quemamos
            if (marcaTop < contenedorTop) {
                p.triggered = true;
            }
        }
    });

    isScrolling = true;
    btnPlay.textContent = "⏸ Pausar Scroll";
    btnPlay.style.backgroundColor = "#e65100";
    lastTimestamp = null; 
    scrollInterval = requestAnimationFrame(autoScrollWorker);
}

function stopAutoscroll() {
    isScrolling = false;
    btnPlay.textContent = "▶ Iniciar Scroll";
    btnPlay.style.backgroundColor = "#2e7d32";
    cancelAnimationFrame(scrollInterval);
}

// EVENTOS DE BOTONES Y RUTEOS
btnAddSong.addEventListener('click', () => {
    formTitleHead.textContent = "Agregar Canción";
    formId.value = "";
    songForm.reset();
    screenList.classList.add('hidden');
    screenForm.classList.remove('hidden');
});

btnEditSong.addEventListener('click', () => {
    const cancion = canciones.find(c => c.id === currentSongId);
    if (!cancion) return;
    formTitleHead.textContent = "Editar Canción";
    formId.value = cancion.id;
    formTitulo.value = cancion.titulo;
    formDuracion.value = cancion.duracion;
    formLetra.value = cancion.letra;
    screenLyrics.classList.add('hidden');
    screenForm.classList.remove('hidden');
});

btnCancelForm.addEventListener('click', () => {
    screenForm.classList.add('hidden');
    formId.value ? screenLyrics.classList.remove('hidden') : screenList.classList.remove('hidden');
});

songForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = formId.value;
    const nuevaCancion = {
        id: id ? parseInt(id) : Date.now(),
        titulo: formTitulo.value,
        duracion: parseInt(formDuracion.value),
        letra: formLetra.value
    };

    if (id) {
        canciones = canciones.map(c => c.id === parseInt(id) ? nuevaCancion : c);
    } else {
        canciones.push(nuevaCancion);
    }

    guardarEnStorage();
    init();
    screenForm.classList.add('hidden');
    id ? cargarCancion(nuevaCancion) : screenList.classList.remove('hidden');
});

btnPlay.addEventListener('click', () => { isScrolling ? stopAutoscroll() : startAutoscroll(); });
btnReset.addEventListener('click', () => {
    stopAutoscroll();
    timeElapsed = 0;
    activePauseRemaining = 0;
    pauseIndicator.classList.add('hidden');
    linesWithPosition.forEach(p => p.triggered = false);
    lyricsContainer.scrollTop = 0;
});
btnBack.addEventListener('click', () => { stopAutoscroll(); screenLyrics.classList.add('hidden'); screenList.classList.remove('hidden'); });

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
}

// --- SISTEMA DE SINCRONIZACIÓN EXPORTAR/IMPORTAR ---

const btnExport = document.getElementById('btn-export');
const inputImport = document.getElementById('input-import');

// Exportar como .txt
btnExport.addEventListener('click', () => {
    if (canciones.length === 0) {
        alert("No hay canciones para exportar.");
        return;
    }
    
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(canciones));
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "setlist_oficial.txt"); // <--- Ahora es .txt
    document.body.appendChild(downloadAnchor);
    
    downloadAnchor.click();
    downloadAnchor.remove();
});

// Importar desde .txt
inputImport.addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = function(evento) {
        try {
            const cancionesImportadas = JSON.parse(evento.target.result);
            
            if (Array.isArray(cancionesImportadas)) {
                if (confirm(`¿Querés reemplazar tu lista actual por las ${cancionesImportadas.length} canciones del archivo?`)) {
                    canciones = cancionesImportadas;
                    guardarEnStorage();
                    init();
                    alert("¡Setlist actualizado con éxito para el vivo!");
                }
            } else {
                alert("El archivo no tiene el formato de setlist correcto.");
            }
        } catch (error) {
            alert("Error al leer el archivo. Asegurate de que sea el .txt correcto.");
        }
    };
    lector.readAsText(archivo);
});

init();
