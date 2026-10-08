# UI Requirements & API Notes

Discrepancies between `docs/UI_GUIDE.md` / `docs/API.md` and the live dev server API responses, plus missing endpoint notes:

## 1. Authentication Endpoints and Payloads (Better Auth)
- **Base path discrepancy**: `docs/UI_GUIDE.md` lists `/auth/sign-in`, `/auth/sign-up`, etc. The live server routes Better Auth under `/api/auth` (e.g. `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-out`).
- **Error payload format**: `docs/UI_GUIDE.md` specifies that all errors use `{ error: { code: "...", message: "..." } }`. Better Auth authentication endpoints return `{ message: "...", code: "..." }` directly at the top level on 401/403 responses. The frontend auth client handles both structures.
- **Email credential sign-in**: Better Auth requires calling `client.signIn.email({ email, password })` which posts to `/api/auth/sign-in/email`.
