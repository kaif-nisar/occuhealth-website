import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packagePath = require.resolve("buffer-equal-constant-time");
const oldSource = readFileSync(packagePath, "utf8");
const oldLine = "var SlowBuffer = require('buffer').SlowBuffer;";
const newLine = "var SlowBuffer = require('buffer').SlowBuffer || Buffer;";

if (oldSource.includes(oldLine)) {
  writeFileSync(packagePath, oldSource.replace(oldLine, newLine));
  console.log("Patched buffer-equal-constant-time for Node.js 26 compatibility.");
}
