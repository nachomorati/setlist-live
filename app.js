// app.js

// 1. Intentar cargar canciones desde localStorage; si no hay, usar unas por defecto
let canciones = JSON.parse(localStorage.getItem('setlist_canciones')) || [
    {
        id: 1,
        titulo: "Peor para el Sol",
        duracion: 240,
        letra: "En un cruce de olvidos un taxi paró...\n\nLetra de prueba para el vivo."
    }
];

// Variables de control
let currentSongId = null;
let scrollInterval = null;
let startTime = null;
let startScrollTop = 0;
let totalScrollDistance = 0;
let songDurationMs = 0;
let isScrolling = false;

// Elementos del DOM
const screenList = document.getElementById('screen-list');
const screenLyrics = document.getElementById('screen-lyrics');
const screenForm = document.getElementById('screen-form');

const setlistContainer = document.getElementById('setlist-container');
const lyricsContainer = document.getElementById('lyrics-container');
const lyricsText = document.getElementById('lyrics-text');
const songTitle = document.getElementById('song-title');

// Botones y Formularios
const btnAddSong = document.getElementById('btn-add-song');
const btnEditSong = document.getElementById('btn-edit-song');
const btnBack = document.getElementById('btn-back');
const btnCancelForm = document.getElementById('btn-cancel-form');
const songForm = document.getElementById('song-form');
const btnPlay = document.getElementById('btn-play-scroll');
const btnReset = document.getElementById('btn-reset-scroll');

// Inputs del formulario
const formId = document.getElementById('form-id');
const formTitulo = document.getElementById('form-titulo');
const formDuracion = document.getElementById('form-duracion');
const formLetra = document.getElementById('form-letra');
const formTitleHead = document.getElementById('form-title');

// GUARDAR EN STORAGE
function guardarEnStorage() {
    localStorage.setItem('setlist_canciones', JSON.stringify(canciones));
}

// RENDERIZAR LISTA
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
    currentSongId = cancion.id;
    songTitle.textContent = cancion.titulo;
    lyricsText.textContent = cancion.letra;
    songDurationMs = cancion.duracion * 1000;
    
    lyricsContainer.scrollTop = 0;
    stopAutoscroll();

    screenList.classList.add('hidden');
    screenLyrics.classList.remove('hidden');
}

// LÓGICA DE AUTOSCROLL (Misma anterior)
function autoScrollWorker(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
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
    startTime = null;
    startScrollTop = lyricsContainer.scrollTop;
    totalScrollDistance = lyricsContainer.scrollHeight - lyricsContainer.clientHeight - startScrollTop;
    if (totalScrollDistance <= 0) return;
    scrollInterval = requestAnimationFrame(autoScrollWorker);
}

function stopAutoscroll() {
    isScrolling = false;
    btnPlay.textContent = "▶ Iniciar Scroll";
    btnPlay.style.backgroundColor = "#2e7d32";
    cancelAnimationFrame(scrollInterval);
}

// EVENTOS DE NAVEGACIÓN Y FORMULARIO

// Abrir formulario para Nueva Canción
btnAddSong.addEventListener('click', () => {
    formTitleHead.textContent = "Agregar Canción";
    formId.value = "";
    songForm.reset();
    screenList.classList.add('hidden');
    screenForm.remove('hidden');
});

// Abrir formulario para Editar la Canción actual
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

// Cancelar Formulario
btnCancelForm.addEventListener('click', () => {
    screenForm.classList.add('hidden');
    if (formId.value) {
        screenLyrics.classList.remove('hidden'); // Volver a la letra si editaba
    } else {
        screenList.classList.remove('hidden'); // Volver a la lista si agregaba
    }
});

// Procesar Guardado (Agregar o Editar)
songForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = formId.value;
    const nuevaCancion = {
        id: id ? parseInt(id) : Date.now(), // Si es nuevo, usamos el timestamp como ID único
        titulo: formTitulo.value,
        duracion: parseInt(formDuracion.value),
        letra: formLetra.value
    };

    if (id) {
        // Modo Edición: Reemplazar en el array
        canciones = canciones.map(c => c.id === parseInt(id) ? nuevaCancion : c);
    } else {
        // Modo Nuevo: Sumar al array
        canciones.push(nuevaCancion);
    }

    guardarEnStorage();
    init(); // Refrescar lista visual

    // Volver a la pantalla correspondiente
    screenForm.classList.add('hidden');
    if (id) {
        cargarCancion(nuevaCancion); // Ver el tema editado
    } else {
        screenList.classList.remove('hidden'); // Volver al setlist general
    }
});

// Controles de reproducción de letra
btnPlay.addEventListener('click', () => { isScrolling ? stopAutoscroll() : startAutoscroll(); });
btnReset.addEventListener('click', () => { stopAutoscroll(); lyricsContainer.scrollTop = 0; });
btnBack.addEventListener('click', () => { stopAutoscroll(); screenLyrics.classList.add('hidden'); screenList.classList.remove('hidden'); });

// Service Worker (Opcional Local)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => console.log("SW OK")).catch(err => console.log(err));
}

init();
