# Scripts / CLI

This repository publishes a small CLI via the package binary **`nestjs-cloudinary-community`**.

## `init` (environment bootstrap)

The `init` command helps you bootstrap Cloudinary environment variables by:

- writing the shipped **`.env.example`** template into your project root
- creating or merging **`.env`** with `CLOUDINARY_*` keys

### Basic usage

```bash
npx nestjs-cloudinary-community init
```

### Target a different directory

```bash
npx nestjs-cloudinary-community init --cwd ./apps/api
```

### Force merge / reset placeholders

If you already have `CLOUDINARY_*` keys and you want to reset them to placeholders before merging:

```bash
npx nestjs-cloudinary-community init --force --cwd ./apps/api
```

## Behavior when env files already exist

If **either** `.env` **or** `.env.template` exists, `init` **does not change any files** (it exits with code `0`).

To override the skip behavior, run again with **`--force`**.

## Logging

The CLI prints **one JSON object per line** (Pino-like shape: `level`, `time`, `msg`, plus extra fields).

- Filter verbosity via `LOG_LEVEL` (`trace`/`debug`/`info`/`warn`/`error`/`fatal`)
- Pretty-print:

```bash
npx nestjs-cloudinary-community init | npx pino-pretty
```

## Development shortcut (this repo)

When working inside this repository, you can run the init script in the repo root:

```bash
yarn init:env
```
