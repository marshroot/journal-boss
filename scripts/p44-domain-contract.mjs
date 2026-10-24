import fs from 'node:fs';

const env = fs.readFileSync('.env.example','utf8');
const compose = fs.readFileSync('docker-compose.yml','utf8');
const collab = fs.readFileSync('frontend/src/lib/collab.ts','utf8');
const checks = [
  ['env CORS uses localhost', env.includes('CORS_ORIGIN=http://localhost:3000')],
  ['public domain is absent from local env template', !env.includes('journalmod.dpdns.org')],
  ['compose frontend binds only to loopback', compose.includes('127.0.0.1:3000:80')],
  ['compose has no default public proxy', !/^  proxy:/m.test(compose)],
  ['same-origin collaboration fallback exists', collab.includes('/collab/') && collab.includes("window.location.protocol === 'https:' ? 'wss:' : 'ws:'")],
];
let failed=0;
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
if (failed) process.exit(1);
console.log(`Localhost contract: ${checks.length}/${checks.length} PASS`);
