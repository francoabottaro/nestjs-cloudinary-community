import { PassThrough } from 'stream';
import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { CloudinaryServiceContract } from './interface/cloudinary-service.contract';
import { CloudinaryModule } from './cloudinary.module';
import { CloudinaryService } from './cloudinary.service';

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

  describe('max_upload_files option', () => {
    let svc: CloudinaryServiceContract;

    beforeEach(async () => {
      resetMocks();
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
      svc = module.get(CloudinaryService);
    });

    it('rejects uploadMany above the limit', async () => {
      await expect(
        svc.uploadMany([
          multerFile(Buffer.from([1])),
          multerFile(Buffer.from([2])),
          multerFile(Buffer.from([3])),
        ]),
      ).rejects.toThrow(/At most 2 file\(s\) allowed per batch/);
    });

    it('rejects replaceMany above the limit before length check', async () => {
      await expect(
        svc.replaceMany(
          [
            multerFile(Buffer.from([1])),
            multerFile(Buffer.from([2])),
            multerFile(Buffer.from([3])),
          ],
          ['a'],
        ),
      ).rejects.toThrow(/At most 2 file/);
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

  describe('deleteOne', () => {
    it('calls cloudinary destroy', async () => {
      await service.deleteOne('public/id');
      expect(cloudinaryMocks.destroy).toHaveBeenCalledWith('public/id');
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

    it('deleteByFolder only purges by prefix', async () => {
      cloudinaryMocks.deleteResourcesByPrefix.mockResolvedValue({
        deleted: { 'p/a': 'deleted', 'p/b': 'deleted' },
        partial: false,
      });

      const out = await service.deleteByFolder('p');

      expect(out.assetsDeleted).toBe(2);
      expect(cloudinaryMocks.deleteResourcesByPrefix).toHaveBeenCalled();
      expect(cloudinaryMocks.deleteFolder).not.toHaveBeenCalled();
    });

    it('deleteFolder purges then removes folder', async () => {
      cloudinaryMocks.deleteResourcesByPrefix.mockResolvedValue({
        deleted: { x: 'deleted' },
        partial: false,
      });
      cloudinaryMocks.deleteFolder.mockResolvedValue({});

      const out = await service.deleteFolder('myfolder', {
        save_deleted: true,
      });

      expect(
        cloudinaryMocks.deleteResourcesByPrefix.mock.invocationCallOrder[0],
      ).toBeLessThan(cloudinaryMocks.deleteFolder.mock.invocationCallOrder[0]);
      expect(cloudinaryMocks.deleteFolder).toHaveBeenCalledWith('myfolder');
      expect(out).toEqual({
        assetsDeleted: 1,
        folderRemoved: true,
      });
    });

    it('deleteFolder returns folderRemoved false when delete_folder fails', async () => {
      cloudinaryMocks.deleteResourcesByPrefix.mockResolvedValue({
        deleted: { a: 'deleted' },
        partial: false,
      });
      cloudinaryMocks.deleteFolder.mockRejectedValue(
        new Error('folder not empty'),
      );

      const out = await service.deleteFolder('myfolder', {
        save_deleted: true,
      });

      expect(out.folderRemoved).toBe(false);
      expect(out.assetsDeleted).toBe(1);
      expect(out.reason).toContain('folder not empty');
    });

    it('deleteFolder paginates delete_resources_by_prefix when partial', async () => {
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

      const out = await service.deleteFolder('pfx', { save_deleted: true });

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
      expect(out.assetsDeleted).toBe(2);
      expect(out.folderRemoved).toBe(true);
    });

    it('deleteFolder requires save_deleted=true', async () => {
      await expect(
        service.deleteFolder('myfolder', { save_deleted: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.deleteFolder('myfolder', { save_deleted: false }),
      ).rejects.toThrow(
        'security error: save_deleted is required to save deleted assets.',
      );
    });
  });

  describe('deleteMany', () => {
    it('uses batch delete_resources when it succeeds', async () => {
      cloudinaryMocks.deleteResources.mockResolvedValue(undefined);

      const out = await service.deleteMany(['a', 'b']);

      expect(cloudinaryMocks.deleteResources).toHaveBeenCalledWith(['a', 'b']);
      expect(out).toEqual({
        success: 2,
        total: 2,
        failed: false,
      });
    });

    it('falls back to destroy per id when batch fails', async () => {
      cloudinaryMocks.deleteResources.mockRejectedValue(
        new Error('batch down'),
      );

      const out = await service.deleteMany(['x', 'y']);

      expect(cloudinaryMocks.destroy).toHaveBeenCalledTimes(2);
      expect(out.failed).toBe(false);
      expect(out.success).toBe(2);
    });

    it('returns partial errors when individual destroys fail', async () => {
      cloudinaryMocks.deleteResources.mockRejectedValue(
        new Error('batch down'),
      );
      cloudinaryMocks.destroy
        .mockResolvedValueOnce({ result: 'ok' })
        .mockRejectedValueOnce(new Error('nope'));

      const out = await service.deleteMany(['good', 'bad']);

      expect(out.failed).toBe(true);
      expect(out.success).toBe(1);
      expect(out.errors).toHaveLength(1);
      expect(out.errors?.[0].public_id).toBe('bad');
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
