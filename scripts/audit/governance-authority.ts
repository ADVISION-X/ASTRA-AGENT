import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  ROOT, GIT_EVIDENCE_MAX_BUFFER, GovernanceError, fail, bytes, utf8, text, sha, norm, repositoryPaths,
  repositoryIdentity, walk,
} from './governance-runtime.js';
import {
  sortedUnique, exactKeys, canonicalValue, canonicalBytes, rejectDuplicateJsonKeys, parseJson,
  isStringArray, cleanString, pathPatternValid, pathPatternContains,
} from './governance-json.js';

type Level = 'CHANGE' | 'READY' | 'RELEASE';
type Law = {
  schemaVersion: 2; lawId: string; supersedesLawId: string | null; status: 'active'; tier: 'P0'|'P1'|'P2';
  capabilityDomain: string; enforcementMode: 'static'|'exam'|'dynamic'|'composite'; evidenceModes: string[];
  summary: string; appliesTo: string[]; excludes: string[]; forbidden: string[]; dependsOnLawIds: string[];
  source: { path: string; lineStart: number; lineEnd: number; sectionSha256: string }; contractRefs: {path:string;sha256:string}[];
};
type Manifest = { schemaVersion:3; capabilityDomain:string; status:'active'; lawIds:string[]; ownedPaths:string[]; observedPaths:string[]; manifestPath:string };

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
const CI_FULL_COMMAND = 'GRASSEYE_QUALITY_REPORT_MODE=external npm run quality:check -- READY';
const LAW_ID_PATTERN = /^LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3}-V[1-9][0-9]*$/u;
const DOMAIN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

type FreezeRecord={schemaVersion:number;status:string;specPath:string;specSha256:string;freezeVersion:string;amendmentAuthority:string;derivatives:{pdf:{enabled:boolean;path:string;sourceSha256:string;fileSha256:string}}};
function verifyFreeze(){
  const freeze=parseJson<FreezeRecord>(FREEZE);
  if(!exactKeys(freeze,['schemaVersion','status','specPath','specSha256','freezeVersion','amendmentAuthority','derivatives'])) fail('FREEZE_HASH_MISMATCH','freeze fields');
  if(freeze.schemaVersion!==2||freeze.status!=='SPEC_FROZEN'||freeze.specPath!==SPEC||freeze.freezeVersion!=='FROZEN-FINAL-V3.2'||freeze.amendmentAuthority!=='explicit-human-only') fail('FREEZE_HASH_MISMATCH','freeze values');
  if(sha(bytes(SPEC))!==freeze.specSha256) fail('FREEZE_HASH_MISMATCH','spec hash');
  const pdf=freeze.derivatives?.pdf;
  if(!pdf||!exactKeys(pdf,['enabled','path','sourceSha256','fileSha256'])) fail('FREEZE_HASH_MISMATCH','pdf fields');
  if(pdf.enabled && (pdf.sourceSha256!==freeze.specSha256||typeof pdf.path!=='string'||sha(bytes(pdf.path))!==pdf.fileSha256)) fail('FREEZE_HASH_MISMATCH','pdf hash');
}
function verifyAgents(){ if(text('AGENTS.md')!==AGENTS_EXACT) fail('ENTRY_CONTRACT_MISMATCH','AGENTS.md'); }
function verifyCommands(){
  const pkg=parseJson<{scripts?:Record<string,string>}>('package.json'); const scripts=pkg.scripts??{};
  for(const name of PUBLIC_SCRIPTS) if(typeof scripts[name]!=='string') fail('ENTRY_CONTRACT_MISMATCH',`missing ${name}`);
  const old=Object.keys(scripts).filter((name)=>name.startsWith('governance:')&&!PUBLIC_SCRIPTS.includes(name));
  if(old.length) fail('ENTRY_CONTRACT_MISMATCH',`retired commands: ${old.join(',')}`);
  if(scripts['ci:full']!==CI_FULL_COMMAND||scripts['quality:check']!=='node --import tsx scripts/audit/governance-v32.ts quality') fail('ENTRY_CONTRACT_MISMATCH','canonical quality command');
  const extraQuality=Object.keys(scripts).filter((name)=>/quality|verdict/iu.test(name)&&!['ci:full','quality:check'].includes(name));
  if(extraQuality.length)fail('ENTRY_CONTRACT_MISMATCH',`second quality command: ${extraQuality.sort().join(',')}`);
}
function verifyEntry(){ verifyFreeze(); verifyAgents(); verifyCommands(); }

