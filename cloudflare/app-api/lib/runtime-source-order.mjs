// Engine-side ancestry check; never imported by the Worker.
export async function assertRuntimeSourceOrder(previous,current,{local,compare}){
 if(previous===current)return;
 try{if(await local(previous,current))return;}catch{}
 const status=await compare(previous,current);
 if(!['ahead','identical'].includes(status))throw Error('Runtime source is older, diverged or unverifiable; publication blocked');
}
