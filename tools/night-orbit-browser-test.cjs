const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.argv[2] || 'playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900},offline:true});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(pathToFileURL(path.resolve('.pages/index.html')).href);
    await page.waitForFunction(()=>window.travelTree); await page.evaluate(()=>travelTree.ready);
    const result = await page.evaluate(() => {
      const s=travelTree.scene,a=s.atmosphere;s.setRunning(false);s.flight=null;a.set(true,false);s._updateCards(0);
      const u=a.sky.material.uniforms, direction=u.moonDirection.value.clone();
      s.renderer.render(s.scene,s.camera);
      s.camera.rotateY(.2);s.camera.updateMatrixWorld();s.renderer.render(s.scene,s.camera);
      const fixedDirection=direction.distanceTo(u.moonDirection.value)<1e-8;
      const batch=s.clipBatch;
      if(!batch)return {fixedDirection,batched:false};
      const measure=()=>{s._updateCards(.016);s.renderer.render(s.scene,s.camera);return s.renderer.info.render.calls;};
      const calls=measure();batch.visible=false;for(const c of s.cards)c.clip.material.visible=true;
      const unbatchedCalls=measure();batch.visible=true;for(const c of s.cards)c.clip.material.visible=false;
      const check=()=>{s._updateCards(.016);let error=0;const matrix=s.cards[0].clip.matrixWorld.clone();
        for(let i=0;i<s.cards.length;i++){batch.getMatrixAt(i,matrix);const want=s.cards[i].clip.matrixWorld;for(let j=0;j<16;j++)error=Math.max(error,Math.abs(matrix.elements[j]-want.elements[j]));}return error;};
      const matrixError=check();
      s.setClusterMode(true);s.flight=null;s._updateCards(.016);
      const clusterError=check();
      const hiddenCard=s.cards[0];hiddenCard.group.visible=false;s._updateClipBatch();
      const hiddenMatrix=hiddenCard.clip.matrixWorld.clone();batch.getMatrixAt(0,hiddenMatrix);
      const hides=hiddenMatrix.elements.slice(0,12).every(v=>v===0);
      s.setClusterMode(false);s.flight=null;s._updateCards(.016);
      const card=s.cards[0], point=card.clip.getWorldPosition(u.moonRight.value.clone()).project(s.camera);
      s.raycaster.setFromCamera({x:point.x,y:point.y},s.camera);
      const pick=s.raycaster.intersectObject(card.clip,false).some(h=>h.object.userData.photo===card.photo);
      s.setYear(s.photos[0].year);const yearError=check();s.setYear(null);
      return {fixedDirection,batched:true,calls,unbatchedCalls,count:s.cards.length,matrixError,yearError,clusterError,hides,pick,singlePass:s.cards.every(c=>c.group.getObjectByName('photo-frame-keepsakes').material.forceSinglePass)};
    });
    assert.ok(result.fixedDirection,'moon direction must not be rebuilt from the camera');
    assert.ok(result.batched && result.singlePass,'shared clip batch and single-pass flat decorations required');
    assert.equal(result.unbatchedCalls-result.calls,result.count-1);
    assert.ok(result.matrixError<1e-4 && result.yearError<1e-4 && result.clusterError<1e-4 && result.hides && result.pick,JSON.stringify(result));
    assert.deepEqual(errors,[]);console.log('PASS: sky-fixed moon, clip draw reduction, year transforms and original picking',result);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
