import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

export function cookies() {
  return {
    get(name: string) {
      const value = getCookie(name);
      return value === undefined ? undefined : { value };
    },
    set: setCookie,
    delete(name: string) {
      deleteCookie(name, { path: "/" });
    },
  };
}
