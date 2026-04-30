# nestjs-cloudinary-community

**No oficial · Mantenido por la comunidad** — Ayuda NestJS sobre el paquete npm oficial [`cloudinary`](https://www.npmjs.com/package/cloudinary).

**Inglés:** [README.md](README.md) · **Legal / marcas:** [final de este archivo](#legal-y-marcas)

---

## Instalación

```bash
yarn add nestjs-cloudinary-community @nestjs/common @nestjs/core @nestjs/platform-express cloudinary reflect-metadata rxjs
```

Variables de entorno: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (nombres oficiales de Cloudinary). Opcional: `CLOUDINARY_FOLDER_ROOT` (`folder_root`), `CLOUDINARY_MAX_UPLOAD_FILES` (`max_upload_files`, entero positivo — tope de archivos por lote en `uploadMany` / `replaceMany`).

Helpers HTTP (multipart / JSON): `requireNonEmptyString`, `parsePublicIdsJson` — exportados desde `nestjs-cloudinary-community` para usarlos en tus controladores.

## Registrar el módulo

**Opciones explícitas**

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
      folder_root: 'my-app', // opcional: carpeta Cloudinary por defecto si omites `folder` en subidas
      max_upload_files: 10, // opcional: rechaza uploadMany/replaceMany con más de N archivos
    }),
  ],
})
export class AppModule {}
```

**Solo desde `process.env`** (obligatorias: las tres `CLOUDINARY_*` de arriba; opcional: `CLOUDINARY_FOLDER_ROOT`, `CLOUDINARY_MAX_UPLOAD_FILES`; llamada sin argumentos)

```typescript
CloudinaryModule.forRoot();
```

**Asíncrono / global**

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

## Inyectar `CloudinaryService`

```typescript
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'nestjs-cloudinary-community';

@Injectable()
export class MediaService {
  constructor(private readonly cloudinary: CloudinaryService) {}
}
```

### Helpers de formularios (`requireNonEmptyString`, `parsePublicIdsJson`)

Útiles en controladores con `multipart/form-data` (por ejemplo `publicIds` como JSON junto a archivos):

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

## Subidas

### `uploadOne(file, folder?)`

El segundo argumento es la opción `folder` de Cloudinary (por defecto `'general'`). Devuelve `{ url, id_public }`.

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

Subidas en paralelo. Si falla algún archivo, se hace rollback de las correctas con `deleteMany` sobre sus `id_public` y se lanza `Error` con mensaje tipo `Failed to upload 1 of 2 files`.

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

## Reemplazo (mismo `public_id`, sobrescribe el recurso)

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

Las longitudes deben coincidir o `BadRequestException`. Si hay fallos parciales, los reemplazos exitosos **no** se revierten; se lanza `Error` tipo `Failed to replace 1 of 2 files`.

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

## Borrados

### `deleteOne(publicId)`

```typescript
await this.cloudinary.deleteOne('folder/my_image');
```

### `deleteMany(publicIds)`

Intenta primero `delete_resources` por lotes; si falla, hace fallback a `destroy` por id. Devuelve:

```typescript
{
  success: number;
  total: number;
  failed: boolean;
  errors?: { public_id: string; message: string }[];
}
```

```typescript
const result = await this.cloudinary.deleteMany(['a/b', 'a/c']);
if (result.failed) {
  console.log(result.errors);
}
```

---

## Carpetas (Admin API)

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

### `deleteByFolder(path)`

Borra recursos cuyo `public_id` empieza por `path` (purga por prefijo). **No** llama a `delete_folder`.

```typescript
const { assetsDeleted } = await this.cloudinary.deleteByFolder('my-prefix');
```

### `deleteFolder(path)`

Purga por prefijo (`delete_resources_by_prefix` paginado) y luego `delete_folder`.

**Nota de seguridad:** este método requiere `{ save_deleted: true }` como opt-in explícito. Ayuda a evitar borrados destructivos accidentales forzando al caller a reconocer que los recursos borrados deben guardarse (Admin API de Cloudinary `save_deleted`).

```typescript
const { assetsDeleted, folderRemoved, reason } =
  await this.cloudinary.deleteFolder('myfolder', { save_deleted: true });
// folderRemoved === false → revisar reason
```

---

## Errores (qué captura tu app)

- **`BadRequestException`** — rutas de carpeta vacías, longitudes distintas en `replaceMany`, buffer vacío, etc.
- **`ServiceUnavailableException`** — heurística sobre el mensaje (p. ej. 401/403/firma) en subidas/reemplazos/carpetas admin.
- **`HttpException`** — se relanza tal cual.

```typescript
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

try {
  await this.cloudinary.uploadOne(file);
} catch (e) {
  if (e instanceof ServiceUnavailableException) {
    // credenciales / disponibilidad Cloudinary
  }
  if (e instanceof BadRequestException) {
    // validación
  }
  throw e;
}
```

---

## CLI (`scripts/init.js`)

Escribe / fusiona `.env.example` y `.env` con claves `CLOUDINARY_*`:

```bash
npx nestjs-cloudinary-community init
npx nestjs-cloudinary-community init --force --cwd ./apps/api
```

---

## Desarrollo del repositorio

```bash
yarn install && yarn lint && yarn test && yarn test:e2e && yarn build
```

Contribuir: [Conventional Commits](https://www.conventionalcommits.org/), `yarn lint` y `yarn test` antes de un PR.

Tipos de la API pública: [`src/cloudinary/cloudinary-service.contract.ts`](src/cloudinary/cloudinary-service.contract.ts).

---

## Legal y marcas

Este proyecto es un módulo NestJS **no oficial**, mantenido por la comunidad. **No** está afiliado, respaldado ni patrocinado por **Cloudinary Ltd.** El nombre **Cloudinary®** y el servicio se mencionan solo de forma **nominativa** para indicar compatibilidad con el servicio de medios programables de Cloudinary mediante el paquete npm oficial `cloudinary`.

_(English, same meaning: This project is unofficial and not affiliated with Cloudinary Ltd.; “Cloudinary” is used nominatively only.)_

Este README **no es asesoramiento jurídico**. Los términos del **servicio** de Cloudinary están en [Terms of Use](https://cloudinary.com/tou) y [Acceptable Use Policy](https://cloudinary.com/trust/aup). No uses logotipos de Cloudinary ni impliques que es un producto oficial. Ver también [`NOTICE`](NOTICE).

**Exención de garantía:** el software se ofrece «tal cual»; ver [LICENSE](LICENSE) (MIT).

**Reconocimientos:** [cloudinary](https://www.npmjs.com/package/cloudinary) (SDK oficial), [NestJS](https://nestjs.com/) (este módulo no está afiliado a NestJS).
