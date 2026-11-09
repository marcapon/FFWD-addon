// Feedbackexport: de schriftelijke feedback uit eerdere assessments van één student als Markdown,
// om verder te gebruiken in de beoordeling (ook samen met AI). Kopiëren of downloaden; niets wordt opgeslagen of verstuurd.
//
// Indeling (besloten 9-11-2026): per competentie (volgorde van ffwd), per niveau (N3 → N1), per assessment (nieuw → oud).
// Per leerdoel: resultaat, docent, het leerdoel van de student en de feedback. Algemene feedback bij een assessment
// (posts zonder leerdoel) staat apart onderaan; bij groepsassessments kan die over meer studenten gaan.
//
// Let op: bij een groepsassessment geeft ffwd de leerdoelen en feedback van álle studenten in dat assessment.
// Alleen de leerdoelen van deze student (goal.student.id) komen in de export.
//
// Het pure deel (FfwdFeedback: HTML naar Markdown, document opbouwen) heeft geen DOM en geen netwerk,
// zodat het met Node te testen is (tests/feedback.test.js). Het paneel staat onderaan en draait alleen in de browser.

const FfwdFeedback = (() => {
  // ---------- HTML naar Markdown ----------
  // De feedback in ffwd is HTML uit een editor: p, br, strong/b, em/i, ul/ol/li, h3–h5, blockquote, hr, a.
  // Kopjes in de feedback worden vetgedrukte regels, zodat ze de kopjes van het document niet verstoren.

  const ENTITEITEN = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', euml: 'ë', eacute: 'é', iuml: 'ï', ouml: 'ö', uuml: 'ü', egrave: 'è', agrave: 'à', ccedil: 'ç', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
  const decodeer = t => t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, c) =>
    c[0] === '#' ? String.fromCodePoint(c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10))
      : ENTITEITEN[c.toLowerCase()] ?? m);

  const LEEG = new Set(['br', 'hr', 'img', 'wbr', 'input', 'meta', 'link', 'col', 'source']);
  const WEG = new Set(['script', 'style', 'template']);

  // Een kleine boom: { tag, attrs, kinderen } of een string. Losse sluittags worden genegeerd.
  function ontleed(html) {
    const wortel = { tag: '', attrs: '', kinderen: [] };
    const stapel = [wortel];
    for (const [stuk, sluit, tag, attrs] of String(html ?? '').matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|<!--[\s\S]*?-->|[^<]+|</g)) {
      const top = stapel[stapel.length - 1];
      if (!tag) { if (!stuk.startsWith('<!--')) top.kinderen.push(stuk); continue; }
      const naam = tag.toLowerCase();
      if (sluit) {
        const i = stapel.map(n => n.tag).lastIndexOf(naam);
        if (i > 0) stapel.length = i;
        continue;
      }
      const knoop = { tag: naam, attrs, kinderen: [] };
      top.kinderen.push(knoop);
      if (!LEEG.has(naam) && !attrs.trim().endsWith('/')) stapel.push(knoop);
    }
    return wortel;
  }

  const INSPRING = '\u0001'; // tijdelijk teken voor inspringen in lijsten; wordt aan het eind een spatie
  const netjes = t => t.split('\n').map(r => r.replace(/^ +| +$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const omhul = (binnen, teken) => {
    const [, voor, kern, na] = binnen.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return kern ? voor + teken + kern + teken + na : binnen;
  };
  const href = attrs => attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i)?.slice(2).find(v => v != null);

  function tekst(knoop) {
    if (typeof knoop === 'string') return decodeer(knoop.replace(/\s+/g, ' '));
    const binnen = () => knoop.kinderen.map(tekst).join('');
    switch (knoop.tag) {
      case 'br': return '\n';
      case 'hr': return '\n\n---\n\n';
      case 'strong': case 'b': return omhul(binnen(), '**');
      case 'em': case 'i': return omhul(binnen(), '*');
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const t = netjes(binnen()).replace(/\n/g, ' ');
        return t ? `\n\n**${t.replace(/^\*\*|\*\*$/g, '')}**\n\n` : '';
      }
      case 'p': case 'div': case 'section': case 'article': case 'figure': case 'table': case 'tr':
        return '\n\n' + binnen() + '\n\n';
      case 'td': case 'th': return binnen() + ' ';
      case 'blockquote': return '\n\n' + netjes(binnen()).split('\n').map(r => r ? '> ' + r : '>').join('\n') + '\n\n';
      case 'ul': case 'ol': {
        let n = 0;
        const punten = knoop.kinderen.filter(k => typeof k !== 'string' || k.trim()).map(k => {
          const teken = knoop.tag === 'ol' ? `${++n}. ` : '- ';
          const inhoud = netjes(typeof k === 'string' ? tekst(k) : k.tag === 'li' ? k.kinderen.map(tekst).join('') : tekst(k)).replace(/\n{2,}/g, '\n');
          return teken + inhoud.split('\n').map((r, i) => i ? INSPRING.repeat(teken.length) + r : r).join('\n');
        });
        return '\n\n' + punten.join('\n') + '\n\n';
      }
      case 'a': {
        const t = binnen(), link = href(knoop.attrs);
        return link && /^https?:/i.test(link) && link !== t.trim() ? `[${t.trim()}](${link})` : t;
      }
      default: return WEG.has(knoop.tag) ? '' : binnen();
    }
  }

  const htmlNaarMarkdown = html => netjes(tekst(ontleed(html))).replaceAll(INSPRING, ' ');

  // ---------- Het document ----------

  const NIVEAU = n => 'N' + n;
  const SOORT = { individual: 'individueel', integral: 'integraal', internship: 'stage', graduation: 'afstuderen' };
  const datum = iso => (iso || '').slice(0, 10);
  const naamBekend = n => n && n !== 'Onbekend';

  // Docent: de naam, bij pseudoniem de initialen; ffwd kent niet van iedereen de naam
  const docent = (t, pseudo) => !t ? 'onbekende docent'
    : pseudo ? (t.initials && t.initials !== '??' ? t.initials : 'docent')
    : naamBekend(t.name) ? t.name : t.initials && t.initials !== '??' ? t.initials : 'onbekende docent';

  // Haalt uit de assessments van de API wat bij deze student hoort: alleen afgeronde assessments,
  // alleen de eigen leerdoelen, en de algemene feedback (posts zonder leerdoel).
  function verzamel(sessies, studentId) {
    const doelen = [], algemeen = [];
    for (const s of sessies || []) {
      if (!s?.finalized) continue;
      for (const g of s.goals || []) {
        if (g.student?.id !== studentId) continue;
        doelen.push({ sessie: s, doel: g, posts: (g.posts || []).filter(p => p.body?.trim()) });
      }
      const los = (s.posts || []).filter(p => !p.goalId && !p.goal && p.body?.trim());
      if (los.length) algemeen.push({ sessie: s, posts: los, groep: (s.students || []).length > 1 });
    }
    return { doelen, algemeen };
  }

  // Tellingen voor het paneel: per competentie het aantal leerdoelen, en hoeveel assessments
  function tel(sessies, studentId) {
    const { doelen, algemeen } = verzamel(sessies, studentId);
    const perCompetentie = {};
    for (const d of doelen) { const c = d.doel.competency?.id ?? '?'; perCompetentie[c] = (perCompetentie[c] || 0) + 1; }
    return { doelen: doelen.length, assessments: new Set(doelen.map(d => d.sessie.id)).size, algemeen: algemeen.length, perCompetentie };
  }

  // Een ruwe schatting voor het paneel: ongeveer 4 tekens per token
  const tokens = tekst => Math.round(tekst.length / 4);

  // Opties: competenties (lijst met id's, of null voor alle), leerdoelen (bool), algemeen (bool), pseudoniem (bool).
  // student: { id, name, studentId }; stand: korte regel met de EC-stand (optioneel); vandaag: 'JJJJ-MM-DD'.
  function bouw({ sessies, student, competenties, opties = {}, stand = null, vandaag }) {
    const o = { competenties: null, leerdoelen: true, algemeen: false, pseudoniem: false, ...opties };
    const pseudo = !!o.pseudoniem;
    const { doelen, algemeen } = verzamel(sessies, student.id);
    const gekozen = o.competenties ? new Set(o.competenties) : null;
    const lijst = [...(competenties || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const naam = pseudo ? 'de student' : naamBekend(student.name) ? student.name : student.studentId ? 'student ' + student.studentId : 'onbekende student';

    // Bij pseudoniem: de naam van de student ook in de tekst vervangen (voor- en achternaam als losse woorden)
    const namen = pseudo && naamBekend(student.name) ? student.name.split(/\s+/).filter(w => w.length > 2 && /^\p{Lu}/u.test(w)) : [];
    const verberg = t => namen.reduce((acc, w) => acc.replace(new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'gu'), '[student]'), t);
    const md = html => verberg(htmlNaarMarkdown(html));

    const nieuwNaarOud = (a, b) => (b.sessie.startingAt || '').localeCompare(a.sessie.startingAt || '');
    const niveauVan = d => String(d.doel.result?.level ?? d.doel.level ?? '?');
    const kopAssessment = s => `${datum(s.startingAt)} · ${verberg(s.title || 'Assessment zonder titel')}${s.context ? ' · ' + verberg(s.context) : ''} (${SOORT[s.kind] ?? s.kind ?? 'onbekend'})`;
    const feedback = posts => posts.length
      ? posts.map(p => `**Feedback (${docent(p.author, pseudo)}${p.insertedAt ? ', ' + datum(p.insertedAt) : ''}):**\n\n${md(p.body)}`).join('\n\n')
      : '*Geen schriftelijke feedback bij dit leerdoel.*';

    const regels = [
      '---',
      `student: ${pseudo ? 'pseudoniem' : naam + (student.studentId && naamBekend(student.name) ? ` (${student.studentId})` : '')}`,
      `geëxporteerd: ${vandaag}`,
      'bron: ffwd, alleen afgeronde assessments',
      `competenties: ${gekozen ? lijst.filter(c => gekozen.has(c.id)).map(c => c.title).join(', ') || 'geen' : 'alle'}`,
      'volgorde: per competentie, per niveau (N3 → N1), nieuw → oud',
      '---',
      '',
      `# Eerdere feedback · ${pseudo ? 'Student' : naam}`,
      '',
    ];
    if (stand) regels.push(`**EC-stand:** ${stand}`, '');
    regels.push('Schriftelijke feedback van docenten uit eerdere assessments, per competentie en niveau.' +
      (o.leerdoelen ? ' Bij elk leerdoel staat eerst wat de student zich voornam, dan de feedback.' : ''), '');

    let aantal = 0;
    for (const c of lijst) {
      if (gekozen && !gekozen.has(c.id)) continue;
      const vanC = doelen.filter(d => d.doel.competency?.id === c.id);
      if (!vanC.length) continue;
      regels.push(`## ${c.title}`, '');
      const niveaus = [...new Set(vanC.map(niveauVan))].sort((a, b) => b.localeCompare(a, 'nl', { numeric: true }));
      for (const n of niveaus) {
        regels.push(`### ${NIVEAU(n)}`, '');
        for (const d of vanC.filter(d => niveauVan(d) === n).sort(nieuwNaarOud)) {
          aantal++;
          const r = d.doel.result;
          regels.push(`#### ${kopAssessment(d.sessie)}`,
            `Resultaat: ${r?.amount ? `${r.amount} EC op ${NIVEAU(r.level ?? n)}` : 'geen EC'}` +
            (d.doel.level && r?.level && String(d.doel.level) !== String(r.level) ? ` (leerdoel op ${NIVEAU(d.doel.level)})` : ''), '');
          if (o.leerdoelen && d.doel.description?.trim()) regels.push(`**Leerdoel (student):** ${verberg(d.doel.description.trim().replace(/\s*\n\s*/g, ' '))}`, '');
          regels.push(feedback(d.posts), '');
        }
      }
    }
    if (!aantal) regels.push('*Geen feedback gevonden bij de gekozen competenties.*', '');

    if (o.algemeen && algemeen.length) {
      regels.push('## Algemene feedback bij assessments', '');
      if (algemeen.some(a => a.groep)) regels.push('> Bij groepsassessments kan deze feedback ook over medestudenten gaan.', '');
      for (const a of [...algemeen].sort(nieuwNaarOud)) {
        regels.push(`#### ${kopAssessment(a.sessie)}`, '', feedback(a.posts), '');
      }
    }
    return regels.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // Bestandsnaam: feedback-<naam of nummer>-<datum>.md, zonder vreemde tekens
  const bestandsnaam = (student, vandaag, pseudoniem) => {
    const deel = pseudoniem ? 'student' : naamBekend(student.name) ? student.name : student.studentId || 'student';
    return `feedback-${deel.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${vandaag}.md`;
  };

  return { htmlNaarMarkdown, verzamel, tel, tokens, bouw, bestandsnaam };
})();

