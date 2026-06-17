import { runFetch, setUseCache } from "./lib/sync-lib";

const fresh = process.argv.includes("--fresh");
setUseCache(!fresh);

runFetch().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});