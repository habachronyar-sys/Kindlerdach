# Prüfung und Optimierung der bestehenden Kindler-Dach-Website

Stand: 19. Oktober 2026. Die Änderungen sind lokal umgesetzt und noch nicht gepusht oder veröffentlicht. Die bestehende Website, ihre Inhalte, Bilder und Funktionen wurden beibehalten. Es wurde kein Framework eingeführt.

**1. Projektanalyse und gefundene Probleme**

Die Website verwendet drei HTML-Seiten, zwei CSS-Dateien und drei kleine Browser-Skripte. `public/` enthält die öffentlichen Dateien, `scripts/` die Entwicklungswerkzeuge und `server/` die optionale Google-Bewertungsschnittstelle. `research/` enthält Recherchematerial. Der Produktionsbuild erzeugt `dist/`; `wrangler.jsonc` konfiguriert Cloudflare Workers Static Assets. Es handelt sich hier um Workers, nicht um ein Pages-Projekt.

Es gibt keine extern geladenen Schriftarten, eingebetteten Karten, Videos oder Browser-Bibliotheken. Google und Branchenverzeichnisse werden verlinkt. Keine Datenbank, keine Supabase-Anbindung, keine Reservierungsfunktion und kein Administratorbereich sind vorhanden. Das Kontaktformular bereitet ausschließlich einen E-Mail-Entwurf vor. Ein tatsächlicher Versand oder eine dauerhafte Speicherung wird weiterhin nicht behauptet.

| Risiko | Ausgangszustand | Maßnahme |
|---|---|---|
| Große Fotos | Sieben JPEGs mit zusammen rund 3,47 MB; größte Datei 787 KB | Responsive WebP-Dateien und angepasste Auswahl im Browser |
| Mobiles Titelbild | Vollständiges Desktop-JPEG trotz großem unsichtbarem Rand | Mobile Bildvariante mit dem bisherigen Fokuspunkt und früher Ladepriorität |
| Fehlende Bewertungs-API beim statischen Hosting | Wiederholte Anfragen auf eine nicht vorhandene Route möglich | Statischer Build deaktiviert die API; optionale Serverfunktion bleibt erhalten |
| Animation im Ruhezustand | Permanenter requestAnimationFrame-Aufruf | Berechnung nur bei sichtbarer, laufender Animation |
| Alte Build-Dateien | Vorherige Ausgabedateien konnten erhalten bleiben | Vollständig neu erzeugter, fest auf das Projekt begrenzter dist-Ordner |
| Abgeschnittenes Logo | Kleiner Teil des Schriftzugs im Header verdeckt | Geringe Anpassung der Logo-Abmessungen innerhalb des bestehenden Headers |

**2. Vorgenommene Änderungen**

Die Originalfotos bleiben unverändert im Projekt. `scripts/optimize-images.mjs` erzeugt mit `sharp` WebP-Varianten in 640, 960 und – soweit das Original groß genug ist – 1280 Pixeln sowie in Originalbreite. Qualität 78 ist eine verlustbehaftete Einstellung; eine pixelgenaue Identität wird nicht behauptet. Die Motive und Layouts bleiben erhalten. Die mobile Titelbildvariante entfernt die bereits außerhalb des sichtbaren Ausschnitts liegenden Seiten mit demselben horizontalen Fokuspunkt. Der visuelle Vergleich des Titelbereichs erfolgte anhand echter Browser-Screenshots.

`srcset` und `sizes` steuern die Bildauswahl. Das Titelbild wird früh und mit hoher Priorität angefordert; responsive Preloads und Bildquelle stimmen überein. Unterhalb des Titelbereichs bleiben die Bilder lazy geladen. Größenangaben, bestehende Seitenverhältnisse und object-fit bleiben erhalten. Die Galerie öffnet weiterhin die echten Originalaufnahmen in voller Auflösung. Nur JPEGs, die tatsächlich nicht mehr referenziert werden, entfallen im Produktionsbuild.

`sharp` ist eine Entwicklungsabhängigkeit, keine Browser-Abhängigkeit. `package-lock.json` hält die Installation reproduzierbar. Neue Bilder lassen sich mit `npm run images:optimize` erneut konvertieren; die erzeugten Bilder müssen zusammen mit dem HTML versioniert werden. Die normale Cloudflare-Erstellung führt keine Bildkonvertierung aus. AVIF wurde versuchsweise geprüft; für diese Änderung bleibt es bei WebP, um eine weitere Format- und Fallback-Ebene zu vermeiden.

