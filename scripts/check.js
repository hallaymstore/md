const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p]});}
const files=[...walk('src'),...walk('scripts'),'app.js','server.js'].filter(f=>f.endsWith('.js')&&!f.endsWith('check.js'));
for(const f of files)execFileSync(process.execPath,['--check',f],{stdio:'ignore'});
const ejs=walk('views').filter(f=>f.endsWith('.ejs'));
for(const f of ejs){const s=fs.readFileSync(f,'utf8');if((s.match(/<%/g)||[]).length!==(s.match(/%>/g)||[]).length)throw new Error(`EJS delimiter mismatch: ${f}`);}
console.log(`OK: ${files.length} JS files + ${ejs.length} EJS templates checked.`);
