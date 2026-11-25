const { randomBytes, randomUUID } = require("node:crypto");
const {
  existsSync,
  linkSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");

module.exports = function ensureLocalSecret(secretPath, envName) {
  if (process.env[envName]?.trim()) return;

  if (!existsSync(secretPath)) {
    const pendingPath = `${secretPath}-${randomUUID()}`;
    writeFileSync(pendingPath, `${randomBytes(32).toString("hex")}\n`, {
      flag: "wx",
      mode: 0o600,
    });

    try {
      // Publish the completed file once, even when two backend processes start together.
      linkSync(pendingPath, secretPath);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    } finally {
      unlinkSync(pendingPath);
    }
  }

  const secret = readFileSync(secretPath, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(secret)) {
    throw new Error(
      `The local secret file ${secretPath} is invalid. Set ${envName} or restore the file.`,
    );
  }

  process.env[envName] = secret;
};
