export interface CloudinaryError {
  public_id: string;
  message: string;
}

export interface CloudinaryUploadSuccess {
  id_public: string;
  url: string;
}

export interface CloudinaryDeleteResult {
  success: number;
  total: number;
  failed: boolean;
  errors?: CloudinaryError[];
}

export interface CloudinaryFolder {
  name: string;
  path: string;
}

export interface CloudinaryDeleteFolderResult {
  assetsDeleted: number;
  folderRemoved: boolean;
  reason?: string;
}

/** Result entry for one queued delete operation after `CloudinaryDeleteBatch.save()`. */
export type CloudinaryDeleteBatchOpResult =
  | { kind: 'one'; publicId: string }
  | { kind: 'many'; result: CloudinaryDeleteResult }
  | { kind: 'byFolder'; path: string; assetsDeleted: number }
  | { kind: 'folder'; path: string; result: CloudinaryDeleteFolderResult };

export interface CloudinaryDeleteBatchSaveResult {
  results: CloudinaryDeleteBatchOpResult[];
}
