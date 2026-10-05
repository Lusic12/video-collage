// Browser integration checks. Requires a local server on :8000 and an isolated
// Chromium-compatible browser with --remote-debugging-port=9223.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { results } = require('../assets/results.json');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const target = targets.find(x => x.type === 'page');
  if (!target) throw new Error('No isolated test tab');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject) => {ws.onopen=resolve;ws.onerror=reject;});
  let seq=0; const pending=new Map(); const errors=[];
  ws.onmessage = ({data}) => {
    const m=JSON.parse(data);
    if (m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression)=>{
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const waitFor=async(expression)=>{
    for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(75);}
    throw new Error(`Timed out: ${expression}`);
  };
  const load=async(hash='')=>{
    await send('Page.navigate',{url:'about:blank'});
    await waitFor(`location.href==='about:blank'`);
    await send('Page.navigate',{url:`http://127.0.0.1:${process.env.PORT||8000}/${hash}`});
    await waitFor(`document.querySelectorAll('.example-thumb').length===${results.length} && document.querySelector('.case-title h3')`);
  };
  const screenshot=async(name,full=false)=>{
    await waitFor(`[...document.querySelectorAll('#result-panel img')].every(x=>x.complete&&x.naturalWidth>0)`);
    await sleep(400);
    let opts={format:'png',captureBeyondViewport:full};
    if(full){await evaluate(`document.querySelectorAll('img').forEach(img=>img.loading='eager');document.activeElement.blur();window.scrollTo({top:0,behavior:'instant'});`);await waitFor(`[...document.images].filter(x=>x.getAttribute('src')).every(x=>x.complete&&x.naturalWidth>0)`);await sleep(200);const metrics=await send('Page.getLayoutMetrics');opts.clip={x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1};}
    const r=await send('Page.captureScreenshot',opts);fs.writeFileSync(`${process.env.SHOT_DIR||'/private/tmp'}/${name}.png`,Buffer.from(r.data,'base64'));
  };
  try {
    await send('Page.enable');await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await load();
    await screenshot('a2v-desktop');
    const fold=await evaluate(`({bottom:document.querySelector('.key-visual').getBoundingClientRect().bottom,frames:document.querySelectorAll('.key-frames li').length,h:innerHeight})`);
    assert.equal(fold.frames,7);
    assert.ok(fold.bottom<=fold.h,`Key visual below the fold: ${JSON.stringify(fold)}`);
    console.log('PASS: keyframes, words and collage fit the first screen at 1440x1100');
    assert.equal(await evaluate(`document.querySelectorAll('.more-item').length`),10);
    assert.equal(await evaluate(`document.querySelectorAll('.more-methods img').length`),40);
    assert.equal(await evaluate(`document.querySelectorAll('.more-item .more-frames').length`),5);
    await evaluate(`document.querySelectorAll('#more img').forEach(img=>img.loading='eager')`);
    await waitFor(`[...document.querySelectorAll('#more img')].every(x=>x.complete)`);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('#more img')].filter(x=>!x.naturalWidth).map(x=>x.getAttribute('src'))`),[]);
    console.log('PASS: 10 extra examples with four methods each, every image loads');
    for(const item of results){
      await evaluate(`document.querySelector('[data-case=${JSON.stringify(item.id)}]').click()`);
      for(const view of ['collage','comparison']){
        await evaluate(`document.getElementById('tab-${view}').click()`);
        assert.equal(await evaluate('location.hash'),`#results/${item.id}/${view}`);
        assert.equal(await evaluate(`document.getElementById('tab-${view}').getAttribute('aria-selected')`),'true');
        assert.equal(await evaluate(`document.querySelector('.case-title h3').textContent`),item.title);
        assert.equal(await evaluate(`document.querySelector('[data-case][aria-pressed=true]').dataset.case`),item.id);
        assert.equal(await evaluate(`document.querySelectorAll('.frame-item').length`),item.keyframes.length);
        if(view==='collage') assert.ok(await evaluate(`document.querySelector('.story-words p').textContent.length>40 && !!document.querySelector('.story-look')`));
        if(view==='comparison') assert.equal(await evaluate(`document.querySelectorAll('.comparison-method').length`),item.comparison?4:2);
        await waitFor(`[...document.querySelectorAll('#result-panel img')].every(x=>x.complete)`);
        assert.deepEqual(await evaluate(`[...document.querySelectorAll('#result-panel img')].filter(x=>!x.naturalWidth).map(x=>x.getAttribute('src'))`),[]);
      }
    }
    console.log('PASS: all 20 example/tab combinations, every image loads');
    await load('#results/garfield/keyframes');
    assert.equal(await evaluate(`document.getElementById('tab-collage').getAttribute('aria-selected')`),'true');
    assert.equal(await evaluate(`document.querySelectorAll('.frame-item').length`),7);
    const top=await evaluate(`document.getElementById('results').getBoundingClientRect().top`);
    assert.ok(top>=0&&top<140,`Paper link did not land on the results: top=${top}`);
    console.log('PASS: a keyframes link from the paper opens the story and lands on the results');
    await evaluate(`document.getElementById('tab-comparison').click()`);
    await evaluate('history.back()');await waitFor(`document.getElementById('tab-collage').getAttribute('aria-selected')==='true'`);
    await evaluate('history.forward()');await waitFor(`document.getElementById('tab-comparison').getAttribute('aria-selected')==='true'`);
    const origin = await evaluate('performance.timeOrigin');
    await send('Page.reload');await waitFor(`performance.timeOrigin!==${origin} && document.querySelector('.comparison-grid')`);
    assert.equal(await evaluate(`document.querySelector('.case-title h3').textContent`),'Garfield');
    console.log('PASS: direct links, reload, Back and Forward');
    await evaluate(`document.getElementById('tab-collage').click()`);
    await evaluate(`document.getElementById('tab-collage').focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    assert.equal(await evaluate(`document.activeElement.id`),'tab-comparison');
    assert.equal(await evaluate(`document.getElementById('tab-comparison').getAttribute('aria-selected')`),'true');
    await evaluate(`document.querySelector('.frame-item button').click()`);
    assert.equal(await evaluate(`document.getElementById('image-dialog').open`),true);
    await evaluate(`document.getElementById('zoom-size').click()`);
    assert.equal(await evaluate(`document.getElementById('image-viewport').classList.contains('actual-size')`),true);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    assert.equal(await evaluate(`document.getElementById('image-dialog').open`),false);
    await waitFor(`document.activeElement.matches('.frame-item button')`);
    console.log('PASS: keyboard tabs, zoom, Escape, focus restoration');
    await load('#results/your-name/collage');
    await screenshot('a2v-results-desktop');
    await evaluate(`document.getElementById('tab-comparison').click()`);
    await screenshot('a2v-comparison-desktop');
    for(const width of [768,390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      for(const view of ['collage','comparison']){
        await evaluate(`document.getElementById('tab-${view}').click()`);
        const dims=await evaluate(`({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth})`);
        assert.ok(dims.s<=dims.w,`Overflow at ${width}px ${view}: ${JSON.stringify(dims)}`);
      }
    }
    console.log('PASS: no horizontal overflow at 768, 390, 320 px across all views');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await load('#results/your-name/collage');await screenshot('a2v-mobile',true);await evaluate(`document.getElementById('results').scrollIntoView({behavior:'instant'})`);await screenshot('a2v-mobile-results');
    await load('#results/unknown/unknown');assert.equal(await evaluate(`document.getElementById('route-notice').hidden`),false);
    assert.deepEqual(errors,[]);console.log('PASS: invalid-route fallback and no JavaScript exceptions');
    await load('#results/your-name/collage');
  } finally {ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
