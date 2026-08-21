import * as SQLite from 'expo-sqlite';
import * as MediaLibrary from 'expo-media-library';
import { MockMediaItem, TrashedAsset } from '@/types/media';

export const RETENTION_OPTIONS = [7, 30, 60, 90, 0] as const;
export type RetentionDays = (typeof RETENTION_OPTIONS)[number];
export const DEFAULT_RETENTION_DAYS: RetentionDays = 30;

interface TrashedMediaRow {
  id: string;
  file_name: string;
  file_type: MockMediaItem['fileType'];
  file_size: number;
  date_created: string;
  source: MockMediaItem['source'];
  uri: string;
  duration: string | null;
  thumbnail_color: string | null;
  deleted_at: string;
  expires_at: string | null;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbOpenPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializationPromise: Promise<void> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (!dbOpenPromise) {
    dbOpenPromise = SQLite.openDatabaseAsync('swipely.db')
      .then(db => { dbInstance = db; return db; })
      .finally(() => { dbOpenPromise = null; });
  }
  return dbOpenPromise;
}

function calculateExpiresAt(deletedAt: string, retentionDays: RetentionDays): string | null {
  if (retentionDays === 0) return null;
  return new Date(new Date(deletedAt).getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
}

async function readRetentionDays(db: SQLite.SQLiteDatabase): Promise<RetentionDays> {
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'trash_retention_days';`);
  const value = Number(row?.value ?? DEFAULT_RETENTION_DAYS);
  return RETENTION_OPTIONS.includes(value as RetentionDays) ? (value as RetentionDays) : DEFAULT_RETENTION_DAYS;
}

export async function initialize(): Promise<void> {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    const db = await getDb();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS reviewed_assets (id TEXT PRIMARY KEY, action TEXT NOT NULL, reviewed_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS trashed_media (
        id TEXT PRIMARY KEY, file_name TEXT NOT NULL, file_type TEXT NOT NULL, file_size INTEGER NOT NULL,
        date_created TEXT NOT NULL, source TEXT NOT NULL, uri TEXT NOT NULL, duration TEXT,
        thumbnail_color TEXT, deleted_at TEXT NOT NULL, expires_at TEXT
      );
      CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT OR IGNORE INTO app_settings (key, value) VALUES ('trash_retention_days', '30');
    `);
    const columns = await db.getAllAsync<{ name: string; notnull: number }>(`PRAGMA table_info(trashed_media);`);
    const expiresColumn = columns.find(column => column.name === 'expires_at');
    if (expiresColumn?.notnull === 1) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(`
          CREATE TABLE trashed_media_migrating (
            id TEXT PRIMARY KEY, file_name TEXT NOT NULL, file_type TEXT NOT NULL, file_size INTEGER NOT NULL,
            date_created TEXT NOT NULL, source TEXT NOT NULL, uri TEXT NOT NULL, duration TEXT,
            thumbnail_color TEXT, deleted_at TEXT NOT NULL, expires_at TEXT
          );
          INSERT INTO trashed_media_migrating
            (id, file_name, file_type, file_size, date_created, source, uri, duration, thumbnail_color, deleted_at, expires_at)
          SELECT id, file_name, file_type, file_size, date_created, source, uri, duration, thumbnail_color, deleted_at, expires_at FROM trashed_media;
          DROP TABLE trashed_media;
          ALTER TABLE trashed_media_migrating RENAME TO trashed_media;
        `);
      });
    }
    const retentionDays = await readRetentionDays(db);
    if (retentionDays !== 0) {
      const rows = await db.getAllAsync<{ id: string; deleted_at: string }>(`SELECT id, deleted_at FROM trashed_media WHERE expires_at IS NULL;`);
      for (const row of rows) {
        const expiresAt = calculateExpiresAt(row.deleted_at, retentionDays);
        if (expiresAt) await db.runAsync(`UPDATE trashed_media SET expires_at = ? WHERE id = ?;`, [expiresAt, row.id]);
      }
    }
  })();
  try { await initializationPromise; } finally { initializationPromise = null; }
}

export async function getRetentionDays(): Promise<RetentionDays> {
  await initialize();
  return readRetentionDays(await getDb());
}

export async function setRetentionDays(retentionDays: RetentionDays): Promise<void> {
  if (!RETENTION_OPTIONS.includes(retentionDays)) throw new Error(`Unsupported trash retention period: ${retentionDays}`);
  await initialize();
  await (await getDb()).runAsync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('trash_retention_days', ?);`, [String(retentionDays)]);
}

export async function trashAsset(item: MockMediaItem): Promise<void> {
  await initialize();
  const db = await getDb();
  const deletedAt = new Date().toISOString();
  const expiresAt = calculateExpiresAt(deletedAt, await readRetentionDays(db));
  await db.withTransactionAsync(async () => {
    await db.runAsync(`INSERT OR REPLACE INTO reviewed_assets (id, action, reviewed_at) VALUES (?, ?, ?);`, [item.id, 'trash', deletedAt]);
    await db.runAsync(`INSERT OR REPLACE INTO trashed_media (id, file_name, file_type, file_size, date_created, source, uri, duration, thumbnail_color, deleted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, [item.id, item.fileName, item.fileType, item.fileSize, item.dateCreated, item.source, item.uri, item.duration || null, item.thumbnailColor || null, deletedAt, expiresAt]);
  });
}

export async function restoreAsset(id: string): Promise<void> {
  await initialize();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM reviewed_assets WHERE id = ?;`, [id]);
    await db.runAsync(`DELETE FROM trashed_media WHERE id = ?;`, [id]);
  });
}

export async function keepAsset(id: string): Promise<void> {
  await initialize();
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO reviewed_assets (id, action, reviewed_at) VALUES (?, ?, ?);`, [id, 'keep', new Date().toISOString()]);
}

export async function undoKeep(id: string): Promise<void> {
  await initialize();
  await (await getDb()).runAsync(`DELETE FROM reviewed_assets WHERE id = ?;`, [id]);
}

export async function getReviewedAssetIds(): Promise<Set<string>> {
  await initialize();
  const rows = await (await getDb()).getAllAsync<{ id: string }>(`SELECT id FROM reviewed_assets;`);
  return new Set(rows.map(r => r.id));
}

export async function getTrashedAssets(): Promise<TrashedAsset[]> {
  await initialize();
  const rows = await (await getDb()).getAllAsync<TrashedMediaRow>(`SELECT * FROM trashed_media ORDER BY deleted_at DESC;`);
  return rows.map(r => ({ id: r.id, fileName: r.file_name, fileType: r.file_type, fileSize: r.file_size, dateCreated: r.date_created, source: r.source, uri: r.uri, duration: r.duration || undefined, thumbnailColor: r.thumbnail_color || undefined, deletedAt: r.deleted_at, expiresAt: r.expires_at }));
}

export async function getTrashStats(): Promise<{ count: number; totalSize: number }> {
  await initialize();
  const result = await (await getDb()).getFirstAsync<{ count: number; totalSize: number | null }>(`SELECT COUNT(*) as count, SUM(file_size) as totalSize FROM trashed_media;`);
  if (!result) return { count: 0, totalSize: 0 };
  return { count: result.count, totalSize: result.totalSize || 0 };
}

async function removeTrashRecord(id: string): Promise<void> {
  await initialize();
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM reviewed_assets WHERE id = ?;`, [id]);
    await db.runAsync(`DELETE FROM trashed_media WHERE id = ?;`, [id]);
  });
}

async function assetExists(id: string): Promise<boolean> {
  try {
    await MediaLibrary.getAssetInfoAsync(id);
    return true;
  } catch {
    return false;
  }
}

export async function permanentlyDeleteAsset(id: string): Promise<void> {
  await initialize();
  const existsBefore = await assetExists(id);
  if (!existsBefore) {
    console.warn(`[TrashService] Asset ${id} was already missing; removing stale Trash record.`);
    await removeTrashRecord(id);
    return;
  }

  console.log(`[TrashService] Permanently deleting asset ${id}`);
  await MediaLibrary.deleteAssetsAsync([id]);

  // Android MediaStore operations can return before the asset is no longer
  // queryable. Poll briefly so we don't remove the database record prematurely.
  const verificationDelays = [100, 250, 500, 1000];
  for (const delay of verificationDelays) {
    await new Promise(resolve => setTimeout(resolve, delay));
    if (!(await assetExists(id))) {
      console.log(`[TrashService] Verified asset ${id} is deleted.`);
      await removeTrashRecord(id);
      return;
    }
  }

  console.error(`[TrashService] Android reported deletion but asset ${id} is still present.`);
  throw new Error('The media file could not be verified as deleted from the device.');
}

export async function cleanupExpiredTrash(): Promise<number> {
  await initialize();
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(`SELECT id FROM trashed_media WHERE expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at ASC;`, [new Date().toISOString()]);
  let cleaned = 0;
  for (const row of rows) {
    try { await permanentlyDeleteAsset(row.id); cleaned += 1; }
    catch (error) { console.error(`[TrashService] Failed to permanently delete expired asset ${row.id}:`, error); }
  }
  return cleaned;
}
