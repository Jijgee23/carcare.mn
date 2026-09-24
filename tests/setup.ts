// Loaded before every test file via `--import` (see `npm test`).
// `lib/env.ts` validates at import time, so any test that transitively imports
// it needs these set. Placeholders only — unit tests never reach a database.
process.env.DATABASE_URL ??= "postgresql://unused/unused";
process.env.SESSION_SECRET ??= "unit-test-placeholder-secret-value-not-real-00";
