# Guía del código fuente (módulo Cloudinary)

Esta página conecta la documentación pública con los archivos reales del código y resume los patrones principales de uso.

## Entrypoints de la API pública

- La raíz del paquete exporta `CloudinaryModule`, `CloudinaryService` y helpers.
- El singleton configurado del SDK de Cloudinary se reexporta como `cloudinary`.

Empezá por:

- `src/cloudinary/cloudinary.module.ts`
- `src/cloudinary/cloudinary.service.ts`
- `src/cloudinary/interface/cloudinary-service.contract.ts` (contrato público)

## Patrones de uso

### 1) Inyectar `CloudinaryService` en tu propio servicio

Útil para usar wrappers (`uploadOne`, `uploadMany`, `replaceOne`, batch de borrado, helpers de carpetas).

```ts
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'nestjs-cloudinary-community';

@Injectable()
export class MediaService {
  constructor(private readonly cloudinary: CloudinaryService) {}
}
```

### 2) Extender `CloudinaryService` para acceder al SDK subyacente

Útil si querés agregar métodos propios del proyecto manteniendo el comportamiento de la clase base.

La clase base expone `protected readonly cloudinarySdk` (tipado como `cloudinary.v2`).

```ts
import { Injectable } from '@nestjs/common';
import { CloudinaryService } from 'nestjs-cloudinary-community';

@Injectable()
export class MediaService extends CloudinaryService {
  async uploadDesdeRuta(rutaLocal: string, folder: string) {
    return this.cloudinarySdk.uploader.upload(rutaLocal, { folder });
  }
}
```

### 3) Importar `cloudinary` directo (llamadas avanzadas al SDK)

Útil en jobs/scripts o servicios que no heredan de `CloudinaryService`, cuando necesitás endpoints no envueltos por el módulo.

```ts
import { cloudinary } from 'nestjs-cloudinary-community';

const result = await cloudinary.uploader.upload('/tmp/archivo.png', {
  folder: 'imports',
});
```

## Batches de borrado (preparar, luego `save()`)

Los borrados son **en dos fases**:

- `cloudinaryService.delete(...)` valida y arma el lote (todavía no llama a Cloudinary)
- `.save()` ejecuta las operaciones destructivas, en orden

Esto reduce borrados accidentales y deja explícitos los flujos de varios pasos.
