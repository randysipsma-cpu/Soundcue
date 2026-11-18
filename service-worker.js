/* Soundcue offline shell v2; never caches audio or modifies local music storage. */
const CACHE='soundcue-shell-v2';
const FILES=['index.html','manifest.webmanifest','soundcue-icon.svg'];
const scope=self.registration.scope;
const shellURL=new URL('index.html',scope).href;
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // The main HTML must be cached successfully before offline readiness is reported.
    await cache.add(new Request(shellURL,{cache:'reload'}));
    await Promise.all(FILES.slice(1).map(async file=>{
      try{await cache.add(new Request(new URL(file,scope).href,{cache:'reload'}));}catch(err){console.warn('Optional offline asset unavailable:',file,err);}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('soundcue-shell-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SOUNDCUE_OFFLINE_STATUS'){
    event.waitUntil(caches.open(CACHE).then(cache=>cache.match(shellURL)).then(match=>{
      event.source?.postMessage({type:'SOUNDCUE_OFFLINE_STATUS',ready:!!match});
    }));
  }
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  const isShell=url.pathname===new URL(scope).pathname||url.pathname===new URL(shellURL).pathname;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const network=await fetch(req);
        if(network.ok&&isShell){
          const copy=network.clone();
          event.waitUntil(caches.open(CACHE).then(cache=>cache.put(shellURL,copy)));
        }
        return network;
      }catch(err){
        return await caches.match(shellURL)||Response.error();
      }
    })());
    return;
  }
  const known=FILES.some(file=>url.pathname===new URL(file,scope).pathname);
  if(known){
    event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
  }
});
