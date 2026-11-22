const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { buildCommandLine } = require("../api/services/pythonModelRuntime");

let temporaryDirectory;

after(async () => {
  if (temporaryDirectory)
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test("backend command starts a batch file from a path containing spaces", async (t) => {
  assert.equal(
    buildCommandLine("C:\\Python Runtime\\run.bat"),
    '/d /s /c ""C:\\Python Runtime\\run.bat""',
  );
  if (process.platform !== "win32") return t.skip("Windows command interpreter required");

  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "parking runtime "));
  const batchPath = path.join(temporaryDirectory, "smoke test.bat");
  await fs.writeFile(batchPath, "@echo off\r\necho launch-ok\r\nexit /b 0\r\n", "ascii");
  const child = spawn("cmd.exe", [buildCommandLine(batchPath)], {
    windowsVerbatimArguments: true,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(code, 0, stderr);
  assert.match(stdout, /launch-ok/);
});
