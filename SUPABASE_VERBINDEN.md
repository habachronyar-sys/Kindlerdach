# Supabase verbinden – nur die verbleibenden persönlichen Schritte

**Passwort vergessen ist jetzt implementiert:** Die einmaligen Einstellungen für E-Mail-Versand und Rücksprungadresse stehen in [PASSWORT_ZURUECKSETZEN.md](./PASSWORT_ZURUECKSETZEN.md). Spätere Passwortänderungen kann der Inhaber über die Website selbst erledigen.

## Ergebnis der lokalen Prüfung

- Projekt-URL ist korrekt vorhanden.
- Das bestehende Intake-Token ist gültig und wurde nicht verändert.
- **Der bereitgestellte Publishable-Key ist eingetragen und wurde von Supabase mit HTTP 200 akzeptiert.**
- Der Code für Kontaktformular, Backend und Admin-Dashboard ist vorhanden.
- Ich habe keine Cloud-Daten, Konten oder produktiven Einstellungen geändert und nichts veröffentlicht.
- Ob Tabellen, RLS und der Administrator in Ihrem Cloud-Projekt schon eingerichtet sind, ist ohne Projektzugang nicht feststellbar.

## 1. Publishable-Key ? bereits erledigt; folgende Klicks nur bei sp?terem Austausch

