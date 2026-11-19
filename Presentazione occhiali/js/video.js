// video.js – il "video" degli occhiali finiti.
// Non usiamo un file video: riprendiamo il modello 3D con una telecamera che
// segue una sequenza di inquadrature (SEQUENZA qui sotto), in loop, come un breve spot.
// Il movimento lo fa una timeline di GSAP (vedi animazioni.js), che gira in loop
// a tutta larghezza; un clic sull'animazione la mette in pausa.
// Con "Scarica video" la stessa sequenza viene registrata e salvata come file .webm.

import * as THREE from 'three';
import { gsap, sequenzaCamera, entraModello, quandoVisibile, entraTesti } from './animazioni.js';
import { preparaScena, caricaOcchiali } from './modello.js';

// ===== la sequenza delle inquadrature =====
// ogni tappa: quando arriva (in secondi), dove sta la telecamera, dove guarda e la didascalia.
// Si può aggiungere "andatura" (un ease di GSAP, es. 'expo.out') per cambiare il movimento.
// Gli occhiali sono larghi 2,4 e guardano verso +z (le lenti verso di noi).
const SEQUENZA = [
    { t: 0,    pos: [0, 0.3, 7.5],    guarda: [0, 0, 0],    testo: '' },
    { t: 2.5,  pos: [0, 0.15, 4.2],   guarda: [0, 0, 0],    testo: 'Il fronte' },
    { t: 5.5,  pos: [4, 0.8, 1.2],    guarda: [0, 0, -0.3], testo: 'Il profilo' },
    { t: 8.5,  pos: [0.4, 4.2, 0.6],  guarda: [0, 0, 0],    testo: 'Dall\'alto' },
    { t: 11.5, pos: [-1.6, 0.3, 1.6], guarda: [-0.9, 0, 0], testo: 'Il dettaglio della cerniera' },
    { t: 14.5, pos: [-3.2, 1.4, 4.5], guarda: [0, 0, 0],    testo: 'Occhiali veloci' },
    { t: 17,   pos: [0, 0.3, 7.5],    guarda: [0, 0, 0],    testo: '' } // = la prima: il loop riparte senza salti
];
const DURATA = SEQUENZA[SEQUENZA.length - 1].t;


// ===== gli elementi della pagina =====
const video = document.getElementById('video-occhiali');
const segnaposto = video.querySelector('.video-segnaposto');
const didascalia = video.querySelector('.video-didascalia');
const bottoneScarica = video.querySelector('.video-scarica');

// il titolo della sezione entra dal basso
entraTesti('.sezione-video .sovratitolo, .sezione-video .titolo');


// ===== scena, telecamera, renderer, luci =====
const scena = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 100);
const puntoGuardato = new THREE.Vector3(); // GSAP lo sposta, la camera lo guarda

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
video.prepend(renderer.domElement);

preparaScena(scena, renderer); // sfondo, luci e ambiente (modello.js)

// un'ombra morbida sotto gli occhiali, per "appoggiarli" nello spazio
const ombra = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08, depthWrite: false })
);
ombra.rotation.x = -Math.PI / 2;
ombra.position.y = -0.7;
ombra.scale.set(1, 0.45, 1);
scena.add(ombra);


// il renderer si adatta alla grandezza del riquadro
function ridimensiona() {
    renderer.setSize(video.clientWidth, video.clientHeight, false);
    camera.aspect = video.clientWidth / video.clientHeight;
    camera.updateProjectionMatrix();
}
new ResizeObserver(ridimensiona).observe(video);
ridimensiona();


// ===== il modello =====
// due gruppi uno dentro l'altro, così due animazioni GSAP non si pestano i piedi:
// "entrata" = l'animazione d'ingresso (una volta sola), "occhiali" = l'oscillazione del video
const entrata = new THREE.Group();
const occhiali = new THREE.Group();
entrata.add(occhiali);
scena.add(entrata);

caricaOcchiali().then(function({ modello, altezza }) {
    occhiali.add(modello);
    ombra.position.y = -altezza / 2 - 0.05; // l'ombra appena sotto gli occhiali
    segnaposto.remove();
    avvia();
}).catch(function(errore) {
    console.error(errore);
    segnaposto.textContent = 'Impossibile caricare il modello. Apri la pagina con un server locale (es. Live Server).';
});


