'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const init = require('../../scripts/init.js');

describe('scripts/init.js', () => {
  describe('parseArgs', () => {
    it('parses init, --force, and --cwd', () => {
      const cwd = path.resolve('/tmp/cloudinary-sdk-test-cwd');
      const out = init.parseArgs([
        'node',
        'init.js',
        'init',
        '--force',
        '--cwd',
        cwd,
      ]);
      expect(out).toEqual({
        command: 'init',
        force: true,
        cwd,
      });
    });

    it('defaults cwd to process.cwd() when omitted', () => {
      const out = init.parseArgs(['node', 'init.js', 'init']);
      expect(out.command).toBe('init');
      expect(out.force).toBe(false);
      expect(out.cwd).toBe(process.cwd());
    });
  });

  describe('parseCloudinaryValues', () => {
    it('extracts CLOUDINARY_* assignments', () => {
      const body = `OTHER=x
CLOUDINARY_CLOUD_NAME=mycloud
CLOUDINARY_API_KEY=key1
CLOUDINARY_API_SECRET=sec1
`;
      expect(init.parseCloudinaryValues(body)).toEqual({
        CLOUDINARY_CLOUD_NAME: 'mycloud',
        CLOUDINARY_API_KEY: 'key1',
        CLOUDINARY_API_SECRET: 'sec1',
      });
    });
  });

  describe('mergeEnvWithExample', () => {
    const example = `# c
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
`;

    it('preserves existing values when not forced', () => {
      const existing = `FOO=bar
CLOUDINARY_CLOUD_NAME=keep_me
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
`;
      const merged = init.mergeEnvWithExample(existing, example, false);
      expect(merged).toContain('FOO=bar');
      expect(merged).toContain('CLOUDINARY_CLOUD_NAME=keep_me');
    });

    it('overwrites CLOUDINARY_* with placeholders when forced', () => {
      const existing = `CLOUDINARY_CLOUD_NAME=keep_me
CLOUDINARY_API_KEY=old
CLOUDINARY_API_SECRET=old2
`;
      const merged = init.mergeEnvWithExample(existing, example, true);
      expect(merged).toContain(
        `CLOUDINARY_CLOUD_NAME=${init.PLACEHOLDERS.CLOUDINARY_CLOUD_NAME}`,
      );
      expect(merged).toContain(
        `CLOUDINARY_API_KEY=${init.PLACEHOLDERS.CLOUDINARY_API_KEY}`,
      );
    });
  });

  describe('CLI (spawn)', () => {
    let tmpDir;
    const initScript = path.join(__dirname, '../../scripts/init.js');

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cld-init-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writes .env and .env.example matching repo template', () => {
      const r = spawnSync(
        process.execPath,
        [initScript, 'init', '--cwd', tmpDir],
        { encoding: 'utf8' },
      );
      expect(r.status).toBe(0);
      expect(fs.existsSync(path.join(tmpDir, '.env.example'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.env'))).toBe(true);
      const ex = fs.readFileSync(path.join(tmpDir, '.env.example'), 'utf8');
      expect(ex).toContain('CLOUDINARY_CLOUD_NAME');
      expect(fs.readFileSync(path.join(tmpDir, '.env'), 'utf8')).toBe(ex);
    });

    it('exits 1 without init subcommand', () => {
      const r = spawnSync(process.execPath, [initScript], { encoding: 'utf8' });
      expect(r.status).toBe(1);
    });
  });
});
