# Kindler Dach – lokale Website-Demo

Umgesetzt direkt im zuvor leeren Projektverzeichnis. Keine bestehenden Funktionen oder Dateien ersetzt. HTML/CSS/JavaScript-Website ohne Framework, Installation, Datenbank, Cookies oder Tracking. Ein kleiner Node-Server liefert die lokalen Dateien und die vorbereitete Google-Bewertungsschnittstelle aus. Nicht veröffentlicht. Suchmaschinen-Indexierung ist mit `noindex, nofollow` deaktiviert; dies ist kein Zugriffsschutz.

## Cloudflare Workers

Build-Befehl: `npm run build`. Deploy-Befehl: `npx wrangler deploy`.
Die versionierte `wrangler.jsonc` setzt `assets.directory` auf `./dist`.
Dadurch werden nur die erzeugten Website-Dateien hochgeladen, keine
Recherchedateien, Serverquellen oder installierten Pakete.
Die Node-Route `/api/reviews` ist bei diesem statischen Hosting nicht verfügbar;
die vorbereitete Google-Synchronisierung benötigt weiterhin einen Server.

## Lokale Vorschau

```powershell
node scripts/serve.mjs
```

Anschließend http://localhost:4173 öffnen. Beenden mit Strg+C. Alternativ `npm.cmd run dev` (unter Windows ist `npm.ps1` durch die lokale PowerShell-Richtlinie gesperrt; `npm.cmd` funktioniert ohne Änderung dieser Richtlinie). Keine Abhängigkeiten erforderlich. Der Entwicklungsserver bindet nur an den lokalen Rechner.

## Dateien und Funktionen

Ergänzung: Bewertungsanzeige im Hero und drei kurze Rezensionsauszüge direkt unter der Vertrauensleiste. Google-Profil verlinkt, Quellen und Stand sichtbar; statische Anzeige ohne Google-Widget. Recherche und Einschränkungen in `research/BEWERTUNGEN.md`. Der lokale Server liefert Änderungen nach Neuladen aus.

Die drei Auszüge laufen als kreisendes Laufband von links nach rechts. Manuelle Bedienung per horizontalem Scrollen, Mausrad über dem Laufband, Mausziehen, Touch-Wischen, Pfeiltasten und Navigationsbuttons. Die Bewegung pausiert beim Darüberfahren und Tastaturfokus sowie während manueller Bedienung. Ein Pause-/Startknopf steuert die automatische Bewegung; bei aktivierter Systemeinstellung für reduzierte Bewegung startet sie pausiert. Identische, für Screenreader ausgeblendete Kopien sorgen für den nahtlosen Umlauf; es werden dadurch keine zusätzlichen Rezensionen behauptet. Implementierung in `public/review-carousel.js`. Aktuelle Browserprüfungen sind unten dokumentiert.

Neu: weichere Gestaltung über `public/refinements.css` mit gerundeten Bildern, Karten und Buttons sowie Gesamtansicht aller aktuell verfügbaren Rezensionen. `public/reviews-live.js` und `server/google-reviews.mjs` enthalten eine vorbereitete Google-Synchronisierung. **Sie ist standardmäßig deaktiviert**; die Browserabfrage startet nur, wenn die HTML-Seite ausdrücklich `data-reviews-api="enabled"` setzt und ein geeignetes Backend eingerichtet ist. Im aktuellen Projektstand ist sie nicht aktiviert und es findet kein Live-Abruf statt. Deshalb bleiben die gekennzeichneten Verzeichnisauszüge sichtbar. Aktivierung, Voraussetzungen und Grenzen: `research/GOOGLE-ANBINDUNG.md`. Ein rein statisches Hosting von `dist/` unterstützt diese Serverroute nicht.

- `index.html`: Header, Hero, belegte Leistungen, Leistungs-Accordion, Unternehmensvorstellung, Galerie, Kontaktbereich und Footer.
- `public/styles.css`: Rot/Anthrazit aus dem Original-Logo, responsive Layouts, sichtbare Fokuszustände und reduzierte Animation bei entsprechender Systemeinstellung; Systemschriften ohne externe Anfragen.
- `public/app.js`: mobiles Menü mit Escape und Schließen nach Navigation, native modale Bildansicht mit Tastaturbedienung, Leistungs-Vorauswahl und Formularvalidierung.
- `impressum.html`, `datenschutz.html`: erreichbare, als Demo gekennzeichnete Anbieterangaben und technische Datenschutzhinweise; keine abschließend geprüften Rechtstexte.
- `public/images/`: acht lokal gespeicherte Originaldateien einschließlich Logo. Herkunft und offene Rechte in `research/assets.json`.
- `scripts/`: lokaler Server, Build und technische Prüfungen.
- `research/`: öffentlich abgerufene Originalseiten, Quellenregister und Analyse. Wird nicht veröffentlicht oder vom lokalen Server ausgeliefert.
- `dist/`: erzeugte statische Website zum späteren Hosting; enthält weder Recherchedateien noch Servercode.

