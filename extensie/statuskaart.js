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
      cumLaude == null ? null : el('label', { class: 'st-schakelaar', title: 'Toon de eisen en voortgang voor cum laude' },
        el('input', { type: 'checkbox', role: 'switch', checked: cumLaude, onchange: async e => { await zetCumLaude(id, e.target.checked); vul(kaart, id); } }),
        el('span', {}, 'Cum laude')),
      el('button', { class: 'st-knop', onclick: () => { perStudent.delete(id); basis = null; vul(kaart, id); } }, 'Vernieuw'));
  }

  // ---------- Tekenen ----------

  function teken(kaart, id, st, cumLaude) {
    const competentie = Object.fromEntries(st.matrix.map(m => [m.id, m.titel]));
    const naamEis = e => (e.competentie ? competentie[e.competentie] : 'Keuze') + ' ' + NIVEAU(e.niveau);
    const open = st.fases.filter(f => f.staat === 'open');

    // 1. Totaal: één balk, opgedeeld in de fases naar verhouding van hun EC
    const totaal = el('div', { class: 'st-blok' },
      el('p', { class: 'st-totaal' }, el('b', {}, String(st.totaal.gevuld)), ` van ${st.totaal.vereist} EC`),
      el('div', { class: 'st-balk', role: 'img', 'aria-label': `${st.totaal.gevuld} van ${st.totaal.vereist} EC` },
        st.fases.map(f => el('span', {
          class: 'st-segment ' + f.staat, style: `flex-grow:${f.vereist}`, title: `${f.titel}: ${f.gevuld} van ${f.vereist} EC`,
        }, el('i', { style: `width:${f.vereist ? Math.min(100, f.gevuld / f.vereist * 100) : 0}%` })))),
      st.totaal.boven ? el('p', { class: 'st-sub' }, `Behaald: ${st.totaal.behaald} EC, waarvan ${st.totaal.boven} boven de eisen.`) : null);

    // 2. Fases met hun staat (klaar, open, dicht), en de tekorten van elke open fase onder elkaar
    const vroeg = st.fases.filter(f => f.vroeg);
    const fases = el('div', { class: 'st-blok' },
      el('ul', { class: 'st-fases' }, st.fases.map(f => el('li', { class: f.staat },
        el('span', { class: 'st-fase' }, f.titel),
        el('span', { class: 'st-getal' }, f.klaar ? '✓ ' + f.vereist : `${f.gevuld}/${f.vereist}`),
        f.staat === 'dicht' ? el('span', { class: 'st-na' }, 'na ' + f.na.join(' en ')) : null))),
      vroeg.length ? el('p', { class: 'st-sub st-let-op' }, vroeg.map(f => `${f.titel}: ${f.behaald} EC behaald terwijl de fase nog niet open was (na ${f.na.join(' en ')}).`).join(' ')) : null,
      open.length
        ? open.map(f => {
            const lijst = el('ul', {}, f.tekorten.map(t => el('li', {}, naamEis(t), el('span', { class: 'st-getal' }, `nog ${t.tekort}`))));
            // Open fase zonder EC: ingeklapt tot één regel; klik om de eisen te zien.
            // Stage en afstuderen (fases met een eigen soort assessment) worden in één keer beoordeeld.
            if (!f.behaald) return el('details', { class: 'st-tekorten' },
              el('summary', {}, el('b', {}, f.titel), f.soort
                ? ` — wordt in één assessment beoordeeld (${f.vereist} EC)`
                : ` — nog niets behaald, ${f.vereist} EC nodig`), lijst);
            return el('div', { class: 'st-tekorten' }, el('p', {}, el('b', {}, f.titel), ` — nog ${f.vereist - f.gevuld} EC nodig:`), lijst);
          })
        : el('p', { class: 'st-sub' }, st.fases.every(f => f.klaar) ? 'Alle fases zijn vol.' : 'Er is nu geen fase open.'));

    // 3. Matrix: competentie × niveau, gevuld tegen vereist over alle fases
    const celInhoud = c => {
      const boven = c.behaald - c.gevuld;
      if (!c.vereist && !c.behaald) return el('td', { class: 'st-getal leeg' }, '–');
      return el('td', { class: 'st-getal ' + (c.gevuld >= c.vereist ? 'vol' : 'tekort'), title: `Behaald: ${c.behaald ?? c.gevuld} EC` },
        c.vereist ? `${c.gevuld}/${c.vereist}` : '', boven > 0 ? el('small', {}, ` +${boven}`) : null);
    };
    const matrix = el('div', { class: 'st-blok st-matrix-rand' }, el('table', { class: 'st-matrix' },
      el('thead', {}, el('tr', {}, el('th', {}, ''), st.niveaus.map(n => el('th', { class: 'st-getal' }, NIVEAU(n))))),
      el('tbody', {},
        st.matrix.map(m => el('tr', {}, el('th', {}, m.titel), m.cellen.map(celInhoud))),
        el('tr', { class: 'st-vrij' }, el('th', {}, 'Keuze'), st.vrij.map(c => celInhoud({ ...c, behaald: c.gevuld }))))));

    // Cum laude (alleen als de schakelaar aan staat): 21 EC op N3 in de Hoofdfase
    const cl = st.cumLaude;
    const cumLaudeBlok = !cumLaude ? null : !cl
      ? el('p', { class: 'st-sub st-let-op' }, 'Cum laude is niet te berekenen: de eisen van de Hoofdfase wijken af van wat de extensie verwacht.')
      : el('div', { class: 'st-blok st-cumlaude' + (cl.voldaan ? ' voldaan' : '') },
          el('p', {}, el('b', {}, 'Cum laude'), cl.voldaan
            ? ` — voldaan: ${cl.gevuld} van ${cl.vereist} EC op N3 in de Hoofdfase`
            : ` — ${cl.gevuld} van ${cl.vereist} EC op N3 in de Hoofdfase`),
          el('div', { class: 'st-balk', role: 'img', 'aria-label': `${cl.gevuld} van ${cl.vereist} EC` },
            el('span', { class: 'st-segment open', style: 'flex-grow:1' }, el('i', { style: `width:${Math.min(100, cl.gevuld / cl.vereist * 100)}%` }))),
          cl.tekorten.length ? el('ul', {}, cl.tekorten.map(t => el('li', {}, naamEis(t), el('span', { class: 'st-getal' }, `nog ${t.tekort}`)))) : null,
          el('p', { class: 'st-sub' }, 'Stage en afstuderen tellen hiervoor niet mee. De Hoofdfase-eisen hierboven zijn de cum-laudevariant: 15 EC schuiven van Keuze N2 naar Keuze N3.'));

    kaart.replaceChildren(kop(kaart, id, cumLaude), totaal, fases, cumLaudeBlok, matrix,
      el('p', { class: 'st-voet' }, 'EC uit afgeronde assessments, gevuld/vereist. Stage- en afstudeerassessments tellen voor Stage en Afstuderen, de rest op niveau. Alleen het exacte niveau telt; +n = boven de eis van die cel (vult eerst de keuze-EC). Stage gaat open na de Propedeuse, Afstuderen na Hoofdfase en Stage.'));
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
