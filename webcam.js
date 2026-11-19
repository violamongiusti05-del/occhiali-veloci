// webcam.js – l'ultima sezione: provare gli "Occhiali veloci" sul proprio viso.
// Il riconoscimento del viso (MediaPipe Face Landmarker) e la foto sono in prova-webcam.js;
// qui gli diamo sempre questo modello di occhiali, caricato con caricaOcchiali (modello.js).

import { creaProvaWebcam } from './prova-webcam.js';
import { caricaOcchiali } from './modello.js';
import { entraTesti } from './animazioni.js';

const sezione = document.querySelector('.sezione-webcam');
const prova = sezione.querySelector('.prova');
const bottone = sezione.querySelector('.bottone-webcam');

// il modello si carica solo la prima volta che si accende la webcam, poi si riusa
let occhiali = null;
function prendiModello(usa) {
    if (!occhiali) occhiali = caricaOcchiali().then(function(risultato) { return risultato.modello; });
    occhiali.then(usa).catch(function(errore) { console.error(errore); });
}

const webcam = creaProvaWebcam(prova, bottone, {
    prendiModello: prendiModello,
    codice: 'veloci', // le foto si chiamano occhiali-veloci-<data>.png
    // quando la webcam si accende, la copertina sparisce
    primaDiAvviare: function() { sezione.classList.add('webcam-accesa'); }
});

// quando la webcam si spegne, torna la copertina
bottone.addEventListener('click', function() {
    if (prova.hidden) sezione.classList.remove('webcam-accesa');
});

// titolo e testo entrano dal basso quando arrivano sullo schermo
entraTesti('.sezione-webcam .sovratitolo, .sezione-webcam .titolo-sezione, .sezione-webcam .testo-sezione', {
    scrollTrigger: { trigger: sezione, start: 'top 80%' }
});

// se si lascia la pagina, la webcam si spegne
window.addEventListener('pagehide', function() { webcam.ferma(); });
