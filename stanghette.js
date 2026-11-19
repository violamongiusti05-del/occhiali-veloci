// stanghette.js – il render in cui le stanghette si aprono e si chiudono seguendo il cursore.
// Cursore a sinistra = occhiali chiusi, cursore a destra = occhiali aperti.
//
// Nel file "Occhiali finiti.glb" le stanghette sono nel gruppo "Stanghette": due pezzi,
// uno per lato. Per farle girare come vere stanghette mettiamo ognuna dentro un "perno"
// (un gruppo vuoto) piazzato sulla vite della cerniera: girando il perno, la stanghetta
// gira attorno alla vite.
//
// Attenzione: nel file ogni stanghetta comprende anche la parte della cerniera attaccata
// al frontale, sopra la lente. Quella non deve muoversi: tagliamo quindi ogni stanghetta
// in due all'altezza della vite (Z_TAGLIO). Tutto ciò che sta davanti al taglio resta
// fermo sulla lente, solo l'asta dietro gira.

import * as THREE from 'three';
import { gsap } from './animazioni.js';
import { preparaScena, caricaOcchiali } from './modello.js';

// le viti delle cerniere, misurate nel file (coordinate del modello originale, prima di
// centrarlo e ingrandirlo). Se cambiate il modello, vanno rimisurate.
const VITE_DESTRA   = new THREE.Vector3(-1.4385, 0.1, -1.4223);
const VITE_SINISTRA = new THREE.Vector3(-1.6572, 0.1, -1.4223);

// dove tagliamo la stanghetta (sempre in coordinate del file; le lenti guardano verso +z):
// i triangoli con il centro davanti a questa z restano attaccati al frontale.
// Il taglio passa per la vite, così la parte che gira resta unita a quella ferma.
// Se un pezzetto di cerniera si stacca ancora, spostate il valore di poco (es. -1.41 o -1.43)
const Z_TAGLIO = -1.4223;

// di quanti gradi si chiude ogni stanghetta. La sinistra un po' meno,
// così da chiusa si appoggia sopra la destra invece di attraversarla
const CHIUSURA_DESTRA = 90;
const CHIUSURA_SINISTRA = 82;


// ===== gli elementi della pagina =====
const riquadro = document.getElementById('render-stanghette');
const segnaposto = riquadro.querySelector('.render-segnaposto');
const indicatore = riquadro.querySelector('.render-indicatore');
const stato = riquadro.querySelector('.render-stato');


