const VERSION='md-v3.0.0';
const STATIC_CACHE=`${VERSION}-static`;
const PAGE_CACHE=`${VERSION}-pages`;
const DB_NAME='md-offline-queue';
const STORE='requests';
const QUEUEABLE_PREFIXES=['/md/interventions','/md/graduation','/tasks','/monitoring','/milestones','/documents','/science','/seminars'];
const STATIC_ASSETS=['/offline','/manifest.webmanifest','/static/css/app.css','/static/js/app.js','/static/js/help.js','/static/js/pwa.js','/static/icons/md-192.png','/static/icons/md-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>!k.startsWith(VERSION)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id',autoIncrement:true})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function queueRequest(request){
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.includes('application/x-www-form-urlencoded')) throw new Error('not-queueable');
  const body=await request.clone().text(); const headers={}; request.headers.forEach((v,k)=>{if(!['content-length','host'].includes(k.toLowerCase()))headers[k]=v});
  const database=await db(); return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readwrite');tx.objectStore(STORE).add({url:request.url,method:request.method,headers,body,createdAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
}
async function replayQueue(){
  const database=await db();
  const rows=await new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readonly');const r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
  for(const row of rows){
    try{
      const response=await fetch(row.url,{method:row.method,headers:row.headers,body:row.body,credentials:'include',redirect:'follow'});
      if((response.ok||response.redirected) && !new URL(response.url).pathname.startsWith('/login')){await new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(row.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
    }catch(_){break}
  }
}
self.addEventListener('sync',event=>{if(event.tag==='md-sync')event.waitUntil(replayQueue())});
self.addEventListener('message',event=>{if(event.data?.type==='REPLAY_QUEUE')event.waitUntil(replayQueue())});

self.addEventListener('fetch', event => {
  const request=event.request; const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  if(request.method==='POST'){
    if(url.pathname==='/logout'){
      event.respondWith((async()=>{
        const response=await fetch(request.clone());
        if(response.ok||response.redirected) await caches.delete(PAGE_CACHE);
        return response;
      })());
      return;
    }
    const canQueue=QUEUEABLE_PREFIXES.some(prefix=>url.pathname.startsWith(prefix));
    if(!canQueue) return;
    event.respondWith((async()=>{
      try{
        const response=await fetch(request.clone());
        return response;
      }catch(error){
        try{
          await queueRequest(request);
          if(self.registration.sync) try{await self.registration.sync.register('md-sync')}catch(_){}
          const accepts=request.headers.get('accept')||'';
          if(accepts.includes('text/html')) return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MD — saqlandi</title><style>body{font-family:Segoe UI,Arial;background:#f2faf5;color:#173b2a;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}.b{max-width:520px;background:white;border:1px solid #d4eadc;border-radius:20px;padding:28px;box-shadow:0 20px 60px #1a724d1c}.x{font-size:42px;color:#169b68}button{border:0;background:#169b68;color:white;border-radius:10px;padding:10px 14px}</style><div class="b"><div class="x">✓</div><h2>O‘zgarish qurilmada saqlandi</h2><p>Internet aloqasi qaytganda MD bu ma’lumotni avtomatik yuborishga urinadi.</p><button onclick="history.back()">Orqaga qaytish</button></div>',{status:202,headers:{'Content-Type':'text/html; charset=utf-8'}});
          return new Response(JSON.stringify({queued:true}),{status:202,headers:{'Content-Type':'application/json'}});
        }catch(_){throw error}
      }
    })());
    return;
  }
  if(request.method!=='GET') return;
  if(url.pathname.startsWith('/static/')||url.pathname==='/manifest.webmanifest'){
    event.respondWith(caches.match(request,{ignoreSearch:true}).then(cached=>cached||fetch(request).then(response=>{const copy=response.clone();caches.open(STATIC_CACHE).then(c=>c.put(request,copy));return response})).catch(()=>caches.match('/offline')));
    return;
  }
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok && !url.pathname.startsWith('/login')){const copy=response.clone();caches.open(PAGE_CACHE).then(c=>c.put(request,copy));}
        return response;
      }catch(_){return (await caches.match(request)) || (await caches.match('/offline'));}
    })());
  }
});
