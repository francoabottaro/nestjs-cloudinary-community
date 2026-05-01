import type {
  InjectionToken,
  ModuleMetadata,
  OptionalFactoryDependency,
  Type,
} from '@nestjs/common';
import { ConfigOptions } from 'cloudinary';
export interface CloudinaryModuleOptions extends ConfigOptions {
  cloud_name: string;
  api_key: string;
  api_secret: string;
  /**
   * Default `folder` for `uploadOne` / `uploadMany` when the `folder` argument is
   * omitted or blank. Falls back to `'general'` when unset.
   */
  folder_root?: string;
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
