import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';

const ROOT = process.cwd();
class GovernanceError extends Error { constructor(readonly code:string, message:string){super(message)} }
const fail = (code:string,message:string):never => { throw new GovernanceError(code,message); };
const gitObjectIdLength = (): number => {
  const format = execFileSync('git', ['rev-parse', '--show-object-format'], { cwd: ROOT, encoding: 'utf8' }).trim();
  return format === 'sha1' ? 40 : format === 'sha256' ? 64 : fail('SOURCE_PARSE_FAILED', `unsupported git object format ${format}`);
};
const validGitObjectId = (value: unknown): value is string => typeof value === 'string'
  && new RegExp('^[a-f0-9]{' + gitObjectIdLength() + '}$', 'u').test(value);
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
const norm=(p:string)=>p.split(sep).join('/').replace(/^\.\//,'');
export const validateRepositoryPathText=(path:string):string=>{
  if(!path||path.includes('\0')||path!==path.normalize('NFC')||isAbsolute(path)||path.includes('\\')){
    fail('SOURCE_PARSE_FAILED',`${path||'<empty>'} non-canonical repository path`);
  }
  const segments=path.split('/');
  if(segments.some((segment)=>!segment||segment==='.'||segment==='..')){
    fail('SOURCE_PARSE_FAILED',`${path} non-canonical repository path`);
  }
  return path;
};
const decodeGitZEntries=(raw:Buffer,label:string):string[]=>{
  let decoded:string;
  try{decoded=new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(raw)}
  catch{return fail('SOURCE_PARSE_FAILED',`${label} invalid UTF-8 path`)}
  if(decoded==='')return[];
  if(!decoded.endsWith('\0'))fail('SOURCE_PARSE_FAILED',`${label} missing NUL terminator`);
  return decoded.slice(0,-1).split('\0');
};
export const decodeGitPathBytes=(raw:Buffer,label='git path list'):string[]=>
  decodeGitZEntries(raw,label).map(validateRepositoryPathText);
export const validateRepositoryEntryAt=(root:string,path:string):boolean=>{
  const absolute=resolve(root,path);if(!existsSync(absolute))return false;
  const stat=lstatSync(absolute);if(stat.isDirectory())return false;
  if(stat.isSymbolicLink()){
    const target=realpathSync(absolute);const escaped=relative(resolve(root),target);
    if(escaped==='..'||escaped.startsWith(`..${sep}`)||resolve(root,escaped)!==target)fail('TARGET_OUTSIDE_DOMAIN_AUTHORITY',path);
  }else if(!stat.isFile())fail('SOURCE_PARSE_FAILED',`${path} special device`);
  return true;
};
const validateRepositoryEntry=(path:string):boolean=>validateRepositoryEntryAt(ROOT,path);
const sortPaths=(paths:readonly string[]):string[]=>{
  const normalized=[...new Set(paths.map(validateRepositoryPathText))].filter(validateRepositoryEntry).sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)));
  const folded=new Map<string,string>();for(const path of normalized){const key=path.toLocaleLowerCase('en-US');const prior=folded.get(key);if(prior&&prior!==path)fail('SOURCE_PARSE_FAILED',`case collision ${prior} ${path}`);folded.set(key,path)}
  return normalized;
};
const sealedRepositoryPaths=():string[]=>{
  const raw=process.env.GOVERNANCE_BINDING_CONTRACT?.trim()??fail('SOURCE_PARSE_FAILED','sealed binding contract missing');
  if(!raw)fail('SOURCE_PARSE_FAILED','sealed binding contract empty');
  const contract=JSON.parse(raw) as{targetPaths?:unknown};
  if(!Array.isArray(contract.targetPaths)||contract.targetPaths.some((path)=>typeof path!=='string'))fail('SOURCE_PARSE_FAILED','sealed target paths invalid');
  return sortPaths(contract.targetPaths as string[]);
};
function repositoryPaths(){
  if(process.env.GOVERNANCE_SEALED_ROOT)return sealedRepositoryPaths();
  const unmerged=decodeGitZEntries(execFileSync('git',['ls-files','-u','-z'],{cwd:ROOT}),'unmerged index');
  const staged=decodeGitZEntries(execFileSync('git',['ls-files','-s','-z'],{cwd:ROOT}),'staged index');
  for(const entry of [...unmerged,...staged]){
    const separator=entry.indexOf('\t');
    if(separator<0)fail('SOURCE_PARSE_FAILED','malformed index entry');
    validateRepositoryPathText(entry.slice(separator+1));
  }
  validateGitIndexEntries(unmerged.join('\0'),staged);
  const tracked=decodeGitPathBytes(execFileSync('git',['ls-files','-z'],{cwd:ROOT}),'tracked paths');
  const untracked=decodeGitPathBytes(execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:ROOT}),'untracked paths');
  return sortPaths([...tracked,...untracked]);
}
export const validateGitIndexEntries=(unmerged:string,staged:readonly string[]):void=>{
  if(unmerged)fail('SOURCE_PARSE_FAILED','unmerged index');
  if(staged.some((entry)=>entry.startsWith('160000 ')))fail('SOURCE_PARSE_FAILED','submodule entry');
};
export function walkAt(root:string,dir:string):string[]{
  validateRepositoryPathText(dir);
  const absolute=resolve(root,dir);if(!existsSync(absolute))return[];
  const target=realpathSync(absolute);const escaped=relative(resolve(root),target);
  if(escaped==='..'||escaped.startsWith(`..${sep}`))fail('TARGET_OUTSIDE_DOMAIN_AUTHORITY',dir);
  const directoryStat=lstatSync(absolute);
  if(directoryStat.isSymbolicLink())fail('SOURCE_PARSE_FAILED',`${dir} symbolic link`);
  if(!directoryStat.isDirectory())fail('SOURCE_PARSE_FAILED',`${dir} not directory`);
  const out:string[]=[];
  for(const entry of readdirSync(absolute,{withFileTypes:true})){
    const child=validateRepositoryPathText(norm(`${dir}/${entry.name}`));
    if(entry.isSymbolicLink()){
      validateRepositoryEntryAt(root,child);
      fail('SOURCE_PARSE_FAILED',`${child} symbolic link`);
    }
    if(entry.isDirectory())out.push(...walkAt(root,child));
    else if(validateRepositoryEntryAt(root,child))out.push(child);
  }
  return out.sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)));
}
function walk(dir:string):string[]{return walkAt(ROOT,dir)}

export {
  ROOT, GovernanceError, fail, validGitObjectId, bytes, utf8, text, sha,
  norm, repositoryPaths, walk,
};
