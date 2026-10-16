import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
export const localPreview = true;
let db: DatabaseSync;
export function database(): D1Database {
 if (!db) { mkdirSync(resolve(".data"), {recursive:true}); db = new DatabaseSync(resolve(".data/changban.sqlite")); db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;"); }
 const prepare = (sql:string) => {
  let values: (string|number|null)[] = [];
  const api = {bind(...v:(string|number|null)[]){values=v;return api;},async first(){return db.prepare(sql).get(...values) ?? null;},async all(){return {results:db.prepare(sql).all(...values),success:true};},async run(){const r=db.prepare(sql).run(...values); return {success:true,meta:{changes:Number(r.changes)}};}};
  return api;
 };
 return {prepare,async batch(statements:{run:()=>Promise<unknown>}[]){db.exec("BEGIN");try{const out=[];for(const s of statements)out.push(await s.run());db.exec("COMMIT");return out;}catch(e){db.exec("ROLLBACK");throw e;}}} as unknown as D1Database;
}
