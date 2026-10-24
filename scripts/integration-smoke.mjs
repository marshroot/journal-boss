#!/usr/bin/env node
import net from 'node:net';

const base = (process.env.INTEGRATION_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const backend = (process.env.INTEGRATION_BACKEND_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const collabHost = process.env.COLLAB_HOST || '127.0.0.1';
const collabPort = Number(process.env.COLLAB_PORT || 1234);
const judge0 = (process.env.JUDGE0_URL || '').replace(/\/$/, '');
const livekit = process.env.LIVEKIT_URL || '';

const failures = [];
async function check(name, url, options = {}) {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
    const ok = res.status >= 200 && res.status < 500;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${res.status}`);
    if (!ok) failures.push(`${name}: HTTP ${res.status}`);
    return res;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    console.log(`FAIL ${name} ${e.message}`);
    return null;
  }
}

function checkTcp(name, host, port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port, timeout: 5000 });
    socket.once('connect', () => { console.log(`PASS ${name} TCP ${host}:${port}`); socket.destroy(); resolve(true); });
    socket.once('error', e => { console.log(`FAIL ${name} ${e.message}`); failures.push(`${name}: ${e.message}`); resolve(false); });
    socket.once('timeout', () => { console.log(`FAIL ${name} timeout`); failures.push(`${name}: timeout`); socket.destroy(); resolve(false); });
  });
}

await check('frontend health', `${base}/health`);
await check('backend health', `${backend}/health`);
await checkTcp('Hocuspocus', collabHost, collabPort);

if (judge0) {
  await check('Judge0 system_info', `${judge0}/system_info`);
} else console.log('SKIP Judge0 (JUDGE0_URL is not configured)');

if (livekit) {
  try {
    const u = new URL(livekit);
    console.log(`PASS LiveKit URL configured ${u.protocol}//${u.host}`);
  } catch (e) {
    failures.push(`LiveKit URL: ${e.message}`);
    console.log(`FAIL LiveKit URL ${e.message}`);
  }
} else console.log('SKIP LiveKit (LIVEKIT_URL is not configured)');

if (failures.length) {
  console.error(`\n${failures.length} integration check(s) failed.`);
  process.exit(1);
}
console.log('\nAll configured integration checks passed.');
