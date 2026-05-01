import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CloudinaryModule } from './cloudinary.module';
import { CloudinaryService } from './cloudinary.service';
import type { CloudinaryOptionsFactory } from './interface/cloudinary-options.interface';

describe('CloudinaryModule', () => {
  const validOptions = {
    cloud_name: 'c',
    api_key: 'k',
    api_secret: 's',
  };

  describe('forRoot', () => {
    it('compiles and exposes CloudinaryService', async () => {
      const mod = await Test.createTestingModule({
        imports: [CloudinaryModule.forRoot(validOptions)],
      }).compile();

      expect(mod.get(CloudinaryService)).toBeDefined();
    });

    it('throws when options omit required fields', () => {
      expect(() =>
        CloudinaryModule.forRoot({
          cloud_name: '',
          api_key: 'k',
          api_secret: 's',
        }),
      ).toThrow(/cloud_name, api_key, and api_secret are required/);
    });

    it('throws when max_upload_files is not a positive integer', () => {
      expect(() =>
        CloudinaryModule.forRoot({
          ...validOptions,
          max_upload_files: 0,
        }),
      ).toThrow(/max_upload_files must be a positive integer/);
    });
  });

  describe('forFeature', () => {
    const keys = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ] as const;

    it('compiles when CLOUDINARY_* env is set (same as forRoot without args)', async () => {
      const snapshot: Record<string, string | undefined> = {};
      for (const k of keys) {
        snapshot[k] = process.env[k];
      }
      process.env.CLOUDINARY_CLOUD_NAME = 'feat_cloud';
      process.env.CLOUDINARY_API_KEY = 'feat_key';
      process.env.CLOUDINARY_API_SECRET = 'feat_secret';

      try {
        const mod = await Test.createTestingModule({
          imports: [CloudinaryModule.forFeature()],
        }).compile();
        expect(mod.get(CloudinaryService)).toBeDefined();
      } finally {
        for (const k of keys) {
          if (snapshot[k] === undefined) delete process.env[k];
          else process.env[k] = snapshot[k];
        }
      }
    });
  });

  describe('forRoot() from env', () => {
    const keys = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'CLOUDINARY_MAX_UPLOAD_FILES',
    ] as const;
    let snapshot: Record<string, string | undefined>;

    beforeEach(() => {
      snapshot = {};
      for (const k of keys) {
        snapshot[k] = process.env[k];
        delete process.env[k];
      }
    });

    afterEach(() => {
      for (const k of keys) {
        if (snapshot[k] === undefined) delete process.env[k];
        else process.env[k] = snapshot[k];
      }
    });

    it('fails compile when env vars are missing', async () => {
      await expect(
        Test.createTestingModule({
          imports: [CloudinaryModule.forRoot()],
        }).compile(),
      ).rejects.toThrow(/CLOUDINARY_CLOUD_NAME/);
    });

    it('resolves CloudinaryService when env vars are set', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'e';
      process.env.CLOUDINARY_API_KEY = 'k';
      process.env.CLOUDINARY_API_SECRET = 's';

      const mod = await Test.createTestingModule({
        imports: [CloudinaryModule.forRoot()],
      }).compile();

      expect(mod.get(CloudinaryService)).toBeDefined();
    });

    it('rejects compile when CLOUDINARY_MAX_UPLOAD_FILES is invalid', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'e';
      process.env.CLOUDINARY_API_KEY = 'k';
      process.env.CLOUDINARY_API_SECRET = 's';
      process.env.CLOUDINARY_MAX_UPLOAD_FILES = '0';

      await expect(
        Test.createTestingModule({
          imports: [CloudinaryModule.forRoot()],
        }).compile(),
      ).rejects.toThrow(/CLOUDINARY_MAX_UPLOAD_FILES/);
    });
  });

  describe('forRootAsync', () => {
    it('compiles with useFactory', async () => {
      const mod = await Test.createTestingModule({
        imports: [
          CloudinaryModule.forRootAsync({
            useFactory: () => validOptions,
          }),
        ],
      }).compile();

      expect(mod.get(CloudinaryService)).toBeDefined();
    });

    it('compiles with useClass', async () => {
      @Injectable()
      class OptFactory implements CloudinaryOptionsFactory {
        createCloudinaryOptions() {
          return validOptions;
        }
      }

      const mod = await Test.createTestingModule({
        imports: [
          CloudinaryModule.forRootAsync({
            useClass: OptFactory,
          }),
        ],
      }).compile();

      expect(mod.get(CloudinaryService)).toBeDefined();
    });

    it('compiles with useExisting class token', async () => {
      @Injectable()
      class OptFactory implements CloudinaryOptionsFactory {
        createCloudinaryOptions() {
          return validOptions;
        }
      }

      @Module({
        providers: [OptFactory],
        exports: [OptFactory],
      })
      class ConfigModule {}

      const mod = await Test.createTestingModule({
        imports: [
          ConfigModule,
          CloudinaryModule.forRootAsync({
            imports: [ConfigModule],
            useExisting: OptFactory,
          }),
        ],
      }).compile();

      expect(mod.get(CloudinaryService)).toBeDefined();
    });

    it('throws when no async strategy is provided', () => {
      expect(() => CloudinaryModule.forRootAsync({ imports: [] })).toThrow(
        /useFactory, useClass, or useExisting is required/,
      );
    });
  });
});
