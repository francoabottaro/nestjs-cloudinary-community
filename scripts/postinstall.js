'use strict';

const fs = require('fs');
const path = require('path');

const packageRoot = path.resolve(__dirname, '..');
const consumerRoot = process.env.INIT_CWD
  ? path.resolve(process.env.INIT_CWD)
  : process.cwd();

if (path.resolve(consumerRoot) === path.resolve(packageRoot)) {
  process.exit(0);
}

const templateCandidates = [
  path.join(packageRoot, '.env.example'),
  path.join(packageRoot, 'scripts', 'env.example.template'),
];
const template = templateCandidates.find((p) => fs.existsSync(p));
const targetExample = path.join(consumerRoot, '.env.example');
const targetEnv = path.join(consumerRoot, '.env');

if (!template) {
  process.exit(0);
}

if (!fs.existsSync(targetExample)) {
  fs.copyFileSync(template, targetExample);
  console.log(
    'nestjs-cloudinary-community: created .env.example. Run `npx nestjs-cloudinary-community init` to refresh and merge into .env.',
  );
}

if (!fs.existsSync(targetEnv)) {
  fs.copyFileSync(
    fs.existsSync(targetExample) ? targetExample : template,
    targetEnv,
  );
  console.log(
    'nestjs-cloudinary-community: created .env from .env.example. Fill in CLOUDINARY_* values.',
  );
}
