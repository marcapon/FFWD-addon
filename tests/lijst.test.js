// Status, studenten, docenten, zoeken en sorteren in de assessmentlijst (assessmentlijst.js).
// Draaien: node --test (vanuit de map ffwd-addon)

const test = require('node:test');
const assert = require('node:assert/strict');
const { soortVan, statusVan, studentenVan, docentenVan, past, sorteer, studiejaarVan, perStudiejaar, voldoet, filtersActief, docentenIn } = require('../extensie/assessmentlijst.js');

const nu = new Date('2026-10-13T12:00:00Z');
const sessie = (extra = {}) => ({
  id: 'x', title: 'Assessment blok 4', kind: 'integral', context: 'Propedeuse preminor',
  startingAt: '2026-04-09T08:30:00Z', finalized: true,
  students: [{ id: 's1', name: 'Daan Jansen', studentId: '5000102' }, { id: 's2', name: 'Onbekend', studentId: null }],
  teachers: [{ id: 't1', name: 'Eva Smit' }, { id: 't2', name: 'Tom Peters' }],
  assessors: [{ role: 'member', teacherId: 't1' }, { role: 'owner', teacherId: 't2' }],
  assessees: [{ status: 'completed', student: { id: 's1' } }, { status: 'completed', student: { id: 's2' } }],
  ...extra,
});

test('soort: de vier soorten van ffwd in het Nederlands, onbekend blijft zoals het is', () => {
  assert.equal(soortVan('individual'), 'Individueel');
  assert.equal(soortVan('graduation'), 'Afstuderen');
  assert.equal(soortVan('iets-nieuws'), 'iets-nieuws');
});

test('status: afgerond, gepland of open', () => {
  assert.equal(statusVan(sessie(), nu).label, 'Afgerond');
  assert.equal(statusVan(sessie({ finalized: false, startingAt: '2026-10-20T09:00:00Z' }), nu).label, 'Gepland');
  assert.equal(statusVan(sessie({ finalized: false, startingAt: '2026-10-08T09:00:00Z' }), nu).label, 'Open');
});

test('status: telt studenten die niet op completed staan, ook in een afgerond assessment', () => {
  const s = sessie({ assessees: [{ status: 'completed', student: { id: 's1' } }, { status: 'pending', student: { id: 's2' } }] });
  assert.equal(statusVan(s, nu).nogOpen, 1);
  assert.ok(statusVan(s, nu).rang < statusVan(sessie(), nu).rang, 'afgerond met een open student komt eerder dan helemaal afgerond');
});

test('studenten: label en status in ffwd; onbekende naam wordt "Student n"', () => {
  const s = sessie({ assessees: [{ status: 'pending', student: { id: 's2' } }] });
  assert.deepEqual(studentenVan(s), [
    { id: 's1', label: 'Daan Jansen', status: null },
    { id: 's2', label: 'Student 2', status: 'pending' },
  ]);
});

test('docenten: de eigenaar vooraan; zonder naam de initialen', () => {
  assert.deepEqual(docentenVan(sessie()).map(d => [d.label, d.eigenaar]), [['Tom Peters', true], ['Eva Smit', false]]);
  assert.equal(docentenVan(sessie({ teachers: [{ id: 't1', name: '', initials: 'LK' }] }))[0].label, 'LK');
});

test('zoeken: op titel, context, soort, student, studentnummer en docent; elk woord moet passen', () => {
  for (const zoek of ['blok 4', 'preminor', 'integraal', 'daan', '5000102', 'smit', 'DAAN blok']) assert.ok(past(sessie(), zoek), zoek);
  assert.ok(!past(sessie(), 'daan stage'));
  assert.ok(past(sessie(), '  '), 'leeg zoekveld toont alles');
});

test('sorteren: op datum, studenten en titel; bij gelijke waarde het nieuwste eerst', () => {
  const oud = sessie({ id: 'oud', title: 'B', startingAt: '2025-01-01T00:00:00Z' });
  const nieuw = sessie({ id: 'nieuw', title: 'A', startingAt: '2026-01-01T00:00:00Z', students: [] });
  const ids = lijst => lijst.map(s => s.id);
  assert.deepEqual(ids(sorteer([oud, nieuw], 'datum', true)), ['nieuw', 'oud']);
  assert.deepEqual(ids(sorteer([oud, nieuw], 'titel', false)), ['nieuw', 'oud']);
  assert.deepEqual(ids(sorteer([nieuw, oud], 'studenten', true)), ['oud', 'nieuw']);
  assert.deepEqual(ids(sorteer([oud, nieuw], 'soort', false)), ['nieuw', 'oud'], 'zelfde soort: nieuwste eerst');
});

