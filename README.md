# nestjs-cloudinary-community

**Unofficial · Community-maintained** — NestJS helper around the official [`cloudinary`](https://www.npmjs.com/package/cloudinary) npm package.

**Spanish:** [README.es.md](README.es.md) · **Legal / trademarks:** [end of this file](#legal-and-trademarks)

## Contents

- [Install](#install)
- [Register the module](#register-the-module)
- [Inject `CloudinaryService`](#inject-cloudinaryservice)
- [Extend `CloudinaryService` and direct SDK](#extend-cloudinaryservice-and-direct-sdk)
- [Uploads](#uploads)
- [Replace](#replace-same-public_id-overwrite-asset)
- [Deletes (prepare, then save)](#deletes-prepare-then-save)
- [Folders (Admin API)](#folders-admin-api)
- [Errors](#errors-what-your-app-will-catch)
- [CLI](#cli-scriptsinitjs)
- [Repo development](#repo-development)
- [Legal and trademarks](#legal-and-trademarks)

---

## Install

**Package**

```bash
yarn add nestjs-cloudinary-community
# or: npm install nestjs-cloudinary-community
```

**Peer dependencies** (install alongside this package if they are not already in your app):

```bash
yarn add @nestjs/common @nestjs/core @nestjs/platform-express cloudinary reflect-metadata rxjs
```

This module wraps the official [`cloudinary`](https://www.npmjs.com/package/cloudinary) SDK. The `v2` entry is re-exported from this package as **`cloudinary`** (via `cloudinary.service.ts`, then the package root) so you can call `uploader` / `api` directly when needed. You still must list **`cloudinary`** as a dependency in your app (peer dependency).

**Environment variables:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (official Cloudinary names). Optional: `CLOUDINARY_FOLDER_ROOT` (`folder_root`), `CLOUDINARY_MAX_UPLOAD_FILES` (`max_upload_files`, positive integer — caps batch size for `uploadMany` / `replaceMany`).

**HTTP helpers** (multipart / JSON form fields): `requireNonEmptyString`, `parsePublicIdsJson` — use them in controllers next to `CloudinaryService`.

### Public surface

| Area        | Symbols                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Nest module | `CloudinaryModule`, `CloudinaryService`                                                                    |
| DI tokens   | `CLOUDINARY_CLIENT`, `CLOUDINARY_OPTIONS`                                                                  |
| Deletes     | `delete()` → `CloudinaryDeleteBatch.save()`, `CloudinaryDeleteSpec`, batch result types                    |
| Controllers | `requireNonEmptyString`, `parsePublicIdsJson`                                                              |
| Types       | `CloudinaryServiceContract`, upload/delete/folder result interfaces                                        |
| Advanced    | `cloudinary` — re-export of official SDK `v2` (same singleton configured by the module)                    |
| Extension   | `CloudinaryService` → **`cloudinarySdk`** (`protected`) for subclasses; not on `CloudinaryServiceContract` |

## Register the module

**Explicit options**

```typescript
import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'nestjs-cloudinary-community';

@Module({
  imports: [
    CloudinaryModule.forRoot({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
      secure: true,
      folder_root: 'my-app', // optional; default Cloudinary `folder` when upload methods omit `folder`
      max_upload_files: 10, // optional; reject uploadMany/replaceMany with more than N files
    }),
  ],
})
export class AppModule {}
```

**From `process.env` only** (required: the three `CLOUDINARY_*` names above; optional: `CLOUDINARY_FOLDER_ROOT`, `CLOUDINARY_MAX_UPLOAD_FILES`; call with no args)

```typescript
CloudinaryModule.forRoot();
```

**Feature modules** (same as `forRoot()` with no args; reads from `process.env`)

```typescript
CloudinaryModule.forFeature();
```

**Async / global**

```typescript
CloudinaryModule.forRootAsync({
  isGlobal: true,
  useFactory: () => ({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  }),
});
```

## Inject `CloudinaryService`

```typescript
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'nestjs-cloudinary-community';

@Injectable()
export class MediaService {
  constructor(private readonly cloudinary: CloudinaryService) {}
}
```

### Form helpers (`requireNonEmptyString`, `parsePublicIdsJson`)

Use in controllers when reading `multipart/form-data` (e.g. `publicIds` as a JSON string next to files):

```typescript
import { Body, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  CloudinaryService,
  parsePublicIdsJson,
} from 'nestjs-cloudinary-community';

@Post('replace-batch')
@UseInterceptors(FilesInterceptor('files', 10))
async replaceBatch(
  @UploadedFiles() files: Express.Multer.File[],
  @Body('publicIds') publicIdsRaw: string,
) {
  const publicIds = parsePublicIdsJson(publicIdsRaw);
  return this.cloudinary.replaceMany(files, publicIds);
}
```

## Extend `CloudinaryService` and direct SDK

When `CloudinaryModule` boots, it calls `cloudinary.config(...)` on the official Node SDK. Every import of **`cloudinary`** from this package and every use of **`this.cloudinarySdk`** inside a subclass refers to that **same configured singleton** — not a second client.

### Import `cloudinary` from the package

Use this in any service, job, or script that **does not** subclass `CloudinaryService`, whenever you need an API the base class does not wrap (for example `uploader.upload` with a filesystem path, or Admin API calls).

```typescript
import { cloudinary } from 'nestjs-cloudinary-community';

// After CloudinaryModule has been initialized in your app
const result = await cloudinary.uploader.upload('/tmp/file.png', {
  folder: 'imports',
});
```

### Subclass and use `cloudinarySdk`

`CloudinaryService` exposes **`protected readonly cloudinarySdk`**, typed like the `v2` object. Subclasses can add methods that call any Cloudinary API while still reusing `uploadOne`, `delete`, etc. from the base class.

`cloudinarySdk` is **not** part of [`CloudinaryServiceContract`](src/cloudinary/interface/cloudinary-service.contract.ts) — it is only for class extension.

```typescript
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'nestjs-cloudinary-community';

@Injectable()
export class MediaService extends CloudinaryService {
  /** Example: SDK call not wrapped by CloudinaryService */
  async uploadFromPath(localPath: string, folder: string) {
    return this.cloudinarySdk.uploader.upload(localPath, { folder });
  }
}
```

Register the subclass in a module that **`imports: [CloudinaryModule.forRoot(...)]`** (or `forRootAsync`) so configuration runs before your code uses the SDK. You can provide `MediaService` as its own token, or replace the default `CloudinaryService` provider with `{ provide: CloudinaryService, useClass: MediaService }` if the whole app should use your implementation.

---

## Uploads

### `uploadOne(file, folder?)`

Second argument is the Cloudinary `folder` option. Resolution order is:

- explicit non-blank `folder` argument
- module `folder_root`
- `'general'`

Returns `{ url, id_public }`.

```typescript
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from 'nestjs-cloudinary-community';

@Controller('media')
export class MediaController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const { url, id_public } = await this.cloudinary.uploadOne(
      file,
      'products',
    );
    return { url, id_public };
  }
}
```

### `uploadMany(files, folder?)`

Uploads in parallel. If any file fails, successful uploads are rolled back via an **immediate internal batch delete** on their `id_public` (not the public `delete(...).save()` API), then throws `Error` with message like `Failed to upload 1 of 2 files`.

```typescript
import { Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

@Post('upload-many')
@UseInterceptors(FilesInterceptor('files', 10))
async uploadMany(@UploadedFiles() files: Express.Multer.File[]) {
  return this.cloudinary.uploadMany(files, 'invoices');
}
```

---

## Replace (same `public_id`, overwrite asset)

### `replaceOne(file, publicId)`

```typescript
import { Post, UploadedFile, UseInterceptors, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

@Post('replace/:publicId')
@UseInterceptors(FileInterceptor('file'))
async replace(
  @UploadedFile() file: Express.Multer.File,
  @Param('publicId') publicId: string,
) {
  return this.cloudinary.replaceOne(file, publicId);
}
```

### `replaceMany(files, publicIds)`

Lengths must match or `BadRequestException`. On partial failure, successful replaces are **not** rolled back; throws `Error` like `Failed to replace 1 of 2 files`.

If you are using `multipart/form-data`, send `publicIds` as a **JSON string** field (because form fields are strings):

```typescript
import { Post, UploadedFiles, UseInterceptors, Body } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { parsePublicIdsJson } from 'nestjs-cloudinary-community';

@Post('replace-batch')
@UseInterceptors(FilesInterceptor('files', 10))
async replaceBatch(
  @UploadedFiles() files: Express.Multer.File[],
  @Body('publicIds') publicIdsRaw: string,
) {
  const publicIds = parsePublicIdsJson(publicIdsRaw);
  return this.cloudinary.replaceMany(files, publicIds);
}
```

---

## Deletes (`delete`, then `save`)

Deletes are **two-phase**: `delete(...)` only builds a `CloudinaryDeleteBatch` (no Cloudinary calls); `save()` runs the work **in order**.

1. `delete(spec)` or `delete([spec, ...])` — validates and queues one or more [`CloudinaryDeleteSpec`](src/cloudinary/interface/cloudinary-delete-spec.interface.ts) values (create **one batch per request**; `CloudinaryService` is a singleton).
2. `save(continueOnError?)` on that batch — executes Cloudinary calls.

Pass an **empty array** if you only need an empty `save()` result (e.g. smoke tests).

**Why:** reduces accidental destructive deletes (nothing runs until `save()`) and keeps multi-step flows explicit.

### `delete(spec)` — single operation

```typescript
const { results } = await this.cloudinary
  .delete({ kind: 'one', publicId: 'folder/a' })
  .save();
// results: array of { kind: 'one' | 'many' | 'byFolder' | 'folder', ... }
```

### `delete([...])` — several operations in one `save()`

```typescript
const { results } = await this.cloudinary
  .delete([
    { kind: 'one', publicId: 'folder/a' },
    { kind: 'many', publicIds: ['folder/b', 'folder/c'] },
  ])
  .save();
```

### `kind: 'many'` (`publicIds`)

Uses `delete_resources` first; on failure, falls back to per-id `destroy`. The `save()` result includes:

```typescript
{
  kind: 'many';
  result: {
    success: number;
    total: number;
    failed: boolean;
    errors?: { public_id: string; message: string }[];
  };
}
```

### `kind: 'byFolder'` (`path`)

Prefix purge (`delete_resources_by_prefix`). Does **not** call `delete_folder`.

### `kind: 'folder'` (`path`, `options`)

Purges by prefix, then calls `delete_folder`. If `delete_folder` fails after purge, `result.folderRemoved` is `false` and `reason` is set.

**Security note:** `save_deleted: true` is required on `kind: 'folder'` (explicit opt-in), matching Cloudinary Admin API expectations for saving deleted assets.

```typescript
const { results } = await this.cloudinary
  .delete({
    kind: 'folder',
    path: 'myfolder',
    options: { save_deleted: true },
  })
  .save();

const folder = results.find((r) => r.kind === 'folder');
// folder.result.folderRemoved === false → check folder.result.reason
```

---

## Folders (Admin API)

### `createFolder(path)`

```typescript
const { path: p, name } = await this.cloudinary.createFolder('parent/child');
```

### `listRootFolders()`

```typescript
const folders = await this.cloudinary.listRootFolders();
// { name: string; path: string }[]
```

### `listSubFolders(parent)`

```typescript
const children = await this.cloudinary.listSubFolders('parent');
```

### `renameFolder(from, to)`

```typescript
const { from, to } = await this.cloudinary.renameFolder('old/path', 'new/path');
```

---

## Errors (what your app will catch)

- **`BadRequestException`** — empty folder paths, `replaceMany` length mismatch, empty file buffer, invalid delete batch prepares, etc.
- **`ServiceUnavailableException`** — heuristic on message (e.g. 401/403/signature) for upload/replace/folder admin calls.
- **`HttpException`** — rethrown as-is.

```typescript
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

try {
  await this.cloudinary.uploadOne(file);
} catch (e) {
  if (e instanceof ServiceUnavailableException) {
    // credentials / Cloudinary availability
  }
  if (e instanceof BadRequestException) {
    // validation
  }
  throw e;
}
```

---

## CLI (`nestjs-cloudinary-community` / `scripts/init.js`)

The `init` subcommand writes the shipped **`.env.example`** template and creates or **merges** **`.env`** with `CLOUDINARY_*` keys. Lines that are not Cloudinary variables are left in place. Existing `CLOUDINARY_*` values in `.env` are preserved unless you pass **`--force`**, which resets those keys to the documented placeholders before merging.

After **`npm install`** or **`yarn install`**, if **`.env.example`** is missing in your project root, this package’s **postinstall** script copies the template there. It does **not** create **`.env`** automatically, so `init` can create or merge `.env` without being skipped because a fresh empty `.env` already exists.

### Usage

```bash
npx nestjs-cloudinary-community init
npx nestjs-cloudinary-community init --cwd ./apps/api
npx nestjs-cloudinary-community init --force --cwd ./apps/api
```

| Flag           | Meaning                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `--cwd <path>` | Directory to write into (default: current working directory).                                        |
| `--force`      | Reset `CLOUDINARY_*` in `.env` to placeholders when merging; also bypasses the skip behaviour below. |

### When `.env` or `.env.template` already exists

If **either** file is present, **`init` does not change any files** (exits with code `0`). It emits a structured log (see below) that includes Cloudinary placeholder lines you can paste if those credentials are still missing. Run again with **`--force`** to perform the normal write/merge.

### Logging

The CLI prints **one JSON object per line** (Pino-like shape: `level`, `time`, `msg`, plus event fields). Set **`LOG_LEVEL`** to `trace`, `debug`, `info`, `warn`, `error`, or `fatal` to filter messages from the built-in logger (unknown values fall back to `info`).

To use the real **`pino`** package while working on this repo’s init script, set **`NESTJS_CLOUDINARY_INIT_PINO=1`** and ensure `pino` is installed (`devDependencies` in this project). Shortcut: **`yarn init:env`** / **`npm run init:env`** runs `init` in the repo root with that variable set.

Optional readable stream: pipe through [pino-pretty](https://github.com/pinojs/pino-pretty), for example:

```bash
npx nestjs-cloudinary-community init | npx pino-pretty
```

The published package declares **no runtime `dependencies`** for the CLI, so `npm install nestjs-cloudinary-community` does not install a logging stack for it.

---

## Repo development

```bash
yarn install && yarn lint && yarn test && yarn test:e2e && yarn build
```

`yarn test` includes script tests (`jest.config.scripts.cjs`); use **`yarn test:scripts`** to run only those.

Contributing: [Conventional Commits](https://www.conventionalcommits.org/), `yarn lint` + `yarn test` before PRs.

Public API types: [`src/cloudinary/interface/cloudinary-service.contract.ts`](src/cloudinary/interface/cloudinary-service.contract.ts).

---

## Legal and trademarks

This project is an **unofficial**, community-maintained NestJS module. It is **not** affiliated with, endorsed by, sponsored by, or connected to **Cloudinary Ltd.** It uses the **Cloudinary®** name and service only in a **nominative** way to describe compatibility with the Cloudinary programmable media service via the official `cloudinary` npm package.

This README is **not legal advice**. For Cloudinary’s terms on their **service**, see [Terms of Use](https://cloudinary.com/tou) and [Acceptable Use Policy](https://cloudinary.com/trust/aup). Do not use Cloudinary logos or imply official product status. See also [`NOTICE`](NOTICE).

**Disclaimer of warranty:** the software is provided “as is”; see [LICENSE](LICENSE) (MIT).

**Acknowledgements:** [cloudinary](https://www.npmjs.com/package/cloudinary) (official SDK), [NestJS](https://nestjs.com/) (this module is not affiliated with NestJS).
