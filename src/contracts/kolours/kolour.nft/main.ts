import {
  KOLOUR_TX_DEADLINE,
  KOLOUR_TX_MAX_DURATION,
} from "@/transactions/kolours/constants";
import { Hex } from "@/types";

import { HeliosScript, header, helios } from "../../program";

export type Params = {
  producerPkh: Hex;
};

export default function main({ producerPkh }: Params): HeliosScript {
  return helios`
  ${header("minting", "nft__kolour")}

  const TX_TTL: Duration = Duration::new(${KOLOUR_TX_MAX_DURATION.toString()})
  const TX_DEADLINE: Time = Time::new(${KOLOUR_TX_DEADLINE.toString()})

  const PRODUCER_PKH: PubKeyHash = PubKeyHash::new(#${producerPkh})

  enum Redeemer {
    Mint
    Burn
  }

  func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool{
    tx: Tx = ctx.tx;
    own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();
    own_minted: Map[ByteArray]Int = tx.minted.get_policy(own_mph);

    redeemer.switch {
      Mint => {
        tx_time_start: Time = tx.time_range.start;
        tx_time_end: Time = tx.time_range.end;

        own_minted.all(
          (_, amount: Int) -> Bool { amount == 1 }
        )
          && tx_time_end <= tx_time_start + TX_TTL
          && tx_time_end <= TX_DEADLINE
          && tx.is_signed_by(PRODUCER_PKH)
      },
      Burn => {
        own_minted.all(
          (_, amount: Int) -> Bool { amount < 0 }
        )
      }
    }
  }
  `;
}
