# Passwort selbst zurücksetzen

## Für den späteren Inhaber

Der Inhaber benötigt für diesen Ablauf keinen Supabase-Zugang:

1. Öffnen Sie den Dashboard-Login der Website.
2. Klicken Sie unter dem Anmeldeformular auf **Passwort vergessen?**.
3. Geben Sie die E-Mail-Adresse Ihres vorhandenen Inhaberkontos ein und klicken Sie **Link anfordern**.
4. Öffnen Sie die E-Mail von Kindler Dach und klicken Sie auf den Link zum Zurücksetzen. Prüfen Sie gegebenenfalls den Spam-Ordner.
5. Geben Sie auf der Website ein neues Passwort mit mindestens zwölf Zeichen zweimal ein und klicken Sie **Passwort speichern**.
6. Erst nach bestätigter Speicherung erscheint die Erfolgsmeldung. Gehen Sie über **Zur Anmeldung** zurück und melden Sie sich mit dem neuen Passwort an.

Es wird kein neuer Benutzer angelegt. Die bestehende Admin-Freischaltung bleibt erforderlich. Ein ungültiger, abgelaufener oder bereits verbrauchter Link öffnet kein Passwortformular; fordern Sie dann einen neuen Link an. Laden Sie die Seite während des Zurücksetzens nicht neu: Die Link-Anmeldung wird nur im Speicher gehalten, und die Zugangsdaten werden aus der Adresszeile entfernt. Eine geöffnete Dashboard-Sitzung allein aktiviert die Rücksetzseite nicht.

## Einmalig vom Website-Betreiber einzurichten

Diese Einrichtung erfolgt einmal vor Übergabe der Website. Ich habe die Cloud-Einstellungen nicht geändert und keinen echten Passwortwechsel ausgelöst.

### 1. Rücksprungadresse freigeben

1. Öffnen Sie [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/lykeruumioxbmcvryrnq/auth/url-configuration).
2. Unter **Redirect URLs** klicken Sie **Add URL**.
3. Tragen Sie für die aktuelle lokale Vorschau exakt ein:

   ```text
   http://localhost:4174/admin/reset-password
   ```

4. Falls Sie die Vorschau über `127.0.0.1` aufrufen, fügen Sie zusätzlich `http://127.0.0.1:4174/admin/reset-password` hinzu.
5. Klicken Sie **Save URLs** beziehungsweise **Save**.
6. Für die spätere Veröffentlichung ergänzen Sie dieselbe Route unter Ihrer tatsächlichen HTTPS-Domain. Keine erfundene Domain und keine pauschale Wildcard verwenden. Als **Site URL** sollte die tatsächlich verwendete Website-Adresse gesetzt sein.

