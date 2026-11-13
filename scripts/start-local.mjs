import {spawn} from 'node:child_process';
import {mkdirSync,openSync,closeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT||4173);
const url=`http://127.0.0.1:${port}`;
async function ready(){
 try{
  const response=await fetch(url+'/api/session',{signal:AbortSignal.timeout(1000)});
  return response.ok&&(await response.json()).local===true;
 }catch{return false}
}
function report(){console.log(`摄影集已在后台运行，关闭启动窗口不会停止服务。\n展示页：${url}\n管理后台：${url}/admin`)}
if(await ready()){
 report();
}else{
 const logs=resolve(root,'data');mkdirSync(logs,{recursive:true});
 const output=openSync(resolve(logs,'server.log'),'a');
 const error=openSync(resolve(logs,'server-error.log'),'a');
 const child=spawn(process.execPath,[resolve(root,'server/local.mjs')],{
  cwd:root,detached:true,windowsHide:true,stdio:['ignore',output,error],env:process.env
 });
 closeSync(output);closeSync(error);
 let failure;child.once('error',e=>{failure=e});child.unref();
 let running=false;
 for(let attempt=0;attempt<40;attempt++){
  if(failure)throw failure;
  if(await ready()){running=true;break}
  await new Promise(r=>setTimeout(r,250));
 }
 if(!running)throw Error('服务启动失败，请检查 data/server-error.log，确认端口未被其他程序占用。');
 report();
}
