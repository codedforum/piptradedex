import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { invert, mod } from '@noble/curves/abstract/modular.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export const HKDF_INFO = utf8ToBytes('ed25519_encryption');
export const EPHEMERAL_PUBKEY_BYTES = 32;
export const NONCE_BYTES = 24;
export const TAG_BYTES = 16;

export interface ClientKeyPair {
  /** Ed25519 public key, hex. Sent as X-Client-Pub-Key. */
  publicKeyHex: string;
  /** Ed25519 secret seed, 32 bytes. Never leaves the client. */
  secretKey: Uint8Array;
  /** X25519 secret derived from the Ed25519 seed, used to decrypt replies. */
  x25519Secret: Uint8Array;
}

const P = 2n ** 255n - 19n;

function toLittleEndian(n: bigint): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number((n >> BigInt(8 * i)) & 0xffn);
  return out;
}

/** Ed25519 seed to X25519 secret: SHA-512 of the seed, first 32 bytes, clamped. */
export function ed25519SecretToX25519(seed: Uint8Array): Uint8Array {
  if (seed.length !== 32) throw new Error('Ed25519 seed must be 32 bytes');
  const h = sha512(seed).slice(0, 32);
  h[0] = (h[0] ?? 0) & 248;
  h[31] = ((h[31] ?? 0) & 127) | 64;
  return h;
}

export function generateClientKeyPair(): ClientKeyPair {
  const secretKey = ed25519.utils.randomSecretKey();
  return {
    publicKeyHex: bytesToHex(ed25519.getPublicKey(secretKey)),
    secretKey,
    x25519Secret: ed25519SecretToX25519(secretKey),
  };
}

/** Ed25519 public key to X25519 via the birational map u = (1 + y) / (1 - y) mod p. */
export function ed25519PublicToX25519(ed25519PublicHex: string): Uint8Array {
  const pub = hexToBytes(ed25519PublicHex);
  if (pub.length !== 32) throw new Error('Ed25519 public key must be 32 bytes');
  const { y } = ed25519.Point.fromBytes(pub).toAffine();
  const u = mod((1n + y) * invert(1n - y, P), P);
  return toLittleEndian(u);
}

function deriveKey(shared: Uint8Array): Uint8Array {
  return hkdf(sha256, shared, undefined, HKDF_INFO, 32);
}

/** Encryption version 2: [ephemeral X25519 pubkey 32][nonce 24][ciphertext and tag]. */
export function v2Encrypt(plaintext: Uint8Array, recipientX25519Public: Uint8Array): Uint8Array {
  const ephemeralSecret = x25519.utils.randomSecretKey();
  const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);
  const shared = x25519.getSharedSecret(ephemeralSecret, recipientX25519Public);
  const key = deriveKey(shared);
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(plaintext);
  const out = new Uint8Array(EPHEMERAL_PUBKEY_BYTES + NONCE_BYTES + ciphertext.length);
  out.set(ephemeralPublic, 0);
  out.set(nonce, EPHEMERAL_PUBKEY_BYTES);
  out.set(ciphertext, EPHEMERAL_PUBKEY_BYTES + NONCE_BYTES);
  return out;
}

export function v2Decrypt(data: Uint8Array, recipientX25519Secret: Uint8Array): Uint8Array {
  if (data.length < EPHEMERAL_PUBKEY_BYTES + NONCE_BYTES + TAG_BYTES) {
    throw new Error('encrypted payload too short');
  }
  const ephemeralPublic = data.subarray(0, EPHEMERAL_PUBKEY_BYTES);
  const nonce = data.subarray(EPHEMERAL_PUBKEY_BYTES, EPHEMERAL_PUBKEY_BYTES + NONCE_BYTES);
  const ciphertext = data.subarray(EPHEMERAL_PUBKEY_BYTES + NONCE_BYTES);
  const shared = x25519.getSharedSecret(recipientX25519Secret, ephemeralPublic);
  return xchacha20poly1305(deriveKey(shared), nonce).decrypt(ciphertext);
}

export function encryptStringHex(text: string, recipientX25519Public: Uint8Array): string {
  return bytesToHex(v2Encrypt(utf8ToBytes(text), recipientX25519Public));
}

export function decryptHexString(hex: string, recipientX25519Secret: Uint8Array): string {
  return new TextDecoder().decode(v2Decrypt(hexToBytes(hex), recipientX25519Secret));
}

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

export function randomNonceHex(): string {
  return bytesToHex(randomBytes(32));
}
