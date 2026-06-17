import { runProcess, setUseCache } from "./lib/sync-lib";

const fresh = process.argv.includes("--fresh");
setUseCache(!fresh);

runProcess().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});