import type {
  InjectionToken,
  ModuleMetadata,
  OptionalFactoryDependency,
  Type,
} from '@nestjs/common';

export interface CloudinaryModuleOptions {
  cloud_name: string;
  api_key: string;
  api_secret: string;
  /** Passed through to `cloudinary.config({ secure })` */
  secure?: boolean;
  /**
   * Default `folder` for `uploadOne` / `uploadMany` when the `folder` argument is
   * omitted or blank. Falls back to `'general'` when unset.
   */
  folder_root?: string;
  /**
   * When set, `uploadMany` and `replaceMany` reject more than this many files in a
   * single call. Must be a positive integer.
   */
  max_upload_files?: number;
}

export interface CloudinaryOptionsFactory {
  createCloudinaryOptions():
    | Promise<CloudinaryModuleOptions>
    | CloudinaryModuleOptions;
}

export interface CloudinaryModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  useExisting?: Type<CloudinaryOptionsFactory>;
  useClass?: Type<CloudinaryOptionsFactory>;
  useFactory?: (
    ...args: unknown[]
  ) => Promise<CloudinaryModuleOptions> | CloudinaryModuleOptions;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  isGlobal?: boolean;
}
