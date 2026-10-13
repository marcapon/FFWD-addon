// EC-overzicht: behaalde studiepunten van al je studenten naast elkaar.
// Leest alleen (via vraag() uit gedeeld.js); er wordt niets opgeslagen of verstuurd.

const EC_TOTAAL = 240;
let cache = null;
let staat = { groep: 'alle', sorteer: 'totaal', omlaag: true };

async function laadData(voortgang) {
  const basis = await vraag(`{ competencies { id title position } groups { id title students { id name studentId } } }`);
  const competenties = [...basis.competencies].sort((a, b) => a.position - b.position);
  const studenten = new Map();
  for (const g of basis.groups) for (const s of g.students || []) {
    if (!studenten.has(s.id)) studenten.set(s.id, { ...s, groepen: [] });
    studenten.get(s.id).groepen.push(g.title);
  }
  const lijst = [...studenten.values()];
  let klaar = 0;
  await perStuk(lijst, 6, async s => {
    const d = await vraag(`query($id: ID!) {
      studentResults(studentId: $id) { goals { competency { id } result { amount level } } }
      pastSessions(studentId: $id) { title startingAt }
    }`, { id: s.id });
    // ffwd kent niet van elke student de naam ("Onbekend"); de laatste assessmenttitel helpt herkennen
    s.onbekend = !s.name || s.name === 'Onbekend';
    s.laatste = [...(d.pastSessions || [])].sort((a, b) => b.startingAt.localeCompare(a.startingAt))[0]?.title || '';
    s.perCompetentie = {}; s.perNiveau = {}; s.totaal = 0;
    for (const doel of d.studentResults?.goals || []) {
      const ec = doel.result?.amount || 0;
      if (!ec) continue;
      s.totaal += ec;
      s.perCompetentie[doel.competency.id] = (s.perCompetentie[doel.competency.id] || 0) + ec;
      s.perNiveau[doel.result.level] = (s.perNiveau[doel.result.level] || 0) + ec;
    }
    voortgang(++klaar, lijst.length);
  });
  return { competenties, studenten: lijst, groepen: basis.groups.map(g => g.title) };
}

async function perStuk(items, tegelijk, fn) {
  const rij = [...items];
  await Promise.all(Array.from({ length: tegelijk }, async () => { while (rij.length) await fn(rij.shift()); }));
}

// ---------- Paneel ----------

function paneel() {
  return document.getElementById('ec-paneel') || document.body.appendChild(el('div', { id: 'ec-paneel', hidden: true }));
}

async function openPaneel() {
  const p = paneel();
  p.hidden = false;
  document.documentElement.classList.add('ec-open');
  zetNavActief(true);
  if (cache) return tekenPaneel();
  p.replaceChildren(kop(), el('p', { class: 'ec-melding' }, 'Studenten laden…'));
  try {
    cache = await laadData((n, van) => { const m = p.querySelector('.ec-melding'); if (m) m.textContent = `Studenten laden… ${n} / ${van}`; });
    tekenPaneel();
  } catch (e) {
    p.replaceChildren(kop(), el('p', { class: 'ec-melding' }, 'Laden lukte niet: ' + e.message));
  }
}

function sluitPaneel() {
  paneel().hidden = true;
  document.documentElement.classList.remove('ec-open');
  zetNavActief(false);
}

function kop() {
  return el('div', { class: 'ec-kop' },
    el('h2', {}, 'EC-overzicht'),
    el('div', { class: 'ec-knoppen' },
      el('button', { class: 'ec-knop stil', onclick: () => { cache = null; openPaneel(); } }, 'Vernieuw'),
      el('button', { class: 'ec-knop stil', onclick: sluitPaneel, 'aria-label': 'Sluiten' }, 'Sluiten')));
}