// ===== scena, telecamera, renderer =====
const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.1, 100);
// da sopra e un po' di lato: si vede bene la stanghetta che si piega dietro le lenti
camera.position.set(3.4, 3.1, 3.6);
camera.lookAt(0, -0.1, -0.35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
riquadro.prepend(renderer.domElement);
preparaScena(scena, renderer);

function ridimensiona() {
    renderer.setSize(riquadro.clientWidth, riquadro.clientHeight, false);
    camera.aspect = riquadro.clientWidth / riquadro.clientHeight;
    // sul telefono il riquadro è stretto: allarghiamo l'obiettivo perché gli occhiali stiano dentro
    camera.fov = camera.aspect < 1 ? 42 : 30;
    camera.updateProjectionMatrix();
    disegna();
}
new ResizeObserver(ridimensiona).observe(riquadro);

// il gruppo che si inclina appena seguendo il mouse, per dare profondità
const inclinazione = new THREE.Group();
scena.add(inclinazione);


// ===== quanto sono aperte: 0 = chiuse, 1 = aperte =====
// GSAP porta "apertura.valore" verso il punto del cursore con un po' di ritardo morbido
const apertura = { valore: 1 };
const perni = []; // { perno, gradi, verso }
let dimostrazione = null; // l'animazione iniziale


function disegna() {
    perni.forEach(function(p) {
        p.perno.rotation.y = p.verso * THREE.MathUtils.degToRad(p.gradi) * (1 - apertura.valore);
    });
    renderer.render(scena, camera);
    indicatore.style.setProperty('--apertura', apertura.valore);
    stato.textContent = Math.round(apertura.valore * 100) + '% aperti';
}


caricaOcchiali().then(function({ modello }) {
    // il gruppo "Stanghette" e i suoi due pezzi
    const gruppo = modello.getObjectByName('Stanghette');
    if (!gruppo) throw new Error('Nel modello non c\'è il gruppo "Stanghette"');

    // aggiorniamo le posizioni "nel mondo" di tutte le parti, servono per misurare i pezzi
    modello.updateMatrixWorld(true);

    // copiamo la lista: spostando i pezzi nei perni, i figli del gruppo cambiano
    gruppo.children.slice().forEach(function(pezzo) {
        // da che lato sta? Lo capiamo dal centro del pezzo
        const centro = new THREE.Box3().setFromObject(pezzo).getCenter(new THREE.Vector3());
        modello.worldToLocal(centro);
        const destra = centro.x > (VITE_DESTRA.x + VITE_SINISTRA.x) / 2;
        const vite = destra ? VITE_DESTRA : VITE_SINISTRA;

        // la parte della cerniera sul frontale: la stacchiamo dalla stanghetta e la lasciamo
        // nel gruppo, ferma (vedi separaCerniera qui sotto)
        separaCerniera(pezzo).forEach(function(ferma) { gruppo.add(ferma); });

        // il perno sulla vite; il pezzo dentro, spostato all'indietro della stessa misura,
        // così resta esattamente dove era
        const perno = new THREE.Group();
        perno.position.copy(vite);
        gruppo.add(perno);
        pezzo.position.sub(vite);
        perno.add(pezzo);

        // destra: girando di +90° la stanghetta va verso il centro; sinistra: al contrario
        perni.push({ perno, gradi: destra ? CHIUSURA_DESTRA : CHIUSURA_SINISTRA, verso: destra ? 1 : -1 });
    });

    inclinazione.add(modello);
    segnaposto.remove();
    riquadro.classList.add('pronto');

    // all'inizio una piccola dimostrazione: si chiudono e si riaprono da sole
    // (parte quando il riquadro arriva sullo schermo; se il cursore si muove prima, la fermiamo)
    dimostrazione = gsap.timeline({
        delay: 0.3,
        scrollTrigger: { trigger: riquadro, start: 'top 75%' }
    })
        .to(apertura, { valore: 0, duration: 1.1, ease: 'power2.inOut' })
        .to(apertura, { valore: 1, duration: 1.1, ease: 'power2.inOut' });

    // ad ogni fotogramma di GSAP: ruotiamo i perni e disegniamo
    gsap.ticker.add(disegna);
}).catch(function(errore) {
    console.error(errore);
    segnaposto.textContent = 'Impossibile caricare il modello. Apri la pagina con un server locale (es. Live Server).';
});


// ===== il taglio della stanghetta =====
// Per ogni parte (mesh) della stanghetta dividiamo i triangoli in due:
// - davanti al taglio → una nuova mesh "ferma", con lo stesso materiale, che viene restituita;
// - dietro al taglio  → restano nella stanghetta e gireranno con lei.
// (nel file le parti non sono spostate né ruotate, quindi le coordinate dei vertici
//  sono già quelle del modello e si confrontano direttamente con Z_TAGLIO)
function separaCerniera(pezzo) {
    const parti = [];
    pezzo.traverse(function(parte) { if (parte.isMesh) parti.push(parte); });

    const ferme = [];
    parti.forEach(function(parte) {
        const geometria = parte.geometry;
        const posizioni = geometria.attributes.position;
        const indici = geometria.index;
        const numeroTriangoli = (indici ? indici.count : posizioni.count) / 3;

        // il vertice numero "angolo" (0, 1, 2) del triangolo t
        function vertice(t, angolo) {
            return indici ? indici.getX(t * 3 + angolo) : t * 3 + angolo;
        }

        const davanti = [], dietro = [];
        for (let t = 0; t < numeroTriangoli; t++) {
            const zCentro = (posizioni.getZ(vertice(t, 0)) + posizioni.getZ(vertice(t, 1)) + posizioni.getZ(vertice(t, 2))) / 3;
            (zCentro > Z_TAGLIO ? davanti : dietro).push(t);
        }
        if (davanti.length === 0) return; // tutta asta: gira intera

        const ferma = new THREE.Mesh(geometriaDaTriangoli(geometria, davanti, vertice), parte.material);
        ferma.name = (parte.name || 'stanghetta') + '-cerniera';
        ferme.push(ferma);

        if (dietro.length === 0) parte.removeFromParent();          // tutta cerniera: non gira niente
        else parte.geometry = geometriaDaTriangoli(geometria, dietro, vertice);
    });
    return ferme;
}

// una nuova geometria con solo i triangoli scelti (copiando posizioni, normali, uv...)
function geometriaDaTriangoli(geometria, triangoli, vertice) {
    const nuova = new THREE.BufferGeometry();
    const leggi = ['getX', 'getY', 'getZ', 'getW'];
    for (const nome in geometria.attributes) {
        const attributo = geometria.attributes[nome];
        const n = attributo.itemSize;
        const valori = new Float32Array(triangoli.length * 3 * n);
        let i = 0;
        triangoli.forEach(function(t) {
            for (let angolo = 0; angolo < 3; angolo++) {
                const v = vertice(t, angolo);
                for (let k = 0; k < n; k++) valori[i++] = attributo[leggi[k]](v);
            }
        });
        nuova.setAttribute(nome, new THREE.BufferAttribute(valori, n));
    }
    return nuova;
}


// ===== il cursore =====
// quickTo: ogni volta che lo chiamiamo, GSAP riparte morbido verso il nuovo valore
const versoApertura = gsap.quickTo(apertura, 'valore', { duration: 0.6, ease: 'power3.out' });
const versoInclinaX = gsap.quickTo(inclinazione.rotation, 'x', { duration: 0.8, ease: 'power3.out' });
const versoInclinaY = gsap.quickTo(inclinazione.rotation, 'y', { duration: 0.8, ease: 'power3.out' });

function seguiCursore(clientX, clientY) {
    if (dimostrazione) { dimostrazione.kill(); dimostrazione = null; } // comanda il cursore
    const r = riquadro.getBoundingClientRect();
    const x = THREE.MathUtils.clamp((clientX - r.left) / r.width, 0, 1);
    const y = THREE.MathUtils.clamp((clientY - r.top) / r.height, 0, 1);
    // lasciamo un margine ai bordi: basta arrivare vicino al lato per aprire o chiudere del tutto
    versoApertura(THREE.MathUtils.clamp((x - 0.1) / 0.8, 0, 1));
    versoInclinaY((x - 0.5) * 0.25);
    versoInclinaX((y - 0.5) * 0.12);
}

riquadro.addEventListener('pointermove', function(e) {
    seguiCursore(e.clientX, e.clientY);
});

// quando il cursore esce: gli occhiali tornano aperti e dritti
riquadro.addEventListener('pointerleave', function() {
    versoApertura(1);
    versoInclinaX(0);
    versoInclinaY(0);
});
