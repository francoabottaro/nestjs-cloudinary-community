import {
  CloudinaryDeleteBatch,
  type CloudinaryDeleteBatchExecutor,
} from './cloudinary-delete-batch';
import type { CloudinaryDeleteFolderResult } from './interface/cloudinary-models.interface';

function createExecutorMocks() {
  const destroyOne = jest.fn().mockResolvedValue(undefined);
  const deleteManyImmediate = jest.fn().mockResolvedValue({
    success: 1,
    total: 1,
    failed: false,
  });
  const deleteByFolderImmediate = jest.fn().mockResolvedValue({
    assetsDeleted: 0,
  });
  const deleteFolderImmediate = jest.fn().mockResolvedValue({
    assetsDeleted: 0,
    folderRemoved: true,
  } satisfies CloudinaryDeleteFolderResult);

  const exec: CloudinaryDeleteBatchExecutor = {
    destroyOne,
    deleteManyImmediate,
    deleteByFolderImmediate,
    deleteFolderImmediate,
  };

  return {
    exec,
    destroyOne,
    deleteManyImmediate,
    deleteByFolderImmediate,
    deleteFolderImmediate,
  };
}

describe('CloudinaryDeleteBatch', () => {
  it('save() on empty queue returns { results: [] }', async () => {
    const { exec } = createExecutorMocks();
    const batch = new CloudinaryDeleteBatch(exec, []);
    await expect(batch.save()).resolves.toEqual({ results: [] });
  });

  it('rejects second save()', async () => {
    const { exec } = createExecutorMocks();
    const batch = new CloudinaryDeleteBatch(exec, []);
    await batch.save();
    await expect(batch.save()).rejects.toThrow(/already saved/);
  });

  it('runs destroyOne in order for two one ops', async () => {
    const { exec, destroyOne } = createExecutorMocks();
    const batch = new CloudinaryDeleteBatch(exec, [
      { kind: 'one', publicId: 'a' },
      { kind: 'one', publicId: 'b' },
    ]);
    await batch.save();
    expect(destroyOne).toHaveBeenNthCalledWith(1, 'a');
    expect(destroyOne).toHaveBeenNthCalledWith(2, 'b');
  });

  it('save(false) rethrows executor error', async () => {
    const { exec, destroyOne } = createExecutorMocks();
    destroyOne.mockRejectedValueOnce(new Error('boom'));
    const batch = new CloudinaryDeleteBatch(exec, [
      { kind: 'one', publicId: 'x' },
    ]);
    await expect(batch.save()).rejects.toThrow('boom');
  });

  it('save(true) records error and continues', async () => {
    const { exec, destroyOne } = createExecutorMocks();
    destroyOne
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('second-fail'));
    const out = await new CloudinaryDeleteBatch(exec, [
      { kind: 'one', publicId: 'ok' },
      { kind: 'one', publicId: 'bad' },
    ]).save(true);

    expect(out.failed).toBe(true);
    expect(out.results).toEqual([{ kind: 'one', publicId: 'ok' }]);
    expect(out.errors).toEqual([
      { kind: 'one', publicId: 'bad', error: 'second-fail' },
    ]);
  });

  it('maps non-Error rejection to string in save(true)', async () => {
    const { exec, destroyOne } = createExecutorMocks();
    destroyOne.mockResolvedValueOnce(undefined).mockRejectedValueOnce('plain');
    const out = await new CloudinaryDeleteBatch(exec, [
      { kind: 'one', publicId: 'a' },
      { kind: 'one', publicId: 'b' },
    ]).save(true);
    expect(out.errors?.[0]?.error).toBe('plain');
  });

  it('delegates deleteManyImmediate and records result', async () => {
    const { exec, deleteManyImmediate } = createExecutorMocks();
    deleteManyImmediate.mockResolvedValue({
      success: 2,
      total: 2,
      failed: false,
    });
    const out = await new CloudinaryDeleteBatch(exec, [
      { kind: 'many', publicIds: ['p1', 'p2'] },
    ]).save();
    expect(deleteManyImmediate).toHaveBeenCalledWith(['p1', 'p2']);
    expect(out.results).toEqual([
      {
        kind: 'many',
        result: { success: 2, total: 2, failed: false },
      },
    ]);
  });

  it('delegates deleteByFolderImmediate', async () => {
    const { exec, deleteByFolderImmediate } = createExecutorMocks();
    deleteByFolderImmediate.mockResolvedValue({
      assetsDeleted: 3,
    });
    const out = await new CloudinaryDeleteBatch(exec, [
      { kind: 'byFolder', path: 'pfx/' },
    ]).save();
    expect(deleteByFolderImmediate).toHaveBeenCalledWith('pfx/');
    expect(out.results).toEqual([
      { kind: 'byFolder', path: 'pfx/', assetsDeleted: 3 },
    ]);
  });

  it('delegates deleteFolderImmediate', async () => {
    const { exec, deleteFolderImmediate } = createExecutorMocks();
    const folderResult: CloudinaryDeleteFolderResult = {
      assetsDeleted: 1,
      folderRemoved: true,
    };
    deleteFolderImmediate.mockResolvedValue(folderResult);
    const out = await new CloudinaryDeleteBatch(exec, [
      {
        kind: 'folder',
        path: 'fld',
        options: { save_deleted: true },
      },
    ]).save();
    expect(deleteFolderImmediate).toHaveBeenCalledWith('fld', {
      save_deleted: true,
    });
    expect(out.results).toEqual([
      { kind: 'folder', path: 'fld', result: folderResult },
    ]);
  });

  it('save(true) maps folder op error shape', async () => {
    const { exec, deleteFolderImmediate } = createExecutorMocks();
    deleteFolderImmediate.mockRejectedValue(new Error('folder-fail'));
    const out = await new CloudinaryDeleteBatch(exec, [
      {
        kind: 'folder',
        path: 'f',
        options: { save_deleted: true },
      },
    ]).save(true);
    expect(out.errors).toEqual([
      { kind: 'folder', path: 'f', error: 'folder-fail' },
    ]);
  });
});
