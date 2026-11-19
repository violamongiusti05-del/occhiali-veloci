// galleria.js – la galleria con tutte le viste degli occhiali.
// Le immagini non sono foto: le "scattiamo" dal modello 3D una volta sola,
// con una telecamera messa in ogni punto di VISTE. Clic su una vista = si apre in grande.

import * as THREE from 'three';
import { gsap } from './animazioni.js';
import { preparaScena, caricaOcchiali } from './modello.js';

// ===== le viste =====
// pos = dove sta la telecamera, guarda = il punto che inquadra.
// Gli occhiali sono larghi 2,4, centrati in 0,0,0, con le lenti verso +z.
const VISTE = [
    { nome: 'Fronte',     pos: [0, 0.1, 4.8],     guarda: [0, 0, 0] },
    { nome: 'Tre quarti', pos: [3.2, 1.3, 3.6],   guarda: [0, 0, -0.2] },
    { nome: 'Lato',       pos: [5.2, 0.2, -0.3],  guarda: [0, 0, -0.3] },
    { nome: 'Dietro',     pos: [0, 0.5, -4.8],    guarda: [0, 0, 0] },
    { nome: 'Dall\'alto', pos: [0, 5, 0.8],       guarda: [0, 0, -0.2] },
    { nome: 'Da sotto',   pos: [0, -4.8, 0.8],    guarda: [0, 0, -0.2] },
    { nome: 'Cerniera',   pos: [-1.9, 0.4, 1.5],  guarda: [-1, 0, 0] },
    { nome: 'Lente',      pos: [0.9, 0.2, 2.4],   guarda: [0.55, 0, 0] }
];

// grandezza delle immagini (3:2): abbastanza grandi per la vista ingrandita
const LARGHEZZA = 1500, ALTEZZA = 1000;


// ===== le schede della galleria (vuote finché le immagini non sono pronte) =====
const griglia = document.querySelector('.galleria-griglia');

const schede = VISTE.map(function(vista, i) {
    const scheda = document.createElement('button');
    scheda.className = 'galleria-voce in-caricamento';
    scheda.innerHTML = '<span class="galleria-cornice"><img alt=""></span>' +
                       '<span class="galleria-nome"><span class="galleria-numero">' +
                       String(i + 1).padStart(2, '0') + '</span> ' + vista.nome + '</span>';
    scheda.querySelector('img').alt = 'Occhiali veloci – vista ' + vista.nome;
    scheda.addEventListener('click', function() { apri(i); });
    griglia.appendChild(scheda);
    return scheda;
});

// le schede entrano una dopo l'altra quando la galleria arriva sullo schermo
gsap.from(schede, {
    y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08,
    scrollTrigger: { trigger: griglia, start: 'top 85%' }
});


// ===== gli "scatti" dal modello 3D =====
caricaOcchiali().then(function({ modello }) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(LARGHEZZA, ALTEZZA, false);

    const scena = new THREE.Scene();
    preparaScena(scena, renderer);
    scena.add(modello);

    const camera = new THREE.PerspectiveCamera(35, LARGHEZZA / ALTEZZA, 0.1, 100);

    VISTE.forEach(function(vista, i) {
        camera.position.fromArray(vista.pos);
        camera.lookAt(new THREE.Vector3().fromArray(vista.guarda));
        renderer.render(scena, camera);
        vista.immagine = renderer.domElement.toDataURL('image/jpeg', 0.92);
        schede[i].querySelector('img').src = vista.immagine;
        schede[i].classList.remove('in-caricamento');
    });

    // finito: il renderer non serve più, liberiamo la scheda video
    renderer.dispose();
    renderer.forceContextLoss();
}).catch(function(errore) {
    console.error(errore);
});


// ===== la vista ingrandita (lightbox) =====
const finestra = document.querySelector('.galleria-finestra');
const finestraImmagine = finestra.querySelector('.finestra-immagine');
const finestraNome = finestra.querySelector('.finestra-nome');
let attuale = 0;

function mostra(i) {
    attuale = (i + VISTE.length) % VISTE.length; // dopo l'ultima torna alla prima
    const vista = VISTE[attuale];
    if (vista.immagine) finestraImmagine.src = vista.immagine;
    finestraImmagine.alt = 'Occhiali veloci – vista ' + vista.nome;
    finestraNome.textContent = String(attuale + 1).padStart(2, '0') + ' / ' +
                               String(VISTE.length).padStart(2, '0') + ' — ' + vista.nome;
    gsap.fromTo(finestraImmagine, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' });
}

function apri(i) {
    finestra.showModal();
    gsap.fromTo(finestra, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    mostra(i);
}

function chiudi() {
    gsap.to(finestra, { opacity: 0, duration: 0.25, onComplete: function() { finestra.close(); } });
}

finestra.querySelector('.finestra-chiudi').addEventListener('click', chiudi);
finestra.querySelector('.finestra-prima').addEventListener('click', function() { mostra(attuale - 1); });
finestra.querySelector('.finestra-dopo').addEventListener('click', function() { mostra(attuale + 1); });

// clic sullo sfondo scuro = chiudi
finestra.addEventListener('click', function(e) { if (e.target === finestra) chiudi(); });

// tastiera: frecce per scorrere
finestra.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowLeft') mostra(attuale - 1);
    if (e.key === 'ArrowRight') mostra(attuale + 1);
});

// Esc: il browser chiuderebbe subito la finestra, noi la chiudiamo con l'animazione
finestra.addEventListener('cancel', function(e) {
    e.preventDefault();
    chiudi();
});
