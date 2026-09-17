// Local browser smoke test. Start the production preview on port 4176 first.
// Uses the existing qaCapture switch to expose the selected blind-listening callsign
// and skip audio playback; CW still passes through key events, AutomaticKeyer,
// decoding, protocol validation and the normal save/mission settlement paths.
// Never use a personal browser profile or pre-populate completed QSO/mission state.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createSave, SAVE_STORAGE_KEY, ACTIVE_SAVE_KEY } from '../src/game/saveStore.js';
import { MORSE_CODE } from '../src/cw/morse.js';

const output = path.resolve('qa-artifacts-chapter-one-live');
const baseUrl = process.env.CWGAME_QA_URL || 'http://127.0.0.1:4176/';
const chromePath = process.env.CWGAME_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = path.join(os.tmpdir(), `cw-chapter-one-live-${Date.now()}`);
await mkdir(output, { recursive: true });
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-timer-throttling', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i=0;i<80;i++) {
    try { port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break; } catch { await pause(250); }
  }
  assert(port);
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let serial=0;
  const pending=new Map();
  const exceptions=[];
  socket.addEventListener('message',({data})=>{
    const r=JSON.parse(data);
    if(r.method==='Runtime.exceptionThrown')exceptions.push(r.params);
    if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(new Error(JSON.stringify(r.error))):p.resolve(r.result);}
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{
    const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  const until=async(expression,timeout=20000)=>{
    const end=Date.now()+timeout;
    while(Date.now()<end){if(await evaluate(`Boolean(${expression})`))return;await pause(100);}
    throw new Error(`Timeout: ${expression}; UI: ${await evaluate('document.body.innerText.slice(-1800)')}`);
  };
  const click=async selector=>{
    await until(`!!document.querySelector(${JSON.stringify(selector)})`);
    const p=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});
  };
  const screenshot=async name=>{
    await until(`Array.from(document.querySelectorAll('.vn-art > img')).every(img=>img.complete&&img.naturalWidth>0)`,30000);
    const images=await evaluate(`Array.from(document.querySelectorAll('.vn-art > img')).map(img=>({src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight,rect:img.getBoundingClientRect().toJSON(),opacity:getComputedStyle(img).opacity,visibility:getComputedStyle(img).visibility,display:getComputedStyle(img).display}))`);
    console.log('ART',name,JSON.stringify(images));
    await pause(600);const r=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,`${name}.png`),Buffer.from(r.data,'base64'));
  };
  const saved=()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_STORAGE_KEY)}))[0]`);
  const finishScene=async()=>{
    for(let n=0;n<6;n++){
      if(await evaluate(`document.querySelector('.vn-dialogue')?.dataset.vnReady==='true'`))break;
      await click('.vn-line');await pause(80);
    }
    assert.equal(await evaluate(`document.querySelector('.vn-dialogue').dataset.vnReady`),'true');
    await click('[data-action="chapter-one-primary"]');
  };
  const phase=()=>evaluate(`document.querySelector('.station-screen')?.dataset.qsoPhase`);
  const sendText=async text=>{
    console.log(`KEYING ${text}`);
    const words=text.trim().toUpperCase().split(/\s+/);
    const steps=words.flatMap((word,wi)=>[...word].map((char,ci)=>({pattern:MORSE_CODE[char],gap:ci<word.length-1?1200/18*2:wi<words.length-1?1200/18*6:0})));
    await evaluate(`(async()=>{
      const pause=ms=>new Promise(r=>setTimeout(r,ms));
      for(const {pattern,gap} of ${JSON.stringify(steps)}){
          const symbols=pattern;
          const station=()=>document.querySelector('.station-screen');
          const before=Number(station().dataset.pulseCount);
          const channel=new MessageChannel();const waiters=[];
          channel.port1.onmessage=()=>waiters.shift()?.();
          const yieldTask=()=>new Promise(r=>{waiters.push(r);channel.port2.postMessage(null)});
          const waitUntil=predicate=>new Promise((resolve,reject)=>{
            const started=performance.now();const timer=setInterval(()=>{
              if(predicate()){clearInterval(timer);resolve()}
              else if(performance.now()-started>5000){clearInterval(timer);reject(new Error('keyer not idle'))}
            },10);
          });
          try {
            for(const symbol of symbols){
              const key=symbol==='.'?'z':'x';const code='Key'+key.toUpperCase();
              window.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true,cancelable:true}));
              const start=performance.now();while(performance.now()-start<8){}
              window.dispatchEvent(new KeyboardEvent('keyup',{key,code,bubbles:true,cancelable:true}));
              await yieldTask();
            }
            await waitUntil(()=>Number(station().dataset.pulseCount)>=before+symbols.length);
            await waitUntil(()=>Boolean(document.querySelector('[data-action="submit-reply"]:not([disabled])')));
          } finally {channel.port1.close();channel.port2.close()}
          if(gap>0)await pause(gap);
      }
    })()`);
    const decoded=await evaluate(`document.querySelector('.station-screen').dataset.decoded.trim().replace(/\s+/g,' ')`);
    assert.equal(decoded,words.join(' '),'physical key events decoded correctly');
    await click('[data-action="submit-reply"]');
  };
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const fixture=createSave({callsign:'BH1QA',keyType:'automatic',automaticKeyWpm:18});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.cwgameSystem={qaCapture:true};if(!localStorage.getItem(${JSON.stringify(SAVE_STORAGE_KEY)})){localStorage.setItem(${JSON.stringify(SAVE_STORAGE_KEY)},${JSON.stringify(JSON.stringify([fixture]))});localStorage.setItem(${JSON.stringify(ACTIVE_SAVE_KEY)},${JSON.stringify(fixture.id)});localStorage.setItem('game-morse-adventurer.language.v1','zh-CN');}`});
  await call('Page.navigate',{url:baseUrl});
  await call('Page.bringToFront');
  await click('.menu-primary');await click('.save-primary-action');
  await click('[data-action="enter-chapter-one-home"]');
  await until(`document.querySelector('[data-story-beat="silence"]')`);
  assert.equal((await saved()).missionState.activeMissions[0].id,'story-01');
  assert.equal((await saved()).qsoLogs.length,0);
  await screenshot('01-opening');
  await finishScene();
  await until(`document.querySelector('[data-story-beat="operator"]')`);
  await screenshot('02-operator');
  await call('Page.reload');
  await click('.menu-primary');await click('.save-primary-action');await click('[data-action="enter-chapter-one-home"]');
  await until(`document.querySelector('[data-story-beat="operator"]')`);
  await finishScene();
  await until(`document.querySelector('[data-story-beat="call"]')`);
  assert((await evaluate('document.body.innerText')).includes('BH1QA'));
  assert(!(await evaluate('document.body.innerText')).includes('SIM1OP'));
  await screenshot('03-real-key-brief');
  await click('.chapter-one-art-open');
  await until(`document.querySelector('.chapter-one-art-lightbox')`);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  await until(`!document.querySelector('.chapter-one-art-lightbox')&&document.activeElement===document.querySelector('.chapter-one-art-open')`);
  await click('.chapter-one-review-settings');
  await until(`document.querySelector('.settings-modal')`);
  assert.equal(await evaluate(`document.querySelector('.chapter-one-story-screen').inert`),true);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('audio')).every(audio=>audio.paused)`),true);
  await click('.settings-modal header .icon-button');
  await until(`!document.querySelector('.chapter-one-story-screen').inert`);
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await evaluate('window.scrollTo(0,0)');
  await screenshot('03a-mobile-opening');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'no horizontal page overflow');
  await evaluate(`document.querySelector('[data-action="chapter-one-primary"]').scrollIntoView({block:'center'})`);
  await screenshot('03b-mobile-action');
  assert(await evaluate(`(()=>{const r=document.querySelector('[data-action="chapter-one-primary"]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`),'mobile primary action can be reached');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate('window.scrollTo(0,0)');
  await finishScene();
  await click('[data-action="start-guided-watch"]');
  await until(`document.querySelector('.station-screen')?.dataset.qsoPhase==='PLAYER_CQ'`);
  assert.equal(await evaluate(`!!document.querySelector('img[src*="portrait"]')`),false);
  await screenshot('04-station');
  await sendText('SOS');
  await until(`document.body.innerText.includes('发报质量过低')`);
  assert.equal(await phase(),'PLAYER_CQ');
  assert.equal((await saved()).qsoLogs.length,0);
  await screenshot('04a-invalid-input');
  await click('[data-action="clear-input"]');
  let finished=false;
  for(let turn=0;turn<12;turn++){
    const current=await phase();console.log(`PHASE ${current}`);
    if(current==='QSO_COMPLETE'){finished=true;break;}
    if(current==='QSO_FAILED'){
      await screenshot(`retry-${turn}`);await click('.qso-result-modal.failed .qso-result-primary');continue;
    }
    if(['PLAYER_CQ','PLAYER_RST_AND_73','PLAYER_OPTIONAL_ANSWER'].includes(current)){
      if(await evaluate(`!!document.querySelector('[data-action="clear-and-retry"]')`))await click('[data-action="clear-and-retry"]');
      const template=await evaluate(`document.querySelector('[data-testid="qso-duty-template"]')?.textContent`);
      const remote=await evaluate(`document.querySelector('.station-screen').dataset.qaNpcCallsign`);
      const text=current==='PLAYER_OPTIONAL_ANSWER'?'SKIP K':template?.replace('REMOTE',remote);
      assert(text,`visible guidance for ${current}`);
      await sendText(text);
      await pause(900);
    }
    await until(`['PLAYER_CQ','PLAYER_RST_AND_73','PLAYER_OPTIONAL_ANSWER','QSO_COMPLETE','QSO_FAILED'].includes(document.querySelector('.station-screen')?.dataset.qsoPhase)`,65000);
  }
  assert(finished,'real QSO reached completion');
  assert.equal((await saved()).qsoLogs.length,0,'unsaved success is not a story ending');
  assert.equal(await evaluate(`!!document.querySelector('[data-action="continue-chapter-one"]')`),false);
  await screenshot('05-unsaved-qso');
  await click('.qso-result-modal.success .qso-result-primary');
  await until(`!!document.querySelector('[data-action="continue-chapter-one"]')`);
  const qsoSaved=await saved();assert.equal(qsoSaved.qsoLogs.length,1);
  const actual=qsoSaved.qsoLogs[0];
  await screenshot('06-saved-qso');
  await click('[data-action="continue-chapter-one"]');
  await until(`document.querySelector('[data-story-beat="answer"]')`);
  assert((await evaluate('document.body.innerText')).includes(actual.callsign));
  await screenshot('07-actual-answer');
  await finishScene();
  await until(`document.querySelector('[data-story-beat="log"]')`);
  await click('[data-action="vn-notes"]');
  assert((await evaluate(`document.querySelector('[data-testid="chapter-one-real-log"]').innerText`)).includes(`${actual.sent} / ${actual.received}`));
  await screenshot('08-real-log');
  await click('.vn-modal header button');
  await call('Page.reload');await click('.menu-primary');await click('.save-primary-action');await click('[data-action="enter-chapter-one-home"]');
  await until(`document.querySelector('[data-story-beat="log"]')`);
  assert.equal((await saved()).money,qsoSaved.money);
  await finishScene();
  await until(`document.querySelector('[data-story-status="claimed"]')`);
  const claimed=await saved();assert.equal(claimed.money,qsoSaved.money+150);assert.equal(claimed.qsoLogs.length,1);
  assert.equal(claimed.missionState.claimedMissionIds.filter(id=>id==='story-01').length,1);
  await screenshot('09-claimed');
  await click('[data-action="chapter-one-primary"]');
  await until(`document.querySelector('.home-screen')`);
  assert.equal(await evaluate(`!!document.querySelector('[data-action="enter-chapter-one-home"]')`),false);
  await click('[data-action="open-missions"]');
  await until(`document.querySelector('[data-mission-id="story-02"][data-mission-status="available"]')`);
  await screenshot('09a-chapter-two-unlocked');
  await click('.mission-center-modal header .icon-button');
  await call('Page.reload');await click('.menu-primary');await click('.save-primary-action');
  assert.equal((await saved()).money,claimed.money);
  await call('Page.navigate',{url:new URL('?review=chapter-1',baseUrl).href});
  await until(`document.querySelector('[data-review-beat="silence"]')`);
  assert.equal((await saved()).money,claimed.money);
  await screenshot('10-review-preserved');
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));
  await writeFile(path.join(output,'evidence.json'),JSON.stringify({passed:true,profile,actual:{id:actual.id,callsign:actual.callsign,sent:actual.sent,received:actual.received},moneyBeforeClaim:qsoSaved.money,moneyAfterClaim:claimed.money,keyEventInput:true,qaCapture:true,audioPlaybackSkipped:true,invalidInputRetry:true,settingsPause:true,artDialogFocus:true,mobileLayout:true,chapterTwoUnlocked:true,bookmarkReload:true,endingReload:true,duplicateReward:false,reviewPreserved:true,exceptions},null,2));
  console.log(JSON.stringify({passed:true,profile,output}));
}
catch(error){
  await writeFile(path.join(output,'evidence.json'),JSON.stringify({passed:false,baseUrl,error:String(error),recordedAt:new Date().toISOString()},null,2));
  console.error(error); process.exitCode=1;
}
finally {
  socket?.close();
  chrome.kill();
  await pause(1000);
  const tempRoot = path.resolve(os.tmpdir());
  const resolvedProfile = path.resolve(profile);
  // Delete only the isolated profile created above, never a real browser profile.
  if (path.dirname(resolvedProfile) !== tempRoot || !path.basename(resolvedProfile).startsWith('cw-chapter-one-live-')) {
    throw new Error('Refusing to remove a profile outside the QA temp directory');
  }
  await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
    .catch(error => console.warn('QA profile cleanup failed:', error.message));
}