Die Bewertungsfunktion bleibt bei einem späteren Node-Hosting mit autorisiertem Google-Zugang verfügbar. Bei 404/405 und fehlender Google-Konfiguration stoppt das Skript weitere automatische Versuche und entfernt den entsprechenden Sichtbarkeits-Listener. Im statischen Build startet es keine API-Anfrage. Die drei vorhandenen Auszüge und die Gesamtübersicht bleiben lesbar.

Beim Laufband bleiben automatische Bewegung, Wischen, Ziehen, Pfeiltasten, Navigationsbuttons und Pause erhalten. Außerhalb des sichtbaren Bereichs, im Hintergrund oder während einer Pause werden keine Animationsframes angefordert. Die Einstellung für reduzierte Bewegung wird berücksichtigt.

**3. Tatsächlich ausgeführte Prüfungen und Ergebnisse**

Produktionsbuild und Dateiprüfung bestehen. Geprüft wurden drei HTML-Seiten und 59 lokale Verweise einschließlich responsiver Bildkandidaten. Die Bildsignaturprüfung unterstützt nun auch WebP. JavaScript-Syntax und `git diff --check` bestehen.

`npm test` besteht mit **11 Tests**: acht bestehende Tests der Google-Schnittstelle sowie drei neue Tests für Build-Bereinigung, Ausschluss interner Dateien, statisches API-Verhalten und vollständige Bild-/Dateiverweise im Build. Die vorhandene HTTP-Prüfung besteht für 17 Seiten/Assets und prüft zusätzlich, dass interne Projektdateien nicht ausgeliefert werden.

Der erzeugte Produktionsbuild wurde mit Wrangler 4.151.2 lokal ausgeliefert und über Playwright in echtem Headless-Brave geprüft. Bei **320, 375, 768, 1024 und 1440 Pixeln** bestanden:

- Menüöffnung und Schließen mit Escape auf mobilen Breiten;
- Validierung leerer Pflichtfelder, Erstellung eines mailto-Entwurfs und Entfernen eines veralteten Entwurfs nach einer Änderung;
- Öffnen der Galerie, Laden des Originalbilds und Schließen mit Escape;
- Öffnen aller drei Bewertungsauszüge sowie Erreichbarkeit von Impressum und Datenschutz;
- Laden aller Seitenbilder nach vollständigem Scrollen, ohne horizontalen Seitenüberlauf;
- keine JavaScript-Ausnahmen, Konsolenfehler oder fehlgeschlagenen Ressourcen im statischen Build.

Die gesonderte Laufbandprüfung bestätigt Bewegung im sichtbaren Zustand, keine laufenden Animationsframes außerhalb des Bildschirms oder bei Pause, sowie Pause bei reduzierter Bewegung. Ein simulierter, ausdrücklich lokaler Google-Datensatz prüft außerdem, dass die optionale Live-Anzeige und der Link zur vollständigen Rezension weiterhin funktionieren. Es wurden keine echten Nachrichten versandt und keine Google-Zugangsdaten verwendet.

Die Datenmengen wurden mit frischen Browserkontexten bei Pixeldichte 1 gemessen. Der Ausgangsstand lief auf dem lokalen Node-Server, der Endstand auf lokalem Wrangler einschließlich dessen Textkompression; der Vergleich enthält daher auch diesen kleinen Unterschied bei CSS und JavaScript. Die vollständige Seitenansicht umfasst alle durch Scrollen nachgeladenen Bilder, jedoch keinen anschließenden Download eines Galerie-Originals. Angegeben sind die vom Browser erfassten kodierten Ressourcenbytes, ohne das HTML-Hauptdokument und ohne HTTP-Header. Der Ausgangsstand wurde vorher unverändert gesichert.

| Breite | Ressourcen nach vollständigem Scrollen vorher | Nachher | Einsparung |
|---|---:|---:|---:|
| 320 px | 3,535 MB | 0,467 MB | 87 % |
| 375 px | 3,535 MB | 0,467 MB | 87 % |
| 768 px | 3,535 MB | 0,407 MB | 88 % |
| 1024 px | 3,535 MB | 0,482 MB | 86 % |
| 1440 px | 3,535 MB | 0,785 MB | 78 % |

