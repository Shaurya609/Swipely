import * as SQLite from 'expo-sqlite';
import { MockMediaItem, TrashedAsset } from '@/types/media';

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

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('swipely.db');
  }
  return dbInstance;
}

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
      expires_at TEXT
    );
  `);
}

export async function trashAsset(
  item: MockMediaItem,
  expiresAt: string | null = null
): Promise<void> {
  const db = await getDb();
  const deletedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO reviewed_assets (id, action, reviewed_at) VALUES (?, ?, ?);`,
      [item.id, 'trash', deletedAt]
    );

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
        expiresAt,
      ]
    );
  });
}

export async function restoreAsset(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM reviewed_assets WHERE id = ?;`, [id]);
    await db.runAsync(`DELETE FROM trashed_media WHERE id = ?;`, [id]);
  });
}

export async function keepAsset(id: string): Promise<void> {
  const db = await getDb();
  const reviewedAt = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO reviewed_assets (id, action, reviewed_at) VALUES (?, ?, ?);`,
    [id, 'keep', reviewedAt]
  );
}

export async function undoKeep(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM reviewed_assets WHERE id = ?;`, [id]);
}

export async function getReviewedAssetIds(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(`SELECT id FROM reviewed_assets;`);
  return new Set(rows.map(r => r.id));
}

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
