import { Data, Lucid, PolicyId, Unit, UTxO } from "lucid-cardano";

import { PROJECT_AT_TOKEN_NAMES } from "@/contracts/common/constants";
import { addressFromScriptHashes } from "@/helpers/lucid";
import { deconstructAddress } from "@/helpers/schema";
import { getTxTimeRange } from "@/helpers/time";
import * as S from "@/schema";
import {
  ProjectDatum,
  ProjectDetailRedeemer,
  ProjectMintingRedeemer,
  ProjectRedeemer,
  ProjectScriptRedeemer,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import {
  OpenTreasuryDatum,
  OpenTreasuryRedeemer,
} from "@/schema/teiki/treasury";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

import {
  INACTIVE_PROJECT_UTXO_ADA,
  RATIO_MULTIPLIER,
  TREASURY_UTXO_MIN_ADA,
  PROJECT_IMMEDIATE_CLOSURE_TX_TIME_SLIPPAGE,
} from "../constants";

export type ProjectScriptInfo = {
  projectScriptUtxo: UTxO;
  rewardAmount: bigint;
};

export type OpenTreasuryInfo = {
  openTreasuryUtxo: UTxO;
  openTreasuryVRefScriptUtxo: UTxO;
};

export type Params = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  projectDetailUtxo: UTxO;
  projectVRefScriptUtxo: UTxO;
  projectDetailVRefScriptUtxo: UTxO;
  projectScriptVRefScriptUtxo: UTxO;
  projectScriptInfoList: ProjectScriptInfo[];
  projectAtPolicyId: PolicyId;
  projectAtScriptUtxo: UTxO;
  openTreasuryInfo?: OpenTreasuryInfo;
  txTimeStartPadding?: TimeDifference;
  txTimeEndPadding?: TimeDifference;
};