if (typeof module === 'object') module.exports = FfwdFeedback;

// ---------- Paneel (alleen in de browser) ----------
// FfwdFeedbackPaneel.maak({ student, sessieId, stand }) geeft een element met de keuzes en de knoppen.
// sessieId (optioneel, in de aside): de competenties van dat assessment staan vooraf aangevinkt.
// De opties (leerdoelen, algemeen, pseudoniem) worden onthouden; de keuze van competenties niet.

const FfwdFeedbackPaneel = typeof document === 'undefined' ? null : (() => {
  const VELDEN_POST = 'id goalId body insertedAt author { id name initials }';
  const perStudent = new Map(); // studentId → belofte van { competenties, sessies }, zolang de pagina open is
  const perSessie = new Map();  // sessieId → belofte van [{ student, competentie }]

  function laad(studentId) {
    if (!perStudent.has(studentId)) perStudent.set(studentId, vraag(`query($id: ID) {
      competencies { id title position }
      pastSessions(studentId: $id) {
        id title kind context startingAt finalized
        students { id name studentId }
        posts { ${VELDEN_POST} }
        goals { id level description competency { id } student { id name studentId } result { amount level } posts { ${VELDEN_POST} } }
      }
    }`, { id: studentId }).then(d => ({ competenties: d.competencies || [], sessies: d.pastSessions || [] }))
      .catch(e => { perStudent.delete(studentId); throw e; }));
    return perStudent.get(studentId);
  }

  function laadSessie(sessieId) {
    if (!perSessie.has(sessieId)) perSessie.set(sessieId, vraag(`query($id: ID!) {
      session(id: $id) { goals { competency { id } student { id } } }
    }`, { id: sessieId }).then(d => (d.session?.goals || []).map(g => ({ student: g.student?.id, competentie: g.competency?.id })))
      .catch(() => { perSessie.delete(sessieId); return []; }));
    return perSessie.get(sessieId);
  }

  const vandaag = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getal = n => n.toLocaleString('nl-NL');

  function maak({ student, sessieId = null, stand = null }) {
    const paneel = el('div', { class: 'fx-paneel' }, el('p', { class: 'fx-klein' }, 'Feedback laden…'));
    vul(paneel, { student, sessieId, stand });
    return paneel;
  }

  async function vul(paneel, { student, sessieId, stand }) {
    try {
      const [{ competenties, sessies }, inSessie, bewaard] = await Promise.all([
        laad(student.id), sessieId ? laadSessie(sessieId) : [], lees('feedback:opties')]);
      // Gegevens van de student aanvullen uit de assessments (naam, studentnummer)
      const bekend = sessies.flatMap(s => s.students || []).find(s => s.id === student.id) || {};
      const wie = { ...bekend, ...Object.fromEntries(Object.entries(student).filter(([, v]) => v != null)) };
      const telling = FfwdFeedback.tel(sessies, student.id);
      const lijst = [...competenties].sort((a, b) => a.position - b.position);

      if (!telling.doelen && !telling.algemeen) {
        return paneel.replaceChildren(el('p', { class: 'fx-klein' }, 'Nog geen feedback: deze student heeft geen afgeronde assessments met feedback.'));
      }

      const nu = new Set(inSessie.filter(g => g.student === student.id).map(g => g.competentie));
      const opties = { leerdoelen: true, algemeen: false, pseudoniem: false, ...(bewaard || {}) };
      const metDoelen = lijst.filter(c => telling.perCompetentie[c.id]);
      const vooraf = nu.size && metDoelen.some(c => nu.has(c.id)) ? c => nu.has(c.id) : () => true;

      const vinkjes = metDoelen.map(c => el('input', { type: 'checkbox', value: c.id, checked: vooraf(c), onchange: werkBij }));
      const competentieLijst = el('fieldset', { class: 'fx-competenties' },
        el('legend', {}, 'Competenties'),
        nu.size ? el('button', { type: 'button', class: 'fx-link', onclick: () => { vinkjes.forEach(v => { v.checked = nu.has(v.value); }); werkBij(); } }, 'Alleen van dit assessment') : null,
        metDoelen.map((c, i) => el('label', { class: 'fx-rij' }, vinkjes[i],
          el('span', { class: 'fx-naam' }, c.title),
          nu.has(c.id) ? el('span', { class: 'fx-nu', title: 'Wordt in dit assessment beoordeeld' }, 'nu') : null,
          el('span', { class: 'fx-aantal' }, `${telling.perCompetentie[c.id]} ${telling.perCompetentie[c.id] === 1 ? 'doel' : 'doelen'}`))));

      const optie = (sleutel, label, uitleg, waarschuwing) => el('label', { class: 'fx-optie' },
        el('input', { type: 'checkbox', checked: !!opties[sleutel], onchange: e => { opties[sleutel] = e.target.checked; bewaar('feedback:opties', opties); werkBij(); } }),
        el('span', {}, label, el('br'), el('span', { class: waarschuwing ? 'fx-klein fx-let-op' : 'fx-klein' }, uitleg)));
      const optiesBlok = el('div', { class: 'fx-opties' },
        optie('leerdoelen', 'Leerdoel van de student erbij', 'Zo leest AI de feedback in context.'),
        telling.algemeen ? optie('algemeen', 'Algemene feedback bij assessments', 'Bij groepsassessments kan dit over medestudenten gaan.', true) : null,
        optie('pseudoniem', 'Pseudoniem', 'Naam en studentnummer worden weggelaten, docenten worden initialen. Herkenbare details in de tekst blijven staan.'));

      const samenvatting = el('p', { class: 'fx-klein', 'aria-live': 'polite' });
      const status = el('p', { class: 'fx-klein fx-status', role: 'status' });
      const kopieer = el('button', { type: 'button', class: 'fx-knop fx-hoofd', onclick: () => doe('kopieer') }, 'Kopiëren');
      const download = el('button', { type: 'button', class: 'fx-knop', onclick: () => doe('download') }, 'Downloaden .md');

      const gekozen = () => vinkjes.filter(v => v.checked).map(v => v.value);
      const document_ = () => FfwdFeedback.bouw({
        sessies, student: wie, competenties: lijst, stand, vandaag: vandaag(),
        opties: { ...opties, competenties: gekozen() },
      });

      function werkBij() {
        const ids = new Set(gekozen());
        const doelen = metDoelen.filter(c => ids.has(c.id)).reduce((n, c) => n + telling.perCompetentie[c.id], 0);
        const leeg = !doelen && !(opties.algemeen && telling.algemeen);
        kopieer.disabled = download.disabled = leeg;
        samenvatting.textContent = leeg ? 'Vink minstens één competentie aan.'
          : `${doelen} ${doelen === 1 ? 'leerdoel' : 'leerdoelen'} · ≈ ${getal(FfwdFeedback.tokens(document_()))} tokens`;
        status.textContent = '';
      }

      async function doe(wat) {
        const tekst = document_();
        try {
          if (wat === 'kopieer') {
            await navigator.clipboard.writeText(tekst);
            status.textContent = 'Gekopieerd. Plak het waar je het nodig hebt.';
          } else {
            const a = el('a', { href: URL.createObjectURL(new Blob([tekst], { type: 'text/markdown;charset=utf-8' })), download: FfwdFeedback.bestandsnaam(wie, vandaag(), opties.pseudoniem) });
            document.body.append(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            status.textContent = 'Gedownload: ' + a.download;
          }
        } catch (e) {
          status.textContent = (wat === 'kopieer' ? 'Kopiëren lukte niet: ' : 'Downloaden lukte niet: ') + e.message;
        }
      }

      paneel.replaceChildren(
        el('p', { class: 'fx-klein' }, `Uit ${telling.assessments} afgeronde ${telling.assessments === 1 ? 'assessment' : 'assessments'} · alleen de eigen leerdoelen van deze student`),
        competentieLijst, optiesBlok,
        el('div', { class: 'fx-voet' }, samenvatting, el('div', { class: 'fx-knoppen' }, kopieer, download), status,
          el('p', { class: 'fx-klein' }, 'De export blijft in je browser: niets wordt opgeslagen of verstuurd.')));
      werkBij();
    } catch (e) {
      paneel.replaceChildren(el('p', { class: 'fx-klein fx-let-op' }, 'Feedback laden lukte niet: ' + e.message));
    }
  }

  // Vernieuwen (knop Vernieuw in de statuskaart): de feedback opnieuw ophalen
  const vergeet = studentId => { perStudent.delete(studentId); perSessie.clear(); };

  return { maak, vergeet };
})();
