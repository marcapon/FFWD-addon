// Feedbackexport (feedback.js): HTML naar Markdown en de opbouw van het document, op verzonnen data uit sandbox/fixtures.js.
// Draaien: node --test (vanuit de map ffwd-addon)

const test = require('node:test');
const assert = require('node:assert/strict');
const { htmlNaarMarkdown: md, bouw, tel, bestandsnaam } = require('../extensie/feedback.js');
const F = require('../sandbox/fixtures.js');

const daan = { id: 's-daan', name: 'Daan Jansen', studentId: '5000102' };
const doc = (opties = {}, student = daan) => bouw({
  sessies: F.feedbackVan(student.id), student, competenties: F.competenties, vandaag: '2026-11-09', opties,
});

// ---------- HTML naar Markdown ----------

test('alinea\'s, vet en cursief', () => {
  assert.equal(md('<p>Een <strong>sterk</strong> en <em>helder</em> verslag.</p><p>Tweede alinea.</p>'),
    'Een **sterk** en *helder* verslag.\n\nTweede alinea.');
});

test('spaties rond vet blijven buiten de sterretjes', () => {
  assert.equal(md('<p>heel<strong> goed </strong>gedaan</p>'), 'heel **goed** gedaan');
  assert.equal(md('<p><strong> </strong>leeg</p>'), 'leeg');
});

test('lijsten, genummerd en genest', () => {
  assert.equal(md('<ul><li>een</li><li>twee</li></ul>'), '- een\n- twee');
  assert.equal(md('<ol><li>een</li><li>twee</li></ol>'), '1. een\n2. twee');
  assert.equal(md('<ul><li><p>een</p></li><li>twee<ul><li>sub</li></ul></li></ul>'), '- een\n- twee\n  - sub');
});

test('kopjes in de feedback worden vetgedrukte regels', () => {
  assert.equal(md('<h4>Onderzoek</h4><p>Goed.</p>'), '**Onderzoek**\n\nGoed.');
  assert.equal(md('<h3><strong>Al vet</strong></h3>'), '**Al vet**');
});

test('br, citaat, lijn en link', () => {
  assert.equal(md('<p>regel een<br>regel twee</p>'), 'regel een\nregel twee');
  assert.equal(md('<blockquote><p>citaat</p></blockquote>'), '> citaat');
  assert.equal(md('<p>a</p><hr><p>b</p>'), 'a\n\n---\n\nb');
  assert.equal(md('<a href="https://example.org">site</a>'), '[site](https://example.org)');
  assert.equal(md('<a href="javascript:x">tekst</a>'), 'tekst');
});

test('entiteiten en witruimte', () => {
  assert.equal(md('<p>A&amp;B&nbsp;&lt;3 &#233;&#x00EB; &hellip;</p>'), 'A&B <3 éë …');
  assert.equal(md('<p>\n  veel\n   ruimte  </p>'), 'veel ruimte');
  assert.equal(md(''), '');
  assert.equal(md(null), '');
  assert.equal(md('platte tekst'), 'platte tekst');
});

test('kapotte HTML gaat niet mis', () => {
  assert.equal(md('<p>open <strong>vet</p><p>daarna</p>'), 'open **vet**\n\ndaarna');
  assert.equal(md('</em>los</p> 1 < 2'), 'los 1 < 2');
  assert.equal(md('<script>alert(1)</script><p>ok</p>'), 'ok');
});

// ---------- Document ----------

test('alleen de eigen leerdoelen: niets van een medestudent in een groepsassessment', () => {
  const d = doc();
  assert.ok(!d.includes('moodboard'));
  assert.ok(!d.includes('NIET in de export'));
});

test('alleen afgeronde assessments', () => {
  const d = doc();
  assert.ok(!d.includes('Nog niet afgerond'));
  assert.ok(!d.includes('Concept, nog niet afgerond'));
});

