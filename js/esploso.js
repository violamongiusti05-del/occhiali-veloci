// esploso.js – l'esploso degli occhiali, con un bottone.
// "Esplodi" separa le parti e mostra i loro nomi, "Rimonta" le rimette insieme.
//
// Le parti sono i gruppi del file "Occhiali finiti.glb": Davanti, Appoggio naso,
// Lente, Dietro e le due stanghette (dentro il gruppo "Stanghette").
// Attenzione: Three.js cambia gli spazi dei nomi in "_" ("Appoggio naso" → "Appoggio_naso").

import * as THREE from 'three';
import { gsap } from './animazioni.js';
import { preparaScena, caricaOcchiali } from './modello.js';

// ===== le parti e dove vanno nell'esploso =====
// sposta = di quanto si allontana [x, y, z], in unità della scena (gli occhiali sono larghi 2,4).
// Le lenti guardano verso +z: davanti = +z, dietro = -z, destra = +x, in alto = +y.
const PARTI = [
    { nome: 'Davanti',       etichetta: 'Davanti',       sposta: [0, 0.15, 1.6] },
    { nome: 'Appoggio_naso', etichetta: 'Appoggio naso', sposta: [0, -0.45, 1.0] },
    { nome: 'Lente',         etichetta: 'Lente',         sposta: [0, 0, 0.5] },
    { nome: 'Dietro',        etichetta: 'Dietro',        sposta: [0, 0, 0] }
];
// le stanghette: si allontanano di lato e un po' indietro
const STANGHETTA = { etichetta: 'Stanghetta', sposta: [0.7, 0, -0.5] };


// ===== gli elementi della pagina =====
const sezione = document.querySelector('.sezione-esploso');
const riquadro = document.getElementById('render-esploso');
const segnaposto = riquadro.querySelector('.render-segnaposto');
const contenitoreEtichette = riquadro.querySelector('.esploso-etichette');
const bottone = sezione.querySelector('.esploso-bottone');


// ===== scena, telecamera, renderer =====
const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
const puntoGuardato = new THREE.Vector3(0, 0, 0.2);
// da montati la camera è vicina; durante l'esploso si allontana per far stare tutto
camera.position.set(3.2, 1.5, 4.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
riquadro.prepend(renderer.domElement);
preparaScena(scena, renderer);

function ridimensiona() {
    renderer.setSize(riquadro.clientWidth, riquadro.clientHeight, false);
    camera.aspect = riquadro.clientWidth / riquadro.clientHeight;
    camera.fov = camera.aspect < 1 ? 50 : 30; // sul telefono: obiettivo più largo
    camera.updateProjectionMatrix();
}
new ResizeObserver(ridimensiona).observe(riquadro);


// ===== le etichette: un punto e un nome che seguono la loro parte =====
const etichette = []; // { elemento, parte, centro (nelle coordinate della parte) }
const proiettato = new THREE.Vector3();

function aggiungiEtichetta(parte, testo) {
    parte.updateWorldMatrix(true, true);
    const centro = new THREE.Box3().setFromObject(parte).getCenter(new THREE.Vector3());
    parte.worldToLocal(centro); // così il centro "viaggia" con la parte quando si sposta

    const elemento = document.createElement('div');
    elemento.className = 'esploso-etichetta';
    elemento.innerHTML = '<span class="esploso-pallino"></span><span class="esploso-nome"></span>';
    elemento.querySelector('.esploso-nome').textContent = testo;
    contenitoreEtichette.appendChild(elemento);
    etichette.push({ elemento, parte, centro });
}

function aggiornaEtichette() {
    const larghezza = riquadro.clientWidth, altezza = riquadro.clientHeight;
    etichette.forEach(function(e) {
        // dal punto 3D al punto sullo schermo
        proiettato.copy(e.centro);
        e.parte.localToWorld(proiettato);
        proiettato.project(camera);
        const x = (proiettato.x + 1) / 2 * larghezza;
        const y = (1 - proiettato.y) / 2 * altezza;
        e.elemento.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    });
}


// ===== il modello e la timeline dell'esploso =====
caricaOcchiali().then(function({ modello }) {
    scena.add(modello);
    // gli spostamenti sono in unità della scena: dentro il modello (ingrandito) vanno divisi per la scala
    const scala = modello.scale.x;
    modello.updateMatrixWorld(true);

    // inizio = montati, fine = esploso. Il bottone la fa andare avanti o indietro
    const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });

    function esplodi(parte, sposta, inizio) {
        timeline.to(parte.position, {
            x: parte.position.x + sposta[0] / scala,
            y: parte.position.y + sposta[1] / scala,
            z: parte.position.z + sposta[2] / scala,
            duration: 0.6
        }, inizio);
    }

    // le parti davanti e dietro, una dopo l'altra (dalla più esterna)
    PARTI.forEach(function(p, i) {
        const parte = modello.getObjectByName(p.nome);
        if (!parte) { console.warn('Parte non trovata nel modello:', p.nome); return; }
        esplodi(parte, p.sposta, i * 0.08);
        aggiungiEtichetta(parte, p.etichetta);
    });

    // le stanghette: ognuna dal suo lato
    const stanghette = modello.getObjectByName('Stanghette');
    if (stanghette) {
        const centroOcchiali = new THREE.Box3().setFromObject(modello).getCenter(new THREE.Vector3());
        stanghette.children.slice().forEach(function(pezzo) {
            const centro = new THREE.Box3().setFromObject(pezzo).getCenter(new THREE.Vector3());
            const destra = centro.x > centroOcchiali.x;
            const sposta = [STANGHETTA.sposta[0] * (destra ? 1 : -1), STANGHETTA.sposta[1], STANGHETTA.sposta[2]];
            esplodi(pezzo, sposta, 0.2);
            aggiungiEtichetta(pezzo, STANGHETTA.etichetta + (destra ? ' destra' : ' sinistra'));
        });
    }

    // la camera si allontana e gira un po' mentre le parti si separano
    timeline.to(camera.position, { x: 4.6, y: 2.6, z: 6.4, duration: 0.8 }, 0);
    timeline.to(puntoGuardato, { z: 0.5, duration: 0.8 }, 0);

    // alla fine compaiono le etichette, una dopo l'altra
    timeline.fromTo(etichette.map(function(e) { return e.elemento; }),
        { opacity: 0 }, { opacity: 1, duration: 0.15, stagger: 0.03, ease: 'none' }, 0.75);

    // la timeline dura circa 1 secondo: la facciamo andare un po' più piano
    timeline.timeScale(0.7);

    // il bottone: se sono montati li esplode, se sono esplosi li rimonta
    // (anche a metà animazione: riparte dal punto in cui è)
    let esplosi = false;
    bottone.addEventListener('click', function() {
        esplosi = !esplosi;
        if (esplosi) timeline.play();
        else timeline.reverse();
        bottone.textContent = esplosi ? 'Rimonta' : 'Esplodi';
    });
    bottone.disabled = false;

    segnaposto.remove();
    gsap.ticker.add(disegna);
}).catch(function(errore) {
    console.error(errore);
    segnaposto.textContent = 'Impossibile caricare il modello. Apri la pagina con un server locale (es. Live Server).';
});

function disegna() {
    camera.lookAt(puntoGuardato);
    renderer.render(scena, camera);
    aggiornaEtichette();
}
