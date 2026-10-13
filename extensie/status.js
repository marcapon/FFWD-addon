// Studievoortgang van één student tegen de eisen van de opleiding (ffwd `programs`).
// Puur rekenwerk: geen DOM, geen netwerk. Daardoor ook te testen met Node (tests/status.test.js).
//
// Rekenregels:
// - Alleen resultaten van afgeronde assessments tellen (`result.amount`; null of 0 telt niet).
// - Een stage- of afstudeerassessment telt voor de fase met die `sessionKind` (Stage, Afstuderen).
//   De rest telt op behaald niveau: voor de fase zonder `sessionKind` die eisen op dat niveau heeft
//   (N1 → Propedeuse, N2/N3 → Hoofdfase).
// - Alleen het exacte niveau telt: N3 vult geen N2-eis.
// - Binnen een fase eerst de eisen per competentie vullen, daarna de keuze-eisen (zonder competentie)
//   van hetzelfde niveau. Wat dan overblijft is 'boven de eisen'.
// - Fases lopen niet strikt na elkaar. Een fase is open als aan haar voorwaarden is voldaan (VOORWAARDEN):
//   de Hoofdfase na 54 EC in de Propedeuse (N1), de Stage na de Propedeuse, Afstuderen na Hoofdfase en Stage;
//   alle open fases die nog niet vol zijn tonen hun tekorten. EC in een fase die nog niet open is
//   tellen wel mee, maar worden gemeld.
// - Cum laude (aan te zetten per student) is een aparte toets; de eisen van de fases en het totaal
//   veranderen er niet door. De student haalt 21 EC op N3 in de Hoofdfase: de N3-eisen van de Hoofdfase
//   met 15 EC extra Keuze N3 (Onderzoeken N3 3 + Keuze N3 18). Stage- en afstudeerassessments tellen
//   daar niet voor (CUM_LAUDE). Minor en exchange tellen voorlopig wel mee: ffwd heeft er geen eigen
//   soort voor (besloten 13-10-2026).
// - Cum laude is niet meer haalbaar als het tekort op N3 groter is dan de ruimte die in de Hoofdfase
//   nog over is: de open keuze-eisen en de open N3-eisen. Open verplichte N2-eisen zijn geen ruimte.
// - De matrix (competentie × niveau) toont alleen fases zonder eigen soort assessment (Propedeuse,
//   Hoofdfase). Stage en Afstuderen worden in één keer beoordeeld en staan alleen bij de fases.

