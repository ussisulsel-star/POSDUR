import { StorageService } from './storageService';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface ApiRequestOptions extends RequestInit {
  authenticated?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { authenticated = true, headers: requestHeaders, ...requestOptions } = options;
  const headers = new Headers(requestHeaders);
  headers.set('Accept', 'application/json');

  if (requestOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (authenticated) {
    const token = StorageService.getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api/v1${path}`, {
    ...requestOptions,
    headers,
  });
  const responseText = await response.text();
  let payload: ApiEnvelope<T>;

  try {
    payload = JSON.parse(responseText) as ApiEnvelope<T>;
  } catch {
    throw new Error('Server mengirim respons yang tidak dapat dibaca.');
  }

  if (!response.ok) {
    if (response.status === 401 && authenticated && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pos:unauthorized'));
    }

    throw new ApiError(
      payload.message || payload.error || `Permintaan gagal (${response.status}).`,
      response.status
    );
  }

  if (!payload.success || payload.data === undefined) {
    throw new Error(payload.message || 'Respons API tidak berisi data yang valid.');
  }

  return payload.data;
}
