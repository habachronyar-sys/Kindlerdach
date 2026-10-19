# Prüfung am 19.10.2026

## Passwort-Wiederherstellung erg?nzt

- Login-Link ?Passwort vergessen??, E-Mail-Anforderungsseite und gesch?tzte Passwort-R?cksetzseite implementiert. Beide neuen Routen funktionieren im lokalen Server; Worker-Routen und Produktionsbuild wurden ebenfalls erg?nzt.
- Tempor?re Supabase-Recovery-Sitzung nur im Arbeitsspeicher, Pr?fung des Benutzers und seiner Admin-Freischaltung, Entfernung der Token aus der Adresszeile, keine neue Registrierung oder ?nderung der RLS-Regeln. Passwort-Erfolg erst mit best?tigtem Benutzer im updateUser-Ergebnis.
- npm.cmd test: **44 Tests bestanden**, davon 11 f?r die Passwort-Wiederherstellung mit SDK-/DOM-Testdoubles. Build erfolgreich; npm.cmd run check: 8 Seiten und 85 lokale Verweise gepr?ft.
- Lokaler HTTP-Smoke-Test: **29 Seiten/Assets** erreichbar, interne Dateien gesperrt. Login und beide Passwort-Routen samt abschlie?endem Schr?gstrich: HTTP 200, Cache-Control no-store und Referrer-Policy no-referrer.
- Cloudflare wrangler deploy --dry-run erfolgreich; nichts ver?ffentlicht.
- Kein verbundener Browser verf?gbar; keine Browser-Sichtpr?fung. Keine echte E-Mail angefordert und kein echtes Passwort ge?ndert. Supabase-Redirect-Freigabe, Vorlage und SMTP-Konfiguration sind noch zu pr?fen/einzurichten. Standard-Supabase-Mailversand gen?gt nicht f?r einen Empf?nger au?erhalb des Projekt-Teams.
- Einmalige Betreiber-Einrichtung und sp?tere selbstst?ndige Inhaber-Bedienung: PASSWORT_ZURUECKSETZEN.md.


## Nachtrag: bereitgestellter Publishable-Key

Der vom Inhaber bereitgestellte Publishable-Key wurde in .env.local eingetragen, ohne URL oder Intake-Token zu ver?ndern. Keine Schl?sselwerte wurden protokolliert. Der erste Diagnoseversuch scheiterte an der Netzwerk-Sandbox (EACCES); mit genehmigtem Netzwerkzugriff wurde die echte Supabase-API gepr?ft.

- Auth akzeptiert den Key: HTTP 200.
- ?ffentliche Registrierung: disable_signup=false, also noch aktiviert. Nicht ge?ndert.
- Anonyme Anmeldung: deaktiviert.
- contact_requests und authorized_admins: HTTP 404 / PGRST205, also nicht im Data-API-Schema-Cache auffindbar. Damit ist die Tabellenexistenz im Datenbankkatalog noch nicht bewiesen oder widerlegt.
- Kontakt-RPC: HTTP 404 in der Diagnose; ?ber die verwendete API noch nicht verf?gbar.
- setup:local erneut erfolgreich ausgef?hrt; vollst?ndige SQL-Vorbereitung liegt vor.

Keine Testnachricht angelegt, keine Cloud-Einstellung ge?ndert und nichts ver?ffentlicht. Die Datenbank-Metadaten m?ssen im Supabase SQL Editor mit supabase/check.sql gepr?ft und danach bei einer neuen Datenbank die vorbereitete SETUP.local.sql ausgef?hrt werden. Fr?here Angaben ?ber den fehlenden Publishable-Key unten beschreiben den damaligen Stand.


## Aktuelle Nachprüfung der Supabase-Vorbereitung

Diese Nachprüfung ergänzt den früheren Prüflauf unten. Vollständig gelesen wurden ANLEITUNG.md, SUPABASE_SETUP.md, beide Migrationen und die relevanten Konfigurations-/Backend-/Admin-Dateien. Die drei vorgesehenen Variablen wurden ohne Ausgabe ihrer Werte geprüft: Projekt-URL stimmt, Intake-Token ist gültig, Publishable-Key ist weiterhin leer. `.env.local` blieb beim erneuten Setup bytegenau unverändert.

Neu behoben/vorbereitet:

