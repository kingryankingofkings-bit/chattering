import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().default("file:./data/chattering.db"),
  APP_ENCRYPTION_KEYS: z.string().min(1),
  APP_ENCRYPTION_ACTIVE_KEY: z.string().default("v1"),
  SESSION_SECRET: z.string().min(16),
  MEDIA_DIR: z.string().default("./data/media"),
  AI_TEXT_PROVIDER: z.string().default("mock"),
  AI_TEXT_MODEL: z.string().default("mock-roleplay-1"),
  AI_TEXT_API_KEY: z.string().optional().default(""),
  AI_TEXT_BASE_URL: z.string().optional().default("https://api.openai.com/v1"),
  AI_IMAGE_PROVIDER: z.string().default("mock"),
  AI_IMAGE_MODEL: z.string().default("mock-diffusion-1"),
  AI_IMAGE_API_KEY: z.string().optional().default(""),
  AI_IMAGE_BASE_URL: z.string().optional().default("https://api.openai.com/v1"),
  RATE_LIMIT_TRUST_PROXY: z.string().optional().default("false"),
  ALLOW_SIGNUPS: z.string().optional().default("true"),
  NODE_ENV: z.string().optional().default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Parsed, validated environment. Throws early with a readable message. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}. Copy .env.example to .env and fill in values.`);
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => env().NODE_ENV === "production";
