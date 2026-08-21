import * as SQLite from 'expo-sqlite';
import { MockMediaItem, TrashedAsset } from '@/types/media';

interface TrashedMediaRow {
  id: string; file_name: string; file_type: MockMediaItem['fileType']; file_size: number; date_created: string; source: MockMediaItem['source']; uri: string; duration: string | null; thumbnail_color: string | null; deleted_at: string; expires_at: string;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton SQLite database instance.
 * Automatically opens the database if it hasn't been opened yet.
 */
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('swipely.db');
  }
  return dbInstance;
}

/**
 * Initializes the SQLite database and sets up the required schemas.
 * Creates 'reviewed_assets' and 'trashed_media' tables if they do not exist.
 */
export async function initialize(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS reviewed_assets (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      reviewed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trashed_media (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      date_created TEXT NOT NULL,
      source TEXT NOT NULL,
      uri TEXT NOT NULL,
      duration TEXT,
      thumbnail_color TEXT,
      deleted_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

/**
 * Adds an asset to the persistent Trash state.
 * Uses a transaction to insert records into both reviewed_assets and trashed_media tables.
 * The caller supplies the expiration timestamp so retention policy remains outside the database service.
 */
export async function trashAsset(
  item: MockMediaItem,
  expiresAt: string
): Promise<void> {
  const db = await getDb();
  const deletedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Insert into reviewed_assets
    await db.runAsync(
      `INSERT OR REPLACE INTO reviewed_assets (id, action, reviewed_at) VALUES (?, ?, ?);`,
      [item.id, 'trash', deletedAt]
    );

    // 2. Insert into trashed_media
    await db.runAsync(
      `INSERT OR REPLACE INTO trashed_media (
        id, file_name, file_type, file_size, date_created, source, uri, duration, thumbnail_color, deleted_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        item.id,
        item.fileName,
        item.fileType,
        item.fileSize,
        item.dateCreated,
        item.source,
        item.uri,
        item.duration || null,
        item.thumbnailColor || null,
        deletedAt,
        expiresAt
      ]
    );
  });
}

/**
 * Restores an asset from the Trash state, removing it from both tables in a transaction.
 */
export async function restoreAsset(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM reviewed_assets WHERE id = ?;`, [id]);
    await db.runAsync(`DELETE FROM trashed_media WHERE id = ?;`, [id]);
  });
}

/**
 * Marks an asset as 'kept' in reviewed_assets.
 */
export async function keepAsset(id: string): Promise<void> {
  const db = await getDb();
  const reviewedAt = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO reviewed_assets (id, action, reviewed_at) VALUES (?, ?, ?);`,
    [id, 'keep', reviewedAt]
  );
}

/**
 * Reverts a 'kept' status, removing the asset's review reference.
 */
export async function undoKeep(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM reviewed_assets WHERE id = ?;`, [id]);
}

/**
 * Returns a Set of all reviewed asset IDs (both 'keep' and 'trash') for fast in-memory filtering.
 */
export async function getReviewedAssetIds(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(`SELECT id FROM reviewed_assets;`);
  return new Set(rows.map(r => r.id));
}

/**
 * Retrieves all currently trashed assets from the trashed_media table, ordered by deletion date (newest first).
 */
export async function getTrashedAssets(): Promise<TrashedAsset[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TrashedMediaRow>(
    `SELECT * FROM trashed_media ORDER BY deleted_at DESC;`
  );
  return rows.map(r => ({
    id: r.id,
    fileName: r.file_name,
    fileType: r.file_type,
    fileSize: r.file_size,
    dateCreated: r.date_created,
    source: r.source,
    uri: r.uri,
    duration: r.duration || undefined,
    thumbnailColor: r.thumbnail_color || undefined,
    deletedAt: r.deleted_at,
    expiresAt: r.expires_at,
  }));
}

/**
 * Computes statistical summaries of the files currently stored in Trash.
 */
export async function getTrashStats(): Promise<{ count: number; totalSize: number }> {
  const db = await getDb();
  const result = await db.getFirstAsync<{ count: number; totalSize: number | null }>(
    `SELECT COUNT(*) as count, SUM(file_size) as totalSize FROM trashed_media;`
  );
  if (!result) {
    return { count: 0, totalSize: 0 };
  }
  return {
    count: result.count,
    totalSize: result.totalSize || 0,
  };
}
