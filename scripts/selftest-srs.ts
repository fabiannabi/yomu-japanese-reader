// Verificación de la lógica FSRS de la Fase 3 (sin navegador).
// Ejecutar: node --experimental-strip-types scripts/selftest-srs.ts
import {
  emptyDeckCard,
  gradeDeckCard,
  nextIntervalLabel,
  GRADUATE_DAYS,
} from "../src/services/srs.ts";
import { Rating, State } from "ts-fsrs";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failed++;
    console.error(`FAIL  ${msg}`);
  }
}

const t0 = new Date("2026-06-28T12:00:00Z");

// Tarjeta nueva.
const fresh = emptyDeckCard("食べる", "たべる", "to eat", t0);
assert(fresh.state === State.New, "tarjeta nueva en estado New");
assert(fresh.reps === 0, "tarjeta nueva con 0 reps");

// Calificar reprograma el due.
const good = gradeDeckCard(fresh, Rating.Good, t0);
assert(good.card.due !== fresh.due, "calificar 'bien' reprograma el due");
assert(good.card.reps === 1, "reps incrementa tras calificar");
assert(good.graduated === false, "'bien' en tarjeta nueva no gradúa");

const again = gradeDeckCard(fresh, Rating.Again, t0);
assert(again.card.due > t0.getTime(), "'otra vez' reprograma a futuro");

const easy = gradeDeckCard(fresh, Rating.Easy, t0);
assert(easy.card.state === State.Review, "'fácil' en nueva pasa a Review");
assert(easy.graduated === false, `'fácil' inicial (${easy.card.scheduledDays}d) aún no gradúa`);

// Graduación: calificando 'fácil' repetidamente, avanzando el tiempo hasta el due,
// la tarjeta debe graduarse (scheduledDays >= GRADUATE_DAYS) en pocos pasos.
let card = fresh;
let now = t0;
let graduatedStep = -1;
for (let i = 0; i < 8; i++) {
  const res = gradeDeckCard(card, Rating.Easy, now);
  card = res.card;
  if (res.graduated) {
    graduatedStep = i;
    assert(card.scheduledDays >= GRADUATE_DAYS, `gradúa con intervalo >= ${GRADUATE_DAYS}d (${card.scheduledDays}d)`);
    break;
  }
  now = new Date(card.due); // avanzar al próximo repaso
}
assert(graduatedStep >= 0, `la tarjeta se gradúa repasando 'fácil' (paso ${graduatedStep})`);

// Etiquetas de intervalo legibles.
const label = nextIntervalLabel(fresh, Rating.Easy, t0);
assert(/\d/.test(label) && /(min|h|d|mes)/.test(label), `intervalo legible: "${label}"`);

console.log(failed === 0 ? "\nTODO OK" : `\n${failed} fallo(s)`);
process.exit(failed === 0 ? 0 : 1);