Bei 375 Pixeln sinkt der anfängliche Ressourcenabruf von rund 582 auf 201 KB. Beispiele der tatsächlich gewählten Bilddateien bei dieser Breite:

| Motiv | Original-JPEG | Geladene WebP-Variante |
|---|---:|---:|
| Titelbild | 518.634 Bytes | 169.344 Bytes, mobil 960 px |
| Ziegeldach | 465.267 Bytes | 43.536 Bytes, 640 px |
| Flachdach | 786.568 Bytes | 52.466 Bytes, 640 px |
| Dachfenster | 75.423 Bytes | 15.624 Bytes, 640 px |
| Team | 602.322 Bytes | 58.536 Bytes, 640 px |
| Steildach | 311.846 Bytes | 27.472 Bytes, 640 px |
| Schiefer | 711.578 Bytes | 68.308 Bytes, 640 px |

Die Paketgröße aller veröffentlichten Varianten beträgt insgesamt rund **6,39 MB in 43 Dateien**. Sie ist durch die unterschiedlichen Bildgrößen größer als der frühere Build. Ein einzelner Besucher lädt nur die für seinen Bildschirm gewählten Varianten. Das ist eine bewusste Abwägung zwischen Speicherbedarf und Übertragung; ein kleinerer Gesamtbuild wird nicht behauptet. Die JavaScript- und CSS-Dateien bleiben klein; ein zusätzliches Bundling oder Framework wäre hier nicht begründet.

**Lighthouse und Ladezeitgrenzen:** Lighthouse 13.5.0 wurde mehrfach lokal ausgeführt. Ein gesonderter Vergleich verwendete für Ausgangsstand und Endstand denselben lokalen Servercode mit Textkompression. Das Ergebnis der mobilen Simulation war Performance **90 → 82**, FCP **0,9 → 0,9 s**, LCP **1,3 → 3,3 s**, Total Blocking Time **0 → 0 ms** und CLS **0 → 0**. Der schlechtere simulierte LCP bleibt ein offener Befund und wird nicht als Verbesserung dargestellt. Die ursprüngliche Bildvorladung wurde von Lighthouse mit niedriger Priorität erfasst, die neue mit hoher Priorität; ein direkter Rückschluss aus diesen lokalen Modellwerten auf reale Besucher ist nicht gesichert.

Eine zusätzliche Browsermessung mit deaktiviertem Cache, 150 ms Latenz, 200.000 Bytes/s Download, vierfacher CPU-Drosselung und reduzierter Bewegung ergab beobachteten LCP **16,38 → 16,46 s**. Die lokale Antwortzeit des Hauptdokuments lag dabei in beiden Fällen bei rund **15,1 s**. Auch diese Messung belegt keinen Ladezeitgewinn und deutet auf eine starke lokale Messbegrenzung hin. Nachgewiesen sind die geringeren Datenmengen; eine bessere reale Ladezeit oder ein besserer öffentlicher PageSpeed-Wert wird ausdrücklich noch nicht behauptet.

Lokale Nachweise liegen unter `.qa/`: `before-complete.json`, `final.json`, die zugehörigen Screenshots, `image-sizes.json`, `lighthouse-comparable-before.html`, `lighthouse-comparable-final.html` sowie `network-before.json` und `network-final.json`. Dieser Ordner mit den lokalen Prüfwerkzeugen ist absichtlich von Git ausgeschlossen. Die dauerhaften Build-Regressionstests liegen in `scripts/build.test.mjs`.

**4. Noch offene Punkte**

Die öffentliche Website-URL und Cloudflare-Kontodaten lagen für diese Prüfung nicht vor. Öffentliche Latenz, HTTPS-Header, Cloudflare-Cachetreffer, Feldwerte der Core Web Vitals und die endgültige Bereitstellung wurden daher nicht getestet. Der simulierte LCP muss dort überprüft und bei bestätigter Verschlechterung weiter untersucht werden. Echte iOS-/Android-Geräte, Safari, Firefox, Zoom und manuelles Touch-Ziehen sind noch offen; die Browserprüfungen verwenden Breiten, keinen vollständigen Geräteersatz.

