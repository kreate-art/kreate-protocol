import { ByteArray, Static, String, Struct } from "../uplc";

export const ProjectId = Struct({ id: ByteArray });
export type ProjectId = Static<typeof ProjectId>;

export const IpfsCid = Struct({ cid: String });
export type IpfsCid = Static<typeof IpfsCid>;
