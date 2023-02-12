import {
  compileBackingVScript,
  compileDedicatedTreasuryVScript,
  compileProjectDetailVScript,
  compileProjectScriptVScript,
  compileProjectVScript,
  compileProjectsAtMpScript,
  compileProofOfBackingMpScript,
  compileSharedTreasuryVScript,
} from "@/commands/compile-scripts";
import { getLucid } from "@/commands/utils";
import { exportScript } from "@/contracts/compile";
import { addressFromScriptHashes } from "@/helpers/lucid";

import { deployReferencedScript, printScriptHash } from "./utils";

const protocolNftMph =
  "6637245986b10d6cc16a813548e38e899a4896209eec413b65556a6d";

const teikiMph = "596f0025dc3204d33feda79f22bd4945d0861671c4cf051c6bf6ff86";

const alwaysFailScriptHash =
  "51936f3c98a04b6609aa9b5c832ba1182cf43a58e534fcc05db09d69";

const lucid = await getLucid();

const alwaysFailScriptAddress = addressFromScriptHashes(
  lucid,
  alwaysFailScriptHash
);

const projectAtScript = exportScript(
  compileProjectsAtMpScript({ protocolNftMph })
);
const projectAtMph = lucid.utils.validatorToScriptHash(projectAtScript);

const projectVScript = exportScript(
  compileProjectVScript({ projectAtMph, protocolNftMph })
);
const projectDetailVScript = exportScript(
  compileProjectDetailVScript({ projectAtMph, protocolNftMph })
);
const projectScriptVScript = exportScript(
  compileProjectScriptVScript({ projectAtMph, protocolNftMph })
);
const proofOfBackingMpScript = exportScript(
  compileProofOfBackingMpScript({ projectAtMph, protocolNftMph, teikiMph })
);
const proofOfBackingMph = lucid.utils.validatorToScriptHash(
  proofOfBackingMpScript
);
const backingVScript = exportScript(
  compileBackingVScript({ proofOfBackingMph, protocolNftMph })
);
const dedicatedTreasuryVScript = exportScript(
  compileDedicatedTreasuryVScript({ projectAtMph, protocolNftMph })
);
const sharedTreasuryVScript = exportScript(
  compileSharedTreasuryVScript({
    projectAtMph,
    protocolNftMph,
    teikiMph,
    proofOfBackingMph,
  })
);

const scripts = {
  PROJECT_AT_MPH: projectAtScript,
  PROJECT_V_SCRIPT_HASH: projectVScript,
  PROJECT_DETAIL_V_SCRIPT_HASH: projectDetailVScript,
  PROJECT_SCRIPT_V_SCRIPT_HASH: projectScriptVScript,
  PROOF_OF_BACKING_MPH: proofOfBackingMpScript,
  BACKING_V_SCRIPT_HASH: backingVScript,
  DEDICATED_TREASURY_V_SCRIPT_HASH: dedicatedTreasuryVScript,
  SHARED_TREASURY_V_SCRIPT_HASH: sharedTreasuryVScript,
};
await deployReferencedScript(
  lucid,
  Object.values(scripts),
  alwaysFailScriptAddress
);

printScriptHash(lucid, scripts);
