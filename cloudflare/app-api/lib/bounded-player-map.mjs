// Request-local scheduling only: no cache, polling, queries or persistent state.
export async function boundedPlayerMap(items,operation,limit=3){
 if(!Number.isInteger(limit)||limit<1)throw new TypeError('Invalid player concurrency');
 const result=new Array(items.length);let cursor=0,failed=false;
 async function work(){while(!failed&&cursor<items.length){const index=cursor++;try{result[index]=await operation(items[index],index)}catch(error){failed=true;throw error}}}
 await Promise.all(Array.from({length:Math.min(limit,items.length)},work));
 return result;
}
