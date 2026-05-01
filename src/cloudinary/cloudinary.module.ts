import { DynamicModule, Module, Provider } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';
import {
  CLOUDINARY_CLIENT,
  CLOUDINARY_OPTIONS,
} from './const/cloudinary.constants';
import type {
  CloudinaryModuleAsyncOptions,
  CloudinaryModuleOptions,
  CloudinaryOptionsFactory,
} from './interface/cloudinary-options.interface';

function assertOptions(opts: CloudinaryModuleOptions): void {
  if (!opts?.cloud_name || !opts?.api_key || !opts?.api_secret) {
    throw new Error(
      'CloudinaryModule: cloud_name, api_key, and api_secret are required',
    );
  }
}

function optionsFromEnv(): CloudinaryModuleOptions {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? '';
  const api_key = process.env.CLOUDINARY_API_KEY?.trim() ?? '';
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim() ?? '';
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      'CloudinaryModule: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (e.g. via .env), or use CloudinaryModule.forRoot({ ... }).',
    );
  }
  const folder_root = process.env.CLOUDINARY_FOLDER_ROOT?.trim();
  return {
    cloud_name,
    api_key,
    api_secret,
    ...(folder_root ? { folder_root } : {}),
  };
}

const cloudinaryClientProvider: Provider = {
  provide: CLOUDINARY_CLIENT,
  inject: [CLOUDINARY_OPTIONS],
  useFactory: (opts: CloudinaryModuleOptions) => {
    assertOptions(opts);
    return cloudinary.config({
      ...opts,
    });
  },
};

@Module({})
export class CloudinaryModule {
  /**
   * Register Cloudinary with explicit options, or omit `options` to read
   * `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` from `process.env`
   * (optional: `CLOUDINARY_FOLDER_ROOT` → `folder_root`).
   */
  static forRoot(
    options?: CloudinaryModuleOptions,
    register?: { isGlobal?: boolean },
  ): DynamicModule {
    const isGlobal = register?.isGlobal ?? false;
    let optionsProvider: Provider;
    if (options !== undefined) {
      assertOptions(options);
      optionsProvider = { provide: CLOUDINARY_OPTIONS, useValue: options };
    } else {
      optionsProvider = {
        provide: CLOUDINARY_OPTIONS,
        useFactory: () => optionsFromEnv(),
      };
    }

    return {
      module: CloudinaryModule,
      global: isGlobal,
      providers: [optionsProvider, cloudinaryClientProvider, CloudinaryService],
      exports: [CloudinaryService],
    };
  }

  /**
   * Same as `forRoot()` with no arguments: configuration from `process.env`.
   */
  static forFeature(): DynamicModule {
    return CloudinaryModule.forRoot();
  }

  static forRootAsync(options: CloudinaryModuleAsyncOptions): DynamicModule {
    return {
      module: CloudinaryModule,
      global: options.isGlobal ?? false,
      imports: options.imports ?? [],
      providers: [
        ...CloudinaryModule.createAsyncProviders(options),
        cloudinaryClientProvider,
        CloudinaryService,
      ],
      exports: [CloudinaryService],
    };
  }

  private static createAsyncProviders(
    options: CloudinaryModuleAsyncOptions,
  ): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: CLOUDINARY_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: CLOUDINARY_OPTIONS,
          useFactory: async (factory: CloudinaryOptionsFactory) =>
            factory.createCloudinaryOptions(),
          inject: [options.useClass],
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: CLOUDINARY_OPTIONS,
          useFactory: async (factory: CloudinaryOptionsFactory) =>
            factory.createCloudinaryOptions(),
          inject: [options.useExisting],
        },
      ];
    }

    throw new Error(
      'CloudinaryModule.forRootAsync: one of useFactory, useClass, or useExisting is required',
    );
  }
}
