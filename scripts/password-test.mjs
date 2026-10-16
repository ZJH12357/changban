import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { hashPassword, verifyPassword, PASSWORD_ITERATIONS } from '../lib/password.ts';

const salt='00112233445566778899aabbccddeeff',password='常伴Demo2026';
const expected=pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex');
const original=crypto.subtle.deriveBits.bind(crypto.subtle), costs=[];
try {
  // Reproduce the production ceiling, which Node's normal implementation does not enforce.
  crypto.subtle.deriveBits=async function(algorithm,...args){
    costs.push(algorithm.iterations);
    if(algorithm.iterations>100000)throw new DOMException('iteration counts above 100000 are not supported','NotSupportedError');
    return original(algorithm,...args);
  };
  const stored=await hashPassword(password,salt);
  assert.equal(PASSWORD_ITERATIONS,100000);
  assert.equal(stored,'pbkdf2_sha256$100000$'+expected);
  assert.equal(await verifyPassword(password,salt,stored),true);
  assert.equal(await verifyPassword('Wrong2026',salt,stored),false);
  assert.equal(await verifyPassword(password,'ffeeddccbbaa99887766554433221100',stored),false);
  assert.equal(await verifyPassword(password,salt,'pbkdf2_sha256$999999999$'+expected),false);
  assert.equal(await verifyPassword(password,salt,'malformed'),false);
  assert.ok(costs.length>=4&&costs.every(cost=>cost<=100000));
} finally { crypto.subtle.deriveBits=original; }

const legacy=pbkdf2Sync(password,Buffer.from(salt,'hex'),120000,32,'sha256').toString('hex');
assert.equal(await verifyPassword(password,salt,legacy),true);
assert.equal(await verifyPassword('Wrong2026',salt,legacy),false);
await assert.rejects(()=>hashPassword(password,'invalid-salt'));
console.log('PASS: simulated Workers ceiling, independently derived hashes, correct/wrong passwords, malformed records, and legacy 120k local hashes.');