Eine echte Google-Synchronisierung ist ohne autorisierten Eigentümerzugang nicht testbar und auf dem statischen Hosting nicht vorhanden. Die bestehende serverseitige Implementierung verwendet gemeinsamen Cache, gebündelte parallele Abrufe, Zeitlimits und eine Pause nach Fehlern. Diese Eigenschaften werden durch die vorhandenen Tests geprüft, ersetzen aber keinen realen API- oder Lasttest.

Es gab keine Reservierungen oder Datenbankoperationen zu prüfen. Das Kontaktformular bleibt ein Entwurfsformular; serverseitige Speicherung, Versandvalidierung, RLS und Reservierungsstatus sind hier nicht anwendbar.

**5. Hosting und Veröffentlichung**

Cloudflare Workers bleibt der konfigurierte Anbieter. `assets.directory` bleibt `./dist`. Es wurden keine neuen Cache-Regeln, langfristigen Browser-TTLs oder Änderungen an der HTML-Zwischenspeicherung eingeführt. Cloudflare Static Assets verwendet eigene Caching- und Validierungsmechanismen; die offizielle Dokumentation beschreibt unter anderem ETag-basierte Aktualitätsprüfungen: https://developers.cloudflare.com/workers/static-assets/headers/ . Statische Auslieferung: https://developers.cloudflare.com/workers/static-assets/ .

Der saubere Build und die Tests verhindern zurückgebliebene Ausgabedateien und fehlende aktuelle Ressourcen. Ein langfristiges `immutable`-Caching wäre bei den bisherigen Dateinamen ohne Inhalts-Hash unpassend. Die vorhandenen Cache-Standards bleiben deshalb bestehen. Die tatsächlichen Antwortheader müssen an der öffentlichen URL kontrolliert werden.

Vor einer Veröffentlichung den geprüften Stand einschließlich Bildvarianten und Lockdatei versionieren. Cloudflare behält `npm run build` und `npx wrangler deploy`. Danach die veröffentlichte Website auf Smartphone und Desktop prüfen, die Cache-/Header-Antworten ansehen und mindestens drei Lighthouse-/PageSpeed-Läufe je Geräteklasse vergleichen. Erst dann lässt sich beurteilen, ob der lokale LCP-Befund auch öffentlich auftritt. Demokennzeichnung, noindex und bestehende inhaltliche Freigabepunkte wurden beibehalten.

**6. Empfehlung für einen kontrollierten Lasttest**

Es wurde kein Lasttest ausgeführt und keine Anzahl gleichzeitig tragbarer Besucher ermittelt. Für einen ersten autorisierten Test eine eigene Vorschau-Umgebung verwenden: zunächst 1, dann 5 und 10 virtuelle Besucher für jeweils eine Minute, mit einer Sekunde Pause zwischen Seitenaufrufen. Nur lesende Seitenaufrufe verwenden; keine Formulare absenden und keine Google-Anfragen vervielfachen. Bei 5xx-Fehlern, 429-Antworten oder anhaltend stark steigender Antwortzeit abbrechen. Antwortzeiten, Fehleranteil, Cachetreffer und übertragene Bytes aufzeichnen. Kalten und warmen Cache getrennt betrachten. Erst bei stabilen Ergebnissen schrittweise erhöhen; die Grenze ist aus diesem Audit nicht ableitbar.

**7. Nächste Schritte für dich**

1. Lokal `npm ci`, `npm run check`, `npm test` und `npm run build` ausführen. Bei neuen Fotos vorher `npm run images:optimize` verwenden.
2. Mit `npm start` die Node-Vorschau öffnen; sie enthält die optionale, derzeit nicht konfigurierte Bewertungsroute. Für die tatsächliche statische Cloudflare-Vorschau `npx wrangler dev --local --port 4175` verwenden und http://localhost:4175 öffnen.
3. Die Änderungen und die gespeicherten Screenshots ansehen. Bei der Bildqualität besonders die Dachdetails auf einem hochauflösenden Bildschirm beurteilen.
4. Den freigegebenen Stand zu GitHub pushen und den Cloudflare-Build prüfen. Diese Optimierungsrunde hat noch keinen Push ausgelöst.
5. Die öffentliche URL für den abschließenden Live-Test bereitstellen. In Chrome oder Edge lässt sich anschließend über F12 → Lighthouse ein mobiler Test starten. Die ersten öffentlichen Messungen dienen besonders der Klärung des LCP-Befunds.
