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
  }]>;

  console.log(`  Found ${entries.length} proposal classifications`);

  const rows = entries.map(([proposalId, cls]) => ({
    proposal_id: proposalId,
    category: cls.category,
    confidence: cls.confidence,
    justification: cls.justification,
    source: "reviewed",
    methodology_version: methodologyVersion,
  }));

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
  }]>;

  console.log(`  Found ${entries.length} vote classifications`);

  for (const [compositeKey, cls] of entries) {
    const parts = compositeKey.split("-");
    const voteId = parts[0];
    const sessionNumber = parts.length > 1 ? parts.slice(1).join("-") : null;

    const { error } = await supabase.from("vote_classifications").upsert({
      vote_id: voteId,
      session_number: sessionNumber,
      classification: cls.classification,
      severity: cls.severity,
      public_interest_vote: cls.publicInterestVote,
      confidence: cls.confidence,
      reason: cls.reason,
      source: "reviewed",
      reviewed_manually: true,
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