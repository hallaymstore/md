const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const ejsCompiler=require('ejs');

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const item=path.join(dir,entry.name);return entry.isDirectory()?walk(item):[item]});}

const files=[...walk('src'),...walk('scripts'),'app.js','server.js'].filter(file=>file.endsWith('.js')&&!file.endsWith('check.js'));
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'ignore'});

const templates=walk('views').filter(file=>file.endsWith('.ejs'));
for(const file of templates){
  const source=fs.readFileSync(file,'utf8');
  if((source.match(/<%/g)||[]).length!==(source.match(/%>/g)||[]).length)throw new Error(`EJS delimiter mismatch: ${file}`);
  ejsCompiler.compile(source,{filename:path.resolve(file)});
}
console.log(`OK: ${files.length} JS files + ${templates.length} compiled EJS templates checked.`);
