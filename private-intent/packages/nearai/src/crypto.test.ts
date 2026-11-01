import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import {
  EPHEMERAL_PUBKEY_BYTES,
  NONCE_BYTES,
  TAG_BYTES,
  decryptHexString,
  ed25519PublicToX25519,
  encryptStringHex,
  generateClientKeyPair,
  v2Decrypt,
  v2Encrypt,
} from './crypto.js';

describe('v2 encryption', () => {
  it('round trips to a key derived from an Ed25519 identity', () => {
    const model = generateClientKeyPair();
    const modelX = ed25519PublicToX25519(model.publicKeyHex);
    const hex = encryptStringHex('swap 5 usdc to near', modelX);
    expect(decryptHexString(hex, model.x25519Secret)).toBe('swap 5 usdc to near');
  });

  it('uses the documented wire layout', () => {
    const model = generateClientKeyPair();
    const ct = v2Encrypt(new Uint8Array([1, 2, 3]), ed25519PublicToX25519(model.publicKeyHex));
    expect(ct.length).toBe(EPHEMERAL_PUBKEY_BYTES + NONCE_BYTES + 3 + TAG_BYTES);
  });

  it('is non deterministic across calls', () => {
    const model = generateClientKeyPair();
    const x = ed25519PublicToX25519(model.publicKeyHex);
    expect(encryptStringHex('a', x)).not.toBe(encryptStringHex('a', x));
  });

  it('fails on a flipped byte and on the wrong key', () => {
    const model = generateClientKeyPair();
    const other = generateClientKeyPair();
    const ct = v2Encrypt(new Uint8Array([9, 9, 9, 9]), ed25519PublicToX25519(model.publicKeyHex));
    const tampered = new Uint8Array(ct);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0x01;
    expect(() => v2Decrypt(tampered, model.x25519Secret)).toThrow();
    expect(() => v2Decrypt(ct, other.x25519Secret)).toThrow();
    expect(() => v2Decrypt(ct.subarray(0, 40), model.x25519Secret)).toThrow(/too short/);
  });

  it('derives the X25519 key from the same seed the public key comes from', () => {
    const kp = generateClientKeyPair();
    expect(bytesToHex(ed25519.getPublicKey(kp.secretKey))).toBe(kp.publicKeyHex);
    expect(bytesToHex(x25519.getPublicKey(kp.x25519Secret))).toBe(bytesToHex(ed25519PublicToX25519(kp.publicKeyHex)));
    expect(() => ed25519PublicToX25519(bytesToHex(hexToBytes('00')))).toThrow(/32 bytes/);
  });
});
