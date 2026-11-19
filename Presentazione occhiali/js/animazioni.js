// animazioni.js – il collegamento con GSAP, per tutte le animazioni della presentazione.
// Qui ci sono funzioni pronte da riusare con qualsiasi modello 3D (Three.js)
// o elemento della pagina. Si importano così:
//
//   import { gsap, sequenzaCamera, entraModello } from './animazioni.js';
//
// GSAP anima qualsiasi numero dentro un oggetto: per questo funziona anche con Three.js
// (camera.position, modello.rotation, modello.scale, materiale.opacity...).

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';

gsap.registerPlugin(ScrollTrigger);

// li esportiamo, così gli altri file usano sempre questa stessa copia di GSAP
export { gsap, ScrollTrigger };


// ===== 1. la telecamera lungo una sequenza di tappe =====
// tappe: [{ t: secondi, pos: [x,y,z], guarda: [x,y,z] }, ...]
// puntoGuardato: un THREE.Vector3 che GSAP sposta; nel ciclo di disegno fate camera.lookAt(puntoGuardato).
// Restituisce una timeline GSAP: si può mettere in pausa, far ripartire, saltare (seek)...
export function sequenzaCamera(camera, puntoGuardato, tappe, opzioni = {}) {
    const timeline = gsap.timeline({ paused: true, ...opzioni });
    const prima = tappe[0];
    timeline.set(camera.position, { x: prima.pos[0], y: prima.pos[1], z: prima.pos[2] }, 0);
    timeline.set(puntoGuardato, { x: prima.guarda[0], y: prima.guarda[1], z: prima.guarda[2] }, 0);

    for (let i = 1; i < tappe.length; i++) {
        const da = tappe[i - 1], a = tappe[i];
        const durata = a.t - da.t;
        const andatura = a.andatura || 'power3.inOut'; // parte piano, accelera, rallenta
        timeline.to(camera.position, { x: a.pos[0], y: a.pos[1], z: a.pos[2], duration: durata, ease: andatura }, da.t);
        timeline.to(puntoGuardato, { x: a.guarda[0], y: a.guarda[1], z: a.guarda[2], duration: durata, ease: andatura }, da.t);
        // un'etichetta per ogni tappa: timeline.seek('Il profilo') salta lì
        if (a.testo) timeline.addLabel(a.testo, a.t);
    }
    return timeline;
}


// ===== 2. un singolo spostamento della telecamera (per esempio al clic su un bottone) =====
export function spostaCamera(camera, puntoGuardato, pos, guarda, opzioni = {}) {
    const durata = opzioni.durata ?? 1.5;
    const andatura = opzioni.andatura || 'power3.inOut';
    return gsap.timeline()
        .to(camera.position, { x: pos[0], y: pos[1], z: pos[2], duration: durata, ease: andatura }, 0)
        .to(puntoGuardato, { x: guarda[0], y: guarda[1], z: guarda[2], duration: durata, ease: andatura }, 0);
}


// ===== 3. l'entrata di un modello 3D: cresce e gira leggermente =====
export function entraModello(oggetto, opzioni = {}) {
    const scala = oggetto.scale.x;
    return gsap.timeline()
        .fromTo(oggetto.scale, { x: scala * 0.6, y: scala * 0.6, z: scala * 0.6 },
            { x: scala, y: scala, z: scala, duration: opzioni.durata ?? 1.4, ease: 'expo.out' }, 0)
        .from(oggetto.rotation, { y: opzioni.giro ?? -Math.PI / 3, duration: opzioni.durata ?? 1.4, ease: 'expo.out' }, 0);
}


// ===== 4. far "respirare" un modello: oscilla piano avanti e indietro, all'infinito =====
export function oscilla(oggetto, opzioni = {}) {
    return gsap.fromTo(oggetto.rotation,
        { y: -(opzioni.angolo ?? 0.15) },
        { y: opzioni.angolo ?? 0.15, duration: opzioni.durata ?? 4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
}


// ===== 5. una timeline guidata dallo scroll =====
// scorrendo la pagina la timeline va avanti, tornando su va indietro.
// Utile per le prossime sezioni: esploso, cambio colore, giro degli occhiali...
export function animaAlloScroll(timeline, elemento, opzioni = {}) {
    return ScrollTrigger.create({
        trigger: elemento,
        start: opzioni.inizio || 'top top',
        end: opzioni.fine || '+=150%',
        pin: opzioni.blocca ?? true, // la sezione resta ferma mentre si scorre
        scrub: opzioni.morbidezza ?? 1,
        animation: timeline
    });
}


// ===== 6. fare qualcosa quando un elemento entra o esce dallo schermo =====
export function quandoVisibile(elemento, entra, esce) {
    return ScrollTrigger.create({
        trigger: elemento,
        start: 'top bottom',
        end: 'bottom top',
        onEnter: entra, onEnterBack: entra,
        onLeave: esce, onLeaveBack: esce
    });
}


// ===== 7. testi e blocchi della pagina che entrano dal basso =====
export function entraTesti(selettore, opzioni = {}) {
    return gsap.from(selettore, {
        y: 30, opacity: 0, duration: 0.9, ease: 'power3.out',
        stagger: 0.12, ...opzioni
    });
}
