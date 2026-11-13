import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

// Generated or ignored locations (see .gitignore). They never hold tracked JSON.
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", ".qeg", ".npm-cache", ".qeg-generations"]);
const isIgnoredFile = (name) => name === ".qeg-current.json" || name.startsWith(".qeg-replace-");

function listFromDirectory(directory = ".") {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = directory === "." ? entry.name : directory + "/" + entry.name;
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) found.push(...listFromDirectory(path));
    } else if (entry.isFile() && entry.name.endsWith(".json") && !isIgnoredFile(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

// A tree unpacked from an archive has no git metadata. List its JSON files from the
// directory then, so the check still covers every file the archive ships.
function listJsonFiles() {
  try {
    const output = execFileSync("git", ["ls-files", "*.json"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    return { files: output.split(/\r?\n/).filter(Boolean), source: "git" };
  } catch {
    return { files: listFromDirectory(), source: "directory" };
  }
}

const { files: listed, source } = listJsonFiles();
const files = listed.sort();
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
console.log("Parsed " + files.length + " tracked JSON files" + (source === "git" ? "" : " (no git metadata; listed from the directory)"));
