/**
 * Centralized API configuration and fetch wrapper.
 * Safely reads Vite, CRA, or defaults to http://localhost:8000 without requiring @types/node.
 */
const getApiBaseUrl = (): string => {
  // Vite environment check
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  
  // Create React App / Webpack environment check
  const globalProcess = (globalThis as any).process;
  if (globalProcess?.env?.REACT_APP_API_URL) {
    return globalProcess.env.REACT_APP_API_URL;
  }

  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * Reusable helper for making API requests with JSON parsing and centralized error handling.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${path}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `HTTP error ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}