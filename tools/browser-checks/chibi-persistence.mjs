import chromium from '@sparticuz/chromium'; import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const dist=process.argv[2]; const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png'};
const srv=http.createServer((q,s)=>{let f=path.join(dist,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);}).listen(0);
const url=`http://127.0.0.1:${srv.address().port}/index.html?debug&q=low&tod=day`;
const b=await puppeteer.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'],headless:'shell'});
let fails=0; const check=(n,ok,x='')=>{console.log(ok?'PASS':'FAIL',n,x); if(!ok)fails++;};
async function open(seed){ const p=await b.newPage(); await p.setViewport({width:600,height:400}); if(seed) await p.evaluateOnNewDocument(seed); await p.goto(url); await p.waitForFunction('window.__mq3d&&window.__mq3d.hero.ready',{timeout:90000}); return p; }
// progress with 500 xp (level >= 5) persisted by the game's own key
let p=await open(`if(!localStorage.getItem('x')){localStorage.setItem('x','1');localStorage.setItem('mindquest.progress.v1',JSON.stringify({v:1,xp:500,unlocked:['mossy-cloak']}));}`);
console.log('level', await p.evaluate('JSON.stringify(window.__mq3d.progress)'));
await p.evaluate('window.__mq3d.equip("weapon","axe-great"); window.__mq3d.equip("headgear","hat-moon"); window.__mq3d.equip("cape","mossy-cloak")'); await p.close();
p=await open(null);
const eq=JSON.parse(await p.evaluate('JSON.stringify(window.__mq3d.cosmetics.equipped)')); console.log(JSON.stringify(eq));
check('equipped items persist across reload when owned', eq.weapon==='axe-great' && eq.headgear==='hat-moon' && eq.cape==='mossy-cloak');
await p.evaluate('window.__mq3d.startOver && window.__mq3d.startOver()');
const eq2=JSON.parse(await p.evaluate('JSON.stringify(window.__mq3d.cosmetics.equipped)')); console.log('after start over',JSON.stringify(eq2));
check('start over drops items no longer owned', eq2.weapon==='sword-hero' && eq2.cape===null);
await p.close(); console.log(fails?'FAILED':'ALL PASS'); await b.close(); srv.close();
