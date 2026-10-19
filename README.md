# Kindler Dach – lokale Website-Demo

**Passwort-Wiederherstellung:** `/admin/login` verlinkt auf `/admin/forgot-password`; der E-Mail-Link führt zu `/admin/reset-password`. Einrichtung und Bedienung: [PASSWORT_ZURUECKSETZEN.md](./PASSWORT_ZURUECKSETZEN.md).

**Supabase jetzt fertig einrichten:** [Nur die verbleibenden persönlichen Schritte](./SUPABASE_VERBINDEN.md). `npm.cmd run setup:local` erzeugt eine abgesicherte vollständige SQL-Ersteinrichtung und erhält bestehende lokale Werte. Der Publishable-Key fehlt noch; echte Cloud-Speicherung ist deshalb weiterhin nicht bestätigt. Aktueller Teststand: 33 lokale Tests bestanden; siehe [PRUEFBERICHT.md](./PRUEFBERICHT.md).

**Aktuelle Fehlerbehebung:** [Bedienung und Einrichtung](./ANLEITUNG.md), [tatsächlich ausgeführte Prüfungen](./PRUEFBERICHT.md). Die aktuelle Vorschau läuft auf `http://localhost:4174`, Admin-Login: `http://localhost:4174/admin/login`. Auf 4173 antwortet noch eine ältere Vorschau ohne die neuen Routen. Supabase benötigt noch den echten Publishable-Key und die Einrichtung im Supabase-Dashboard.

Statische HTML-/CSS-/JavaScript-Website ohne Frontend-Framework, ergänzt um einen Cloudflare-Worker-Endpunkt und ein Supabase-Admin-Dashboard. Die Website ist eine unveröffentlichte Demo. Suchmaschinen-Indexierung ist mit `noindex, nofollow` deaktiviert; dies ist kein Zugriffsschutz.

## Cloudflare Workers

Build-Befehl: `npm run build`. Deploy-Befehl: `npx wrangler deploy`.
`wrangler.jsonc` liefert `dist/` als statische Assets aus und leitet Requests
an den Worker weiter. Der Worker verarbeitet Kontaktanfragen mit Validierung,
Honeypot und Cloudflare Rate Limit. Die Schritte für Supabase, RLS,
Umgebungsvariablen und Inhaberfreischaltung stehen in `SUPABASE_SETUP.md`.
Die Node-Route `/api/reviews` ist bei diesem statischen Hosting nicht verfügbar;
die vorbereitete Google-Synchronisierung benötigt weiterhin einen Server.

## Lokale Vorschau

```powershell
npm.cmd ci
npm.cmd run dev
```

Anschließend http://localhost:4173 öffnen. Beenden mit Strg+C. Für Formularspeicherung und Admin-Login müssen Sie zuvor `.env.local` nach `SUPABASE_SETUP.md` einrichten und die SQL-Migration ausführen. Der lokale Server bindet nur an den lokalen Rechner.

## Dateien und Funktionen

Ergänzung: Bewertungsanzeige im Hero und drei kurze Rezensionsauszüge direkt unter der Vertrauensleiste. Google-Profil verlinkt, Quellen und Stand sichtbar; statische Anzeige ohne Google-Widget. Recherche und Einschränkungen in `research/BEWERTUNGEN.md`. Der lokale Server liefert Änderungen nach Neuladen aus.

Die drei Auszüge laufen als kreisendes Laufband von links nach rechts. Manuelle Bedienung per horizontalem Scrollen, Mausrad über dem Laufband, Mausziehen, Touch-Wischen, Pfeiltasten und Navigationsbuttons. Die Bewegung pausiert beim Darüberfahren und Tastaturfokus sowie während manueller Bedienung. Ein Pause-/Startknopf steuert die automatische Bewegung; bei aktivierter Systemeinstellung für reduzierte Bewegung startet sie pausiert. Identische, für Screenreader ausgeblendete Kopien sorgen für den nahtlosen Umlauf; es werden dadurch keine zusätzlichen Rezensionen behauptet. Implementierung in `public/review-carousel.js`.

Neu: weichere Gestaltung über `public/refinements.css` mit gerundeten Bildern, Karten und Buttons sowie Gesamtansicht aller aktuell verfügbaren Rezensionen. `public/reviews-live.js` und `server/google-reviews.mjs` enthalten eine vorbereitete Google-Synchronisierung. **Sie ist standardmäßig deaktiviert**; die Browserabfrage startet nur, wenn die HTML-Seite ausdrücklich `data-reviews-api="enabled"` setzt und ein geeignetes Backend eingerichtet ist. Im aktuellen Projektstand ist sie nicht aktiviert und es findet kein Live-Abruf statt. Deshalb bleiben die gekennzeichneten Verzeichnisauszüge sichtbar. Aktivierung, Voraussetzungen und Grenzen: `research/GOOGLE-ANBINDUNG.md`. Ein rein statisches Hosting von `dist/` unterstützt diese Serverroute nicht.

