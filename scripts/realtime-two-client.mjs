#!/usr/bin/env node
/**
 * Optional two-client integration harness.
 * Requires a running Jornal instance, two JWTs and an accessible lesson/collab room.
 * It intentionally fails when explicitly enabled and prerequisites are missing.
 */
import process from 'node:process';

const enabled = process.env.REALTIME_E2E === '1';
if (!enabled) {
  console.log('SKIP realtime two-client test: set REALTIME_E2E=1 to run against a real environment.');
  process.exit(0);
}

const baseUrl = (process.env.JORNAL_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const lessonId = Number(process.env.E2E_LESSON_ID || 0);
const tokenA = process.env.E2E_TOKEN_A || '';
const tokenB = process.env.E2E_TOKEN_B || '';
const collabTokenA = process.env.E2E_COLLAB_TOKEN_A || '';
const collabTokenB = process.env.E2E_COLLAB_TOKEN_B || '';
const collabRoom = process.env.E2E_COLLAB_ROOM || '';

for (const [name, value] of Object.entries({lessonId, tokenA, tokenB, collabTokenA, collabTokenB, collabRoom})) {
  if (!value || value === 0) throw new Error(`Missing ${name}; REALTIME_E2E=1 requires two authenticated clients and a lesson/collab room.`);
}

const { HubConnectionBuilder, HttpTransportType, LogLevel } = await import('../frontend/node_modules/@microsoft/signalr/dist/esm/index.js');
const { HocuspocusProvider } = await import('../frontend/node_modules/@hocuspocus/provider/dist/hocuspocus-provider.esm.js');
const Y = await import('../frontend/node_modules/yjs/dist/yjs.mjs');

const chatUrl = `${baseUrl}/hubs/lesson-chat`;
const connection = token => new HubConnectionBuilder()
  .withUrl(chatUrl, { accessTokenFactory: () => token, transport: HttpTransportType.WebSockets })
  .configureLogging(LogLevel.Error)
  .withAutomaticReconnect([0, 1000, 2000])
  .build();

const a = connection(tokenA), b = connection(tokenB);
const messages = [];
a.on('Message', x => messages.push(['a', x]));
b.on('Message', x => messages.push(['b', x]));
await Promise.all([a.start(), b.start()]);
await Promise.all([a.invoke('JoinLesson', lessonId), b.invoke('JoinLesson', lessonId)]);
const marker = `realtime-e2e-${Date.now()}`;
await a.invoke('SendMessage', lessonId, marker);
const deadline = Date.now() + 5000;
while (Date.now() < deadline && !messages.some(([client, x]) => client === 'b' && x?.message === marker)) await new Promise(r => setTimeout(r, 50));
if (!messages.some(([client, x]) => client === 'b' && x?.message === marker)) throw new Error('SignalR two-client delivery failed.');
await Promise.all([a.stop(), b.stop()]);
console.log('PASS SignalR two-client delivery');

const collabUrl = (process.env.E2E_COLLAB_URL || `${baseUrl.replace(/^http/, 'ws')}/collab`).replace(/\/$/, '');
const makeProvider = (token, doc) => new HocuspocusProvider({ url: collabUrl, name: collabRoom, token, document: doc });
const docA = new Y.Doc(), docB = new Y.Doc();
const pA = makeProvider(collabTokenA, docA), pB = makeProvider(collabTokenB, docB);
await Promise.all([new Promise((resolve, reject) => { const t=setTimeout(()=>reject(new Error('Hocuspocus A timeout')),7000); pA.on('synced',()=>{clearTimeout(t);resolve();}); }), new Promise((resolve, reject) => { const t=setTimeout(()=>reject(new Error('Hocuspocus B timeout')),7000); pB.on('synced',()=>{clearTimeout(t);resolve();}); })]);
const textA = docA.getText('e2e');
const textB = docB.getText('e2e');
textA.insert(0, marker);
const deadline2 = Date.now() + 5000;
while (Date.now() < deadline2 && textB.toString() !== marker) await new Promise(r => setTimeout(r, 50));
if (textB.toString() !== marker) throw new Error('Hocuspocus two-client Yjs sync failed.');
pA.destroy(); pB.destroy(); docA.destroy(); docB.destroy();
console.log('PASS Hocuspocus/Yjs two-client sync');
