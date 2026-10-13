// Assessment-aside: op een assessmentpagina (/sessions/:id) een paneel rechts met de statuskaart van de
// studenten in dat assessment, één tegelijk. Een knop "EC" klapt het paneel open of dicht.
// Leest alleen (via vraag() uit gedeeld.js); de kaart zelf komt uit statuskaart.js (FfwdStatuskaart.vul).
// Onthouden in deze browser: open of dicht, en per assessment de gekozen student.

const FfwdAside = (() => {
  // Label van een student: de naam, anders het studentnummer, anders "Student n" in de volgorde van ffwd.
  // ffwd kent van veel studenten de naam niet ("Onbekend").
  const labelVoor = (student, index) => {
    if (student?.name && student.name !== 'Onbekend') return student.name;
    if (student?.studentId) return 'Student ' + student.studentId;
    return `Student ${index + 1}`;
  };
  return { labelVoor };
})();

if (typeof module === 'object') module.exports = FfwdAside;

if (typeof document !== 'undefined') (() => {
  const perSessie = new Map(); // sessieId → belofte van de studenten, zolang de pagina open is
  let open = null;             // null tot de bewaarde stand gelezen is
  let getoond = null;          // sessieId waarvan de aside nu de studenten toont

  // De sandbox zet ffwdSandboxPad, omdat een lokaal bestand geen /sessions/…-pad kan hebben
  const sessieIdUitPad = () => {
    const pad = globalThis.ffwdSandboxPad?.() ?? location.pathname;
    return pad.match(/^\/sessions\/([^/]+)\/?$/)?.[1] ?? null;
  };

  function laadSessie(id) {
    if (!perSessie.has(id)) perSessie.set(id, vraag(`query($id: ID!) {
      session(id: $id) { id title students { id name studentId } }
    }`, { id }).then(d => d.session?.students || []).catch(e => { perSessie.delete(id); throw e; }));
    return perSessie.get(id);
  }

  // ---------- Plaatsen ----------
  // Knop en aside staan in <body>, buiten Vue, zodat ze blijven staan als ffwd de pagina opnieuw tekent.

  const knop = () => document.getElementById('ffa-knop') || document.body.appendChild(el('button', {
    id: 'ffa-knop', type: 'button', 'aria-controls': 'ffa-aside', 'aria-label': 'Studievoortgang tonen of verbergen',
    onclick: () => zetOpen(!open),
  }, 'EC'));
  const aside = () => document.getElementById('ffa-aside') || document.body.appendChild(el('aside', {
    id: 'ffa-aside', 'aria-label': 'Studievoortgang', hidden: true,
  }));

  // De aside begint onder de vaste balk van ffwd (alleen vast op brede schermen)
  function meetBalk() {
    const balk = document.querySelector('#app header');
    const hoogte = balk && getComputedStyle(balk).position === 'fixed' ? balk.offsetHeight : 0;
    document.documentElement.style.setProperty('--ffa-boven', hoogte + 'px');
  }

  async function zetOpen(aan) {
    open = aan;
    await bewaar('aside:open', aan ? true : null);
    controleer();
  }

  function controleer() {
    const id = sessieIdUitPad();
    if (!id || open === null) {
      if (!id) { document.getElementById('ffa-knop')?.remove(); document.getElementById('ffa-aside')?.remove(); getoond = null; }
      return;
    }
    const k = knop(), a = aside();
    k.setAttribute('aria-expanded', String(open));
    k.classList.toggle('open', open);
    a.hidden = !open;
    if (!open) return;
    meetBalk();
    if (getoond !== id) { getoond = id; vul(a, id); }
  }

  // ---------- Inhoud ----------

  const kop = () => el('div', { class: 'ffa-kop' },
    el('span', {}, 'Studievoortgang'),
    el('button', { type: 'button', class: 'ffa-sluit', 'aria-label': 'Sluiten', onclick: () => zetOpen(false) }, '×'));

  async function vul(a, sessieId) {
    a.replaceChildren(kop(), el('p', { class: 'ffa-melding' }, 'Studenten laden…'));
    try {
      const studenten = await laadSessie(sessieId);
      if (getoond !== sessieId) return; // intussen een ander assessment geopend
      if (!studenten.length) return a.replaceChildren(kop(), el('p', { class: 'ffa-melding' }, 'Dit assessment heeft geen studenten.'));

      const bewaard = await lees('aside:student:' + sessieId);
      const kaart = el('div', { class: 'st-kaart st-smal' });
      const tabs = studenten.length > 1 ? el('div', { class: 'ffa-tabs', role: 'tablist', 'aria-label': 'Student' },
        studenten.map((s, i) => el('button', { type: 'button', role: 'tab', class: 'ffa-tab', 'data-student': s.id, onclick: () => kies(s.id) },
          FfwdAside.labelVoor(s, i))))
        : el('p', { class: 'ffa-naam' }, FfwdAside.labelVoor(studenten[0], 0));
      const kies = id => {
        tabs.querySelectorAll?.('.ffa-tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.student === id)));
        bewaar('aside:student:' + sessieId, id);
        FfwdStatuskaart.vul(kaart, id);
      };
      a.replaceChildren(kop(), tabs, kaart);
      kies(studenten.some(s => s.id === bewaard) ? bewaard : studenten[0].id);
    } catch (e) {
      a.replaceChildren(kop(), el('p', { class: 'ffa-melding ffa-fout' }, 'Laden lukte niet: ' + e.message));
    }
  }

  // ---------- Starten ----------

  let gepland = false;
  new MutationObserver(() => {
    if (gepland) return;
    gepland = true;
    requestAnimationFrame(() => { gepland = false; controleer(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', controleer);
  addEventListener('resize', () => { if (open) meetBalk(); });
  // Esc sluit de aside, maar niet tijdens het typen elders (bijvoorbeeld in de feedback-editor)
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !open) return;
    const focus = document.activeElement;
    if (focus === document.body || document.getElementById('ffa-aside')?.contains(focus)) zetOpen(false);
  });
  lees('aside:open').then(v => { open = !!v; controleer(); });
})();
