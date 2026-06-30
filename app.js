// app.js

let canciones = JSON.parse(localStorage.getItem('setlist_canciones')) || [
    {
        id: 1,
        titulo: "Cheques",
        duracion: 240,
        letra: "Ella utiliza mis cheques de viajero...\n\n[pause=15]\n(Solo de Guitarra - Scroll Pausado)\n\nQuiero verla de nuevo."
    }
];

// Variables de estado del scroll
let scrollInterval = null;
let isScrolling = false;
let songDurationMs = 0;
let timeElapsed = 0; // Tiempo reproducido real en milisegundos
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
    activePauseRemaining = 0;
    pauseIndicator.classList.add('hidden');

    // Procesar la letra línea por línea buscando marcas de [pause=X]
    lyricsContent.innerHTML = '';
    const lineasRaw = cancion.letra.split('\n');
    
    lineasRaw.forEach(textoLinea => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        
        // Verificar si la línea es una marca de pausa, ej: [pause=12]
        const matchPausa = textoLinea.match(/\[pause=(\d+)\]/i);
        if (matchPausa) {
            const segundosPausa = parseInt(matchPausa[1]);
            div.classList.add('pause-marker');
            div.textContent = `⏱ PAUSA DE ${segundosPausa} SEGUNDOS`;
            div.dataset.pauseDuration = segundosPausa;
        } else {
            div.textContent = textoLinea || ' '; // Conservar renglones vacíos
        }
        lyricsContent.appendChild(div);
    });

    lyricsContainer.scrollTop = 0;
    stopAutoscroll();

    screenList.classList.add('hidden');
    screenLyrics.classList.remove('hidden');

    // Calcular mapeo de posiciones (darle un respiro al DOM para renderizar)
    setTimeout(() => {
        maxScrollTop = lyricsContainer.scrollHeight - lyricsContainer.clientHeight;
        mapearPosicionesLineas();
    }, 100);
}

function mapearPosicionesLineas() {
    linesWithPosition = [];
    const nodosLineas = lyricsContent.querySelectorAll('.lyric-line.pause-marker');
    nodosLineas.forEach(nodo => {
        linesWithPosition.push({
            offsetTop: nodo.offsetTop - 80, // Ajuste para que frene un poco antes del centro de la pantalla
            duration: parseInt(nodo.dataset.pauseDuration) * 1000,
            triggered: false
        });
    });
}

// 3. MOTOR DE SCROLL DINÁMICO CON AGREGADO DE TIEMPO
function autoScrollWorker(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Manejo del estado de pausa instrumental activa
    if (activePauseRemaining > 0) {
        activePauseRemaining -= delta;
        pauseCountdown.textContent = Math.ceil(activePauseRemaining / 1000);
        
        if (activePauseRemaining <= 0) {
            pauseIndicator.classList.add('hidden');
        }
        
        if (isScrolling) scrollInterval = requestAnimationFrame(autoScrollWorker);
        return;
    }

    // Avanzar reloj global de la canción
    timeElapsed += delta;
    const progresoCancion = Math.min(timeElapsed / songDurationMs, 1);
    
    // Mover Scroll
    const targetScroll = maxScrollTop * progresoCancion;
    lyricsContainer.scrollTop = targetScroll;

    // Verificar si cruzamos una marca de pausa instrumental
    const actualScrollPos = lyricsContainer.scrollTop;
    for (let pausa of linesWithPosition) {
        if (!pausa.triggered && actualScrollPos >= pausa.offsetTop) {
            pausa.triggered = true;
            activePauseRemaining = anisotropyFix(pausa.duration);
            pauseIndicator.classList.remove('hidden');
            pauseCountdown.textContent = Math.ceil(activePauseRemaining / 1000);
            break;
        }
    }

    // Continuar si la canción no terminó
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

init();