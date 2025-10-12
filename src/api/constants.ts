// Authentication constants
export const ACCESS_TOKEN = "MORDVEMBER-AccessToken";
export const TOKEN_HEADER_NAME = "X-CSRF-Token";

// API URL from environment variable (defaults to local API routes)
export const API_URL = process.env.NEXT_PUBLIC_TIHLDE_API_URL || "/api";
