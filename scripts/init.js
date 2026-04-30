#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

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
#
# Never commit a file named .env with real secrets to version control.

CLOUDINARY_CLOUD_NAME=${PLACEHOLDERS.CLOUDINARY_CLOUD_NAME}
CLOUDINARY_API_KEY=${PLACEHOLDERS.CLOUDINARY_API_KEY}
CLOUDINARY_API_SECRET=${PLACEHOLDERS.CLOUDINARY_API_SECRET}

# Optional: default upload folder for uploadOne/uploadMany when folder arg is omitted (maps to CloudinaryModuleOptions.folder_root)
# CLOUDINARY_FOLDER_ROOT=my-app

# Optional: max files per uploadMany/replaceMany call (positive integer; maps to CloudinaryModuleOptions.max_upload_files)
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
    console.error(
      'Usage: nestjs-cloudinary-community init [--force] [--cwd <path>]',
    );
    process.exit(1);
  }

  const cwd = args.cwd;
  fs.mkdirSync(cwd, { recursive: true });

  const exampleContent = loadExampleTemplate();
  const examplePath = path.join(cwd, '.env.example');
  fs.writeFileSync(examplePath, exampleContent, 'utf8');

  const envPath = path.join(cwd, '.env');
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

  console.log(
    `nestjs-cloudinary-community: wrote ${path.relative(process.cwd(), examplePath)} and ${path.relative(process.cwd(), envPath)}. Replace empty values or placeholders for: ${KEYS.join(', ')}.`,
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
