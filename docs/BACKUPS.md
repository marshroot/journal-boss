# Backups

Admin backup endpoints:

- `POST /api/admin/backups`
- `POST /api/admin/backups/restore`

## Contents

```text
backup.zip
├── database/journal.db
├── storage/attachments/*  # includes materials/ and homework/ subdirectories
├── collab/collab.sqlite   # when collaboration storage exists
├── collab/collab.sqlite-wal
├── collab/collab.sqlite-shm
└── manifest.txt
```

## Create

The main SQLite database is checkpointed and copied using SQLite backup APIs. Attachments and collaboration state are then added to the archive.

## Restore

- ZIP paths are checked for traversal.
- `manifest.txt` is required.
- Main SQLite `integrity_check` must return `ok`.
- A safety copy of the current main DB is made before replacement.
- Attachments are replaced from the archive.
- Collaboration SQLite is restored when present.
- A restart is recommended after restore so Hocuspocus reloads its persistent state.

## Limitation

Because Hocuspocus is a separate running process, production restore should be followed by a controlled restart of the collaboration service. A future operational improvement can add an explicit quiesce/restore orchestration step.

## Data Protection key ring

Backups also contain `dataprotection/keys/*`. This is required because legacy Top Academy credentials are encrypted with ASP.NET Data Protection. A database backup without the matching key ring cannot decrypt those credentials after restore.

Treat Jornal backups as **secrets**: they contain the database, uploaded files, collaboration state and the Data Protection key ring. Store and transfer backup archives only through an access-controlled, encrypted location.
