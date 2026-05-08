# Tests (unit, scripts, e2e)

Este repo usa Jest para unit tests y además ejecuta **tests de scripts** y **tests e2e**.

## Instalar

```bash
yarn install
```

## Unit tests (incluye tests de scripts)

```bash
yarn test
```

Para correr **solo** los tests de scripts:

```bash
yarn test:scripts
```

## Tests e2e

```bash
yarn test:e2e
```

### Entorno

Algunas pruebas pueden requerir credenciales de Cloudinary si pegan contra el SDK real. Asegurate de tener:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Fallos comunes

- Faltan variables `CLOUDINARY_*` (cuando corrés tests estilo integración)
- Errores de build TypeScript (probá `yarn lint` / `yarn build`)
