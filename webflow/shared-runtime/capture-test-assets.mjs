import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const here=new URL('./',import.meta.url);
const manifest=JSON.parse(await fs.readFile(new URL('tests/asset-manifest.json',here),'utf8'));
const cache=new URL('.cache/',here);
await fs.mkdir(cache,{recursive:true});
const integrity=body=>'sha384-'+crypto.createHash('sha384').update(body).digest('base64');
for(const asset of manifest){
  const path=new URL(asset.file,cache);
  let bytes;
  try {bytes=await fs.readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(bytes&&integrity(bytes)===asset.integrity)continue;
  const response=await fetch(asset.url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Asset returned ${response.status}: ${asset.url}`);
  bytes=Buffer.from(await response.arrayBuffer());
  if(integrity(bytes)!==asset.integrity)throw new Error(`Asset integrity changed: ${asset.url}`);
  await fs.writeFile(path,bytes);
}
console.log(`Verified ${manifest.length} pinned public test assets; cache stays local.`);
