/**
 * AES-256-GCM encryption/decryption utility.
 * Requires ENCRYPTION_SECRET env var (64-char hex = 32 bytes).
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;

function getKey() {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 64) {
    const err = new Error('ENCRYPTION_SECRET env variable must be a 64-character hex string (32 bytes)');
    err.statusCode = 500;
    err.publicMessage = 'Server encryption is not configured. Contact the administrator.';
    throw err;
  }
  return Buffer.from(secret.slice(0, 64), 'hex');
}

/**
 * Encrypt plaintext string.
 * @param {string} plaintext
 * @returns {{ iv: string, tag: string, ciphertext: string }} all hex-encoded
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

/**
 * Decrypt a payload produced by encrypt().
 * @param {{ iv: string, tag: string, ciphertext: string }} payload
 * @returns {string} decrypted plaintext
 */
function decrypt({ iv, tag, ciphertext }) {
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
