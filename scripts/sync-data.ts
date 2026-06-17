import { runFullSync, setUseCache } from "./lib/sync-lib";

const fresh = process.argv.includes("--fresh");
setUseCache(!fresh);

runFullSync().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});