- Basis-Migration in eine Transaktion eingeschlossen; explizite Funktionsrechte statt möglicher zusätzlicher Supabase-Default-Grants; NULL-Betreff und weniger als sechs Telefonziffern werden ausdrücklich zurückgewiesen. Die zweite Migration ist ein abhängiges, idempotentes Ein-Admin-Index-Upgrade.
- Vollständige `supabase/SETUP.local.sql` aus beiden Migrationen plus passendem Hash erzeugt. Der vorgeschaltete Guard stoppt bei bestehenden Projektobjekten oder vorhandenem private-Schema, bevor Änderungen ausgeführt werden. Ein bestehendes Schema wird nicht blind angepasst.
- `supabase/TOKEN.local.sql` bestätigt denselben Hash oder legt einen fehlenden an; ein anderer vorhandener Hash wird nicht mehr durch ein Upsert überschrieben. Kein Intake-Token ist in den SQL-Dateien enthalten. SHA-256 über den UTF-8-Token-Text wurde lokal nachgerechnet und stimmt.
- `supabase/check.sql` für rein lesende Metadatenprüfung und `supabase/authorize-admin.sql` für ausdrückliche Freischaltung eines bestehenden Benutzers vorbereitet. Keine Konten angelegt oder Autorisierungen in der Cloud geändert.
- Diagnose akzeptiert eine pauschale 401-Antwort nicht länger als Hinweis auf funktionierende Tabellenrechte. Nach abgewiesenem Auth-Key werden nachfolgende Cloud-Prüfungen übersprungen. Anonyme Anmeldung wird zusätzlich geprüft.
- Aktuelle persönliche Klickanleitung: [SUPABASE_VERBINDEN.md](./SUPABASE_VERBINDEN.md). Alte Anweisungen zum manuellen Hash-Austausch wurden ersetzt.

Aktuell ausgeführt:

| Befehl/Prüfung | Ergebnis |
| --- | --- |
| `npm.cmd run setup:local` | Erfolgreich; Konfiguration erhalten, SQL-Dateien erzeugt, keine Geheimnisse ausgegeben |
| `npm.cmd run diagnose` | Exitcode 1 / OFFEN, weil Publishable-Key fehlt; Cloud-Prüfungen bewusst übersprungen |
| `npm.cmd test` | **33 Tests bestanden**, davon 4 neue Tests für Konfigurationserhalt, stabile Token-Erzeugung, Hash-Berechnung, Fehlerfälle und SQL-Zusammenstellung |
| `npm.cmd run build` | Erfolgreich; keine Veröffentlichung |
| `npm.cmd run check` | 6 Seiten und 75 lokale Verweise erfolgreich geprüft |
| Git-Ausschlüsse | `.env.local`, `supabase/SETUP.local.sql`, `supabase/TOKEN.local.sql` werden ignoriert |

**Nicht nachgewiesen:** Existenz/Konflikte der Cloud-Tabellen, tatsächlich installierte RPC/RLS/Grants, gesperrte Registrierung, funktionierender Admin und dauerhafte Speicherung. Kein Publishable-Key und keine privilegierte Datenbankverbindung sind verfügbar. Auch kein lokaler PostgreSQL-/Docker-Befehl wurde gefunden; die SQL-Dateien wurden deshalb **nicht gegen einen PostgreSQL-Server ausgeführt**. Die neuen Tests prüfen den Generator und seine Schutzmaßnahmen, nicht die Ausführung von PL/pgSQL. Frühere HTTP-/Worker-Prüfungen unten wurden in dieser Nachprüfung nicht erneut durchgeführt.

Alle Änderungen dieser Nachprüfung betreffen lokale Projektdateien und generierte Artefakte. Keine Daten gelöscht, keine produktiven Einstellungen geändert und nichts veröffentlicht.

## Nachgewiesene Ausgangsfehler

