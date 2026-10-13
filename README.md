# ffwd addon

Een Chrome-extensie (Manifest V3) die functies toevoegt aan [ffwd](https://app.ffwd.school/), het feedback- en assessmentplatform van de opleiding. Gemaakt voor docenten van de opleiding; collega's mogen hem vrij gebruiken en aanpassen (MIT-licentie).

> **Goed om te weten**
> - Dit is geen officieel product van ffwd of van de school. De extensie gebruikt de interne API van ffwd, die zonder aankondiging kan veranderen. Werkt iets niet meer, meld het dan.
> - De extensie **leest alleen**, met je eigen inlog in ffwd. Ze verstuurt niets naar andere diensten; je ziet alleen wat je in ffwd ook mag zien.
> - De rekenregels van de statuskaart (fases, 54 EC voor de Hoofdfase, cum laude) gelden voor onze opleiding. Bij een andere opleiding kloppen ze waarschijnlijk niet.

## Functies
- **Statuskaart** op elke studentpagina (`/students/:id`), tussen de metadata en de afgeronde assessments:
  - het totaal van 240 EC;
  - de vier fases (Propedeuse, Hoofdfase, Stage, Afstuderen) tegen de eisen uit ffwd `programs`, elk met een eigen balk en klaar, open of nog dicht;
  - **Nog te behalen:** de tekorten van elke open fase, met cum laude direct bij de Hoofdfase;
  - **Per competentie** (standaard ingeklapt): een matrix van competentie × niveau voor de Propedeuse en de Hoofdfase, overal behaald/verplicht, bijvoorbeeld 54/24. Bij hoveren zie je de uitsplitsing in verplicht, keuze en wat nergens voor telt. Groen = vol, oranje = deels, grijs = nog niets. Stage en Afstuderen worden in één keer beoordeeld en staan alleen bij de fases.
- **Statuskaart bij een assessment**: op een assessmentpagina (`/sessions/:id`) klapt de knop **EC** rechts een paneel open met dezelfde statuskaart, compact.
  - Bij een assessment met meerdere studenten kies je bovenin de student; ffwd kent niet elke naam, dan staat er "Student 1", "Student 2".
  - De extensie onthoudt of het paneel open is en welke student je per assessment koos. Esc sluit het paneel.
  - Op een breed scherm (vanaf ongeveer 1420 px) staat het naast de inhoud van ffwd, anders eroverheen.
- **Assessmentlijst als rijen**: op de lijst met assessments (`/sessions`) wisselt een schakelaar tussen de blokken van ffwd en rijen. De extensie onthoudt je keuze en begint met rijen.
  - Per rij: datum en tijd, titel met de context, soort, status, studenten en docenten.
  - Status: Gepland, Open of Afgerond, bij een open assessment met de deadline. Staat in een afgerond assessment een student in ffwd nog niet op `completed`, dan meldt de rij dat en kleurt die student oranje.
  - Studenten zijn links naar hun studentpagina. Onbekende namen worden "Student n", net als in de aside. Docenten staan onder elkaar, de eigenaar vetgedrukt en vooraan.
  - Per studiejaar (1 september t/m 31 augustus), elk met een kopregel die je open- en dichtklapt, met het aantal assessments en hoeveel studenten niet afgerond zijn. Het huidige studiejaar staat standaard open; welke jaren open staan wordt onthouden.
  - Bovenaan de schakelaar en **Vernieuw**; daaronder een eigen regel met zoeken, filters en het aantal. Niets verspringt als je iets aanklikt: een actief filter krijgt een getal op de hoek, **Wis filters** houdt zijn plek.
  - Filters naast het zoekveld: uitklapmenu's **Soort**, **Status** (Gepland, Open, Afgerond, Student niet afgerond) en **Docent**, met vinkjes en per optie het aantal assessments, en de knop **Alleen van mij** (jij bent eigenaar). In een menu vink je meer opties aan; één ervan is genoeg. Tussen filters moet alles kloppen. Klik ernaast of druk op Esc om een menu te sluiten. De filters worden onthouden; **Wis filters** zet ze terug.
  - Zoeken op titel, context, soort, student, studentnummer of docent; elk woord moet passen. Tijdens het zoeken, en bij een filter op soort, status of docent, staan alle jaren met een treffer open. **Alleen van mij** klapt niets open. Sorteren door op een kolomkop te klikken; dat gebeurt binnen elk studiejaar.
  - De blokken van ffwd blijven staan en worden alleen verborgen.
- **EC-overzicht**: een menu-item in de zijbalk van ffwd. Het opent een tabel met de behaalde EC van al je studenten:
  - het totaal, met een balk die de voortgang naar 240 EC laat zien;
  - EC per competentie;
  - EC per behaald niveau (N1–N3).

  Je kunt filteren per groep en sorteren op elke kolom. Klik je op een naam, dan opent de studentpagina in ffwd.

## Installeren
Werkt in Chrome en andere Chromium-browsers (Edge, Brave, Arc).

**Met een zip (zonder git)**
1. Download `ffwd-addon-vX.Y.Z.zip` bij de nieuwste [release](../../releases/latest) en pak hem uit op een vaste plek, bijvoorbeeld in Documenten. Gooi de map daarna niet weg: Chrome laadt de extensie uit die map.
2. Ga in Chrome naar `chrome://extensions` en zet rechtsboven **Developer mode** aan.
3. Kies **Load unpacked** en daarna de uitgepakte map `ffwd-addon`.
4. Open of herlaad ffwd.

**Met git**
1. `git clone` deze repository.
2. Laad in `chrome://extensions` (met **Developer mode** aan) via **Load unpacked** de map `extensie`.

## Bijwerken
- **Zip:** download de nieuwe zip, pak hem uit over de oude map (of vervang de map) en klik in `chrome://extensions` bij de extensie op ↻. Herlaad daarna ffwd.
- **Git:** `git pull`, dan ↻ bij de extensie en ffwd herladen.

Je instellingen (cum laude per student, blokken of rijen, filters) blijven bewaard, zolang je de extensie niet verwijdert.

## Rekenregels van de statuskaart
- Alleen resultaten van afgeronde assessments tellen.
- Stage- en afstudeerassessments tellen voor Stage en Afstuderen. De rest telt op behaald niveau: N1 voor de Propedeuse, N2 en N3 voor de Hoofdfase.
- Alleen het exacte niveau telt: N3 vult geen N2-eis.
- Stage en Afstuderen worden in één assessment beoordeeld: alle 30 EC tegelijk, of nog niets. Zolang ze lopen, staat er "wordt in één assessment beoordeeld".
- Binnen een fase eerst de eisen per competentie, daarna de keuze-EC op hetzelfde niveau. Wat overblijft is 'boven de eisen'.
- Fases lopen niet strikt na elkaar. De Propedeuse is altijd open, de Hoofdfase gaat open na 54 EC in de Propedeuse (N1), de Stage na een volle Propedeuse, en Afstuderen na de Hoofdfase én de Stage. Dit staat in `VOORWAARDEN` in `status.js`.
- Van elke open fase die nog niet vol is, toont de kaart de tekorten, onder elkaar. Een open fase zonder EC staat ingeklapt op één regel; klik om de eisen te zien.
- EC in een fase die nog niet open is, tellen wel mee. De kaart meldt ze apart.

## Cum laude
- Per student zet je in de kaart een schakelaar **Cum laude** aan. Die wordt onthouden in de opslag van de extensie (`chrome.storage.local`), alleen in je eigen browser.
- Cum laude is een aparte toets: de eisen van de fases en het totaal veranderen er niet door. De student haalt 21 EC op N3 in de Hoofdfase: Onderzoeken N3 3 plus Keuze N3 18 (3 + 15 die anders op N2 mogen).
- Stage en afstuderen tellen niet mee voor die 21 EC. Minor en exchange tellen voorlopig wel mee, omdat ffwd er geen eigen soort voor heeft.
- **Niet meer haalbaar** als het tekort op N3 groter is dan de ruimte die nog over is in de Hoofdfase: de open keuze-eisen en de open N3-eisen. Open verplichte N2-eisen zijn geen ruimte. De kaart kleurt het blok dan oranje, met een melding.
- De regels staan in `CUM_LAUDE` in `status.js`.

## Testen
- **Rekenregels:** `node --test` in deze map. De tests staan in `tests/` en gebruiken verzonnen studenten uit `sandbox/fixtures.js`.
- **Sandbox:** open `sandbox/index.html` in Chrome. Het zijn nagemaakte ffwd-pagina's (studentpagina, lijst met assessments, assessmentpagina) met een nep-API en verzonnen data, die dezelfde bestanden laden als de extensie. Met de balk linksonder kies je de pagina, laat je het laden traag gaan of geeft de API een fout. `?aside=open` zet het paneel op een assessment vooraf open, `?cumlaude=aan` de cum-laudeschakelaar. Je hebt geen inlog nodig en er komt geen echte data aan te pas.
- **Echte ffwd:** pas als het in de sandbox klopt, laad je de extensie zoals bij Installeren.

## Hoe het werkt
- Een content script draait op `https://app.ffwd.school/*`.
- Het leest de GraphQL-API op `https://api.ffwd.school/api`, met de inlog van de gebruiker (`credentials: 'include'`).
- **Alleen lezen.** De extensie schrijft niets naar ffwd en verstuurt niets naar andere diensten.
- Lokaal, alleen in je eigen browser (`chrome.storage.local`), onthoudt ze je instellingen: cum laude per student, open of dicht, blokken of rijen, open studiejaren en filters. Geen studentgegevens.
- De API is niet officieel en kan zonder aankondiging veranderen.

## Bestanden
| Bestand | Inhoud |
| --- | --- |
| `extensie/manifest.json` | laadt de scripts en de stijlen op app.ffwd.school |
| `extensie/icons/` | icoon: `icon.svg` is de bron, de PNG's (16–128 px) zijn eruit gemaakt |
| `extensie/gedeeld.js` | gedeeld: de GraphQL-aanroep `vraag()`, de helper `el()` en lokaal onthouden (`lees()`, `bewaar()`) |
| `extensie/status.js` | rekenregels van de statuskaart; puur, zonder DOM of netwerk |
| `extensie/statuskaart.js` | herkent de studentpagina, plaatst de kaart en tekent hem |
| `extensie/statuskaart.css` | stijl van de statuskaart |
| `extensie/assessment-aside.js` | knop en paneel op de assessmentpagina; de kaart komt uit statuskaart.js |
| `extensie/assessment-aside.css` | stijl van het paneel |
| `extensie/assessmentlijst.js` | schakelaar blokken/rijen en de rijen op `/sessions`; status, zoeken en sorteren zijn los te testen |
| `extensie/assessmentlijst.css` | stijl van de rijen |
| `extensie/ec-overzicht.js` | menu-item, paneel en berekening van het EC-overzicht |
| `extensie/ec-overzicht.css` | eigen stijl van het paneel; werkt zonder andere extensies |
| `sandbox/` | nagemaakte studentpagina, lijst met assessments en assessmentpagina, met nep-API en verzonnen testdata |
| `tests/` | Node-tests van de rekenregels |

## Regels
- Studentgegevens blijven lokaal. Ze komen niet in deze repository: ook niet als voorbeelddata, export of testbestand. De sandbox en de tests gebruiken alleen verzonnen studenten.
- De API kan ook schrijven. Dat gebruiken we alleen na een expliciet besluit.

## Een release maken
1. Verhoog `version` in `extensie/manifest.json` en laat `node --test` slagen.
2. Maak de zip met `./release.sh`. Die draait de tests en zet `dist/ffwd-addon-vX.Y.Z.zip` klaar, met daarin de map `ffwd-addon` (de inhoud van `extensie/`).
3. Maak op GitHub een release met tag `vX.Y.Z` en voeg de zip toe.

## Licentie
[MIT](LICENSE): vrij te gebruiken, aan te passen en te delen, zonder garantie.
