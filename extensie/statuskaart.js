// Statuskaart: op elke studentpagina (/students/:id) de studievoortgang van die student,
// tussen de metadata (studentnummer e.d.) en de afgeronde assessments.
// Leest alleen (via vraag() uit gedeeld.js); de berekening staat in status.js.
// De cum-laudeschakelaar wordt per student onthouden in de eigen opslag van de extensie (alleen deze browser).

(() => {
  const NIVEAU = n => 'N' + n;
  let basis = null;                 // belofte: competenties en eisen per fase; gelijk voor iedereen
  const perStudent = new Map();     // studentId → belofte van de resultaten, zolang de pagina open is

  // De sandbox zet ffwdSandboxPad, omdat een lokaal bestand geen /students/…-pad kan hebben
  const studentIdUitPad = () => {
    const pad = globalThis.ffwdSandboxPad?.() ?? location.pathname;
    return pad.match(/^\/students\/([^/]+)\/?$/)?.[1] ?? null;
  };

  function laad(id) {
    basis ??= vraag(`{
      competencies { id title position levels }
      programs { id title position mandatory sessionKind requirements { amount level competency { id } } }
    }`).catch(e => { basis = null; throw e; });
    return Promise.all([basis, vraag(`query($id: ID!) {
      studentResults(studentId: $id) { goals { competency { id } session { kind } result { amount level } } }
    }`, { id })]).then(([b, d]) => ({ ...b, goals: d.studentResults?.goals || [] }));
  }

  // ---------- Cum laude per student onthouden ----------
  // In de extensie: chrome.storage.local. In de sandbox (geen extensie): localStorage.

  const clSleutel = id => 'cumLaude:' + id;
  async function leesCumLaude(id) {
    try {
      if (globalThis.chrome?.storage?.local) return !!(await chrome.storage.local.get(clSleutel(id)))[clSleutel(id)];
      return localStorage.getItem(clSleutel(id)) === '1';
    } catch { return false; }
  }
  async function zetCumLaude(id, aan) {
    try {
      if (globalThis.chrome?.storage?.local) return aan ? chrome.storage.local.set({ [clSleutel(id)]: true }) : chrome.storage.local.remove(clSleutel(id));
      aan ? localStorage.setItem(clSleutel(id), '1') : localStorage.removeItem(clSleutel(id));
    } catch { /* niet opgeslagen; de schakelaar werkt dan alleen tot herladen */ }
  }

  // ---------- Plaatsen ----------
  // Vue tekent de pagina zelf; de kaart staat daartussen en wordt teruggezet als Vue hem weghaalt.

  function controleer() {
    const id = studentIdUitPad();
    const kaart = document.getElementById('st-kaart');
    if (!id) return kaart?.remove();
    const labels = document.querySelector('section ul.labels');
    if (!labels) return;
    if (kaart?.dataset.student === id) {
      if (kaart.previousElementSibling !== labels) labels.after(kaart);
      return;
    }
    kaart?.remove();
    const nieuw = el('div', { id: 'st-kaart', 'data-student': id, class: 'flex flex-col p-4 bg-white rounded-md border border-gray-200' });
    labels.after(nieuw);
    vul(nieuw, id);
  }

  async function vul(kaart, id) {
    kaart.replaceChildren(kop(kaart, id), el('p', { class: 'st-melding' }, 'Voortgang laden…'));
    if (!perStudent.has(id)) perStudent.set(id, laad(id));
    try {
      const [data, cumLaude] = await Promise.all([perStudent.get(id), leesCumLaude(id)]);
      teken(kaart, id, FfwdStatus.bereken({ ...data, cumLaude }), cumLaude);
    } catch (e) {
      perStudent.delete(id);
      kaart.replaceChildren(kop(kaart, id), el('p', { class: 'st-melding st-fout' }, 'Laden lukte niet: ' + e.message));
    }
  }

  function kop(kaart, id, cumLaude) {
    return el('div', { class: 'st-kop' },
      el('h2', { class: 'text-sm font-bold' }, 'Studievoortgang'),
      cumLaude == null ? null : el('label', { class: 'st-schakelaar st-tip', 'data-uitleg': 'Toon de eisen en voortgang voor cum laude' },
        el('input', { type: 'checkbox', role: 'switch', checked: cumLaude, onchange: async e => { await zetCumLaude(id, e.target.checked); vul(kaart, id); } }),
        el('span', {}, 'Cum laude')),
      el('button', { class: 'st-knop', onclick: () => { perStudent.delete(id); basis = null; vul(kaart, id); } }, 'Vernieuw'));
  }

  // ---------- Tekenen ----------
  // Eén weergave per vraag: fases (waar staat de student, met een balk per fase), nog te behalen
  // (wat moet er nog, met cum laude bij de Hoofdfase) en per competentie (details, standaard dicht).

  const pct = (a, b) => (b ? Math.min(100, a / b * 100) : 0);
  const balk = (gevuld, vereist) => el('span', { class: 'st-balk', role: 'img', 'aria-label': `${gevuld} van ${vereist} EC` },
    el('i', { style: `width:${pct(gevuld, vereist)}%` }));

  function teken(kaart, id, st, cumLaude) {
    const competentie = Object.fromEntries(st.matrix.map(m => [m.id, m.titel]));
    const naamEis = e => (e.competentie ? competentie[e.competentie] : 'Keuze') + ' ' + NIVEAU(e.niveau);
    const sectie = (label, ...inhoud) => el('section', { class: 'st-sectie' }, el('h3', { class: 'st-label' }, label), ...inhoud);
    const lijst = tekorten => el('ul', { class: 'st-tekorten' },
      tekorten.map(t => el('li', {}, el('span', {}, naamEis(t)), el('span', { class: 'st-nog' }, `nog ${t.tekort}`))));

    // Totaal en fases
    const totaal = el('p', { class: 'st-totaal' },
      el('b', {}, String(st.totaal.gevuld)), el('span', {}, `van ${st.totaal.vereist} EC`),
      st.totaal.boven ? el('span', { class: 'st-klein' }, `· ${st.totaal.boven} EC boven de eisen`) : null);
    const fases = el('ol', { class: 'st-fases' }, st.fases.map(f => el('li', { class: 'st-fase ' + f.staat },
      el('span', { class: 'st-fase-titel' }, f.titel, f.klaar ? el('span', { class: 'st-vink' }, ' ✓') : null),
      el('span', { class: 'st-fase-getal' }, el('b', {}, String(f.gevuld)), ` / ${f.vereist}`),
      balk(f.gevuld, f.vereist),
      f.staat === 'dicht' ? el('span', { class: 'st-klein' }, 'na ' + f.na.join(' en ')) : null)));
    const vroeg = st.fases.filter(f => f.vroeg);

    // Cum laude: aparte toets bij de Hoofdfase. Voldaan (groen), haalbaar (blauw) of niet meer haalbaar (oranje)
    const cl = st.cumLaude;
    const cumLaudeBlok = () => {
      if (!cl) return el('p', { class: 'st-klein st-let-op' }, 'Cum laude is niet te berekenen: de eisen van de Hoofdfase wijken af van wat de extensie verwacht.');
      const staat = cl.voldaan ? 'voldaan' : cl.haalbaar ? 'haalbaar' : 'niet-haalbaar';
      return el('div', { class: 'st-cumlaude ' + staat },
        el('p', {}, el('b', {}, 'Cum laude'), el('span', { class: 'st-zacht' }, {
          voldaan: ` · voldaan, ${cl.gevuld} van ${cl.vereist} EC op N3`,
          haalbaar: ` · ${cl.gevuld} van ${cl.vereist} EC op N3`,
          'niet-haalbaar': ` · niet meer haalbaar, ${cl.gevuld} van ${cl.vereist} EC op N3`,
        }[staat])),
        balk(cl.gevuld, cl.vereist),
        staat === 'niet-haalbaar' ? el('p', { class: 'st-melding-cl', role: 'status' },
          `Er is nog ${cl.tekort} EC op N3 nodig, maar in de Hoofdfase is ${cl.ruimte ? 'nog maar ' + cl.ruimte + ' EC' : 'geen'} ruimte meer voor N3.`) : null,
        staat === 'haalbaar' ? lijst(cl.tekorten) : null);
    };
    const clFase = cumLaude ? (cl ? st.fases.find(f => f.id === cl.fase) : st.fases.find(f => f.titel === 'Hoofdfase')) : null;

    // Nog te behalen: per open fase in volgorde, cum laude direct onder de Hoofdfase (ook als die al vol is)
    const perFase = st.fases.filter(f => f.staat === 'open' || f === clFase).map(f => {
      const extra = f === clFase ? cumLaudeBlok() : null;
      if (f.staat !== 'open') return el('div', { class: 'st-open-fase' },
        el('p', { class: 'st-fase-kop' }, el('b', {}, f.titel), el('span', { class: 'st-zacht' }, f.klaar ? ' · vol' : ' · nog niet open')), extra);
      // Open fase zonder EC: één regel; klik om de eisen te zien
      if (!f.behaald) return el('div', { class: 'st-open-fase' },
        el('details', {}, el('summary', {}, el('b', {}, f.titel), el('span', { class: 'st-zacht' }, f.soort
          ? ` · wordt in één assessment beoordeeld (${f.vereist} EC)` : ` · nog niets behaald, ${f.vereist} EC nodig`)), lijst(f.tekorten)),
        extra);
      return el('div', { class: 'st-open-fase' },
        el('p', { class: 'st-fase-kop' }, el('b', {}, f.titel), el('span', { class: 'st-zacht' }, ` · nog ${f.vereist - f.gevuld} EC`)),
        lijst(f.tekorten), extra);
    });

    // Per competentie: behaald/verplicht, met de uitsplitsing bij hoveren of focus.
    // Kleur: vol = groen, deels = oranje, nog niets = grijs, geen eis maar wel EC = neutraal.
    const leeg = () => el('td', { class: 'st-getal leeg' }, '–');
    const kleur = (gevuld, behaald, vereist) => !vereist ? 'extra' : gevuld >= vereist ? 'vol' : behaald ? 'deels' : 'nul';
    const uitlegCel = (klasse, tekst, uitleg) => el('td', {
      class: 'st-getal st-tip ' + klasse, 'data-uitleg': uitleg, tabindex: '0', 'aria-label': `${tekst}. ${uitleg}`,
    }, tekst);
    const celInhoud = c => {
      if (!c.vereist && !c.behaald) return leeg();
      const delen = [c.gevuld && `${c.gevuld} verplicht`, c.keuze && `${c.keuze} keuze`, c.over && `${c.over} over (telt nergens voor)`].filter(Boolean);
      const tekort = c.vereist - c.gevuld;
      const uitleg = `${c.behaald} EC behaald` + (delen.length ? ': ' + delen.join(', ') : '') + (tekort > 0 ? `. Nog ${tekort} verplicht nodig.` : '');
      return uitlegCel(kleur(c.gevuld, c.behaald, c.vereist), `${c.behaald}/${c.vereist}`, uitleg);
    };
    const keuzeInhoud = c => {
      if (!c.vereist) return leeg();
      const bronnen = Object.entries(c.bijdragen).map(([cid, n]) => `${competentie[cid]} ${n}`);
      return uitlegCel(kleur(c.gevuld, c.gevuld, c.vereist), `${c.gevuld}/${c.vereist}`, bronnen.length ? 'Komt uit: ' + bronnen.join(', ') : 'Nog geen keuze-EC');
    };
    const matrix = el('table', { class: 'st-matrix' },
      el('thead', {}, el('tr', {}, el('th', {}, el('small', {}, 'behaald / verplicht')), st.niveaus.map(n => el('th', { class: 'st-getal' }, NIVEAU(n))))),
      el('tbody', {},
        st.matrix.map(m => el('tr', {}, el('th', {}, m.titel), m.cellen.map(celInhoud))),
        el('tr', { class: 'st-vrij' }, el('th', {}, 'Keuze'), st.vrij.map(keuzeInhoud))));

    const regels = [
      'Alleen afgeronde assessments tellen.',
      'Stage- en afstudeerassessments tellen voor Stage en Afstuderen. De rest telt op niveau: N1 voor de Propedeuse, N2 en N3 voor de Hoofdfase.',
      'Alleen het exacte niveau telt: N3 vult geen N2-eis.',
      'De Hoofdfase gaat open na 54 EC in de Propedeuse, de Stage na een volle Propedeuse, Afstuderen na de Hoofdfase en de Stage.',
      'Per competentie: behaald tegen verplicht, voor de Propedeuse en de Hoofdfase. Hover voor de uitsplitsing in verplicht, keuze en wat nergens voor telt.',
      cumLaude ? 'Cum laude: 21 EC op N3 in de Hoofdfase (Onderzoeken N3 3 + Keuze N3 18), zonder stage en afstuderen. Het verandert de eisen van de fases niet. Niet meer haalbaar als het tekort groter is dan de open keuze- en N3-ruimte in de Hoofdfase.' : null,
    ].filter(Boolean);

    // replaceChildren zet null om in de tekst "null"; daarom lege blokken eruit filteren
    kaart.replaceChildren(...[
      kop(kaart, id, cumLaude),
      totaal,
      fases,
      vroeg.length ? el('p', { class: 'st-klein st-let-op' }, vroeg.map(f => `${f.titel}: ${f.behaald} EC behaald terwijl de fase nog niet open was (na ${f.na.join(' en ')}).`).join(' ')) : null,
      sectie('Nog te behalen', perFase.length ? perFase : el('p', { class: 'st-zacht' }, st.fases.every(f => f.klaar) ? 'Alle fases zijn vol.' : 'Er is nu geen fase open.')),
      el('details', { class: 'st-sectie st-uitklap' }, el('summary', { class: 'st-label' }, 'Per competentie'), matrix),
      el('details', { class: 'st-uitklap st-regels' }, el('summary', {}, 'Hoe telt dit?'), el('ul', {}, regels.map(r => el('li', {}, r)))),
    ].filter(Boolean));
  }

  // ---------- Starten ----------

  let gepland = false;
  new MutationObserver(() => {
    if (gepland) return;
    gepland = true;
    requestAnimationFrame(() => { gepland = false; controleer(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', controleer);
  controleer();
})();
