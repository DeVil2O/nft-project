import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"; // ← for types
import {
  fetchDigitalAssetWithAssociatedToken,
  mplTokenMetadata,
  transferV1,
} from "@metaplex-foundation/mpl-token-metadata";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { airdropIfRequired, getKeypairFromFile } from "@solana-developers/helpers";
import path from "path";

async function main() {
  // … your existing setup …
  const connection = new Connection(clusterApiUrl("devnet"));

  const user = await getKeypairFromFile(path.join("~/.config/solana/phantom-keypair.json"));

  await airdropIfRequired(
    connection, 
    user.publicKey, 
    1 * LAMPORTS_PER_SOL, 
    0.5 * LAMPORTS_PER_SOL
  );

  const umi = createUmi(connection.rpcEndpoint);
  umi.use(mplTokenMetadata());
  
  const umiUser = umi.eddsa.createKeypairFromSecretKey(user.secretKey);
  umi.use(keypairIdentity(umiUser));

  const mint = publicKey("FCC7MUWMDkT3LPMp4wPxsFhe9Tf3HCjnrjF2kfAq4Xcv");

  // 1️⃣ Fetch the on-chain asset + its associated token account:
  const assetWithToken = await fetchDigitalAssetWithAssociatedToken(
    umi,
    mint,
    umi.identity.publicKey,
  );

  const tokenAccount = assetWithToken.token.publicKey;
  if (!tokenAccount) {
    throw new Error("No associated token account found for this asset.");
  }

  console.log("Current owner token account:", tokenAccount);

  // 2️⃣ Pull the last N signatures touching that account:
  const signatures = await connection.getSignaturesForAddress(tokenAccount, {
    limit: 1000,
  });

  const ownerHistory: Array<{
    slot: number;
    signature: string;
    from: string;
    to: string;
  }> = [];

  // 3️⃣ For each signature, fetch the parsed transaction and look for SPL-Token transfers:
  for (let i = signatures.length - 1; i >= 0; i--) {
    const { signature } = signatures[i];
    const tx = await connection.getParsedTransaction(signature, "confirmed");
    if (!tx) continue;

    for (const ix of tx.transaction.message.instructions) {
      // only interested in SPL-Token “transfer” instructions
      if (
        "parsed" in ix &&
        ix.program === "spl-token" &&
        ix.parsed.type === "transfer"
      ) {
        const info = ix.parsed.info;
        console.log("info", info);
        // filter down to transfers of *this* mint
        if (info.mint === mint.toString()) {
          ownerHistory.push({
            slot: tx.slot,
            signature,
            from: info.source,
            to: info.destination,
          });
        }
      }
    }
  }

  console.log("🔄 Owner history (chronological):");
  ownerHistory.forEach((h, idx) => {
    console.log(
      `${idx + 1}. slot ${h.slot} — ${h.from} → ${h.to} (tx: ${h.signature})`,
    );
  });
}

main().catch(console.error);
