const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

async function apiFetch<T = unknown>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const res = await fetch(url, {
    ...fetchOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }

  return data;
}

export const api = {
  get: <T = unknown>(endpoint: string, params?: Record<string, string>) =>
    apiFetch<T>(endpoint, { method: 'GET', params }),

  post: <T = unknown>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),

  put: <T = unknown>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),

  delete: <T = unknown>(endpoint: string) =>
    apiFetch<T>(endpoint, { method: 'DELETE' }),

  upload: async <T = unknown>(endpoint: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  download: async (endpoint: string, params?: Record<string, string>) => {
    let url = `${API_URL}${endpoint}`;
    if (params) url += `?${new URLSearchParams(params).toString()}`;

    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  },
};