export function finalizeCloseTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    projectVRefScriptUtxo,
    projectDetailVRefScriptUtxo,
    projectScriptVRefScriptUtxo,
    projectScriptInfoList,
    projectAtPolicyId,
    projectAtScriptUtxo,
    openTreasuryInfo,
    txTimeStartPadding = 60_000,
    txTimeEndPadding = 60_000,
  }: Params
) {
  assert(
    projectVRefScriptUtxo.scriptRef != null,
    "Invalid project script UTxO: Missing script reference"
  );

  assert(
    projectDetailVRefScriptUtxo.scriptRef != null,
    "Invalid project detail script UTxO: Missing script reference"
  );

  assert(
    projectAtScriptUtxo.scriptRef != null,
    "Invalid project at script UTxO: Missing script reference"
  );

  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );
  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  assert(
    projectUtxo.datum != null,
    "Invalid project UTxO: Missing inline datum"
  );
  const project = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  assert(
    projectDetailUtxo.datum != null,
    "Invalid project detail UTxO: Missing inline datum"
  );

  const protocolSvCredential = lucid.utils.scriptHashToCredential(
    protocolParams.registry.protocolStakingValidator.script.hash
  );

  const projectVCredentail = lucid.utils.getAddressDetails(
    projectUtxo.address
  ).paymentCredential;
  assert(
    projectVCredentail,
    "Cannot extract payment credential from the project address"
  );
  const outputProjectAddress = lucid.utils.credentialToAddress(
    projectVCredentail,
    protocolSvCredential
  );

  const projectDetailVCredentail = lucid.utils.getAddressDetails(
    projectDetailUtxo.address
  ).paymentCredential;
  assert(
    projectDetailVCredentail,
    "Cannot extract payment credential from the project address"
  );
  const outputProjectDetailAddress = lucid.utils.credentialToAddress(
    projectDetailVCredentail,
    protocolSvCredential
  );

  const projectAtUnit: Unit =
    projectAtPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

  const [txTimeStart, txTimeEnd] = getTxTimeRange({
    lucid,
    txTimeStartPadding,
    txTimeEndPadding,
  });

  let tx = lucid
    .newTx()
    .readFrom([
      protocolParamsUtxo,
      projectVRefScriptUtxo,
      projectDetailVRefScriptUtxo,
      projectScriptVRefScriptUtxo,
      projectAtScriptUtxo,
    ])
    .mintAssets(
      { [projectAtUnit]: -BigInt(projectScriptInfoList.length) },
      S.toCbor(S.toData({ case: "DeallocateStaking" }, ProjectMintingRedeemer))
    )
    .collectFrom(
      [projectUtxo],
      S.toCbor(S.toData({ case: "FinalizeClose" }, ProjectRedeemer))
    )
    .collectFrom(
      [projectDetailUtxo],
      S.toCbor(S.toData({ case: "Close" }, ProjectDetailRedeemer))
    )
    .payToContract(
      outputProjectAddress,
      {
        inline: S.toCbor(
          S.toData(
            {
              ...project,
              status: {
                type: "Closed",
                closedAt: { timestamp: BigInt(txTimeStart) },
              },
            },
            ProjectDatum
          )
        ),
      },
      { ...projectUtxo.assets, lovelace: INACTIVE_PROJECT_UTXO_ADA }
    )
    .payToContract(
      outputProjectDetailAddress,
      { inline: projectDetailUtxo.datum },
      projectDetailUtxo.assets
    )
    .addSigner(deconstructAddress(lucid, project.ownerAddress))
    .validFrom(txTimeStart)
    .validTo(
      Math.min(
        txTimeEnd,
        txTimeStart + Number(PROJECT_IMMEDIATE_CLOSURE_TX_TIME_SLIPPAGE)
      )
    );

  const openTreasuryScriptAddress = addressFromScriptHashes(
    lucid,
    protocolParams.registry.openTreasuryValidator.latest.script.hash,
    protocolParams.registry.protocolStakingValidator.script.hash
  );

  const delayStakingRewards = projectScriptInfoList.filter(
    (projectScriptInfo: ProjectScriptInfo) =>
      projectScriptInfo.rewardAmount > 0 &&
      projectScriptInfo.rewardAmount < TREASURY_UTXO_MIN_ADA
  );

  const openTreasuryRedeemer: OpenTreasuryRedeemer = {
    case: "CollectDelayedStakingRewards",
    stakingWithdrawals: delayStakingRewards.map(
      ({ projectScriptUtxo, rewardAmount }: ProjectScriptInfo) => {
        assert(
          projectScriptUtxo.scriptRef != null,
          "Invalid project script UTxO: Missing script reference"
        );
        return [
          {
            script: {
              hash: lucid.utils.validatorToScriptHash(
                projectScriptUtxo.scriptRef
              ),
            },
          },
          rewardAmount,
        ];
      }
    ),
  };

  if (delayStakingRewards.length > 0) {
    assert(
      openTreasuryInfo && openTreasuryInfo.openTreasuryUtxo.datum,
      "Missing open treasury info"
    );

    const { openTreasuryUtxo, openTreasuryVRefScriptUtxo } = openTreasuryInfo;

    assert(openTreasuryUtxo.datum, "Missing open treasury datum");

    const openTreasuryDatum: OpenTreasuryDatum = S.fromData(
      S.fromCbor(openTreasuryUtxo.datum),
      OpenTreasuryDatum
    );

    const totalDelayStakingRewardAmount = delayStakingRewards.reduce(
      (acc, { rewardAmount }: ProjectScriptInfo) => (acc += rewardAmount),
      0n
    );

    const outputOpenTreasuryDatum: OpenTreasuryDatum = {
      governorAda:
        openTreasuryDatum.governorAda +
        (totalDelayStakingRewardAmount * protocolParams.governorShareRatio) /
          RATIO_MULTIPLIER,
      tag: {
        kind: "TagProjectDelayedStakingRewards",
        stakingValidator: null,
      },
    };

    tx = tx
      .readFrom([openTreasuryVRefScriptUtxo])
      .collectFrom(
        [openTreasuryUtxo],
        S.toCbor(S.toData(openTreasuryRedeemer, OpenTreasuryRedeemer))
      )
      .payToContract(
        openTreasuryScriptAddress,
        {
          inline: S.toCbor(
            S.toData(outputOpenTreasuryDatum, OpenTreasuryDatum)
          ),
        },
        {
          ...openTreasuryUtxo.assets,
          lovelace:
            openTreasuryUtxo.assets.lovelace + totalDelayStakingRewardAmount,
        }
      );
  }

  for (const projectScriptInfo of projectScriptInfoList) {
    const { projectScriptUtxo, rewardAmount } = projectScriptInfo;
    assert(
      projectScriptUtxo.scriptRef != null,
      "Invalid project script UTxO: Missing script reference"
    );

    const stakeValidatorHash = lucid.utils.validatorToScriptHash(
      projectScriptUtxo.scriptRef
    );

    const stakeCredential =
      lucid.utils.scriptHashToCredential(stakeValidatorHash);

    const stakeAddress = lucid.utils.credentialToRewardAddress(stakeCredential);

    tx = tx
      .collectFrom(
        [projectScriptUtxo],
        S.toCbor(S.toData({ case: "Close" }, ProjectScriptRedeemer))
      )
      .withdraw(stakeAddress, rewardAmount, Data.void())
      .deregisterStake(stakeAddress, Data.void());

    if (rewardAmount >= TREASURY_UTXO_MIN_ADA) {
      const openTreasuryDatum: OpenTreasuryDatum = {
        governorAda:
          (rewardAmount * protocolParams.governorShareRatio) / RATIO_MULTIPLIER,
        tag: {
          kind: "TagProjectDelayedStakingRewards",
          stakingValidator: {
            script: {
              hash: stakeValidatorHash,
            },
          },
        },
      };
      tx = tx.payToContract(
        openTreasuryScriptAddress,
        {
          inline: S.toCbor(S.toData(openTreasuryDatum, OpenTreasuryDatum)),
        },
        { lovelace: rewardAmount }
      );
    }
  }

  return tx;
}
