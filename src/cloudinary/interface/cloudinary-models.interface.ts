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

export type {
  CloudinaryDeleteSpec,
  DeleteFolderPrepareOptions,
} from './cloudinary-delete-spec.interface';

/** Result entry for one queued delete operation after save() on the delete batch. */
export type CloudinaryDeleteBatchOpResult =
  | { kind: 'one'; publicId: string }
  | { kind: 'many'; result: CloudinaryDeleteResult }
  | { kind: 'byFolder'; path: string; assetsDeleted: number }
  | { kind: 'folder'; path: string; result: CloudinaryDeleteFolderResult };

/**
 * One failed queued operation when the delete batch's `save` was called with
 * `continueOnError: true`. Shape mirrors the successful op variants without nested results.
 */
export type CloudinaryDeleteBatchSaveError =
  | { kind: 'one'; publicId: string; error: string }
  | { kind: 'many'; publicIds: string[]; error: string }
  | { kind: 'byFolder'; path: string; error: string }
  | { kind: 'folder'; path: string; error: string };

export interface CloudinaryDeleteBatchSaveResult {
  results: CloudinaryDeleteBatchOpResult[];
  failed?: boolean;
  errors?: CloudinaryDeleteBatchSaveError[];
}
