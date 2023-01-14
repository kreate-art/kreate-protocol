import { setDefaultOptions } from "@/contracts/compile";

setDefaultOptions({
  simplify: Boolean(Number(process.env.CONTRACTS_SIMPLIFY || "0")),
});
