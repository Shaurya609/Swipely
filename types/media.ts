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
