import chromium from '@sparticuz/chromium'; import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const dist=process.argv[2], out=process.argv[3]; const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png'};
const srv=http.createServer((q,s)=>{let f=path.join(dist,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);}).listen(0);
const url=`http://127.0.0.1:${srv.address().port}/index.html?debug&q=low&tod=day`;
const b=await puppeteer.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],headless:'shell'});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); await p.setViewport({width:480,height:400});
await p.goto(url); await p.evaluate('localStorage.clear()'); await p.goto(url); await p.waitForFunction('window.__mq3d&&window.__mq3d.hero.ready',{timeout:90000});
await p.evaluate(`(()=>{const g=window.__mq3d;g.progress={...g.progress,xp:900};g.openWardrobe();document.querySelector('.mq-cs-panel').style.display='none';document.querySelector('.mq-cs-view').style.display='none';g.previewPose='slash';g.wardrobeHeading=1.2;})()`);
fs.mkdirSync(out,{recursive:true});
const ALL=[['sword','sword-hero',null],['greatsword','sword-great',null],['staff','staff-moon',null],['dual','dagger-ranger','dagger-spare']];
for (const [name,weapon,off] of ALL.filter(w=>process.argv[4].split(',').includes(w[0]))) {
  await p.evaluate(`(()=>{const g=window.__mq3d;g.equip('offhand',null);g.equip('weapon','${weapon}');${off?`g.equip('offhand','${off}');`:''}})()`);
  for(let i=0;i<5;i++){ await new Promise(r=>setTimeout(r,160)); fs.writeFileSync(`${out}/slash-${name}-${i}.png`,await p.screenshot()); }
  console.log('captured',name);
}
console.log('errors',JSON.stringify(errs)); await b.close(); srv.close();
