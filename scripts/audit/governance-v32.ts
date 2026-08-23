import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Level = 'CHANGE' | 'READY' | 'RELEASE';
type Law = {
  schemaVersion: 2; lawId: string; supersedesLawId: string | null; status: 'active'; tier: 'P0'|'P1'|'P2';
  capabilityDomain: string; enforcementMode: 'static'|'exam'|'dynamic'|'composite'; evidenceModes: string[];
  summary: string; appliesTo: string[]; excludes: string[]; forbidden: string[]; dependsOnLawIds: string[];
  source: { path: string; lineStart: number; lineEnd: number; sectionSha256: string }; contractRefs: {path:string;sha256:string}[];
};
type Manifest = { schemaVersion:3; capabilityDomain:string; status:'active'; lawIds:string[]; ownedPaths:string[]; observedPaths:string[]; manifestPath:string };

const ROOT = process.cwd();
const SPEC = 'docs/governance/法案系统建设说明书-冻结定稿版.md';
const FREEZE = 'docs/governance/GOVERNANCE-FREEZE.json';
const BASE = '.github/instructions/agent-rules/基础法案.md';
const FUNCTIONAL = '.github/instructions/agent-rules/功能法案.md';
const REGISTRY = 'scripts/audit/generated/law-registry.generated.json';
const CHANGE = '.governance/runtime/change.json';
const REPORT = 'scripts/audit/reports/law-quality.report.json';
const AGENTS_EXACT = `# Codex Governance Entry\n\n本仓库使用冻结的法案系统。\n\n1. READ_ONLY 直接读取并回答，不落盘、不加锁、不建立 runtime 任务事务。\n2. CHANGE 首次写入前运行 \`governance:entry\`，只记录 baseSha、allowedWritePaths 和 allowedDeletePaths。\n3. 修改不得超出 change record；扩大范围必须先更新同一 record。\n4. READY 不等于 RELEASE；不得以静态检查、普通测试或部分证据冒充生产发布。\n5. RELEASE 才绑定完整 candidateId，并执行发布适用的 Dynamic Proof。\n6. 只允许一份 active law corpus、一份 law registry；每个生产路径和合同只允许一个 primary Owner；只允许一个 quality verdict。\n7. 迁移桥、用于迁移的 feature flag、dual-read/write 或 shadow traffic 必须有 Owner、监控、期限、删除日期和删除验收。\n8. active law 只在明确人类授权下修改。\n9. 任一 finding、候选漂移、错误证据类型或伪 PASS 必须失败关闭。\n`;
const LAW_KEYS = ['appliesTo','capabilityDomain','dependsOnLawIds','enforcementMode','evidenceModes','excludes','forbidden','lawId','schemaVersion','status','summary','supersedesLawId','tier'];
const MANIFEST_KEYS = ['capabilityDomain','lawIds','observedPaths','ownedPaths','schemaVersion','status'];
const BLUEPRINT_KEYS = ['blueprintId','contractRefs','dependencyEdges','lawIds','owner','prohibitedDependencyEdges','schemaVersion','status'];
const SPEC_KEYS = ['contract','lawIds','owner','schemaVersion','specId','specKind','status','version'];
const EVIDENCE = ['static.filesystem','static.text','static.ast','static.types','static.contract','static.dependency','static.config','static.json','static.yaml','static.sql','static.migration','exam.golden','exam.property','exam.state-machine','dynamic.browser','dynamic.service','dynamic.database','dynamic.storage','dynamic.provider','dynamic.authorization','dynamic.recovery','dynamic.performance'];
const PUBLIC_SCRIPTS = ['governance:entry','governance:scope:check','audit:build','audit:projection:check','quality:check'];

class GovernanceError extends Error { constructor(readonly code:string, message:string){super(message)} }
const fail = (code:string,message:string):never => { throw new GovernanceError(code,message); };
const bytes = (path:string) => readFileSync(resolve(ROOT,path));
const text = (path:string) => bytes(path).toString('utf8');
const sha = (value:Buffer|string) => createHash('sha256').update(value).digest('hex');
const sortedUnique = (items:string[]) => items.length === new Set(items).size && items.every((v,i)=>i===0||Buffer.compare(Buffer.from(items[i-1]!),Buffer.from(v))<0);
const exactKeys = (value:Record<string,unknown>, keys:string[]) => JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());
const canonicalValue = (value:Json):Json => Array.isArray(value) ? value.map(canonicalValue) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonicalValue((value as Record<string,Json>)[key]!)])) : value;
const canonicalBytes = (value:Json) => `${JSON.stringify(canonicalValue(value),null,2)}\n`;
const parseJson = <T>(path:string):T => { try{return JSON.parse(text(path)) as T}catch{return fail('SOURCE_PARSE_FAILED',path)} };

