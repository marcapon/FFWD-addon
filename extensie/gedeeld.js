// Gedeeld door alle functies: de GraphQL-aanroep, een helper om DOM-elementen te maken en lokaal onthouden.
// Content scripts delen één globale scope, dus deze namen bestaan maar één keer.

const API = 'https://api.ffwd.school/api';

// Alleen lezen: queries die ffwd zelf ook stelt, met de inlog van de gebruiker
async function vraag(query, variables) {
  const r = await fetch(API, {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(j.errors.map(e => e.message).join('; '));
  return j.data;
}

function el(tag, attrs = {}, ...kinderen) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinderen.flat()) if (k != null) e.append(k);
  return e;
}

// Lokaal onthouden, alleen in deze browser: chrome.storage.local in de extensie, localStorage in de sandbox.
// null = weghalen. Lukt het niet, dan werkt het alleen tot herladen.
async function lees(sleutel) {
  try {
    if (globalThis.chrome?.storage?.local) return (await chrome.storage.local.get(sleutel))[sleutel] ?? null;
    const waarde = localStorage.getItem(sleutel);
    return waarde == null ? null : JSON.parse(waarde);
  } catch { return null; }
}
async function bewaar(sleutel, waarde) {
  try {
    if (globalThis.chrome?.storage?.local) return waarde == null ? chrome.storage.local.remove(sleutel) : chrome.storage.local.set({ [sleutel]: waarde });
    waarde == null ? localStorage.removeItem(sleutel) : localStorage.setItem(sleutel, JSON.stringify(waarde));
  } catch { /* niet opgeslagen */ }
}
