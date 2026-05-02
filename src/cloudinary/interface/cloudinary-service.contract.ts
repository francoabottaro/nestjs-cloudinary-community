import type {
  CloudinaryFolder,
  CloudinaryUploadSuccess,
} from './cloudinary-models.interface';
import type { CloudinaryDeleteSpec } from './cloudinary-delete-spec.interface';
import type { CloudinaryDeleteBatch } from '../cloudinary-delete-batch';

/**
 * Public API of {@link CloudinaryService} for tests and consumers that must not
 * depend on the `cloudinary` package graph (e.g. ESLint `projectService` with `jest.mock('cloudinary')`).
 */
export interface CloudinaryServiceContract {
  uploadOne(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<CloudinaryUploadSuccess>;
  uploadMany(
    files: Express.Multer.File[],
    folder?: string,
  ): Promise<CloudinaryUploadSuccess[]>;
  replaceOne(
    file: Express.Multer.File,
    publicId: string,
  ): Promise<CloudinaryUploadSuccess>;
  replaceMany(
    files: Express.Multer.File[],
    publicIds: string[],
  ): Promise<CloudinaryUploadSuccess[]>;
  createFolder(path: string): Promise<{ path: string; name: string }>;
  listRootFolders(): Promise<CloudinaryFolder[]>;
  listSubFolders(parent: string): Promise<CloudinaryFolder[]>;
  renameFolder(from: string, to: string): Promise<{ from: string; to: string }>;
  /**
   * Queued deletes: pass a spec (or array of specs), then save() on the returned batch.
   */
  delete(
    specOrSpecs: CloudinaryDeleteSpec | readonly CloudinaryDeleteSpec[],
  ): CloudinaryDeleteBatch;
}
