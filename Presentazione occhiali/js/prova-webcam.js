// prova-webcam.js – provare gli occhiali con la webcam (e scattare le foto)
// (lo stesso file del progetto consegna_es1, qui lo usa webcam.js)
//   const webcam = creaProvaWebcam(divProva, bottone, { prendiModello: ..., codice: ... });
//
// MediaPipe Face Landmarker (una libreria di Google) trova 478 punti del viso nel video:
// con alcuni di questi (occhi, fronte, mento) calcoliamo dove mettere gli occhiali,
// quanto grandi e quanto inclinati. La libreria si scarica solo quando si accende la webcam.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// i numeri dei punti del viso di MediaPipe che ci servono
const PUNTO = {
    occhioDestro: 33,      // angolo esterno dell'occhio destro (a sinistra nell'immagine)
    occhioSinistro: 263,   // angolo esterno dell'occhio sinistro
    nasoAlto: 168,         // il punto del naso tra gli occhi: qui appoggia il ponte
    fronte: 10,
    mento: 152
};
// quanto sono larghi gli occhiali rispetto alla distanza tra gli angoli esterni degli occhi
const LARGHEZZA_OCCHIALI = 1.55;

// il riconoscimento del viso si carica una volta sola (promessa condivisa)
let riconoscitore = null;
function caricaRiconoscitore() {
    if (!riconoscitore) {
        const versione = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
        riconoscitore = import(versione + '/vision_bundle.mjs').then(async function(mp) {
            const file = await mp.FilesetResolver.forVisionTasks(versione + '/wasm');
            return mp.FaceLandmarker.createFromOptions(file, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numFaces: 1
            });
        });
        riconoscitore.catch(function() { riconoscitore = null; }); // se fallisce, si potrà riprovare
    }
    return riconoscitore;
}

