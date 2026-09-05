import WebSocket from 'ws';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
const SECRET=readFileSync(`${homedir()}/.kvideo-cast-secret`,'utf8').trim();
const HOST='wss://kvideo-cast-room.coleman-dlut.workers.dev/socket';
const log=(...a)=>console.log(new Date().toLocaleTimeString('ja-JP'),...a);
const mkT=room=>{const p=Buffer.from(JSON.stringify({room,exp:Date.now()+60000})).toString('base64url');
  return `${p}.${createHmac('sha256',SECRET).update(p).digest('base64url')}`;};

// 静默 N 分钟后再探活，看沉默的连接是不是"看起来还在"
const PROBE_AFTER_MIN=[10,20,30,45,60,90];
const ws=new WebSocket(`${HOST}?ticket=${encodeURIComponent(mkT('silence-test'))}&deviceId=silence&name=`);
let lastPong=null, alive=true;
ws.on('open',()=>log('OPEN，开始静默'));
ws.on('message',d=>{if(String(d)==='pong'){lastPong=Date.now();log('  ← pong 收到，连接确实是通的');}});
ws.on('close',c=>{alive=false;log(`❌ 断开 code=${c}`);});
ws.on('error',e=>log('error '+e.message));
const t0=Date.now();
for(const m of PROBE_AFTER_MIN){
  setTimeout(()=>{
    if(!alive){log(`${m}分: 已断开`);return;}
    const before=lastPong;
    log(`${m}分: readyState=${ws.readyState}（自称${ws.readyState===1?'在线':'离线'}），发探测 ping...`);
    ws.send('ping');
    setTimeout(()=>{
      if(lastPong===before) log(`  ⚠️ ${m}分: 没有 pong —— 连接是"假活"的（自称在线但实际已死）`);
    },15000);
  }, m*60000);
}
