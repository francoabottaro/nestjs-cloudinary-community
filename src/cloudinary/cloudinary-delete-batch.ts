import { BadRequestException } from '@nestjs/common';
import type {
  CloudinaryDeleteBatchOpResult,
  CloudinaryDeleteBatchSaveResult,
  CloudinaryDeleteFolderResult,
  CloudinaryDeleteResult,
} from './interface/cloudinary-models.interface';

/** Options for prepared folder deletion (explicit opt-in). */
export type DeleteFolderPrepareOptions = { save_deleted: boolean };

/** Internal hooks used by {@link CloudinaryDeleteBatch.save}. */
export interface CloudinaryDeleteBatchExecutor {
  destroyOne(publicId: string): Promise<void>;
  deleteManyImmediate(publicIds: string[]): Promise<CloudinaryDeleteResult>;
  deleteByFolderImmediate(path: string): Promise<{ assetsDeleted: number }>;
  deleteFolderImmediate(
    path: string,
    options: DeleteFolderPrepareOptions,
  ): Promise<CloudinaryDeleteFolderResult>;
}

type PreparedDeleteOp =
  | { kind: 'one'; publicId: string }
  | { kind: 'many'; publicIds: string[] }
  | { kind: 'byFolder'; path: string }
  | { kind: 'folder'; path: string; options: DeleteFolderPrepareOptions };

/**
 * Queues delete operations; nothing hits Cloudinary until {@link CloudinaryDeleteBatch.save}.
 * Build one batch per request (Nest services are singletons by default).
 */
export class CloudinaryDeleteBatch {
  readonly #exec: CloudinaryDeleteBatchExecutor;
  readonly #ops: PreparedDeleteOp[] = [];

  constructor(exec: CloudinaryDeleteBatchExecutor) {
    this.#exec = exec;
  }

  prepareDeleteOne(publicId: string): this {
    const id = publicId?.trim() ?? '';
    if (!id) {
      throw new BadRequestException('publicId is required.');
    }
    this.#ops.push({ kind: 'one', publicId: id });
    return this;
  }

  prepareDeleteMany(publicIds: string[]): this {
    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      throw new BadRequestException('publicIds must be a non-empty array.');
    }
    this.#ops.push({ kind: 'many', publicIds: [...publicIds] });
    return this;
  }

  prepareDeleteByFolder(path: string): this {
    const p = path?.trim() ?? '';
    if (!p) {
      throw new BadRequestException('folder prefix is required.');
    }
    this.#ops.push({ kind: 'byFolder', path: p });
    return this;
  }

  prepareDeleteFolder(path: string, options: DeleteFolderPrepareOptions): this {
    if (!options.save_deleted) {
      throw new BadRequestException(
        'security error: save_deleted is required to save deleted assets.',
      );
    }
    const p = path?.trim() ?? '';
    if (!p) {
      throw new BadRequestException('folder path is required.');
    }
    this.#ops.push({ kind: 'folder', path: p, options });
    return this;
  }

  /** Runs queued operations in order. */
  async save(): Promise<CloudinaryDeleteBatchSaveResult> {
    const results: CloudinaryDeleteBatchOpResult[] = [];
    for (const op of this.#ops) {
      switch (op.kind) {
        case 'one':
          await this.#exec.destroyOne(op.publicId);
          results.push({ kind: 'one', publicId: op.publicId });
          break;
        case 'many': {
          const result = await this.#exec.deleteManyImmediate(op.publicIds);
          results.push({ kind: 'many', result });
          break;
        }
        case 'byFolder': {
          const { assetsDeleted } = await this.#exec.deleteByFolderImmediate(
            op.path,
          );
          results.push({
            kind: 'byFolder',
            path: op.path,
            assetsDeleted,
          });
          break;
        }
        case 'folder': {
          const result = await this.#exec.deleteFolderImmediate(
            op.path,
            op.options,
          );
          results.push({ kind: 'folder', path: op.path, result });
          break;
        }
        default:
          break;
      }
    }
    return { results };
  }
}
