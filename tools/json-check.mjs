import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const output = execFileSync("git", ["ls-files", "*.json"], {
  encoding: "utf-8",
});
const files = output.split(/\r?\n/).filter(Boolean).sort();
if (files.length === 0) {
  throw new Error("no tracked JSON files found");
}
for (const file of files) {
  try {
    JSON.parse(readFileSync(file, "utf-8"));
  } catch (error) {
    throw new Error("tracked JSON parse failed: " + file, { cause: error });
  }
}
console.log("Parsed " + files.length + " tracked JSON files");
