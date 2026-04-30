import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CLOUDINARY_CLIENT,
  CLOUDINARY_OPTIONS,
} from './utils/const/cloudinary.constants';
import type { CloudinaryModuleOptions } from './utils/interface/cloudinary-options.interface';
import type { CloudinaryServiceContract } from './utils/interface/cloudinary-service.contract';
import type {
  CloudinaryDeleteFolderResult,
  CloudinaryDeleteResult,
  CloudinaryError,
  CloudinaryFolder,
  CloudinaryUploadSuccess,
} from './utils/interface/cloudinary-models.interface';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export type {
  CloudinaryDeleteFolderResult,
  CloudinaryDeleteResult,
  CloudinaryError,
  CloudinaryFolder,
  CloudinaryUploadSuccess,
} from './utils/interface/cloudinary-models.interface';

function settledReasonMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return 'Unknown error';
}

@Injectable()
export class CloudinaryService implements CloudinaryServiceContract {
  readonly #logger = new Logger(CloudinaryService.name);
  readonly #defaultUploadFolder: string;
  readonly #maxUploadFiles: number | undefined;

  constructor(
    @Inject(CLOUDINARY_CLIENT) configured: unknown,
    @Inject(CLOUDINARY_OPTIONS) options: CloudinaryModuleOptions,
  ) {
    void configured;
    const root = options.folder_root?.trim();
    this.#defaultUploadFolder =
      root !== undefined && root.length > 0 ? root : 'general';
    const m = options.max_upload_files;
    this.#maxUploadFiles =
      m !== undefined && Number.isInteger(m) && m > 0 ? m : undefined;
  }

