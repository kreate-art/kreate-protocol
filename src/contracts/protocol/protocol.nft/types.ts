import { header, helios } from "../../program";

export default helios`
  ${header("module", "nft__protocol__types")}

  enum Redeemer {
    Bootstrap
  }
`;
