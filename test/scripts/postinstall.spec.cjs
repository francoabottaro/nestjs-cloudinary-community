'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '../..');
const postinstallScript = path.join(repoRoot, 'scripts', 'postinstall.js');

describe('scripts/postinstall.js', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cld-post-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('copies .env.example into INIT_CWD when missing (does not create .env)', () => {
    const r = spawnSync(process.execPath, [postinstallScript], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, INIT_CWD: tmpDir },
    });
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, '.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.env'))).toBe(false);
    const example = fs.readFileSync(path.join(tmpDir, '.env.example'), 'utf8');
    expect(example).toContain('CLOUDINARY_CLOUD_NAME');
  });

  it('exits 0 when INIT_CWD equals package root (self-install / dev install)', () => {
    const r = spawnSync(process.execPath, [postinstallScript], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, INIT_CWD: repoRoot },
    });
    expect(r.status).toBe(0);
  });
});
