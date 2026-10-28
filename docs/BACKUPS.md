# Encrypted database backups

This integration includes Darius's SQLite-consistent snapshot and restore check, adapted to PayTrace's current database. It is a manual command for now; a schedule and off-host storage still need to be configured before a production pilot.

Set `BACKUP_ENCRYPTION_KEY` to a private base64-encoded 32-byte key. Keep the key outside Git and separate from the backup files. Set `DATABASE_PATH` to the existing PayTrace SQLite file and `BACKUP_DIR` to a private directory outside `dist`. Run `npm run backup`. The command uses SQLite's backup API, encrypts the snapshot with AES-256-GCM, checks database integrity and row counts by restoring to a temporary file, and keeps the newest seven backups by default (`BACKUP_KEEP` accepts 2–30). It prints a filename and restore result, not the key or customer data.

To test recovery, stop writes to the target environment and run `npm run restore -- <backup.pbackup> <new-database.sqlite>`. The destination must not exist. The command checks the encryption tag, SHA-256 digest, database integrity, and table counts. Inspect the new database in a separate environment before changing `DATABASE_PATH`; restoring a database does not undo an access grant already applied at an external course service.

The backup file and encryption key must both be retained to recover. A backup stored only on the same host is vulnerable to host loss. Before release, establish a private off-host copy, regular restore drills, retention, key recovery, and an operator-owned schedule. No backup job runs automatically in this branch.
