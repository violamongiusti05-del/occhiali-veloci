// modello.js – le cose in comune tra l'animazione (video.js) e la galleria (galleria.js):
// il file degli occhiali, come prepararlo, e le luci della scena.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// il modello sta nella stessa cartella di index.html (così funziona anche su GitHub Pages)
export const FILE_MODELLO = 'models_occhiali_veloci.glb';

// le parti da rendere semi-trasparenti (le lenti), come nell'album
const TRASPARENTI = ['Lente'];

// i colori degli occhiali: tutte le parti bianche, la lente nera e trasparente
const COLORE_PARTI = '#f5f4f0';
const COLORE_LENTE = '#111111';
const OPACITA_LENTE = 0.6; // 0 = invisibile, 1 = nera piena

// lo sfondo delle scene 3D: uguale a --pannello in presentazione.css
export const COLORE_SFONDO = '#141414';


// luci e ambiente: uguali per tutte le scene, così gli occhiali hanno sempre lo stesso aspetto
export function preparaScena(scena, renderer) {
    scena.background = new THREE.Color(COLORE_SFONDO);

    scena.add(new THREE.AmbientLight(0xffffff, 0.6));
    const luce = new THREE.DirectionalLight(0xffffff, 2);
    luce.position.set(5, 8, 5);
    scena.add(luce);
    const luceDietro = new THREE.DirectionalLight(0xffffff, 0.8); // luce di contorno da dietro
    luceDietro.position.set(-4, 3, -6);
    scena.add(luceDietro);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scena.environmentIntensity = 0.5;
}


// carica gli occhiali e li prepara: nasconde le linee, rende trasparenti le lenti,
// li centra e li porta a una larghezza di 2,4 (come preparaModello di modelli.js).
// Restituisce una Promise con { modello, altezza }
export async function caricaOcchiali() {
    const gltf = await new GLTFLoader().loadAsync(FILE_MODELLO);
    const modello = gltf.scene;

    modello.traverse(function(parte) {
        if (parte.isLine || parte.isPoints) { parte.visible = false; return; }
        if (!parte.isMesh) return;
        let daRendere = TRASPARENTI.includes(parte.name);
        parte.traverseAncestors(function(a) { if (TRASPARENTI.includes(a.name)) daRendere = true; });
        const materiali = Array.isArray(parte.material) ? parte.material : [parte.material];
        materiali.forEach(function(materiale, i) {
            const lente = daRendere || TRASPARENTI.includes(materiale.name);
            const nuovo = materiale.clone(); // copia: il file originale non cambia
            if (!nuovo.color) return;        // materiale senza colore: lo lasciamo com'è
            if (nuovo.map) nuovo.map = null; // via eventuali texture, conta solo il colore
            nuovo.vertexColors = false;      // e via i colori salvati nei vertici
            if (lente) {
                // la lente: nera e trasparente, liscia e un po' lucida
                nuovo.color.set(COLORE_LENTE);
                nuovo.transparent = true;
                nuovo.opacity = OPACITA_LENTE;
                nuovo.depthWrite = false;
                if ('metalness' in nuovo) nuovo.metalness = 0;
                if ('roughness' in nuovo) nuovo.roughness = 0.08;
                if ('transmission' in nuovo) nuovo.transmission = 0;
            } else {
                // tutte le altre parti: bianche, opache
                nuovo.color.set(COLORE_PARTI);
                nuovo.transparent = false;
                nuovo.opacity = 1;
                if ('metalness' in nuovo) nuovo.metalness = 0;
                if ('roughness' in nuovo) nuovo.roughness = 0.45;
            }
            nuovo.needsUpdate = true;
            if (Array.isArray(parte.material)) parte.material[i] = nuovo;
            else parte.material = nuovo;
        });
    });

    const scatola = new THREE.Box3();
    modello.traverse(function(parte) {
        if (parte.isMesh && parte.visible) scatola.expandByObject(parte);
    });
    const centro = scatola.getCenter(new THREE.Vector3());
    const dimensioni = scatola.getSize(new THREE.Vector3());
    const scala = 2.4 / Math.max(dimensioni.x, dimensioni.y, dimensioni.z);
    modello.scale.setScalar(scala);
    modello.position.copy(centro).multiplyScalar(-scala);

    return { modello, altezza: dimensioni.y * scala };
}
