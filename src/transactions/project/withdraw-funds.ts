import { Address, Data, Lucid, RewardAddress, UTxO } from "lucid-cardano";

import { constructTxOutputId, deconstructAddress } from "@/helpers/schema";
import * as S from "@/schema";
import {
  ProjectDatum,
  ProjectDetailDatum,
  ProjectDetailRedeemer,
  ProjectRedeemer,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { UserTag } from "@/schema/teiki/tags";
import {
  DedicatedTreasuryDatum,
  DedicatedTreasuryRedeemer,
  SharedTreasuryDatum,
} from "@/schema/teiki/treasury";
import { assert } from "@/utils";

import {
  PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO,
  PROJECT_NEW_MILESTONE_DISCOUNT_CENTS,
  RATIO_MULTIPLIER,
  TREASURY_UTXO_MIN_ADA,
} from "../constants";

export type Actor = "project-owner" | "anyone";

export type WithdrawFundsParams = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  projectDetailUtxo: UTxO;
  dedicatedTreasuryUtxo: UTxO;
  projectVScriptUtxo: UTxO;
  projectDetailVScriptUtxo: UTxO;
  projectScriptUtxos: UTxO[];
  rewardAddressAndAmount: [RewardAddress, bigint][];
  dedicatedTreasuryVScriptUtxo: UTxO;
  sharedTreasuryAddress: Address;
  actor: Actor;
};

