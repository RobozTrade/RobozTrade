/**
 * Encrypt sensitive data using AES-GCM
 * @param text - The text to encrypt
 * @param key - The encryption key (should be from ENCRYPTION_KEY env var)
 * @param iterations - Number of PBKDF2 iterations (default: 100000, configurable via env)
 */
export async function encrypt(text: string, key: string, iterations = 100000): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    data
  );

  // Combine salt + iv + encrypted data
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypt sensitive data using AES-GCM
 * @param encryptedText - The encrypted text to decrypt
 * @param key - The encryption key (should be from ENCRYPTION_KEY env var)
 * @param iterations - Number of PBKDF2 iterations (default: 100000, must match encryption)
 */
export async function decrypt(encryptedText: string, key: string, iterations = 100000): Promise<string> {
  const encoder = new TextEncoder();
  const data = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

  // Extract salt, iv, and encrypted data
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const encrypted = data.slice(28);

  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