1. Öffnen Sie [Ihr Supabase-Projekt](https://supabase.com/dashboard/project/lykeruumioxbmcvryrnq) und melden Sie sich selbst an.
2. Klicken Sie links auf das Zahnrad **Project Settings**, dann auf **API Keys**.
3. Kopieren Sie unter **Publishable key** den vorhandenen Wert mit dem Anfang `sb_publishable_`. Verwenden Sie keinen `sb_secret_`- oder `service_role`-Key.
4. Wechseln Sie zu VS Code. Öffnen Sie im Explorer im Projektordner die Datei `.env.local`.
5. Suchen Sie die Zeile `SUPABASE_PUBLISHABLE_KEY=` und fügen Sie den kopierten Wert direkt hinter dem Gleichheitszeichen ein. Speichern Sie mit **Strg+S**.
6. Lassen Sie `SUPABASE_URL` und `SUPABASE_INTAKE_TOKEN` unverändert. Senden Sie mir weder den Dateiinhalt noch das Intake-Token.

Öffnen Sie **Terminal → Neues Terminal → PowerShell**. Führen Sie aus:

```powershell
Set-Location -LiteralPath 'C:\Users\Startklar\Kindlerdach'
npm.cmd run setup:local
npm.cmd run diagnose
```

Der Setup-Befehl wurde hier bereits ausgeführt. Er kann wiederholt werden: Die vorhandene `.env.local` und das Token bleiben unverändert. Er erzeugt SQL-Dateien mit dem Hash, ohne Schlüssel oder Token auszugeben. Die Diagnose kann vor der Datenbankeinrichtung noch offene Punkte melden.

## 2. Bestehende Tabellen sicher feststellen

1. Klicken Sie in Supabase links auf **SQL Editor**.
2. Klicken Sie **New query** beziehungsweise auf **+**.
3. Öffnen Sie in VS Code `supabase/check.sql`.
4. Kopieren Sie den gesamten Inhalt mit **Strg+A → Strg+C** und fügen Sie ihn in die neue SQL-Abfrage ein.
5. Klicken Sie **Run**. Diese Datei liest ausschließlich Metadaten; sie verändert nichts und gibt keine Kundennachrichten, E-Mail-Adressen oder Token-Hashes aus.
6. Die erste Ergebnistabelle zeigt für `contact_requests`, `authorized_admins` und `contact_intake_tokens`, ob sie vorhanden sind. Weitere Ergebnisse zeigen Spalten, RLS, Policies, Tabellen-/Spaltenrechte, Funktionen und Indizes.

**Wenn schon eine dieser Tabellen existiert:** Führen Sie die vollständige Ersteinrichtung nicht darüber aus. Die Metadaten müssen zunächst mit dem vorgesehenen Schema abgeglichen werden. Sie können mir die Resultate von `check.sql` zur Prüfung geben. Eine vorhandene, funktionierende Datenbank wird nicht automatisch ersetzt. Die Fehlermeldung „Existing objects detected“ der Ersteinrichtung ist ebenfalls ein Schutzabbruch, keine Aufforderung zum Löschen.

## 3. Nur bei einer neuen, noch nicht eingerichteten Datenbank

Dieser Schritt verändert das Datenbankschema. Prüfen Sie die vorbereitete Datei vor dem Ausführen; ich habe sie nicht auf dem Cloud-Projekt ausgeführt.

1. Öffnen Sie in VS Code `supabase/SETUP.local.sql`. Die Datei wurde bereits anhand Ihres unveränderten Intake-Tokens erzeugt.
2. Kopieren Sie den vollständigen Inhalt.
3. Öffnen Sie in Supabase **SQL Editor → New query** und fügen Sie ihn ein.
4. Klicken Sie **Run**, sobald Sie diese Einrichtung ausführen möchten.
5. Bei Erfolg öffnen Sie **Table Editor**. Unter dem Schema **public** müssen `contact_requests` und `authorized_admins` sichtbar sein. Die Token-Tabelle liegt absichtlich im Schema **private**.

Die vollständige Datei enthält beide geprüften Migrationen, RLS, Berechtigungen, RPC und den passenden Token-Hash. Sie arbeitet in einer einzigen Transaktion: Ein Fehler bricht die gesamte Einrichtung ab. Bei bestehenden Projektobjekten beziehungsweise einem bereits verwendeten `private`-Schema stoppt sie vor den Änderungen. Es werden keine Benutzer angelegt, Admins autorisiert oder vorhandene Datensätze gelöscht.

**Falls nur der Hash fehlt und die vorhandene Datenbank vorher geprüft wurde:** `supabase/TOKEN.local.sql` enthält ausschließlich die sichere Hash-Einrichtung. Ein bereits passender Hash bleibt erhalten. Ein anderer bestehender Hash führt zum Abbruch und wird nicht ersetzt. Diesen Fall zuerst abgleichen, da ein anderer Server noch das bisherige Token verwenden könnte.

## 4. Öffentliche Registrierung selbst sperren

Dies ist eine produktive Kontoeinstellung. Ich ändere sie nicht in Ihrem Namen.

1. Öffnen Sie **Authentication → Sign In / Providers**.
2. Suchen Sie **Allow new users to sign up** und schalten Sie die Option aus. Klicken Sie gegebenenfalls **Save**.
3. Schalten Sie auch **Allow anonymous sign-ins** beziehungsweise **Anonymous Sign-Ins** aus und speichern Sie.
4. Lassen Sie beim Provider **Email** die E-Mail-/Passwort-Anmeldung aktiviert.

Damit reicht ein direkter Aufruf der öffentlichen Auth-API nicht zur Neuregistrierung. Eine fehlende Registrierungsseite allein würde das nicht verhindern. Die genaue Anordnung der Optionen kann sich ändern; entscheidend sind die genannten Schalter. [Offizielle Supabase-Erklärung](https://supabase.com/docs/guides/auth/general-configuration).

## 5. Den ersten Administrator selbst anlegen und autorisieren

1. Öffnen Sie **Authentication → Users**. Falls Ihr eigenes Konto schon existiert, verwenden Sie dieses weiter.
2. Andernfalls wählen Sie **Add user → Create new user**. Geben Sie Ihre eigene E-Mail-Adresse und ein starkes Passwort ein. Bestätigen Sie bei der angebotenen Option **Auto Confirm User** die von Ihnen kontrollierte Adresse. Klicken Sie selbst auf **Create user**. Niemand wurde von mir angelegt.
3. Klicken Sie in der Benutzerliste auf Ihren Benutzer. Kopieren Sie **User UID** beziehungsweise **UUID**. Das ist die Benutzer-ID, nicht die Projekt-ID und nicht die E-Mail-Adresse.
4. Öffnen Sie in VS Code `supabase/authorize-admin.sql`.
5. Ersetzen Sie ausschließlich `HIER-DIE-USER-UID-EINTRAGEN` durch die kopierte Benutzer-ID. Lassen Sie die einfachen Anführungszeichen stehen.
6. Kopieren Sie den gesamten SQL-Inhalt in **SQL Editor → New query** und klicken Sie **Run**, wenn Sie genau diesen Benutzer als Administrator freischalten möchten.
7. Die Abfrage prüft, ob der Auth-Benutzer existiert, der Ein-Admin-Index vorhanden ist und kein anderer Admin eingerichtet ist. Sie ersetzt oder löscht keinen bisherigen Administrator. Die erneute Ausführung mit derselben UUID ändert nichts.

Das Auth-Konto allein reicht nicht: Erst die ausdrückliche Freischaltung in `authorized_admins` erlaubt den RLS-geschützten Datenzugriff. Eine manipulierte Browserrolle erteilt keine Datenbankrechte.

## 6. Lokal starten und anmelden

1. Beenden Sie eine bereits laufende Kindler-Vorschau in deren Terminal mit **Strg+C**, damit die neue `.env.local` eingelesen wird. Beenden Sie keine unbekannten Prozesse.
2. Führen Sie im Projektterminal aus:

   ```powershell
   npm.cmd run diagnose
   $env:PORT='4174'
   npm.cmd run dev
   ```

3. Lassen Sie das Terminal offen.
4. Öffnen Sie **http://localhost:4174** für die Website.
5. Öffnen Sie **http://localhost:4174/admin/login** oder klicken Sie im Footer auf **Admin-Login**.
6. Melden Sie sich mit dem selbst eingerichteten Admin-Konto an. Danach öffnet sich **http://localhost:4174/admin**.

Der Node-Server liefert Website und API gemeinsam. Ein zweiter Server ist nicht nötig. Bei belegtem Port zuerst Ihre bisherige Vorschau in deren Terminal beenden. Der Code-Standardport ist 4173; 4174 wurde als Ausweichport vorgesehen. Frühere laufende Prozesse sind kein Nachweis des aktuellen Zustands.

## 7. Speicherung persönlich nachweisen

1. Senden Sie auf der Website eine eigene, eindeutig gekennzeichnete Funktionsanfrage mit eigenen Kontaktdaten. Es wurde von mir keine Produktiv-Testnachricht angelegt.
2. Prüfen Sie in Supabase **Table Editor → public → contact_requests**, ob die Anfrage gespeichert ist.
3. Öffnen Sie das Dashboard und klicken Sie **Aktualisieren → Öffnen**. Vergleichen Sie die Nachricht.
4. Ändern Sie den Status, speichern Sie und laden Sie die Seite neu. Der Status muss erhalten bleiben.
5. Melden Sie sich mit **Abmelden** ab. Ein erneuter Aufruf von `/admin` muss zum Login führen.

Ein erfolgreicher Diagnosebefehl allein beweist noch keine erfolgreiche Speicherung oder Admin-RLS. Kontaktformular und Dashboard müssen abschließend gegen die echte Datenbank geprüft werden. Keine Anfrage muss dafür gelöscht werden.

## Veröffentlichung

Nicht Bestandteil der hier ausgeführten Änderungen. Worker-Secrets, produktive Auth-Einstellungen und Deployment werden erst nach Ihrer Bestätigung angefasst. Die vorhandene Architektur ist Cloudflare Workers mit Static Assets; ein Upload nur des Ordners `dist` stellt die Formular-API nicht bereit.