const FfwdStatus = (() => {
  // ffwd `programs` kent geen volgorde of voorwaarden; daarom hier, op titel van de fase.
  // { fase } = die fase is vol; { fase, ec } = minstens zoveel EC behaald in die fase.
  const VOORWAARDEN = {
    Propedeuse: [],
    Hoofdfase: [{ fase: 'Propedeuse', ec: 54 }], // 54 EC op N1
    Stage: [{ fase: 'Propedeuse' }],
    Afstuderen: [{ fase: 'Hoofdfase' }, { fase: 'Stage' }],
  };

  const CUM_LAUDE = {
    fase: 'Hoofdfase',
    verschuif: { van: '2', naar: '3', ec: 15 }, // 15 van de 54 Keuze N2 moeten op N3: Keuze N3 3 → 18
    niveau: '3',                                // 21 EC op N3: de N3-eisen van de Hoofdfase na de verschuiving
    nietSoorten: ['internship', 'graduation'], // stage en afstuderen
  };
  const teltVoorCumLaude = sessie => !CUM_LAUDE.nietSoorten.includes(sessie?.kind);

  const ec = n => Number(n) || 0;
  const opPositie = (a, b) => a.position - b.position;
  const som = (lijst, f) => lijst.reduce((t, x) => t + f(x), 0);
  const sleutel = (competentie, niveau) => competentie + '|' + niveau;

  function faseVoor(programmas, doel) {
    const opSoort = programmas.find(p => p.sessionKind && p.sessionKind === doel.session?.kind);
    if (opSoort) return opSoort;
    const niveau = String(doel.result.level);
    return programmas.find(p => !p.sessionKind && (p.requirements || []).some(r => String(r.level) === niveau)) || null;
  }

  // Vult eisen uit potten (competentie|niveau → EC): eerst de eisen per competentie, dan de keuze-eisen.
  // Past de potten aan; wat overblijft is niet toegewezen. naarKeuze (optioneel) houdt per pot bij
  // hoeveel EC naar een keuze-eis ging.
  function verdeel(eisen, potten, naarKeuze = new Map()) {
    for (const e of eisen.filter(e => e.competentie)) {
      const k = sleutel(e.competentie, e.niveau);
      e.gevuld = Math.min(e.vereist, potten.get(k) || 0);
      potten.set(k, (potten.get(k) || 0) - e.gevuld);
    }
    for (const e of eisen.filter(e => !e.competentie)) {
      let rest = e.vereist;
      for (const [k, v] of potten) {
        if (rest <= 0 || !k.endsWith('|' + e.niveau)) continue;
        const n = Math.min(rest, v);
        potten.set(k, v - n);
        naarKeuze.set(k, (naarKeuze.get(k) || 0) + n);
        rest -= n;
      }
      e.gevuld = e.vereist - rest;
    }
    return eisen;
  }

  const tekortenVan = eisen => eisen.filter(e => e.gevuld < e.vereist).map(e => ({ ...e, tekort: e.vereist - e.gevuld }));

  // De cum-laude-eisen: een kopie van de N3-eisen van de fase, met de verschuiving erbij.
  // null als de fase niet de verwachte keuze-eis heeft.
  function cumLaudeEisen(fase) {
    const { van, naar, ec: n } = CUM_LAUDE.verschuif;
    const keuzeVan = fase.eisen.find(e => !e.competentie && e.niveau === van);
    if (!keuzeVan || keuzeVan.vereist < n) return null;
    const eisen = fase.eisen.filter(e => e.niveau === naar).map(e => ({ ...e, gevuld: 0 }));
    const keuzeNaar = eisen.find(e => !e.competentie) || eisen[eisen.push({ competentie: null, niveau: naar, vereist: 0, gevuld: 0 }) - 1];
    keuzeNaar.vereist += n;
    return eisen;
  }

  function bereken({ competencies, programs, goals, cumLaude = false }) {
    const competenties = [...competencies].sort(opPositie);
    const programmas = [...programs].sort(opPositie);
    const niveaus = [...new Set(competenties.flatMap(c => c.levels || ['1', '2', '3']))].map(String).sort();

    const fases = programmas.map(p => ({
      id: p.id, titel: p.title, soort: p.sessionKind ?? null, verplicht: p.mandatory !== false, behaald: 0,
      eisen: (p.requirements || []).map(r => ({
        competentie: r.competency?.id ?? null, niveau: String(r.level), vereist: ec(r.amount), gevuld: 0,
      })),
      potten: new Map(),   // per competentie|niveau: EC die nog niet aan een eis zijn toegewezen
      pottenCL: new Map(), // idem, alleen assessments die voor cum laude tellen
    }));

    const behaaldPerCel = new Map(); // alleen EC in fases die in de matrix staan
    let behaald = 0, zonderFase = 0;
    for (const doel of goals || []) {
      const punten = ec(doel.result?.amount);
      if (!punten) continue;
      const k = sleutel(doel.competency?.id, String(doel.result.level));
      behaald += punten;
      const programma = faseVoor(programmas, doel);
      const fase = programma && fases.find(f => f.id === programma.id);
      if (!fase) { zonderFase += punten; continue; }
      if (!fase.soort) behaaldPerCel.set(k, (behaaldPerCel.get(k) || 0) + punten);
      fase.behaald += punten;
      fase.potten.set(k, (fase.potten.get(k) || 0) + punten);
      if (teltVoorCumLaude(doel.session)) fase.pottenCL.set(k, (fase.pottenCL.get(k) || 0) + punten);
    }

    for (const f of fases) {
      f.naarKeuze = new Map();
      verdeel(f.eisen, f.potten, f.naarKeuze);
      f.over = f.potten; // wat na het verdelen in de potten bleef: telt nergens voor
      delete f.potten;
      f.vereist = som(f.eisen, e => e.vereist);
      f.gevuld = som(f.eisen, e => e.gevuld);
      f.boven = f.behaald - f.gevuld;
      f.klaar = f.gevuld >= f.vereist;
      f.tekorten = tekortenVan(f.eisen);
    }
    // Cum laude: alleen gevuld met assessments die meetellen; de fases zelf blijven ongewijzigd
    let cl = null;
    const clFase = cumLaude ? fases.find(f => f.titel === CUM_LAUDE.fase) : null;
    const clEisen = clFase ? cumLaudeEisen(clFase) : null;
    if (clEisen) {
      const eisen = verdeel(clEisen, new Map(clFase.pottenCL));
      const ruimte = som(clFase.tekorten.filter(t => !t.competentie || t.niveau === CUM_LAUDE.niveau), t => t.tekort);
      cl = { fase: clFase.id, niveau: CUM_LAUDE.niveau, eisen, vereist: som(eisen, e => e.vereist), gevuld: som(eisen, e => e.gevuld), tekorten: tekortenVan(eisen), ruimte };
      cl.tekort = cl.vereist - cl.gevuld;
      cl.voldaan = cl.tekort <= 0;
      cl.haalbaar = cl.voldaan || cl.tekort <= ruimte;
    }
    for (const f of fases) delete f.pottenCL;

    for (const f of fases) {
      const voorwaarden = VOORWAARDEN[f.titel] || [];
      f.na = voorwaarden.map(v => (v.ec ? `${v.ec} EC ${v.fase}` : v.fase));
      const open = voorwaarden.every(v => {
        const x = fases.find(x => x.titel === v.fase);
        return !x || (v.ec ? x.behaald >= v.ec : x.klaar);
      });
      f.staat = f.klaar ? 'klaar' : open ? 'open' : 'dicht';
      f.vroeg = !open && f.behaald > 0; // EC behaald terwijl de fase nog niet open was
    }
    const matrixFases = fases.filter(f => !f.soort);
    const eisenOp = (competentie, niveau) => matrixFases.flatMap(f => f.eisen).filter(e => e.competentie === competentie && e.niveau === niveau);
    const uitFases = (veld, k) => som(matrixFases, f => f[veld].get(k) || 0);
    const cel = (competentie, niveau) => {
      const eisen = eisenOp(competentie, niveau);
      return { niveau, vereist: som(eisen, e => e.vereist), gevuld: som(eisen, e => e.gevuld) };
    };
    // Per competentie en niveau: behaald = verplicht (gevuld) + naar keuze + over
    const competentieCel = (competentie, niveau) => {
      const k = sleutel(competentie, niveau);
      return { ...cel(competentie, niveau), behaald: behaaldPerCel.get(k) || 0, keuze: uitFases('naarKeuze', k), over: uitFases('over', k) };
    };
    // Per niveau: de keuze-eis en welke competenties hem vullen
    const keuzeCel = niveau => ({
      ...cel(null, niveau),
      bijdragen: Object.fromEntries(competenties.map(c => [c.id, uitFases('naarKeuze', sleutel(c.id, niveau))]).filter(([, n]) => n)),
    });
    const matrix = competenties.map(c => ({ id: c.id, titel: c.title, cellen: niveaus.map(n => competentieCel(c.id, n)) }));
    const vrij = niveaus.map(keuzeCel);
    for (const f of fases) { delete f.naarKeuze; delete f.over; }

    return {
      totaal: { behaald, vereist: som(fases, f => f.vereist), gevuld: som(fases, f => f.gevuld), boven: behaald - som(fases, f => f.gevuld), zonderFase },
      fases,
      open: fases.filter(f => f.staat === 'open').map(f => f.id),
      niveaus,
      matrix,
      vrij,
      keuzeNiveaus: niveaus.filter(n => eisenOp(null, n).some(e => e.vereist > 0)), // niveaus met een keuze-eis
      cumLaude: cl,
    };
  }

  return { bereken, teltVoorCumLaude, CUM_LAUDE };
})();

if (typeof module === 'object') module.exports = FfwdStatus;
