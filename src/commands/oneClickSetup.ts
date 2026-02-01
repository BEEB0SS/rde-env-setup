import { getServices } from "../servicesSingleton";

export async function runOneClickSetup() {
  const { log, solverLog, validatorLog } = getServices();

  log.appendLine("Starting One-Click Setup...");
  solverLog.appendLine("Building constraints graph...");
  validatorLog.appendLine("Validator initialized.");
}
