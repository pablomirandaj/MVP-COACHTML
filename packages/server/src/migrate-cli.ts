import { createPool } from "./db";
import { migrate } from "./migrate";
const db = createPool(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:55432/fcs");
await migrate(db, (m) => console.log(m));
await db.end();
