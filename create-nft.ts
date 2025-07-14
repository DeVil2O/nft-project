import { createNft, fetchDigitalAsset, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { airdropIfRequired, getKeypairFromFile } from "@solana-developers/helpers";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, percentAmount, publicKey } from "@metaplex-foundation/umi";
import path from "path";
import { fetchNFT } from "./create-collection.ts";

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

  const collectionAddress = publicKey("FCC7MUWMDkT3LPMp4wPxsFhe9Tf3HCjnrjF2kfAq4Xcv");

  const mintCollection = generateSigner(umi);

  const nft = await createNft(umi, {
    name: "My NFT",
    symbol: "MNFT",
    uri: "https://raw.githubusercontent.com/DeVil2O/nft-project/main/nft-metadata.json",
    mint: mintCollection,
    collection: {
        key: collectionAddress,
        verified: false,
    },
    sellerFeeBasisPoints: percentAmount(0),
  }).sendAndConfirm(umi);

  console.log("NFT created successfully!", nft);

  await fetchNFT(umi, mintCollection.publicKey);
}

main().then(() => {
  console.log("Done");
}).catch((error) => {
  console.error(error);
});