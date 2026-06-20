import "server-only";

import { createClient, db } from "@/lib/database/client";

export const supabase = db;
export { createClient };