function verifyFreeze(){
  const freeze=parseJson<Record<string,any>>(FREEZE);
  if(!exactKeys(freeze,['schemaVersion','status','specPath','specSha256','freezeVersion','amendmentAuthority','derivatives'])) fail('FREEZE_HASH_MISMATCH','freeze fields');
  if(freeze.schemaVersion!==2||freeze.status!=='SPEC_FROZEN'||freeze.specPath!==SPEC||freeze.freezeVersion!=='FROZEN-FINAL-V3.2'||freeze.amendmentAuthority!=='explicit-human-only') fail('FREEZE_HASH_MISMATCH','freeze values');
  if(sha(bytes(SPEC))!==freeze.specSha256) fail('FREEZE_HASH_MISMATCH','spec hash');
  const pdf=freeze.derivatives?.pdf;
  if(!pdf||!exactKeys(pdf,['enabled','path','sourceSha256','fileSha256'])) fail('FREEZE_HASH_MISMATCH','pdf fields');
  if(pdf.enabled && (pdf.sourceSha256!==freeze.specSha256||typeof pdf.path!=='string'||sha(bytes(pdf.path))!==pdf.fileSha256)) fail('FREEZE_HASH_MISMATCH','pdf hash');
}
function verifyAgents(){ if(text('AGENTS.md')!==AGENTS_EXACT) fail('ENTRY_CONTRACT_MISMATCH','AGENTS.md'); }
function verifyCommands(){
  const pkg=parseJson<Record<string,any>>('package.json'); const scripts=pkg.scripts??{};
  for(const name of PUBLIC_SCRIPTS) if(typeof scripts[name]!=='string') fail('ENTRY_CONTRACT_MISMATCH',`missing ${name}`);
  const old=Object.keys(scripts).filter((name)=>name.startsWith('governance:')&&!PUBLIC_SCRIPTS.includes(name));
  if(old.length) fail('ENTRY_CONTRACT_MISMATCH',`retired commands: ${old.join(',')}`);
  if(scripts['ci:full']&&!String(scripts['ci:full']).includes('quality:check')) fail('ENTRY_CONTRACT_MISMATCH','ci:full bypasses quality:check');
}
function verifyEntry(){ verifyFreeze(); verifyAgents(); verifyCommands(); }

