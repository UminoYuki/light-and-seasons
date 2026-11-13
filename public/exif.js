// JPEG / TIFF EXIF reader. Missing metadata remains empty; never fabricate camera values.
export function readExif(buffer) {
 const out={};try{
  const v=new DataView(buffer);if(v.byteLength<4||v.getUint16(0)!==0xffd8)return out;
  let base=-1;for(let pos=2;pos+4<v.byteLength;){if(v.getUint8(pos)!==255)break;const marker=v.getUint8(pos+1);if(marker===218||marker===217)break;const len=v.getUint16(pos+2);if(len<2||pos+2+len>v.byteLength)break;if(marker===225&&v.getUint32(pos+4)===0x45786966&&v.getUint16(pos+8)===0){base=pos+10;break}pos+=2+len}
  if(base<0)return out;const le=v.getUint16(base)===0x4949;const u16=p=>v.getUint16(p,le),u32=p=>v.getUint32(p,le);if(u16(base+2)!==42)return out;
  const sizes={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
  function ifd(offset){const p=base+offset,n=u16(p),result={};if(n>1000)throw Error('Invalid EXIF');for(let i=0;i<n;i++){const t=p+2+12*i,tag=u16(t),type=u16(t+2),count=u32(t+4),length=sizes[type]*count;if(!length||length>100000)continue;const start=length<=4?t+8:base+u32(t+8);if(start<0||start+length>v.byteLength)continue;if(type===2){result[tag]=new TextDecoder().decode(new Uint8Array(buffer,start,count)).replace(/\0.*$/s,'').trim();continue}const a=[];for(let j=0;j<count;j++){const q=start+j*sizes[type];a.push(type===3?u16(q):type===4?u32(q):type===5?u32(q)/u32(q+4):type===10?v.getInt32(q,le)/v.getInt32(q+4,le):v.getUint8(q))}result[tag]=count===1?a[0]:a}return result}
  const root=ifd(u32(base+4)),ex=root[0x8769]?ifd(root[0x8769]):{};out.camera=root[0x110]||'';out.lens=ex[0xa434]||'';
  if(ex[0x920a])out.focal=`${Number(ex[0x920a].toFixed(1))} mm`;
  if(ex[0x829d])out.aperture=`f/${Number(ex[0x829d].toFixed(1))}`;
  if(ex[0x829a])out.shutter=ex[0x829a]<1?`1/${Math.round(1/ex[0x829a])} s`:`${ex[0x829a]} s`;
  if(ex[0x8827])out.iso=String(ex[0x8827]);if(ex[0x9003])out.date=ex[0x9003].slice(0,10).replaceAll(':','-');
  if(root[0x8825]){const g=ifd(root[0x8825]);const coord=(a,ref)=>Array.isArray(a)?(a[0]+a[1]/60+a[2]/3600)*(['S','W'].includes(ref)?-1:1):null;out.lat=coord(g[2],g[1]);out.lng=coord(g[4],g[3]);if(!Number.isFinite(out.lat)||!Number.isFinite(out.lng)){out.lat=null;out.lng=null}}
 }catch{}return out;
}
