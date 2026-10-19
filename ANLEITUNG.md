# Kindler Dach verwenden

**Neu: Passwort vergessen:** Am Admin-Login kann der Inhaber einen E-Mail-Link anfordern und sein Passwort direkt auf der Website neu setzen. Für die einmalige Einrichtung von Redirect URL und E-Mail-Versand siehe [PASSWORT_ZURUECKSETZEN.md](./PASSWORT_ZURUECKSETZEN.md). Der Inhaber benötigt danach keinen Supabase-Zugang.

## 1. Was bereits behoben wurde und was noch eingerichtet werden muss

Der aktuelle Code stellt das Kontaktformular, die API `/api/contact`, den Login `/admin/login` und das Dashboard `/admin` bereit. Im Footer der Startseite steht jetzt **Admin-Login**. Der Kontaktservice bestätigt Erfolg ausschließlich nach einer gültigen Supabase-RPC-Antwort. Es gibt keine lokale Ersatzspeicherung und keine öffentliche Registrierung im Website-Code.

Beim Prüfen lief auf Port 4173 ein alter Node-Server: `/api/contact`, `/api/config` und `/admin/login` lieferten dort HTTP 404. Im damaligen Pr?flauf wurde die Vorschau deshalb auf **4174** gestartet. Außerdem fehlte die `.env.local`; ein echter Publishable-Key wurde im verfügbaren Projekt nicht gefunden. Die Datei wurde nun mit der vorgegebenen Projekt-URL und einem zufällig erzeugten geheimen Intake-Token angelegt. Der inzwischen bereitgestellte Publishable-Key ist eingetragen und von Supabase mit HTTP 200 best?tigt. Die Datenbankeinrichtung ist weiterhin offen.

**Echte Speicherung und Anmeldung funktionieren erst nach den folgenden Supabase-Schritten.** Sie erfordern Ihren Projektzugang. Es wurden keine produktiven Testnachrichten angelegt. Die genauen Testgrenzen stehen in [PRUEFBERICHT.md](./PRUEFBERICHT.md).

## 2. Verbindung, Datenbank und Administrator einrichten

Die aktuelle Klick-f?r-Klick-Anleitung steht in [SUPABASE_VERBINDEN.md](./SUPABASE_VERBINDEN.md). Sie beschreibt das Eintragen des fehlenden Publishable-Keys, die lesende Bestandspr?fung, die abgesicherte SQL-Ersteinrichtung, die Registrierungssperre und die ausdr?cklich best?tigte Administrator-Freischaltung.

F?hren Sie im Projektterminal aus:

```powershell
npm.cmd run setup:local
```

Der Befehl erh?lt die vorhandene .env.local und erstellt supabase/SETUP.local.sql sowie supabase/TOKEN.local.sql. Er gibt keine geheimen Werte aus und ?ndert nichts im Cloud-Projekt. Die vollst?ndige SQL-Ersteinrichtung stoppt bei vorhandenen Projektobjekten; ein anderer bestehender Token-Hash wird niemals automatisch ersetzt.