Telefonlinks und E-Mail-Links enthalten die belegten Originaldaten. Das Formular validiert Pflichtfelder und bereitet nach erfolgreicher Prüfung einen kodierten `mailto:`-Entwurf vor. Erst ein weiterer Klick öffnet das konfigurierte E-Mail-Programm; dort sendet der Benutzer selbst. Kein Formularserver, kein tatsächlicher Versand durch die Website, keine vorgetäuschte Versandbestätigung. Ohne eingerichtetes E-Mail-Programm steht die Adresse direkt zur Verfügung. Eingaben werden weder gespeichert noch vom Formular an einen Server übertragen.

## Prüfungen

Der aktuelle Performance- und Prüfbericht steht in `PERFORMANCE-BERICHT.md`.
Nach dem Klonen installiert `npm ci` die Entwicklungswerkzeuge. Die Website
bleibt ohne Framework und ohne JavaScript-Abhängigkeiten im Browser.
Neue Fotos werden mit `npm run images:optimize` in responsive WebP-Varianten
umgerechnet; die Originale bleiben erhalten. Danach `npm run check` und
`npm run build` ausführen. Die Varianten werden mit versioniert, damit der
Cloudflare-Build keine Bildkonvertierung benötigt.

```powershell
node scripts/check.mjs
node --check public/app.js
node --check scripts/serve.mjs
node scripts/build.mjs
npm.cmd test
# Während der lokale Server läuft:
node scripts/smoke.mjs
```

Erfolgreich geprüft: drei HTML-Seiten, lokale Bild-/Dateiverweise, interne Sprungziele, eindeutige IDs, deutsche Seitensprache, einzelne H1 pro Seite, Demo-Indexierungsschutz, Bilddateisignaturen, JavaScript-Syntax, statischer Build und HTTP-Auslieferung einschließlich Schutz der Recherche- und Projektdateien.

**Browserprüfung am 19.10.2026:** Der statische Produktionsbuild wurde mit lokalem Wrangler und Headless-Brave bei 320, 375, 768, 1024 und 1440 Pixeln geprüft. Menü, Escape-Taste, Galerie, Formularvalidierung, Entwurfserstellung und Entwurfsänderung, Bewertungsübersicht sowie beide Rechtstextseiten funktionieren in diesen Prüfungen. Alle Seitenbilder wurden nach Scrollen geladen; kein horizontaler Seitenüberlauf, keine Konsolenfehler im statischen Build. Die Animation wurde zusätzlich auf Bewegung, Pausieren, Sichtbarkeit und reduzierte Bewegung geprüft. Echte Mobilgeräte, andere Browser und das veröffentlichte Cloudflare-System bleiben offen. Lighthouse-Ergebnisse und Messgrenzen: `PERFORMANCE-BERICHT.md`.

## Vor Veröffentlichung

1. Bild-, Personen-, Logo- und Textrechte schriftlich mit den jeweiligen Rechteinhabern klären. Der Abruf öffentlicher Dateien stellt keine Lizenz dar. Die Demo ist nur lokal erstellt; keine öffentliche Freigabe erfolgt.
2. Unternehmensdaten, Leistungen und Vertretungsangaben vom Betrieb bestätigen lassen. Register- und Steuerangaben stammen aus dem Original-Impressum, wurden nicht unabhängig bei Behörden validiert.
3. Impressum und Datenschutzerklärung für den tatsächlichen Betreiber und Hoster fachlich vervollständigen; insbesondere berufsrechtliche Angaben, Rechtsgrundlagen, Rechte der Betroffenen, Beschwerdestelle, Empfänger und Fristen klären. Keine veraltete OS-Plattform-Angabe aus dem Original übernommen.
4. Wahlweise E-Mail-Entwurfsfunktion beibehalten oder einen realen, datensparsamen Formularversand samt Missbrauchsschutz und korrekter Versandbestätigung anbinden.
5. Sicht- und Funktionstests bei mindestens 320, 375, 768, 1024 und 1440 Pixeln durchführen; Tastatur, Menü, Galerie, Links und Formular testen.
6. HTTPS-Hosting einrichten, Sicherheitsheader des lokalen Servers beim Hoster übernehmen, finale Domain, Canonical-URL und absolute Social-Media-Bild-URL setzen. Erst nach Freigabe `noindex` und Demo-Kennzeichnung entfernen. Keine lokale Demo ungeprüft öffentlich hochladen.
