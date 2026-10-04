import crypto from "crypto";

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Public certificate ID: 12 random chars from an unambiguous alphabet, e.g. LA-7K2M-9XQ4-TD3H. */
export function newCertificateId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `LA-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}
