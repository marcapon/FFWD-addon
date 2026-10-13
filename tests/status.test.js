// Rekenregels van status.js, op de verzonnen studenten uit sandbox/fixtures.js.
// Draaien: node --test (vanuit de map ffwd-addon)

const test = require('node:test');
const assert = require('node:assert/strict');
const { bereken } = require('../extensie/status.js');
const F = require('../sandbox/fixtures.js');

const status = id => bereken({
  competencies: F.competenties, programs: F.programmas,
  goals: F.studenten.find(s => s.id === id).doelen,
});
const fase = (st, id) => st.fases.find(f => f.id === id);
const eis = (f, competentie, niveau) => f.eisen.find(e => e.competentie === competentie && e.niveau === niveau);

test('de eisen van alle fases tellen op tot 240 EC', () => {
  const st = status('s-onbekend');
  assert.equal(st.totaal.vereist, 240);
  assert.deepEqual(st.fases.map(f => f.vereist), [60, 120, 30, 30]);
});

test('zonder resultaten: alles 0, propedeuse en hoofdfase open, stage en afstuderen dicht', () => {
  const st = status('s-onbekend');
  assert.equal(st.totaal.behaald, 0);
  assert.deepEqual(st.open, ['p-prop', 'p-hoofd']);
  assert.deepEqual(st.fases.map(f => f.staat), ['open', 'open', 'dicht', 'dicht']);
  assert.equal(fase(st, 'p-prop').tekorten.length, 5);
});

test('eerstejaars: N1-resultaten vullen de propedeuse, open doelen tellen niet', () => {
  const st = status('s-sanne');
  const prop = fase(st, 'p-prop');
  assert.equal(st.totaal.behaald, 24);
  assert.equal(prop.gevuld, 24);
  assert.deepEqual(st.open, ['p-prop', 'p-hoofd']);
  assert.deepEqual(prop.tekorten.map(t => [t.competentie, t.tekort]), [['c-ond', 6], ['c-cre', 12], ['c-org', 6], ['c-ler', 12]]);
});

test('overschot in een fase telt als boven de eisen', () => {
  const st = status('s-daan');
  const prop = fase(st, 'p-prop');
  assert.equal(prop.klaar, true);
  assert.equal(prop.boven, 6);
  assert.deepEqual(st.open, ['p-hoofd', 'p-stage'], 'na de propedeuse gaat de stage open, naast de hoofdfase');
});

test('alleen het exacte niveau telt: N3 Creëren vult geen N2-eis, wel de vrije N3-ruimte', () => {
  const st = status('s-daan');
  const hoofd = fase(st, 'p-hoofd');
  assert.equal(eis(hoofd, 'c-cre', '2').gevuld, 12);
  assert.equal(eis(hoofd, null, '3').gevuld, 3);
  assert.equal(eis(hoofd, 'c-ond', '3').gevuld, 0);
  assert.equal(hoofd.gevuld, 27);
  assert.equal(hoofd.boven, 3);
  assert.deepEqual(st.totaal, { behaald: 96, vereist: 240, gevuld: 87, boven: 9, zonderFase: 0 });
});

test('een integraal assessment telt op niveau, niet als aparte fase', () => {
  const hoofd = fase(status('s-daan'), 'p-hoofd');
  assert.equal(eis(hoofd, 'c-ler', '2').gevuld, 6);
});

test('keuze-eisen worden gevuld met wat overblijft op hetzelfde niveau', () => {
  const st = status('s-noor');
  const hoofd = fase(st, 'p-hoofd');
  assert.equal(eis(hoofd, null, '2').gevuld, 54);
  assert.equal(hoofd.klaar, true);
  assert.equal(hoofd.boven, 0);
});

test('op stage: stage open met 0 EC, afstuderen wacht op hoofdfase én stage', () => {
  const st = status('s-noor');
  assert.equal(fase(st, 'p-stage').gevuld, 0);
  assert.deepEqual(st.open, ['p-stage']);
  assert.equal(fase(st, 'p-afst').staat, 'dicht');
});

test('stage-assessments tellen voor de stage, niet voor de hoofdfase', () => {
  const st = status('s-mila');
  assert.equal(fase(st, 'p-stage').gevuld, 30);
  assert.equal(fase(st, 'p-hoofd').behaald, 120);
});

