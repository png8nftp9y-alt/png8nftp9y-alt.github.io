import vm from 'node:vm';
export function validAppRefreshContract(source){
 const timer=source.match(/setInterval\(\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*30_?000\s*\);/)?.[0];
 if(!timer)return false;
 let callback,interval,loads=0;
 const context={location:{hash:'#agenda'},load(){loads++},setInterval(fn,ms){callback=fn;interval=ms}};
 try{
  vm.runInNewContext(timer,context,{timeout:100});
  if(interval!==30000||typeof callback!=='function')return false;
  for(const [hash,expected]of [['#agenda',1],['#calendar',1],['#player/test',1],['#opponent/test',0],['#opponent-profile/test',0]]){
   context.location.hash=hash;loads=0;callback();if(loads!==expected)return false;
  }
  return true;
 }catch{return false}
}
