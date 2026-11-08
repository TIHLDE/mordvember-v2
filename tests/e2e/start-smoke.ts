import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const base = process.env.E2E_BASE ?? 'http://localhost:3100';
for (const [path, expected] of [['/login',200],['/status',200],['/dev',404],['/api/brukersok',401],['/sjekkinn',307],['/sjekkinn?feil=kode',200],['/api/cron',401],['/api/auth/callback',307],['/admin/sirkel?x=1',307]] as const) {
 const response = await fetch(base+path,{redirect:'manual'});
 assert.equal(response.status,expected,path);
 assert.equal(response.headers.get('x-frame-options'),'DENY',path);
 assert.equal(response.headers.get('cache-control'),'no-store',path);
 if(path.startsWith('/admin')) assert.equal(response.headers.get('location'),'/login?next=%2Fadmin%2Fsirkel%3Fx%3D1');
 const body = await response.text();
 if(path === '/login') { assert.match(body,/<title>Mordvember<\/title>/); assert.match(body,/noindex, nofollow/); }
 console.log(path, response.status);
}
const logout=await fetch(base+'/api/auth/logout',{method:'POST',redirect:'manual'});
assert.equal(logout.status,303); assert.match(logout.headers.get('set-cookie') ?? '',/mv_session=; Max-Age=0; Path=\//);
console.log('logout cookie / redirect', logout.status);
const files=readdirSync('.output/server/_ssr');
const code=files.filter(f=>/^actions-.*\.mjs$/.test(f)).map(f=>readFileSync('.output/server/_ssr/'+f,'utf8')).join('\n');
const match=code.match(/id: "([a-f0-9]+)",\s+name: "signUpActionRpc"/);
assert.ok(match, 'Build the application before running the smoke check');
const id=match[1];
for(const chunked of [false,true]) {
 const payload='x'.repeat(6*1024*1024+1);
 const body=chunked?new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode(payload));controller.close();}}):payload;
 const options = { method: 'POST', body, duplex: 'half', headers: { 'content-type': 'text/plain', 'x-tsr-serverFn': 'true' } };
 const response=await fetch(base+'/_serverFn/'+id,options);
 assert.equal(response.status,413, await response.text());
 console.log('upload limit'+(chunked?' chunked':''), response.status);
}

const login = await fetch(base + '/login');
const html = await login.text();
const asset = html.match(/(?:src|href)="(\/assets\/[^"]+\.js)"/);
assert.ok(asset, 'Login page should reference a client asset');
const assetResponse = await fetch(base + asset[1]);
assert.equal(assetResponse.status, 200);
assert.equal(assetResponse.headers.get('x-content-type-options'), 'nosniff');
console.log('static asset security headers passed');

const malformedState = await fetch(base + '/api/auth/callback?code=x&state=y', {
  redirect: 'manual', headers: { cookie: 'mv_oauth=null' },
});
assert.equal(malformedState.status, 307);
assert.match(malformedState.headers.get('location') ?? '', /feil=state$/);
console.log('malformed OAuth state rejected');
