import { fileURLToPath } from 'node:url';
import { prepareLocalSetup } from './supabase-setup.mjs';

try {
  const result = await prepareLocalSetup(fileURLToPath(new URL('../', import.meta.url)));
  console.log(result.created ? '.env.local wurde angelegt.' : 'Die vorhandene .env.local bleibt unverändert.');
  console.log(result.keyPresent ? 'Publishable-Key vorhanden; Prüfung: npm.cmd run diagnose' : 'OFFEN: Echten Publishable-Key in .env.local bei SUPABASE_PUBLISHABLE_KEY= eintragen.');
  console.log('Vorbereitet: supabase/SETUP.local.sql (vollständige, abgesicherte Ersteinrichtung).');
  console.log('Vorbereitet: supabase/TOKEN.local.sql (nur Token-Hash, ersetzt keinen vorhandenen anderen Hash).');
  console.log('Bestehende Datenbank zuerst mit supabase/check.sql prüfen. Klickanleitung: SUPABASE_VERBINDEN.md');
  console.log('Keine Cloud-Änderung ausgeführt. Weder Schlüssel noch Token wurden ausgegeben.');
} catch {
  // Parser errors may quote input; never print arbitrary error messages.
  console.error('Lokale SQL-Vorbereitung fehlgeschlagen. Dateizugriff und SUPABASE_INTAKE_TOKEN prüfen; vorhandene .env.local bleibt erhalten.');
  process.exitCode = 1;
}