  #assertBatchFileLimit(count: number): void {
    if (this.#maxUploadFiles !== undefined && count > this.#maxUploadFiles) {
      throw new BadRequestException(
        `At most ${this.#maxUploadFiles} file(s) allowed per batch (max_upload_files).`,
      );
    }
  }

  /** Resolves Cloudinary `folder` upload option: explicit non-blank `folder`, else module `folder_root`, else `'general'`. */
  #effectiveUploadFolder(folder?: string): string {
    if (folder !== undefined) {
      const t = String(folder).trim();
      if (t.length > 0) return t;
    }
    return this.#defaultUploadFolder;
  }

  // ─── UPLOADS ────────────────────────────────────────────────────────────────
  async uploadOne(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<CloudinaryUploadSuccess> {
    const resolvedFolder = this.#effectiveUploadFolder(folder);
    try {
      const { secure_url, public_id } = await this.#streamUpload(
        file,
        resolvedFolder,
      );
      return { url: secure_url, id_public: public_id };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message =
        error instanceof Error ? error.message : 'Cloudinary upload failed';
      this.#logger.error(
        `uploadOne failed (folder=${resolvedFolder}): ${message}`,
      );
      if (/Invalid|401|403|signature|unauthorized/i.test(message)) {
        throw new ServiceUnavailableException(
          'Failed to upload image to storage. Check Cloudinary credentials and folder.',
        );
      }
      throw new BadRequestException(`Failed to process image file: ${message}`);
    }
  }

  async uploadMany(
    files: Express.Multer.File[],
    folder?: string,
  ): Promise<CloudinaryUploadSuccess[]> {
    this.#assertBatchFileLimit(files.length);
    const resolvedFolder = this.#effectiveUploadFolder(folder);
    const results = await Promise.allSettled(
      files.map((file) => this.uploadOne(file, resolvedFolder)),
    );

    const succeeded: CloudinaryUploadSuccess[] = [];
    const errors: CloudinaryError[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        succeeded.push(result.value);
      } else {
        errors.push({
          public_id: `file_index_${index}`,
          message: settledReasonMessage(result.reason),
        });
      }
    });

    if (errors.length === 0) return succeeded;

    this.#logger.error(
      `Batch upload: ${errors.length} failed. Rolling back ${succeeded.length} uploads.`,
    );

    if (succeeded.length > 0) {
      const rollback = await this.deleteMany(succeeded.map((s) => s.id_public));
      if (rollback.failed) {
        this.#logger.error(
          'Rollback partially failed. Orphaned Cloudinary IDs:',
          rollback.errors?.map((e) => e.public_id),
        );
      }
    }

    throw new Error(
      `Failed to upload ${errors.length} of ${files.length} files`,
    );
  }

  // ─── REPLACE (full asset overwrite, same public_id) ──────────────────────────
  async replaceOne(
    file: Express.Multer.File,
    publicId: string,
  ): Promise<CloudinaryUploadSuccess> {
    try {
      const { secure_url, public_id } = await this.#streamReplace(
        file,
        publicId,
      );
      return { url: secure_url, id_public: public_id };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message =
        error instanceof Error ? error.message : 'Cloudinary replace failed';
      this.#logger.error(
        `replaceOne failed (public_id=${publicId}): ${message}`,
      );
      if (/Invalid|401|403|signature|unauthorized/i.test(message)) {
        throw new ServiceUnavailableException(
          'Failed to replace image in storage. Check Cloudinary credentials.',
        );
      }
      throw new BadRequestException(`Failed to replace image file: ${message}`);
    }
  }

  async replaceMany(
    files: Express.Multer.File[],
    publicIds: string[],
  ): Promise<CloudinaryUploadSuccess[]> {
    this.#assertBatchFileLimit(files.length);
    if (files.length !== publicIds.length) {
      throw new BadRequestException('Files and publicIds length must match.');
    }

    const results = await Promise.allSettled(
      files.map((file, i) => this.replaceOne(file, publicIds[i])),
    );

    const succeeded: CloudinaryUploadSuccess[] = [];
    const errors: CloudinaryError[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        succeeded.push(result.value);
      } else {
        errors.push({
          public_id: publicIds[index] ?? `file_index_${index}`,
          message: settledReasonMessage(result.reason),
        });
      }
    });

    if (errors.length === 0) return succeeded;

    this.#logger.error(
      `Batch replace: ${errors.length} of ${files.length} failed. Successful replacements are kept (no rollback for previous binaries).`,
    );

    throw new Error(
      `Failed to replace ${errors.length} of ${files.length} files`,
    );
  }

  // ─── FOLDERS ─────────────────────────────────────────────────────────────────

  /** Creates a folder path in Cloudinary (asset folder). */
  async createFolder(path: string): Promise<{ path: string; name: string }> {
    const p = this.#requireNonEmptyPath(path, 'folder path');
    try {
      const res = (await cloudinary.api.create_folder(p)) as Record<
        string,
        unknown
      >;
      const folder = (res.path ?? res.folder) as
        | { name?: string; path?: string }
        | undefined;
      if (folder && typeof folder === 'object') {
        return {
          path: String(folder.path ?? p),
          name: String(folder.name ?? p.split('/').pop() ?? p),
        };
      }
      const tail = p.split('/').pop() ?? p;
      return { path: p, name: tail };
    } catch (error) {
      this.#wrapAdminError('createFolder', error);
    }
  }

  /** Lists root-level asset folders. */
  async listRootFolders(): Promise<CloudinaryFolder[]> {
    try {
      const res = (await cloudinary.api.root_folders()) as Record<
        string,
        unknown
      >;
      return this.#mapFolderList(res.folders);
    } catch (error) {
      this.#wrapAdminError('listRootFolders', error);
    }
  }

  /** Lists direct subfolders under `parent` (use `''` for roots if your account supports it). */
  async listSubFolders(parent: string): Promise<CloudinaryFolder[]> {
    const p = parent?.trim() ?? '';
    try {
      const res = (await cloudinary.api.sub_folders(p)) as Record<
        string,
        unknown
      >;
      return this.#mapFolderList(res.folders);
    } catch (error) {
      this.#wrapAdminError('listSubFolders', error);
    }
  }

  /** Renames an asset folder (`from` → `to`). */
  async renameFolder(
    from: string,
    to: string,
  ): Promise<{ from: string; to: string }> {
    const a = this.#requireNonEmptyPath(from, 'from path');
    const b = this.#requireNonEmptyPath(to, 'to path');
    try {
      await cloudinary.api.rename_folder(a, b);
      return { from: a, to: b };
    } catch (error) {
      this.#wrapAdminError('renameFolder', error);
    }
  }

  /**
   * Deletes all assets whose `public_id` starts with `path` (folder prefix).
   * Does not remove the folder record itself.
   */
  async deleteByFolder(path: string): Promise<{ assetsDeleted: number }> {
    const p = this.#requireNonEmptyPath(path, 'folder prefix');
    try {
      const assetsDeleted = await this.#deleteAssetsByPrefixPaged(p);
      return { assetsDeleted };
    } catch (error) {
      this.#wrapAdminError('deleteByFolder', error);
    }
  }

  /**
   * Deletes all assets under `path`, then removes the empty folder.
   * If `delete_folder` fails (e.g. non-empty subfolders), returns `folderRemoved: false` with `reason`.
   */
  async deleteFolder(path: string): Promise<CloudinaryDeleteFolderResult> {
    const p = this.#requireNonEmptyPath(path, 'folder path');
    let assetsDeleted = 0;
    try {
      assetsDeleted = await this.#deleteAssetsByPrefixPaged(p);
    } catch (error) {
      this.#wrapAdminError('deleteFolder (purge assets)', error);
    }
    try {
      await cloudinary.api.delete_folder(p);
      return { assetsDeleted, folderRemoved: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'delete_folder failed';
      this.#logger.warn(
        `deleteFolder: assets purged (${assetsDeleted}) but folder remove failed: ${message}`,
        error,
      );
      return {
        assetsDeleted,
        folderRemoved: false,
        reason: message,
      };
    }
  }

  // ─── DELETES ────────────────────────────────────────────────────────────────

  async deleteOne(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  async deleteMany(publicIds: string[]): Promise<CloudinaryDeleteResult> {
    // Prefer native batch delete
    try {
      await cloudinary.api.delete_resources(publicIds);
      return {
        success: publicIds.length,
        total: publicIds.length,
        failed: false,
      };
    } catch (error) {
      this.#logger.warn(
        'Batch delete failed, falling back to individual deletes',
        error,
      );
    }

    // Fallback: per-resource deletes with allSettled
    const results = await Promise.allSettled(
      publicIds.map((id) => this.deleteOne(id)),
    );

    const errors: CloudinaryError[] = [];
    let success = 0;

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        success++;
      } else {
        errors.push({
          public_id: publicIds[i],
          message: settledReasonMessage(result.reason),
        });
        this.#logger.warn(`Failed to delete: ${publicIds[i]}`, result.reason);
      }
    });

    const failed = errors.length > 0;
    return {
      success,
      total: publicIds.length,
      failed,
      ...(failed && { errors }),
    };
  }

  // ─── PRIVATE ────────────────────────────────────────────────────────────────

  #wrapAdminError(op: string, error: unknown): never {
    if (error instanceof HttpException) throw error;
    const message =
      error instanceof Error ? error.message : 'Cloudinary admin API failed';
    this.#logger.error(`${op} failed: ${message}`);
    if (/Invalid|401|403|signature|unauthorized/i.test(message)) {
      throw new ServiceUnavailableException(
        'Failed to perform Cloudinary folder operation. Check credentials.',
      );
    }
    throw new BadRequestException(`Failed ${op}: ${message}`);
  }

  #requireNonEmptyPath(value: string, label: string): string {
    const v = value?.trim() ?? '';
    if (!v) {
      throw new BadRequestException(`${label} is required.`);
    }
    return v;
  }

  #mapFolderList(raw: unknown): CloudinaryFolder[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      const o = item as { name?: string; path?: string };
      return {
        name: String(o.name ?? ''),
        path: String(o.path ?? o.name ?? ''),
      };
    });
  }

  #countDeletedInResponse(res: Record<string, unknown>): number {
    const del = res.deleted;
    if (del && typeof del === 'object' && !Array.isArray(del)) {
      return Object.keys(del).length;
    }
    return 0;
  }

  async #deleteAssetsByPrefixPaged(prefix: string): Promise<number> {
    let total = 0;
    let next_cursor: string | undefined;
    for (;;) {
      const res = (await cloudinary.api.delete_resources_by_prefix(prefix, {
        ...(next_cursor ? { next_cursor } : {}),
      })) as Record<string, unknown>;
      total += this.#countDeletedInResponse(res);
      const partial = Boolean(res.partial);
      const nc =
        typeof res.next_cursor === 'string' && res.next_cursor.length > 0
          ? res.next_cursor
          : undefined;
      if (!partial || !nc) break;
      next_cursor = nc;
    }
    return total;
  }

  async #streamUpload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadApiResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'File is empty or has no buffer (check multipart: file/files field and that the proxy allows the body).',
      );
    }
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error) return reject(new Error(error.message ?? 'Upload failed'));
          if (!result) return reject(new Error('Upload returned no result'));
          resolve(result);
        },
      );
      Readable.from(file.buffer).pipe(stream);
    });
  }

  async #streamReplace(
    file: Express.Multer.File,
    publicId: string,
  ): Promise<UploadApiResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'File is empty or has no buffer (check multipart: file/files field and that the proxy allows the body).',
      );
    }
    const id = publicId?.trim();
    if (!id) {
      throw new BadRequestException(
        'publicId is required to replace an existing asset.',
      );
    }
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: id,
          overwrite: true,
          invalidate: true,
        },
        (error, result) => {
          if (error)
            return reject(new Error(error.message ?? 'Replace failed'));
          if (!result) return reject(new Error('Replace returned no result'));
          resolve(result);
        },
      );
      Readable.from(file.buffer).pipe(stream);
    });
  }
}
