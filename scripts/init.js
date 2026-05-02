#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Real `pino` loads only when `NESTJS_CLOUDINARY_INIT_PINO=1` (e.g. working on this
 * env init script in the repo: `yarn init:env` / `npm run init:env`). Otherwise a small JSON-line
 * logger is used so consumers and `npx` never need the pino package.
 */
function createPinoCompatibleLogger() {
  const base = { name: 'nestjs-cloudinary-community' };
  const levelRank = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
  };
  const minRank =
    levelRank[(process.env.LOG_LEVEL || 'info').toLowerCase()] ??
    levelRank.info;

  function emit(levelNum, obj, msg) {
    if (levelNum < minRank) return;
    const line = JSON.stringify({
      level: levelNum,
      time: Date.now(),
      ...base,
      ...obj,
      msg,
    });
    console.log(line);
  }

  return {
    info(obj, msg) {
      emit(30, obj, msg);
    },
    warn(obj, msg) {
      emit(40, obj, msg);
    },
    error(obj, msg) {
      emit(50, obj, msg);
    },
  };
}

function createLog() {
  const usePino = process.env.NESTJS_CLOUDINARY_INIT_PINO === '1';
  if (usePino) {
    try {
      return require('pino')({
        level: process.env.LOG_LEVEL || 'info',
        base: { name: 'nestjs-cloudinary-community' },
      });
    } catch {
      // pino is devDependency; if missing, fall back without failing the CLI
    }
  }
  return createPinoCompatibleLogger();
}

const log = createLog();

const KEYS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const PLACEHOLDERS = {
  CLOUDINARY_CLOUD_NAME: 'your_cloud_name',
  CLOUDINARY_API_KEY: 'your_api_key',
  CLOUDINARY_API_SECRET: 'your_api_secret',
};

/**
 * Canonical env template lives next to this script so `npx`/installed packages
 * always ship it under `scripts/` (root `.env.example` can be missing in some installs).
 */
function exampleTemplatePaths() {
  return [
    path.join(__dirname, 'env.example.template'),
    path.join(__dirname, '..', '.env.example'),
  ];
}

function loadExampleTemplate() {
  for (const p of exampleTemplatePaths()) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8');
    }
  }
  return `# Provided by the unofficial nestjs-cloudinary-community module (not affiliated with Cloudinary Ltd.).
# Cloudinary® is a registered trademark of Cloudinary Ltd., used here only nominatively.
#
# Replace the placeholder values below with your real credentials from:
# Dashboard → Programmable Media → API Keys → "Cloud name", API Key, and API Secret
# (use the Programmable Media API key — not an OAuth client id).


CLOUDINARY_CLOUD_NAME=${PLACEHOLDERS.CLOUDINARY_CLOUD_NAME}
CLOUDINARY_API_KEY=${PLACEHOLDERS.CLOUDINARY_API_KEY}
CLOUDINARY_API_SECRET=${PLACEHOLDERS.CLOUDINARY_API_SECRET}

# Optional: default upload folder for uploadOne/uploadMany when folder arg is omitted (maps to CloudinaryModuleOptions.folder_root)
# CLOUDINARY_FOLDER_ROOT=my-app

# Optional: max files per uploadMany / replaceMany batch (positive integer)
# CLOUDINARY_MAX_UPLOAD_FILES=10
`;
}

function parseArgs(argv) {
  const out = { command: null, force: false, cwd: process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'init') out.command = 'init';
    else if (a === '--force') out.force = true;
    else if (a === '--cwd') {
      i++;
      if (argv[i]) out.cwd = path.resolve(argv[i]);
    }
  }
  return out;
}

function parseCloudinaryValues(content) {
  const map = {};
  for (const line of content.split(/\r?\n/)) {
    for (const key of KEYS) {
      if (line.startsWith(`${key}=`)) {
        map[key] = line.slice(key.length + 1);
        break;
      }
    }
  }
  return map;
}

function stripCloudinaryKeyLines(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => {
      for (const key of KEYS) {
        if (line.startsWith(`${key}=`)) return false;
      }
      return true;
    })
    .join('\n')
    .replace(/\n+$/, '');
}

function cloudinaryBlockFromExample(exampleContent, saved, force) {
  const lines = exampleContent.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    let replaced = false;
    for (const key of KEYS) {
      if (line.startsWith(`${key}=`)) {
        let val;
        if (force) {
          val = PLACEHOLDERS[key];
        } else if (Object.prototype.hasOwnProperty.call(saved, key)) {
          val = saved[key];
        } else {
          val = line.slice(key.length + 1);
        }
        out.push(`${key}=${val}`);
        replaced = true;
        break;
      }
    }
    if (!replaced) out.push(line);
  }
  return out.join('\n').trimEnd() + '\n';
}

function mergeEnvWithExample(existingContent, exampleContent, force) {
  const saved = parseCloudinaryValues(existingContent);
  const block = cloudinaryBlockFromExample(exampleContent, saved, force);
  const stripped = stripCloudinaryKeyLines(existingContent);
  if (!stripped.trim()) return block;
  return `${stripped.trimEnd()}\n\n${block}`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.command !== 'init') {
    log.error(
      {
        event: 'cli_invalid_usage',
        usage: 'nestjs-cloudinary-community init [--force] [--cwd <path>]',
      },
      'invalid or missing subcommand',
    );
    process.exit(1);
  }

  const cwd = args.cwd;
  const envPath = path.join(cwd, '.env');
  const envTemplatePath = path.join(cwd, '.env.template');

  if (
    !args.force &&
    (fs.existsSync(envPath) || fs.existsSync(envTemplatePath))
  ) {
    log.warn(
      {
        event: 'init_skipped',
        reason: 'existing_env_files',
        envPath,
        envTemplatePath,
        envExists: fs.existsSync(envPath),
        envTemplateExists: fs.existsSync(envTemplatePath),
        cloudinaryPlaceholders: { ...PLACEHOLDERS },
        cloudinaryEnvLines: KEYS.map((key) => `${key}=${PLACEHOLDERS[key]}`),
      },
      'Init was skipped — .env and/or .env.template already exists; add cloudinaryPlaceholders if credentials are missing',
    );
    process.exit(0);
  }

  fs.mkdirSync(cwd, { recursive: true });

  const exampleContent = loadExampleTemplate();
  const examplePath = path.join(cwd, '.env.example');
  fs.writeFileSync(examplePath, exampleContent, 'utf8');
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, exampleContent, 'utf8');
  } else {
    const content = fs.readFileSync(envPath, 'utf8');
    fs.writeFileSync(
      envPath,
      mergeEnvWithExample(content, exampleContent, args.force),
      'utf8',
    );
  }

  log.info(
    {
      event: 'init_wrote',
      examplePath: path.relative(process.cwd(), examplePath),
      envPath: path.relative(process.cwd(), envPath),
      keys: KEYS,
    },
    'wrote .env.example and .env; replace placeholder values for Cloudinary keys',
  );
}

module.exports = {
  KEYS,
  PLACEHOLDERS,
  parseArgs,
  parseCloudinaryValues,
  stripCloudinaryKeyLines,
  cloudinaryBlockFromExample,
  mergeEnvWithExample,
  loadExampleTemplate,
};

if (require.main === module) {
  main();
}
