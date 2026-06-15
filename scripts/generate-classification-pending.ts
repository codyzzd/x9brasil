import { writeFile } from "node:fs/promises";
import profileDetailsJson from "../src/data/profile-details.json";
import { classifyProposal } from "../src/lib/public-value";
import type { ProfileDetailsSnapshot } from "../src/lib/ranking";

async function main() {
  const snapshot = profileDetailsJson as unknown as ProfileDetailsSnapshot;
  const proposals = new Map<
    string,
    {
      id: string;
      type: string;
      number: string;
      year: string;
      summary: string;
      url: string;
    }
  >();

  for (const period of snapshot.periods) {
    for (const deputy of period.deputies) {
      for (const proposal of deputy.proposals) {
        proposals.set(proposal.id, proposal);
      }
    }
  }

  const pending = [...proposals.values()]
    .filter((proposal) => !classifyProposal(proposal.id, proposal.summary))
    .sort((a, b) => Number(b.year) - Number(a.year) || a.id.localeCompare(b.id));

  const output = new URL(
    "../src/data/public-value-classification-pending.json",
    import.meta.url,
  );
  await writeFile(
    output,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        total: pending.length,
        proposals: pending,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `${pending.length} proposições aguardando revisão em ${output.pathname}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
