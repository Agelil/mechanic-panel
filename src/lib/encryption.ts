/**
 * AES Encryption for PII fields (ФЗ-152 РФ)
 * Encrypts: ФИО, телефон, VIN
 */
import CryptoJS from "crypto-js";
import { getEncryptionKey } from "./db-config";

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

export function decrypt(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value; // plain text fallback
  const key = getEncryptionKey();
  try {
    const payload = value.slice(PREFIX.length);
    const bytes = CryptoJS.AES.decrypt(payload, key);
    return bytes.toString(CryptoJS.enc.Utf8) || value;
  } catch {
    return value;
  }
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
