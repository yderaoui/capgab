import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import type { Analysis, Receipt, ReceiptContent } from "./models";
import { RULES } from "./calculations";
import { canonicalize } from "./canonical";
export { canonicalize } from "./canonical";
export function hashContent(content: unknown): string {
  return createHash("sha256").update(canonicalize(content)).digest("hex");
}
let demoKey: { privateKey: KeyObject; publicKey: KeyObject } | undefined;
export function signingKey(mode: "live" | "demo") {
  if (mode === "live") {
    if (!process.env.RECEIPT_SIGNING_PRIVATE_KEY)
      throw new Error("Live receipt signing key is not configured.");
    return createPrivateKey(
      process.env.RECEIPT_SIGNING_PRIVATE_KEY.replace(/\\n/g, "\n"),
    );
  }
  demoKey ??= generateKeyPairSync("ed25519");
  return demoKey.privateKey;
}
export function issueReceipt(analysis: Analysis): Receipt {
  const content: ReceiptContent = {
    id: crypto.randomUUID(),
    mode: analysis.mode,
    issuedAt: new Date().toISOString(),
    methodology: RULES.methodology,
    analysis,
  };
  const privateKey = signingKey(analysis.mode);
  const publicKey = createPublicKey(privateKey)
    .export({ type: "spki", format: "pem" })
    .toString();
  const hash = hashContent(content);
  return {
    content,
    hash,
    signature: sign(null, Buffer.from(hash, "hex"), privateKey).toString(
      "base64",
    ),
    keyId:
      analysis.mode === "demo"
        ? `demo-${hashContent(publicKey).slice(0, 12)}`
        : (process.env.RECEIPT_KEY_ID ?? hashContent(publicKey).slice(0, 16)),
    publicKey,
    algorithm: "Ed25519",
  };
}
export function verifyReceipt(
  receipt: Receipt,
  trustedKey?: string,
): {
  valid: boolean;
  hashValid: boolean;
  signatureValid: boolean;
  trusted: boolean;
} {
  try {
    const hashValid = hashContent(receipt.content) === receipt.hash;
    const signatureValid = verify(
      null,
      Buffer.from(receipt.hash, "hex"),
      receipt.publicKey,
      Buffer.from(receipt.signature, "base64"),
    );
    return {
      valid: hashValid && signatureValid,
      hashValid,
      signatureValid,
      trusted: !!trustedKey && trustedKey === receipt.publicKey,
    };
  } catch {
    return {
      valid: false,
      hashValid: false,
      signatureValid: false,
      trusted: false,
    };
  }
}
