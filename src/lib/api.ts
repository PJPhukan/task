const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function fetcher(url: string, options?: Record<string, unknown>) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options?.headers && typeof options.headers === 'object') {
    Object.assign(headers, options.headers);
  }

  const fetchOptions: Record<string, unknown> = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_URL}${url}`, fetchOptions);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export default fetcher;
