import {
  CLOUDINARY_CLIENT,
  CLOUDINARY_OPTIONS,
  CloudinaryDeleteBatch,
  CloudinaryModule,
  CloudinaryService,
  cloudinary,
  parsePublicIdsJson,
  requireNonEmptyString,
} from './index';

describe('package public API (index.ts)', () => {
  it('re-exports CloudinaryModule with forRoot', () => {
    expect(CloudinaryModule).toBeDefined();
    expect(typeof CloudinaryModule.forRoot).toBe('function');
  });

  it('re-exports CloudinaryService', () => {
    expect(CloudinaryService).toBeDefined();
    expect(CloudinaryService.name).toBe('CloudinaryService');
  });

  it('re-exports DI injection tokens', () => {
    expect(CLOUDINARY_CLIENT).toBe('CLOUDINARY_CLIENT');
    expect(CLOUDINARY_OPTIONS).toBe('CLOUDINARY_OPTIONS');
  });

  it('re-exports CloudinaryDeleteBatch', () => {
    const batch = new CloudinaryDeleteBatch(
      {
        destroyOne: () => Promise.resolve(),
        deleteManyImmediate: () =>
          Promise.resolve({ success: 0, total: 0, failed: false }),
        deleteByFolderImmediate: () => Promise.resolve({ assetsDeleted: 0 }),
        deleteFolderImmediate: () =>
          Promise.resolve({ assetsDeleted: 0, folderRemoved: true }),
      },
      [],
    );
    expect(batch).toBeInstanceOf(CloudinaryDeleteBatch);
  });

  it('re-exports official cloudinary v2 singleton', () => {
    expect(cloudinary).toBeDefined();
    expect(cloudinary.uploader).toBeDefined();
    expect(cloudinary.api).toBeDefined();
  });

  it('re-exports http helpers', () => {
    expect(requireNonEmptyString('ok', 'field')).toBe('ok');
    expect(() => requireNonEmptyString('', 'field')).toThrow(
      'field is required',
    );
    expect(parsePublicIdsJson('["x","y"]')).toEqual(['x', 'y']);
  });
});
