# nestjs-cloudinary-community

**No oficial · Mantenido por la comunidad** — Ayuda NestJS sobre el paquete npm oficial [`cloudinary`](https://www.npmjs.com/package/cloudinary).

**Inglés:** [README.md](README.md) · **Legal / marcas:** [final de este archivo](#legal-y-marcas)

## Contenido

- [Instalación](#instalación)
- [Registrar el módulo](#registrar-el-módulo)
- [Inyectar `CloudinaryService`](#inyectar-cloudinaryservice)
- [Extender el servicio y el SDK directo](#extender-el-servicio-y-el-sdk-directo)
- [Subidas](#subidas)
- [Reemplazo](#reemplazo-mismo-public_id-sobrescribe-el-recurso)
- [Borrados (preparar, luego save)](#borrados-preparar-luego-save)
- [Carpetas (Admin API)](#carpetas-admin-api)
- [Errores](#errores-qué-captura-tu-app)
- [CLI](#cli-scriptsinitjs)
- [Desarrollo del repositorio](#desarrollo-del-repositorio)
- [Legal y marcas](#legal-y-marcas)

---

## Instalación

**Paquete**

```bash
yarn add nestjs-cloudinary-community
# o: npm install nestjs-cloudinary-community
```

**Peer dependencies** (instalalas junto a este paquete si aún no están en tu app):

```bash
yarn add @nestjs/common @nestjs/core @nestjs/platform-express cloudinary reflect-metadata rxjs
```

Este módulo envuelve el SDK oficial [`cloudinary`](https://www.npmjs.com/package/cloudinary). La entrada `v2` se reexporta desde este paquete como **`cloudinary`** (vía `cloudinary.service.ts` y la raíz del paquete) para poder usar `uploader` / `api` directamente cuando haga falta. Igual tenés que declarar **`cloudinary`** como dependencia en tu proyecto (peer dependency).

**Variables de entorno:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (nombres oficiales de Cloudinary). Opcional: `CLOUDINARY_FOLDER_ROOT` (`folder_root`), `CLOUDINARY_MAX_UPLOAD_FILES` (`max_upload_files`, entero positivo — tope de archivos por lote en `uploadMany` / `replaceMany`).

**Helpers HTTP** (multipart / JSON): `requireNonEmptyString`, `parsePublicIdsJson` — usalos en controladores junto a `CloudinaryService`.

### Superficie pública

| Área          | Símbolos                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Módulo Nest   | `CloudinaryModule`, `CloudinaryService`                                                                        |
| Tokens DI     | `CLOUDINARY_CLIENT`, `CLOUDINARY_OPTIONS`                                                                      |
| Borrados      | `delete()` → `CloudinaryDeleteBatch.save()`, `CloudinaryDeleteSpec`, tipos de resultado del batch              |
| Controladores | `requireNonEmptyString`, `parsePublicIdsJson`                                                                  |
| Tipos         | `CloudinaryServiceContract`, interfaces de resultados                                                          |
| Avanzado      | `cloudinary` — reexport del SDK oficial `v2` (mismo singleton que configura el módulo)                         |
| Extensión     | `CloudinaryService` → **`cloudinarySdk`** (`protected`) para subclases; no está en `CloudinaryServiceContract` |

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

**Módulos feature** (igual que `forRoot()` sin args; lee desde `process.env`)

```typescript
CloudinaryModule.forFeature();
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

## Extender el servicio y el SDK directo

Cuando arranca `CloudinaryModule`, llama a `cloudinary.config(...)` sobre el SDK oficial de Node. Cada import de **`cloudinary`** desde este paquete y cada uso de **`this.cloudinarySdk`** en una subclase apunta al **mismo singleton ya configurado**, no a otro cliente.

### Importar `cloudinary` desde el paquete

Sirve en cualquier servicio, job o script que **no** herede de `CloudinaryService`, cuando necesites una API que la clase base no envuelve (por ejemplo `uploader.upload` con ruta local, u operaciones de Admin API).

```typescript
import { cloudinary } from 'nestjs-cloudinary-community';

// Después de que tu app haya inicializado CloudinaryModule
const result = await cloudinary.uploader.upload('/tmp/archivo.png', {
  folder: 'imports',
});
```

### Subclase y `cloudinarySdk`

`CloudinaryService` expone **`protected readonly cloudinarySdk`**, con el mismo tipo que el objeto `v2`. Las subclases pueden agregar métodos que llamen a cualquier API de Cloudinary y seguir usando `uploadOne`, `delete`, etc. de la clase base.

`cloudinarySdk` **no** forma parte de [`CloudinaryServiceContract`](src/cloudinary/interface/cloudinary-service.contract.ts): está pensado solo para extensión por herencia.

```typescript
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'nestjs-cloudinary-community';

@Injectable()
export class MediaService extends CloudinaryService {
  /** Ejemplo: llamada al SDK no envuelta por CloudinaryService */
  async uploadDesdeRuta(rutaLocal: string, folder: string) {
    return this.cloudinarySdk.uploader.upload(rutaLocal, { folder });
  }
}
```

Registrá la subclase en un módulo que **`imports: [CloudinaryModule.forRoot(...)]`** (o `forRootAsync`) para que la configuración exista antes de usar el SDK. Podés dar de alta `MediaService` con su propio token, o reemplazar el provider por defecto con `{ provide: CloudinaryService, useClass: MediaService }` si toda la app debe usar tu implementación.

---

## Subidas

### `uploadOne(file, folder?)`

El segundo argumento es la opción `folder` de Cloudinary. Orden de resolución:

- `folder` explícito (si no está vacío)
- `folder_root` del módulo
- `'general'`

Devuelve `{ url, id_public }`.

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

Subidas en paralelo. Si falla algún archivo, se hace rollback de las correctas con un **borrado interno inmediato** sobre sus `id_public` (no es la API pública `delete(...).save()`) y se lanza `Error` con mensaje tipo `Failed to upload 1 of 2 files`.

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

Si usás `multipart/form-data`, mandá `publicIds` como un campo string con **JSON** (porque los campos del form son strings):

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

## Borrados (`delete`, luego `save`)

Los borrados son en **dos fases**: `delete(...)` solo arma un `CloudinaryDeleteBatch` (sin llamar a Cloudinary); `save()` ejecuta el trabajo **en orden**.

1. `delete(spec)` o `delete([spec, ...])` — valida y encola uno o más [`CloudinaryDeleteSpec`](src/cloudinary/interface/cloudinary-delete-spec.interface.ts) (**un lote por request**; el servicio suele ser singleton).
2. `save(continueOnError?)` sobre ese lote — ejecuta las llamadas a Cloudinary.

Podés pasar un **array vacío** si solo necesitás un `save()` sin operaciones (p. ej. smoke tests).

**Por qué:** reduce borrados destructivos accidentales (no corre nada hasta `save()`) y deja explícitos los flujos de varios pasos.

### `delete(spec)` — una operación

```typescript
const { results } = await this.cloudinary
  .delete({ kind: 'one', publicId: 'folder/a' })
  .save();
// results: array de { kind: 'one' | 'many' | 'byFolder' | 'folder', ... }
```

### `delete([...])` — varias operaciones en un `save()`

```typescript
const { results } = await this.cloudinary
  .delete([
    { kind: 'one', publicId: 'folder/a' },
    { kind: 'many', publicIds: ['folder/b', 'folder/c'] },
  ])
  .save();
```

### `kind: 'many'` (`publicIds`)

Usa `delete_resources` primero; si falla, hace fallback a `destroy` por id. En `save()` el resultado incluye:

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

Purga por prefijo (`delete_resources_by_prefix`). **No** llama a `delete_folder`.

### `kind: 'folder'` (`path`, `options`)

Purga por prefijo y luego `delete_folder`. Si `delete_folder` falla tras la purga, `result.folderRemoved` es `false` y hay `reason`.

**Nota de seguridad:** en `kind: 'folder'` hace falta `save_deleted: true` (opt-in explícito), alineado con la Admin API de Cloudinary (`save_deleted`).

```typescript
const { results } = await this.cloudinary
  .delete({
    kind: 'folder',
    path: 'myfolder',
    options: { save_deleted: true },
  })
  .save();

const folder = results.find((r) => r.kind === 'folder');
// folder.result.folderRemoved === false → revisar folder.result.reason
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

---

## Errores (qué captura tu app)

- **`BadRequestException`** — rutas de carpeta vacías, longitudes distintas en `replaceMany`, buffer vacío, prepares inválidos del batch de borrado, etc.
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

## CLI (`nestjs-cloudinary-community` / `scripts/init.js`)

El subcomando **`init`** escribe la plantilla **`.env.example`** que trae el paquete y crea o **fusiona** **`.env`** con las claves `CLOUDINARY_*`. El resto de líneas de `.env` se conservan. Los valores `CLOUDINARY_*` existentes se mantienen salvo que uses **`--force`**, que vuelve a poner esas claves en los placeholders documentados antes de fusionar.

Tras **`npm install`** o **`yarn install`**, si falta **`.env.example`** en la raíz del proyecto, el **postinstall** del paquete copia la plantilla allí. **No** crea **`.env`** automáticamente, para que `init` pueda crear o fusionar `.env` sin quedar omitido porque ya existiera un `.env` recién generado.

### Uso

```bash
npx nestjs-cloudinary-community init
npx nestjs-cloudinary-community init --cwd ./apps/api
npx nestjs-cloudinary-community init --force --cwd ./apps/api
```

| Flag           | Significado                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `--cwd <path>` | Directorio de salida (por defecto, el directorio de trabajo actual).                                     |
| `--force`      | Al fusionar `.env`, restablece `CLOUDINARY_*` a placeholders; además desactiva el «skip» descrito abajo. |

### Si ya existen `.env` o `.env.template`

Si **cualquiera** de los dos archivos existe, **`init` no modifica archivos** (código de salida `0`) y emite un log estructurado (ver siguiente apartado) con las líneas placeholder de Cloudinary por si aún faltan credenciales. Vuelve a ejecutar con **`--force`** para el flujo normal de escritura/fusión.

### Registro (logging)

El CLI imprime **un objeto JSON por línea** (forma similar a Pino: `level`, `time`, `msg`, más campos del evento). La variable **`LOG_LEVEL`** puede ser `trace`, `debug`, `info`, `warn`, `error` o `fatal` para filtrar mensajes del logger integrado (valores desconocidos se tratan como `info`).

Para usar el paquete real **`pino`** mientras desarrollas este script en el repositorio, define **`NESTJS_CLOUDINARY_INIT_PINO=1`** y ten `pino` instalado (en este proyecto está en `devDependencies`). Atajo: **`yarn init:env`** / **`npm run init:env`** ejecuta `init` en la raíz del repo con esa variable.

Salida legible (opcional): canalizar con [pino-pretty](https://github.com/pinojs/pino-pretty), por ejemplo:

```bash
npx nestjs-cloudinary-community init | npx pino-pretty
```

El paquete publicado no declara **`dependencies`** de runtime para el CLI, así que `npm install nestjs-cloudinary-community` no instala una pila de logging por ello.

---

## Desarrollo del repositorio

```bash
yarn install && yarn lint && yarn test && yarn test:e2e && yarn build
```

`yarn test` incluye las pruebas del script (`jest.config.scripts.cjs`); usa **`yarn test:scripts`** para ejecutar solo esas.

Contribuir: [Conventional Commits](https://www.conventionalcommits.org/), `yarn lint` y `yarn test` antes de un PR.

Tipos de la API pública: [`src/cloudinary/interface/cloudinary-service.contract.ts`](src/cloudinary/interface/cloudinary-service.contract.ts).

---

## Legal y marcas

Este proyecto es un módulo NestJS **no oficial**, mantenido por la comunidad. **No** está afiliado, respaldado ni patrocinado por **Cloudinary Ltd.** El nombre **Cloudinary®** y el servicio se mencionan solo de forma **nominativa** para indicar compatibilidad con el servicio de medios programables de Cloudinary mediante el paquete npm oficial `cloudinary`.

_(English, same meaning: This project is unofficial and not affiliated with Cloudinary Ltd.; “Cloudinary” is used nominatively only.)_

Este README **no es asesoramiento jurídico**. Los términos del **servicio** de Cloudinary están en [Terms of Use](https://cloudinary.com/tou) y [Acceptable Use Policy](https://cloudinary.com/trust/aup). No uses logotipos de Cloudinary ni impliques que es un producto oficial. Ver también [`NOTICE`](NOTICE).

**Exención de garantía:** el software se ofrece «tal cual»; ver [LICENSE](LICENSE) (MIT).

**Reconocimientos:** [cloudinary](https://www.npmjs.com/package/cloudinary) (SDK oficial), [NestJS](https://nestjs.com/) (este módulo no está afiliado a NestJS).
