import { getBackingValidatorSource } from "@/contracts/backing/BackingValidator/script";
import { getProofOfBackingPolicySource } from "@/contracts/backing/ProofOfBacking/script";
import getTeikiPolicySource from "@/contracts/meta-protocol/mp.teiki/main";
import getTeikiPlantNftSource from "@/contracts/meta-protocol/nft.teiki-plant/main";
import getTeikiPlantValidatorSource from "@/contracts/meta-protocol/v.teiki-plant/main";
import { HeliosSource } from "@/contracts/program";
import { getProjectATPolicySource } from "@/contracts/project/ProjectAT/script";
import { getProjectDetailValidatorSource } from "@/contracts/project/ProjectDetail/script";
import { getProjectScriptSource } from "@/contracts/project/ProjectScript/script";
import { getProjectStakeSource } from "@/contracts/project/ProjectStake/script";
import { getProjectValidatorSource } from "@/contracts/project/ProjectValidator/script";
import { getProtocolParamsValidatorSource } from "@/contracts/protocol/ParamsValidator/script";
import { getProtocolProposalValidatorSource } from "@/contracts/protocol/ProposalValidator/script";
import { getProtocolScriptSource } from "@/contracts/protocol/ProtocolScript/script";
import { getProtocolStakeSource } from "@/contracts/protocol/ProtocolStake/script";
import { getDedicatedTreasuryValidatorSource } from "@/contracts/treasury/DedicatedTreasury/script";
import { getOpenTreasuryValidatorSource } from "@/contracts/treasury/OpenTreasury/script";
import { getSharedTreasuryValidatorSource } from "@/contracts/treasury/SharedTreasury/script";

import { exportScript } from "./lucid";

function printScript(source: HeliosSource, scriptName: string) {
  console.log("test compile script :>> ", scriptName);
  const script = exportScript(source);

  console.log("script :>> ", script);
}

printScript(
  getBackingValidatorSource({
    proofOfBackingMPH: "",
    protocolNftMPH: "",
  }),
  "backing validator"
);

printScript(
  getProofOfBackingPolicySource({
    projectsAuthTokenMPH: "",
    protocolNftMPH: "",
    teikiMPH: "",
    treasuryAuthTokenMPH: "",
  }),
  "proof of backing policy"
);

printScript(getProjectATPolicySource(""), "proejct auth token policy");

printScript(
  getProjectDetailValidatorSource({
    projectsAuthTokenMPH: "",
    protocolNftMPH: "",
  }),
  "project detail validator"
);

printScript(
  getProjectScriptSource({
    projectsAuthTokenMPH: "",
    protocolNftMPH: "",
  }),
  "project script validator"
);

printScript(
  getProjectStakeSource({
    projectId: "",
    _stakingSeed: "",
    projectsAuthTokenMPH: "",
    protocolNftMPH: "",
  }),
  "project stake validator"
);

printScript(
  getProjectValidatorSource({
    projectsAuthTokenMPH: "",
    protocolNftMPH: "",
  }),
  "project validator"
);

printScript(getProtocolScriptSource(""), "protocol script validator");

printScript(getProtocolStakeSource(""), "protocol stake validator");

printScript(getProtocolParamsValidatorSource(""), "protocol params validator");

printScript(
  getProtocolProposalValidatorSource(""),
  "protocol proposal validator"
);

printScript(
  getDedicatedTreasuryValidatorSource({
    projectsAuthTokenMPH: "",
    protocolNftMPH: "",
  }),
  "dedicated treasury validator"
);

printScript(
  getSharedTreasuryValidatorSource({
    projectsAuthTokenMPH: "",
    protocolNftMPH: "",
    teikiMPH: "",
  }),
  "shared treasury validator"
);

printScript(getOpenTreasuryValidatorSource(""), "open treasury validator");

printScript(
  getTeikiPolicySource({ nftTeikiPlantMph: "" }),
  "teiki minting policy"
);

printScript(
  getTeikiPlantNftSource({
    teikiPlantSeed: {
      txHash: "",
      outputIndex: 1,
    },
  }),
  "teiki-plant nft minting policy"
);

printScript(getTeikiPlantValidatorSource(""), "teiki-plant validator");
