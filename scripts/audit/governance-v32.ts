import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import { pathToFileURL } from 'node:url';
import { CANONICAL_ACCEPTANCE_BINDINGS, type CanonicalReadyPhase, validatePhaseReceipts } from './domains/audit-system/canonical-quality-plan.js';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Level = 'CHANGE' | 'READY' | 'RELEASE';
type Law = {
  schemaVersion: 2; lawId: string; supersedesLawId: string | null; status: 'active'; tier: 'P0'|'P1'|'P2';
  capabilityDomain: string; enforcementMode: 'static'|'exam'|'dynamic'|'composite'; evidenceModes: string[];
  summary: string; appliesTo: string[]; excludes: string[]; forbidden: string[]; dependsOnLawIds: string[];
  codePurityLiveness?: {
    auditInspectionFiles?: string[];
    externalEntryExports?: Array<{ exportName: string; filePath: string }>;
    externalEntryFiles?: string[];
    lawfulDynamicImports?: Array<{ consumerFilePath: string; targetFilePath: string }>;
    lawfulDynamicNamespaceConsumers?: Array<{ consumerFilePath: string; targetFilePath: string }>;
    lawfulDynamicRegistryConsumers?: Array<{ consumerFilePath: string; registryExportName: string; registryFilePath: string }>;
    lawfulSideEffectImports?: Array<{ consumerFilePath: string; targetFilePath: string }>;
  };
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
const CI_FULL_COMMAND = 'GRASSEYE_QUALITY_REPORT_MODE=external npm run quality:check -- READY';
const GIT_EVIDENCE_MAX_BUFFER = 64 * 1024 * 1024;
const LAW_ID_PATTERN = /^LAW-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{3}-V[1-9][0-9]*$/u;
const DOMAIN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

class GovernanceError extends Error { constructor(readonly code:string, message:string){super(message)} }
const fail = (code:string,message:string):never => { throw new GovernanceError(code,message); };
const bytes = (path:string) => readFileSync(resolve(ROOT,path));
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
const text = (path:string) => {
  const source = bytes(path);
  if (source.length >= 3 && source[0] === 0xef && source[1] === 0xbb && source[2] === 0xbf) {
    fail('SOURCE_PARSE_FAILED', `${path} BOM`);
  }
  try { return utf8.decode(source); } catch { return fail('SOURCE_PARSE_FAILED', `${path} invalid UTF-8`); }
};
const sha = (value:Buffer|string) => createHash('sha256').update(value).digest('hex');
const sortedUnique = (items:string[]) => items.length === new Set(items).size && items.every((v,i)=>i===0||Buffer.compare(Buffer.from(items[i-1]!),Buffer.from(v))<0);
const exactKeys = (value:Record<string,unknown>, keys:string[]) => JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());
const canonicalValue = (value:unknown):Json => {
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value))return value.map(canonicalValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonicalValue((value as Record<string,unknown>)[key])]));
  return fail('SOURCE_PARSE_FAILED','non-JSON canonical value');
};
const canonicalBytes = (value:unknown) => `${JSON.stringify(canonicalValue(value),null,2)}\n`;
type JsonCursor={source:string;path:string;index:number};
const skipJsonWhitespace=(cursor:JsonCursor):void=>{while(/[\t\n\r ]/u.test(cursor.source[cursor.index]??''))cursor.index++};
const readJsonString=(cursor:JsonCursor):string=>{
  skipJsonWhitespace(cursor);const start=cursor.index;
  if(cursor.source[cursor.index]!=='"')return fail('SOURCE_PARSE_FAILED',`${cursor.path} JSON key`);
  cursor.index++;let escaped=false;
  while(cursor.index<cursor.source.length){const char=cursor.source[cursor.index++]!;if(escaped){escaped=false;continue}if(char==='\\'){escaped=true;continue}if(char==='"')return cursor.source.slice(start,cursor.index)}
  return fail('SOURCE_PARSE_FAILED',`${cursor.path} JSON string`);
};
const decodedJsonKey=(raw:string,path:string):string=>{try{const parsed:unknown=JSON.parse(raw);return typeof parsed==='string'?parsed:fail('SOURCE_PARSE_FAILED',`${path} JSON key`)}catch(error){if(error instanceof GovernanceError)throw error;return fail('SOURCE_PARSE_FAILED',`${path} JSON key`)}};
const readJsonObject=(cursor:JsonCursor):void=>{
  cursor.index++;skipJsonWhitespace(cursor);const keys=new Set<string>();
  if(cursor.source[cursor.index]==='}'){cursor.index++;return}
  while(true){const key=decodedJsonKey(readJsonString(cursor),cursor.path);if(keys.has(key))fail('SOURCE_PARSE_FAILED',`${cursor.path} duplicate JSON key ${key}`);keys.add(key);skipJsonWhitespace(cursor);if(cursor.source[cursor.index++]!==':')fail('SOURCE_PARSE_FAILED',`${cursor.path} JSON colon`);readJsonValue(cursor);skipJsonWhitespace(cursor);if(cursor.source[cursor.index]==='}'){cursor.index++;return}if(cursor.source[cursor.index++]!==',')fail('SOURCE_PARSE_FAILED',`${cursor.path} JSON object`)}
};
const readJsonArray=(cursor:JsonCursor):void=>{
  cursor.index++;skipJsonWhitespace(cursor);if(cursor.source[cursor.index]===']'){cursor.index++;return}
  while(true){readJsonValue(cursor);skipJsonWhitespace(cursor);if(cursor.source[cursor.index]===']'){cursor.index++;return}if(cursor.source[cursor.index++]!==',')fail('SOURCE_PARSE_FAILED',`${cursor.path} JSON array`)}
};
function readJsonValue(cursor:JsonCursor):void{
  skipJsonWhitespace(cursor);const char=cursor.source[cursor.index];
  if(char==='{')return readJsonObject(cursor);if(char==='[')return readJsonArray(cursor);if(char==='"'){readJsonString(cursor);return}
  const atom=cursor.source.slice(cursor.index).match(/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/u)?.[0];
  if(typeof atom!=='string')return fail('SOURCE_PARSE_FAILED',`${cursor.path} JSON value`);cursor.index+=atom.length;
}
export function rejectDuplicateJsonKeys(source:string,path:string){const cursor={source,path,index:0};readJsonValue(cursor);skipJsonWhitespace(cursor);if(cursor.index!==source.length)fail('SOURCE_PARSE_FAILED',`${path} JSON trailing`)}
const parseJson = <T>(path:string):T => { const source=text(path); try{rejectDuplicateJsonKeys(source,path);return JSON.parse(source) as T}catch(error){if(error instanceof GovernanceError)throw error;return fail('SOURCE_PARSE_FAILED',path)} };
const isStringArray = (value:unknown):value is string[] => Array.isArray(value) && value.every((item)=>typeof item==='string');
const cleanString = (value:unknown) => typeof value==='string' && value.length>0 && value===value.normalize('NFC') && !/[\0-\x1f\x7f]/u.test(value);
const pathPatternValid = (value:string) => {
  if(!cleanString(value)||value.startsWith('/')||value.includes('\\')||value.includes('//')||/(?:^|\/)\.\.?(?:\/|$)/u.test(value)||/[?\[\]{}()!+@]/u.test(value))return false;
  if(value==='**/*')return true;
  const segment='[^/*?\\[\\]{}()!+@]+';
  return new RegExp(`^(?:${segment}\\/)*${segment}(?:\\/\\*\\*|\\/\\*\\*\\/\\*\\.[A-Za-z0-9]+)?$`,'u').test(value);
};
const pathPatternContains = (parent:string,child:string) => parent==='**/*' || parent===child || (parent.endsWith('/**') && (child===parent.slice(0,-3) || child.startsWith(`${parent.slice(0,-3)}/`)));