test('aan het afstuderen: alleen afstuderen is open, met alle eisen nog open', () => {
  const st = status('s-mila');
  const afst = fase(st, 'p-afst');
  assert.equal(st.totaal.gevuld, 210);
  assert.deepEqual(st.open, ['p-afst']);
  assert.equal(afst.soort, 'graduation');
  assert.deepEqual(afst.tekorten.map(t => [t.competentie, t.niveau, t.tekort]), [['c-ond', '3', 6], ['c-cre', '3', 6], ['c-ler', '3', 3], [null, '3', 15]]);
});

test('stage vol maar hoofdfase niet: afstuderen blijft dicht', () => {
  const st = status('s-femke');
  assert.equal(fase(st, 'p-stage').staat, 'klaar');
  assert.equal(fase(st, 'p-hoofd').staat, 'open');
  assert.equal(fase(st, 'p-afst').staat, 'dicht');
  assert.deepEqual(st.open, ['p-hoofd']);
});

test('alles vol: geen open fase', () => {
  const doelen = [...F.propedeuseVol, ...F.hoofdfaseVol, ...F.stageVol, ...F.afstuderenVol];
  const st = bereken({ competencies: F.competenties, programs: F.programmas, goals: doelen });
  assert.equal(st.totaal.gevuld, 240);
  assert.deepEqual(st.open, []);
  assert.ok(st.fases.every(f => f.staat === 'klaar'));
});

test('matrix: per competentie en niveau gevuld tegen vereist, alleen Propedeuse en Hoofdfase', () => {
  const st = status('s-noor');
  const cel = (id, n) => st.matrix.find(m => m.id === id).cellen.find(c => c.niveau === n);
  assert.deepEqual(cel('c-cre', '2'), { niveau: '2', vereist: 24, gevuld: 24, behaald: 54, keuze: 30, over: 0 });
  assert.deepEqual(cel('c-ond', '3'), { niveau: '3', vereist: 3, gevuld: 3, behaald: 3, keuze: 0, over: 0 });
  assert.equal(cel('c-cre', '3').vereist, 0);
  assert.deepEqual(st.vrij.map(v => v.vereist), [0, 54, 3]);
});

test('matrix: behaald = verplicht + keuze + over, per vakje', () => {
  const st = status('s-daan');
  const cel = (id, n) => st.matrix.find(m => m.id === id).cellen.find(c => c.niveau === n);
  assert.deepEqual(cel('c-cre', '1'), { niveau: '1', vereist: 24, gevuld: 24, behaald: 30, keuze: 0, over: 6 });
  assert.deepEqual(cel('c-cre', '3'), { niveau: '3', vereist: 0, gevuld: 0, behaald: 6, keuze: 3, over: 3 });
  for (const m of st.matrix) for (const c of m.cellen) assert.equal(c.behaald, c.gevuld + c.keuze + c.over, `${m.titel} N${c.niveau}`);
});

test('matrix: de keuze-rij weet welke competenties hem vullen; N1 heeft geen keuze-eis', () => {
  const st = status('s-noor');
  assert.deepEqual(st.vrij.find(v => v.niveau === '2').bijdragen, { 'c-cre': 30, 'c-org': 12, 'c-com': 12 });
  assert.deepEqual(st.keuzeNiveaus, ['2', '3']);
});

test('matrix: stage- en afstudeer-EC staan er niet in', () => {
  const st = status('s-mila');
  const cel = (id, n) => st.matrix.find(m => m.id === id).cellen.find(c => c.niveau === n);
  assert.equal(cel('c-cre', '2').behaald, 54, 'zonder de 21 EC Creëren N2 uit de stage');
});

test('matrix met cum laude: Keuze N3 18, Keuze N2 39, Onderzoeken N3 3', () => {
  const st = metCL('s-jesse');
  assert.deepEqual(st.vrij.map(v => v.vereist), [0, 39, 18]);
  assert.equal(st.matrix.find(m => m.id === 'c-ond').cellen.find(c => c.niveau === '3').vereist, 3);
});

test('resultaat met amount null of 0 telt niet', () => {
  const st = bereken({ competencies: F.competenties, programs: F.programmas, goals: [
    { competency: { id: 'c-ond' }, session: { kind: 'individual' }, result: { amount: null, level: '1' } },
    { competency: { id: 'c-ond' }, session: { kind: 'individual' }, result: { amount: 0, level: '1' } },
  ] });
  assert.equal(st.totaal.behaald, 0);
});

