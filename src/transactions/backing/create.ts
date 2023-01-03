import { Address, Lucid } from "lucid-cardano";

import * as S from "@/schema";
import { BackingDatum } from "@/schema/teiki/backer";
import { Hex } from "@/types";

import { constructAddress } from "../helpers/constructors";
import { getCurrentTime } from "../helpers/lucid";

export type ProjectInfo = {
  id: Hex;
  currentMilestone: bigint;
};

export type BackingInfo = {
  amount: bigint;
  backerAddress: Address;
};

export type CreateBackingParams = {
  projectInfo: ProjectInfo;
  backingInfo: BackingInfo;
  backingScriptAddress: Address;
};

export function createBackingTx(
  lucid: Lucid,
  { projectInfo, backingInfo, backingScriptAddress }: CreateBackingParams
) {
  const backingDatum: BackingDatum = {
    projectId: { id: projectInfo.id },
    backerAddress: constructAddress(backingInfo.backerAddress),
    stakedAt: { timestamp: BigInt(getCurrentTime(lucid)) },
    milestoneBacked: projectInfo.currentMilestone,
  };

  return lucid.newTx().payToContract(
    backingScriptAddress,
    {
      inline: S.toCbor(S.toData(backingDatum, BackingDatum)),
    },
    { lovelace: backingInfo.amount }
  );
}