test('studiejaar: van 1 september tot en met 31 augustus', () => {
  assert.equal(studiejaarVan('2026-09-01T00:30:00'), '2026-2027');
  assert.equal(studiejaarVan('2026-08-31T23:30:00'), '2025-2026');
  assert.equal(studiejaarVan('2026-01-22T14:00:00'), '2025-2026');
  assert.equal(studiejaarVan('2026-10-20T09:00:00'), '2026-2027');
});

test('per studiejaar: nieuwste jaar eerst, volgorde binnen het jaar blijft', () => {
  const s = (id, startingAt) => ({ id, startingAt });
  const lijst = [s('okt', '2026-10-08T12:00:00'), s('jun', '2026-06-18T12:00:00'), s('jan', '2026-01-22T12:00:00'), s('jun25', '2025-06-26T12:00:00')];
  const jaren = perStudiejaar(lijst);
  assert.deepEqual(jaren.map(j => [j.jaar, j.sessies.map(x => x.id)]),
    [['2026-2027', ['okt']], ['2025-2026', ['jun', 'jan']], ['2024-2025', ['jun25']]]);
  assert.deepEqual(perStudiejaar([...lijst].reverse(), true).map(j => j.jaar), ['2024-2025', '2025-2026', '2026-2027']);
});

test('filters: zonder filters past alles', () => {
  assert.ok(voldoet(sessie(), {}, nu));
  assert.ok(!filtersActief({ soorten: [], statussen: [], mijn: false, docenten: [] }));
  assert.ok(filtersActief({ mijn: true }));
});

test('filters: soort en status; binnen een filter is één keuze genoeg', () => {
  assert.ok(voldoet(sessie(), { soorten: ['integral', 'internship'] }, nu));
  assert.ok(!voldoet(sessie(), { soorten: ['internship'] }, nu));
  assert.ok(voldoet(sessie(), { statussen: ['klaar'] }, nu));
  assert.ok(!voldoet(sessie(), { statussen: ['open', 'gepland'] }, nu));
  const gepland = sessie({ finalized: false, startingAt: '2026-10-20T09:00:00Z' });
  assert.ok(voldoet(gepland, { statussen: ['open', 'gepland'] }, nu));
});

test('filters: student niet afgerond alleen bij een afgerond assessment met een student op pending', () => {
  const pending = [{ status: 'completed', student: { id: 's1' } }, { status: 'pending', student: { id: 's2' } }];
  assert.ok(voldoet(sessie({ assessees: pending }), { statussen: ['aandacht'] }, nu));
  assert.ok(!voldoet(sessie(), { statussen: ['aandacht'] }, nu));
  assert.ok(!voldoet(sessie({ finalized: false, startingAt: '2026-10-08T09:00:00Z', assessees: pending }), { statussen: ['aandacht'] }, nu));
});

test('filters: alleen van mij en docent; tussen filters moet alles kloppen', () => {
  assert.ok(voldoet(sessie({ owned: true }), { mijn: true }, nu));
  assert.ok(!voldoet(sessie({ owned: false }), { mijn: true }, nu));
  assert.ok(voldoet(sessie(), { docenten: ['t1'] }, nu));
  assert.ok(voldoet(sessie(), { docenten: ['t9', 't2'] }, nu), 'één van de gekozen docenten is genoeg');
  assert.ok(!voldoet(sessie(), { docenten: ['t9'] }, nu));
  assert.ok(filtersActief({ docenten: ['t1'] }));
  assert.ok(!voldoet(sessie({ owned: true }), { mijn: true, soorten: ['graduation'] }, nu));
});

test('docenten in de lijst: één keer, op naam', () => {
  const a = sessie(), b = sessie({ teachers: [{ id: 't1', name: 'Eva Smit' }, { id: 't3', name: 'Anna de Boer' }], assessors: [] });
  assert.deepEqual(docentenIn([a, b]).map(d => d.label), ['Anna de Boer', 'Eva Smit', 'Tom Peters']);
});
