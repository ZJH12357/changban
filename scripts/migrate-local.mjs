import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,readFileSync,readdirSync } from 'node:fs';
mkdirSync('.data',{recursive:true});
const db=new DatabaseSync('.data/changban.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){if(db.prepare('SELECT name FROM local_migrations WHERE name=?').get(file))continue;db.exec('BEGIN');try{db.exec(readFileSync('drizzle/'+file,'utf8'));db.prepare('INSERT INTO local_migrations VALUES (?)').run(file);db.exec('COMMIT');console.log('Applied '+file);}catch(e){db.exec('ROLLBACK');throw e;}}
db.close();
