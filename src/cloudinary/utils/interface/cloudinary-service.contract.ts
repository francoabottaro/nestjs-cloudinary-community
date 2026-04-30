import type {
  CloudinaryDeleteFolderResult,
  CloudinaryDeleteResult,
  CloudinaryFolder,
  CloudinaryUploadSuccess,
} from './cloudinary-models.interface';

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
  deleteOne(publicId: string): Promise<void>;
  createFolder(path: string): Promise<{ path: string; name: string }>;
  listRootFolders(): Promise<CloudinaryFolder[]>;
  listSubFolders(parent: string): Promise<CloudinaryFolder[]>;
  renameFolder(from: string, to: string): Promise<{ from: string; to: string }>;
  deleteByFolder(path: string): Promise<{ assetsDeleted: number }>;
  deleteFolder(path: string): Promise<CloudinaryDeleteFolderResult>;
  deleteMany(publicIds: string[]): Promise<CloudinaryDeleteResult>;
}
