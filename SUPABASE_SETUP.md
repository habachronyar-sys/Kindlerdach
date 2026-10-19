# Supabase-Einrichtung für Kindler Dach

**Aktuelle Schritt-für-Schritt-Bedienung und Prüfergebnisse:** [ANLEITUNG.md](./ANLEITUNG.md) und [PRUEFBERICHT.md](./PRUEFBERICHT.md). Die hier gestartete aktuelle Vorschau verwendet Port **4174**, weil auf 4173 ein alter Server läuft. Der Standard im Code bleibt 4173; setzen Sie für die aktuelle Vorschau `$env:PORT='4174'` vor dem Start.

## Architekturüberblick

Die bestehende Website ist eine statische HTML-, CSS- und JavaScript-Seite ohne Frontend-Framework. Sie wird mit Node-Skripten gebaut und ist für Cloudflare Workers Static Assets vorbereitet. Ein Terminformular, ein Supabase-Backend und ein Login waren vorher nicht vorhanden.

Die Kontaktseite sendet Anfragen jetzt an einen Cloudflare-Worker-Endpunkt. Der Worker prüft Eingaben, Herkunft, Honeypot und Rate Limit und übermittelt ausschließlich die erlaubten Kontaktfelder an eine token-geschützte Supabase-Funktion. Besucher erhalten keine Lese- oder Änderungsrechte. Das Admin-Frontend verwendet `@supabase/supabase-js`; Datenbank-RLS und eine ausdrücklich gepflegte Inhaber-Allowlist schützen die Anfragen zusätzlich zur Login-Prüfung. Es wurde bewusst keine Terminbuchung ergänzt.

## 1. Benötigte Werte

Sie benötigen Zugriff auf das Supabase-Projekt `lykeruumioxbmcvryrnq` und auf das Cloudflare-Konto, in dem die Website veröffentlicht werden soll.

1. Öffnen Sie das Supabase-Projekt.
2. Gehen Sie zu **Project Settings → API Keys** und kopieren Sie den **Publishable key**, der mit `sb_publishable_` beginnt. Der Schlüssel ist öffentlich verwendbar und darf im Browser sichtbar sein.
3. Erzeugen Sie lokal ein zufälliges Intake-Token mit mindestens 32 Zufallsbytes. Im Projektordner in PowerShell:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Bewahren Sie den ausgegebenen Wert privat auf. Fügen Sie ihn weder in den Quellcode noch in GitHub oder einen Chat ein. Er wird nur als Cloudflare-Secret und einmal zum Erzeugen seines Datenbank-Hashes verwendet.

## 2. Datenbank und Sicherheitsregeln einrichten

1. Öffnen Sie im Supabase-Projekt **Table Editor** und prüfen Sie, ob `contact_requests` oder `authorized_admins` schon existieren. Öffnen Sie bei vorhandenen Tabellen außerdem **Policies** und prüfen Sie deren Berechtigungen. Der tatsächliche Datenbankzustand war in dieser Entwicklungsumgebung nicht zugänglich. Wenn eine Tabelle oder Richtlinie bereits existiert, führen Sie die Migration nicht blind aus: sichern Sie vorhandene Daten und lassen Sie das vorhandene Schema und sämtliche Richtlinien zuerst gezielt abgleichen.
2. Wenn diese Tabellen noch nicht existieren, öffnen Sie links den **SQL Editor** und wählen **New query**.
3. Öffnen Sie im Projekt die Datei [`supabase/migrations/20261019000000_kindler_contact_requests.sql`](./supabase/migrations/20261019000000_kindler_contact_requests.sql), kopieren Sie den vollständigen Inhalt in den Editor und wählen Sie **Run**. Führen Sie anschließend auch `supabase/migrations/20261019010000_single_administrator.sql` aus. Diese zweite Migration begrenzt eine bereits bestehende Admin-Tabelle auf höchstens einen Eintrag. Bei mehreren vorhandenen Administratoren bricht sie ab und löscht niemanden.
4. Öffnen Sie eine neue SQL-Abfrage. Ersetzen Sie `PASTE_YOUR_64_CHARACTER_TOKEN_HERE` durch Ihr lokal erzeugtes Token und führen Sie die Abfrage aus:

   ```sql
   insert into private.contact_intake_tokens (singleton, token_hash)
   values (
     true,
     extensions.digest(
       convert_to('PASTE_YOUR_64_CHARACTER_TOKEN_HERE', 'UTF8'),
       'sha256'
     )
   )
   on conflict (singleton)
   do update set token_hash = excluded.token_hash;
   ```

   Die Datenbank speichert nur den SHA-256-Hash. Bewahren Sie die Abfrage nicht in einem öffentlichen Repository auf. Wenn Sie das Token austauschen, aktualisieren Sie sowohl diesen Hash als auch das Cloudflare-Secret.