1. Auf `127.0.0.1:4173` lief bereits ein Node-Prozess mit `scripts/serve.mjs`. Die laufende Fassung lieferte für `/api/contact`, `/api/config` und `/admin/login` jeweils **HTTP 404, „Seite nicht gefunden.“** Der aktuelle Quellcode enthält diese Routen. Der laufende Server war also nicht auf dem aktuellen Stand. Die genaue ursprüngliche Browsermeldung lässt sich ohne angeschlossenen Browser nicht nachstellen; ein 404 ist zudem kein Netzwerkabbruch. Beides wird ausdrücklich unterschieden.
2. Es gab keine `.env.local` und keine Supabase-Variablen in der verfügbaren Prozessumgebung. In `.env.example` war die Projekt-URL eingetragen, der Publishable-Key und das Intake-Token waren leer. Ohne diese Werte kann der aktuelle Kontaktservice keine Nachricht speichern. Ein vorhandener Schlüssel in einem nicht zugänglichen Cloudflare-Konto ist damit nicht ausgeschlossen.
3. Die vorhandene Admin-Allowlist hatte keine Datenbankbegrenzung auf einen Administrator. Diese Begrenzung wurde ergänzt.
4. Der Startseiten-Footer enthielt keinen Admin-Zugang. Ein Link wurde hinzugefügt.

## Änderungen

- `server/config.mjs`: gemeinsame Prüfung und öffentliche Ausgabe ausschließlich von URL und Publishable-Key. Kein Intake-Token in `/api/config`.
- `server/intake.mjs`: abgesicherte Limiter-Fehler, Prüfung der RPC-Bestätigung, Fehlercodes im Serverlog ohne Kundeninhalte/Token. Datenbank-, Netzwerk- und Konfigurationsfehler ergeben keinen Erfolg.
- `public/app.js`: Zeitlimit, klare Fehlermeldung für fehlenden Formularservice, Erhalt der Eingaben.
- `scripts/serve.mjs`: einheitliche Konfiguration, Admin-Routen einschließlich abschließendem Schrägstrich, verständlicher Portfehler und Konfigurationshinweis beim Start.
- `worker/index.mjs`, `wrangler.jsonc`: explizite Startseiten- und Admin-Umschreibungen sowie `html_handling: "none"`. Im echten lokalen Worker wurden HTTP 200 ohne Weiterleitung für diese Routen geprüft.
- `admin/admin.js`, HTML und CSS: deaktivierter Login bei fehlender Konfiguration, Dashboard-Inhalte bis zur Zugriffskontrolle verborgen, Abmeldung bei Sitzungsverlust, erneute Berechtigungsprüfung beim Aktualisieren, seitenweises Laden statt unbemerktem Abschneiden am Supabase-Zeilenlimit. Vorhandene Anzeige, Details, Status, Archiv, Suche und Löschen bleiben über Supabase-Abfragen umgesetzt.
- SQL-Migrationen: eindeutiger Index auf konstanten Wert begrenzt die Allowlist auf höchstens eine Identität; keine öffentliche Selbstfreischaltung. Diese SQL-Änderungen sind lokal vorbereitet, **nicht auf dem Cloud-Projekt ausgeführt**.
- `scripts/setup-local.mjs`: `.env.local` mit kryptografisch zufälligem Intake-Token angelegt; echten Publishable-Key muss der Inhaber ergänzen. Hash-Abfrage für Supabase ohne Ausgabe des Tokens. Vorhandene Konfiguration wird nicht überschrieben.
- `scripts/diagnose.mjs`: lesende Diagnose und abgewiesener RPC-Aufruf mit null-Token; keine Testnachrichten. Mit dem derzeit fehlenden Key wurden die Cloud-Prüfungen übersprungen.
- `ANLEITUNG.md`: Einrichtung, einmaliger Admin, Start, Bedienung, Veröffentlichung und Fehlersuche.

