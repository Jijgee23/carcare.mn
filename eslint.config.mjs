import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import requireOrderTimeBookingDualwrite from "./eslint-rules/require-order-time-booking-dualwrite.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // D-068 (COWORK.md): guard against ServiceOrder scheduling-field writes
  // that skip the OrderTimeBooking dual-write — this exact bug shipped
  // twice already (2026-09-10).
  {
    files: ["app/_actions/orders.ts", "app/api/v1/orders/**/*.ts"],
    plugins: {
      local: { rules: { "require-order-time-booking-dualwrite": requireOrderTimeBookingDualwrite } },
    },
    rules: {
      "local/require-order-time-booking-dualwrite": "error",
    },
  },
]);

export default eslintConfig;
