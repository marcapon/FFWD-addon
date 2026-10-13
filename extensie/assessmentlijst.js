// Assessmentlijst: op de lijst met assessments (/sessions) een schakelaar tussen de blokken van ffwd en rijen.
// Een rij toont datum, titel en context, soort, status, studenten en docenten; met zoeken, filters en sorteren.
// De rijen staan per studiejaar (1 september t/m 31 augustus), in te klappen; het huidige studiejaar staat open.
// Leest alleen (via vraag() uit gedeeld.js): upcomingSessions en pastSessions, zoals ffwd zelf.
// Onthouden in deze browser: blokken of rijen, welke studiejaren open staan en de filters.

const FfwdLijst = (() => {
  const labelVoor = typeof FfwdAside !== 'undefined' ? FfwdAside.labelVoor : require('./assessment-aside.js').labelVoor;

  const SOORTEN = { individual: 'Individueel', integral: 'Integraal', internship: 'Stage', graduation: 'Afstuderen' };
  const soortVan = kind => SOORTEN[kind] || kind || '';

  // Status van het assessment, plus hoeveel studenten in ffwd nog niet op 'completed' staan.
  // rang bepaalt de volgorde bij sorteren: wat aandacht vraagt eerst.
  function statusVan(sessie, nu = new Date()) {
    const nogOpen = (sessie.assessees || []).filter(a => a.status !== 'completed').length;
    if (sessie.finalized) return { label: 'Afgerond', soort: 'klaar', nogOpen, rang: nogOpen ? 1 : 3 };
    if (new Date(sessie.startingAt) > nu) return { label: 'Gepland', soort: 'gepland', nogOpen, rang: 2 };
    return { label: 'Open', soort: 'open', nogOpen, rang: 0 };
  }

  // Studenten met hun label en status in ffwd; docenten met de eigenaar vooraan
  function studentenVan(sessie) {
    const status = new Map((sessie.assessees || []).map(a => [a.student?.id, a.status]));
    return (sessie.students || []).map((s, i) => ({ id: s.id, label: labelVoor(s, i), status: status.get(s.id) ?? null }));
  }
  function docentenVan(sessie) {
    const rol = new Map((sessie.assessors || []).map(a => [a.teacherId, a.role]));
    return (sessie.teachers || [])
      .map(t => ({ id: t.id, label: t.name || t.initials || 'Docent', eigenaar: rol.get(t.id) === 'owner' }))
      .sort((a, b) => b.eigenaar - a.eigenaar);
  }

  // Alles waarop je kunt zoeken, in kleine letters
  const zoektekst = sessie => [
    sessie.title, sessie.context, soortVan(sessie.kind),
    ...(sessie.students || []).flatMap(s => [s.name, s.studentId]),
    ...(sessie.teachers || []).map(t => t.name),
  ].filter(Boolean).join(' ').toLowerCase();

  // Elk woord moet ergens voorkomen
  const past = (sessie, zoek) => zoek.toLowerCase().split(/\s+/).filter(Boolean).every(w => zoektekst(sessie).includes(w));

  const KOLOMMEN = {
    datum: s => s.startingAt,
    titel: s => (s.title || '').toLowerCase(),
    soort: s => soortVan(s.kind),
    status: s => statusVan(s).rang,
    studenten: s => (s.students || []).length,
    docenten: s => (docentenVan(s)[0]?.label || '').toLowerCase(),
  };
  // Bij gelijke waarde: nieuwste eerst
  function sorteer(sessies, kolom, omlaag) {
    const waarde = KOLOMMEN[kolom] || KOLOMMEN.datum;
    return [...sessies].sort((a, b) => {
      const x = waarde(a), y = waarde(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (omlaag ? -1 : 1) || b.startingAt.localeCompare(a.startingAt);
    });
  }

  // Studiejaar van 1 september tot en met 31 augustus, in de tijdzone van de browser: '2025-2026'
  const STUDIEJAAR_START = 8; // september (maanden tellen vanaf 0)
  function studiejaarVan(datum) {
    const d = new Date(datum);
    const begin = d.getFullYear() - (d.getMonth() < STUDIEJAAR_START ? 1 : 0);
    return `${begin}-${begin + 1}`;
  }

  // Gesorteerde sessies per studiejaar, met de volgorde binnen elk jaar intact.
  // Nieuwste jaar eerst, behalve bij sorteren op datum oplopend.
  function perStudiejaar(sessies, oudsteEerst = false) {
    const jaren = new Map();
    for (const s of sessies) {
      const jaar = studiejaarVan(s.startingAt);
      if (!jaren.has(jaar)) jaren.set(jaar, []);
      jaren.get(jaar).push(s);
    }
    return [...jaren].map(([jaar, lijst]) => ({ jaar, sessies: lijst }))
      .sort((a, b) => a.jaar.localeCompare(b.jaar) * (oudsteEerst ? 1 : -1));
  }

  // Filters: { soorten: [kind], statussen: ['gepland'|'open'|'klaar'|'aandacht'], mijn: bool, docenten: [teacherId] }.
  // Binnen een filter is één keuze genoeg (of), tussen filters moet alles kloppen (en). Leeg = geen filter.
  // 'aandacht': afgerond, maar een student staat in ffwd niet op 'completed'.
  function voldoet(sessie, filters = {}, nu = new Date()) {
    const { soorten = [], statussen = [], mijn = false, docenten = [] } = filters;
    if (soorten.length && !soorten.includes(sessie.kind)) return false;
    if (statussen.length) {
      const status = statusVan(sessie, nu);
      const aandacht = sessie.finalized && status.nogOpen > 0;
      if (!statussen.some(f => f === status.soort || (f === 'aandacht' && aandacht))) return false;
    }
    if (mijn && !sessie.owned) return false;
    if (docenten.length && !(sessie.teachers || []).some(t => docenten.includes(t.id))) return false;
    return true;
  }
  const filtersActief = (f = {}) => !!(f.soorten?.length || f.statussen?.length || f.mijn || f.docenten?.length);

  // Alle docenten in de assessments, één keer, op naam
  function docentenIn(sessies) {
    const docenten = new Map();
    for (const s of sessies) for (const d of docentenVan(s)) if (!docenten.has(d.id)) docenten.set(d.id, { id: d.id, label: d.label });
    return [...docenten.values()].sort((a, b) => a.label.localeCompare(b.label, 'nl'));
  }

  return { soortVan, statusVan, studentenVan, docentenVan, past, sorteer, studiejaarVan, perStudiejaar, voldoet, filtersActief, docentenIn };
})();

if (typeof module === 'object') module.exports = FfwdLijst;

if (typeof document !== 'undefined') (() => {
  let weergave = null;   // 'blokken' of 'rijen'; null tot de bewaarde keuze gelezen is
  let data = null;       // belofte van de assessments, zolang de pagina open is
  let wortel = null;     // ons blok boven de blokken van ffwd; blijft bestaan als Vue het weghaalt
  const staat = { zoek: '', sorteer: 'datum', omlaag: true };
  let openJaren = null;  // Set met de open studiejaren; null = nog niets gekozen, dan alleen het huidige
  let filters = null;    // zie FfwdLijst.voldoet; null tot de bewaarde filters gelezen zijn
  const LEEG = () => ({ soorten: [], statussen: [], mijn: false, docenten: [] });

  const opLijst = () => /^\/sessions\/?$/.test(globalThis.ffwdSandboxPad?.() ?? location.pathname);

  function laad() {
    const velden = `id title kind context state finalized owned startingAt deadlineAt
      students { id name studentId } teachers { id name initials }
      assessors { role teacherId } assessees { status student { id } }`;
    data ??= vraag(`{ upcomingSessions { ${velden} } pastSessions { ${velden} } }`)
      .then(d => {
        const gezien = new Set();
        return [...(d.upcomingSessions || []), ...(d.pastSessions || [])].filter(s => !gezien.has(s.id) && gezien.add(s.id));
      })
      .catch(e => { data = null; throw e; });
    return data;
  }

  // ---------- Plaatsen ----------
  // Ons blok staat direct vóór de container met de blokken van ffwd. In de stand 'rijen' verbergt CSS die container
  // (html[data-ffl-weergave=rijen] #ffl-lijst ~ …), zodat de blokken van ffwd zelf onaangeroerd blijven.

  function controleer() {
    const html = document.documentElement;
    if (!opLijst()) { wortel?.remove(); delete html.dataset.fflWeergave; return; }
    if (weergave === null) return;
    const blokken = document.querySelector('section > div.space-y-6');
    if (!blokken) return;
    html.dataset.fflWeergave = weergave;
    wortel ??= maakWortel();
    if (wortel.nextElementSibling !== blokken) blokken.before(wortel);
    if (weergave === 'rijen' && !wortel.dataset.geladen) vul();
  }

  async function zetWeergave(w) {
    weergave = w;
    wortel?.querySelectorAll('.ffl-schakel button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.weergave === w)));
    await bewaar('lijst:weergave', w);
    controleer();
  }

  // ---------- Inhoud ----------

  const datum = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const tijd = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' });
  const kortDatum = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });

  function maakWortel() {
    const schakel = el('div', { class: 'ffl-schakel', role: 'group', 'aria-label': 'Weergave' },
      [['blokken', 'Blokken'], ['rijen', 'Rijen']].map(([w, tekst]) => el('button', {
        type: 'button', 'data-weergave': w, 'aria-pressed': String(weergave === w), onclick: () => zetWeergave(w),
      }, tekst)));
    const zoek = el('input', {
      type: 'search', class: 'ffl-zoek ffl-alleen-rijen', placeholder: 'Zoek op titel, student of docent', 'aria-label': 'Zoeken',
      oninput: e => { staat.zoek = e.target.value; tekenRijen(); },
    });
    const vernieuw = el('button', { type: 'button', class: 'ffl-knop ffl-alleen-rijen', onclick: () => { data = null; vul(); } }, 'Vernieuw');
    return el('div', { id: 'ffl-lijst' },
      // Regel 1: weergave en vernieuwen. Regel 2: zoeken, filters en het aantal; alles met een vaste plek,
      // zodat er niets verspringt als je iets aanklikt.
      el('div', { class: 'ffl-balk' }, schakel, vernieuw),
      el('div', { class: 'ffl-balk ffl-zoekbalk ffl-alleen-rijen' }, zoek,
        el('div', { class: 'ffl-filters', role: 'group', 'aria-label': 'Filters' }),
        el('span', { class: 'ffl-aantal' })),
      el('div', { class: 'ffl-inhoud ffl-alleen-rijen' }));
  }

  async function vul() {
    wortel.dataset.geladen = 'ja';
    const inhoud = wortel.querySelector('.ffl-inhoud');
    inhoud.replaceChildren(el('p', { class: 'ffl-melding' }, 'Assessments laden…'));
    try {
      await laad();
      tekenRijen();
    } catch (e) {
      // geladen blijft staan: opnieuw proberen gaat via Vernieuw, anders laadt de MutationObserver eindeloos opnieuw
      inhoud.replaceChildren(el('p', { class: 'ffl-melding ffl-fout' }, 'Laden lukte niet: ' + e.message));
    }
  }

  const KOPPEN = [['datum', 'Datum'], ['titel', 'Assessment'], ['soort', 'Soort'], ['status', 'Status'], ['studenten', 'Studenten'], ['docenten', 'Docenten']];

  async function tekenRijen() {
    const alle = await data;
    // Na het opnieuw tekenen de focus terugzetten op dezelfde knop (toetsenbord)
    const focus = wortel.contains(document.activeElement) ? document.activeElement.dataset.sleutel : null;
    if (!filters) {
      const { soorten, statussen, mijn, docenten } = { ...LEEG(), ...(await lees('lijst:filters')) };
      // Een bewaarde docent die niet meer in de lijst staat, zou alles wegfilteren
      const bekend = new Set(FfwdLijst.docentenIn(alle).map(d => d.id));
      filters = { soorten, statussen, mijn, docenten: docenten.filter(id => bekend.has(id)) };
    }
    // Standaard het huidige studiejaar; heeft dat nog geen assessments, dan het nieuwste jaar met assessments
    if (!openJaren) {
      const huidig = FfwdLijst.studiejaarVan(new Date());
      const heeftHuidig = alle.some(s => FfwdLijst.studiejaarVan(s.startingAt) === huidig);
      openJaren = new Set((await lees('lijst:open')) || [heeftHuidig ? huidig : FfwdLijst.perStudiejaar(alle)[0]?.jaar].filter(Boolean));
    }
    const zichtbaar = FfwdLijst.sorteer(alle.filter(s => FfwdLijst.voldoet(s, filters) && FfwdLijst.past(s, staat.zoek)), staat.sorteer, staat.omlaag);
    tekenFilters(alle);
    wortel.querySelector('.ffl-aantal').textContent = zichtbaar.length === alle.length
      ? `${alle.length} assessments` : `${zichtbaar.length} van ${alle.length} assessments`;

    const kop = el('tr', {}, KOPPEN.map(([id, titel]) => el('th', {
      class: 'ffl-' + id, 'aria-sort': staat.sorteer === id ? (staat.omlaag ? 'descending' : 'ascending') : null,
    }, el('button', {
      type: 'button',
      onclick: () => { staat.omlaag = staat.sorteer === id ? !staat.omlaag : ['datum', 'studenten'].includes(id); staat.sorteer = id; tekenRijen(); },
    }, titel, staat.sorteer === id ? (staat.omlaag ? ' ↓' : ' ↑') : ''))));

    // Eén tbody per studiejaar. Tijdens het zoeken of filteren op soort, status of docent staat elk jaar met een
    // treffer open, zonder de keuze te veranderen. 'Alleen van mij' is een vaste stand en klapt niets open.
    const zoekt = !!staat.zoek.trim() || FfwdLijst.filtersActief({ ...filters, mijn: false });
    const jaren = FfwdLijst.perStudiejaar(zichtbaar, staat.sorteer === 'datum' && !staat.omlaag);
    const groepen = jaren.map(({ jaar, sessies }) => {
      const open = zoekt || openJaren.has(jaar);
      // Studenten die in een afgerond assessment niet op 'completed' staan
      const aandacht = sessies.reduce((n, s) => n + (s.finalized ? FfwdLijst.statusVan(s).nogOpen : 0), 0);
      return el('tbody', { class: 'ffl-jaar' + (open ? ' ffl-jaar-open' : '') },
        el('tr', { class: 'ffl-jaarkop' }, el('th', { colspan: KOPPEN.length, scope: 'rowgroup' }, el('button', {
          type: 'button', 'data-sleutel': 'jaar:' + jaar, 'aria-expanded': String(open), disabled: zoekt,
          onclick: () => zetJaarOpen(jaar, !openJaren.has(jaar)),
        }, el('span', { class: 'ffl-pijl', 'aria-hidden': 'true' }, '▸'),
          `Studiejaar ${jaar.replace('-', '–')}`,
          el('span', { class: 'ffl-jaar-aantal' }, `${sessies.length} ${sessies.length === 1 ? 'assessment' : 'assessments'}`),
          aandacht ? el('span', { class: 'ffl-jaar-aantal ffl-let-op' }, `${aandacht} ${aandacht === 1 ? 'student' : 'studenten'} niet afgerond`) : null))),
        open ? sessies.map(rij) : null);
    });

    wortel.querySelector('.ffl-inhoud').replaceChildren(zichtbaar.length
      ? el('div', { class: 'ffl-rand' }, el('table', { class: 'ffl-tabel' }, el('thead', {}, kop), groepen))
      : el('p', { class: 'ffl-melding' }, !alle.length ? 'Nog geen assessments.'
        : FfwdLijst.filtersActief(filters) ? 'Geen assessments met deze filters en zoekwoorden.' : 'Geen assessments gevonden.'));
    if (focus) wortel.querySelector(`[data-sleutel="${focus}"]`)?.focus();
  }

  // ---------- Filters ----------

  const SOORT_FILTERS = ['individual', 'integral', 'internship', 'graduation'];
  const STATUS_FILTERS = [['gepland', 'Gepland'], ['open', 'Open'], ['klaar', 'Afgerond'], ['aandacht', 'Student niet afgerond']];

  // Per filter een uitklapmenu (<details>) met vinkjes; meer tegelijk mogelijk. Het menu blijft open tijdens het
  // aanvinken: tekenFilters tekent opnieuw, maar zet het open menu en de focus terug.
  function tekenFilters(alle) {
    const open = wortel.querySelector('.ffl-dropdown[open]')?.dataset.sleutel;
    const aantal = (veld, waarde) => alle.filter(s => FfwdLijst.voldoet(s, { [veld]: [waarde] })).length;
    const menu = (veld, titel, opties) => {
      // Het label blijft de titel; een getal toont hoeveel er aan staan, de namen staan in de tooltip
      const gekozen = opties.filter(([w]) => filters[veld].includes(w));
      return el('details', {
        class: 'ffl-dropdown' + (gekozen.length ? ' ffl-actief' : ''), 'data-sleutel': 'menu:' + veld, open: open === 'menu:' + veld,
        ontoggle: e => { if (e.target.open) sluitMenus(e.target); },
      }, el('summary', { 'data-sleutel': 'knop:' + veld, title: gekozen.length ? gekozen.map(o => o[1]).join(', ') : null },
        titel, gekozen.length ? el('span', { class: 'ffl-teller', 'aria-label': `${gekozen.length} gekozen` }, String(gekozen.length)) : null),
        el('div', { class: 'ffl-menu', role: 'group', 'aria-label': titel }, opties.map(([w, tekst, extra = '']) => el('label', { class: 'ffl-optie' + extra },
          el('input', {
            type: 'checkbox', 'data-sleutel': veld + ':' + w, checked: filters[veld].includes(w),
            onchange: () => zetFilters({ [veld]: filters[veld].includes(w) ? filters[veld].filter(x => x !== w) : [...filters[veld], w] }),
          }),
          el('span', { class: 'ffl-optie-tekst' }, tekst),
          el('span', { class: 'ffl-optie-aantal' }, String(aantal(veld, w)))))));
    };

    wortel.querySelector('.ffl-filters').replaceChildren(
      menu('soorten', 'Soort', SOORT_FILTERS.map(k => [k, FfwdLijst.soortVan(k)])),
      menu('statussen', 'Status', STATUS_FILTERS.map(([k, tekst]) => [k, tekst, k === 'aandacht' ? ' ffl-let-op' : ''])),
      menu('docenten', 'Docent', FfwdLijst.docentenIn(alle).map(d => [d.id, d.label])),
      el('button', {
        type: 'button', class: 'ffl-filter', 'data-sleutel': 'mijn', 'aria-pressed': String(filters.mijn),
        onclick: () => zetFilters({ mijn: !filters.mijn }),
      }, 'Alleen van mij'),
      // Altijd op zijn plek, onzichtbaar zonder filters
      el('button', {
        type: 'button', class: 'ffl-wis', 'data-sleutel': 'wis', hidden: !FfwdLijst.filtersActief(filters), onclick: () => zetFilters(LEEG()),
      }, 'Wis filters'));
  }

  function sluitMenus(behalve = null) {
    wortel?.querySelectorAll('.ffl-dropdown[open]').forEach(d => { if (d !== behalve) d.open = false; });
  }

  async function zetFilters(wijziging) {
    filters = { ...filters, ...wijziging };
    await tekenRijen();
    await bewaar('lijst:filters', FfwdLijst.filtersActief(filters) ? filters : null);
  }

  async function zetJaarOpen(jaar, open) {
    open ? openJaren.add(jaar) : openJaren.delete(jaar);
    await tekenRijen();
    await bewaar('lijst:open', [...openJaren]);
  }

  function rij(s) {
    const start = new Date(s.startingAt);
    const status = FfwdLijst.statusVan(s);
    const deadline = s.deadlineAt && !s.finalized ? new Date(s.deadlineAt) : null;
    const docenten = FfwdLijst.docentenVan(s);
    return el('tr', {},
      el('td', { class: 'ffl-datum' }, datum.format(start), el('span', { class: 'ffl-sub' }, tijd.format(start))),
      el('td', { class: 'ffl-titel' },
        el('a', { href: '/sessions/' + s.id, onclick: e => naar(e, '/sessions/' + s.id) }, s.title || 'Zonder titel'),
        s.context ? el('span', { class: 'ffl-sub' }, s.context) : null),
      el('td', { class: 'ffl-soort' }, FfwdLijst.soortVan(s.kind)),
      el('td', { class: 'ffl-status' },
        el('span', { class: 'ffl-label ffl-' + status.soort }, status.label),
        status.nogOpen && s.finalized
          ? el('span', { class: 'ffl-sub ffl-let-op' }, `${status.nogOpen} ${status.nogOpen === 1 ? 'student' : 'studenten'} niet afgerond`) : null,
        deadline ? el('span', { class: 'ffl-sub' + (deadline < new Date() ? ' ffl-let-op' : '') }, 'deadline ' + kortDatum.format(deadline)) : null),
      // Oranje alleen in een afgerond assessment: daarvoor staat iedereen nog op 'pending'
      el('td', { class: 'ffl-studenten' }, el('div', { class: 'ffl-chips' }, FfwdLijst.studentenVan(s).map(st => {
        const afwijkend = s.finalized && st.status && st.status !== 'completed';
        return el('a', {
          href: '/students/' + st.id, class: 'ffl-chip' + (afwijkend ? ' ffl-chip-open' : ''),
          title: afwijkend ? `Status in ffwd: ${st.status}` : null,
          onclick: e => naar(e, '/students/' + st.id),
        }, st.label);
      }))),
      el('td', { class: 'ffl-docenten' }, docenten.length ? docenten.map(d => el('span', {
        class: 'ffl-docent' + (d.eigenaar ? ' ffl-eigenaar' : ''), title: d.eigenaar ? 'Eigenaar' : null,
      }, d.label)) : el('span', { class: 'ffl-sub' }, '–')));
  }

  // Navigeer binnen ffwd (Vue router) zonder de pagina te herladen; met Cmd/Ctrl/Shift gewoon een nieuw tabblad
  function naar(e, pad) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    history.pushState({}, '', pad);
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }

  // ---------- Starten ----------

  let gepland = false;
  new MutationObserver(() => {
    if (gepland) return;
    gepland = true;
    requestAnimationFrame(() => { gepland = false; controleer(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', controleer);
  document.addEventListener('click', e => { if (!e.target.closest?.('.ffl-dropdown')) sluitMenus(); });
  addEventListener('keydown', e => {
    const menu = wortel?.querySelector('.ffl-dropdown[open]');
    if (e.key !== 'Escape' || !menu) return;
    menu.open = false;
    menu.querySelector('summary').focus();
  });
  lees('lijst:weergave').then(w => { weergave = w === 'blokken' ? 'blokken' : 'rijen'; controleer(); });
})();
