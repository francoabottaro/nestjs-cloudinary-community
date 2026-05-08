# Scripts / CLI

Este repositorio publica un CLI pequeño vía el binario del paquete **`nestjs-cloudinary-community`**.

## `init` (bootstrap de variables de entorno)

El comando `init` sirve para preparar variables de entorno de Cloudinary:

- escribe la plantilla **`.env.example`** que trae el paquete en la raíz de tu proyecto
- crea o fusiona **`.env`** con las claves `CLOUDINARY_*`

### Uso básico

```bash
npx nestjs-cloudinary-community init
```

### Apuntar a otro directorio

```bash
npx nestjs-cloudinary-community init --cwd ./apps/api
```

### Forzar fusión / restablecer placeholders

Si ya tenés `CLOUDINARY_*` y querés resetearlas a placeholders antes de fusionar:

```bash
npx nestjs-cloudinary-community init --force --cwd ./apps/api
```

## Comportamiento cuando ya existen archivos env

Si existe **`.env`** **o** **`.env.template`**, `init` **no modifica archivos** (sale con código `0`).

Para evitar el “skip”, ejecutá de nuevo con **`--force`**.

## Logging

El CLI imprime **un objeto JSON por línea** (forma tipo Pino: `level`, `time`, `msg`, más campos extra).

- Filtrar verbosidad con `LOG_LEVEL` (`trace`/`debug`/`info`/`warn`/`error`/`fatal`)
- Salida legible:

```bash
npx nestjs-cloudinary-community init | npx pino-pretty
```

## Atajo de desarrollo (este repo)

Mientras trabajás en este repositorio, podés ejecutar el script en la raíz:

```bash
yarn init:env
```
