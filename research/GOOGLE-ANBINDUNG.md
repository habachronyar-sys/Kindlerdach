# Google-Rezensionen: vorbereitete Verbindung

## Tatsächlicher Stand

Der Benutzer hat am 19.10.2026 bestätigt, keinen Inhaber-/Administratorzugriff auf das Google-Unternehmensprofil zu besitzen. Es gibt keine freigegebenen API-Zugangsdaten im Projekt. **Die Live-Verbindung und das Abrufen aller echten Google-Rezensionen sind daher nicht aktiv.** Die drei bisherigen, klar als Verzeichnisauszüge gekennzeichneten Zitate bleiben als Fallback sichtbar. Sie werden nicht als direkt von Google abgerufen bezeichnet.

Plugin-Suche fand Windsor.ai mit Google-Business-Profile-Unterstützung als optionale Verbindung. Nicht verbunden; keine Daten darüber abgerufen. Eine Chat-Verbindung wäre zudem kein automatisch konfigurierter produktiver Website-Server.

## Warum nicht nur ein öffentlicher Google-Schlüssel?

- Google Places (New) liefert maximal fünf Rezensionen, nach Relevanz sortiert. Damit lässt sich keine vollständige Liste realisieren: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- Die Google Business Profile API stellt Rezensionen eines verifizierten Standorts seitenweise bereit, maximal 50 je Seite, einschließlich Folgeseiten-Token, Durchschnitt und Gesamtzahl: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
- Dafür sind ein zugelassenes Google-Cloud-Projekt und eine vom Profilinhaber/-manager autorisierte OAuth-Verbindung erforderlich: https://developers.google.com/my-business/content/implement-oauth

## Bereits implementiert

`server/google-reviews.mjs` verwendet ausschließlich offizielle Google-Endpunkte. Es liest alle Folgeseiten und alle Sternebewertungen; auch Rezensionen ohne Text bleiben enthalten. Nach vollständig erfolgreichem Abruf wird die vorherige Liste ersetzt, sodass Änderungen und Löschungen übernommen werden. Gleichzeitige Besucheranfragen teilen einen Abruf. Google-Zugriffsdaten bleiben auf dem Server und werden nicht an Besucher ausgegeben.

`GET /api/reviews` liefert ohne konfigurierte Verbindung HTTP 503 mit `GOOGLE_NOT_CONFIGURED`, ohne Google überhaupt anzufragen. Die Website zeigt den fehlenden Verbindungsstatus offen an und beendet unnötige Wiederholungsabfragen.

Nach Konfiguration: Die Website fragt den eigenen Server bei sichtbarer Seite alle 30 Sekunden ab. Der Server hält Ergebnisse 30 Sekunden im Arbeitsspeicher. Neue Rezensionen können deshalb ungefähr innerhalb von 30–60 Sekunden nach Verfügbarkeit in der Google-API erscheinen; es ist keine garantierte Echtzeitübertragung ab Veröffentlichung bei Google. Google kann zusätzliche Verzögerungen haben. Bei einem vorübergehenden Fehler wird ein maximal fünf Minuten alter Serverstand als veraltet gekennzeichnet. Niemals wird ein fehlgeschlagener Teilabruf als vollständige Liste ausgegeben.

Die Gesamtansicht zeigt alle von der API zurückgegebenen Rezensionen im vollständigen Wortlaut, einschließlich niedriger Sternebewertungen. Die Google-Gesamtzahl kann wegen nicht abrufbarer/moderierter Inhalte abweichen; deshalb lautet die Beschriftung „alle abrufbaren Bewertungen“. Das Laufband zeigt Vorschauen; längere Rezensionen haben einen Button zur vollständigen Gesamtansicht. Es gibt keine Filterung auf positive Bewertungen und keine künstlichen Kunden.

## Aktivierung durch den Betrieb

1. Der Profilinhaber richtet ein zugelassenes Google-Cloud-Projekt für die Business Profile APIs ein und autorisiert den Zugriff auf den verifizierten Standort. OAuth-Scope: `https://www.googleapis.com/auth/business.manage`. Dieser Scope ist weitreichender als die Anwendung benötigt; die Implementierung selbst führt ausschließlich lesende Bewertungsabfragen aus. Es werden keine Antworten gepostet und keine Profildaten geändert.
2. `.env.example` als Vorlage für eine lokal geschützte `.env.local` verwenden. Benötigt werden Client-ID, Client-Secret, Refresh-Token und der genaue Standort-Ressourcenname `accounts/…/locations/…` des Kindler-Profils. Das ist nicht die öffentliche Maps-CID. Geheimnisse niemals ins Chatfenster oder öffentliche Dateien eintragen.
3. `node scripts/serve.mjs` neu starten. Für Hosting denselben Node-Server oder eine entsprechende serverseitige Route und sichere Secret-Verwaltung bereitstellen. Die Umgebungswerte sind von Git ausgeschlossen und werden nicht in `dist/` kopiert.
4. Mit echten Zugangsdaten prüfen: korrekte Profilzuordnung, Gesamtzahl, vollständige Pagination, Urheber-/Nutzungsrechte, Google-Bedingungen und tatsächliche Aktualisierungsrate. Datenschutzinformationen und Hosting entsprechend vervollständigen.

Ein reiner Upload des statischen `dist/` stellt die serverseitige Schnittstelle nicht bereit und kann keine automatische Google-Synchronisierung ausführen. Die statische Website zeigt weiterhin die dokumentierten Auszüge, bis eine passende Serverroute eingerichtet ist.

## Verifikation

`node --test server/google-reviews.test.mjs` prüft ohne echte Google-Zugangsdaten: fehlende Konfiguration ohne Netzwerkzugriff, Pagination über 50 Rezensionen, unterschiedliche Sterne, Duplikate, Änderungen/Löschungen beim nächsten Abgleich, parallele Anfragen, abgebrochene Folgeseiten, Fehler-/Veraltet-Zustände, wiederholte Seiten-Token und anonyme Autoren. Dies sind simulierte Schnittstellentests, kein erfolgreicher Live-Abruf des Unternehmensprofils.

Kein Browserwerkzeug verfügbar. Die neue Gestaltung, Gesamtansicht und der erneuerte Laufbandinhalt müssen noch visuell und interaktiv im Browser geprüft werden.
