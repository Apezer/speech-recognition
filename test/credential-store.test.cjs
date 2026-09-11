const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { CredentialStore } = require('../electron/credential-store.cjs');

test('stores only encrypted API key bytes and can clear them', async t => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vico-credential-test-'));
  t.after(() => fsp.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'key.bin');
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: value => Buffer.from(`encrypted:${Buffer.from(value).toString('base64')}`),
    decryptString: value => Buffer.from(value.toString().slice(10), 'base64').toString()
  };
  const store = new CredentialStore(file, safeStorage);
  assert.equal(store.info().configured, false);
  assert.equal(store.save('abcd-very-secret-wxyz').masked, 'abcd••••wxyz');
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /very-secret/);
  assert.equal(store.get(), 'abcd-very-secret-wxyz');
  store.clear();
  assert.equal(fs.existsSync(file), false);
});