const invalidLiveness=(lawId:string,key:string):never=>fail('SOURCE_PARSE_FAILED',`${lawId} codePurityLiveness ${key}`);
const validLivenessRecord=(value:unknown,keys:string[]):boolean=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)&&exactKeys(value as Record<string,unknown>,keys)&&keys.every((key)=>cleanString((value as Record<string,unknown>)[key]));
const validateLivenessStringLists=(liveness:Record<string,unknown>,lawId:string):void=>{
  for(const key of ['auditInspectionFiles','externalEntryFiles']){const entries=liveness[key];if(entries!==undefined&&(!isStringArray(entries)||entries.length!==new Set(entries).size||entries.some((entry)=>!cleanString(entry))))invalidLiveness(lawId,key)}
};
const validateLivenessPairs=(liveness:Record<string,unknown>,lawId:string):void=>{
  for(const key of ['lawfulDynamicImports','lawfulDynamicNamespaceConsumers','lawfulSideEffectImports']){const entries=liveness[key];if(entries!==undefined&&(!Array.isArray(entries)||entries.some((entry)=>!validLivenessRecord(entry,['consumerFilePath','targetFilePath']))))invalidLiveness(lawId,key)}
};
const validateLivenessNamedEntries=(liveness:Record<string,unknown>,lawId:string):void=>{
  const exports=liveness.externalEntryExports;if(exports!==undefined&&(!Array.isArray(exports)||exports.some((entry)=>!validLivenessRecord(entry,['exportName','filePath']))))invalidLiveness(lawId,'externalEntryExports');
  const registries=liveness.lawfulDynamicRegistryConsumers;if(registries!==undefined&&(!Array.isArray(registries)||registries.some((entry)=>!validLivenessRecord(entry,['consumerFilePath','registryExportName','registryFilePath']))))invalidLiveness(lawId,'lawfulDynamicRegistryConsumers');
};
const validateCodePurityLiveness = (value: unknown, lawId: string): void => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('SOURCE_PARSE_FAILED', `${lawId} codePurityLiveness`);
  const liveness = value as Record<string, unknown>;
  const allowedKeys = [
    'auditInspectionFiles', 'externalEntryExports', 'externalEntryFiles', 'lawfulDynamicImports',
    'lawfulDynamicNamespaceConsumers', 'lawfulDynamicRegistryConsumers', 'lawfulSideEffectImports',
  ];
  if (Object.keys(liveness).some((key) => !allowedKeys.includes(key))) fail('SOURCE_PARSE_FAILED', `${lawId} codePurityLiveness keys`);
  validateLivenessStringLists(liveness,lawId);validateLivenessPairs(liveness,lawId);validateLivenessNamedEntries(liveness,lawId);
};

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
  const lawKeys=raw.codePurityLiveness===undefined?LAW_KEYS:[...LAW_KEYS,'codePurityLiveness'];
  if(!exactKeys(raw as Record<string,unknown>,lawKeys)||raw.lawId!==heading.lawId||raw.capabilityDomain!==domain||raw.schemaVersion!==2||raw.status!=='active')fail('SOURCE_PARSE_FAILED',`${raw.lawId??path} schema`);
  if(raw.codePurityLiveness!==undefined)validateCodePurityLiveness(raw.codePurityLiveness,raw.lawId);
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
const validBaseRootLaws=(laws:Law[]):boolean=>laws.length>=8&&laws.slice(0,8).every((law,index)=>law.lawId===`LAW-PROJECT-GOVERNANCE-00${index+1}-V1`&&law.capabilityDomain==='project-governance');
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
function walk(dir:string):string[]{if(!existsSync(resolve(ROOT,dir)))return[];const out:string[]=[];for(const entry of readdirSync(resolve(ROOT,dir),{withFileTypes:true})){if(entry.name!==entry.name.normalize('NFC'))fail('SOURCE_PARSE_FAILED',`${dir}/${entry.name} non-NFC`);const child=norm(`${dir}/${entry.name}`);entry.isDirectory()?out.push(...walk(child)):out.push(child)}return out.sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)))}
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
const validateMigration=(contract:MigrationContract,file:string):void=>{if(!exactKeys(contract as Record<string,unknown>,['currentAuthority','targetAuthority','compatibilityMechanisms','startDate','monitoring','rollbackCondition','maximumDurationDays','removalDate','removalAcceptance'])||!cleanString(contract.currentAuthority)||!cleanString(contract.targetAuthority)||!Array.isArray(contract.compatibilityMechanisms)||!Array.isArray(contract.monitoring)||!Array.isArray(contract.removalAcceptance)||!cleanString(contract.rollbackCondition)||!Number.isInteger(contract.maximumDurationDays)||contract.maximumDurationDays<1||!/^\d{4}-\d{2}-\d{2}$/u.test(contract.startDate)||!/^\d{4}-\d{2}-\d{2}$/u.test(contract.removalDate))fail('SOURCE_PARSE_FAILED',`${file} migration`)};
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
function repositoryIdentity(remote:string){return remote.trim().replace(/^git@[^:]+:/u,'').replace(/^(?:https?|ssh):\/\/[^/]+\//u,'').replace(/\.git$/u,'')}
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

const norm=(p:string)=>p.split(sep).join('/').replace(/^\.\//,'');
function matchPath(pattern:string,target:string){if(pattern==='**/*')return true;if(!pattern.endsWith('/**'))return target===pattern;const base=pattern.slice(0,-3);return target===base||target.startsWith(`${base}/`)}
type ChangeRecord={baseSha:string;allowedWritePaths:string[];allowedDeletePaths:string[]};
function changeRecord(){if(!existsSync(resolve(ROOT,CHANGE)))fail('CHANGE_RECORD_MISSING',CHANGE);const raw=parseJson<ChangeRecord>(CHANGE);if(!exactKeys(raw as Record<string,unknown>,['baseSha','allowedWritePaths','allowedDeletePaths'])||typeof raw.baseSha!=='string'||!/^[a-f0-9]{40}$/u.test(raw.baseSha))fail('CHANGE_RECORD_INVALID',CHANGE);for(const key of ['allowedWritePaths','allowedDeletePaths'] as const){if(!isStringArray(raw[key])||!sortedUnique(raw[key])||raw[key].some((pattern)=>!pathPatternValid(pattern)))fail('CHANGE_RECORD_INVALID',key);for(let index=0;index<raw[key].length;index++)for(let prior=0;prior<index;prior++)if(pathPatternContains(raw[key][prior]!,raw[key][index]!)||pathPatternContains(raw[key][index]!,raw[key][prior]!))fail('CHANGE_RECORD_INVALID',`${key} overlap`)}try{execFileSync('git',['cat-file','-e',`${raw.baseSha}^{commit}`],{cwd:ROOT,stdio:'ignore'})}catch{fail('BASE_SHA_MISMATCH',raw.baseSha)}return raw}
function diffPaths(baseSha:string){const raw=execFileSync('git',['diff','--find-renames','--find-copies','--name-status','-z',baseSha,'--'],{cwd:ROOT});const parts=raw.toString().split('\0').filter(Boolean);const out:{status:string;path:string}[]=[];for(let i=0;i<parts.length;){const status=parts[i++]!;if(status.startsWith('R')||status.startsWith('C')){const oldPath=norm(parts[i++]!);const newPath=norm(parts[i++]!);if(status.startsWith('R'))out.push({status:'D',path:oldPath});out.push({status:'A',path:newPath})}else out.push({status:status[0]!,path:norm(parts[i++]!)})}const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean).map(norm);for(const path of untracked)out.push({status:'A',path});return out.sort((left,right)=>left.path.localeCompare(right.path)||left.status.localeCompare(right.status))}
type PathRole='GOVERNANCE_AUTHORITY'|'GENERATED_REGISTRY'|'QUALITY_REPORT'|'RUNTIME_IGNORED'|'TEST_ONLY'|'HISTORY_ONLY'|'PRODUCTION';
const runtimeIgnoredPath=(path:string):boolean=>path==='node_modules'||['node_modules/','.governance/runtime/','.grasseye-local/','.playwright-cli/','output/'].some((prefix)=>path.startsWith(prefix));
const governanceAuthorityPath=(path:string):boolean=>["AGENTS.md",SPEC,FREEZE,BASE,FUNCTIONAL].includes(path)||path.startsWith('docs/blueprints/')||path.startsWith('docs/specs/')||/^scripts\/audit\/domains\/[^/]+\/manifest\.json$/u.test(path);
const testOnlyPath=(path:string):boolean=>['tests/','fixtures/','examples/','artifacts/','coverage/','scripts/acceptance/'].some((prefix)=>path.startsWith(prefix))||path.includes('/acceptance/')||path.endsWith('.acceptance.ts');
function pathRole(path:string):PathRole{if(path===REGISTRY)return'GENERATED_REGISTRY';if(path===REPORT||path.startsWith('scripts/audit/reports/'))return'QUALITY_REPORT';if(runtimeIgnoredPath(path))return'RUNTIME_IGNORED';if(governanceAuthorityPath(path))return'GOVERNANCE_AUTHORITY';if(testOnlyPath(path))return'TEST_ONLY';return path.startsWith('docs/history/')?'HISTORY_ONLY':'PRODUCTION'}
function ownerDomains(path:string,manifests:Manifest[]){return manifests.filter((manifest)=>manifest.ownedPaths.some((pattern)=>matchPath(pattern,path))).map((manifest)=>manifest.capabilityDomain)}
type HistoricalOwnerManifest={capabilityDomain:string;ownedPaths:string[]};
function baseOwnerManifests(baseSha:string):HistoricalOwnerManifest[]{
  const manifestPaths=execFileSync('git',['ls-tree','-r','--name-only',baseSha,'--','scripts/audit/domains'],{cwd:ROOT}).toString().split('\n').filter((path)=>path.endsWith('/manifest.json'));
  return manifestPaths.map((manifestPath)=>{
    let raw:HistoricalOwnerManifest;
    try{raw=JSON.parse(execFileSync('git',['show',`${baseSha}:${manifestPath}`],{cwd:ROOT}).toString('utf8')) as HistoricalOwnerManifest}catch{return fail('SOURCE_PARSE_FAILED',`historical manifest ${manifestPath}`)}
    if(typeof raw.capabilityDomain!=='string'||!isStringArray(raw.ownedPaths))fail('SOURCE_PARSE_FAILED',`historical manifest ${manifestPath}`);
    return{capabilityDomain:raw.capabilityDomain,ownedPaths:raw.ownedPaths};
  });
}
function originalOwnerDomains(path:string,manifests:HistoricalOwnerManifest[]){return manifests.filter((manifest)=>manifest.ownedPaths.some((pattern)=>matchPath(pattern,path))).map((manifest)=>manifest.capabilityDomain)}
function repositoryPaths(){const tracked=execFileSync('git',['ls-files','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean).map(norm);const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean).map(norm);return[...new Set([...tracked,...untracked])].filter((path)=>existsSync(resolve(ROOT,path))&&!lstatSync(resolve(ROOT,path)).isDirectory()).sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)))}
const verifyRepositoryIndex=():void=>{if(execFileSync('git',['ls-files','-u'],{cwd:ROOT}).length)fail('SOURCE_PARSE_FAILED','unmerged index');const stages=execFileSync('git',['ls-files','--stage','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean);if(stages.some((entry)=>entry.startsWith('160000 ')))fail('SOURCE_PARSE_FAILED','submodule')};
const verifyRepositoryPath=(path:string,manifests:Manifest[],caseFolded:Map<string,string>):void=>{if(path!==path.normalize('NFC'))fail('SOURCE_PARSE_FAILED',`non-NFC repository path ${path}`);const folded=path.toLocaleLowerCase('en-US');const prior=caseFolded.get(folded);if(prior&&prior!==path)fail('SOURCE_PARSE_FAILED',`case-collision ${prior}/${path}`);caseFolded.set(folded,path);const role=pathRole(path);if(role==='RUNTIME_IGNORED')return;const absolute=resolve(ROOT,path);if(!existsSync(absolute))return;const metadata=lstatSync(absolute);if(metadata.isSymbolicLink()){const target=realpathSync(absolute);if(target!==ROOT&&!target.startsWith(`${ROOT}${sep}`))fail('SOURCE_PARSE_FAILED',`symlink escapes repository ${path}`)}else if(!metadata.isFile())fail('SOURCE_PARSE_FAILED',`special file ${path}`);if(role==='PRODUCTION'){const owners=ownerDomains(path,manifests);if(!owners.length)fail('UNOWNED_PRODUCTION_FILE',path);if(owners.length>1)fail('MULTIPLE_PRIMARY_OWNERS',`${path}:${owners.join(',')}`)}};
const verifyOriginalDeletes=(diffs:{status:string;path:string}[],baseSha:string):void=>{const manifests=baseOwnerManifests(baseSha);for(const diff of diffs.filter((item)=>item.status==='D'&&pathRole(item.path)==='PRODUCTION')){try{execFileSync('git',['cat-file','-e',`${baseSha}:${diff.path}`],{cwd:ROOT,stdio:'ignore'})}catch{fail('UNAUTHORIZED_PRODUCTION_DELETE',diff.path)}const owners=originalOwnerDomains(diff.path,manifests);if(owners.length!==1)fail(owners.length?'MULTIPLE_PRIMARY_OWNERS':'UNOWNED_PRODUCTION_FILE',diff.path)}};
const verifyProductionImports=(paths:string[]):void=>{const sources=paths.filter((path)=>pathRole(path)==='PRODUCTION'&&['.ts','.tsx','.js','.mjs','.cjs'].includes(extname(path)));for(const sourcePath of sources)for(const match of text(sourcePath).matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"](\.\.?\/[^'"]+)['"]/gu)){const target=norm(relative(ROOT,resolve(dirname(resolve(ROOT,sourcePath)),match[1]!)));if(['TEST_ONLY','HISTORY_ONLY','QUALITY_REPORT'].includes(pathRole(target)))fail('ROLE_ESCALATION_REQUIRED',`${sourcePath}->${target}`)}};
function verifyRepositoryIntegrity(manifests:Manifest[],diffs:{status:string;path:string}[],baseSha:string){verifyRepositoryIndex();const paths=repositoryPaths();const caseFolded=new Map<string,string>();for(const path of paths)verifyRepositoryPath(path,manifests,caseFolded);verifyOriginalDeletes(diffs,baseSha);verifyProductionImports(paths)}
function dirtyTargetCheck(record:{allowedWritePaths:string[];allowedDeletePaths:string[]}){const dirty=execFileSync('git',['status','--porcelain=v1','-z','--untracked-files=all'],{cwd:ROOT}).toString().split('\0').filter(Boolean).map((entry)=>norm(entry.slice(3))).filter((path)=>[...record.allowedWritePaths,...record.allowedDeletePaths].some((pattern)=>matchPath(pattern,path)));if(dirty.length)fail('DIRTY_TARGET_NOT_AUTHORIZED',dirty.join(','))}
function scopeCheck(level:'CHANGE'|'FULL'='FULL'){const record=changeRecord();const diffs=diffPaths(record.baseSha);for(const item of diffs){const allowed=item.status==='D'?record.allowedDeletePaths:record.allowedWritePaths;if(!allowed.some((pattern)=>matchPath(pattern,item.path)))fail('SCOPE_DIFF_OUTSIDE_ALLOWED_PATHS',`${item.status} ${item.path}`)}if(diffs.some((item)=>item.path===SPEC)&&process.env.GRASSEYE_SOURCE_SPEC_AMENDMENT_AUTHORIZED!=='1')fail('SOURCE_SPEC_AMENDMENT_NOT_AUTHORIZED',SPEC);if(diffs.some((item)=>item.path===BASE||item.path===FUNCTIONAL)&&process.env.GRASSEYE_LAW_AMENDMENT_AUTHORIZED!=='1')fail('LAW_AMENDMENT_NOT_AUTHORIZED','active law');if(level==='FULL'){const registry=buildRegistry();verifyRepositoryIntegrity(registry.domains.map((domain)=>({...domain,schemaVersion:3,status:'active',manifestPath:domain.manifestPath} as Manifest)),diffs,record.baseSha);verifyPinnedProviderDescriptors();checkProjection();}console.log(`SCOPE_OK ${diffs.length}`);return diffs}
type CheckResult={phaseId:CanonicalReadyPhase;checkId:string;domains:string[];lawIds:string[];evidenceModes:string[];command:string;outcome:'PASS'|'FAIL';evidenceRef:string;finding:string|null};
const DOMAIN_READY_SCRIPTS:Record<string,string[]>=Object.freeze({
  'ai-input-gateway':['audit:ai-input-gateway:enforce'],
  'app-shell-ui':['audit:app-shell-ui:enforce'],
  'architecture-boundary':['audit:architecture-boundary:enforce'],
  'audit-system':['audit:system:enforce'],
  'audit-truth':['audit:truth:enforce'],
  'capability-governance':['audit:capability-governance:enforce'],
  'code-purity':['audit:code-purity:enforce'],
  'forensics-persistence-capability':['audit:forensics-persistence-capability:enforce'],
  'local-app-shell':['audit:local-app-shell:enforce'],
  'local-browser-session':['audit:local-browser-session:enforce'],
  'project-governance':['audit:integrity:test'],
  'runtime-log-spine':['audit:runtime-log-spine:enforce'],
  'startup-entrypoint':['audit:startup-entrypoint:enforce'],
  'system-security':['audit:system-security:enforce'],
  'workbench-api-boundary':['audit:workbench-api-boundary:enforce'],
  'xuanxue-ai-production-localization-contract':['audit:xuanxue-ai-production-localization-contract:enforce'],
  'xuanxue-ai-production':['audit:xuanxue-ai-production:enforce'],
});
const qualityRunDirectory=()=>{const requested=process.env.GRASSEYE_QUALITY_OUTPUT_DIR?.trim();if(requested){const absolute=resolve(requested);mkdirSync(absolute,{recursive:true});return absolute}return mkdtempSync(resolve(tmpdir(),'grasseye-quality-'))};
const orderedModes=(modes:string[])=>EVIDENCE.filter((mode)=>new Set(modes).has(mode));
function writeEvidence(path:string,value:Json){writeFileSync(path,canonicalBytes(value),{mode:0o600});return sha(bytes(path))}
function registeredLaws():Law[]{const raw=parseJson<{laws:Law[]}>(REGISTRY);if(!raw||!Array.isArray(raw.laws)||raw.laws.some((law)=>!law||typeof law.lawId!=='string'||typeof law.capabilityDomain!=='string'||!Array.isArray(law.evidenceModes)))fail('GENERATED_PROJECTION_STALE',REGISTRY);return raw.laws}
function runCheck(pm:string,script:string,phaseId:CanonicalReadyPhase,domains:string[],modes:string[],laws:Law[],runDirectory:string):CheckResult{const command=`${pm} run ${script}`;const startedAt=new Date().toISOString();const before=candidateSnapshot();const result=spawnSync(pm,['run',script],{cwd:ROOT,encoding:'utf8',env:process.env,maxBuffer:16*1024*1024});const after=candidateSnapshot();if(before!==after)fail('CANDIDATE_DRIFT',script);const outcome=result.status===0?'PASS':'FAIL';const finding=outcome==='PASS'?null:'PROJECT_CHECK_FAILED';const lawIds=laws.filter((law)=>domains.includes('*')||domains.includes(law.capabilityDomain)).map((law)=>law.lawId).sort();const receiptPath=resolve(runDirectory,`${script.replace(/[^a-zA-Z0-9_.-]/gu,'_')}.result.json`);const receipt={schemaVersion:1,phaseId,testId:`script:${script}`,lawIds,evidenceModes:orderedModes(modes),command,startedAt,finishedAt:new Date().toISOString(),candidateSnapshot:after,exitStatus:result.status,signal:result.signal??null,outcome,finding,stdoutSha256:sha(result.stdout??''),stderrSha256:sha(result.stderr??'')};const receiptHash=writeEvidence(receiptPath,receipt);if(outcome==='FAIL')process.stderr.write(String(result.stderr||result.stdout||`${command} failed\n`));return{phaseId,checkId:`script:${script}`,domains:[...domains].sort(),lawIds,evidenceModes:orderedModes(modes),command,outcome,evidenceRef:`${receiptPath}#sha256=${receiptHash}`,finding}}
function internalGateCheck(phaseId:CanonicalReadyPhase,checkId:string,laws:Law[],runDirectory:string,evidencePath:string):CheckResult{const lawIds=laws.map((law)=>law.lawId).sort();const receiptPath=resolve(runDirectory,`${checkId}.result.json`);const receipt={schemaVersion:1,phaseId,testId:checkId,lawIds,evidenceModes:['static.contract'],command:`internal:${checkId}`,candidateSnapshot:candidateSnapshot(),outcome:'PASS',evidencePath,evidenceSha256:sha(bytes(evidencePath))};const receiptHash=writeEvidence(receiptPath,receipt);return{phaseId,checkId,domains:['*'],lawIds,evidenceModes:['static.contract'],command:`internal:${checkId}`,outcome:'PASS',evidenceRef:`${receiptPath}#sha256=${receiptHash}`,finding:null}}
function missingScriptCheck(pm:string,script:string,phaseId:CanonicalReadyPhase,domains:string[],modes:string[],laws:Law[],runDirectory:string):CheckResult{const lawIds=laws.filter((law)=>domains.includes('*')||domains.includes(law.capabilityDomain)).map((law)=>law.lawId).sort();const receiptPath=resolve(runDirectory,`${script.replace(/[^a-zA-Z0-9_.-]/gu,'_')}.result.json`);const receipt={schemaVersion:1,phaseId,testId:`script:${script}`,lawIds,evidenceModes:orderedModes(modes),command:`${pm} run ${script}`,outcome:'FAIL',finding:'PROJECT_CHECK_MISSING'};const receiptHash=writeEvidence(receiptPath,receipt);return{phaseId,checkId:`script:${script}`,domains:[...domains].sort(),lawIds,evidenceModes:orderedModes(modes),command:`${pm} run ${script}`,outcome:'FAIL',evidenceRef:`${receiptPath}#sha256=${receiptHash}`,finding:'PROJECT_CHECK_MISSING'}}
type ExecuteCheck=(script:string,phaseId:CanonicalReadyPhase,domains:string[],modes:string[])=>boolean;
const runOwnerChecks=(scriptsByDomain:Record<string,string[]>,execute:ExecuteCheck,staticModes:(domain:string)=>string[]):boolean=>{const ownerScripts=new Map<string,{domains:Set<string>;modes:Set<string>}>();for(const [domain,scripts] of Object.entries(scriptsByDomain))for(const script of scripts){if(script==='audit:system:enforce'||script==='audit:integrity:test')continue;const current=ownerScripts.get(script)??{domains:new Set<string>(),modes:new Set<string>()};current.domains.add(domain);staticModes(domain).forEach((mode)=>current.modes.add(mode));ownerScripts.set(script,current)}for(const [script,definition] of [...ownerScripts.entries()].sort(([left],[right])=>left.localeCompare(right)))if(!execute(script,'generated-plan-runner',[...definition.domains].sort(),[...definition.modes]))return false;return true};
const runAcceptanceChecks=(execute:ExecuteCheck):boolean=>{for(const binding of CANONICAL_ACCEPTANCE_BINDINGS)if(!execute(binding.script,'acceptance-runner',[binding.ownerId],[binding.evidenceFacet]))return false;return true};
function projectChecks(level:Level,laws:Law[],runDirectory:string):CheckResult[]{
  const pkg=parseJson<{scripts?:Record<string,string>}>('package.json');const scripts=pkg.scripts??{};const pm=existsSync(resolve(ROOT,'pnpm-lock.yaml'))?'pnpm':'npm';
  const staticModes=(domain:string)=>orderedModes(laws.filter((law)=>law.capabilityDomain===domain).flatMap((law)=>law.evidenceModes.filter((mode)=>!mode.startsWith('dynamic.'))));
  const results:CheckResult[]=[];
  const execute=(script:string,phaseId:CanonicalReadyPhase,domains:string[],modes:string[])=>{const receipt=typeof scripts[script]==='string'?runCheck(pm,script,phaseId,domains,modes,laws,runDirectory):missingScriptCheck(pm,script,phaseId,domains,modes,laws,runDirectory);results.push(receipt);return receipt.outcome==='PASS'};
  if(level==='CHANGE'){execute('audit:integrity:test','codex-entry-gate',['project-governance'],['static.filesystem','static.text','static.contract','static.dependency','static.config','static.json']);return results}
  results.push(internalGateCheck('codex-entry-gate','phase:codex-entry-gate',laws,runDirectory,'AGENTS.md'));
  if(!execute('typecheck','typecheck',['*'],['static.ast','static.types']))return results;
  if(!execute('audit:integrity:test','audit-self-test',['project-governance'],staticModes('project-governance')))return results;
  if(!execute('audit:system:enforce','audit-system-mutants',['audit-system'],staticModes('audit-system')))return results;
  if(!execute('acceptance:audit-system-restoration','audit-system-mutants',['audit-system'],['exam.golden']))return results;
  results.push(internalGateCheck('build-audit-artifacts','phase:build-audit-artifacts',laws,runDirectory,REGISTRY));
  results.push(internalGateCheck('active-law-full-coverage','phase:active-law-full-coverage',laws,runDirectory,BASE));
  if(!runOwnerChecks(DOMAIN_READY_SCRIPTS,execute,staticModes))return results;
  results.push(internalGateCheck('generated-artifact-truth','phase:generated-artifact-truth',laws,runDirectory,REGISTRY));
  if(!runAcceptanceChecks(execute))return results;
  const phaseFindings=validatePhaseReceipts(results);if(phaseFindings.length)fail('CI_GATE_SET_REGRESSION',phaseFindings.join(','));
  return results;
}
function lawIntersects(law:Pick<Law,'appliesTo'|'excludes'|'contractRefs'>,diffs:string[]){const included=diffs.some((path)=>law.appliesTo.some((pattern)=>matchPath(pattern,path))&&!law.excludes.some((pattern)=>matchPath(pattern,path)));return included||law.contractRefs.some((ref)=>diffs.includes(ref.path))}
export function evidencePlan(law:Pick<Law,'appliesTo'|'excludes'|'contractRefs'|'evidenceModes'>,diffs:string[],level:'READY'|'RELEASE'){if(!lawIntersects(law,diffs))return{applicableEvidenceModes:[] as string[],deferredEvidenceModes:[] as string[]};const staticAndExam=orderedModes(law.evidenceModes.filter((mode)=>!mode.startsWith('dynamic.')));const dynamic=orderedModes(law.evidenceModes.filter((mode)=>mode.startsWith('dynamic.')));return{applicableEvidenceModes:level==='RELEASE'?[...staticAndExam,...dynamic]:staticAndExam,deferredEvidenceModes:level==='READY'?dynamic:[]}}
function candidateSnapshot(){const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT}).toString().trim();const diff=execFileSync('git',['diff','--binary','--no-ext-diff','HEAD','--'],{cwd:ROOT,maxBuffer:GIT_EVIDENCE_MAX_BUFFER});const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:ROOT,maxBuffer:GIT_EVIDENCE_MAX_BUFFER}).toString().split('\0').filter(Boolean).sort();const identity={commit,diffSha256:sha(diff),untracked:untracked.map((path)=>({path:norm(path),sha256:sha(bytes(path))}))};return sha(canonicalBytes(identity))}
type ReleaseBinding={candidateId:string;gitCommit:string;freezeSha256:string;baseLawSha256:string;functionalLawSha256:string;registrySha256:string};
export function releaseCandidateBinding():ReleaseBinding{const dirty=execFileSync('git',['status','--porcelain=v1','-z','--untracked-files=all'],{cwd:ROOT});if(dirty.length)fail('RELEASE_CANDIDATE_UNBOUND','RELEASE requires a clean committed tree');const gitCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT}).toString().trim();const baseLawSha256=sha(bytes(BASE));const functionalLawSha256=sha(bytes(FUNCTIONAL));const registrySha256=sha(bytes(REGISTRY));const candidateId=sha(canonicalBytes({gitCommit,baseLawSha256,functionalLawSha256,registrySha256}));return{candidateId,gitCommit,freezeSha256:sha(bytes(FREEZE)),baseLawSha256,functionalLawSha256,registrySha256}}
type ProofFileIdentity={dev:number;ino:number;size:number;mtimeMs:number};
type VerifiedDynamicProof={lawIds:string[];evidenceModes:string[];evidenceRefs:string[];dynamicProofEvidenceRefs:string[];hashes:string[]};
type ProofRunner=(script:string,args:string[],env:NodeJS.ProcessEnv)=>{status:number|null;stdout:string;stderr:string};
const realProofRunner:ProofRunner=(script,args,env)=>{const result=spawnSync(process.execPath,['--import','tsx',script,...args],{cwd:ROOT,encoding:'utf8',env,maxBuffer:16*1024*1024});return{status:result.status,stdout:result.stdout??'',stderr:result.stderr??''}};
type RuntimeReceipt={device_id:string;device_epoch:number;worker_session_id:string;worker_session_epoch:number;runtime_attestation_receipt_hash:string};
type ReleaseEvidenceInput={contractManifestHash:string;extensionId:string;runtimeReceipt:RuntimeReceipt};
type ProofBindingInput={run_id:string;candidate_hash:string;contract_manifest_hash:string;provider_record_hashes:Record<string,string>;cloud_terminal_job_ids:string[]};
type ReleaseEvidenceDocument=ReleaseEvidenceInput&{schemaVersion:string;releaseMode:string;workbenchUrl:string;realRunRoot:string;dynamicProofRunId:string;evidenceRefs:unknown[]};
type ProofBindingDocument=ProofBindingInput&{schema_version:string};
type ChromeProofOutput={marker:string;status:string;contractManifestHash:string;extensionId:string;workerSessionId:string;runtimeAttestationReceiptHash:string};
type ContinuationActor={extensionId?:string;deviceId:string;deviceEpoch:number;workerSessionId:string;workerSessionEpoch:number;runtimeAttestationReceiptHash:string};
type ContinuationProof={schemaVersion:string;runId:string;candidateHash:string;contractManifestHash:string;predecessor:ContinuationActor;successor:ContinuationActor;terminalReceiptHashes:Record<string,string>;capturedAt:string};
type ProviderProofOutput={marker:string;runRoot:string;runId:string;candidateHash:string;contractManifestHash:string;recordCount:number;continuationReceipt:ContinuationProof;cloudTerminalJobCount:number;status:string};
const validChromeProof=(chrome:ChromeProofOutput,evidence:ReleaseEvidenceInput):boolean=>exactKeys(chrome as Record<string,unknown>,['marker','status','contractManifestHash','extensionId','workerSessionId','runtimeAttestationReceiptHash'])&&chrome.marker==='[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-CHROME-V6]'&&chrome.status==='CHROME_VERIFIED'&&chrome.contractManifestHash===evidence.contractManifestHash&&chrome.extensionId===evidence.extensionId&&chrome.workerSessionId===evidence.runtimeReceipt.worker_session_id&&chrome.runtimeAttestationReceiptHash===evidence.runtimeReceipt.runtime_attestation_receipt_hash;
const validProviderProof=(provider:ProviderProofOutput,binding:ProofBindingInput,runRoot:string):boolean=>exactKeys(provider as Record<string,unknown>,['marker','runRoot','runId','candidateHash','contractManifestHash','recordCount','continuationReceipt','cloudTerminalJobCount','status'])&&provider.marker==='[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-PROVIDER]'&&provider.status==='PASS'&&resolve(provider.runRoot)===resolve(runRoot)&&provider.runId===binding.run_id&&provider.candidateHash===binding.candidate_hash&&provider.contractManifestHash===binding.contract_manifest_hash&&provider.recordCount===Object.keys(binding.provider_record_hashes).length&&provider.cloudTerminalJobCount===binding.cloud_terminal_job_ids.length;
const validPredecessor=(actor:ContinuationActor,evidence:ReleaseEvidenceInput):boolean=>exactKeys(actor as Record<string,unknown>,['extensionId','deviceId','deviceEpoch','workerSessionId','workerSessionEpoch','runtimeAttestationReceiptHash'])&&actor.extensionId===evidence.extensionId&&actor.deviceId===evidence.runtimeReceipt.device_id&&actor.deviceEpoch===evidence.runtimeReceipt.device_epoch&&actor.workerSessionId===evidence.runtimeReceipt.worker_session_id&&actor.workerSessionEpoch===evidence.runtimeReceipt.worker_session_epoch&&actor.runtimeAttestationReceiptHash===evidence.runtimeReceipt.runtime_attestation_receipt_hash;
const validSuccessor=(actor:ContinuationActor,predecessor:ContinuationActor):boolean=>exactKeys(actor as Record<string,unknown>,['deviceId','deviceEpoch','workerSessionId','workerSessionEpoch','runtimeAttestationReceiptHash'])&&actor.deviceId===predecessor.deviceId&&actor.deviceEpoch===predecessor.deviceEpoch&&cleanString(actor.workerSessionId)&&actor.workerSessionId!==predecessor.workerSessionId&&Number.isInteger(actor.workerSessionEpoch)&&actor.workerSessionEpoch>predecessor.workerSessionEpoch&&/^sha256:[a-f0-9]{64}$/u.test(actor.runtimeAttestationReceiptHash);
const validTerminalHashes=(hashes:Record<string,string>,ids:string[]):boolean=>Boolean(hashes)&&typeof hashes==='object'&&!Array.isArray(hashes)&&JSON.stringify(Object.keys(hashes))===JSON.stringify(ids)&&Object.values(hashes).every((hash)=>/^sha256:[a-f0-9]{64}$/u.test(hash));
const validContinuationProof=(continuation:ContinuationProof,evidence:ReleaseEvidenceInput,binding:ProofBindingInput):boolean=>exactKeys(continuation as Record<string,unknown>,['schemaVersion','runId','candidateHash','contractManifestHash','predecessor','successor','terminalReceiptHashes','capturedAt'])&&continuation.schemaVersion==='xuanxue-ai-provider-continuation-proof.v1'&&continuation.runId===binding.run_id&&continuation.candidateHash===binding.candidate_hash&&continuation.contractManifestHash===binding.contract_manifest_hash&&validPredecessor(continuation.predecessor,evidence)&&validSuccessor(continuation.successor,continuation.predecessor)&&validTerminalHashes(continuation.terminalReceiptHashes,binding.cloud_terminal_job_ids)&&Number.isFinite(Date.parse(continuation.capturedAt))&&Math.abs(Date.now()-Date.parse(continuation.capturedAt))<=30*60*1000;
export function validateRealProofExecutorOutputs(chromeRaw:string,providerRaw:string,evidence:ReleaseEvidenceInput,binding:ProofBindingInput,runRoot:string):ContinuationProof{
  let chrome:ChromeProofOutput;let provider:ProviderProofOutput;try{chrome=JSON.parse(chromeRaw) as ChromeProofOutput;provider=JSON.parse(providerRaw) as ProviderProofOutput}catch{return fail('RELEASE_EVIDENCE_MISSING','real proof executor output is not exact JSON')}
  if(!chrome||!validChromeProof(chrome,evidence))fail('RELEASE_EVIDENCE_MISSING','real Chrome executor output does not exactly match the bound artifacts');
  if(!provider||!validProviderProof(provider,binding,runRoot))fail('RELEASE_EVIDENCE_MISSING','real Provider executor output does not exactly match the bound artifacts');
  if(!provider.continuationReceipt||!validContinuationProof(provider.continuationReceipt,evidence,binding))fail('RELEASE_EVIDENCE_MISSING','real Provider continuation receipt does not exactly bind predecessor, successor and terminal receipts');
  return provider.continuationReceipt;
}
export function verifyXuanxueReleaseEvidence(evidencePath:string,runner:ProofRunner=realProofRunner):VerifiedDynamicProof{
  const absolute=resolve(evidencePath);
  const runRoot=resolve(ROOT,'.grasseye-local');
  const bindingPath=resolve(runRoot,'xuanxue-ai-production-dynamic-proof-binding.v2.json');
  let evidenceRaw:Buffer;let bindingRaw:Buffer;let evidence:ReleaseEvidenceDocument;let binding:ProofBindingDocument;let evidenceIdentity:ProofFileIdentity;let bindingIdentity:ProofFileIdentity;
  try{const evidenceStat=lstatSync(absolute);const bindingStat=lstatSync(bindingPath);evidenceIdentity={dev:evidenceStat.dev,ino:evidenceStat.ino,size:evidenceStat.size,mtimeMs:evidenceStat.mtimeMs};bindingIdentity={dev:bindingStat.dev,ino:bindingStat.ino,size:bindingStat.size,mtimeMs:bindingStat.mtimeMs};evidenceRaw=readFileSync(absolute);bindingRaw=readFileSync(bindingPath);evidence=JSON.parse(utf8.decode(evidenceRaw)) as ReleaseEvidenceDocument;binding=JSON.parse(utf8.decode(bindingRaw)) as ProofBindingDocument}catch(error){return fail('RELEASE_EVIDENCE_MISSING',`invalid real proof authority: ${error instanceof Error?error.message:String(error)}`)}
  if(!evidence||!exactKeys(evidence as Record<string,unknown>,['schemaVersion','contractManifestHash','extensionId','releaseMode','workbenchUrl','realRunRoot','dynamicProofRunId','runtimeReceipt','evidenceRefs'])||evidenceRaw!.toString('utf8')!==canonicalBytes(evidence))fail('RELEASE_EVIDENCE_MISSING','real Chrome evidence must be exact canonical V6 evidence');
  if(!binding||binding.schema_version!=='xuanxue-ai-production-dynamic-proof-binding.v2'||evidence.dynamicProofRunId!==binding.run_id)fail('RELEASE_EVIDENCE_MISSING','real Chrome evidence is not bound to the production proof run');
  const snapshotDirectory=mkdtempSync(resolve(tmpdir(),'grasseye-release-proof-'));const evidenceSnapshot=resolve(snapshotDirectory,'evidence.json');const bindingSnapshot=resolve(snapshotDirectory,'binding.json');
  let results:Array<{status:number|null;stdout:string;stderr:string}>;let continuation:ContinuationProof;
  try{writeFileSync(evidenceSnapshot,evidenceRaw!,{mode:0o600});writeFileSync(bindingSnapshot,bindingRaw!,{mode:0o600});const commands=[
    {script:'scripts/acceptance/xuanxue-ai-production.real-chrome.ts',args:['--evidence',evidenceSnapshot,'--binding',bindingSnapshot],env:{...process.env}},
    {script:'scripts/acceptance/xuanxue-ai-production.real-provider.ts',args:['--evidence',evidenceSnapshot,'--binding',bindingSnapshot],env:{...process.env,XUANXUE_AI_REAL_RUN_ROOT:runRoot}},
  ];results=commands.map((command)=>{const result=runner(command.script,command.args,command.env);if(result.status!==0)fail('RELEASE_EVIDENCE_MISSING',`real proof executor failed: ${command.script}: ${result.stderr||result.stdout}`);return result});continuation=validateRealProofExecutorOutputs(results[0]!.stdout,results[1]!.stdout,evidence,binding,runRoot)}finally{rmSync(snapshotDirectory,{recursive:true,force:true})}
  assertStableProofFile(absolute,evidenceRaw!,evidenceIdentity!);assertStableProofFile(bindingPath,bindingRaw!,bindingIdentity!);
  const bindingHash=sha(bindingRaw!);const evidenceHash=sha(evidenceRaw!);const continuationRaw=canonicalBytes(continuation);const continuationHash=sha(continuationRaw);const continuationDirectory=resolve(ROOT,'.governance/runtime/release-evidence');const continuationPath=resolve(continuationDirectory,`${continuationHash}.json`);mkdirSync(continuationDirectory,{recursive:true});if(existsSync(continuationPath)){if(!readFileSync(continuationPath).equals(Buffer.from(continuationRaw)))fail('CANDIDATE_DRIFT','provider continuation proof hash collision')}else{const temporary=`${continuationPath}.tmp-${process.pid}`;writeFileSync(temporary,continuationRaw,{mode:0o600});renameSync(temporary,continuationPath)}
  const artifacts=[{evidenceRef:`${absolute}#sha256=${evidenceHash}`,hash:evidenceHash},{evidenceRef:`${bindingPath}#sha256=${bindingHash}`,hash:bindingHash},{evidenceRef:`${continuationPath}#sha256=${continuationHash}`,hash:continuationHash}].sort((left,right)=>left.evidenceRef.localeCompare(right.evidenceRef));
  return{lawIds:['LAW-XUANXUE-AI-PRODUCTION-001-V6'],evidenceModes:['dynamic.browser','dynamic.service','dynamic.provider','dynamic.authorization'],evidenceRefs:artifacts.map((artifact)=>artifact.evidenceRef),dynamicProofEvidenceRefs:artifacts.map((artifact)=>artifact.evidenceRef),hashes:artifacts.map((artifact)=>artifact.hash)};
}
export function assertStableProofFile(path:string,before:Buffer,identity:ProofFileIdentity):void{let after:Buffer;let stat:ReturnType<typeof lstatSync>;try{stat=lstatSync(path);after=readFileSync(path)}catch{return fail('RELEASE_EVIDENCE_MISSING','real proof artifact disappeared during verification')}if(stat.dev!==identity.dev||stat.ino!==identity.ino||stat.size!==identity.size||stat.mtimeMs!==identity.mtimeMs||!after.equals(before))fail('CANDIDATE_DRIFT','real proof artifact changed during verification')}
function releaseDynamicProofs(){const legacy=process.env.GRASSEYE_RELEASE_DYNAMIC_PROOF_PATHS;if(legacy!==undefined)fail('RELEASE_EVIDENCE_MISSING','caller-authored Dynamic Proof wrappers are retired');const evidencePath=process.env.GRASSEYE_RELEASE_XUANXUE_REAL_CHROME_EVIDENCE?.trim();return evidencePath?[verifyXuanxueReleaseEvidence(evidencePath)]:[]}
type ReleaseParticipant={contractId:string;contractVersion:number;repo:string;releaseSha256:string};
type ReleaseProofPackage={schemaVersion:number;candidateId:string;gitCommit:string;freezeSha256:string;baseLawSha256:string;functionalLawSha256:string;registrySha256:string;lawQualityReportSha256:string;dynamicProofHashes:string[];crossRepoParticipants:ReleaseParticipant[]};
const validReleaseParticipant=(participant:ReleaseParticipant):boolean=>{const repo=typeof participant?.repo==='string'?repositoryIdentity(participant.repo):'';return Boolean(participant)&&exactKeys(participant as Record<string,unknown>,['contractId','contractVersion','repo','releaseSha256'])&&cleanString(participant.contractId)&&Number.isInteger(participant.contractVersion)&&participant.contractVersion>=1&&repo.split('/').length===2&&/^[a-f0-9]{64}$/u.test(participant.releaseSha256)};
const validateReleaseParticipants=(participants:ReleaseParticipant[]):void=>{let prior='';for(const participant of participants){if(!validReleaseParticipant(participant))fail('RELEASE_EVIDENCE_MISSING','invalid RELEASE participant');const key=canonicalBytes([participant.contractId,participant.contractVersion,repositoryIdentity(participant.repo)]);if(key<=prior)fail('RELEASE_EVIDENCE_MISSING','unsorted RELEASE participants');prior=key}};
export function validateReleaseProofPackage(value:unknown):void{
  if(!value||typeof value!=='object'||Array.isArray(value))fail('RELEASE_EVIDENCE_MISSING','invalid RELEASE proof package');const proof=value as ReleaseProofPackage;
  if(!exactKeys(proof as Record<string,unknown>,['schemaVersion','candidateId','gitCommit','freezeSha256','baseLawSha256','functionalLawSha256','registrySha256','lawQualityReportSha256','dynamicProofHashes','crossRepoParticipants'])||proof.schemaVersion!==1||!/^[a-f0-9]{64}$/u.test(proof.candidateId)||!/^[a-f0-9]{40}$/u.test(proof.gitCommit))fail('RELEASE_EVIDENCE_MISSING','invalid RELEASE proof package');
  for(const field of ['freezeSha256','baseLawSha256','functionalLawSha256','registrySha256','lawQualityReportSha256'] as const)if(!/^[a-f0-9]{64}$/u.test(proof[field]))fail('RELEASE_EVIDENCE_MISSING',`invalid RELEASE package ${field}`);
  if(!isStringArray(proof.dynamicProofHashes)||!sortedUnique(proof.dynamicProofHashes)||proof.dynamicProofHashes.some((hash)=>!/^[a-f0-9]{64}$/u.test(hash))||!Array.isArray(proof.crossRepoParticipants))fail('RELEASE_EVIDENCE_MISSING','invalid RELEASE package evidence');validateReleaseParticipants(proof.crossRepoParticipants);
}
export function agentReleaseParticipants(requested=process.env.GRASSEYE_RELEASE_CROSS_REPO_PARTICIPANTS):ReleaseParticipant[]{if(requested!==undefined)fail('RELEASE_EVIDENCE_MISSING','AGENT RELEASE is the upstream participant leaf; cross-repo participants are forbidden');return[]}
type QualityLawItem={lawId:string;applicableEvidenceModes:string[];deferredEvidenceModes:string[];outcome:'PASS'|'FAIL';evidenceRefs:string[];findings:string[]};
type QualityReport={schemaVersion:number;level:'READY'|'RELEASE';baseSha:string;candidateId:string|null;registrySha256:string;laws:QualityLawItem[];outcome:'PASS'|'FAIL'};
const validOrderedModes=(modes:string[]):boolean=>JSON.stringify(modes)===JSON.stringify(orderedModes(modes));
const validQualityItemCollections=(item:QualityLawItem):boolean=>isStringArray(item.applicableEvidenceModes)&&validOrderedModes(item.applicableEvidenceModes)&&isStringArray(item.deferredEvidenceModes)&&validOrderedModes(item.deferredEvidenceModes)&&isStringArray(item.evidenceRefs)&&sortedUnique(item.evidenceRefs)&&item.evidenceRefs.every(cleanString)&&isStringArray(item.findings)&&sortedUnique(item.findings)&&item.findings.every((finding)=>/^[A-Z][A-Z0-9_]*$/u.test(finding));
const validateQualityItem=(item:QualityLawItem|undefined,lawId:string,level:'READY'|'RELEASE'):void=>{if(!item||!exactKeys(item as Record<string,unknown>,['lawId','applicableEvidenceModes','deferredEvidenceModes','outcome','evidenceRefs','findings'])||item.lawId!==lawId||!['PASS','FAIL'].includes(item.outcome)||!validQualityItemCollections(item))return fail('QUALITY_REPORT_INVALID',`law ${lawId}`);const evidenceRequired=Boolean(item.applicableEvidenceModes.length||item.deferredEvidenceModes.length);if(item.outcome==='PASS'&&((evidenceRequired&&!item.evidenceRefs.length)||item.findings.length))fail('QUALITY_REPORT_INVALID',`law ${lawId}`);if(item.outcome==='FAIL'&&!item.findings.length)fail('QUALITY_REPORT_INVALID',`law ${lawId}`);if(level==='RELEASE'&&item.deferredEvidenceModes.length)fail('QUALITY_REPORT_INVALID',`law ${lawId}`)};
const validateQualityReportHeader=(report:QualityReport,level:'READY'|'RELEASE'):void=>{if(!exactKeys(report as Record<string,unknown>,['schemaVersion','level','baseSha','candidateId','registrySha256','laws','outcome'])||report.schemaVersion!==1||report.level!==level||!/^[a-f0-9]{40}$/u.test(report.baseSha)||!/^[a-f0-9]{64}$/u.test(report.registrySha256)||!['PASS','FAIL'].includes(report.outcome))fail('QUALITY_REPORT_INVALID','top-level')};
const validateQualityCandidate=(report:QualityReport,level:'READY'|'RELEASE'):void=>{if(level==='READY'&&report.candidateId!==null)fail('QUALITY_REPORT_INVALID','READY candidateId');if(level==='RELEASE'&&(typeof report.candidateId!=='string'||!/^[a-f0-9]{64}$/u.test(report.candidateId)))fail('QUALITY_REPORT_INVALID','RELEASE candidateId')};
export function validateQualityReport(value:unknown,laws:Pick<Law,'lawId'>[],level:'READY'|'RELEASE'){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('QUALITY_REPORT_INVALID','top-level');const report=value as QualityReport;
  validateQualityReportHeader(report,level);validateQualityCandidate(report,level);
  if(!Array.isArray(report.laws)||report.laws.length!==laws.length)fail('QUALITY_REPORT_INVALID','law denominator');for(let index=0;index<laws.length;index++)validateQualityItem(report.laws[index],laws[index]!.lawId,level);
  const findings=report.laws.filter((item)=>item.outcome==='FAIL');const outcome=findings.length?'FAIL':'PASS';if(report.outcome!==outcome)fail('QUALITY_REPORT_INVALID','aggregate outcome');
}
function writeReport(laws:Law[],baseSha:string,checks:CheckResult[],diffs:string[],runDirectory:string){const registrySha=sha(bytes(REGISTRY));const items=laws.map((law)=>{const {applicableEvidenceModes:applicable,deferredEvidenceModes:deferred}=evidencePlan(law,diffs,'READY');const relevant=(applicable.length||deferred.length)?checks.filter((check)=>check.domains.includes('*')||check.domains.includes(law.capabilityDomain)):[];const covered=new Set(relevant.filter((check)=>check.outcome==='PASS').flatMap((check)=>check.evidenceModes));const missing=applicable.filter((mode)=>!covered.has(mode));const failed=relevant.filter((check)=>check.outcome==='FAIL');const findings=[...new Set([...missing.map((mode)=>`REQUIRED_EVIDENCE_MODE_UNPROVEN_${mode.replace(/[^A-Za-z0-9]/gu,'_').toUpperCase()}`),...failed.map((check)=>check.finding!).filter(Boolean)])].sort();const evidenceRefs=relevant.filter((check)=>check.outcome==='PASS').map((check)=>check.evidenceRef).sort().filter((value,index,array)=>index===0||value!==array[index-1]);return{lawId:law.lawId,applicableEvidenceModes:applicable,deferredEvidenceModes:deferred,outcome:findings.length?'FAIL':'PASS',evidenceRefs,findings}});const report={schemaVersion:1,level:'READY' as const,baseSha,candidateId:null,registrySha256:registrySha,laws:items,outcome:items.some((item)=>item.outcome==='FAIL')?'FAIL':'PASS'};validateQualityReport(report,laws,'READY');const reportPath=process.env.GRASSEYE_QUALITY_REPORT_MODE==='external'?resolve(runDirectory,'law-quality.report.json'):resolve(ROOT,REPORT);mkdirSync(dirname(reportPath),{recursive:true});writeFileSync(reportPath,canonicalBytes(report),{mode:0o600});return{outcome:report.outcome,path:reportPath,hash:sha(readFileSync(reportPath))}}
function writeReleaseReport(laws:Law[],baseSha:string,binding:ReleaseBinding,checks:CheckResult[],diffs:string[],proofs:ReturnType<typeof releaseDynamicProofs>,runDirectory:string){const referencedDynamicProofHashes=new Set<string>();const items=laws.map((law)=>{const {applicableEvidenceModes:applicable}=evidencePlan(law,diffs,'RELEASE');const staticChecks=checks.filter((check)=>check.domains.includes('*')||check.domains.includes(law.capabilityDomain));const lawProofs=proofs.filter((proof)=>proof.lawIds.includes(law.lawId));const covered=new Set([...staticChecks.filter((check)=>check.outcome==='PASS').flatMap((check)=>check.evidenceModes),...lawProofs.flatMap((proof)=>proof.evidenceModes)]);const missing=applicable.filter((mode)=>!covered.has(mode));const failed=staticChecks.filter((check)=>check.outcome==='FAIL');const findings=[...new Set([...missing.map((mode)=>`REQUIRED_EVIDENCE_MODE_UNPROVEN_${mode.replace(/[^A-Za-z0-9]/gu,'_').toUpperCase()}`),...failed.map((check)=>check.finding!).filter(Boolean)])].sort();const evidenceRefs=[...staticChecks.filter((check)=>check.outcome==='PASS').map((check)=>check.evidenceRef),...lawProofs.flatMap((proof)=>proof.evidenceRefs)].sort().filter((value,index,array)=>index===0||value!==array[index-1]);for(const proof of lawProofs)for(let index=0;index<proof.dynamicProofEvidenceRefs.length;index++)if(evidenceRefs.includes(proof.dynamicProofEvidenceRefs[index]!))referencedDynamicProofHashes.add(proof.hashes[index]!);return{lawId:law.lawId,applicableEvidenceModes:applicable,deferredEvidenceModes:[] as string[],outcome:findings.length?'FAIL':'PASS',evidenceRefs,findings}});const report={schemaVersion:1,level:'RELEASE' as const,baseSha,candidateId:binding.candidateId,registrySha256:binding.registrySha256,laws:items,outcome:items.some((item)=>item.outcome==='FAIL')?'FAIL':'PASS'};validateQualityReport(report,laws,'RELEASE');const reportPath=process.env.GRASSEYE_QUALITY_REPORT_MODE==='external'?resolve(runDirectory,'law-quality.report.json'):resolve(ROOT,REPORT);mkdirSync(dirname(reportPath),{recursive:true});writeFileSync(reportPath,canonicalBytes(report),{mode:0o600});return{outcome:report.outcome,path:reportPath,hash:sha(readFileSync(reportPath)),dynamicProofHashes:[...referencedDynamicProofHashes].sort()}}
function writeReleasePackage(binding:ReleaseBinding,reportHash:string,dynamicProofHashes:string[]){const proofPackage={schemaVersion:1,candidateId:binding.candidateId,gitCommit:binding.gitCommit,freezeSha256:binding.freezeSha256,baseLawSha256:binding.baseLawSha256,functionalLawSha256:binding.functionalLawSha256,registrySha256:binding.registrySha256,lawQualityReportSha256:reportHash,dynamicProofHashes,crossRepoParticipants:agentReleaseParticipants()};validateReleaseProofPackage(proofPackage);const directory=resolve(ROOT,'.governance/runtime/releases',binding.candidateId);mkdirSync(directory,{recursive:true});const destination=resolve(directory,'proof-package.json');const temporary=`${destination}.tmp-${process.pid}`;writeFileSync(temporary,canonicalBytes(proofPackage),{mode:0o600});renameSync(temporary,destination);return destination}
const assertCandidateSnapshot=(initial:string,message:string):void=>{if(candidateSnapshot()!==initial)fail('CANDIDATE_DRIFT',message)};
const assertReleaseBinding=(initial:string,binding:ReleaseBinding,message:string):void=>{assertCandidateSnapshot(initial,message);if(releaseCandidateBinding().candidateId!==binding.candidateId)fail('CANDIDATE_DRIFT',message)};
function quality(level:Level){if(!['CHANGE','READY','RELEASE'].includes(level))fail('ENTRY_CONTRACT_MISMATCH',`invalid level ${level}`);verifyEntry();const initialCandidate=candidateSnapshot();const diffs=scopeCheck(level==='CHANGE'?'CHANGE':'FULL');const laws=level==='CHANGE'?registeredLaws():buildRegistry().laws;const releaseBinding=level==='RELEASE'?releaseCandidateBinding():null;const runDirectory=qualityRunDirectory();const checks=projectChecks(level,laws,runDirectory);assertCandidateSnapshot(initialCandidate,'candidate changed while checks ran');if(level==='READY'){const record=changeRecord();const report=writeReport(laws,record.baseSha,checks,diffs.map((item)=>item.path),runDirectory);assertCandidateSnapshot(initialCandidate,'candidate changed before READY verdict');if(report.outcome!=='PASS')fail('QUALITY_FINDINGS_PRESENT',report.path);console.log(`READY_REPORT ${report.path}`)}else if(level==='RELEASE'){const binding=releaseBinding!;const proofs=releaseDynamicProofs();const record=changeRecord();const report=writeReleaseReport(laws,record.baseSha,binding,checks,diffs.map((item)=>item.path),proofs,runDirectory);assertReleaseBinding(initialCandidate,binding,'candidate changed before RELEASE package');if(report.outcome!=='PASS')fail('RELEASE_EVIDENCE_MISSING',report.path);const packagePath=writeReleasePackage(binding,report.hash,report.dynamicProofHashes);assertReleaseBinding(initialCandidate,binding,'candidate changed after RELEASE package');console.log(`RELEASE_PACKAGE ${packagePath}`)}else{const failed=checks.find((check)=>check.outcome==='FAIL');if(failed)fail('PROJECT_CHECK_FAILED',failed.finding??failed.command)}console.log(`${level}_PASS`)}
function main(){const [command,arg]=process.argv.slice(2);if(command==='entry'){verifyEntry();if(arg!=='READ_ONLY'){const record=changeRecord();dirtyTargetCheck(record)}console.log('ENTRY_OK');return}if(command==='scope'){scopeCheck();return}if(command==='build'){writeRegistry();return}if(command==='projection'){checkProjection();return}if(command==='quality'){quality((arg??'CHANGE') as Level);return}fail('ENTRY_CONTRACT_MISMATCH','unknown command')}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{main()}catch(error){const e=error as Error;console.error(`${e instanceof GovernanceError?e.code:'GOVERNANCE_INTERNAL_ERROR'} ${e.message}`);process.exitCode=1}}
