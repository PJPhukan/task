import { z } from 'zod';

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1).optional(),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    AUTH_MODE: z.enum(['dev', 'session']).default('dev'),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    NEXT_PUBLIC_API_URL: z.string().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  })
  .refine((data) => data.DATABASE_URL || data.TEST_DATABASE_URL, {
    message: 'Either DATABASE_URL or TEST_DATABASE_URL is required',
    path: ['DATABASE_URL'],
  })
  .refine((data) => {
    if (data.NODE_ENV === 'production' && data.AUTH_MODE === 'dev') {
      return false;
    }
    return true;
  }, {
    message: 'AUTH_MODE=dev is not allowed in production',
    path: ['AUTH_MODE'],
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const env = envSchema.parse(process.env);
  cached = env;
  return env;
}