test('stage beoordeeld vóór een afgeronde propedeuse: de EC tellen en worden gemeld', () => {
  const st = bereken({ competencies: F.competenties, programs: F.programmas, goals: [F.r('c-ond', 1, 12), F.r('c-cre', 1, 24), ...F.stageVol] });
  const stage = fase(st, 'p-stage');
  assert.equal(stage.staat, 'klaar');
  assert.equal(stage.gevuld, 30);
  assert.equal(stage.vroeg, true);
  assert.deepEqual(stage.na, ['Propedeuse']);
  assert.deepEqual(st.open, ['p-prop', 'p-hoofd']);
});

test('geen melding als de voorwaarden vol zijn', () => {
  assert.ok(status('s-mila').fases.every(f => !f.vroeg));
});

test('een fase zonder bekende voorwaarden is altijd open', () => {
  const programs = [...F.programmas, { id: 'p-minor', title: 'Minor', position: 4, mandatory: false, sessionKind: 'minor', requirements: [] }];
  const st = bereken({ competencies: F.competenties, programs, goals: [] });
  assert.equal(st.fases.find(f => f.id === 'p-minor').staat, 'klaar');
  assert.deepEqual(st.fases.find(f => f.id === 'p-minor').na, []);
});

// ---------- Cum laude ----------

const metCL = (id, cumLaude = true) => bereken({
  competencies: F.competenties, programs: F.programmas, cumLaude,
  goals: F.studenten.find(s => s.id === id).doelen,
});

test('cum laude uit: geen cum-laudegegevens en de gewone eisen', () => {
  const st = metCL('s-jesse', false);
  assert.equal(st.cumLaude, null);
  assert.equal(eis(fase(st, 'p-hoofd'), null, '2').vereist, 54);
  assert.equal(eis(fase(st, 'p-hoofd'), null, '3').vereist, 3);
});

test('cum laude aan: 15 EC schuiven in de hoofdfase van Keuze N2 naar Keuze N3; totaal blijft 120', () => {
  const hoofd = fase(metCL('s-jesse'), 'p-hoofd');
  assert.equal(eis(hoofd, null, '2').vereist, 39);
  assert.equal(eis(hoofd, null, '3').vereist, 18);
  assert.equal(hoofd.vereist, 120);
});

test('cum laude aan: N3-EC in de hoofdfase tellen voor de 21, met de tekorten per eis', () => {
  const st = metCL('s-jesse');
  const hoofd = fase(st, 'p-hoofd');
  assert.equal(eis(hoofd, null, '3').gevuld, 12);
  assert.equal(eis(hoofd, 'c-ond', '3').gevuld, 3);
  assert.equal(st.cumLaude.vereist, 21);
  assert.equal(st.cumLaude.gevuld, 15);
  assert.equal(st.cumLaude.voldaan, false);
  assert.deepEqual(st.cumLaude.tekorten.map(t => [t.competentie, t.tekort]), [[null, 6]]);
});

test('cum laude aan: tekorten per N3-eis, ook zonder N3-resultaten', () => {
  const st = metCL('s-daan');
  assert.equal(st.cumLaude.gevuld, 6, 'Creëren N3 6 telt voor Keuze N3');
  assert.deepEqual(st.cumLaude.tekorten.map(t => [t.competentie, t.tekort]), [['c-ond', 3], [null, 12]]);
  const st2 = metCL('s-onbekend');
  assert.deepEqual(st2.cumLaude.tekorten.map(t => [t.competentie, t.tekort]), [['c-ond', 3], [null, 18]]);
});

test('cum laude aan: stage- en afstudeer-EC tellen niet mee', () => {
  const st = bereken({ competencies: F.competenties, programs: F.programmas, cumLaude: true,
    goals: [F.r('c-ond', 3, 3, 'internship'), F.r('c-cre', 3, 18, 'graduation')] });
  assert.equal(st.cumLaude.gevuld, 0);
});

test('cum laude voldaan met 21 EC op N3 uit gewone assessments', () => {
  const st = bereken({ competencies: F.competenties, programs: F.programmas, cumLaude: true,
    goals: [F.r('c-ond', 3, 3), F.r('c-cre', 3, 12), F.r('c-ler', 3, 6, 'integral')] });
  assert.equal(st.cumLaude.gevuld, 21);
  assert.equal(st.cumLaude.voldaan, true);
});
