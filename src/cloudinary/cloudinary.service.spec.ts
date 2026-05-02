import { PassThrough } from 'stream';
import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { CloudinaryServiceContract } from './interface/cloudinary-service.contract';
import { CloudinaryModule } from './cloudinary.module';
import { CloudinaryService, cloudinary } from './cloudinary.service';

/** Second argument to Cloudinary `upload_stream` in tests. */
type UploadStreamCallback = (
  err: { message?: string } | null,
  result?: { secure_url: string; public_id: string },
) => void;

const cloudinaryMocks = {
  uploadStream: jest.fn(),
  destroy: jest.fn(),
  deleteResources: jest.fn(),
  createFolder: jest.fn(),
  deleteFolder: jest.fn(),
  renameFolder: jest.fn(),
  rootFolders: jest.fn(),
  subFolders: jest.fn(),
  deleteResourcesByPrefix: jest.fn(),
  config: jest.fn(() => ({})),
};

/** `jest.Mock` call arity is not `...unknown[]`; avoid spreading `unknown[]` at call sites. */
function callMock(mock: jest.Mock, args: unknown[]): unknown {
  return (mock as (...a: unknown[]) => unknown)(...args);
}

jest.mock('cloudinary', () => ({
  v2: {
    config: (...args: unknown[]): unknown =>
      callMock(cloudinaryMocks.config, args),
    uploader: {
      upload_stream: (...args: unknown[]): unknown =>
        callMock(cloudinaryMocks.uploadStream, args),
      destroy: (...args: unknown[]): unknown =>
        callMock(cloudinaryMocks.destroy, args),
    },
    api: {
      delete_resources: (...args: unknown[]): unknown =>
        callMock(cloudinaryMocks.deleteResources, args),
      create_folder: (...args: unknown[]): unknown =>
        callMock(cloudinaryMocks.createFolder, args),
      delete_folder: (...args: unknown[]): unknown =>
        callMock(cloudinaryMocks.deleteFolder, args),
      rename_folder: (...args: unknown[]): unknown =>
        callMock(cloudinaryMocks.renameFolder, args),
      root_folders: (...args: unknown[]): unknown =>
        callMock(cloudinaryMocks.rootFolders, args),
      sub_folders: (...args: unknown[]): unknown =>
        callMock(cloudinaryMocks.subFolders, args),
      delete_resources_by_prefix: (...args: unknown[]): unknown =>
        callMock(cloudinaryMocks.deleteResourcesByPrefix, args),
    },
  },
}));

function resetMocks(): void {
  cloudinaryMocks.uploadStream.mockReset();
  cloudinaryMocks.destroy.mockReset();
  cloudinaryMocks.deleteResources.mockReset();
  cloudinaryMocks.createFolder.mockReset();
  cloudinaryMocks.deleteFolder.mockReset();
  cloudinaryMocks.renameFolder.mockReset();
  cloudinaryMocks.rootFolders.mockReset();
  cloudinaryMocks.subFolders.mockReset();
  cloudinaryMocks.deleteResourcesByPrefix.mockReset();
  cloudinaryMocks.config.mockReset();
  cloudinaryMocks.config.mockImplementation(() => ({}));
  cloudinaryMocks.destroy.mockResolvedValue({ result: 'ok' });
}

function mockUploadStreamSuccess(payload: {
  secure_url: string;
  public_id: string;
}): void {
  cloudinaryMocks.uploadStream.mockImplementation(
    (_opts, cb: UploadStreamCallback) => {
      const s = new PassThrough();
      queueMicrotask(() => {
        cb(null, payload);
      });
      return s;
    },
  );
}

function mockUploadStreamError(message: string): void {
  cloudinaryMocks.uploadStream.mockImplementation(
    (_opts, cb: UploadStreamCallback) => {
      const s = new PassThrough();
      queueMicrotask(() => {
        cb({ message }, undefined);
      });
      return s;
    },
  );
}

function multerFile(buffer: Buffer | undefined): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'x.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: buffer?.length ?? 0,
    buffer: buffer ?? Buffer.alloc(0),
    stream: null as unknown as Express.Multer.File['stream'],
    destination: '',
    filename: '',
    path: '',
  };
}

