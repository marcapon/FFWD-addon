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
// - Fases lopen niet strikt na elkaar. Een fase is open als haar voorwaarden vol zijn (VOORWAARDEN);
//   alle open fases die nog niet vol zijn tonen hun tekorten. EC in een fase die nog niet open is
//   tellen wel mee, maar worden gemeld.
// - Cum laude (aan te zetten per student): in de Hoofdfase verschuift 15 EC van Keuze N2 naar Keuze N3.
//   De student moet dan 21 EC op N3 halen in de Hoofdfase (Onderzoeken N3 3 + Keuze N3 18).
//   Stage- en afstudeerassessments tellen daar niet voor (CUM_LAUDE). Minor en exchange tellen voorlopig
//   wel mee: ffwd heeft er geen eigen soort voor (besloten 13-10-2026).

const FfwdStatus = (() => {
  // ffwd `programs` kent geen volgorde of voorwaarden; daarom hier, op titel van de fase
  const VOORWAARDEN = {
    Propedeuse: [],
    Hoofdfase: [],
    Stage: ['Propedeuse'],
    Afstuderen: ['Hoofdfase', 'Stage'],
  };

  const CUM_LAUDE = {
    fase: 'Hoofdfase',
    verschuif: { van: '2', naar: '3', ec: 15 }, // Keuze N2 54 → 39, Keuze N3 3 → 18
    niveau: '3',                                // 21 EC op N3: alle N3-eisen van de Hoofdfase na de verschuiving
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
  // Past de potten aan; wat overblijft is niet toegewezen.
  function verdeel(eisen, potten) {
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
        rest -= n;
      }
      e.gevuld = e.vereist - rest;
    }
    return eisen;
  }

  const tekortenVan = eisen => eisen.filter(e => e.gevuld < e.vereist).map(e => ({ ...e, tekort: e.vereist - e.gevuld }));

  function verschuifVoorCumLaude(fase) {
    const { van, naar, ec: n } = CUM_LAUDE.verschuif;
    const keuze = niveau => fase.eisen.find(e => !e.competentie && e.niveau === niveau);
    if (!keuze(van) || keuze(van).vereist < n) return false;
    if (!keuze(naar)) fase.eisen.push({ competentie: null, niveau: naar, vereist: 0, gevuld: 0 });
    keuze(van).vereist -= n;
    keuze(naar).vereist += n;
    return true;
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
    const clFase = cumLaude ? fases.find(f => f.titel === CUM_LAUDE.fase) : null;
    const clMogelijk = clFase ? verschuifVoorCumLaude(clFase) : false;

    const behaaldPerCel = new Map();
    let behaald = 0, zonderFase = 0;
    for (const doel of goals || []) {
      const punten = ec(doel.result?.amount);
      if (!punten) continue;
      const k = sleutel(doel.competency?.id, String(doel.result.level));
      behaald += punten;
      behaaldPerCel.set(k, (behaaldPerCel.get(k) || 0) + punten);
      const programma = faseVoor(programmas, doel);
      const fase = programma && fases.find(f => f.id === programma.id);
      if (!fase) { zonderFase += punten; continue; }
      fase.behaald += punten;
      fase.potten.set(k, (fase.potten.get(k) || 0) + punten);
      if (teltVoorCumLaude(doel.session)) fase.pottenCL.set(k, (fase.pottenCL.get(k) || 0) + punten);
    }

    // Cum laude: dezelfde N3-eisen van de Hoofdfase, maar alleen gevuld met assessments die meetellen
    let cl = null;
    if (clMogelijk) {
      const eisen = verdeel(clFase.eisen.filter(e => e.niveau === CUM_LAUDE.niveau).map(e => ({ ...e, gevuld: 0 })), new Map(clFase.pottenCL));
      cl = { fase: clFase.id, niveau: CUM_LAUDE.niveau, eisen, vereist: som(eisen, e => e.vereist), gevuld: som(eisen, e => e.gevuld), tekorten: tekortenVan(eisen) };
      cl.voldaan = cl.gevuld >= cl.vereist;
    }

    for (const f of fases) {
      verdeel(f.eisen, f.potten);
      delete f.potten;
      delete f.pottenCL;
      f.vereist = som(f.eisen, e => e.vereist);
      f.gevuld = som(f.eisen, e => e.gevuld);
      f.boven = f.behaald - f.gevuld;
      f.klaar = f.gevuld >= f.vereist;
      f.tekorten = tekortenVan(f.eisen);
    }
    for (const f of fases) {
      f.na = VOORWAARDEN[f.titel] || [];
      const open = f.na.every(t => fases.find(x => x.titel === t)?.klaar ?? true);
      f.staat = f.klaar ? 'klaar' : open ? 'open' : 'dicht';
      f.vroeg = !open && f.behaald > 0; // EC behaald terwijl de fase nog niet open was
    }
    const eisenOp = (competentie, niveau) => fases.flatMap(f => f.eisen).filter(e => e.competentie === competentie && e.niveau === niveau);
    const cel = (competentie, niveau) => {
      const eisen = eisenOp(competentie, niveau);
      return { niveau, vereist: som(eisen, e => e.vereist), gevuld: som(eisen, e => e.gevuld) };
    };

    return {
      totaal: { behaald, vereist: som(fases, f => f.vereist), gevuld: som(fases, f => f.gevuld), boven: behaald - som(fases, f => f.gevuld), zonderFase },
      fases,
      open: fases.filter(f => f.staat === 'open').map(f => f.id),
      niveaus,
      matrix: competenties.map(c => ({
        id: c.id, titel: c.title,
        cellen: niveaus.map(n => ({ ...cel(c.id, n), behaald: behaaldPerCel.get(sleutel(c.id, n)) || 0 })),
      })),
      vrij: niveaus.map(n => cel(null, n)),
      cumLaude: cl,
    };
  }

  return { bereken, teltVoorCumLaude, CUM_LAUDE };
})();

if (typeof module === 'object') module.exports = FfwdStatus;
