import assert from 'node:assert/strict';
const origin=process.env.API_BASE||'https://courtwatch-app-api.ckrk9ggvrb.workers.dev';
for(const name of ['it','fr','gb','kz','mx-flat','pk','lk','eg','tw','lb','za']){
 const url=new URL('/flags/'+name+'.svg',origin);
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200,`${url.pathname}: HTTP ${response.status}`);
 assert.match(response.headers.get('Content-Type')||'',/image\/svg\+xml/i,`${url.pathname}: must be an SVG image`);
 assert.match(await response.text(),/<svg\b/,`${url.pathname}: SVG content missing`);
}
console.log(JSON.stringify({staticFlags:'green',images:11}));