// prova    = il <div class="prova"> con video, messaggio, bottone per scattare e anteprima
// bottone  = il bottone che accende e spegne la webcam
// opzioni.prendiModello(funzione) = chiama la funzione con gli occhiali (già preparati) da provare
// opzioni.codice = il nome del modello, per il nome del file delle foto
// opzioni.primaDiAvviare = (facoltativa) una funzione chiamata appena si accende la webcam
export function creaProvaWebcam(prova, bottone, opzioni) {
    const specchio = prova.querySelector('.prova-specchio');
    const video = prova.querySelector('.prova-video');
    const messaggio = prova.querySelector('.prova-messaggio');
    const testoSpento = bottone.textContent;
    let provaAttiva = false;
    let flusso = null;   // il flusso della webcam (per poterla spegnere)
    let p = null;        // renderer, scena, camera e occhiali della prova

    function creaScenaProva() {
        const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        specchio.appendChild(r.domElement);

        const scena = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(r);
        scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scena.environmentIntensity = 0.6;
        scena.add(new THREE.AmbientLight(0xffffff, 0.8));
        const luce = new THREE.DirectionalLight(0xffffff, 2);
        luce.position.set(0, 500, 1000);
        scena.add(luce);

        // camera "ortografica" misurata in pixel del video: 1 unità = 1 pixel
        const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -5000, 5000);
        camera.position.z = 1000;

        // la "testa": la spostiamo e la giriamo come la testa vera;
        // dentro ci sono gli occhiali e una testa invisibile che nasconde
        // le stanghette quando passano dietro al viso
        const testa = new THREE.Group();
        testa.visible = false;
        scena.add(testa);

        return { renderer: r, scena: scena, camera: camera, testa: testa, larghezza: 1 };
    }

    // mette nella testa una copia degli occhiali, con il ponte nel punto (0, 0, 0).
    // La copia usa gli stessi materiali: se cambi un colore, cambia anche sul viso
    function preparaOcchialiProva(modello) {
        p.testa.clear();
        const occhiali = modello.clone();
        occhiali.position.set(0, 0, 0);
        occhiali.updateMatrixWorld(true);
        const scatola = new THREE.Box3().setFromObject(occhiali);
        const dimensioni = scatola.getSize(new THREE.Vector3());
        const centro = scatola.getCenter(new THREE.Vector3());
        p.larghezza = dimensioni.x;

        // spostiamo gli occhiali: il centro del frontale va dove sta il naso
        const adattatore = new THREE.Group();
        adattatore.position.set(-centro.x, -centro.y, -scatola.max.z);
        adattatore.add(occhiali);
        p.testa.add(adattatore);

        // la testa invisibile: un ovale che non si disegna ma copre ciò che c'è dietro
        const L = dimensioni.x;
        const occlusore = new THREE.Mesh(
            new THREE.SphereGeometry(1, 32, 24),
            new THREE.MeshBasicMaterial({ colorWrite: false })
        );
        occlusore.scale.set(L * 0.47, L * 0.7, L * 0.62);
        occlusore.position.set(0, -L * 0.1, -L * 0.68);
        occlusore.renderOrder = -1; // si disegna per primo
        p.testa.add(occlusore);
    }

    // video e occhiali riempiono il riquadro (come "cover": si taglia quello che avanza)
    function adattaProva() {
        if (!p || !video.videoWidth) return;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const W = prova.clientWidth;
        const H = prova.clientHeight;
        const scala = Math.max(W / vw, H / vh);
        const w = vw * scala;
        const h = vh * scala;
        specchio.style.width = w + 'px';
        specchio.style.height = h + 'px';
        specchio.style.left = (W - w) / 2 + 'px';
        specchio.style.top = (H - h) / 2 + 'px';
        p.renderer.setSize(w, h);
        p.camera.right = vw;
        p.camera.top = vh;
        p.camera.updateProjectionMatrix();
    }

    async function avvia() {
        if (provaAttiva) return;
        provaAttiva = true;
        if (opzioni.primaDiAvviare) opzioni.primaDiAvviare();
        bottone.classList.add('selected');
        bottone.textContent = 'Spegni la webcam';
        prova.hidden = false;
        messaggio.textContent = 'Avvio della webcam…';
        if (!p) p = creaScenaProva();
        p.testa.visible = false;

        try {
            // chiediamo il permesso di usare la webcam (quella frontale, se c'è)
            flusso = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            if (!provaAttiva) { fermaFlusso(); return; } // nel frattempo è stata spenta
            video.srcObject = flusso;
            await video.play();
            adattaProva();

            messaggio.textContent = 'Caricamento del riconoscimento del viso…';
            const landmarker = await caricaRiconoscitore();
            if (!provaAttiva) return;

            // gli occhiali da provare (arrivano appena il modello è caricato)
            opzioni.prendiModello(function(modello) {
                if (provaAttiva) preparaOcchialiProva(modello);
            });

            messaggio.textContent = 'Mettiti di fronte alla webcam';
            bottoneScatta.hidden = false; // ora si può scattare
            let ultimoTempo = -1;
            p.renderer.setAnimationLoop(function() {
                // analizziamo il video solo quando arriva un fotogramma nuovo
                if (video.currentTime !== ultimoTempo) {
                    ultimoTempo = video.currentTime;
                    const risultato = landmarker.detectForVideo(video, performance.now());
                    muoviOcchiali(risultato);
                }
                p.renderer.render(p.scena, p.camera);
            });
        } catch (errore) {
            console.error(errore);
            fermaFlusso();
            if (provaAttiva) {
                messaggio.textContent = errore && errore.name === 'NotAllowedError'
                    ? 'Non hai dato il permesso di usare la webcam.'
                    : 'Non è stato possibile avviare la prova con la webcam.';
            }
        }
    }

    // posizione, misura e rotazione degli occhiali a partire dai punti del viso
    const bersaglio = { posizione: new THREE.Vector3(), rotazione: new THREE.Quaternion(), scala: 1 };
    function muoviOcchiali(risultato) {
        const punti = risultato.faceLandmarks && risultato.faceLandmarks[0];
        if (!punti) {
            p.testa.visible = false;
            messaggio.textContent = 'Mettiti di fronte alla webcam';
            return;
        }
        messaggio.textContent = '';

        // i punti arrivano da 0 a 1: li trasformiamo in pixel del video.
        // y va verso l'alto (come in Three.js) e z verso la camera
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        function punto(n) {
            const q = punti[n];
            return new THREE.Vector3(q.x * vw, (1 - q.y) * vh, -q.z * vw);
        }
        const occhioD = punto(PUNTO.occhioDestro);
        const occhioS = punto(PUNTO.occhioSinistro);
        const naso = punto(PUNTO.nasoAlto);
        const fronte = punto(PUNTO.fronte);
        const mento = punto(PUNTO.mento);

        // gli assi della testa: x da un occhio all'altro, y dal mento alla fronte, z in avanti
        const asseX = occhioS.clone().sub(occhioD).normalize();
        const asseY = fronte.clone().sub(mento);
        asseY.sub(asseX.clone().multiplyScalar(asseY.dot(asseX))).normalize(); // perpendicolare a x
        const asseZ = new THREE.Vector3().crossVectors(asseX, asseY);
        const rotazione = new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(asseX, asseY, asseZ)
        );

        const distanzaOcchi = occhioS.distanceTo(occhioD);
        bersaglio.posizione.copy(naso);
        bersaglio.rotazione.copy(rotazione);
        bersaglio.scala = distanzaOcchi * LARGHEZZA_OCCHIALI / p.larghezza;

        // la prima volta gli occhiali saltano al posto giusto, poi lo seguono morbidi
        // (così non tremano a ogni piccolo errore del riconoscimento)
        if (!p.testa.visible) {
            p.testa.position.copy(bersaglio.posizione);
            p.testa.quaternion.copy(bersaglio.rotazione);
            p.testa.scale.setScalar(bersaglio.scala);
            p.testa.visible = p.testa.children.length > 0;
        } else {
            p.testa.position.lerp(bersaglio.posizione, 0.5);
            p.testa.quaternion.slerp(bersaglio.rotazione, 0.5);
            p.testa.scale.setScalar(p.testa.scale.x + (bersaglio.scala - p.testa.scale.x) * 0.5);
        }
    }

    function fermaFlusso() {
        if (flusso) {
            flusso.getTracks().forEach(function(traccia) { traccia.stop(); }); // spegne la webcam
            flusso = null;
        }
        video.srcObject = null;
    }

    function ferma() {
        if (!provaAttiva) return;
        provaAttiva = false;
        fermaFlusso();
        if (p) {
            p.renderer.setAnimationLoop(null);
            p.testa.visible = false;
        }
        prova.hidden = true;
        bottoneScatta.hidden = true;
        chiudiFoto();
        bottone.classList.remove('selected');
        bottone.textContent = testoSpento;
    }


    // le foto: uniamo in un'immagine il fotogramma del video e gli occhiali 3D
    const bottoneScatta = prova.querySelector('.prova-scatta');
    const lampo = prova.querySelector('.prova-lampo');
    const anteprima = prova.querySelector('.prova-foto');
    const immagineFoto = prova.querySelector('.prova-foto-immagine');
    const linkScarica = prova.querySelector('.prova-scarica');
    let indirizzoFoto = null; // l'indirizzo temporaneo della foto (per liberare la memoria dopo)

    function scattaFoto() {
        if (!provaAttiva || !video.videoWidth) return;
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // una "tela" grande quanto il video
        const tela = document.createElement('canvas');
        tela.width = vw;
        tela.height = vh;
        const ctx = tela.getContext('2d');

        // ribaltiamo in orizzontale, così la foto è uguale a quello che si vede (a specchio)
        ctx.translate(vw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, vw, vh);

        // gli occhiali: ridisegniamo la scena e la copiamo SUBITO, nello stesso momento
        // (dopo, il browser svuota il canvas 3D e la copia verrebbe vuota)
        p.renderer.render(p.scena, p.camera);
        ctx.drawImage(p.renderer.domElement, 0, 0, vw, vh);

        // il lampo bianco
        lampo.classList.remove('scatto');
        void lampo.offsetWidth; // fa ripartire l'animazione anche se si scatta di nuovo subito
        lampo.classList.add('scatto');

        // trasformiamo la tela in un file PNG e lo mostriamo nell'anteprima
        tela.toBlob(function(file) {
            if (indirizzoFoto) URL.revokeObjectURL(indirizzoFoto);
            indirizzoFoto = URL.createObjectURL(file);
            immagineFoto.src = indirizzoFoto;
            linkScarica.href = indirizzoFoto;
            // il nome del file: occhiali-mongiustiviola-2026-11-19-15-30-12.png
            const ora = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            linkScarica.download = 'occhiali-' + opzioni.codice + '-' + ora + '.png';
            anteprima.hidden = false;
            bottoneScatta.hidden = true;
        }, 'image/png');
    }

    function chiudiFoto() {
        anteprima.hidden = true;
        if (provaAttiva) bottoneScatta.hidden = false;
    }

    bottoneScatta.addEventListener('click', scattaFoto);
    prova.querySelector('.prova-altra').addEventListener('click', chiudiFoto);

    bottone.addEventListener('click', function() {
        if (provaAttiva) ferma();
        else avvia();
    });
    window.addEventListener('resize', adattaProva);

    return { avvia: avvia, ferma: ferma };
}