export function withdrawFundsTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    dedicatedTreasuryUtxo,
    projectVScriptUtxo,
    projectDetailVScriptUtxo,
    projectScriptUtxos,
    rewardAddressAndAmount,
    dedicatedTreasuryVScriptUtxo,
    sharedTreasuryAddress,
    actor,
  }: WithdrawFundsParams
) {
  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );
  const protocolParamsDatum = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  assert(
    projectDetailUtxo.datum != null,
    "Invalid project detail UTxO: Missing inline datum"
  );
  const projectDetailDatum = S.fromData(
    S.fromCbor(projectDetailUtxo.datum),
    ProjectDetailDatum
  );

  assert(
    projectUtxo.datum != null,
    "Invalid project UTxO: Missing inline datum"
  );
  const projectDatum = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  assert(
    dedicatedTreasuryUtxo.datum != null,
    "Invalid dedicated treasury UTxO: Missing inline datum"
  );
  const dedicatedTreasuryDatum = S.fromData(
    S.fromCbor(dedicatedTreasuryUtxo.datum),
    DedicatedTreasuryDatum
  );

  const totalWithdrawal = rewardAddressAndAmount.reduce(
    (sum, [_, rewardAmount]) => sum + rewardAmount,
    0n
  );

  const newWithdrawnFunds = projectDetailDatum.withdrawnFunds + totalWithdrawal;
  const milestone =
    newWithdrawnFunds < protocolParamsDatum.projectMilestones[0]
      ? 0
      : protocolParamsDatum.projectMilestones.length -
        [...protocolParamsDatum.projectMilestones]
          .reverse()
          .findIndex((value) => value < newWithdrawnFunds);
  const isNewMilestoneReached = milestone > projectDatum.milestoneReached;

  const split = isNewMilestoneReached
    ? protocolParamsDatum.minTreasuryPerMilestoneEvent * TREASURY_UTXO_MIN_ADA
    : 0n;
  const minFees =
    (totalWithdrawal * protocolParamsDatum.protocolFundsShareRatio) /
    RATIO_MULTIPLIER;
  const inW = BigInt(dedicatedTreasuryUtxo.assets.lovelace);
  const inG =
    dedicatedTreasuryDatum.governorAda > inW
      ? inW
      : dedicatedTreasuryDatum.governorAda;
  const governorAdaLowerbound =
    ((inW - split - inG) * RATIO_MULTIPLIER) /
    (protocolParamsDatum.governorShareRatio - RATIO_MULTIPLIER);
  const dedicatedTreasuryAdaLowerBound = TREASURY_UTXO_MIN_ADA + split - inW;
  const fees = [
    minFees,
    governorAdaLowerbound,
    dedicatedTreasuryAdaLowerBound,
  ].reduce((max, item) => (max > item ? max : item));
  const outW = inW + fees - split;
  const outG =
    inG + (fees * protocolParamsDatum.governorShareRatio) / RATIO_MULTIPLIER;

  let tx = lucid
    .newTx()
    .readFrom([
      ...projectScriptUtxos,
      protocolParamsUtxo,
      projectVScriptUtxo,
      projectDetailVScriptUtxo,
      dedicatedTreasuryVScriptUtxo,
    ])
    .collectFrom(
      [dedicatedTreasuryUtxo],
      S.toCbor(
        S.toData(
          {
            case: "CollectFees",
            split: isNewMilestoneReached,
            minFees,
          },
          DedicatedTreasuryRedeemer
        )
      )
    )
    .collectFrom(
      [projectDetailUtxo],
      S.toCbor(S.toData({ case: "WithdrawFunds" }, ProjectDetailRedeemer))
    )
    .payToContract(
      projectDetailUtxo.address,
      {
        inline: S.toCbor(
          S.toData(
            { ...projectDetailDatum, withdrawnFunds: newWithdrawnFunds },
            ProjectDetailDatum
          )
        ),
      },
      projectDetailUtxo.assets
    );

  for (const [rewardAddress, rewardAmount] of rewardAddressAndAmount)
    tx = tx.withdraw(rewardAddress, rewardAmount, Data.void());

  if (isNewMilestoneReached) {
    tx = tx
      .collectFrom(
        [projectUtxo],
        S.toCbor(
          S.toData(
            { case: "RecordNewMilestone", newMilestone: BigInt(milestone) },
            ProjectRedeemer
          )
        )
      )
      .payToContract(
        projectUtxo.address,
        {
          inline: S.toCbor(
            S.toData(
              { ...projectDatum, milestoneReached: BigInt(milestone) },
              ProjectDatum
            )
          ),
        },
        projectUtxo.assets
      )
      .payToContract(
        dedicatedTreasuryUtxo.address,
        {
          inline: S.toCbor(
            S.toData(
              {
                ...dedicatedTreasuryDatum,
                governorAda: outG,
                tag: {
                  kind: "TagContinuation",
                  former: constructTxOutputId(dedicatedTreasuryUtxo),
                },
              },
              DedicatedTreasuryDatum
            )
          ),
        },
        { lovelace: outW }
      );

    for (let i = 0; i < protocolParamsDatum.minTreasuryPerMilestoneEvent; ++i) {
      const sharedTreasuryDatum: SharedTreasuryDatum = {
        projectId: projectDatum.projectId,
        governorTeiki: 0n,
        projectTeiki: { teikiCondition: "TeikiEmpty" },
        tag: {
          kind: "TagContinuation",
          former: constructTxOutputId(dedicatedTreasuryUtxo),
        },
      };

      tx = tx.payToContract(
        sharedTreasuryAddress,
        {
          inline: S.toCbor(
            S.toData({ ...sharedTreasuryDatum }, SharedTreasuryDatum)
          ),
        },
        { lovelace: TREASURY_UTXO_MIN_ADA }
      );
    }
  } else {
    tx = tx.readFrom([projectUtxo]).payToContract(
      dedicatedTreasuryUtxo.address,
      {
        inline: S.toCbor(
          S.toData(
            {
              ...dedicatedTreasuryDatum,
              governorAda: outG,
              tag: {
                kind: "TagContinuation",
                former: constructTxOutputId(dedicatedTreasuryUtxo),
              },
            },
            DedicatedTreasuryDatum
          )
        ),
      },
      { lovelace: outW }
    );
  }

  if (actor === "project-owner") {
    tx = tx.addSigner(deconstructAddress(lucid, projectDatum.ownerAddress));
  } else {
    let discount =
      (PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO * totalWithdrawal) /
      RATIO_MULTIPLIER;
    if (isNewMilestoneReached) {
      discount +=
        protocolParamsDatum.discountCentPrice *
        PROJECT_NEW_MILESTONE_DISCOUNT_CENTS;
    }

    const minLovelaceToOwner = totalWithdrawal - fees - discount;
    const lovelaceToOwner =
      minLovelaceToOwner < TREASURY_UTXO_MIN_ADA
        ? TREASURY_UTXO_MIN_ADA
        : minLovelaceToOwner;

    tx = tx.payToContract(
      deconstructAddress(lucid, projectDatum.ownerAddress),
      {
        inline: S.toCbor(
          S.toData(
            {
              kind: "TagProjectFundsWithdrawal",
              projectId: projectDatum.projectId,
            },
            UserTag
          )
        ),
      },
      { lovelace: lovelaceToOwner }
    );
  }

  return tx;
}
