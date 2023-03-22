import { getLucid, requiredEnv } from "@/commands/utils";
import { exportScript, compile } from "@/contracts/compile";
import getKolourNft from "@/contracts/kolours/kolour.nft/main";

import { alwaysFalse, deployReferencedScript, printScriptHash } from "./utils";

const lucid = await getLucid();
const kolourPkh = requiredEnv("KOLOUR_NFT_PUB_KEY_HASH");
const kreationPkh = requiredEnv("KREATION_NFT_PUB_KEY_HASH");

const alwaysFalseVScript = exportScript(compile(alwaysFalse()));
const alwaysFalseAddress = lucid.utils.validatorToAddress(alwaysFalseVScript);
console.log(
  "ALWAYS_FALSE_SCRIPT_HASH",
  lucid.utils.validatorToScriptHash(alwaysFalseVScript)
);

const kolourNftScript = exportScript(
  compile(getKolourNft({ producerPkh: kolourPkh }))
);

const genesisKreationNftScript = exportScript(
  compile(getKolourNft({ producerPkh: kreationPkh }))
);

const scripts = {
  KOLOUR_NFT_MPH: kolourNftScript,
  GENESIS_KREATION_NFT_MPH: genesisKreationNftScript,
};

await deployReferencedScript(lucid, Object.values(scripts), alwaysFalseAddress);

printScriptHash(lucid, scripts);
