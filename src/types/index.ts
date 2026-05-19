export interface ImageVersion {
  version: string;
  tag?: string;
  digest?: string;
  created_at?: string;
  synced_at?: string;
  target?: string;
  source?: string;
  size?: string | number;
  layers?: number;
}

export interface ImageRecord {
  name: string;
  displayName?: string;
  description?: string;
  source?: string;
  sourceType: string;
  size?: string | number;
  currentVersion: string;
  versions: ImageVersion[];
  syncStatus?: string;
  platforms?: string[];
  layers?: number;
  totalVersions?: number;
  updated?: string;
  stars?: number;
  official?: boolean;
}

export interface FailedImage {
  name: string;
  displayName?: string;
  source?: string;
  sourceType: string;
  version?: string;
  syncStatus: string;
  failedAt?: string;
}

export interface ImagesData {
  updated_at?: string;
  registry?: string;
  owner?: string;
  total_images?: number;
  total_versions?: number;
  total_failed?: number;
  images: ImageRecord[];
  failed_images?: FailedImage[];
}

export type RegistryFilter = 'all' | 'dockerhub' | 'github' | 'google' | 'redhat' | 'aws';
