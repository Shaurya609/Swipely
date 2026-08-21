export type MediaType = 'photo' | 'video' | 'pdf' | 'screenshot' | 'whatsapp';

export interface MockMediaItem {
  id: string;
  fileName: string;
  fileType: MediaType;
  fileSize: number; // in bytes
  dateCreated: string; // ISO date format "YYYY-MM-DD"
  source: 'Camera' | 'Screenshots' | 'WhatsApp' | 'Downloads' | 'Documents' | 'Videos';
  uri: string;
  duration?: string; // e.g. "0:15" for videos
  thumbnailColor?: string; // backup solid or gradient color representation
}

export type SwipeAction = 'keep' | 'trash';

export interface ReviewedAssetRef {
  id: string;
  action: SwipeAction;
  reviewedAt: string; // ISO timestamp when reviewed
}

export interface TrashedAsset extends MockMediaItem {
  deletedAt: string; // ISO timestamp when swiped left / trashed
  expiresAt: string | null; // Reserved for the future retention/auto-delete feature
}

export interface StorageCategory {
  name: string;
  size: number; // in bytes
  color: string;
}

export interface StorageStats {
  totalStorage: number; // in bytes (e.g. 128 GB)
  usedStorage: number; // in bytes (e.g. 75.2 GB)
  reviewableStorage: number; // in bytes (calculated dynamically based on pending items)
  categories: StorageCategory[];
}
