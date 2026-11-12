import { ApiError } from '../errors';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    throw new ApiError(400, `${field} harus berupa UUID yang valid.`);
  }
  return value;
}

export function requireUuid(value: unknown, field: string): string {
  const uuid = optionalUuid(value, field);
  if (!uuid) {
    throw new ApiError(400, `${field} wajib diisi.`);
  }
  return uuid;
}

export function requireString(
  value: unknown,
  field: string,
  options: { maxLength?: number } = {}
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, `${field} wajib diisi.`);
  }
  const result = value.trim();
  if (options.maxLength && result.length > options.maxLength) {
    throw new ApiError(
      400,
      `${field} maksimal ${options.maxLength} karakter.`
    );
  }
  return result;
}

export function optionalString(
  value: unknown,
  field: string,
  maxLength = 1000
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} harus berupa teks.`);
  }
  const result = value.trim();
  if (result === '') {
    return null;
  }
  if (result.length > maxLength) {
    throw new ApiError(400, `${field} maksimal ${maxLength} karakter.`);
  }
  return result;
}

export function parseMoney(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; fallback?: number } = {}
): number {
  if (value === undefined || value === null || value === '') {
    if (options.fallback !== undefined) {
      return options.fallback;
    }
    throw new ApiError(400, `${field} wajib diisi.`);
  }
  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new ApiError(400, `${field} harus berupa angka.`);
  }
  if (options.min !== undefined && result < options.min) {
    throw new ApiError(400, `${field} minimal ${options.min}.`);
  }
  if (options.max !== undefined && result > options.max) {
    throw new ApiError(400, `${field} maksimal ${options.max}.`);
  }
  return roundMoney(result);
}

export function parseInteger(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; fallback?: number } = {}
): number {
  if (value === undefined || value === null || value === '') {
    if (options.fallback !== undefined) {
      return options.fallback;
    }
    throw new ApiError(400, `${field} wajib diisi.`);
  }
  const result = Number(value);
  if (!Number.isInteger(result)) {
    throw new ApiError(400, `${field} harus berupa bilangan bulat.`);
  }
  if (options.min !== undefined && result < options.min) {
    throw new ApiError(400, `${field} minimal ${options.min}.`);
  }
  if (options.max !== undefined && result > options.max) {
    throw new ApiError(400, `${field} maksimal ${options.max}.`);
  }
  return result;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function readQueryString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
