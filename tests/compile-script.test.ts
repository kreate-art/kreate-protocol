import { bytesToHex } from "@hyperionbt/helios";

import getBackingV from "@/contracts/backing/backing.v/main";
import getProofOfBackingMp from "@/contracts/backing/proof-of-backing.mp/main";
import { toUplcProgram } from "@/contracts/compile";
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

describe("Meta-Protocol", () => {
  test("NFT | Teiki Plant", () => {
    const uplcProgram = toUplcProgram(
      getTeikiPlantNft({ teikiPlantSeed: { txHash: "", outputIndex: 1 } })
    );
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `NFT | Teiki Plant -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("V | Teiki Plant", () => {
    const uplcProgram = toUplcProgram(getTeikiPlantV(""));
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Teiki Plant -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("MP | Teiki", () => {
    const uplcProgram = toUplcProgram(getTeikiMp({ nftTeikiPlantMph: "" }));
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `MP | Teiki -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });
});

describe("Protocol", () => {
  test("NFT | Protocol", () => {
    const uplcProgram = toUplcProgram(getProtocolNft("", "0"));
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `NFT | Protocol -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("V | Protocol Params", () => {
    const uplcProgram = toUplcProgram(getProtocolParamsV(""));
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Protocol Params -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("V | Protocol Proposal", () => {
    const uplcProgram = toUplcProgram(getProtocolProposalV(""));
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Protocol Proposal -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("V | Protocol Script", () => {
    const uplcProgram = toUplcProgram(getProtocolScriptV(""));
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Protocol Script -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("SV | Protocol", () => {
    const uplcProgram = toUplcProgram(getProtocolSv(""));
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `SV | Protocol -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });
});

describe("Project", () => {
  test("V | Project", () => {
    const uplcProgram = toUplcProgram(
      getProjectV({ projectsAuthTokenMph: "", protocolNftMph: "" })
    );
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Project -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("V | Project Detail", () => {
    const uplcProgram = toUplcProgram(
      getProjectDetailV({ projectsAuthTokenMph: "", protocolNftMph: "" })
    );
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Project Detail -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("V | ProjectScript", () => {
    const uplcProgram = toUplcProgram(
      getProjectScriptV({ projectsAuthTokenMph: "", protocolNftMph: "" })
    );
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | ProjectScript -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("AT | Project", () => {
    const uplcProgram = toUplcProgram(getProjectAt(""));
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `AT | Project -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("SV | Project", () => {
    const uplcProgram = toUplcProgram(
      getProjectSv({
        projectId: "",
        _stakingSeed: "",
        projectsAuthTokenMph: "",
        protocolNftMph: "",
      })
    );
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `SV | Project -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });
});

describe("Backing", () => {
  test("V | Backing", () => {
    const uplcProgram = toUplcProgram(
      getBackingV({
        proofOfBackingMph: "",
        protocolNftMph: "",
      })
    );
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Backing -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("MP | Proof of Backing", () => {
    const uplcProgram = toUplcProgram(
      getProofOfBackingMp({
        projectsAuthTokenMph: "",
        protocolNftMph: "",
        teikiMph: "",
      })
    );
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `MP | Proof of Backing -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });
});

describe("Treasuries", () => {
  test("V | Dedicated Treasury", () => {
    const uplcProgram = toUplcProgram(
      getDedicatedTreasuryV({ projectsAuthTokenMph: "", protocolNftMph: "" })
    );
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Dedicated Treasury -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("V | Shared Treasury", () => {
    const uplcProgram = toUplcProgram(
      getSharedTreasuryV({
        projectsAuthTokenMph: "",
        protocolNftMph: "",
        teikiMph: "",
      })
    );
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Shared Treasury -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });

  test("V | Open Treasury", () => {
    const uplcProgram = toUplcProgram(getOpenTreasuryV(""));
    expect(uplcProgram.serialize().length > 0).toBe(true);
    console.log(
      `V | Open Treasury -  ${uplcProgram.calcSize()} | ${bytesToHex(
        uplcProgram.hash()
      )}`
    );
  });
});
