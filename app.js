// app.js

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log("Service Worker Registrado"));
}

// Datos de prueba (Luego se pueden cargar desde IndexedDB)
const canciones = [
    {
        id: 1,
        titulo: "Peor para el Sol",
        duracion: 280, // en segundos (4:40)
        letra: "En un cruce de olvidos un taxi paró...\n(Acá va toda tu letra)\n\nOtra estrofa más...\n\nY el final de la canción."
    },
    {
        id: 2,
        titulo: "Peces de Ciudad",
        duracion: 300, // 5:00
        letra: "Se peinaba a lo garçon en un espejo roto...\n\n(Más letra para probar el scroll)..."
    }
];

// Variables de estado del scroll
let scrollInterval = null;
let startTime = null;
let startScrollTop = 0;
let totalScrollDistance = 0;
let songDurationMs = 0;
let isScrolling = false;

// Elementos del DOM
const screenList = document.getElementById('screen-list');
const screenLyrics = document.getElementById('screen-lyrics');
const setlistContainer = document.getElementById('setlist-container');
const lyricsContainer = document.getElementById('lyrics-container');
const lyricsText = document.getElementById('lyrics-text');
const songTitle = document.getElementById('song-title');

const btnBack = document.getElementById('btn-back');
const btnPlay = document.getElementById('btn-play-scroll');
const btnReset = document.getElementById('btn-reset-scroll');

// Renderizar la lista
function init() {
    setlistContainer.innerHTML = '';
    canciones.forEach(cancion => {
        const minutes = Math.floor(cancion.duracion / 60);
        const seconds = cancion.duracion % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const li = document.createElement('li');
        li.innerHTML = `<span>${cancion.titulo}</span> <span class="duration-tag">${timeStr}</span>`;
        li.addEventListener('click', () => cargarCancion(cancion));
        setlistContainer.appendChild(li);
    });
}

function cargarCancion(cancion) {
    songTitle.textContent = cancion.titulo;
    lyricsText.textContent = cancion.letra;
    songDurationMs = cancion.duracion * 1000;
    
    // Resetear contenedor de scroll a la parte superior
    lyricsContainer.scrollTop = 0;
    stopAutoscroll();

    // Cambiar pantalla
    screenList.classList.add('hidden');
    screenLyrics.classList.remove('hidden');
}

// Algoritmo de Autoscroll Fluido
function autoScrollWorker(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    // Calcular la posición actual basada en el tiempo transcurrido
    const progress = Math.min(elapsed / songDurationMs, 1);
    lyricsContainer.scrollTop = startScrollTop + (totalScrollDistance * progress);

    if (progress < 1 && isScrolling) {
        scrollInterval = requestAnimationFrame(autoScrollWorker);
    } else {
        stopAutoscroll();
    }
}

function startAutoscroll() {
    isScrolling = true;
    btnPlay.textContent = "⏸ Pausar Scroll";
    btnPlay.style.backgroundColor = "#e65100";
    
    startTime = null; // Reiniciar tiempo de referencia
    startScrollTop = lyricsContainer.scrollTop;
    
    // Distancia que falta recorrer
    totalScrollDistance = lyricsContainer.scrollHeight - lyricsContainer.clientHeight - startScrollTop;
    
    // Si ya está al final, no hace nada
    if (totalScrollDistance <= 0) return;

    scrollInterval = requestAnimationFrame(autoScrollWorker);
}

function stopAutoscroll() {
    isScrolling = false;
    btnPlay.textContent = "▶ Iniciar Scroll";
    btnPlay.style.backgroundColor = "#2e7d32";
    cancelAnimationFrame(scrollInterval);
}

// Eventos
btnPlay.addEventListener('click', () => {
    if (isScrolling) {
        stopAutoscroll();
    } else {
        startAutoscroll();
    }
});

btnReset.addEventListener('click', () => {
    stopAutoscroll();
    lyricsContainer.scrollTop = 0;
});

btnBack.addEventListener('click', () => {
    stopAutoscroll();
    screenLyrics.classList.add('hidden');
    screenList.classList.remove('hidden');
});

// Inicializar
init();