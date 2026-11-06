const { timingSafeEqual } = require("crypto");

module.exports = function requireModelApiKey(req, res, next) {
  const expected = process.env.PARKING_MODEL_API_KEY;
  if (!expected)
    return res.status(503).json({
      success: false,
      message: "Model event authentication is not configured",
    });

  const supplied = req.get("x-model-api-key") || "";
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  )
    return res.status(401).json({
      success: false,
      message: "Model authentication failed",
    });

  return next();
};
