import {spawnSync} from 'node:child_process';
const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/reliability.test.ts','tests/http.test.ts'],{stdio:'inherit'});
process.exitCode=r.status??1;