describe('CloudinaryService', () => {
  let service: CloudinaryServiceContract;

  beforeEach(async () => {
    resetMocks();
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        CloudinaryModule.forRoot({
          cloud_name: 'test_cloud',
          api_key: 'test_key',
          api_secret: 'test_secret',
        }),
      ],
    }).compile();

    service = module.get(CloudinaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('subclasses can use cloudinarySdk (same v2 singleton as re-export)', () => {
    class ExtendedCloudinaryService extends CloudinaryService {
      exposeSdk() {
        return this.cloudinarySdk;
      }
    }
    const ext = new ExtendedCloudinaryService(
      {},
      {
        cloud_name: 'test_cloud',
        api_key: 'test_key',
        api_secret: 'test_secret',
      },
    );
    expect(ext.exposeSdk()).toBe(cloudinary);
  });

  describe('uploadOne', () => {
    it('returns url and public_id on success', async () => {
      mockUploadStreamSuccess({
        secure_url: 'https://res.cloudinary.com/x/y/z',
        public_id: 'general/abc',
      });

      const out = await service.uploadOne(
        multerFile(Buffer.from([1, 2, 3])),
        'general',
      );

      expect(out).toEqual({
        url: 'https://res.cloudinary.com/x/y/z',
        id_public: 'general/abc',
      });
      expect(cloudinaryMocks.uploadStream).toHaveBeenCalled();
    });

    it('throws BadRequestException when buffer is empty', async () => {
      await expect(service.uploadOne(multerFile(undefined))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ServiceUnavailableException on auth-style errors', async () => {
      mockUploadStreamError('401 Unauthorized signature invalid');

      await expect(
        service.uploadOne(multerFile(Buffer.from([1]))),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadRequestException on generic upload errors', async () => {
      mockUploadStreamError('Something broke');

      await expect(
        service.uploadOne(multerFile(Buffer.from([1]))),
      ).rejects.toThrow(BadRequestException);
    });

    it('rethrows HttpException unchanged', async () => {
      const ex = new BadRequestException('skip');
      cloudinaryMocks.uploadStream.mockImplementation(() => {
        throw ex;
      });

      await expect(
        service.uploadOne(multerFile(Buffer.from([1]))),
      ).rejects.toBe(ex);
    });

    it('passes folder to upload_stream when folder argument is omitted', async () => {
      mockUploadStreamSuccess({
        secure_url: 'https://x',
        public_id: 'general/abc',
      });

      await service.uploadOne(multerFile(Buffer.from([1])), 'general');

      expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
        { folder: 'general' },
        expect.any(Function),
      );
    });
  });

  describe('folder_root option', () => {
    let svc: CloudinaryServiceContract;

    beforeEach(async () => {
      resetMocks();
      const module = await Test.createTestingModule({
        imports: [
          CloudinaryModule.forRoot({
            cloud_name: 'test_cloud',
            api_key: 'test_key',
            api_secret: 'test_secret',
            folder_root: 'my-app',
          }),
        ],
      }).compile();
      svc = module.get(CloudinaryService);
    });

    it('uses folder_root when uploadOne omits folder', async () => {
      mockUploadStreamSuccess({
        secure_url: 'https://x',
        public_id: 'my-app/x',
      });

      await svc.uploadOne(multerFile(Buffer.from([1])));

      expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
        { folder: 'my-app' },
        expect.any(Function),
      );
    });

    it('uses explicit folder when uploadOne passes a non-blank folder', async () => {
      mockUploadStreamSuccess({
        secure_url: 'https://x',
        public_id: 'override/y',
      });

      await svc.uploadOne(multerFile(Buffer.from([1])), 'override');

      expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
        { folder: 'override' },
        expect.any(Function),
      );
    });

    it('uses folder_root for uploadMany when folder is omitted', async () => {
      mockUploadStreamSuccess({
        secure_url: 'https://a',
        public_id: 'my-app/z',
      });

      await svc.uploadMany([
        multerFile(Buffer.from([1])),
        multerFile(Buffer.from([2])),
      ]);

      expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
        { folder: 'my-app' },
        expect.any(Function),
      );
    });
  });

  describe('uploadMany', () => {
    it('returns all results when every upload succeeds', async () => {
      mockUploadStreamSuccess({
        secure_url: 'https://a',
        public_id: 'p1',
      });

      const out = await service.uploadMany([
        multerFile(Buffer.from([1])),
        multerFile(Buffer.from([2])),
      ]);

      expect(out).toHaveLength(2);
      expect(out[0].id_public).toBe('p1');
      expect(out[1].id_public).toBe('p1');
    });

    it('throws when file count exceeds max_upload_files', async () => {
      const module = await Test.createTestingModule({
        imports: [
          CloudinaryModule.forRoot({
            cloud_name: 'test_cloud',
            api_key: 'test_key',
            api_secret: 'test_secret',
            max_upload_files: 2,
          }),
        ],
      }).compile();
      const limited = module.get(CloudinaryService);

      await expect(
        limited.uploadMany([
          multerFile(Buffer.from([1])),
          multerFile(Buffer.from([2])),
          multerFile(Buffer.from([3])),
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(cloudinaryMocks.uploadStream).not.toHaveBeenCalled();
    });

    it('rolls back successful uploads and throws when any upload fails', async () => {
      let call = 0;
      cloudinaryMocks.uploadStream.mockImplementation(
        (_opts, cb: UploadStreamCallback) => {
          const s = new PassThrough();
          queueMicrotask(() => {
            call++;
            if (call === 1) {
              cb(null, {
                secure_url: 'https://ok',
                public_id: 'rolled/id',
              });
            } else {
              cb({ message: 'fail' }, undefined);
            }
          });
          return s;
        },
      );

      cloudinaryMocks.deleteResources.mockResolvedValue(undefined);

      await expect(
        service.uploadMany([
          multerFile(Buffer.from([1])),
          multerFile(Buffer.from([2])),
        ]),
      ).rejects.toThrow(/Failed to upload 1 of 2 files/);

      expect(cloudinaryMocks.deleteResources).toHaveBeenCalledWith([
        'rolled/id',
      ]);
    });
  });

  describe('replaceOne', () => {
    it('returns url and public_id on success', async () => {
      mockUploadStreamSuccess({
        secure_url: 'https://rep',
        public_id: 'folder/asset',
      });

      const out = await service.replaceOne(
        multerFile(Buffer.from([9])),
        'folder/asset',
      );

      expect(out.url).toBe('https://rep');
      expect(out.id_public).toBe('folder/asset');
    });

    it('throws BadRequestException when publicId is blank', async () => {
      await expect(
        service.replaceOne(multerFile(Buffer.from([1])), '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ServiceUnavailableException on 403-style message', async () => {
      mockUploadStreamError('403 Forbidden');

      await expect(
        service.replaceOne(multerFile(Buffer.from([1])), 'pid'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('replaceMany', () => {
    it('throws when files and publicIds length differ', async () => {
      await expect(
        service.replaceMany([multerFile(Buffer.from([1]))], ['a', 'b']),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when file count exceeds max_upload_files', async () => {
      const module = await Test.createTestingModule({
        imports: [
          CloudinaryModule.forRoot({
            cloud_name: 'test_cloud',
            api_key: 'test_key',
            api_secret: 'test_secret',
            max_upload_files: 1,
          }),
        ],
      }).compile();
      const limited = module.get(CloudinaryService);

      await expect(
        limited.replaceMany(
          [multerFile(Buffer.from([1])), multerFile(Buffer.from([2]))],
          ['a', 'b'],
        ),
      ).rejects.toThrow(BadRequestException);
      expect(cloudinaryMocks.uploadStream).not.toHaveBeenCalled();
    });

    it('returns all when each replace succeeds', async () => {
      mockUploadStreamSuccess({
        secure_url: 'https://x',
        public_id: 'a',
      });

      const out = await service.replaceMany(
        [multerFile(Buffer.from([1])), multerFile(Buffer.from([2]))],
        ['id1', 'id2'],
      );

      expect(out).toHaveLength(2);
    });

    it('throws without rollback when one replace fails', async () => {
      let call = 0;
      cloudinaryMocks.uploadStream.mockImplementation(
        (_opts, cb: UploadStreamCallback) => {
          const s = new PassThrough();
          queueMicrotask(() => {
            call++;
            if (call === 1) {
              cb(null, { secure_url: 'https://u', public_id: 'ok' });
            } else {
              cb({ message: 'bad' }, undefined);
            }
          });
          return s;
        },
      );

      await expect(
        service.replaceMany(
          [multerFile(Buffer.from([1])), multerFile(Buffer.from([2]))],
          ['a', 'b'],
        ),
      ).rejects.toThrow(/Failed to replace 1 of 2 files/);
    });
  });

  describe('createDeleteBatch', () => {
    it('prepareDeleteOne + save calls destroy', async () => {
      await service.createDeleteBatch().prepareDeleteOne('public/id').save();
      expect(cloudinaryMocks.destroy).toHaveBeenCalledWith('public/id');
    });

    it('does not call Cloudinary until save()', () => {
      service.createDeleteBatch().prepareDeleteOne('x');
      expect(cloudinaryMocks.destroy).not.toHaveBeenCalled();
    });
  });

  describe('folders', () => {
    it('createFolder returns path and name', async () => {
      cloudinaryMocks.createFolder.mockResolvedValue({
        path: { name: 'sub', path: 'parent/sub' },
      });

      const out = await service.createFolder('parent/sub');

      expect(out).toEqual({ path: 'parent/sub', name: 'sub' });
      expect(cloudinaryMocks.createFolder).toHaveBeenCalledWith('parent/sub');
    });

    it('createFolder rejects empty path', async () => {
      await expect(service.createFolder('  ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('createFolder maps 401 to ServiceUnavailableException', async () => {
      cloudinaryMocks.createFolder.mockRejectedValue(
        new Error('401 Unauthorized'),
      );

      await expect(service.createFolder('a')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('listRootFolders maps folders array', async () => {
      cloudinaryMocks.rootFolders.mockResolvedValue({
        folders: [
          { name: 'a', path: 'a' },
          { name: 'b', path: 'b' },
        ],
      });

      const out = await service.listRootFolders();

      expect(out).toEqual([
        { name: 'a', path: 'a' },
        { name: 'b', path: 'b' },
      ]);
    });

    it('listSubFolders maps folders array', async () => {
      cloudinaryMocks.subFolders.mockResolvedValue({
        folders: [{ name: 'child', path: 'parent/child' }],
      });

      const out = await service.listSubFolders('parent');

      expect(cloudinaryMocks.subFolders).toHaveBeenCalledWith('parent');
      expect(out).toEqual([{ name: 'child', path: 'parent/child' }]);
    });

    it('renameFolder calls API and returns paths', async () => {
      cloudinaryMocks.renameFolder.mockResolvedValue({});

      const out = await service.renameFolder('old', 'new');

      expect(cloudinaryMocks.renameFolder).toHaveBeenCalledWith('old', 'new');
      expect(out).toEqual({ from: 'old', to: 'new' });
    });

    it('renameFolder rejects empty to path', async () => {
      await expect(service.renameFolder('old', '  ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('prepareDeleteByFolder + save only purges by prefix', async () => {
      cloudinaryMocks.deleteResourcesByPrefix.mockResolvedValue({
        deleted: { 'p/a': 'deleted', 'p/b': 'deleted' },
        partial: false,
      });

      const { results } = await service
        .createDeleteBatch()
        .prepareDeleteByFolder('p')
        .save();

      expect(results).toEqual([
        { kind: 'byFolder', path: 'p', assetsDeleted: 2 },
      ]);
      expect(cloudinaryMocks.deleteResourcesByPrefix).toHaveBeenCalled();
      expect(cloudinaryMocks.deleteFolder).not.toHaveBeenCalled();
    });

    it('prepareDeleteFolder + save purges then removes folder', async () => {
      cloudinaryMocks.deleteResourcesByPrefix.mockResolvedValue({
        deleted: { x: 'deleted' },
        partial: false,
      });
      cloudinaryMocks.deleteFolder.mockResolvedValue({});

      const { results } = await service
        .createDeleteBatch()
        .prepareDeleteFolder('myfolder', { save_deleted: true })
        .save();

      expect(
        cloudinaryMocks.deleteResourcesByPrefix.mock.invocationCallOrder[0],
      ).toBeLessThan(cloudinaryMocks.deleteFolder.mock.invocationCallOrder[0]);
      expect(cloudinaryMocks.deleteFolder).toHaveBeenCalledWith('myfolder');
      expect(results).toEqual([
        {
          kind: 'folder',
          path: 'myfolder',
          result: { assetsDeleted: 1, folderRemoved: true },
        },
      ]);
    });

    it('prepareDeleteFolder + save returns folderRemoved false when delete_folder fails', async () => {
      cloudinaryMocks.deleteResourcesByPrefix.mockResolvedValue({
        deleted: { a: 'deleted' },
        partial: false,
      });
      cloudinaryMocks.deleteFolder.mockRejectedValue(
        new Error('folder not empty'),
      );

      const { results } = await service
        .createDeleteBatch()
        .prepareDeleteFolder('myfolder', { save_deleted: true })
        .save();

      const folder = results[0];
      expect(folder?.kind).toBe('folder');
      if (folder?.kind === 'folder') {
        expect(folder.result.folderRemoved).toBe(false);
        expect(folder.result.assetsDeleted).toBe(1);
        expect(folder.result.reason).toContain('folder not empty');
      }
    });

    it('prepareDeleteFolder + save paginates delete_resources_by_prefix when partial', async () => {
      cloudinaryMocks.deleteResourcesByPrefix
        .mockResolvedValueOnce({
          deleted: { a: 'deleted' },
          partial: true,
          next_cursor: 'c1',
        })
        .mockResolvedValueOnce({
          deleted: { b: 'deleted' },
          partial: false,
        });
      cloudinaryMocks.deleteFolder.mockResolvedValue({});

      const { results } = await service
        .createDeleteBatch()
        .prepareDeleteFolder('pfx', { save_deleted: true })
        .save();

      expect(cloudinaryMocks.deleteResourcesByPrefix).toHaveBeenCalledTimes(2);
      expect(cloudinaryMocks.deleteResourcesByPrefix).toHaveBeenNthCalledWith(
        1,
        'pfx',
        {},
      );
      expect(cloudinaryMocks.deleteResourcesByPrefix).toHaveBeenNthCalledWith(
        2,
        'pfx',
        { next_cursor: 'c1' },
      );
      const folder = results[0];
      expect(folder?.kind).toBe('folder');
      if (folder?.kind === 'folder') {
        expect(folder.result.assetsDeleted).toBe(2);
        expect(folder.result.folderRemoved).toBe(true);
      }
    });

    it('prepareDeleteFolder requires save_deleted=true', () => {
      expect(() =>
        service.createDeleteBatch().prepareDeleteFolder('myfolder', {
          save_deleted: false,
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.createDeleteBatch().prepareDeleteFolder('myfolder', {
          save_deleted: false,
        }),
      ).toThrow(
        'security error: save_deleted is required to save deleted assets.',
      );
    });
  });

  describe('createDeleteBatch prepareDeleteMany', () => {
    it('uses batch delete_resources when it succeeds', async () => {
      cloudinaryMocks.deleteResources.mockResolvedValue(undefined);

      const { results } = await service
        .createDeleteBatch()
        .prepareDeleteMany(['a', 'b'])
        .save();

      expect(cloudinaryMocks.deleteResources).toHaveBeenCalledWith(['a', 'b']);
      expect(results).toEqual([
        {
          kind: 'many',
          result: { success: 2, total: 2, failed: false },
        },
      ]);
    });

    it('falls back to destroy per id when batch fails', async () => {
      cloudinaryMocks.deleteResources.mockRejectedValue(
        new Error('batch down'),
      );

      const { results } = await service
        .createDeleteBatch()
        .prepareDeleteMany(['x', 'y'])
        .save();

      expect(cloudinaryMocks.destroy).toHaveBeenCalledTimes(2);
      const many = results[0];
      expect(many?.kind).toBe('many');
      if (many?.kind === 'many') {
        expect(many.result.failed).toBe(false);
        expect(many.result.success).toBe(2);
      }
    });

    it('returns partial errors when individual destroys fail', async () => {
      cloudinaryMocks.deleteResources.mockRejectedValue(
        new Error('batch down'),
      );
      cloudinaryMocks.destroy
        .mockResolvedValueOnce({ result: 'ok' })
        .mockRejectedValueOnce(new Error('nope'));

      const { results } = await service
        .createDeleteBatch()
        .prepareDeleteMany(['good', 'bad'])
        .save();

      const many = results[0];
      expect(many?.kind).toBe('many');
      if (many?.kind === 'many') {
        expect(many.result.failed).toBe(true);
        expect(many.result.success).toBe(1);
        expect(many.result.errors).toHaveLength(1);
        expect(many.result.errors?.[0].public_id).toBe('bad');
      }
    });
  });

  describe('HttpException passthrough', () => {
    it('replaceOne rethrows HttpException', async () => {
      const ex = new HttpException('x', 418);
      cloudinaryMocks.uploadStream.mockImplementation(() => {
        throw ex;
      });

      await expect(
        service.replaceOne(multerFile(Buffer.from([1])), 'id'),
      ).rejects.toBe(ex);
    });
  });
});
