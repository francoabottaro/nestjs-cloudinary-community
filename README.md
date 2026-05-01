# nestjs-cloudinary-community

**Unofficial · Community-maintained** — NestJS helper around the official [`cloudinary`](https://www.npmjs.com/package/cloudinary) npm package.

**Spanish:** [README.es.md](README.es.md) · **Legal / trademarks:** [end of this file](#legal-and-trademarks)

---

## Install

```bash
yarn add nestjs-cloudinary-community @nestjs/common @nestjs/core @nestjs/platform-express cloudinary reflect-metadata rxjs
```

Env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (official Cloudinary names). Optional: `CLOUDINARY_FOLDER_ROOT` (`folder_root`), `CLOUDINARY_MAX_UPLOAD_FILES` (`max_upload_files`, positive integer — caps batch size for `uploadMany` / `replaceMany`).

HTTP helpers (multipart / JSON form fields): `requireNonEmptyString`, `parsePublicIdsJson` — exported from `nestjs-cloudinary-community` for use in your controllers.

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

---

## Uploads

### `uploadOne(file, folder?)`

Second argument is the Cloudinary `folder` option (default `'general'`). Returns `{ url, id_public }`.

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

Uploads in parallel. If any file fails, successful uploads are rolled back via `deleteMany` on their `id_public`, then throws `Error` with message like `Failed to upload 1 of 2 files`.

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

```typescript
import { Post, UploadedFiles, UseInterceptors, Body } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

@Post('replace-batch')
@UseInterceptors(FilesInterceptor('files', 10))
async replaceBatch(
  @UploadedFiles() files: Express.Multer.File[],
  @Body('publicIds') publicIds: string[],
) {
  return this.cloudinary.replaceMany(files, publicIds);
}
```

---

## Deletes (prepare → `save`)

Deletes are **two-phase** so you can queue work and only hit Cloudinary when you call `save()`:

1. `createDeleteBatch()` — returns a batch object (create **one per request**; `CloudinaryService` is a singleton).
2. `prepareDeleteOne` / `prepareDeleteMany` / `prepareDeleteByFolder` / `prepareDeleteFolder` — **only enqueue** instructions (no Cloudinary calls yet).
3. `save()` — runs queued operations **in order**.

**Why:** reduces accidental destructive deletes (you must finish building the batch before anything is executed) and keeps multi-step flows explicit.

### `createDeleteBatch()`

```typescript
const batch = this.cloudinary.createDeleteBatch();

batch.prepareDeleteOne('folder/a').prepareDeleteMany(['folder/b', 'folder/c']);

const { results } = await batch.save();
// results: array of { kind: 'one' | 'many' | 'byFolder' | 'folder', ... }
```

### `prepareDeleteMany(publicIds)`

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

### `prepareDeleteByFolder(path)`

Prefix purge (`delete_resources_by_prefix`). Does **not** call `delete_folder`.

### `prepareDeleteFolder(path, { save_deleted: true })`

Purges by prefix, then calls `delete_folder`. If `delete_folder` fails after purge, `result.folderRemoved` is `false` and `reason` is set.

**Security note:** `save_deleted: true` is required on `prepareDeleteFolder` (explicit opt-in), matching Cloudinary Admin API expectations for saving deleted assets.

```typescript
const { results } = await this.cloudinary
  .createDeleteBatch()
  .prepareDeleteFolder('myfolder', { save_deleted: true })
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

## CLI (`scripts/init.js`)

Writes / merges `.env.example` and `.env` with `CLOUDINARY_*` keys:

```bash
npx nestjs-cloudinary-community init
npx nestjs-cloudinary-community init --force --cwd ./apps/api
```

---

## Repo development

```bash
yarn install && yarn lint && yarn test && yarn test:e2e && yarn build
```

Contributing: [Conventional Commits](https://www.conventionalcommits.org/), `yarn lint` + `yarn test` before PRs.

Public API types: [`src/cloudinary/cloudinary-service.contract.ts`](src/cloudinary/cloudinary-service.contract.ts).

---

## Legal and trademarks

This project is an **unofficial**, community-maintained NestJS module. It is **not** affiliated with, endorsed by, sponsored by, or connected to **Cloudinary Ltd.** It uses the **Cloudinary®** name and service only in a **nominative** way to describe compatibility with the Cloudinary programmable media service via the official `cloudinary` npm package.

This README is **not legal advice**. For Cloudinary’s terms on their **service**, see [Terms of Use](https://cloudinary.com/tou) and [Acceptable Use Policy](https://cloudinary.com/trust/aup). Do not use Cloudinary logos or imply official product status. See also [`NOTICE`](NOTICE).

**Disclaimer of warranty:** the software is provided “as is”; see [LICENSE](LICENSE) (MIT).

**Acknowledgements:** [cloudinary](https://www.npmjs.com/package/cloudinary) (official SDK), [NestJS](https://nestjs.com/) (this module is not affiliated with NestJS).
