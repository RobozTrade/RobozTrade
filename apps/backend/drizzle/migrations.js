import journal from "./meta/_journal.json";
import m0000 from "./0000_open_hulk.sql";
import m0001 from "./0001_hard_brood.sql";
import m0005 from "./0005_store_ai_transcripts.sql";
import m0006 from "./0006_store_ai_metadata.sql";

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0005,
    m0006,
  },
};
