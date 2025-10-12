import Cookies from "universal-cookie";

const cookies = new Cookies();

/**
 * Set a cookie with the given key, value and duration
 * @param key - The cookie key
 * @param value - The cookie value
 * @param duration - Duration in seconds (default: 30 days)
 */
export const setCookie = (
  key: string,
  value: string,
  duration: number = 3600 * 24 * 30
) => {
  const expires = new Date();
  expires.setSeconds(expires.getSeconds() + duration);
  cookies.set(key, value, {
    path: "/",
    expires,
  });
};

/**
 * Get a cookie value by key
 * @param key - The cookie key
 * @returns The cookie value or undefined
 */
export const getCookie = (key: string): string | undefined => {
  return cookies.get(key);
};

/**
 * Remove a cookie by key
 * @param key - The cookie key
 */
export const removeCookie = (key: string) => {
  cookies.remove(key, { path: "/" });
};