Das Formular setzt die Rücksprungadresse automatisch aus der aktuellen Website-Adresse und `/admin/reset-password` zusammen. Ohne erlaubte Redirect URL kann Supabase stattdessen auf die Site URL zurückfallen. [Offizielle Beschreibung](https://supabase.com/docs/guides/auth/redirect-urls).

### 2. E-Mail-Versand für den Inhaber ermöglichen

Supabase erlaubt mit seinem Standard-Maildienst nur Empfänger aus dem Projekt-Team. Ein späterer Inhaber ohne Supabase-Mitgliedschaft benötigt deshalb einen eigenen SMTP-Versand im Projekt. [Supabase SMTP-Dokumentation](https://supabase.com/docs/guides/auth/auth-smtp).

1. Öffnen Sie in Supabase **Authentication → Email** und dort **SMTP Settings** beziehungsweise **Custom SMTP**. Die genaue Menüanordnung kann sich ändern; der Bereich heißt SMTP Settings.
2. Besorgen Sie beim vorgesehenen Mailanbieter die SMTP-Daten: Host, Port, Benutzername, Passwort sowie freigegebene Absenderadresse. Geben Sie SMTP-Passwörter ausschließlich in den Supabase-Einstellungen ein.
3. Aktivieren Sie **Custom SMTP**, tragen Sie diese Daten ein und verwenden Sie einen passenden Absendernamen, beispielsweise **Kindler Dach**.
4. Speichern Sie und erfüllen Sie gegebenenfalls die vom Mailanbieter verlangte Absender-/Domain-Verifizierung. Aktivieren Sie kein Link-Tracking, das die Auth-Links umschreibt.
5. Lassen Sie die öffentliche Registrierung weiterhin ausgeschaltet. Für die Passwort-Wiederherstellung wird sie nicht benötigt.

### 3. E-Mail-Vorlage prüfen

1. Öffnen Sie **Authentication → Email → Templates** beziehungsweise **Email Templates**.
2. Wählen Sie **Reset Password**.
3. Die Standardvorlage mit dem Link `{{ .ConfirmationURL }}` funktioniert für den implementierten Ablauf. Wenn Sie eine eigene Vorlage verwenden, muss der Button diese Variable als Ziel verwenden. Ein bloßer Link auf die Startseite oder nur ein Zahlencode genügt für diesen Ablauf nicht.
4. Sie können Betreff und Text deutsch formulieren. Lassen Sie den Bestätigungslink unverändert.

### 4. Persönlicher End-to-End-Test

1. Starten Sie die aktuelle Website-Version neu und öffnen Sie `http://localhost:4174/admin/login`.
2. Fordern Sie selbst für Ihr Inhaberkonto einen Rücksetzlink an. Eine neutrale Antwort verrät nicht, ob die eingegebene Adresse existiert.
3. Prüfen Sie den Eingang in Ihrem Postfach und die richtige Rücksprungadresse.
4. Setzen Sie selbst ein neues Passwort. Geben Sie den E-Mail-Link oder das Passwort nicht weiter.
5. Prüfen Sie die Anmeldung mit dem neuen Passwort und anschließend den Zugriff auf Ihre Anfragen.

## Technischer Stand und Prüfgrenzen

- Neue Routen: `/admin/forgot-password` und `/admin/reset-password`, jeweils auch mit abschließendem Schrägstrich.
- Separates, lokal gebündeltes `password.js` verwendet ausschließlich den vorhandenen Publishable-Key und Supabase Auth: `resetPasswordForEmail` und `updateUser`.
- Rücksetzlinks verwenden den Implicit-Flow für diese reine Browseranwendung. Die temporäre Recovery-Sitzung wird nicht in Local Storage gespeichert.
- Passwortänderung erst nach serverseitiger Benutzerprüfung und Abfrage der vorhandenen Admin-Allowlist. Die Passwortfelder sind bis dahin verborgen. Es gibt keinen zusätzlichen öffentlichen Datenbankzugriff und keine neue RLS-Policy.
- Passwörter, Sitzungs- und Rücksetz-Tokens werden nicht protokolliert oder in URL-Parameter geschrieben. Recovery-Tokens aus dem von Supabase gelieferten URL-Fragment werden nach Verarbeitung entfernt.
- Ungleiche Passwörter, zu kurze Passwörter, abgelaufene Links, fehlende Freischaltung und fehlgeschlagene API-Aufrufe zeigen verständliche Fehler. Die endgültigen Passwortregeln des Projekts werden zusätzlich von Supabase durchgesetzt.
- Automatisierte Tests verwenden SDK-/DOM-Testdoubles. Echte E-Mail-Zustellung, Supabase-Redirect-Konfiguration, Custom SMTP und Passwortänderung müssen mit dem Kontoinhaber abschließend geprüft werden. Keine Zustellung oder Passwortänderung wurde behauptet oder automatisiert ausgelöst.

Die Website muss vor Online-Nutzung mit diesen neuen Seiten und Routen veröffentlicht werden. Eine Veröffentlichung wurde nicht ausgeführt.
