import "server-only";

import { supabase } from "@/lib/supabase/client";
import {
  METHODOLOGY_VERSION,
} from "@/lib/public-value";

export async function getClassificationMetadata() {
  const { data: meta } = await supabase
    .from("snapshot_metadata")
    .select("last_updated_at")
    .eq("id", 1)
    .single();

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    reviewedAt: meta?.last_updated_at ?? new Date().toISOString().split("T")[0],
  };
}