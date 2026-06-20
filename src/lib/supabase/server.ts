import "server-only";

import { createClient } from "@/lib/database/client";

export const supabaseAdmin = createClient();
