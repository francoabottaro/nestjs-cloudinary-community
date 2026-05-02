import { BadRequestException } from '@nestjs/common';
import type {
  CloudinaryDeleteBatchOpResult,
  CloudinaryDeleteBatchSaveError,
  CloudinaryDeleteBatchSaveResult,
  CloudinaryDeleteFolderResult,
  CloudinaryDeleteResult,
} from './interface/cloudinary-models.interface';
import type {
  CloudinaryDeleteSpec,
  DeleteFolderPrepareOptions,
} from './interface/cloudinary-delete-spec.interface';

/** Internal hooks used by CloudinaryDeleteBatch.prototype.save. */
export interface CloudinaryDeleteBatchExecutor {
  destroyOne(publicId: string): Promise<void>;
  deleteManyImmediate(publicIds: string[]): Promise<CloudinaryDeleteResult>;
  deleteByFolderImmediate(path: string): Promise<{ assetsDeleted: number }>;
  deleteFolderImmediate(
    path: string,
    options: DeleteFolderPrepareOptions,
  ): Promise<CloudinaryDeleteFolderResult>;
}

export type PreparedDeleteOp = CloudinaryDeleteSpec;

function preparedOpToSaveError(
  op: PreparedDeleteOp,
  error: string,
): CloudinaryDeleteBatchSaveError {
  switch (op.kind) {
    case 'one':
      return { kind: 'one', publicId: op.publicId, error };
    case 'many':
      return { kind: 'many', publicIds: op.publicIds, error };
    case 'byFolder':
      return { kind: 'byFolder', path: op.path, error };
    case 'folder':
      return { kind: 'folder', path: op.path, error };
  }
}

/**
 * Runs prepared delete operations on save().
 * Build instances via CloudinaryService.delete; one batch per request is typical.
 */
export class CloudinaryDeleteBatch {
  readonly #exec: CloudinaryDeleteBatchExecutor;
  readonly #ops: PreparedDeleteOp[];
  #saved = false;

  constructor(
    exec: CloudinaryDeleteBatchExecutor,
    ops: readonly PreparedDeleteOp[] = [],
  ) {
    this.#exec = exec;
    this.#ops = [...ops];
  }

  /** Runs queued operations in order. */
  async save(
    continueOnError = false,
  ): Promise<CloudinaryDeleteBatchSaveResult> {
    if (this.#saved) {
      throw new BadRequestException(
        'Batch already saved. Create a new instance.',
      );
    }

    this.#saved = true;
    const results: CloudinaryDeleteBatchOpResult[] = [];
    const errors: CloudinaryDeleteBatchSaveError[] = [];
    for (const op of this.#ops) {
      try {
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!continueOnError) throw err;
        errors.push(preparedOpToSaveError(op, msg));
      }
    }
    this.#ops.length = 0;
    if (errors.length && continueOnError) {
      return { results, failed: true, errors };
    }
    return { results };
  }
}
