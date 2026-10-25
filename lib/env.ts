import "server-only";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  supabaseUrl: requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};
