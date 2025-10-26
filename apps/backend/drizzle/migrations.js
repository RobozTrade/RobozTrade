import journal from './meta/_journal.json';
import m0000 from './0000_open_hulk.sql';
import m0001 from './0001_hard_brood.sql';
import m0002 from './0005_store_ai_transcripts.sql';
import m0003 from './0006_store_ai_metadata.sql';
import m0004 from './0007_add_notional_limits.sql';
import m0005 from './0005_wonderful_whizzer.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }
  