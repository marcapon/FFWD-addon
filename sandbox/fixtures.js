// Verzonnen testdata voor de sandbox en de tests. Geen echte studenten: namen en nummers zijn bedacht.
// De eisen per fase volgen de opleiding (ffwd `programs`, opgehaald op 13-10-2026); de id's zijn nep.

const FfwdFixtures = (() => {
  const ond = 'c-ond', cre = 'c-cre', org = 'c-org', com = 'c-com', ler = 'c-ler';
  const niveaus = ['1', '2', '3'];
  const competenties = [
    { id: ond, title: 'Onderzoeken', position: 0, levels: niveaus },
    { id: cre, title: 'Creëren', position: 1, levels: niveaus },
    { id: org, title: 'Organiseren', position: 2, levels: niveaus },
    { id: com, title: 'Communiceren', position: 3, levels: niveaus },
    { id: ler, title: 'Leren', position: 4, levels: niveaus },
  ];

  const eis = (competentie, niveau, amount) => ({ amount, level: String(niveau), competency: competentie ? { id: competentie } : null });
  const programmas = [
    { id: 'p-prop', title: 'Propedeuse', position: 0, mandatory: true, sessionKind: null,
      requirements: [eis(ond, 1, 12), eis(cre, 1, 24), eis(org, 1, 6), eis(com, 1, 6), eis(ler, 1, 12)] },
    { id: 'p-hoofd', title: 'Hoofdfase', position: 1, mandatory: true, sessionKind: null,
      requirements: [eis(ond, 2, 12), eis(ond, 3, 3), eis(cre, 2, 24), eis(org, 2, 6), eis(com, 2, 6), eis(ler, 2, 12), eis(null, 3, 3), eis(null, 2, 54)] },
    { id: 'p-stage', title: 'Stage', position: 2, mandatory: true, sessionKind: 'internship',
      requirements: [eis(cre, 2, 6), eis(org, 2, 3), eis(com, 2, 3), eis(ler, 2, 3), eis(null, 2, 15)] },
    { id: 'p-afst', title: 'Afstuderen', position: 3, mandatory: true, sessionKind: 'graduation',
      requirements: [eis(ond, 3, 6), eis(cre, 3, 6), eis(ler, 3, 3), eis(null, 3, 15)] },
  ];

  // Eén doel met resultaat; soort = individual, integral, internship of graduation (zoals in ffwd).
  // Stage en afstuderen worden in één assessment beoordeeld: alle 30 EC tegelijk, of nog niets.
  const r = (competentie, niveau, amount, soort = 'individual') => ({
    competency: { id: competentie }, session: { kind: soort, finalized: true }, result: { amount, level: String(niveau) },
  });
  const nogOpen = (competentie, niveau) => ({ competency: { id: competentie }, session: { kind: 'individual', finalized: false }, result: null });
  const propedeuseVol = [r(ond, 1, 12), r(cre, 1, 24), r(org, 1, 6), r(com, 1, 6), r(ler, 1, 12)];
  const hoofdfaseVol = [r(ond, 2, 12), r(ond, 3, 3), r(cre, 2, 24), r(org, 2, 6), r(com, 2, 6), r(ler, 2, 12),
    r(cre, 2, 30), r(com, 2, 12), r(org, 2, 12), r(cre, 3, 3)];
  const stageVol = [r(cre, 2, 6, 'internship'), r(org, 2, 3, 'internship'), r(com, 2, 3, 'internship'), r(ler, 2, 3, 'internship'), r(cre, 2, 15, 'internship')];
  const afstuderenVol = [r(ond, 3, 6, 'graduation'), r(cre, 3, 6, 'graduation'), r(ler, 3, 3, 'graduation'), r(cre, 3, 15, 'graduation')];

  const studenten = [
    { id: 's-sanne', name: 'Sanne de Vries', studentId: '5000101', groep: 'Mentorstudenten', rol: 'Eerstejaars, propedeuse bezig',
      sessies: ['Assessment blok 1'], doelen: [r(ond, 1, 6), r(cre, 1, 12), r(com, 1, 6), nogOpen(org, 1)] },
    { id: 's-daan', name: 'Daan Jansen', studentId: '5000102', groep: 'Mentorstudenten', rol: 'Propedeuse vol met overschot, hoofdfase bezig',
      sessies: ['Assessment blok 4', 'Integraal assessment jaar 2'],
      doelen: [...propedeuseVol, r(cre, 1, 6), r(ond, 2, 6), r(cre, 2, 12), r(ler, 2, 6, 'integral'), r(cre, 3, 6)] },
    { id: 's-noor', name: 'Noor El Amrani', studentId: '5000103', groep: 'Stagestudenten', rol: 'Hoofdfase vol, op stage',
      sessies: ['Integraal assessment jaar 3'], doelen: [...propedeuseVol, ...hoofdfaseVol] },
    { id: 's-mila', name: 'Mila Visser', studentId: '5000104', groep: 'Afstudeerstudenten', rol: 'Stage vol, aan het afstuderen',
      sessies: ['Integraal assessment jaar 3', 'Stage-assessment'], doelen: [...propedeuseVol, ...hoofdfaseVol, ...stageVol] },
    { id: 's-femke', name: 'Femke Mulder', studentId: '5000105', groep: 'Stagestudenten', rol: 'Stage afgerond, hoofdfase nog niet vol',
      sessies: ['Assessment blok 4', 'Stage-assessment'],
      doelen: [...propedeuseVol, ...stageVol, r(ond, 2, 12), r(cre, 2, 24), r(org, 2, 6), r(com, 2, 6), r(ler, 2, 6), r(cre, 2, 12)] },
    { id: 's-jesse', name: 'Jesse Bos', studentId: '5000106', groep: 'Mentorstudenten', rol: 'Gaat voor cum laude, nog 6 EC op N3',
      sessies: ['Integraal assessment jaar 2', 'Integraal assessment jaar 3'],
      doelen: [...propedeuseVol, r(ond, 2, 12), r(cre, 2, 24), r(org, 2, 6), r(com, 2, 6), r(ler, 2, 12), r(cre, 2, 20),
        r(ond, 3, 3), r(cre, 3, 9), r(ler, 3, 3, 'integral')] },
    { id: 's-onbekend', name: 'Onbekend', studentId: null, groep: 'Mentorstudenten', rol: 'Naam onbekend, nog geen resultaten',
      sessies: [], doelen: [] },
  ];

  // Verzonnen docenten; d-jij is de ingelogde docent in de sandbox
  const docenten = [
    { id: 'd-jij', name: 'Docent (verzonnen)', initials: 'DV' },
    { id: 'd-eva', name: 'Eva Smit', initials: 'ES' },
    { id: 'd-tom', name: 'Tom Peters', initials: 'TP' },
    { id: 'd-lisa', name: '', initials: 'LK' },
  ];

  // Verzonnen assessments (ffwd `session`). kind, context, datums en finalized zoals in ffwd;
  // docenten: de eerste is de eigenaar (role owner), de rest member. pending: studenten die niet op 'completed' staan.
  const assessments = [
    { id: 'a-integraal', title: 'Integraal assessment jaar 2', soort: 'Integraal assessment', kind: 'integral', context: 'Hoofdfase jaar 2',
      startingAt: '2026-10-20T09:00:00Z', deadlineAt: '2026-10-27T16:00:00Z', finalized: false,
      studenten: ['s-daan', 's-noor', 's-onbekend'], docenten: ['d-jij', 'd-eva'], pending: ['s-daan', 's-noor', 's-onbekend'] },
    { id: 'a-jesse', title: 'Eindassessment Jesse', soort: 'Individueel assessment', kind: 'individual', context: null,
      startingAt: '2026-10-08T13:30:00Z', deadlineAt: '2026-10-10T16:00:00Z', finalized: false,
      studenten: ['s-jesse'], docenten: ['d-eva', 'd-jij'], pending: ['s-jesse'] },
    { id: 'a-stage', title: 'Stage-assessment', soort: 'Stage-assessment', kind: 'internship', context: 'Stage voorjaar',
      startingAt: '2026-06-18T10:00:00Z', deadlineAt: '2026-06-25T16:00:00Z', finalized: true,
      studenten: ['s-mila', 's-femke'], docenten: ['d-jij', 'd-tom', 'd-lisa'], pending: ['s-femke'] },
    { id: 'a-blok4', title: 'Assessment blok 4', soort: 'Integraal assessment', kind: 'integral', context: 'Propedeuse preminor',
      startingAt: '2026-04-09T08:30:00Z', deadlineAt: '2026-04-16T16:00:00Z', finalized: true,
      studenten: ['s-sanne', 's-daan', 's-femke', 's-jesse', 's-onbekend'], docenten: ['d-tom', 'd-jij', 'd-eva', 'd-lisa'], pending: [] },
    { id: 'a-minor', title: 'Minor Game Design eindpresentatie', soort: 'Individueel assessment', kind: 'individual', context: 'Minor Game Design',
      startingAt: '2026-01-22T14:00:00Z', deadlineAt: '2026-01-29T16:00:00Z', finalized: true,
      studenten: ['s-noor'], docenten: ['d-jij'], pending: [] },
    { id: 'a-jaar1', title: 'Assessment blok 1', soort: 'Individueel assessment', kind: 'individual', context: 'Propedeuse',
      startingAt: '2025-06-26T09:00:00Z', deadlineAt: '2025-07-03T16:00:00Z', finalized: true,
      studenten: ['s-daan'], docenten: ['d-tom', 'd-jij'], pending: [] },
  ];

  // Verzonnen feedback voor de feedbackexport, zoals pastSessions(studentId) hem teruggeeft:
  // posts aan een leerdoel (goalId) en algemene posts bij het assessment. Bij een groepsassessment staan
  // ook de leerdoelen van medestudenten erin, zoals in ffwd; de export moet die weglaten.
  const doc = id => { const d = docenten.find(x => x.id === id); return { id: d.id, name: d.name, initials: d.initials }; };
  const leerling = id => { const s = studenten.find(x => x.id === id); return { id: s.id, name: s.name, studentId: s.studentId }; };
  let volg = 0;
  const post = (docentId, body, goalId = null, insertedAt = '2026-04-16T12:00:00Z') => ({ id: 'p' + ++volg, goalId, body, insertedAt, author: doc(docentId) });
  const doel = (studentId, competentie, niveau, amount, description, posts) => {
    const id = 'g' + ++volg;
    return { id, level: String(niveau), description, competency: { id: competentie }, student: leerling(studentId),
      result: amount == null ? null : { amount, level: String(niveau) }, posts: posts.map(p => ({ ...p, goalId: id })) };
  };
  const sessie = (a, doelen, algemeen = []) => ({
    id: a.id, title: a.title, kind: a.kind, context: a.context, startingAt: a.startingAt, finalized: a.finalized,
    students: a.studenten.map(leerling), goals: doelen, posts: [...doelen.flatMap(g => g.posts), ...algemeen],
  });
  const A = id => assessments.find(a => a.id === id);
  const feedbackSessies = [
    sessie(A('a-jaar1'), [
      doel('s-daan', cre, 1, 6, 'Ik maak drie schetsontwerpen voor de poster en kies er één met feedback van klasgenoten.', [
        post('d-tom', '<p>Daan, je schetsen zijn <strong>gevarieerd</strong> en je keuze is goed onderbouwd.</p><p>Let op:</p><ul><li>noteer wie je feedback gaf;</li><li>bewaar ook de afgevallen schetsen.</li></ul>', null, '2025-07-01T10:00:00Z')]),
      doel('s-daan', ond, 1, 6, 'Ik onderzoek met vijf interviews wat de doelgroep van een poster verwacht.', [
        post('d-jij', '<h4>Onderzoek</h4><p>Goede interviews. De conclusies mogen&nbsp;scherper: wat betekent dit voor je ontwerp?</p>', null, '2025-07-01T11:00:00Z')]),
    ]),
    sessie(A('a-blok4'), [
      doel('s-daan', cre, 2, 6, 'Ik ontwerp een interactief prototype en test het met gebruikers.', [
        post('d-eva', '<p>Sterk prototype. De tweede testronde laat goed zien wat je hebt geleerd.</p><ol><li>Iteraties zijn duidelijk.</li><li>De afweging tussen alternatieven mag explicieter.</li></ol>')]),
      doel('s-daan', com, 1, 0, 'Ik presenteer ons concept aan de opdrachtgever.', []),
      doel('s-sanne', cre, 1, 6, 'Ik maak een moodboard voor de huisstijl.', [
        post('d-tom', '<p>Sanne, mooi moodboard. Dit hoort NIET in de export van Daan.</p>')]),
    ], [post('d-tom', '<p>Als team hebben jullie goed samengewerkt. Sanne en Daan namen het voortouw bij de presentatie.</p>')]),
    sessie(A('a-integraal'), [
      doel('s-daan', ler, 2, null, 'Nog niet afgerond: dit hoort niet in de export.', [post('d-jij', '<p>Concept, nog niet afgerond.</p>')]),
    ]),
    sessie(A('a-minor'), [
      doel('s-noor', cre, 3, 6, 'Ik ontwikkel een speelbare demo met een eigen spelmechaniek.', [
        post('d-jij', '<p>Een overtuigende demo. Noor laat zien dat ze zelfstandig keuzes maakt en verantwoordt.</p><blockquote><p>De spelers bleven spelen.</p></blockquote>', null, '2026-01-29T10:00:00Z')]),
    ]),
  ];
  const feedbackVan = studentId => feedbackSessies.filter(s => s.students.some(x => x.id === studentId));

  return { competenties, programmas, studenten, docenten, assessments, r, propedeuseVol, hoofdfaseVol, stageVol, afstuderenVol, feedbackSessies, feedbackVan };
})();

if (typeof module === 'object') module.exports = FfwdFixtures;