test('indeling: per competentie in de volgorde van ffwd, dan niveau N3 → N1', () => {
  const d = doc();
  const koppen = d.split('\n').filter(r => /^#{2,3} /.test(r));
  assert.deepEqual(koppen, ['## Onderzoeken', '### N1', '## Creëren', '### N2', '### N1', '## Communiceren', '### N1']);
});

test('binnen een niveau: nieuw → oud', () => {
  const sessies = F.feedbackVan('s-daan').map(s => ({ ...s, goals: s.goals.map(g => ({ ...g, competency: { id: 'c-cre' }, level: '1', result: g.result && { ...g.result, level: '1' } })) }));
  const d = bouw({ sessies, student: daan, competenties: F.competenties, vandaag: '2026-11-09' });
  const datums = d.split('\n').filter(r => r.startsWith('#### ')).map(r => r.slice(5, 15));
  assert.deepEqual(datums, [...datums].sort().reverse());
  assert.equal(datums[0], '2026-04-09');
});

test('kopblok, resultaat, leerdoel en feedback met docent', () => {
  const d = doc();
  assert.match(d, /^---\nstudent: Daan Jansen \(5000102\)\ngeëxporteerd: 2026-11-09\n/);
  assert.match(d, /competenties: alle/);
  assert.match(d, /#### 2026-04-09 · Assessment blok 4 · Propedeuse preminor \(integraal\)\nResultaat: 6 EC op N2/);
  assert.match(d, /\*\*Leerdoel \(student\):\*\* Ik ontwerp een interactief prototype/);
  assert.match(d, /\*\*Feedback \(Eva Smit, 2026-04-16\):\*\*\n\nSterk prototype/);
  assert.match(d, /1\. Iteraties zijn duidelijk\.\n2\. De afweging/);
});

test('leerdoel zonder feedback en zonder EC', () => {
  const d = doc();
  assert.match(d, /## Communiceren\n\n### N1\n\n#### [^\n]+\nResultaat: geen EC\n\n\*\*Leerdoel[^\n]+\n\n\*Geen schriftelijke feedback bij dit leerdoel\.\*/);
});

test('keuze van competenties', () => {
  const d = doc({ competenties: ['c-cre'] });
  assert.match(d, /competenties: Creëren/);
  assert.ok(d.includes('## Creëren'));
  assert.ok(!d.includes('## Onderzoeken'));
  assert.match(doc({ competenties: [] }), /Geen feedback gevonden/);
});

test('leerdoelen weglaten', () => {
  assert.ok(!doc({ leerdoelen: false }).includes('**Leerdoel'));
});

test('algemene feedback alleen als gevraagd, met een waarschuwing bij een groepsassessment', () => {
  assert.ok(!doc().includes('Algemene feedback bij assessments'));
  const d = doc({ algemeen: true });
  assert.match(d, /## Algemene feedback bij assessments\n\n> Bij groepsassessments kan deze feedback ook over medestudenten gaan\./);
  assert.ok(d.includes('Als team hebben jullie goed samengewerkt'));
});

test('pseudoniem: geen naam, nummer of docentnaam; naam in de tekst vervangen', () => {
  const d = doc({ pseudoniem: true, algemeen: true });
  assert.ok(!d.includes('Daan'));
  assert.ok(!d.includes('Jansen'));
  assert.ok(!d.includes('5000102'));
  assert.ok(!d.includes('Eva Smit'));
  assert.match(d, /student: pseudoniem/);
  assert.match(d, /# Eerdere feedback · Student/);
  assert.match(d, /\[student\], je schetsen/);
  assert.match(d, /Feedback \(ES, /);
});

test('student zonder naam in ffwd: studentnummer', () => {
  const d = doc({}, { id: 's-daan', name: 'Onbekend', studentId: '5000102' });
  assert.match(d, /student: student 5000102\n/);
});

test('EC-stand komt bovenaan als die er is', () => {
  const d = bouw({ sessies: F.feedbackVan('s-daan'), student: daan, competenties: F.competenties, vandaag: '2026-11-09', stand: '84 van 240 EC' });
  assert.match(d, /\*\*EC-stand:\*\* 84 van 240 EC/);
});

test('tellingen voor het paneel', () => {
  const t = tel(F.feedbackVan('s-daan'), 's-daan');
  assert.deepEqual(t, { doelen: 4, assessments: 2, algemeen: 1, perCompetentie: { 'c-cre': 2, 'c-ond': 1, 'c-com': 1 } });
  assert.equal(tel([], 's-x').doelen, 0);
});

test('bestandsnaam zonder vreemde tekens', () => {
  assert.equal(bestandsnaam({ name: 'Noor El Amrani' }, '2026-11-09'), 'feedback-noor-el-amrani-2026-11-09.md');
  assert.equal(bestandsnaam({ name: 'Zoë d\'Arc' }, '2026-11-09'), 'feedback-zoe-d-arc-2026-11-09.md');
  assert.equal(bestandsnaam({ name: 'Onbekend', studentId: '500' }, '2026-11-09'), 'feedback-500-2026-11-09.md');
  assert.equal(bestandsnaam({ name: 'Noor' }, '2026-11-09', true), 'feedback-student-2026-11-09.md');
});
