# ffwd addon

Een Chrome-extensie (Manifest V3) die functies toevoegt aan [ffwd](https://app.ffwd.school/), het feedback- en assessmentplatform van de opleiding. Alleen voor eigen gebruik.

## Functies
- **Statuskaart** op elke studentpagina (`/students/:id`), tussen de metadata en de afgeronde assessments:
  - het totaal van 240 EC, met een balk die is opgedeeld in de fases;
  - de vier fases (Propedeuse, Hoofdfase, Stage, Afstuderen) tegen de eisen uit ffwd `programs`, elk klaar, open of nog dicht, met de tekorten van elke open fase;
  - een matrix van competentie × niveau: gevuld tegen vereist, over alle fases.
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

## Rekenregels van de statuskaart
- Alleen resultaten van afgeronde assessments tellen.
- Stage- en afstudeerassessments tellen voor Stage en Afstuderen. De rest telt op behaald niveau: N1 voor de Propedeuse, N2 en N3 voor de Hoofdfase.
- Alleen het exacte niveau telt: N3 vult geen N2-eis.
- Stage en Afstuderen worden in één assessment beoordeeld: alle 30 EC tegelijk, of nog niets. Zolang ze lopen, staat er "wordt in één assessment beoordeeld".
- Binnen een fase eerst de eisen per competentie, daarna de keuze-EC op hetzelfde niveau. Wat overblijft is 'boven de eisen'.
- Fases lopen niet strikt na elkaar. Propedeuse en Hoofdfase zijn altijd open, de Stage gaat open na de Propedeuse, en Afstuderen na de Hoofdfase én de Stage. Dit staat in `VOORWAARDEN` in `status.js`.
- Van elke open fase die nog niet vol is, toont de kaart de tekorten, onder elkaar. Een open fase zonder EC staat ingeklapt op één regel; klik om de eisen te zien.
- EC in een fase die nog niet open is, tellen wel mee. De kaart meldt ze apart.

## Cum laude
- Per student zet je in de kaart een schakelaar **Cum laude** aan. Die wordt onthouden in de opslag van de extensie (`chrome.storage.local`), alleen in je eigen browser.
- Staat hij aan, dan verschuift in de Hoofdfase 15 EC van Keuze N2 naar Keuze N3 (54 → 39 en 3 → 18). De student moet dan 21 EC op N3 halen in de Hoofdfase: Onderzoeken N3 3 plus Keuze N3 18.
- Stage en afstuderen tellen niet mee voor die 21 EC. Minor en exchange tellen voorlopig wel mee, omdat ffwd er geen eigen soort voor heeft. De regels staan in `CUM_LAUDE` in `status.js`.

## Testen
- **Rekenregels:** `node --test` in deze map. De tests staan in `tests/` en gebruiken verzonnen studenten uit `sandbox/fixtures.js`.
- **Sandbox:** open `sandbox/index.html` in Chrome. Het is een nagemaakte ffwd-studentpagina met een nep-API en verzonnen data, die dezelfde bestanden laadt als de extensie. Met de balk rechtsonder wissel je van student, laat je het laden traag gaan of geeft de API een fout. Je hebt geen inlog nodig en er komt geen echte data aan te pas.
- **Echte ffwd:** pas als het in de sandbox klopt, laad je de extensie zoals bij Installeren.

## Hoe het werkt
- Een content script draait op `https://app.ffwd.school/*`.
- Het leest de GraphQL-API op `https://api.ffwd.school/api`, met de inlog van de gebruiker (`credentials: 'include'`).
- **Alleen lezen.** De extensie slaat niets op en verstuurt niets.
- De API is niet officieel en kan zonder aankondiging veranderen.

## Bestanden
| Bestand | Inhoud |
| --- | --- |
| `extensie/manifest.json` | laadt de scripts en de stijlen op app.ffwd.school |
| `extensie/gedeeld.js` | gedeeld: de GraphQL-aanroep `vraag()` en de helper `el()` |
| `extensie/status.js` | rekenregels van de statuskaart; puur, zonder DOM of netwerk |
| `extensie/statuskaart.js` | herkent de studentpagina, plaatst de kaart en tekent hem |
| `extensie/statuskaart.css` | stijl van de statuskaart |
| `extensie/ec-overzicht.js` | menu-item, paneel en berekening van het EC-overzicht |
| `extensie/ec-overzicht.css` | eigen stijl van het paneel; werkt zonder andere extensies |
| `sandbox/` | nagemaakte studentpagina met nep-API en verzonnen testdata |
| `tests/` | Node-tests van de rekenregels |

## Regels
- Studentgegevens blijven lokaal. Ze komen niet in deze repository: ook niet als voorbeelddata, export of testbestand. De sandbox en de tests gebruiken alleen verzonnen studenten.
- De API kan ook schrijven. Dat gebruiken we alleen na een expliciet besluit.
