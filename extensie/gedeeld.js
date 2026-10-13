// Gedeeld door alle functies: de GraphQL-aanroep en een helper om DOM-elementen te maken.
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
