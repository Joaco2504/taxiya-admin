export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const TAXIYA_SCHEMA = "taxiya" as const;

export const BUCKET_PUBLIC = "taxiya_public" as const;
export const BUCKET_PRIVATE = "taxiya_private" as const;
