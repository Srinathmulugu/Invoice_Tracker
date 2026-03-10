const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const getKey = () => {
  const secret = process.env.ENCRYPTION_KEY || '';
  if (secret.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

exports.encryptText = (value) => {
  if (value === undefined || value === null || value === '') return value;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
};

exports.decryptText = (value) => {
  if (!value) return value;
  try {
    const key = getKey();
    const data = Buffer.from(value, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // Backward compatibility for old plaintext records.
    return value;
  }
};