function frontMatter(path:string,type:string,authority:number){
  const expected=`---\ndocumentType: ${type}\nschemaVersion: 2\nstatus: active\nauthorityLevel: ${authority}\ncontainerOwner: law-system\nlawIdPrefix: LAW\n---\n`;
  if(!text(path).startsWith(expected)) fail('SOURCE_PARSE_FAILED',`${path} front matter`);
}
function parseCorpus(path:string,type:'base-law'|'functional-law'):Law[]{
  frontMatter(path,type,type==='base-law'?100:90); const source=text(path); if(source.includes('\r')) fail('SOURCE_PARSE_FAILED',`${path} CRLF`);
  const lines=source.split('\n'); const laws:Law[]=[]; let domain=''; let heading:{lawId:string;line:number}|null=null;
  for(let i=0;i<lines.length;i++){
    const line=lines[i]!; const domainMatch=line.match(/^## capabilityDomain: ([a-z0-9]+(?:-[a-z0-9]+)*)$/); if(domainMatch){domain=domainMatch[1]!;heading=null;continue}
    const head=line.match(/^### \[(LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3}-V[1-9][0-9]*)\] .+$/); if(head){heading={lawId:head[1]!,line:i+1};continue}
    if(line!=='```law-record') continue;
    if(!heading||!domain) fail('SOURCE_PARSE_FAILED',`${path}:${i+1}`); const currentHeading=heading as {lawId:string;line:number}; const start=i+1; let end=i+1;
    while(end<lines.length&&lines[end]!=='```') end++; if(end>=lines.length) fail('SOURCE_PARSE_FAILED',`${path}:unclosed`);
    let raw:any; try{raw=JSON.parse(lines.slice(start,end).join('\n'))}catch{fail('SOURCE_PARSE_FAILED',`${path}:${start+1}`)}
    if(!exactKeys(raw,LAW_KEYS)||raw.lawId!==currentHeading.lawId||raw.capabilityDomain!==domain||raw.schemaVersion!==2||raw.status!=='active') fail('SOURCE_PARSE_FAILED',`${raw.lawId??path} schema`);
    if(!/^LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3}-V[1-9][0-9]*$/.test(raw.lawId)||!['P0','P1','P2'].includes(raw.tier)) fail('SOURCE_PARSE_FAILED',`${raw.lawId} identity`);
    const versionMatch=raw.lawId.match(/^(LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3})-V([1-9][0-9]*)$/);
    const major=Number(versionMatch?.[2]);
    const expectedSupersedes=major===1?null:`${versionMatch?.[1]}-V${major-1}`;
    if(raw.supersedesLawId!==expectedSupersedes) fail('SOURCE_PARSE_FAILED',`${raw.lawId} supersedes`);
    if(!Array.isArray(raw.evidenceModes)||raw.evidenceModes.length!==new Set(raw.evidenceModes).size||raw.evidenceModes.some((x:string)=>!EVIDENCE.includes(x))||raw.evidenceModes.some((x:string,index:number)=>index>0&&EVIDENCE.indexOf(raw.evidenceModes[index-1])>=EVIDENCE.indexOf(x))) fail('SOURCE_PARSE_FAILED',`${raw.lawId} evidence`);
    const kinds=new Set(raw.evidenceModes.map((x:string)=>x.split('.')[0])); const expected=kinds.size>1?'composite':[...kinds][0]; if(raw.enforcementMode!==expected) fail('SOURCE_PARSE_FAILED',`${raw.lawId} enforcement`);
    if(typeof raw.summary!=='string'||![...raw.summary].length||[...raw.summary].length<12||[...raw.summary].length>240||!/^(必须|只能)/u.test(raw.summary)) fail('SOURCE_PARSE_FAILED',`${raw.lawId} summary`);
    for(const key of ['appliesTo','excludes','dependsOnLawIds']) if(!Array.isArray(raw[key])||!sortedUnique(raw[key])) fail('SOURCE_PARSE_FAILED',`${raw.lawId} ${key}`);
    if(!Array.isArray(raw.forbidden)||raw.forbidden.length!==new Set(raw.forbidden).size) fail('SOURCE_PARSE_FAILED',`${raw.lawId} forbidden`);
    if(!raw.appliesTo.length||!raw.forbidden.length||raw.forbidden.length>16||raw.forbidden.some((x:string)=>!/^(不得|禁止)/u.test(x))) fail('SOURCE_PARSE_FAILED',`${raw.lawId} bounds`);
    const section=lines.slice(currentHeading.line-1,end+1).join('\n')+'\n'; laws.push({...raw,source:{path,lineStart:currentHeading.line,lineEnd:end+1,sectionSha256:sha(section)},contractRefs:[]}); i=end; heading=null;
  }
  if(type==='base-law'&&(laws.length!==8||laws.some((law,i)=>law.lawId!==`LAW-PROJECT-GOVERNANCE-00${i+1}-V1`||law.capabilityDomain!=='project-governance'))) fail('SOURCE_PARSE_FAILED','base root laws');
  return laws;
}
function loadLaws(){ const laws=[...parseCorpus(BASE,'base-law'),...parseCorpus(FUNCTIONAL,'functional-law')].sort((a,b)=>a.lawId.localeCompare(b.lawId)); const ids=new Set<string>(); for(const law of laws){if(ids.has(law.lawId))fail('SOURCE_PARSE_FAILED',`duplicate ${law.lawId}`);ids.add(law.lawId)} for(const law of laws)for(const dep of law.dependsOnLawIds)if(!ids.has(dep))fail('SOURCE_PARSE_FAILED',`${law.lawId} missing ${dep}`); return laws; }
function loadManifests(laws:Law[]):Manifest[]{
  const dir=resolve(ROOT,'scripts/audit/domains'); const entries=readdirSync(dir,{withFileTypes:true}).filter((e)=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)); const manifests:Manifest[]=[];
  for(const entry of entries){const rel=`scripts/audit/domains/${entry.name}/manifest.json`;if(!existsSync(resolve(ROOT,rel)))continue;const raw=parseJson<Record<string,any>>(rel);if(!exactKeys(raw,MANIFEST_KEYS)||raw.schemaVersion!==3||raw.status!=='active'||raw.capabilityDomain!==entry.name)fail('SOURCE_PARSE_FAILED',`${rel} schema`);for(const key of ['lawIds','ownedPaths','observedPaths'])if(!Array.isArray(raw[key])||!sortedUnique(raw[key]))fail('SOURCE_PARSE_FAILED',`${rel} ${key}`);const expected=laws.filter((law)=>law.capabilityDomain===entry.name).map((law)=>law.lawId).sort();if(JSON.stringify(raw.lawIds)!==JSON.stringify(expected)||!expected.length)fail('SOURCE_PARSE_FAILED',`${rel} lawIds`);manifests.push({...raw,manifestPath:rel} as Manifest)}
  const domains=new Set(laws.map((law)=>law.capabilityDomain));for(const domain of domains)if(!manifests.some((m)=>m.capabilityDomain===domain))fail('SOURCE_PARSE_FAILED',`missing manifest ${domain}`);
  const covers=(parent:string,child:string)=>{if(!parent.endsWith('/**'))return parent===child;const base=parent.slice(0,-3);return child===base||child.startsWith(`${base}/`)};
  const owners:{pattern:string;domain:string}[]=[];for(const m of manifests)for(const pattern of m.ownedPaths){for(const old of owners)if(covers(pattern,old.pattern)||covers(old.pattern,pattern))fail('SOURCE_PARSE_FAILED',`owner overlap ${old.domain}/${m.capabilityDomain}: ${old.pattern}/${pattern}`);owners.push({pattern,domain:m.capabilityDomain})}
  return manifests;
}
function walk(dir:string):string[]{if(!existsSync(resolve(ROOT,dir)))return[];const out:string[]=[];for(const entry of readdirSync(resolve(ROOT,dir),{withFileTypes:true})){const child=norm(`${dir}/${entry.name}`);entry.isDirectory()?out.push(...walk(child)):out.push(child)}return out.sort()}
function loadContracts(laws:Law[],manifests:Manifest[]){
  const lawIds=new Set(laws.map((law)=>law.lawId));const domains=new Set(manifests.map((m)=>m.capabilityDomain));const refs=new Map<string,Set<string>>();
  const add=(lawId:string,file:string)=>{if(!lawIds.has(lawId))fail('SOURCE_PARSE_FAILED',`${file} unknown ${lawId}`);if(!refs.has(lawId))refs.set(lawId,new Set());refs.get(lawId)!.add(file)};
  for(const file of walk('docs/specs').filter((p)=>p.endsWith('.spec.json'))){const raw=parseJson<Record<string,any>>(file);if(!exactKeys(raw,SPEC_KEYS)||raw.schemaVersion!==1||raw.status!=='active'||!Number.isInteger(raw.version)||raw.version<1||!domains.has(raw.owner)||!Array.isArray(raw.lawIds)||!raw.lawIds.length||!sortedUnique(raw.lawIds))fail('SOURCE_PARSE_FAILED',`${file} schema`);if(!['typed-contract','api','event','storage','state-machine','config','security','migration','cross-repo-contract','contract-pin'].includes(raw.specKind)||!raw.contract||typeof raw.contract!=='object')fail('SOURCE_PARSE_FAILED',`${file} contract`);if(raw.specKind==='cross-repo-contract'&&!exactKeys(raw.contract,['contractId','version','providerRepo','providerDomain','authorityArtifact','consumerRepos']))fail('SOURCE_PARSE_FAILED',`${file} provider`);if(raw.specKind==='contract-pin'&&!exactKeys(raw.contract,['contractId','version','providerRepo','providerDomain','providerSpecRef','providerCommitSha','contractSha256']))fail('SOURCE_PARSE_FAILED',`${file} pin`);for(const lawId of raw.lawIds)add(lawId,file)}
  for(const file of walk('docs/blueprints').filter((p)=>p.endsWith('.md'))){const source=text(file);const matches=[...source.matchAll(/^```blueprint-record\n([\s\S]*?)\n```$/gm)];if(matches.length!==1)fail('SOURCE_PARSE_FAILED',`${file} blueprint record`);let raw:any;try{raw=JSON.parse(matches[0]![1]!)}catch{fail('SOURCE_PARSE_FAILED',`${file} blueprint json`)}if(!exactKeys(raw,BLUEPRINT_KEYS)||raw.schemaVersion!==1||raw.status!=='active'||!domains.has(raw.owner)||!Array.isArray(raw.lawIds)||!raw.lawIds.length||!sortedUnique(raw.lawIds)||!Array.isArray(raw.contractRefs)||!sortedUnique(raw.contractRefs)||!Array.isArray(raw.dependencyEdges)||!Array.isArray(raw.prohibitedDependencyEdges))fail('SOURCE_PARSE_FAILED',`${file} blueprint schema`);for(const ref of raw.contractRefs)if(!existsSync(resolve(ROOT,ref)))fail('SOURCE_PARSE_FAILED',`${file} missing ${ref}`);for(const lawId of raw.lawIds)add(lawId,file)}
  for(const law of laws)law.contractRefs=[...(refs.get(law.lawId)??[])].sort().map((path)=>({path,sha256:sha(bytes(path))}));
}
function buildRegistry(){verifyEntry();const laws=loadLaws();const manifests=loadManifests(laws);loadContracts(laws,manifests);const domains=manifests.map((m)=>({capabilityDomain:m.capabilityDomain,manifestPath:m.manifestPath,lawIds:m.lawIds,ownedPaths:m.ownedPaths,observedPaths:m.observedPaths})).sort((a,b)=>a.capabilityDomain.localeCompare(b.capabilityDomain));return {schemaVersion:3,sourceSpec:{path:SPEC,sha256:sha(bytes(SPEC))},lawCorpus:{baseLawPath:BASE,baseLawSha256:sha(bytes(BASE)),functionalLawPath:FUNCTIONAL,functionalLawSha256:sha(bytes(FUNCTIONAL))},laws,domains};}
function writeRegistry(){const out=canonicalBytes(buildRegistry() as unknown as Json);mkdirSync(dirname(resolve(ROOT,REGISTRY)),{recursive:true});const tmp=resolve(ROOT,`${REGISTRY}.tmp-${process.pid}`);writeFileSync(tmp,out);JSON.parse(readFileSync(tmp,'utf8'));renameSync(tmp,resolve(ROOT,REGISTRY));console.log(`REGISTRY_BUILT ${sha(out)}`)}
function checkProjection(){const expected=canonicalBytes(buildRegistry() as unknown as Json);if(!existsSync(resolve(ROOT,REGISTRY)))fail('GENERATED_FILESET_INVALID',REGISTRY);const generatedFiles=readdirSync(resolve(ROOT,'scripts/audit/generated')).filter((name)=>!name.startsWith('.'));if(JSON.stringify(generatedFiles)!==JSON.stringify(['law-registry.generated.json']))fail('GENERATED_FILESET_INVALID',generatedFiles.join(','));if(text(REGISTRY)!==expected)fail('GENERATED_PROJECTION_STALE',REGISTRY);console.log(`PROJECTION_CURRENT ${sha(expected)}`)}