5. Die Migration erzeugt `contact_requests`, `authorized_admins`, Indizes, Status-Constraints, RLS-Richtlinien und die RPC-Funktion. Direkte anonyme Tabellen-Schreibrechte werden nicht erteilt. Die private Token-Tabelle ist nicht für die Data API freigegeben.
6. **Keine** `sb_secret_`- oder `service_role`-Schlüssel für diese Integration anlegen oder verwenden.

## 3. Inhaber-Konto anlegen und freischalten

Es gibt keine Registrierungsseite auf der Website.

1. Öffnen Sie im Supabase-Dashboard **Authentication → Users** und wählen Sie **Add user**. Legen Sie den Inhaber mit einer kontrollierten E-Mail-Adresse an und vergeben Sie ein starkes, individuelles Passwort.
2. Kopieren Sie die UUID des neu angelegten Benutzers aus der Benutzerliste.
3. Öffnen Sie im **SQL Editor** eine neue Abfrage. Ersetzen Sie die Beispiel-UUID durch die kopierte UUID und führen Sie die Abfrage aus:

   ```sql
   insert into public.authorized_admins (user_id)
   values ('00000000-0000-0000-0000-000000000000');
   ```

4. Um den Zugriff später zu entziehen, löschen Sie genau diese UUID aus `public.authorized_admins`. Ohne diesen Eintrag berechtigt auch ein gültiger Supabase-Login nicht zum Lesen oder Verwalten der Anfragen.
5. Öffnen Sie **Authentication → Sign In / Providers** und deaktivieren Sie **Allow new users to sign up** sowie anonyme Anmeldungen. Lassen Sie die E-Mail-/Passwort-Anmeldung aktiviert. Legen Sie Konten nur im Supabase-Dashboard an. Ohne diese Einstellung verhindert eine fehlende Registrierungsseite allein keine direkte Registrierung über die Auth-API. Siehe [Supabase-Dokumentation](https://supabase.com/docs/guides/auth/general-configuration).
6. Unter **Authentication → URL Configuration** tragen Sie für lokale Tests `http://localhost:4173` und später die tatsächliche HTTPS-Domain als Site URL beziehungsweise erlaubte Redirect URL ein.

## 4. Lokale Umgebungsvariablen

1. Führen Sie `npm.cmd run setup:local` aus. Dies legt eine fehlende `.env.local` mit der Projekt-URL und einem zufälligen Intake-Token an. Eine vorhandene Datei wird nicht überschrieben. Im aktuellen Arbeitsordner wurde dies bereits durchgeführt.
2. Füllen Sie dort `SUPABASE_PUBLISHABLE_KEY` mit dem echten Schlüssel aus. Der Setup-Befehl gibt eine SQL-Abfrage mit dem Hash des vorhandenen Tokens aus; führen Sie sie nach den Migrationen im Supabase SQL Editor aus. Das ersetzt das manuelle Hashen aus Abschnitt 2. Prüfen Sie danach mit `npm.cmd run diagnose`. Nach Änderungen an `.env.local` den Vorschau-Server mit Strg+C beenden und neu starten.
3. `.env.local` wird durch `.gitignore` ausgeschlossen. Prüfen Sie vor jedem Commit, dass diese Datei nicht in Git aufgenommen wurde.
4. Installieren Sie die Paketversionen aus dem Lockfile und starten Sie die lokale Vorschau:

   ```powershell
   npm.cmd ci
   $env:PORT='4174'
   npm.cmd run dev
   ```

   Öffnen Sie `http://localhost:4174` und `http://localhost:4174/admin/login`. Die lokale Vorschau stellt ebenfalls Formularvalidierung und eine lokale Ratebegrenzung bereit. Sie ersetzt nicht das Cloudflare-Rate-Limit der Veröffentlichung. Ohne die PORT-Zeile verwendet ein neuer Server standardmäßig Port 4173; dort wurde im aktuellen Prüflauf ein veralteter Server mit HTTP 404 für die API und Admin-Routen gefunden.

## 5. Cloudflare-Hosting konfigurieren

1. Prüfen Sie `wrangler.jsonc`. Der Worker verarbeitet `/api/*`, setzt Sicherheitsheader, liefert die statischen Dateien aus und begrenzt Kontaktanfragen auf fünf pro IP innerhalb von 60 Sekunden. Die Rate-Limit-Bindung verwendet aktuell die ID `1001`; falls diese ID in Ihrem Cloudflare-Konto bereits anderweitig vergeben ist, wählen Sie eine andere eindeutige numerische `namespace_id`.
2. Installieren Sie Abhängigkeiten mit `npm.cmd ci` und bauen Sie die Website mit `npm.cmd run build`.
3. Melden Sie Wrangler bei Ihrem Cloudflare-Konto an:

   ```powershell
   npx wrangler login
   ```

4. Legen Sie die drei Worker-Secrets interaktiv an. Bei jeder Abfrage fügen Sie den Wert ein, ohne ihn in die Kommandozeile oder in eine Datei zu schreiben:

   ```powershell
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
   npx wrangler secret put SUPABASE_INTAKE_TOKEN
   ```

   Setzen Sie die URL auf `https://lykeruumioxbmcvryrnq.supabase.co`. Der Publishable Key ist zwar kein Geheimnis, wird hier aber als Laufzeitkonfiguration verwaltet. Das Intake-Token ist geheim. Es gibt weder einen Service-Role-Key noch einen Supabase-Secret-Key im Frontend.
5. Veröffentlichen Sie mit:

   ```powershell
   npx wrangler deploy
   ```

   Die Website bleibt im Demo-Stand mit `noindex, nofollow`; prüfen und ändern Sie das erst nach Freigabe der Inhalte und Rechtstexte.

## 6. Anfragen testen

1. Rufen Sie die Startseite über die lokale Vorschau oder die Cloudflare-Domain auf.
2. Füllen Sie im Kontaktformular Name, Nachricht und mindestens eine Kontaktmöglichkeit aus. Senden Sie die Anfrage ab.
3. Nur bei erfolgreicher Datenbankspeicherung erscheint die Bestätigung. Bei einem Fehler bleiben die Formulareingaben im geöffneten Formular erhalten.
4. Öffnen Sie `/admin/login`, melden Sie sich mit dem angelegten Inhaber-Konto an und prüfen Sie, ob die Anfrage in `/admin` erscheint.
5. Ändern Sie den Status, laden Sie die Seite neu und prüfen Sie, dass der gespeicherte Status erhalten bleibt. Statusänderungen lösen keine Kundenbenachrichtigung aus.
6. Prüfen Sie im Supabase **Table Editor → contact_requests**, dass der Eintrag gespeichert wurde. Anonyme Zugriffe auf die Tabelle sollten keine Datensätze lesen oder verändern können; der einzige öffentliche Schreibweg ist die RPC-Funktion mit dem zufälligen Intake-Token, das nur dem Worker bekannt ist.
7. Testen Sie zusätzlich eine ungültige E-Mail-Adresse, eine ungültige Telefonnummer, fehlende Kontaktdaten, eine zu kurze Nachricht und mehr als fünf schnelle Anfragen. Ein erfolgreicher Status wird in keinem dieser Fehlerfälle vorgetäuscht.

## 7. Funktionsumfang und offene Schritte

- Vorhanden ist aktuell nur ein Kontaktformular. Es gibt deshalb keine Tabelle für Terminanfragen, keinen Terminstatus und keine behauptete Buchungsbestätigung.
- Dashboard-Daten werden nach dem Login aus Supabase geladen und danach alle 60 Sekunden sowie auf Knopfdruck aktualisiert. Eine Realtime-Veröffentlichung wurde nicht eingerichtet.
- Das Formular versendet keine E-Mail. Der Inhaber sieht Anfragen im Dashboard und kann Kunden über die gespeicherten Kontaktdaten selbst erreichen.
- Die Migration muss im Supabase SQL Editor ausgeführt und das Intake-Token dort hinterlegt werden, bevor Einreichungen gespeichert werden können.
- Im vorliegenden Auftragstext war kein tatsächlicher `sb_publishable_`-Key enthalten. Solange Sie ihn nicht in Supabase/Cloudflare beziehungsweise lokal einsetzen, ist keine echte Anmeldung oder Speicherung möglich.
- Vor einer Veröffentlichung müssen Sie die Datenschutzhinweise einschließlich tatsächlicher Hosting-/Supabase-Anbieter, Auftragsverarbeitung, Rechtsgrundlage und Löschfristen vervollständigen. Legen Sie für Kontaktanfragen eine Aufbewahrungs- und Löschregel fest und prüfen Sie sie regelmäßig.
- Testen Sie den tatsächlichen Deploy, die Cloudflare-Rate-Limit-Bindung, Anmeldung, RLS, Speichern, Löschen und Statuswechsel mit dem konfigurierten Supabase-Projekt. Diese Cloud-Prüfungen sind ohne Projektzugang und Schlüssel nicht von dieser lokalen Codeänderung aus nachweisbar.## 1. Aktuelle pers?nliche Einrichtung

Folgen Sie [SUPABASE_VERBINDEN.md](./SUPABASE_VERBINDEN.md). Die dortigen Schritte ersetzen die fr?here manuelle Token-Erzeugung und Hash-Abfrage. F?hren Sie npm.cmd run setup:local aus; vorhandene lokale Werte bleiben unver?ndert.

## 2. SQL-Dateien und Abh?ngigkeiten

- supabase/check.sql: ausschlie?lich lesende Bestandsaufnahme ohne Kundeninhalte oder Token-Hash.
- supabase/SETUP.local.sql: automatisch erzeugte vollst?ndige Ersteinrichtung aus beiden Migrationen plus Token-Hash; eine gemeinsame Transaktion. Sie bricht bei bestehenden Projektobjekten oder einem vorhandenen private-Schema vor ?nderungen ab. Keine Daten werden entfernt.
- supabase/TOKEN.local.sql: fehlenden Hash hinzuf?gen oder denselben Hash best?tigen; bei einem anderen vorhandenen Hash Abbruch ohne Austausch.
- supabase/authorize-admin.sql: manuelle Freischaltung einer vorhandenen Auth-UID; kein Benutzer wird angelegt und kein bisheriger Admin ersetzt.
- Migration 20261019000000_kindler_contact_requests.sql ben?tigt Supabase-Rollen anon/authenticated, auth.users, auth.uid() und pgcrypto im Schema extensions. Sie ist jetzt vollst?ndig transaktional. Migration 20261019010000_single_administrator.sql setzt die Admin-Tabelle voraus und erg?nzt denselben eindeutigen Index f?r ?ltere Installationen.

Die Basis-Migration wurde zus?tzlich bei NULL-Betreff, Mindestanzahl der Telefonziffern und expliziten Funktionsrechten korrigiert. Ein nicht leerer Suchpfad wird in SECURITY-DEFINER-Funktionen nicht verwendet. Bestehende fremde RLS-Policies d?rfen nicht ungepr?ft neben den vorgesehenen Policies bestehen: Freigaben k?nnen sich addieren. Deshalb bestehende Installationen zun?chst anhand der Metadaten abgleichen, statt die Basis-Migration blind erneut auszuf?hren.

## 3. Sicherheit und Auth

Nur die UUID in authorized_admins darf Anfragen lesen, den Status/Gelesen-Zeitpunkt ?ndern und Anfragen l?schen. Die Datenbank erlaubt h?chstens eine solche UUID. Browser haben keine Schreibrechte auf diese Allowlist. ?ffentliches Einf?gen in contact_requests ist verboten; nur die token-gesch?tzte RPC dient dem serverseitigen Intake.

Keine ?ffentliche Registrierung ist im Frontend implementiert. Zus?tzlich muss der Inhaber in Supabase Allow new users to sign up und anonyme Anmeldungen deaktivieren. Das ist ohne Projektzugang nicht gepr?ft oder ge?ndert. Ein Konto wird ausschlie?lich mit Zustimmung des Inhabers im Supabase-Dashboard angelegt.

## 4. Lokale Konfiguration und Diagnose

.env.local ben?tigt SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY und SUPABASE_INTAKE_TOKEN. URL, Publishable-Key und Token sind vorhanden. Supabase hat den Key mit HTTP 200 akzeptiert. Die ben?tigten Tabellen wurden ?ber die Data API noch nicht gefunden (PGRST205); ?ffentliche Registrierung ist noch aktiviert. Kein Secret- oder Service-Role-Key wird verwendet. Die Datei und erzeugte *.local.sql-Dateien sind von Git ausgeschlossen und werden nicht ver?ffentlicht.

Der Intake-Hash ist SHA-256 ?ber den UTF-8-Text des Tokens; das entspricht extensions.digest(convert_to(token, 'UTF8'), 'sha256') in PostgreSQL. Nicht die hexadezimal decodierten Zufallsbytes hashen.

npm.cmd run diagnose pr?ft mit g?ltigem Key Auth-Einstellungen, anonymen Tabellenzugriff und die Ablehnung der RPC ohne Token. Ein zur?ckgewiesener Key z?hlt niemals als bestandene Tabellen-/RLS-Pr?fung. Die Diagnose speichert keine Nachricht und beweist keine vollst?ndige Admin-RLS.

## 5. Cloudflare-Hosting konfigurieren

1. Prüfen Sie `wrangler.jsonc`. Der Worker verarbeitet `/api/*`, setzt Sicherheitsheader, liefert die statischen Dateien aus und begrenzt Kontaktanfragen auf fünf pro IP innerhalb von 60 Sekunden. Die Rate-Limit-Bindung verwendet aktuell die ID `1001`; falls diese ID in Ihrem Cloudflare-Konto bereits anderweitig vergeben ist, wählen Sie eine andere eindeutige numerische `namespace_id`.
2. Installieren Sie Abhängigkeiten mit `npm.cmd ci` und bauen Sie die Website mit `npm.cmd run build`.
3. Melden Sie Wrangler bei Ihrem Cloudflare-Konto an:

   ```powershell
   npx wrangler login
   ```

4. Legen Sie die drei Worker-Secrets interaktiv an. Bei jeder Abfrage fügen Sie den Wert ein, ohne ihn in die Kommandozeile oder in eine Datei zu schreiben:

   ```powershell
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
   npx wrangler secret put SUPABASE_INTAKE_TOKEN
   ```

   Setzen Sie die URL auf `https://lykeruumioxbmcvryrnq.supabase.co`. Der Publishable Key ist zwar kein Geheimnis, wird hier aber als Laufzeitkonfiguration verwaltet. Das Intake-Token ist geheim. Es gibt weder einen Service-Role-Key noch einen Supabase-Secret-Key im Frontend.
5. Veröffentlichen Sie mit:

   ```powershell
   npx wrangler deploy
   ```

   Die Website bleibt im Demo-Stand mit `noindex, nofollow`; prüfen und ändern Sie das erst nach Freigabe der Inhalte und Rechtstexte.

## 6. Anfragen testen

1. Rufen Sie die Startseite über die lokale Vorschau oder die Cloudflare-Domain auf.
2. Füllen Sie im Kontaktformular Name, Nachricht und mindestens eine Kontaktmöglichkeit aus. Senden Sie die Anfrage ab.
3. Nur bei erfolgreicher Datenbankspeicherung erscheint die Bestätigung. Bei einem Fehler bleiben die Formulareingaben im geöffneten Formular erhalten.
4. Öffnen Sie `/admin/login`, melden Sie sich mit dem angelegten Inhaber-Konto an und prüfen Sie, ob die Anfrage in `/admin` erscheint.
5. Ändern Sie den Status, laden Sie die Seite neu und prüfen Sie, dass der gespeicherte Status erhalten bleibt. Statusänderungen lösen keine Kundenbenachrichtigung aus.
6. Prüfen Sie im Supabase **Table Editor → contact_requests**, dass der Eintrag gespeichert wurde. Anonyme Zugriffe auf die Tabelle sollten keine Datensätze lesen oder verändern können; der einzige öffentliche Schreibweg ist die RPC-Funktion mit dem zufälligen Intake-Token, das nur dem Worker bekannt ist.
7. Testen Sie zusätzlich eine ungültige E-Mail-Adresse, eine ungültige Telefonnummer, fehlende Kontaktdaten, eine zu kurze Nachricht und mehr als fünf schnelle Anfragen. Ein erfolgreicher Status wird in keinem dieser Fehlerfälle vorgetäuscht.

## 7. Funktionsumfang und offene Schritte

- Vorhanden ist aktuell nur ein Kontaktformular. Es gibt deshalb keine Tabelle für Terminanfragen, keinen Terminstatus und keine behauptete Buchungsbestätigung.
- Dashboard-Daten werden nach dem Login aus Supabase geladen und danach alle 60 Sekunden sowie auf Knopfdruck aktualisiert. Eine Realtime-Veröffentlichung wurde nicht eingerichtet.
- Das Formular versendet keine E-Mail. Der Inhaber sieht Anfragen im Dashboard und kann Kunden über die gespeicherten Kontaktdaten selbst erreichen.
- Die Migration muss im Supabase SQL Editor ausgeführt und das Intake-Token dort hinterlegt werden, bevor Einreichungen gespeichert werden können.
- Im vorliegenden Auftragstext war kein tatsächlicher `sb_publishable_`-Key enthalten. Solange Sie ihn nicht in Supabase/Cloudflare beziehungsweise lokal einsetzen, ist keine echte Anmeldung oder Speicherung möglich.
- Vor einer Veröffentlichung müssen Sie die Datenschutzhinweise einschließlich tatsächlicher Hosting-/Supabase-Anbieter, Auftragsverarbeitung, Rechtsgrundlage und Löschfristen vervollständigen. Legen Sie für Kontaktanfragen eine Aufbewahrungs- und Löschregel fest und prüfen Sie sie regelmäßig.
- Testen Sie den tatsächlichen Deploy, die Cloudflare-Rate-Limit-Bindung, Anmeldung, RLS, Speichern, Löschen und Statuswechsel mit dem konfigurierten Supabase-Projekt. Diese Cloud-Prüfungen sind ohne Projektzugang und Schlüssel nicht von dieser lokalen Codeänderung aus nachweisbar.