// ===== la timeline GSAP del video =====
// la telecamera lungo le tappe + gli occhiali che oscillano piano, ripetuta all'infinito
const timeline = sequenzaCamera(camera, puntoGuardato, SEQUENZA, {
    repeat: -1,
    onRepeat: function() { if (registratore) registratore.stop(); } // un giro completo registrato
});
timeline
    .to(occhiali.rotation, { y: 0.15,  duration: DURATA / 4, ease: 'sine.inOut' }, 0)
    .to(occhiali.rotation, { y: -0.15, duration: DURATA / 2, ease: 'sine.inOut' }, DURATA / 4)
    .to(occhiali.rotation, { y: 0,     duration: DURATA / 4, ease: 'sine.inOut' }, DURATA * 3 / 4);

function avvia() {
    entraModello(entrata);
    aggiornaRiproduzione();
    // ad ogni fotogramma di GSAP disegniamo la scena (così animazioni e disegno vanno a tempo)
    gsap.ticker.add(disegna);
}

function disegna() {
    camera.lookAt(puntoGuardato);
    renderer.render(scena, camera);
    aggiornaDidascalia();
}


// ===== la didascalia: quella della tappa verso cui stiamo andando, dopo metà del tragitto =====
let testoAttuale = null;

function aggiornaDidascalia() {
    const tempo = timeline.time();
    let i = 0;
    while (i < SEQUENZA.length - 2 && tempo >= SEQUENZA[i + 1].t) i++;
    const da = SEQUENZA[i], a = SEQUENZA[i + 1];
    const testo = (tempo - da.t) / (a.t - da.t) > 0.5 ? a.testo : da.testo;
    if (testo === testoAttuale) return;
    testoAttuale = testo;
    gsap.killTweensOf(didascalia);
    gsap.to(didascalia, { opacity: 0, y: 8, duration: 0.25, onComplete: function() {
        if (!testo) return;
        didascalia.textContent = testo;
        gsap.to(didascalia, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    } });
}


// ===== play e pausa =====
let inPausa = false;   // pausa scelta da chi guarda
let visibile = true;   // l'animazione è sullo schermo?

// la timeline va solo se nessuno l'ha messa in pausa e se il video si vede
// (mentre registriamo va sempre, altrimenti il file avrebbe dei buchi)
function aggiornaRiproduzione() {
    if (registratore || (!inPausa && visibile)) timeline.play();
    else timeline.pause();
}

function impostaPausa(pausa) {
    inPausa = pausa;
    aggiornaRiproduzione();
}

// clic sull'animazione = pausa / riparte
renderer.domElement.addEventListener('click', function() { impostaPausa(!inPausa); });

// con ScrollTrigger: quando il video esce dallo schermo si ferma, quando torna riparte
quandoVisibile(video,
    function() { visibile = true; aggiornaRiproduzione(); },
    function() { visibile = false; aggiornaRiproduzione(); }
);


// ===== "Scarica video": registra un giro completo e lo salva =====
let registratore = null;

bottoneScarica.addEventListener('click', function() {
    if (registratore) return;
    if (!window.MediaRecorder) {
        alert('Questo browser non può registrare il video.');
        return;
    }
    // registriamo il canvas a 30 fotogrammi al secondo, ripartendo dall'inizio
    const flusso = renderer.domElement.captureStream(30);
    const formato = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    registratore = new MediaRecorder(flusso, { mimeType: formato, videoBitsPerSecond: 8000000 });
    const pezzi = [];
    registratore.ondataavailable = function(e) { if (e.data.size) pezzi.push(e.data); };
    registratore.onstop = function() {
        const file = new Blob(pezzi, { type: 'video/webm' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file);
        link.download = 'occhiali-finiti.webm';
        link.click();
        setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
        registratore = null;
        bottoneScarica.disabled = false;
        bottoneScarica.textContent = 'Scarica video';
        aggiornaRiproduzione();
    };
    registratore.start();
    timeline.restart();
    impostaPausa(false);
    bottoneScarica.disabled = true;
    bottoneScarica.textContent = 'Registrazione…';
});
