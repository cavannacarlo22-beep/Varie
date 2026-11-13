const enc = new TextEncoder();

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomSalt(len = 16): string {
  return toHex(crypto.getRandomValues(new Uint8Array(len)));
}

/** PBKDF2-SHA256 hash of a PIN, for the local app lock. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 150_000 },
    key,
    256,
  );
  return toHex(bits);
}

const MAGIC = enc.encode('PETALOENC1');

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250_000 },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(data: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(MAGIC.length + salt.length + iv.length + ct.length);
  out.set(MAGIC, 0);
  out.set(salt, MAGIC.length);
  out.set(iv, MAGIC.length + 16);
  out.set(ct, MAGIC.length + 28);
  return out;
}

export function isEncrypted(data: Uint8Array): boolean {
  if (data.length < MAGIC.length) return false;
  return MAGIC.every((b, i) => data[i] === b);
}

export async function decryptBytes(data: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = data.slice(MAGIC.length, MAGIC.length + 16);
  const iv = data.slice(MAGIC.length + 16, MAGIC.length + 28);
  const ct = data.slice(MAGIC.length + 28);
  const key = await deriveKey(password, salt);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
  } catch {
    throw new Error('Password errata o file danneggiato');
  }
}