## Ausgeführt und bestanden

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| `npm.cmd test` | 29 Tests bestanden: Build, bestehende Google-Rezensionslogik, Kontaktvalidierung, RPC-Aufruf/Fehler, Worker-Routen/Konfiguration und Admin-Zugriffskontrolle mit Testdoubles |
| `npm.cmd run check` | 6 HTML-Seiten, 75 lokale Verweise, Bilder und Sprungziele geprüft |
| Syntaxprüfung | `admin/admin.js`, `public/app.js`, `server/intake.mjs`, Setup- und Diagnoseskripte geprüft |
| Build | Admin-Bundle und statische Assets erfolgreich erzeugt |
| `node scripts/smoke.mjs`, `PORT=4174` | 24 Seiten/Assets erreichbar; interne Dateien, `.env.local` und Projektquellen gesperrt |
| Lokaler Node-Server | Auf 4174 gestartet; Startseite, `/admin`, `/admin/`, `/admin/login`, `/admin/login/`, Bundle und Konfiguration erreichbar |
| Lokales Formular-HTTP | Gültige Eingaben ohne Key: **503** mit Konfigurationshinweis; ungültige Eingaben: **400**; fremder Origin: **403** |
| `/api/config` lokal | `configured: false`, `url: null`, `publishableKey: null`; kein Intake-Token |
| Supabase-Erreichbarkeit ohne Key | Projektadresse antwortet mit **401**, „No API key found in request“; kein Beleg für Tabellen oder Policies |
| Cloudflare-Paketierung | `wrangler deploy --dry-run` erfolgreich, Assets- und Rate-Limit-Bindung erkannt; nichts veröffentlicht |
| Echter lokaler Cloudflare-Worker auf 8787 | `/`, `/admin`, `/admin/`, `/admin/login`, `/admin/login/`, `/admin.html`, `/api/config`: **200**, kein Location-Header |
| Geheimnisdatei | `.env.local` wird von Git ignoriert |

Die Supabase-Antworten in den automatisierten Speicher- und Admin-Tests sind **simuliert**. Diese Tests beweisen den Kontrollfluss, nicht eine Cloud-Speicherung oder funktionierende RLS im echten Projekt.

Der Build scheiterte innerhalb der Dateisandbox zunächst am Zugriff von Esbuild auf übergeordnete Verzeichnisse. Mit den genehmigten erweiterten Dateirechten bestanden Build und Tests. Das ist eine Einschränkung dieser Ausführungsumgebung und kein nachgewiesener Website-Laufzeitfehler. Die Build-Konfiguration erhält zusätzlich ein ausdrückliches Arbeitsverzeichnis und eine leere TypeScript-Konfiguration.

## Nicht durchgeführt / nicht nachweisbar

- Echte Kontaktanfrage in Supabase speichern, im Dashboard öffnen und nach Neuladen wiederfinden: **Publishable-Key und eingerichteter Cloud-Datenbankzustand fehlen**.
- SQL-Migrationen, vorhandene Tabellen, RLS-Policies, Autorisierungs-UUID, Token-Hash und Auth-Einstellungen im Cloud-Projekt prüfen: **kein angemeldeter Projektzugang**.
- Echte Admin-Anmeldung, Statuswechsel, Archivieren, Löschen und Zugriffsversuche mit anonymem/fremdem Konto: **keine entsprechenden Zugangsdaten**.
- Öffentliche Registrierung im tatsächlichen Projekt deaktiviert: **muss im Supabase-Dashboard gesetzt und geprüft werden**. Keine Registrierung im Frontend allein genügt dafür nicht.
- Browserbedienung, Konsole, Netzwerkansicht und responsive Sichtprüfung: **kein verbundener Browser in dieser Sitzung verfügbar**. Die Browserinventur zeigte keine Browser oder Tabs. Frühere Browserprüfungen in README/PERFORMANCE-BERICHT betreffen frühere Projektstände.
- Online-Domain, bestehendes Cloudflare-Deployment und Produktions-Secrets: **keine nachgewiesene veröffentlichte Adresse und kein Hosting-Kontozugang**. Kein Deploy vorgenommen.
- Cloudflare-Ratebegrenzung in Produktion: **nur lokaler Kontrollfluss und Paketierung geprüft**; Wrangler weist für die aktuelle `unsafe`-Binding-Konfiguration auf experimentelle Felder hin.

## Laufende Vorschau

Die aktuelle Node-Vorschau läuft auf **http://localhost:4174**. Der Standardport im Code bleibt 4173. Der alte Server auf 4173 wurde nicht erfolgreich beendet. PowerShell `Stop-Process` scheiterte intern; die automatische Freigabe lehnte einen weiteren Versuch mit unverifizierter fester PID ab, da diese zwischenzeitlich neu vergeben sein könnte. Die sichere Lösung war der freie Port 4174.

Nach Eintragen des Keys den aktuellen Vorschau-Server neu starten, damit er die geänderte `.env.local` lädt. Konkrete Befehle und alle verbleibenden Schritte stehen in [ANLEITUNG.md](./ANLEITUNG.md).
