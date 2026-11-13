import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {api} from './api.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const data=resolve(process.env.DATA_DIR||resolve(root,'data'));
await mkdir(resolve(data,'uploads'),{recursive:true});
const db=new DatabaseSync(resolve(data,'portfolio.sqlite'));
db.exec(await readFile(resolve(root,'migrations/0001_initial.sql'),'utf8'));
const DB={prepare(sql){let values=[];return {bind(...v){values=v;return this},async first(){return db.prepare(sql).get(...values)||null},async run(){return {meta:db.prepare(sql).run(...values)}}}}};
const BUCKET={async put(key,body,options){await writeFile(resolve(data,'uploads',key),new Uint8Array(body));await writeFile(resolve(data,'uploads',key+'.json'),JSON.stringify(options.httpMetadata))},async get(key){try{return {body:await readFile(resolve(data,'uploads',key)),httpMetadata:JSON.parse(await readFile(resolve(data,'uploads',key+'.json'),'utf8'))}}catch{return null}}};
const token=crypto.randomUUID(); const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://'+req.headers.host);
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`){res.writeHead(403);return res.end('Invalid host')}
  if(url.pathname==='/admin'&&req.method==='GET')res.setHeader('Set-Cookie',`portfolio_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/media/')){
   const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});
   const response=await api(request,{DB,BUCKET,LOCAL:true,LOCAL_TOKEN:token});
   res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end()}
  const allowed={'/app.js':'app.js','/style.css':'style.css','/exif.js':'exif.js','/favicon.svg':'favicon.svg'};
  const file=allowed[url.pathname]||(!extname(url.pathname)?'index.html':null);
  if(!file){res.writeHead(404);return res.end('Not found')}
  res.setHeader('Content-Type',mime[extname(file)]);res.setHeader('X-Content-Type-Options','nosniff');
  res.end(req.method==='HEAD'?null:await readFile(resolve(root,'public',file)));
 }catch(e){console.error(e);res.writeHead(500);res.end('Server error')}
});
server.listen(port,'127.0.0.1',()=>console.log(`摄影集 http://127.0.0.1:${port}\n管理后台 http://127.0.0.1:${port}/admin`));
