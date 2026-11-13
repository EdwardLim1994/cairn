import { resolve } from "node:path";
import { openEmbeddedStores } from "../server/db/embedded";

const directory = resolve(process.env.CAIRN_DATA_DIR?.trim() || "data");
const stores = await openEmbeddedStores(directory);
stores.close();
console.log(`Embedded database migrations complete in ${directory}`);
