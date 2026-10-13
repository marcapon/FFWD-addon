# ffwd addon

Een Chrome-extensie (Manifest V3) die functies toevoegt aan [ffwd](https://app.ffwd.school/), het feedback- en assessmentplatform van de opleiding. Alleen voor eigen gebruik.

## Functies
- **EC-overzicht**: een menu-item in de zijbalk van ffwd. Het opent een tabel met de behaalde EC van al je studenten:
  - het totaal, met een balk die de voortgang naar 240 EC laat zien;
  - EC per competentie;
  - EC per behaald niveau (N1–N3).

  Je kunt filteren per groep en sorteren op elke kolom. Klik je op een naam, dan opent de studentpagina in ffwd.

## Installeren
1. Ga in Chrome naar `chrome://extensions`.
2. Zet rechtsboven **Developer mode** aan.
3. Kies **Load unpacked** en daarna de map `extensie`.
4. Na een wijziging: klik bij de extensie op ↻ en herlaad ffwd.

## Hoe het werkt
- Een content script draait op `https://app.ffwd.school/*`.
- Het leest de GraphQL-API op `https://api.ffwd.school/api`, met de inlog van de gebruiker (`credentials: 'include'`).
- **Alleen lezen.** De extensie slaat niets op en verstuurt niets.
- De API is niet officieel en kan zonder aankondiging veranderen.

## Bestanden
| Bestand | Inhoud |
| --- | --- |
| `extensie/manifest.json` | laadt het script en de stijl op app.ffwd.school |
| `extensie/ec-overzicht.js` | menu-item, paneel, GraphQL-queries en de berekening |
| `extensie/ec-overzicht.css` | eigen stijl van het paneel; werkt zonder andere extensies |

## Regels
- Studentgegevens blijven lokaal. Ze komen niet in deze repository: ook niet als voorbeelddata, export of testbestand.
- De API kan ook schrijven. Dat gebruiken we alleen na een expliciet besluit.
