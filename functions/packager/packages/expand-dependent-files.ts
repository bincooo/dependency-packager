import { fs } from "mz";
import { join } from "path";

function loadModulesConfig() : Record<string, { version?: string[], main?: string, manifest?: string[] }> {
  const jsonPath = join(__dirname, "../../..", "modules.json");
  const chunk = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(chunk);
}

export const modules = loadModulesConfig();