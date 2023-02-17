import { header, helios } from "../../program";

export default helios`
  ${header("module", "mp__teiki__types")}

  enum Redeemer {
    Mint
    Burn
    Evolve
  }
`;
