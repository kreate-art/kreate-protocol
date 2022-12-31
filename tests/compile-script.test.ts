import { bytesToHex } from "@hyperionbt/helios";

import getBackingV from "@/contracts/backing/backing.v/main";
import getProofOfBackingMp from "@/contracts/backing/proof-of-backing.mp/main";
import { compile } from "@/contracts/compile";
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
import getProtocolNft from "@/contracts/protocol/protocol.nft/main";
import getProtocolSv from "@/contracts/protocol/protocol.sv/main";
import getDedicatedTreasuryV from "@/contracts/treasury/dedicated-treasury.v/main";
import getOpenTreasuryV from "@/contracts/treasury/open-treasury.v/main";
import getSharedTreasuryV from "@/contracts/treasury/shared-treasury.v/main";

function testCompileScript(scriptName: string, main: HeliosSource) {
  const uplcProgram = compile(main);
  expect(uplcProgram.serialize().length > 0).toBe(true);
  console.log(
    `${scriptName} -  ${uplcProgram.calcSize()} | ${bytesToHex(
      uplcProgram.hash()
    )}`
  );
}

describe("Meta-Protocol", () => {
  test("NFT | Teiki Plant", () => {
    testCompileScript(
      "NFT | Teiki Plant",
      getTeikiPlantNft({ teikiPlantSeed: { txHash: "", outputIndex: 1 } })
    );
  });

  test("V | Teiki Plant", () => {
    testCompileScript("V | Teiki Plant", getTeikiPlantV(""));
  });

  test("MP | Teiki", () => {
    testCompileScript("MP | Teiki", getTeikiMp({ nftTeikiPlantMph: "" }));
  });
});

describe("Protocol", () => {
  test("NFT | Protocol", () => {
    testCompileScript("NFT | Protocol", getProtocolNft("", "0"));
  });

  test("V | Protocol Params", () => {
    testCompileScript("V | Protocol Params", getProtocolParamsV(""));
  });

  test("V | Protocol Proposal", () => {
    testCompileScript("V | Protocol Proposal", getProtocolProposalV(""));
  });

  test("V | Protocol Script", () => {
    testCompileScript("V | Protocol Script", getProtocolScriptV(""));
  });

  test("SV | Protocol", () => {
    testCompileScript("SV | Protocol", getProtocolSv(""));
  });
});

describe("Project", () => {
  test("V | Project", () => {
    testCompileScript(
      "V | Project",
      getProjectV({ projectsAuthTokenMph: "", protocolNftMph: "" })
    );
  });

  test("V | Project Detail", () => {
    testCompileScript(
      "V | Project Detail",
      getProjectDetailV({ projectsAuthTokenMph: "", protocolNftMph: "" })
    );
  });

  test("V | ProjectScript", () => {
    testCompileScript(
      "V | ProjectScript",
      getProjectScriptV({ projectsAuthTokenMph: "", protocolNftMph: "" })
    );
  });

  test("AT | Project", () => {
    testCompileScript("AT | Project", getProjectAt(""));
  });

  test("SV | Project", () => {
    testCompileScript(
      "SV | Project",
      getProjectSv({
        projectId: "",
        _stakingSeed: "",
        projectsAuthTokenMph: "",
        protocolNftMph: "",
      })
    );
  });
});

describe("Backing", () => {
  test("V | Backing", () => {
    testCompileScript(
      "V | Backing",
      getBackingV({ proofOfBackingMph: "", protocolNftMph: "" })
    );
  });

  test("MP | Proof of Backing", () => {
    testCompileScript(
      "MP | Proof of Backing",
      getProofOfBackingMp({
        projectsAuthTokenMph: "",
        protocolNftMph: "",
        teikiMph: "",
      })
    );
  });
});

describe("Treasuries", () => {
  test("V | Dedicated Treasury", () => {
    testCompileScript(
      "V | Dedicated Treasury",
      getDedicatedTreasuryV({ projectsAuthTokenMph: "", protocolNftMph: "" })
    );
  });

  test("V | Shared Treasury", () => {
    testCompileScript(
      "V | Shared Treasury",
      getSharedTreasuryV({
        projectsAuthTokenMph: "",
        protocolNftMph: "",
        teikiMph: "",
      })
    );
  });

  test("V | Open Treasury", () => {
    testCompileScript("V | Open Treasury", getOpenTreasuryV(""));
  });
});
