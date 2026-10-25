import chromium from '@sparticuz/chromium'; import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const dist=process.argv[2], out=process.argv[3]; fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png'};
const srv=http.createServer((q,s)=>{let f=path.join(dist,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);}).listen(0);
const b=await puppeteer.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],headless:'shell'});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.setViewport({width:900,height:640});
await p.goto(`http://127.0.0.1:${srv.address().port}/index.html?debug&q=low&tod=day`);
await p.waitForFunction('window.__mq3d&&window.__mq3d.hero.ready',{timeout:90000});
await p.evaluate('window.__mq3d.progress={...window.__mq3d.progress,xp:900}; window.__mq3d.openWardrobe(); document.querySelector(".mq-cs-panel").style.display="none"; document.querySelector(".mq-cs-view").style.display="none"');
const looks=[
 ['guard',{hair:'hair-crop',outfit:'outfit-guard',legs:'legs-guard',headgear:'helm-guard',cape:'cape-guard',weapon:'sword-great',offhand:null}],
 ['mage',{hair:'hair-moon',outfit:'outfit-moon',legs:'legs-moon',headgear:'hat-moon',cape:'cape-moon',weapon:'staff-moon',offhand:null}],
 ['clan',{hair:'hair-clan',outfit:'outfit-clan',legs:'legs-clan',headgear:'hat-bear',cape:'cape-fur',weapon:'axe-clan',offhand:'shield-clan'}],
 ['ranger-dual-leaf',{hair:'hair-hood',outfit:'outfit-ranger',legs:'legs-ranger',headgear:'leaf-crown',cape:'cape-ranger',weapon:'dagger-ranger',offhand:'dagger-spare'}],
];
for(const [name,l] of looks){
  await p.evaluate(`(()=>{const g=window.__mq3d;for(const [s,id] of Object.entries(${JSON.stringify(l)}))g.equip(s,id);})()`);
  await new Promise(r=>setTimeout(r,1200));
  const state=await p.evaluate('JSON.stringify(window.__mq3d.cosmetics.equipped)');
  console.log(name,state);
  await p.screenshot({path:`${out}/look-${name}.png`});
}
// recolour: tunic crimson, skin tone, hat tint
await p.evaluate(`(()=>{const g=window.__mq3d;g.equip('outfit','outfit-guard');g.equip('headgear','hat-moon');g.equip('weapon','sword-hero');g.equip('cape','cape-ranger');g.equip('offhand','shield-badge');g.hero.setLook({hood:3,tunic:2,trousers:4,boots:6,gear:3,skin:3,steel:2,eyes:2});})()`);
await new Promise(r=>setTimeout(r,1200)); await p.screenshot({path:`${out}/look-recolour.png`});
console.log('errors',JSON.stringify(errs)); await b.close(); srv.close();
