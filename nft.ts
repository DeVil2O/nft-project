import { createNft, fetchDigitalAsset, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { airdropIfRequired, getKeypairFromFile } from "@solana-developers/helpers";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, percentAmount } from "@metaplex-foundation/umi";


const connection = new Connection(clusterApiUrl("devnet"));

const user = await getKeypairFromFile();

await airdropIfRequired(connection, user.publicKey, 1 * LAMPORTS_PER_SOL, 0.5 * LAMPORTS_PER_SOL);

console.log(user.publicKey.toBase58());

const umi = createUmi(connection.rpcEndpoint);
umi.use(mplTokenMetadata());

const umiUser = umi.eddsa.createKeypairFromSecretKey(user.secretKey);
umi.use(keypairIdentity(umiUser));

console.log("Umi user created.");

const mintCollection = generateSigner(umi);

const nft = createNft(umi, {
  name: "My NFT",
  symbol: "MNFT",
  uri: "https://example.com/nft.json",
  mint: mintCollection,
  sellerFeeBasisPoints: percentAmount(0),
  isCollection: true,
});

await nft.sendAndConfirm(umi);

console.log("NFT created.");

const collection = await fetchDigitalAsset(umi, mintCollection.publicKey);

console.log("Collection fetched with address: ", collection.mint.publicKey);