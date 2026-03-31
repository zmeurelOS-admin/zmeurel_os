/**
 * Next.js rulează doar `src/middleware.ts`. Logica e în `./proxy`.
 * Fără acest fișier, `x-zmeurel-tenant-id` / `x-zmeurel-user-id` nu ajung la layout / RSC.
 */
export { proxy as middleware, config } from './proxy'
