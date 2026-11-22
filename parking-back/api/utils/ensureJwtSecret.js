const { randomBytes, randomUUID } = require("node:crypto");
const {
  existsSync,
  linkSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");

module.exports = function ensureJwtSecret(secretPath) {
  if (process.env.JWT_SECRET?.trim()) return;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Set JWT_SECRET before starting the backend in production.");
  }

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
    throw new Error("The local .jwt-secret file is invalid. Set JWT_SECRET or restore the file.");
  }

  process.env.JWT_SECRET = secret;
};
