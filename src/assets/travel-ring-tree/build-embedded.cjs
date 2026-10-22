const fs=require('node:fs'),path=require('node:path');
const esbuild=require(process.argv[2]||'esbuild');
const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n');
(async()=>{
  const result=await esbuild.build({entryPoints:[path.join(__dirname,'main.js')],bundle:true,format:'iife',minify:true,write:false,legalComments:'inline',alias:{three:path.join(__dirname,'../umbrella-canopy/vendor/three.module.min.js')}});
  const license=['../umbrella-canopy/vendor/garden/meadow/LICENSE','vendor/ez-tree/LICENSE'].map(file=>'/*! '+read(file)+' */\n').join('');
  const script=license+result.outputFiles[0].text.replace(/\r\n/g,'\n');
  const template=read('template.html').replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+read('style.css')+'</style>');
  const output=`// Travel ring tree; read-only reuse of Umbrella Canopy. See README.md.\nwindow.TravelRingTreeDocument=function(records,additions){\nconst template=${JSON.stringify(template)},script=${JSON.stringify(script)};\nconst extra=JSON.stringify(additions||{version:1,records:[],settings:{},letters:{},stories:{}}).replace(/</g,'\\\\u003c');\nconst data=JSON.stringify(records).replace(/</g,'\\\\u003c');\nreturn template.replace('<script type="module" src="main.js"></script>',()=>'<script>window.travelTreeAdditions='+extra+';window.travelRingTreeRecords='+data+';'+script.replace(/<\\/script/gi,'<\\\\/script')+'</script>');\n};\n`;
  fs.writeFileSync(path.join(__dirname,'../../../assets/tree-runtime.js'),output);console.log('Built assets/tree-runtime.js ('+Buffer.byteLength(output)+' bytes)');
})().catch(e=>{console.error(e);process.exitCode=1;});
