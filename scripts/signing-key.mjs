import { generateKeyPairSync } from "node:crypto";
const pair = generateKeyPairSync("ed25519");
process.stdout.write(
  'RECEIPT_SIGNING_PRIVATE_KEY="' +
    pair.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString()
      .replace(/\n/g, "\\n") +
    '"\n',
);
process.stderr.write(
  "Keep the private key secret. Public key:\n" +
    pair.publicKey.export({ type: "spki", format: "pem" }),
);
