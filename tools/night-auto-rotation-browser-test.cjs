const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.argv[2] || 'playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900},offline:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve('.pages/index.html')).href);
    await page.waitForFunction(()=>window.travelTree);await page.evaluate(()=>travelTree.ready);
    const result=await page.evaluate(()=>{
      const s=travelTree.scene,a=s.atmosphere;s.setRunning(false);s.flight=null;a.set(true,false);s.setRotation(false,1,1);
      for(let i=0;i<180;i++)s.controls.update(1/60);
      for(const c of s.scene.children)c.visible=c===a.sky;
      const gl=s.renderer.getContext();
      const capture=()=>{s.camera.updateMatrixWorld();s.renderer.render(s.scene,s.camera);const p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
      const changed=(p,q)=>{let count=0;for(let i=0;i<p.length;i+=4)if(Math.abs(p[i]-q[i])>10)count++;return count;};
      const before=capture(),camera=s.camera.position.clone();s.setRotation(true,1,1);
      for(let i=0;i<240;i++)s.controls.update(1/60);
      const rotating=capture(),cameraMoved=s.camera.position.distanceTo(camera);
      s.setRotation(false,1,1);for(let i=0;i<180;i++)s.controls.update(1/60);
      const paused=capture();
      s.setRotation(true,-1,2);for(let i=0;i<240;i++)s.controls.update(1/60);
      const reversed=capture();
      // Simulate a manual horizontal drag while automatic rotation remains enabled.
      s.controls.state=0;s.controls.rotateLeft(.16);for(let i=0;i<100;i++)s.controls.update(1/60);
      const dragged=capture();s.controls.state=-1;
      return {cameraMoved,automatic:changed(before,rotating),paused:changed(before,paused),reversed:changed(before,reversed),manual:changed(reversed,dragged)};
    });
    assert.ok(result.cameraMoved>1,'the view of the tree must keep rotating');
    assert.ok(result.automatic<25 && result.paused<25 && result.reversed<25,'automatic rotation, speed changes and damping must keep the sky still: '+JSON.stringify(result));
    assert.ok(result.manual>100,'manual camera motion must still move the sky');
    assert.deepEqual(errors,[]);console.log('PASS: tree rotation with still night sky, pause/reverse and manual camera motion',result);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
