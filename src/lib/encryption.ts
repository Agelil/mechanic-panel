/**
 * AES Encryption for PII fields (ФЗ-152 РФ)
 * Encrypts: ФИО, телефон, VIN
 */
import CryptoJS from "crypto-js";
import { getEncryptionKey, getAllEncryptionKeys } from "./db-config";

const PREFIX = "enc:v1:";

export function encrypt(value: string): string {
  if (!value || value.startsWith(PREFIX)) return value;
  const key = getEncryptionKey();
  try {
    const encrypted = CryptoJS.AES.encrypt(value, key).toString();
    return PREFIX + encrypted;
  } catch {
    return value;
  }
}

/** Placeholder shown when decryption fails (key mismatch) */
const DECRYPT_FAIL_PLACEHOLDER = "🔒 Зашифровано";

export function decrypt(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value; // plain text fallback
  
  // Try all known keys: current key + hardcoded fallbacks
  const keys = getDecryptionKeys();
  
  for (const key of keys) {
    try {
      const payload = value.slice(PREFIX.length);
      const bytes = CryptoJS.AES.decrypt(payload, key);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result) return result;
    } catch { /* try next key */ }
  }
  
  // All keys failed — show clean placeholder instead of raw encrypted string
  return DECRYPT_FAIL_PLACEHOLDER;
}

/** Encrypt all PII fields in an object */
export function encryptPII<T extends { name?: string; phone?: string; car_vin?: string | null }>(obj: T): T {
  return {
    ...obj,
    ...(obj.name !== undefined ? { name: encrypt(obj.name) } : {}),
    ...(obj.phone !== undefined ? { phone: encrypt(obj.phone) } : {}),
    ...(obj.car_vin !== undefined ? { car_vin: obj.car_vin ? encrypt(obj.car_vin) : null } : {}),
  };
}

/** Decrypt all PII fields in an object */
export function decryptPII<T extends { name?: string; phone?: string; car_vin?: string | null }>(obj: T): T {
  return {
    ...obj,
    ...(obj.name !== undefined ? { name: decrypt(obj.name) } : {}),
    ...(obj.phone !== undefined ? { phone: decrypt(obj.phone) } : {}),
    ...(obj.car_vin !== undefined ? { car_vin: obj.car_vin ? decrypt(obj.car_vin) : null } : {}),
  };
}

/** Mask phone for display (partially hide) */
export function maskPhone(phone: string): string {
  const p = decrypt(phone);
  if (p.length < 6) return p;
  return p.slice(0, 3) + "***" + p.slice(-2);
}
