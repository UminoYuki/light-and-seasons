const MAX = 20 * 1024 * 1024;
export const initial = {
  profile: { name: 'yuki', tagline: '在寻常里，留住片刻。', bio: '从鸟与日常开始，慢慢积攒一部自己的摄影集。去看、去等待，也去记录光线经过的地方。', camera: 'Sony A6700', lens: 'Sony FE 70–200mm GM II · 1.4× 增距镜' },
  series: [], photos: []
};
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
async function load(env) {
  let row = await env.DB.prepare('SELECT body, version FROM portfolio WHERE id=1').first();
  if (!row) {
    await env.DB.prepare('INSERT OR IGNORE INTO portfolio(id,version,body) VALUES(1,0,?)').bind(JSON.stringify(initial)).run();
    row = await env.DB.prepare('SELECT body, version FROM portfolio WHERE id=1').first();
  }
  return { ...JSON.parse(row.body), version:row.version };
}
function check(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.series) || !Array.isArray(data.photos) || !data.profile) fail('数据格式不正确');
  if (data.series.length>500 || data.photos.length>10000) fail('内容数量超出限制');
  for (const v of Object.values(data.profile)) if (typeof v!=='string' || v.length>4000) fail('个人资料格式不正确');
  const ids=new Set();
  for (const s of data.series) {
    if (!/^[\w-]{1,80}$/.test(s.id) || ids.has(s.id)) fail('系列 ID 不正确'); ids.add(s.id);
    for (const k of ['title','description','location','camera','lens','category','year']) if (typeof s[k]!=='string' || s[k].length>3000) fail('系列字段不正确');
    if (!s.title.trim() || typeof s.published!=='boolean') fail('请填写系列名称和发布状态');
  }
  const photoIds=new Set();
  for (const p of data.photos) {
    if (!/^[\w-]{1,80}$/.test(p.id)||photoIds.has(p.id)||!ids.has(p.seriesId)) fail('照片所属系列不正确'); photoIds.add(p.id);
    if (typeof p.url!=='string' || !/^\/media\/[\w.-]+$/.test(p.url)) fail('照片地址必须来自上传文件');
    for (const k of ['title','date','focal','aperture','shutter','iso','camera','lens','location']) if (typeof p[k]!=='string'||p[k].length>1000) fail('照片信息不正确');
    for (const [k,max] of [['lat',90],['lng',180]]) if (p[k]!==null && (typeof p[k]!=='number'||!Number.isFinite(p[k])||Math.abs(p[k])>max)) fail('GPS 坐标不正确');
  }
  for (const s of data.series) if (s.cover && !data.photos.some(p=>p.id===s.cover&&p.seriesId===s.id)) fail('封面必须属于当前系列');
}
export async function api(request,env) {
 try {
  const url=new URL(request.url), path=url.pathname;
  const auth=env.LOCAL ? request.headers.get('cookie')?.split(';').some(c=>c.trim()==='portfolio_session='+env.LOCAL_TOKEN) : !!request.headers.get('oai-authenticated-user-id');
  if (path==='/api/session' && request.method==='GET') return json({authenticated:auth,local:!!env.LOCAL});
  if (!['GET','HEAD'].includes(request.method)) {
    if (request.headers.get('origin') && request.headers.get('origin')!==url.origin) fail('来源不被允许',403);
    if (!auth) fail('请先进入管理后台',401);
  }
  if(path==='/api/portfolio' && request.method==='GET') {
    const data=await load(env);
    if(url.searchParams.get('admin')==='1') { if(!auth) fail('需要管理员登录',401); return json(data); }
    const visible=new Set(data.series.filter(s=>s.published).map(s=>s.id));
    return json({...data,series:data.series.filter(s=>visible.has(s.id)),photos:data.photos.filter(p=>visible.has(p.seriesId))});
  }
  if(path==='/api/portfolio' && request.method==='PUT') {
    const body=await request.text(); if(body.length>3*1024*1024) fail('内容过大',413);
    let data; try{data=JSON.parse(body)}catch{fail('JSON 格式不正确')}; check(data);
    const version=data.version; if(!Number.isInteger(version)) fail('缺少版本号'); delete data.version;
    const result=await env.DB.prepare('UPDATE portfolio SET body=?,version=version+1 WHERE id=1 AND version=?').bind(JSON.stringify(data),version).run();
    if(!result.meta.changes) fail('内容已在另一窗口更新，请刷新后重试',409);
    return json({...data,version:version+1});
  }
  if(path==='/api/upload' && request.method==='POST') {
    if(Number(request.headers.get('content-length')||0)>MAX) fail('每张照片最大 20 MB',413);
    // Bound the stream even if a sender omits Content-Length.
    const reader=request.body?.getReader(); if(!reader) fail('没有文件');
    let size=0; const chunks=[];
    while(true){const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>MAX){await reader.cancel();fail('每张照片最大 20 MB',413)} chunks.push(value)}
    const bytes=new Uint8Array(size); let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
    let ext,type;
    if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){ext='jpg';type='image/jpeg'}
    else if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){ext='png';type='image/png'}
    else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'){ext='webp';type='image/webp'}
    else fail('支持 JPEG、PNG、WebP 图片');
    const key=crypto.randomUUID()+'.'+ext;
    await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
    return json({url:'/media/'+key},201);
  }
  if(path.startsWith('/media/') && ['GET','HEAD'].includes(request.method)) {
    const key=path.slice(7); if(!/^[\w.-]+$/.test(key))fail('文件不存在',404);
    // A draft's files are protected even when its URL is known.
    const data=await load(env); const p=data.photos.find(p=>p.url===path);
    if(!auth && (!p || !data.series.some(s=>s.id===p.seriesId&&s.published)))fail('文件不存在',404);
    const file=await env.BUCKET.get(key);if(!file)fail('文件不存在',404);
    return new Response(request.method==='HEAD'?null:file.body,{headers:{'Content-Type':file.httpMetadata.contentType,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
  }
  return json({error:'接口不存在'},404);
 }catch(e){return json({error:e.status?e.message:'服务暂时不可用，请稍后重试'},e.status||500)}
}