function frontMatter(path:string,type:string,authority:number){
  const expected=`---\ndocumentType: ${type}\nschemaVersion: 2\nstatus: active\nauthorityLevel: ${authority}\ncontainerOwner: law-system\nlawIdPrefix: LAW\n---\n`;
  const source=text(path);
  if(!source.startsWith(expected)||source.slice(expected.length).split('\n').some((line)=>line==='---')) fail('SOURCE_PARSE_FAILED',`${path} front matter`);
}
type LawHeading={lawId:string;line:number};
type LawVersion={key:string;major:number};
const parseLawJson=(source:string,location:string):Law=>{try{rejectDuplicateJsonKeys(source,location);return JSON.parse(source) as Law}catch(error){if(error instanceof GovernanceError)throw error;return fail('SOURCE_PARSE_FAILED',location)}};
const validateLawSchema=(raw:Law,heading:LawHeading,domain:string,path:string):void=>{
  if(!exactKeys(raw as Record<string,unknown>,LAW_KEYS)||raw.lawId!==heading.lawId||raw.capabilityDomain!==domain||raw.schemaVersion!==2||raw.status!=='active')fail('SOURCE_PARSE_FAILED',`${raw.lawId??path} schema`);
  if(!LAW_ID_PATTERN.test(raw.lawId)||!DOMAIN_PATTERN.test(raw.capabilityDomain)||!['P0','P1','P2'].includes(raw.tier))fail('SOURCE_PARSE_FAILED',`${raw.lawId} identity`);
};
const validateLawVersion=(raw:Law,domain:string):LawVersion=>{
  const match=raw.lawId.match(/^(LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3})-V([1-9][0-9]*)$/u);const key=match?.[1];const major=Number(match?.[2]);
  if(!key||raw.lawId!==`LAW-${domain.toUpperCase()}-${key.split('-').at(-1)}-V${major}`)return fail('SOURCE_PARSE_FAILED',`${raw.lawId} domain mapping`);
  const expectedSupersedes=major===1?null:`${key}-V${major-1}`;if(raw.supersedesLawId!==expectedSupersedes)fail('SOURCE_PARSE_FAILED',`${raw.lawId} supersedes`);
  return{key,major};
};
const validateLawEvidence=(raw:Law):void=>{
  if(!raw.evidenceModes.length||raw.evidenceModes.length!==new Set(raw.evidenceModes).size||raw.evidenceModes.some((mode)=>!EVIDENCE.includes(mode))||raw.evidenceModes.some((mode,index)=>index>0&&EVIDENCE.indexOf(raw.evidenceModes[index-1]!)>=EVIDENCE.indexOf(mode)))fail('SOURCE_PARSE_FAILED',`${raw.lawId} evidence`);
  const kinds=new Set(raw.evidenceModes.map((mode)=>mode.split('.')[0]));const expected=kinds.size>1?'composite':[...kinds][0];if(raw.enforcementMode!==expected)fail('SOURCE_PARSE_FAILED',`${raw.lawId} enforcement`);
};
const validateLawPaths=(raw:Law):void=>{
  for(const field of ['appliesTo','excludes','dependsOnLawIds'] as const){const values=raw[field];if(!isStringArray(values)||!sortedUnique(values)||values.some((value)=>!cleanString(value)))fail('SOURCE_PARSE_FAILED',`${raw.lawId} ${field}`)}
  if(raw.appliesTo.some((pattern)=>!pathPatternValid(pattern))||raw.excludes.some((pattern)=>!pathPatternValid(pattern)))fail('SOURCE_PARSE_FAILED',`${raw.lawId} path grammar`);
  if(raw.appliesTo.includes('**/*')&&!['project-governance','law-system','audit-system'].includes(raw.capabilityDomain))fail('SOURCE_PARSE_FAILED',`${raw.lawId} root glob`);
  if(raw.excludes.some((excluded)=>!raw.appliesTo.some((included)=>pathPatternContains(included,excluded))))fail('SOURCE_PARSE_FAILED',`${raw.lawId} exclude containment`);
};
const validateLawContent=(raw:Law):void=>{
  if(!cleanString(raw.summary)||[...raw.summary].length<12||[...raw.summary].length>240||!/^(必须|只能)/u.test(raw.summary)||/(建议|尽量|可能|一般|视情况|原则上)/u.test(raw.summary))fail('SOURCE_PARSE_FAILED',`${raw.lawId} summary`);
  if(!isStringArray(raw.forbidden)||raw.forbidden.length!==new Set(raw.forbidden).size||raw.forbidden.some((value)=>!cleanString(value)))fail('SOURCE_PARSE_FAILED',`${raw.lawId} forbidden`);
  if(!raw.appliesTo.length||!raw.forbidden.length||raw.forbidden.length>16||raw.forbidden.some((value)=>!/^(不得|禁止)/u.test(value)))fail('SOURCE_PARSE_FAILED',`${raw.lawId} bounds`);
};
const readLawRecord=(lines:string[],start:number,path:string,heading:LawHeading,domain:string):{law:Law;end:number;version:LawVersion}=>{
  let end=start;while(end<lines.length&&lines[end]!=='```')end++;if(end>=lines.length)fail('SOURCE_PARSE_FAILED',`${path}:unclosed`);
  const raw=parseLawJson(lines.slice(start,end).join('\n'),`${path}:${start+1}`);validateLawSchema(raw,heading,domain,path);const version=validateLawVersion(raw,domain);validateLawEvidence(raw);validateLawPaths(raw);validateLawContent(raw);
  const section=lines.slice(heading.line-1,end+1).join('\n')+'\n';return{law:{...raw,source:{path,lineStart:heading.line,lineEnd:end+1,sectionSha256:sha(section)},contractRefs:[]},end,version};
};
const validDomainTransition=(type:'base-law'|'functional-law',heading:LawHeading|null,previousDomain:string,next:string):boolean=>DOMAIN_PATTERN.test(next)&&!heading&&(type==='base-law'||!previousDomain||Buffer.compare(Buffer.from(previousDomain),Buffer.from(next))<0);
const orphanLawFence=(line:string):boolean=>line.startsWith('```')||/^\s+```/u.test(line);
const lawVersionOutOfOrder=(type:'base-law'|'functional-law',previous:LawVersion|null,next:LawVersion):boolean=>type==='functional-law'&&Boolean(previous)&&(previous!.key>next.key||(previous!.key===next.key&&previous!.major>=next.major));
const validBaseRootLaws=(laws:Law[]):boolean=>laws.length===8&&laws.every((law,index)=>law.lawId===`LAW-PROJECT-GOVERNANCE-00${index+1}-V1`&&law.capabilityDomain==='project-governance');
const corpusLines=(path:string,type:'base-law'|'functional-law'):string[]=>{frontMatter(path,type,type==='base-law'?100:90);const source=text(path);if(source.includes('\r')||path!==path.normalize('NFC'))fail('SOURCE_PARSE_FAILED',`${path} encoding`);return source.split('\n')};
type CorpusState={domain:string;previousDomain:string;heading:LawHeading|null;previousLaw:LawVersion|null;laws:Law[]};
const consumeDomainHeading=(state:CorpusState,line:string,type:'base-law'|'functional-law',path:string,lineNumber:number):boolean=>{
  const match=line.match(/^## capabilityDomain: ([a-z0-9]+(?:-[a-z0-9]+)*)$/u);if(!match)return false;const next=match[1]!;
  if(!validDomainTransition(type,state.heading,state.previousDomain,next))fail('SOURCE_PARSE_FAILED',`${path}:${lineNumber} domain order`);
  state.domain=next;state.previousDomain=next;state.previousLaw=null;return true;
};
const consumeLawHeading=(state:CorpusState,line:string,path:string,lineNumber:number):boolean=>{
  const match=line.match(/^### \[(LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3}-V[1-9][0-9]*)\] .+$/u);if(!match)return false;
  if(state.heading)fail('SOURCE_PARSE_FAILED',`${path}:${state.heading.line} missing law record`);state.heading={lawId:match[1]!,line:lineNumber};return true;
};
const consumeNonRecordLine=(line:string,path:string,lineNumber:number):boolean=>{
  if(line==='```law-record')return false;if(orphanLawFence(line))fail('SOURCE_PARSE_FAILED',`${path}:${lineNumber} orphan or nested fence`);return true;
};
const consumeLawRecord=(state:CorpusState,lines:string[],index:number,path:string,type:'base-law'|'functional-law'):number=>{
  if(!state.heading||!state.domain)return fail('SOURCE_PARSE_FAILED',`${path}:${index+1}`);const record=readLawRecord(lines,index+1,path,state.heading,state.domain);
  if(lawVersionOutOfOrder(type,state.previousLaw,record.version))fail('SOURCE_PARSE_FAILED',`${record.law.lawId} law order`);
  state.previousLaw=record.version;state.laws.push(record.law);state.heading=null;return record.end;
};
function parseCorpus(path:string,type:'base-law'|'functional-law'):Law[]{
  const lines=corpusLines(path,type);const state:CorpusState={domain:'',previousDomain:'',heading:null,previousLaw:null,laws:[]};
  for(let i=0;i<lines.length;i++){
    const line=lines[i]!;if(consumeDomainHeading(state,line,type,path,i+1))continue;if(consumeLawHeading(state,line,path,i+1))continue;
    if(consumeNonRecordLine(line,path,i+1))continue;i=consumeLawRecord(state,lines,i,path,type);
  }
  if(state.heading)fail('SOURCE_PARSE_FAILED',`${path}:${state.heading.line} missing law record`);
  if(type==='base-law'&&!validBaseRootLaws(state.laws))fail('SOURCE_PARSE_FAILED','base root laws');return state.laws;
}
function loadLaws(){ const laws=[...parseCorpus(BASE,'base-law'),...parseCorpus(FUNCTIONAL,'functional-law')].sort((a,b)=>a.lawId.localeCompare(b.lawId)); const ids=new Set<string>(); for(const law of laws){if(ids.has(law.lawId))fail('SOURCE_PARSE_FAILED',`duplicate ${law.lawId}`);ids.add(law.lawId)} for(const law of laws)for(const dep of law.dependsOnLawIds){if(dep===law.lawId)fail('SOURCE_PARSE_FAILED',`${law.lawId} self dependency`);if(!ids.has(dep))fail('SOURCE_PARSE_FAILED',`${law.lawId} missing ${dep}`)}const byId=new Map(laws.map((law)=>[law.lawId,law]));const visiting=new Set<string>();const visited=new Set<string>();const visit=(lawId:string)=>{if(visiting.has(lawId))fail('SOURCE_PARSE_FAILED',`dependency cycle ${lawId}`);if(visited.has(lawId))return;visiting.add(lawId);for(const dep of byId.get(lawId)?.dependsOnLawIds??[])visit(dep);visiting.delete(lawId);visited.add(lawId)};for(const law of laws)visit(law.lawId);return laws; }
type RawManifest=Omit<Manifest,'manifestPath'>;
const validateManifest=(raw:RawManifest,rel:string,domain:string,laws:Law[]):Manifest=>{
  if(!exactKeys(raw as Record<string,unknown>,MANIFEST_KEYS)||raw.schemaVersion!==3||raw.status!=='active'||raw.capabilityDomain!==domain||!DOMAIN_PATTERN.test(domain))fail('SOURCE_PARSE_FAILED',`${rel} schema`);
  for(const key of ['lawIds','ownedPaths','observedPaths'] as const){const values=raw[key];if(!isStringArray(values)||!sortedUnique(values)||values.some((value)=>!cleanString(value)))fail('SOURCE_PARSE_FAILED',`${rel} ${key}`)}
  for(const pattern of [...raw.ownedPaths,...raw.observedPaths])if(!pathPatternValid(pattern)||pattern==='**/*')fail('SOURCE_PARSE_FAILED',`${rel} path grammar`);
  if(raw.ownedPaths.some((owned)=>raw.observedPaths.includes(owned)))fail('SOURCE_PARSE_FAILED',`${rel} owned/observed overlap`);
  const expected=laws.filter((law)=>law.capabilityDomain===domain).map((law)=>law.lawId).sort();if(JSON.stringify(raw.lawIds)!==JSON.stringify(expected)||!expected.length)fail('SOURCE_PARSE_FAILED',`${rel} lawIds`);
  return{...raw,manifestPath:rel};
};
const validateManifestCoverage=(manifests:Manifest[],laws:Law[]):void=>{const domains=new Set(laws.map((law)=>law.capabilityDomain));if(manifests.length!==domains.size)fail('SOURCE_PARSE_FAILED','unexpected manifest domain');for(const domain of domains)if(!manifests.some((manifest)=>manifest.capabilityDomain===domain))fail('SOURCE_PARSE_FAILED',`missing manifest ${domain}`)};
const pathsOverlap=(left:string,right:string):boolean=>{const covers=(parent:string,child:string)=>parent.endsWith('/**')?(child===parent.slice(0,-3)||child.startsWith(`${parent.slice(0,-3)}/`)):parent===child;return covers(left,right)||covers(right,left)};
const validateManifestOwners=(manifests:Manifest[]):void=>{const owners:{pattern:string;domain:string}[]=[];for(const manifest of manifests)for(const pattern of manifest.ownedPaths){for(const old of owners)if(pathsOverlap(pattern,old.pattern))fail('SOURCE_PARSE_FAILED',`owner overlap ${old.domain}/${manifest.capabilityDomain}: ${old.pattern}/${pattern}`);owners.push({pattern,domain:manifest.capabilityDomain})}};
function loadManifests(laws:Law[]):Manifest[]{
  const dir=resolve(ROOT,'scripts/audit/domains'); const entries=readdirSync(dir,{withFileTypes:true}).filter((e)=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)); const manifests:Manifest[]=[];
  for(const entry of entries){const rel=`scripts/audit/domains/${entry.name}/manifest.json`;if(existsSync(resolve(ROOT,rel)))manifests.push(validateManifest(parseJson<RawManifest>(rel),rel,entry.name,laws))}
  validateManifestCoverage(manifests,laws);validateManifestOwners(manifests);
  return manifests;
}
const REPO_PATTERN=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
type AuthorityArtifact={path:string;selector:string;sha256:string};
type CrossRepoContract={contractId:string;version:number;providerRepo:string;providerDomain:string;authorityArtifact:AuthorityArtifact;consumerRepos:string[]};
type ContractPin={contractId:string;version:number;providerRepo:string;providerDomain:string;providerSpecRef:string;providerCommitSha:string;contractSha256:string};
type MigrationContract={currentAuthority:string;targetAuthority:string;compatibilityMechanisms:unknown[];startDate:string;monitoring:unknown[];rollbackCondition:string;maximumDurationDays:number;removalDate:string;removalAcceptance:unknown[]};
type GovernanceSpec={schemaVersion:number;status:string;version:number;specId:string;owner:string;lawIds:string[];specKind:string;contract:CrossRepoContract|ContractPin|MigrationContract};
type EdgeEndpoint={repo:string;domain:string};
type DependencyEdge={from:EdgeEndpoint;to:EdgeEndpoint;contractRef:string|null};
type ProhibitedEdge={from:EdgeEndpoint;to:EdgeEndpoint;lawId:string};
type Blueprint={schemaVersion:number;status:string;blueprintId:string;owner:string;lawIds:string[];contractRefs:string[];dependencyEdges:DependencyEdge[];prohibitedDependencyEdges:ProhibitedEdge[]};
type ContractContext={lawIds:Set<string>;lawById:Map<string,Law>;domains:Set<string>;refs:Map<string,Set<string>>;specOwners:Map<string,string>;externalEndpoints:Set<string>};
const addContractRef=(context:ContractContext,lawId:string,file:string,owner:string):void=>{const law=context.lawById.get(lawId);if(!law)return fail('SOURCE_PARSE_FAILED',`${file} unknown ${lawId}`);if(law.capabilityDomain!==owner)fail('SOURCE_PARSE_FAILED',`${file} owner/law mismatch ${lawId}`);const refs=context.refs.get(lawId)??new Set<string>();refs.add(file);context.refs.set(lawId,refs)};
const validAuthorityArtifact=(artifact:AuthorityArtifact):boolean=>Boolean(artifact)&&exactKeys(artifact as Record<string,unknown>,['path','selector','sha256'])&&pathPatternValid(artifact.path)&&cleanString(artifact.selector)&&/^[a-f0-9]{64}$/u.test(artifact.sha256);
const validateCrossRepoContract=(contract:CrossRepoContract,file:string,version:number):void=>{if(!exactKeys(contract as Record<string,unknown>,['contractId','version','providerRepo','providerDomain','authorityArtifact','consumerRepos'])||!cleanString(contract.contractId)||!Number.isInteger(contract.version)||contract.version!==version||!REPO_PATTERN.test(contract.providerRepo)||!DOMAIN_PATTERN.test(contract.providerDomain)||!isStringArray(contract.consumerRepos)||!sortedUnique(contract.consumerRepos)||contract.consumerRepos.some((repo)=>!REPO_PATTERN.test(repo))||!validAuthorityArtifact(contract.authorityArtifact))fail('SOURCE_PARSE_FAILED',`${file} provider`)};
const validateContractPin=(context:ContractContext,contract:ContractPin,file:string,version:number):void=>{if(!exactKeys(contract as Record<string,unknown>,['contractId','version','providerRepo','providerDomain','providerSpecRef','providerCommitSha','contractSha256'])||!cleanString(contract.contractId)||!Number.isInteger(contract.version)||contract.version!==version||!REPO_PATTERN.test(contract.providerRepo)||!DOMAIN_PATTERN.test(contract.providerDomain)||!pathPatternValid(contract.providerSpecRef)||!contract.providerSpecRef.endsWith('.spec.json')||!/^[a-f0-9]{40,64}$/u.test(contract.providerCommitSha)||!/^[a-f0-9]{64}$/u.test(contract.contractSha256))fail('SOURCE_PARSE_FAILED',`${file} pin`);context.externalEndpoints.add(`${contract.providerRepo}\0${contract.providerDomain}`)};
const MIGRATION_KEYS = [
  'currentAuthority', 'targetAuthority', 'compatibilityMechanisms', 'startDate', 'monitoring',
  'rollbackCondition', 'maximumDurationDays', 'removalDate', 'removalAcceptance',
];
const validMigrationCollections = (contract: MigrationContract): boolean =>
  Array.isArray(contract.compatibilityMechanisms) && contract.compatibilityMechanisms.length > 0
  && Array.isArray(contract.monitoring) && contract.monitoring.length > 0
  && Array.isArray(contract.removalAcceptance) && contract.removalAcceptance.length > 0;
