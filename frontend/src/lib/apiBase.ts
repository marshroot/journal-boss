/**
 * Base URL of the backend API.
 * - Docker / production: empty string, the browser calls /api and /hubs on the same origin (nginx proxies them).
 * - Local development: empty string too; vite.config.ts proxies /api and /hubs to the backend on localhost:5000.
 * Set VITE_API_BASE_URL only when the backend lives on another origin.
 */
export const API_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