function tekenPaneel() {
  const { competenties, studenten, groepen } = cache;
  const zichtbaar = studenten.filter(s => staat.groep === 'alle' || s.groepen.includes(staat.groep));
  const kolommen = [
    { id: 'naam', titel: 'Student', waarde: s => (s.onbekend ? '~' + s.laatste : s.name).toLowerCase() },
    { id: 'totaal', titel: 'Totaal', waarde: s => s.totaal },
    ...competenties.map(c => ({ id: c.id, titel: c.title, waarde: s => s.perCompetentie[c.id] || 0 })),
    ...['1', '2', '3'].map(n => ({ id: 'n' + n, titel: 'N' + n, waarde: s => s.perNiveau[n] || 0, niveau: true })),
  ];
  const kolom = kolommen.find(k => k.id === staat.sorteer) || kolommen[1];
  zichtbaar.sort((a, b) => {
    const x = kolom.waarde(a), y = kolom.waarde(b);
    return (x < y ? -1 : x > y ? 1 : 0) * (staat.omlaag ? -1 : 1);
  });
  const gemiddeld = zichtbaar.length ? Math.round(zichtbaar.reduce((t, s) => t + s.totaal, 0) / zichtbaar.length) : 0;

  const filter = el('div', { class: 'ec-toggle', role: 'group', 'aria-label': 'Groep' },
    ['alle', ...groepen].map(g => el('button', {
      class: staat.groep === g ? 'actief' : '', 'aria-pressed': String(staat.groep === g),
      onclick: () => { staat.groep = g; tekenPaneel(); },
    }, g === 'alle' ? 'Alle' : g)));

  const kopRij = el('tr', {}, kolommen.map(k => el('th', {
    class: [k.id === 'naam' ? 'ec-naam' : 'ec-getal', k.niveau ? 'ec-niveau' : '', k.id === kolom.id ? 'gesorteerd' : ''].join(' '),
    onclick: () => { staat.omlaag = staat.sorteer === k.id ? !staat.omlaag : k.id !== 'naam'; staat.sorteer = k.id; tekenPaneel(); },
  }, k.titel, k.id === kolom.id ? (staat.omlaag ? ' ↓' : ' ↑') : '')));

  const rijen = zichtbaar.map(s => el('tr', {},
    el('td', { class: 'ec-naam' },
      el('a', { href: '/students/' + s.id, class: s.onbekend ? 'onbekend' : null, onclick: e => naarStudent(e, s.id) },
        s.onbekend ? (s.laatste || 'Naam onbekend') : s.name),
      el('span', { class: 'ec-sub' }, [s.onbekend ? 'naam onbekend' : s.studentId, s.groepen.join(', ')].filter(Boolean).join(' · '))),
    el('td', { class: 'ec-getal ec-totaal' },
      el('b', {}, String(s.totaal)),
      el('span', { class: 'ec-balk', title: `${s.totaal} van ${EC_TOTAAL} EC` },
        el('i', { style: `width:${Math.min(100, s.totaal / EC_TOTAAL * 100)}%` }))),
    competenties.map(c => getalCel(s.perCompetentie[c.id])),
    ['1', '2', '3'].map(n => getalCel(s.perNiveau[n], 'ec-niveau'))));

  paneel().replaceChildren(
    kop(),
    el('div', { class: 'ec-balkje' }, filter,
      el('span', { class: 'ec-samenvatting' }, `${zichtbaar.length} studenten · gemiddeld ${gemiddeld} EC`)),
    el('div', { class: 'ec-tabel-rand' }, el('table', { class: 'ec-tabel' }, el('thead', {}, kopRij), el('tbody', {}, rijen))),
    el('p', { class: 'ec-voet' }, `Behaalde EC uit afgeronde assessments; balk = voortgang naar ${EC_TOTAAL} EC. N1–N3 = EC per behaald niveau.`));
}

function getalCel(waarde, klasse = '') {
  return el('td', { class: ('ec-getal ' + klasse + (waarde ? '' : ' leeg')).trim() }, waarde ? String(waarde) : '–');
}

// Navigeer binnen ffwd (Vue router) zonder de pagina te herladen
function naarStudent(e, id) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  sluitPaneel();
  history.pushState({}, '', '/students/' + id);
  dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
}

// ---------- Menu-item in de zijbalk ----------

function zetNavActief(aan) {
  const link = document.getElementById('ec-nav');
  if (!link) return;
  link.classList.toggle('ec-actief', aan);
  document.querySelectorAll('aside nav a.light:not(#ec-nav)').forEach(a => a.classList.toggle('ec-gedimd', aan));
}

function zorgVoorNav() {
  const lijst = document.querySelector('aside nav ul');
  if (!lijst || document.getElementById('ec-nav')) return;
  const onderaan = [...lijst.children].find(li => li.classList.contains('mt-auto'));
  const voorbeeld = lijst.querySelector('a.light');
  const icoon = el('span', { class: 'ec-icoon', 'aria-hidden': 'true' }, 'EC');
  const li = el('li', {}, el('a', {
    id: 'ec-nav', class: 'light full-width', href: '#',
    onclick: e => { e.preventDefault(); paneel().hidden ? openPaneel() : sluitPaneel(); },
  }, icoon, el('span', {}, 'EC-overzicht')));
  // Neem de scoped-stijl van Vue over (data-v-…), zodat het item eruitziet als de andere
  for (const a of voorbeeld?.attributes || []) if (a.name.startsWith('data-v-')) li.querySelectorAll('*').forEach(x => x.setAttribute(a.name, ''));
  lijst.insertBefore(li, onderaan || null);
  zetNavActief(!paneel().hidden);
}

new MutationObserver(zorgVoorNav).observe(document.documentElement, { childList: true, subtree: true });
zorgVoorNav();

// Klik op een ander menu-item of terug in de browser: paneel dicht
document.addEventListener('click', e => { if (e.target.closest('aside nav a.light:not(#ec-nav)')) sluitPaneel(); }, true);
addEventListener('popstate', () => { if (!paneel().hidden) sluitPaneel(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !paneel().hidden) sluitPaneel(); });
