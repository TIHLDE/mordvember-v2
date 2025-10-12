import { getCookie } from "./cookie";
import { ACCESS_TOKEN, API_URL, TOKEN_HEADER_NAME } from "./constants";

interface IFetchOptions extends RequestInit {
  withAuth?: boolean;
}

/**
 * Custom fetch wrapper that handles authentication
 * @param url - The URL to fetch (can be relative or absolute)
 * @param options - Fetch options
 * @returns Promise with the response
 */
export async function IFetch<T = unknown>(
  url: string,
  options: IFetchOptions = {}
): Promise<T> {
  const { withAuth = true, headers = {}, ...rest } = options;

  // Build full URL if relative
  const fullUrl = url.startsWith("http") ? url : `${API_URL}${url}`;

  // Add authentication header if needed
  const fetchHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (withAuth) {
    const token = getCookie(ACCESS_TOKEN);
    if (token) {
      fetchHeaders[TOKEN_HEADER_NAME] = token;
    }
  }

  const response = await fetch(fullUrl, {
    ...rest,
    headers: fetchHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  // Return empty object for 204 No Content responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
