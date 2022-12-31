import getBackingV from "@/contracts/backing/backing.v/main";
import getProofOfBackingMp from "@/contracts/backing/proof-of-backing.mp/main";
import { compile, exportScript } from "@/contracts/compile";
import getTeikiPlantNft from "@/contracts/meta-protocol/teiki-plant.nft/main";
import getTeikiPlantV from "@/contracts/meta-protocol/teiki-plant.v/main";
import getTeikiMp from "@/contracts/meta-protocol/teiki.mp/main";
import { HeliosSource } from "@/contracts/program";
import getProjectDetailV from "@/contracts/project/project-detail.v/main";
import getProjectScriptV from "@/contracts/project/project-script.v/main";
import getProjectAt from "@/contracts/project/project.at/main";
import getProjectSv from "@/contracts/project/project.sv/main";
import getProjectV from "@/contracts/project/project.v/main";
import getProtocolParamsV from "@/contracts/protocol/protocol-params.v/main";
import getProtocolProposalV from "@/contracts/protocol/protocol-proposal.v/main";
import getProtocolScriptV from "@/contracts/protocol/protocol-script.v/main";
import getProtocolSv from "@/contracts/protocol/protocol.sv/main";
import getDedicatedTreasuryV from "@/contracts/treasury/dedicated-treasury.v/main";
import getOpenTreasuryV from "@/contracts/treasury/open-treasury.v/main";
import getSharedTreasuryV from "@/contracts/treasury/shared-treasury.v/main";

function printScript(source: HeliosSource, scriptName: string) {
  console.log("test compile script :>>", scriptName);
  const script = exportScript(compile(source));

  console.log("script :>>", script);
}

printScript(
  getBackingV({ proofOfBackingMph: "", protocolNftMph: "" }),
  "backing validator"
);

printScript(
  getProofOfBackingMp({
    projectsAuthTokenMph: "",
    protocolNftMph: "",
    teikiMph: "",
  }),
  "proof of backing policy"
);

printScript(getProjectAt(""), "proejct auth token policy");

printScript(
  getProjectDetailV({ projectsAuthTokenMph: "", protocolNftMph: "" }),
  "project detail validator"
);

printScript(
  getProjectScriptV({ projectsAuthTokenMph: "", protocolNftMph: "" }),
  "project script validator"
);

printScript(
  getProjectSv({
    projectId: "",
    _stakingSeed: "",
    projectsAuthTokenMph: "",
    protocolNftMph: "",
  }),
  "project stake validator"
);

printScript(
  getProjectV({ projectsAuthTokenMph: "", protocolNftMph: "" }),
  "project validator"
);

printScript(getProtocolScriptV(""), "protocol script validator");

printScript(getProtocolSv(""), "protocol stake validator");

printScript(getProtocolParamsV(""), "protocol params validator");

printScript(getProtocolProposalV(""), "protocol proposal validator");

printScript(
  getDedicatedTreasuryV({ projectsAuthTokenMph: "", protocolNftMph: "" }),
  "dedicated treasury validator"
);

printScript(
  getSharedTreasuryV({
    projectsAuthTokenMph: "",
    protocolNftMph: "",
    teikiMph: "",
  }),
  "shared treasury validator"
);

printScript(getOpenTreasuryV(""), "open treasury validator");

printScript(getTeikiMp({ nftTeikiPlantMph: "" }), "teiki minting policy");

printScript(
  getTeikiPlantNft({ teikiPlantSeed: { txHash: "", outputIndex: 1 } }),
  "teiki-plant nft minting policy"
);

printScript(getTeikiPlantV(""), "teiki-plant validator");
