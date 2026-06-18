import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_SIZE = 1000;

function analysisLevelFor(source: string | undefined, explicitLevel?: number) {
  if (explicitLevel === 1 || explicitLevel === 2 || explicitLevel === 3) {
    return explicitLevel;
  }
  return source === "rule" ? 1 : 2;
}

async function fetchAllRows(table: string, select: string, orderColumn = "id") {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderColumn)
      .range(from, to);
    if (error) throw error;
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function syncProposalClassifications() {
  console.log("Syncing proposal classifications...");
  const filePath = join(__dirname, "../.data/public-value-classifications.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);

  const methodologyVersion = data.methodologyVersion as string;
  const entries = Object.entries(data.classifications) as Array<[string, {
    category: string;
    confidence: string;
    justification: string;
    source?: string;
    analysisLevel?: number;
  }]>;

  console.log(`  Found ${entries.length} proposal classifications`);

  const existing = await fetchAllRows(
    "proposal_classifications",
    "proposal_id, analysis_level",
    "proposal_id",
  );
  const existingLevels = new Map(
    existing.map((row: Record<string, unknown>) => [
      row.proposal_id as string,
      Number(row.analysis_level ?? 1),
    ]),
  );

  const rows = entries.map(([proposalId, cls]) => {
    const source = cls.source ?? "reviewed";
    const analysisLevel = analysisLevelFor(source, cls.analysisLevel);
    return {
      proposal_id: proposalId,
      category: cls.category,
      confidence: cls.confidence,
      justification: cls.justification,
      source,
      analysis_level: analysisLevel,
      methodology_version: methodologyVersion,
    };
  }).filter((row) => (existingLevels.get(row.proposal_id) ?? 0) <= row.analysis_level);

  const { error } = await supabase.from("proposal_classifications").upsert(rows, {
    onConflict: "proposal_id",
  });

  if (error) {
    console.error("  Error syncing proposal classifications:", error.message);
  } else {
    console.log(`  Synced ${rows.length} proposal classifications`);
  }
}

async function syncVoteClassifications() {
  console.log("Syncing vote classifications...");
  const filePath = join(__dirname, "../.data/public-vote-classifications.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);

  const methodologyVersion = data.methodologyVersion as string;
  const entries = Object.entries(data.classifications) as Array<[string, {
    classification: string;
    severity: string;
    publicInterestVote: string;
    confidence: number;
    reason: string;
    source?: string;
    analysisLevel?: number;
    reviewedManually?: boolean;
  }]>;

  console.log(`  Found ${entries.length} vote classifications`);

  const existing = await fetchAllRows("vote_classifications", "vote_id, analysis_level");
  const existingLevels = new Map(
    existing.map((row: Record<string, unknown>) => [
      row.vote_id as string,
      Number(row.analysis_level ?? 1),
    ]),
  );

  for (const [compositeKey, cls] of entries) {
    const parts = compositeKey.split("-");
    const voteId = parts[0];
    const sessionNumber = parts.length > 1 ? parts.slice(1).join("-") : null;
    const source = cls.source ?? "reviewed";
    const analysisLevel = analysisLevelFor(source, cls.analysisLevel);
    if ((existingLevels.get(voteId) ?? 0) > analysisLevel) continue;

    const { error } = await supabase.from("vote_classifications").upsert({
      vote_id: voteId,
      session_number: sessionNumber,
      classification: cls.classification,
      severity: cls.severity,
      public_interest_vote: cls.publicInterestVote,
      confidence: cls.confidence,
      reason: cls.reason,
      source,
      analysis_level: analysisLevel,
      reviewed_manually: cls.reviewedManually ?? true,
      methodology_version: methodologyVersion,
    }, {
      onConflict: "vote_id,session_number",
    });

    if (error) {
      console.error(`  Error syncing vote classification ${compositeKey}:`, error.message);
    }
  }

  console.log(`  Synced ${entries.length} vote classifications`);
}

async function updateMetadata() {
  console.log("Updating snapshot metadata...");

  const proposalData = JSON.parse(
    await readFile(join(__dirname, "../.data/public-value-classifications.json"), "utf-8")
  );
  const voteData = JSON.parse(
    await readFile(join(__dirname, "../.data/public-vote-classifications.json"), "utf-8")
  );

  const { error } = await supabase
    .from("snapshot_metadata")
    .update({
      methodology_version: proposalData.methodologyVersion,
      reviewed_at: proposalData.reviewedAt,
    })
    .eq("id", 1);

  if (error) {
    console.error("  Error updating metadata:", error.message);
    console.log("  Note: methodology_version and reviewed_at columns may not exist yet. Run the migration first.");
  } else {
    console.log("  Updated snapshot metadata");
  }
}

async function main() {
  console.log("Syncing classifications to Supabase...\n");
  await syncProposalClassifications();
  await syncVoteClassifications();
  await updateMetadata();
  console.log("\nDone!");
}

main().catch(console.error);
