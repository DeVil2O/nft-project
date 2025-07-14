import { createNft, fetchDigitalAssetWithAssociatedToken, findTokenRecordPda, mplTokenMetadata, TokenStandard, transferV1 } from "@metaplex-foundation/mpl-token-metadata";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { airdropIfRequired, getKeypairFromFile } from "@solana-developers/helpers";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, percentAmount, publicKey, unwrapOptionRecursively } from "@metaplex-foundation/umi";
import path from "path";
import { fetchNFT } from "./create-collection.ts";
import { findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox";
import { getMplTokenAuthRulesProgramId } from "@metaplex-foundation/mpl-candy-machine";
import { base58 } from "@metaplex-foundation/umi/serializers";

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

  const mint = publicKey("FCC7MUWMDkT3LPMp4wPxsFhe9Tf3HCjnrjF2kfAq4Xcv");

  const assetWithToken = await fetchDigitalAssetWithAssociatedToken(
    umi,
    mint,
    umi.identity.publicKey
  );

  const recipientAddress = publicKey("EwbncD1LkWHRhSwfmyfX7DsYYKWgmdjRvAtLAaNkdCzx"); 

  const destinationTokenAccount = findAssociatedTokenPda(umi, {
    mint: mint,
    owner: recipientAddress,
  });

  const destinationTokenRecord = findTokenRecordPda(umi, {
    mint: mint,
    token: destinationTokenAccount[0],
  });

  const { signature } = await transferV1(umi, {
    mint: mint,
    destinationOwner: recipientAddress,
    destinationTokenRecord: destinationTokenRecord,
    tokenRecord: assetWithToken.tokenRecord?.publicKey,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    // Check to see if the pNFT asset as auth rules.
    authorizationRules:
      unwrapOptionRecursively(assetWithToken.metadata.programmableConfig)
        ?.ruleSet || undefined,
    // Auth rules program ID
    authorizationRulesProgram: getMplTokenAuthRulesProgramId(umi),
    // Some pNFTs may require authorization data if set.
    authorizationData: undefined,
  }).sendAndConfirm(umi);

  console.log("NFT transferred successfully!", signature);

  console.log("Signature: ", base58.deserialize(signature));
  await fetchNFT(umi, mint);
}

main().then(() => {
  console.log("Done");
}).catch((error) => {
  console.error(error);
});