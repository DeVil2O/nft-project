import { createNft, fetchDigitalAsset, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { airdropIfRequired, getKeypairFromFile } from "@solana-developers/helpers";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, percentAmount } from "@metaplex-foundation/umi";
import path from "path";

async function main() {
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

  const mintCollection = generateSigner(umi);

  // Create NFT collection
  const { signature } = await createNft(umi, {
    name: "My NFT",
    symbol: "MNFT",
    uri: "https://raw.githubusercontent.com/DeVil2O/nft-project/main/nft-metadata.json",
    mint: mintCollection,
    sellerFeeBasisPoints: percentAmount(0),
    isCollection: true,
    creators: [{
      address: umiUser.publicKey,
      verified: true,
      share: 100,
    }],
  }).sendAndConfirm(umi);

  console.log("\n1. Transaction Details:");
  console.log("   Signature:", signature);
  console.log("   Explorer: https://explorer.solana.com/tx/" + signature + "?cluster=devnet");
  console.log("   Mint Address:", mintCollection.publicKey.toString());

  await fetchNFT(umi, mintCollection.publicKey);
}

export async function fetchNFT(umi, mintPublicKey) {
  console.log("\n2. Waiting for RPC propagation (10 seconds)...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Retry mechanism
  let retries = 3;
  let collection;
  
  while (retries > 0) {
    try {
      console.log(`\n3. Fetching asset (attempt ${4-retries}/3)...`);
      collection = await fetchDigitalAsset(umi, mintPublicKey);
      break;
    } catch (error) {
      console.warn(`   Attempt failed: ${error.message}`);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  if (!collection) throw new Error("Failed to fetch NFT after multiple attempts");
  
  console.log("\n4. Asset successfully fetched!");
  console.log("   Collection Address:", collection.mint.publicKey.toString());
  console.log("   Metadata:", collection.metadata);
}

main().catch(console.error);