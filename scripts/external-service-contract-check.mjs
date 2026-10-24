#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const failures=[]; const read=r=>fs.readFileSync(path.join(root,r),'utf8'); const ok=(c,m)=>c?console.log(`PASS ${m}`):failures.push(m);
const judge=read('backend/JournalBackend/Judge0Client.cs');
const live=read('backend/JournalBackend/Controllers/OnlineLessonsController.cs');
const compose=read('docker-compose.yml');
ok(judge.includes('cpu_time_limit=2.0'),'Judge0 CPU limit is 2 seconds');
ok(judge.includes('wall_time_limit=5.0'),'Judge0 wall-clock limit is 5 seconds');
ok(judge.includes('memory_limit=128000'),'Judge0 memory limit is 128 MB');
ok(judge.includes('enable_network=false'),'Judge0 network access is disabled');
ok(judge.includes('MaxOutputChars = 20000'),'Judge0 output is capped');
ok(live.includes('LIVEKIT_API_KEY') && live.includes('LIVEKIT_API_SECRET'),'LiveKit requires API credentials');
ok(live.includes('LIVEKIT_SERVER_URL'),'LiveKit requires server URL');
ok(live.includes('isModerator'),'LiveKit token encodes moderator permissions');
ok(compose.includes('LIVEKIT_TOKEN_TTL_SECONDS'),'LiveKit token TTL is configurable');
if(failures.length){console.error(failures.map(x=>`FAIL ${x}`).join('\n'));process.exit(1)}
console.log('All external service contract checks passed.');
