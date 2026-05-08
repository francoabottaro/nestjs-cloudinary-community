# Source guide (Cloudinary module)

This page links the package’s public docs to the actual source files, and summarizes the main usage patterns.

## Public API entrypoints

- Package root exports `CloudinaryModule`, `CloudinaryService`, and helpers.
- The configured Cloudinary SDK singleton is re-exported as `cloudinary`.

Start here:

- `src/cloudinary/cloudinary.module.ts`
- `src/cloudinary/cloudinary.service.ts`
- `src/cloudinary/interface/cloudinary-service.contract.ts` (public contract)

## Usage patterns

### 1) Inject `CloudinaryService` in your own service

Use when you want the convenience wrappers (`uploadOne`, `uploadMany`, `replaceOne`, delete batch, folder helpers).

```ts
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'nestjs-cloudinary-community';

@Injectable()
export class MediaService {
  constructor(private readonly cloudinary: CloudinaryService) {}
}
```

### 2) Extend `CloudinaryService` to access the underlying SDK

Use when you want to add project-specific methods while reusing the base class behavior.

The base class exposes `protected readonly cloudinarySdk` (typed like `cloudinary.v2`).

```ts
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'nestjs-cloudinary-community';

@Injectable()
export class MediaService extends CloudinaryService {
  async uploadFromPath(localPath: string, folder: string) {
    return this.cloudinarySdk.uploader.upload(localPath, { folder });
  }
}
```

### 3) Import `cloudinary` directly (advanced SDK calls)

Use in jobs/scripts or services that do not subclass `CloudinaryService`, when you need SDK endpoints not wrapped by the module.

```ts
import { cloudinary } from 'nestjs-cloudinary-community';

const result = await cloudinary.uploader.upload('/tmp/file.png', {
  folder: 'imports',
});
```

## Delete batches (prepare, then `save()`)

Deletes are intentionally **two-phase**:

- `cloudinaryService.delete(...)` validates and builds a batch (no calls yet)
- `.save()` performs the destructive operations, in order

This reduces accidental destructive deletes and makes multi-step flows explicit.
