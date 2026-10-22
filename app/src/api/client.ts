import { Platform } from 'react-native';

/**
 * The one way the app talks to David's server.
 *
 * Signed in, every call carries the Supabase access token and the hotel the
 * person has chosen. In demo mode there is neither: the demo server answers
 * for its one hotel.
 */

const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Session = { getToken: () => Promise<string | null>; hotelId: () => string | null; viewAs?: () => string | null };
let session: Session = { getToken: async () => null, hotelId: () => null };
export function setApiSession(s: Session) {
  session = s;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await session.getToken();
  const hotel = session.hotelId();
  const role = session.viewAs?.() ?? null;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(hotel ? { 'x-hotel-id': hotel } : {}),
        ...(role ? { 'x-view-as': role } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("Can't reach David. Check your connection and try again.", 0);
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new ApiError(data?.error ?? 'Something went wrong.', res.status);
  return data as T;
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const put = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });
