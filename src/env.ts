import { config } from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'production') {
  config();
}

const envSchema = z.object({
  // Do NOT validate PORT at startup; Cloud Run injects it.
  RETELL_SIGNING_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Environment validation failed:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

// Helper function to validate required env vars at runtime
export function requireEnvVars<T extends keyof typeof env>(vars: T[]): Required<Pick<typeof env, T>> {
  const missing = vars.filter(v => !env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  return env as Required<Pick<typeof env, T>>;
}