const validMigrationFields = (contract: MigrationContract): boolean =>
  exactKeys(contract as Record<string, unknown>, MIGRATION_KEYS)
  && cleanString(contract.currentAuthority)
  && cleanString(contract.targetAuthority)
  && cleanString(contract.rollbackCondition)
  && Number.isInteger(contract.maximumDurationDays)
  && contract.maximumDurationDays >= 1
  && /^\d{4}-\d{2}-\d{2}$/u.test(contract.startDate)
  && /^\d{4}-\d{2}-\d{2}$/u.test(contract.removalDate)
  && validMigrationCollections(contract);
const validateMigrationDeadline = (contract: MigrationContract, file: string): void => {
  const start = Date.parse(`${contract.startDate}T00:00:00Z`);
  const removal = Date.parse(`${contract.removalDate}T00:00:00Z`);
  const deadline = start + contract.maximumDurationDays * 86_400_000;
  if (!Number.isFinite(start) || !Number.isFinite(removal) || removal < start || removal > deadline) {
    fail('SOURCE_PARSE_FAILED', `${file} migration deadline`);
  }
};
const validateMigration = (contract: MigrationContract, file: string): void => {
  if (!validMigrationFields(contract)) fail('SOURCE_PARSE_FAILED', `${file} migration`);
  validateMigrationDeadline(contract, file);
};
const validateSpecHeader=(raw:GovernanceSpec,file:string,context:ContractContext):void=>{if(!exactKeys(raw as Record<string,unknown>,SPEC_KEYS)||raw.schemaVersion!==1||raw.status!=='active'||!Number.isInteger(raw.version)||raw.version<1||!cleanString(raw.specId)||!context.domains.has(raw.owner)||!DOMAIN_PATTERN.test(raw.owner)||!raw.specId.startsWith(`${raw.owner}.`)||!isStringArray(raw.lawIds)||!raw.lawIds.length||!sortedUnique(raw.lawIds)||!raw.contract||typeof raw.contract!=='object'||Array.isArray(raw.contract))fail('SOURCE_PARSE_FAILED',`${file} schema`)};
const loadSpecs=(context:ContractContext):void=>{for(const file of walk('docs/specs').filter((path)=>path.endsWith('.spec.json'))){const raw=parseJson<GovernanceSpec>(file);validateSpecHeader(raw,file,context);for(const lawId of raw.lawIds)addContractRef(context,lawId,file,raw.owner);if(raw.specKind==='cross-repo-contract')validateCrossRepoContract(raw.contract as CrossRepoContract,file,raw.version);else if(raw.specKind==='contract-pin')validateContractPin(context,raw.contract as ContractPin,file,raw.version);else if(raw.specKind==='migration')validateMigration(raw.contract as MigrationContract,file);else fail('SOURCE_PARSE_FAILED',`${file} unsupported specKind schema`);context.specOwners.set(file,raw.owner)}};
const validateEndpoint=(value:EdgeEndpoint,file:string,context:ContractContext):EdgeEndpoint=>{if(!value||!exactKeys(value as Record<string,unknown>,['repo','domain'])||typeof value.repo!=='string'||typeof value.domain!=='string'||!DOMAIN_PATTERN.test(value.domain))fail('SOURCE_PARSE_FAILED',`${file} edge endpoint`);if(value.repo==='local'){if(!context.domains.has(value.domain))fail('SOURCE_PARSE_FAILED',`${file} local edge domain`)}else if(!REPO_PATTERN.test(value.repo)||!context.externalEndpoints.has(`${value.repo}\0${value.domain}`))fail('SOURCE_PARSE_FAILED',`${file} external edge endpoint`);return value};
const validateBlueprintHeader=(raw:Blueprint,file:string,context:ContractContext):void=>{if(!exactKeys(raw as Record<string,unknown>,BLUEPRINT_KEYS)||raw.schemaVersion!==1||raw.status!=='active'||!cleanString(raw.blueprintId)||!context.domains.has(raw.owner)||!DOMAIN_PATTERN.test(raw.owner)||!isStringArray(raw.lawIds)||!raw.lawIds.length||!sortedUnique(raw.lawIds)||!isStringArray(raw.contractRefs)||!sortedUnique(raw.contractRefs)||raw.contractRefs.some((ref)=>!pathPatternValid(ref)||context.specOwners.get(ref)!==raw.owner)||!Array.isArray(raw.dependencyEdges)||!Array.isArray(raw.prohibitedDependencyEdges))fail('SOURCE_PARSE_FAILED',`${file} blueprint schema`)};
const validateAllowedEdges=(raw:Blueprint,file:string,context:ContractContext):string[]=>raw.dependencyEdges.map((edge)=>{if(!edge||!exactKeys(edge as Record<string,unknown>,['from','to','contractRef']))fail('SOURCE_PARSE_FAILED',`${file} dependency edge schema`);const from=validateEndpoint(edge.from,file,context);const to=validateEndpoint(edge.to,file,context);if((from.repo===to.repo&&from.domain===to.domain)||(from.repo==='local'&&from.domain!==raw.owner))fail('SOURCE_PARSE_FAILED',`${file} dependency owner`);if(edge.contractRef!==null&&(!raw.contractRefs.includes(edge.contractRef)||context.specOwners.get(edge.contractRef)!==raw.owner))fail('SOURCE_PARSE_FAILED',`${file} edge contractRef`);if((from.repo!=='local'||to.repo!=='local')&&edge.contractRef===null)fail('SOURCE_PARSE_FAILED',`${file} cross-repo edge contractRef`);return canonicalBytes(edge).trim()});
const validateProhibitedEdges=(raw:Blueprint,file:string,context:ContractContext):string[]=>raw.prohibitedDependencyEdges.map((edge)=>{if(!edge||!exactKeys(edge as Record<string,unknown>,['from','to','lawId']))fail('SOURCE_PARSE_FAILED',`${file} prohibited edge schema`);const from=validateEndpoint(edge.from,file,context);const to=validateEndpoint(edge.to,file,context);if((from.repo===to.repo&&from.domain===to.domain)||(from.repo==='local'&&from.domain!==raw.owner)||!raw.lawIds.includes(edge.lawId)||!context.lawIds.has(edge.lawId))fail('SOURCE_PARSE_FAILED',`${file} prohibited edge reference`);return canonicalBytes(edge).trim()});
const readBlueprint=(file:string):Blueprint=>{const matches=[...text(file).matchAll(/^```blueprint-record\n([\s\S]*?)\n```$/gmu)];if(matches.length!==1)fail('SOURCE_PARSE_FAILED',`${file} blueprint record`);try{rejectDuplicateJsonKeys(matches[0]![1]!,file);return JSON.parse(matches[0]![1]!) as Blueprint}catch(error){if(error instanceof GovernanceError)throw error;return fail('SOURCE_PARSE_FAILED',`${file} blueprint json`)}};
const edgeIdentity=(edge:DependencyEdge|ProhibitedEdge):string=>`${edge.from.repo}\0${edge.from.domain}\0${edge.to.repo}\0${edge.to.domain}`;
const loadBlueprints=(context:ContractContext):void=>{for(const file of walk('docs/blueprints').filter((path)=>path.endsWith('.md'))){const raw=readBlueprint(file);validateBlueprintHeader(raw,file,context);for(const lawId of raw.lawIds)addContractRef(context,lawId,file,raw.owner);const allowedKeys=validateAllowedEdges(raw,file,context);if(!sortedUnique(allowedKeys))fail('SOURCE_PARSE_FAILED',`${file} dependency edge order`);const prohibitedKeys=validateProhibitedEdges(raw,file,context);if(!sortedUnique(prohibitedKeys))fail('SOURCE_PARSE_FAILED',`${file} prohibited edge order`);const allowedIdentities=new Set(raw.dependencyEdges.map(edgeIdentity));if(raw.prohibitedDependencyEdges.some((edge)=>allowedIdentities.has(edgeIdentity(edge))))fail('SOURCE_PARSE_FAILED',`${file} edge conflict`)}};
function loadContracts(laws:Law[],manifests:Manifest[]){const context:ContractContext={lawIds:new Set(laws.map((law)=>law.lawId)),lawById:new Map(laws.map((law)=>[law.lawId,law])),domains:new Set(manifests.map((manifest)=>manifest.capabilityDomain)),refs:new Map(),specOwners:new Map(),externalEndpoints:new Set()};loadSpecs(context);loadBlueprints(context);for(const law of laws)law.contractRefs=[...(context.refs.get(law.lawId)??[])].sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right))).map((path)=>({path,sha256:sha(bytes(path))}))}
function verifyNoRetiredLawReferences(laws:Law[]){const active=new Set(laws.map((law)=>law.lawId));const consumerRoots=['docs/blueprints/','docs/specs/','scripts/audit/domains/','src/','scripts/startup/'];for(const path of repositoryPaths().filter((candidate)=>consumerRoots.some((root)=>candidate.startsWith(root)))){for(const match of text(path).matchAll(/LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3}-V[1-9][0-9]*/gu)){if(!active.has(match[0]))fail('RETIRED_LAW_REFERENCE',`${path}:${match[0]}`)}}}
const consumerRepository=():string=>{try{return repositoryIdentity(execFileSync('git',['config','--get','remote.origin.url'],{cwd:ROOT,stdio:['ignore','pipe','ignore']}).toString('utf8'))}catch{return fail('CROSS_REPO_PROVIDER_DESCRIPTOR_UNVERIFIED','consumer origin')}};
const providerGit=(root:string,file:string,args:string[]):Buffer=>{try{return execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','ignore']})}catch{return fail('CROSS_REPO_PROVIDER_DESCRIPTOR_UNVERIFIED',`${file}:${args.join(' ')}`)}};
const parseProviderDescriptor=(bytesValue:Buffer,location:string,file:string):GovernanceSpec=>{try{const source=utf8.decode(bytesValue);rejectDuplicateJsonKeys(source,location);return JSON.parse(source) as GovernanceSpec}catch{return fail('CROSS_REPO_PROVIDER_DESCRIPTOR_UNVERIFIED',`${file}:descriptor parse`)}};
const validProviderDescriptorHeader=(descriptor:GovernanceSpec,binding:ContractPin):boolean=>exactKeys(descriptor as Record<string,unknown>,SPEC_KEYS)&&descriptor.schemaVersion===1&&descriptor.status==='active'&&descriptor.specKind==='cross-repo-contract'&&descriptor.specId===binding.contractId&&descriptor.version===binding.version&&descriptor.owner===binding.providerDomain&&isStringArray(descriptor.lawIds)&&Boolean(descriptor.lawIds.length)&&sortedUnique(descriptor.lawIds);
const validProviderContractBinding=(contract:CrossRepoContract,binding:ContractPin,providerRepo:string,consumerRemote:string):boolean=>Boolean(contract)&&exactKeys(contract as Record<string,unknown>,['contractId','version','providerRepo','providerDomain','authorityArtifact','consumerRepos'])&&contract.contractId===binding.contractId&&contract.version===binding.version&&contract.providerRepo===providerRepo&&contract.providerDomain===binding.providerDomain&&isStringArray(contract.consumerRepos)&&sortedUnique(contract.consumerRepos)&&contract.consumerRepos.includes(consumerRemote)&&validAuthorityArtifact(contract.authorityArtifact)&&sha(JSON.stringify(canonicalValue(contract)))===binding.contractSha256;
const providerDescriptorMatches=(descriptor:GovernanceSpec,binding:ContractPin,providerRepo:string,consumerRemote:string):boolean=>validProviderDescriptorHeader(descriptor,binding)&&validProviderContractBinding(descriptor.contract as CrossRepoContract,binding,providerRepo,consumerRemote);
const verifyPinnedSpec=(pin:GovernanceSpec,file:string,consumerRemote:string):void=>{
  const binding=pin.contract as ContractPin;const providerRepo=binding.providerRepo;const leaf=providerRepo.split('/')[1];
  if(!leaf||!pathPatternValid(leaf)||!pathPatternValid(binding.providerSpecRef))return fail('CROSS_REPO_PROVIDER_DESCRIPTOR_UNVERIFIED',file);
  const providerRoot=resolve(ROOT,'..',leaf);const git=(args:string[])=>providerGit(providerRoot,file,args);
  if(repositoryIdentity(git(['config','--get','remote.origin.url']).toString('utf8'))!==providerRepo)fail('CROSS_REPO_PROVIDER_DESCRIPTOR_UNVERIFIED',`${file}:provider origin`);
  git(['cat-file','-e',`${binding.providerCommitSha}^{commit}`]);const descriptor=parseProviderDescriptor(git(['show',`${binding.providerCommitSha}:${binding.providerSpecRef}`]),`${providerRepo}:${binding.providerSpecRef}`,file);
  if(!providerDescriptorMatches(descriptor,binding,providerRepo,consumerRemote))fail('CROSS_REPO_PROVIDER_DESCRIPTOR_UNVERIFIED',`${file}:descriptor binding`);
  const contract=descriptor.contract as CrossRepoContract;if(sha(git(['show',`${binding.providerCommitSha}:${contract.authorityArtifact.path}`]))!==contract.authorityArtifact.sha256)fail('CROSS_REPO_PROVIDER_DESCRIPTOR_UNVERIFIED',`${file}:authority artifact`);
};
function verifyPinnedProviderDescriptors(){const consumerRemote=consumerRepository();for(const file of walk('docs/specs').filter((path)=>path.endsWith('.spec.json'))){const pin=parseJson<GovernanceSpec>(file);if(pin.specKind==='contract-pin')verifyPinnedSpec(pin,file,consumerRemote)}}
function buildRegistry(){verifyEntry();const laws=loadLaws();const manifests=loadManifests(laws);loadContracts(laws,manifests);verifyNoRetiredLawReferences(laws);const domains=manifests.map((m)=>({capabilityDomain:m.capabilityDomain,manifestPath:m.manifestPath,lawIds:m.lawIds,ownedPaths:m.ownedPaths,observedPaths:m.observedPaths})).sort((a,b)=>a.capabilityDomain.localeCompare(b.capabilityDomain));return {schemaVersion:3,sourceSpec:{path:SPEC,sha256:sha(bytes(SPEC))},lawCorpus:{baseLawPath:BASE,baseLawSha256:sha(bytes(BASE)),functionalLawPath:FUNCTIONAL,functionalLawSha256:sha(bytes(FUNCTIONAL))},laws,domains};}
function writeRegistry(){const out=canonicalBytes(buildRegistry());mkdirSync(dirname(resolve(ROOT,REGISTRY)),{recursive:true});const tmp=resolve(ROOT,`${REGISTRY}.tmp-${process.pid}`);writeFileSync(tmp,out);JSON.parse(readFileSync(tmp,'utf8'));renameSync(tmp,resolve(ROOT,REGISTRY));console.log(`REGISTRY_BUILT ${sha(out)}`)}
function checkProjection(){const before=candidateSnapshot();const expected=canonicalBytes(buildRegistry());if(candidateSnapshot()!==before)fail('CANDIDATE_DRIFT','candidate changed while building projection');if(!existsSync(resolve(ROOT,REGISTRY)))fail('GENERATED_FILESET_INVALID',REGISTRY);const generatedFiles=readdirSync(resolve(ROOT,'scripts/audit/generated')).filter((name)=>!name.startsWith('.')).sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)));if(JSON.stringify(generatedFiles)!==JSON.stringify(['law-registry.generated.json']))fail('GENERATED_FILESET_INVALID',generatedFiles.join(','));if(text(REGISTRY)!==expected)fail('GENERATED_PROJECTION_STALE',REGISTRY);if(candidateSnapshot()!==before)fail('CANDIDATE_DRIFT','candidate changed while checking projection');console.log(`PROJECTION_CURRENT ${sha(expected)}`)}

function candidateSnapshot(){const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT}).toString().trim();const diff=execFileSync('git',['diff','--binary','--no-ext-diff','HEAD','--'],{cwd:ROOT,maxBuffer:GIT_EVIDENCE_MAX_BUFFER});const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:ROOT,maxBuffer:GIT_EVIDENCE_MAX_BUFFER}).toString().split('\0').filter(Boolean).sort();const identity={commit,diffSha256:sha(diff),untracked:untracked.map((path)=>({path:norm(path),sha256:sha(bytes(path))}))};return sha(canonicalBytes(identity))}

export {
  SPEC, FREEZE, BASE, FUNCTIONAL, REGISTRY, CHANGE, REPORT, EVIDENCE, verifyEntry, loadLaws, buildRegistry,
  writeRegistry, checkProjection, verifyPinnedProviderDescriptors, candidateSnapshot,
};
export type { Level, Law, Manifest };

