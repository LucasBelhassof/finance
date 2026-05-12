# PostgreSQL Backup and Restore

## Purpose

This runbook defines the minimum safe process for backing up and restoring the Finly PostgreSQL database.

The goal is operational safety, not automation-first convenience. Prefer an explicit operator workflow over opaque scripts.

## Scope

This document covers:

- local backups
- staging restores
- production backup assumptions
- restore safety checks

This document does not authorize direct restore into production. Production restore should be handled as an incident procedure with an explicit approval path.

## Prerequisites

- PostgreSQL client tools must be installed and available in `PATH`:
  - `pg_dump`
  - `pg_restore`
  - `psql`
- The target environment must have the correct database connection string available through environment variables.
- Before any restore, confirm that the target is not the active production database.

## Environment Variables

The helper scripts use these variables:

### Backup

- `BACKUP_DATABASE_URL`: source database URL. Falls back to `DATABASE_URL`.
- `BACKUP_OUTPUT_PATH`: optional output file path.
- `BACKUP_FORMAT`: optional. Supported values:
  - `custom` (default)
  - `plain`

### Restore

- `RESTORE_SOURCE_PATH`: required backup file path.
- `RESTORE_DATABASE_URL`: required target database URL.
- `RESTORE_FORMAT`: optional. Supported values:
  - `custom` (default)
  - `plain`
- `RESTORE_CONFIRM_TARGET`: required confirmation string. Must be `overwrite`.
- `RESTORE_ALLOW_REMOTE`: optional. Set to `true` only when the restore target is intentionally remote and already approved.

## Recommended Backup Commands

### Custom-format backup

Recommended for operational restores:

```bash
pg_dump --format=custom --file=backups/finly-2026-05-11.dump "$DATABASE_URL"
```

### Plain SQL backup

Useful for inspection and smaller local workflows:

```bash
pg_dump --format=plain --file=backups/finly-2026-05-11.sql "$DATABASE_URL"
```

## Recommended Restore Commands

### Restore a custom-format backup into staging or local

```bash
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$RESTORE_DATABASE_URL" backups/finly-2026-05-11.dump
```

### Restore a plain SQL backup into staging or local

```bash
psql "$RESTORE_DATABASE_URL" -f backups/finly-2026-05-11.sql
```

## Helper Scripts

Optional helper scripts are available in `server/scripts`:

- `node server/scripts/backup-db.mjs`
- `node server/scripts/restore-db.mjs`

These scripts are intentionally conservative:

- backup never mutates data
- restore requires explicit confirmation
- restore refuses remote targets unless `RESTORE_ALLOW_REMOTE=true`

## Local Backup Flow

1. Confirm `DATABASE_URL` points to the intended local database.
2. Create a backup:

```bash
node server/scripts/backup-db.mjs
```

3. Verify that the output file exists and has a recent timestamp.
4. Store the file outside temporary directories if it is needed for later recovery.

## Production Backup Assumptions

Before a production deploy:

1. Confirm CI is green.
2. Confirm the current production `DATABASE_URL` is known through the deployment platform.
3. Create a fresh backup before `npm run db:migrate`.
4. Record:
   - timestamp
   - operator
   - environment
   - backup file path or platform snapshot reference
5. Keep at least one pre-deploy backup available until post-deploy smoke validation is complete.

If the hosting platform already provides managed snapshots, keep using them. The Finly helper scripts are optional and should not replace a stronger platform-native backup policy.

## Staging Restore Workflow

1. Verify the backup file path.
2. Verify the target database is staging or local, not production.
3. Set:

```bash
RESTORE_SOURCE_PATH=backups/finly-2026-05-11.dump
RESTORE_DATABASE_URL=postgres://user:password@localhost:5432/finly_staging
RESTORE_CONFIRM_TARGET=overwrite
```

4. Run the restore helper or the equivalent `pg_restore` command.
5. Run:

```bash
npm run db:migrate
```

6. Validate:
   - `GET /api/health`
   - `GET /api/ready`
   - login
   - dashboard load
   - account and transaction listing

## Restore Safety Checklist

Before every restore:

- confirm the target database name
- confirm the target host
- confirm the environment owner knows the restore will overwrite data
- confirm a fresh backup of the target exists if the target matters
- confirm the source file is the intended backup
- confirm no production application is pointed at the restore target unexpectedly

## Rollback Notes

- Backup creation is always safe to rerun.
- Restore should be treated as destructive for the target database.
- If a staging restore fails halfway through, recreate the staging database and rerun the restore from a known-good backup.
- Do not treat production restore as a normal deploy step.