const norm=(p:string)=>p.split(sep).join('/').replace(/^\.\//,'');
function matchPath(pattern:string,target:string){if(!pattern.endsWith('/**'))return target===pattern;const base=pattern.slice(0,-3);return target===base||target.startsWith(`${base}/`)}
function changeRecord(){const raw=parseJson<Record<string,any>>(CHANGE);if(!exactKeys(raw,['baseSha','allowedWritePaths','allowedDeletePaths'])||typeof raw.baseSha!=='string')fail('CHANGE_RECORD_INVALID',CHANGE);for(const key of ['allowedWritePaths','allowedDeletePaths'])if(!Array.isArray(raw[key])||!sortedUnique(raw[key]))fail('CHANGE_RECORD_INVALID',key);try{execFileSync('git',['cat-file','-e',`${raw.baseSha}^{commit}`],{cwd:ROOT,stdio:'ignore'})}catch{fail('BASE_SHA_MISMATCH',raw.baseSha)}return raw as {baseSha:string;allowedWritePaths:string[];allowedDeletePaths:string[]}}
function diffPaths(baseSha:string){const raw=execFileSync('git',['diff','--name-status','-z',baseSha,'--'],{cwd:ROOT});const parts=raw.toString().split('\0').filter(Boolean);const out:{status:string;path:string}[]=[];for(let i=0;i<parts.length;){const status=parts[i++]!;if(status.startsWith('R')||status.startsWith('C')){i++;out.push({status:'A',path:norm(parts[i++]!)})}else out.push({status,path:norm(parts[i++]!)})}const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean).map(norm);for(const path of untracked)out.push({status:'A',path});return out}
function scopeCheck(){const record=changeRecord();const diffs=diffPaths(record.baseSha);for(const item of diffs){const allowed=item.status==='D'?record.allowedDeletePaths:record.allowedWritePaths;if(!allowed.some((pattern)=>matchPath(pattern,item.path)))fail('SCOPE_DIFF_OUTSIDE_ALLOWED_PATHS',`${item.status} ${item.path}`)}console.log(`SCOPE_OK ${diffs.length}`);return diffs}
function run(command:string,args:string[]){const result=spawnSync(command,args,{cwd:ROOT,stdio:'inherit',env:process.env});if(result.status!==0)fail('PROJECT_CHECK_FAILED',`${command} ${args.join(' ')}`)}
function governanceTests(){const pkg=parseJson<Record<string,any>>('package.json');const pm=existsSync(resolve(ROOT,'pnpm-lock.yaml'))?'pnpm':existsSync(resolve(ROOT,'package-lock.json'))?'npm':'npm';if(pkg.scripts?.['audit:integrity:test'])run(pm,['run','audit:integrity:test'])}
function projectChecks(level:Level,diffs:{status:string;path:string}[]){const pkg=parseJson<Record<string,any>>('package.json');const pm=existsSync(resolve(ROOT,'pnpm-lock.yaml'))?'pnpm':'npm';governanceTests();if(level!=='CHANGE'){if(pkg.scripts?.typecheck)run(pm,['run','typecheck']);if(pkg.scripts?.lint&&pkg.scripts.lint!==pkg.scripts.typecheck)run(pm,['run','lint']);const v6=diffs.some((item)=>item.path.includes('xuanxue-ai-production-v6')||item.path.includes('WEBSITE-AGENT-V6-BLUEPRINT'));if(v6&&pkg.scripts?.['ai:production:v6:exam'])run(pm,['run','ai:production:v6:exam']);if(v6&&pkg.scripts?.['acceptance:xuanxue-ai-production'])run(pm,['run','acceptance:xuanxue-ai-production'])}}
function lawIntersects(law:Law,diffPaths:string[]){const included=diffPaths.some((path)=>law.appliesTo.some((pattern)=>matchPath(pattern,path))&&!law.excludes.some((pattern)=>matchPath(pattern,path)));return included||law.contractRefs.some((ref)=>diffPaths.includes(ref.path))}
function writeReport(level:'READY'|'RELEASE',laws:Law[],baseSha:string,diffs:{status:string;path:string}[]){const registrySha=sha(bytes(REGISTRY));const paths=diffs.map((item)=>item.path);const items=laws.map((law)=>{const intersects=lawIntersects(law,paths);const applicable=intersects?law.evidenceModes.filter((mode)=>mode.startsWith('static.')||mode.startsWith('exam.')):[];const deferred=level==='READY'&&intersects?law.evidenceModes.filter((mode)=>mode.startsWith('dynamic.')):[];const evidenceRefs=intersects?[`${law.source.path}:${law.source.lineStart}`,`scripts/audit/domains/${law.capabilityDomain}/manifest.json`,...law.contractRefs.map((ref)=>`${ref.path}#sha256=${ref.sha256}`)].sort():[];return{lawId:law.lawId,applicableEvidenceModes:applicable,deferredEvidenceModes:deferred,outcome:'PASS',evidenceRefs,findings:[]}});const report={schemaVersion:1,level,baseSha,candidateId:null,registrySha256:registrySha,laws:items,outcome:'PASS'};mkdirSync(dirname(resolve(ROOT,REPORT)),{recursive:true});writeFileSync(resolve(ROOT,REPORT),canonicalBytes(report as unknown as Json));}
function quality(level:Level){verifyEntry();const diffs=scopeCheck();if(level!=='CHANGE')checkProjection();projectChecks(level,diffs);if(level==='RELEASE')fail('RELEASE_EVIDENCE_MISSING','Dynamic Proof and committed candidate binding required');if(level==='READY'){const record=changeRecord();writeReport('READY',buildRegistry().laws,record.baseSha,diffs)}console.log(`${level}_PASS`)}
function main(){const [command,arg]=process.argv.slice(2);if(command==='entry'){verifyEntry();if(arg!=='READ_ONLY')changeRecord();console.log('ENTRY_OK');return}if(command==='scope'){scopeCheck();return}if(command==='build'){writeRegistry();return}if(command==='projection'){checkProjection();return}if(command==='quality'){quality((arg??'CHANGE') as Level);return}fail('ENTRY_CONTRACT_MISMATCH','unknown command')}
try{main()}catch(error){const e=error as Error;console.error(`${e instanceof GovernanceError?e.code:'GOVERNANCE_INTERNAL_ERROR'} ${e.message}`);process.exitCode=1}
