import { Tx } from "lucid-cardano";

import { Hex } from "@/types";

export const TEIKI_METADATA_LABEL = 731211;

// IPFS content identification
export type Cid = string;

export type Params = {
  policyId: Hex;
  assetName: Hex;
  nftName: "Teiki Hana" | "Teiki Kuda";
  projectId: Hex;
  backingAmount: bigint;
  duration: bigint;
  imageCid?: string;
};

export function attachTeikiNftMetadata(
  tx: Tx,
  {
    policyId,
    assetName,
    nftName,
    imageCid,
    projectId,
    backingAmount,
    duration,
  }: Params
) {
  const metadata = {
    [policyId]: {
      [assetName]: {
        name: nftName,
        image: `ipfs://${
          imageCid ? imageCid : "QmSwqXzXVVZX6XWkWe6WbKGor7vYj8MGJHLFWJ3aSCdreV"
        }`,
        description: "The Proof of Backing NFT on Teiki protocol",
        project_id: projectId,
        backing_amount: Number(backingAmount),
        duration: Number(duration),
      },
    },
    version: 2, // asset name in hex format
  };
  return tx.attachMetadata(721, metadata);
}

export function getPlantNftName({ isMatured }: { isMatured: boolean }) {
  return isMatured ? "Teiki Kuda" : "Teiki Hana";
}
