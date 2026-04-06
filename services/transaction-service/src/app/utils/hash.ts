import crypto from "crypto";

export function hashPayload(payload: any) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}
