import { bytesToHex } from "@hyperionbt/helios";

import getBackingV from "@/contracts/backing/backing.v/main";
import getProofOfBackingMp from "@/contracts/backing/proof-of-backing.mp/main";
import { compile } from "@/contracts/compile";
import getTeikiPlantNft from "@/contracts/meta-protocol/teiki-plant.nft/main";
import getTeikiPlantV from "@/contracts/meta-protocol/teiki-plant.v/main";
import getTeikiMp from "@/contracts/meta-protocol/teiki.mp/main";
import getProjectDetailV from "@/contracts/project/project-detail.v/main";
import getProjectScriptV from "@/contracts/project/project-script.v/main";
import getProjectAt from "@/contracts/project/project.at/main";
import getProjectSv from "@/contracts/project/project.sv/main";
import getProjectV from "@/contracts/project/project.v/main";
import getProtocolParamsV from "@/contracts/protocol/protocol-params.v/main";
import getProtocolProposalV from "@/contracts/protocol/protocol-proposal.v/main";
import getProtocolScriptV from "@/contracts/protocol/protocol-script.v/main";
import getProtocolNft from "@/contracts/protocol/protocol.nft/main";
import getProtocolSv from "@/contracts/protocol/protocol.sv/main";
import getDedicatedTreasuryV from "@/contracts/treasury/dedicated-treasury.v/main";
import getOpenTreasuryV from "@/contracts/treasury/open-treasury.v/main";
import getSharedTreasuryV from "@/contracts/treasury/shared-treasury.v/main";

const BLANK_OUT_REF = { txHash: "00".repeat(32), outputIndex: 0 };

const ALL_SCRIPTS = {
  "Meta-Protocol": {
    "NFT | Teiki Plant": getTeikiPlantNft({ teikiPlantSeed: BLANK_OUT_REF }),
    "V | Teiki Plant": getTeikiPlantV(""),
    "MP | Teiki": getTeikiMp({ nftTeikiPlantMph: "" }),
  },
  Protocol: {
    "NFT | Protocol": getProtocolNft({ protocolSeed: BLANK_OUT_REF }),
    "V | Protocol Params": getProtocolParamsV(""),
    "V | Protocol Proposal": getProtocolProposalV(""),
    "V | Protocol Script": getProtocolScriptV(""),
    "SV | Protocol": getProtocolSv(""),
  },
  Project: {
    "V | Project": getProjectV({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
    }),
    "V | Project Detail": getProjectDetailV({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
    }),
    "V | Project Script": getProjectScriptV({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
    }),
    "AT | Project": getProjectAt(""),
    "SV | Project": getProjectSv({
      projectId: "",
      _stakingSeed: "",
      projectsAuthTokenMph: "",
      protocolNftMph: "",
    }),
  },
  Backing: {
    "V | Backing": getBackingV({ proofOfBackingMph: "", protocolNftMph: "" }),
    "MP | Proof of Backing": getProofOfBackingMp({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
      teikiMph: "",
    }),
  },
  Treasuries: {
    "V | Dedicated Treasury": getDedicatedTreasuryV({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
    }),
    "V | Shared Treasury": getSharedTreasuryV({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
      teikiMph: "",
      proofOfBackingMph: "",
    }),
    "V | Open Treasury": getOpenTreasuryV(""),
  },
};

describe.each(Object.entries(ALL_SCRIPTS))(
  "%s Scripts",
  (_category, scripts) => {
    it.concurrent.each(Object.entries(scripts))("%s", (name, script) => {
      const uplcProgram = compile(script);
      const size = uplcProgram.calcSize();
      expect(size).toBeGreaterThan(0);
      console.log(`${name} - ${size} | ${bytesToHex(uplcProgram.hash())}`);
    });
  }
);