- `index.html`: Header, Hero, belegte Leistungen, Leistungs-Accordion, Unternehmensvorstellung, Galerie, Kontaktbereich und Footer.
- `public/styles.css`: Rot/Anthrazit aus dem Original-Logo, responsive Layouts, sichtbare Fokuszustände und reduzierte Animation bei entsprechender Systemeinstellung; Systemschriften ohne externe Anfragen.
- `public/app.js`: mobiles Menü mit Escape und Schließen nach Navigation, native modale Bildansicht, Formularvalidierung und Versand an den lokalen/Cloudflare-API-Endpunkt.
- `worker/index.mjs`, `server/intake.mjs`: Worker-Routen, serverseitige Kontaktvalidierung, Honeypot, Rate Limit und token-geschützter Supabase-RPC-Aufruf.
- `admin.html`, `admin-login.html`, `admin/admin.js`, `public/admin.css`: Login und responsives Dashboard. `@supabase/supabase-js` wird beim Build gebündelt.
- `supabase/migrations/`: Kontaktanfragen-Tabelle, Autorisierungs-Allowlist, RLS-Policies und eingeschränkte RPC-Funktion.
- `SUPABASE_SETUP.md`: Anfängeranleitung für Supabase, lokale Umgebungsvariablen, Worker-Secrets, Inhaberzugang und Tests.
- `impressum.html`, `datenschutz.html`: erreichbare, als Demo gekennzeichnete Anbieterangaben und technische Datenschutzhinweise; keine abschließend geprüften Rechtstexte. `cookie-einstellungen.html` erläutert, dass im geprüften Code keine konfigurierten optionalen Cookies/Dienste existieren und deshalb derzeit keine Auswahloberfläche bereitgestellt wird.
- `public/images/`: acht lokal gespeicherte Originaldateien einschließlich Logo. Herkunft und offene Rechte in `research/assets.json`.
- `scripts/`: lokaler Server, Build und technische Prüfungen.
- `research/`: öffentlich abgerufene Originalseiten, Quellenregister und Analyse. Wird nicht veröffentlicht oder vom lokalen Server ausgeliefert.
- `dist/`: erzeugte statische Website zum späteren Hosting; enthält weder Recherchedateien noch Servercode.

Das Kontaktformular speichert Anfragen erst nach erfolgreicher Supabase-Bestätigung. Name und Nachricht sind erforderlich; E-Mail oder Telefonnummer sind optional, aber mindestens eine Kontaktmöglichkeit ist nötig. Ein Terminformular existiert nicht und wurde nicht hinzugefügt. Admin-Zugriff erfordert einen Supabase-Login plus manuelle UUID-Freischaltung in `authorized_admins`; öffentliche Registrierung ist nicht vorgesehen.

## Prüfungen

Der Performance-Bericht für die ursprüngliche statische Website steht in `PERFORMANCE-BERICHT.md`.
Nach dem Klonen installiert `npm ci` die Entwicklungs- und Build-Werkzeuge.
Die öffentliche Startseite lädt keine externen JavaScript-Pakete; das Admin-Frontend
enthält den lokal gebündelten Supabase-Client.
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

Zu prüfen sind: HTML- und Asset-Verweise, Admin-Bundle, Build, JavaScript-Syntax und die Unit-Tests für Validierung und Worker-Verhalten. Ein echter Supabase-/Cloudflare-End-to-End-Test benötigt Projektzugang und gültige Konfiguration.

**Frühere Browserprüfung am 19.10.2026:** Der statische Produktionsbuild der ursprünglichen Website wurde mit lokalem Wrangler und Headless-Brave bei 320, 375, 768, 1024 und 1440 Pixeln geprüft. Die dort dokumentierte Formularprüfung bezog sich auf den damaligen E-Mail-Entwurf und gilt nicht für die jetzige Supabase-Anbindung. Für die neue Anbindung wurden separat Formularvalidierung, Fehleranzeige ohne Backend-Konfiguration, Erhalt der Eingaben, Admin-Seiten, HTTP-Routen und Worker-Bundle geprüft. Echte Supabase-Speicherung, Admin-Anmeldung, RLS und veröffentlichte Cloudflare-Konfiguration bleiben bis zur Einrichtung der Projektzugänge offen. Lighthouse-Ergebnisse und Messgrenzen der ursprünglichen Demo: `PERFORMANCE-BERICHT.md`.

## Vor Veröffentlichung

1. Bild-, Personen-, Logo- und Textrechte schriftlich mit den jeweiligen Rechteinhabern klären. Der Abruf öffentlicher Dateien stellt keine Lizenz dar. Die Demo ist nur lokal erstellt; keine öffentliche Freigabe erfolgt.
2. Unternehmensdaten, Leistungen und Vertretungsangaben vom Betrieb bestätigen lassen. Register- und Steuerangaben stammen aus dem Original-Impressum, wurden nicht unabhängig bei Behörden validiert.
3. Impressum und Datenschutzerklärung für den tatsächlichen Betreiber und Hoster fachlich vervollständigen; insbesondere berufsrechtliche Angaben, Rechtsgrundlagen, Rechte der Betroffenen, Beschwerdestelle, Empfänger und Fristen klären. Keine veraltete OS-Plattform-Angabe aus dem Original übernommen.
4. Die Supabase-Migration und den Token-Hash einrichten, Publishable Key und Intake-Token als Secrets hinterlegen und den Inhaber freischalten (siehe `SUPABASE_SETUP.md`).
5. Sicht- und Funktionstests bei mindestens 320, 375, 768, 1024 und 1440 Pixeln durchführen; Tastatur, Menü, Galerie, Links und Formular testen.
6. HTTPS-Hosting einrichten, Sicherheitsheader des lokalen Servers beim Hoster übernehmen, finale Domain, Canonical-URL und absolute Social-Media-Bild-URL setzen. Erst nach Freigabe `noindex` und Demo-Kennzeichnung entfernen. Keine lokale Demo ungeprüft öffentlich hochladen.
