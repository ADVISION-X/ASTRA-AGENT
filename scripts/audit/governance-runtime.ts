import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
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
  const normalized=[...new Set(paths.map(norm))].filter(validateRepositoryEntry).sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)));
  const folded=new Map<string,string>();for(const path of normalized){const key=path.normalize('NFC').toLocaleLowerCase('en-US');const prior=folded.get(key);if(prior&&prior!==path)fail('SOURCE_PARSE_FAILED',`case collision ${prior} ${path}`);folded.set(key,path)}
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
  const unmerged=execFileSync('git',['ls-files','-u','-z'],{cwd:ROOT}).toString();
  const staged=execFileSync('git',['ls-files','-s','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean);
  validateGitIndexEntries(unmerged,staged);
  const tracked=execFileSync('git',['ls-files','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean);
  const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean);
  return sortPaths([...tracked,...untracked]);
}
export const validateGitIndexEntries=(unmerged:string,staged:readonly string[]):void=>{
  if(unmerged)fail('SOURCE_PARSE_FAILED','unmerged index');
  if(staged.some((entry)=>entry.startsWith('160000 ')))fail('SOURCE_PARSE_FAILED','submodule entry');
};
function walk(dir:string):string[]{if(!existsSync(resolve(ROOT,dir)))return[];const out:string[]=[];for(const entry of readdirSync(resolve(ROOT,dir),{withFileTypes:true})){if(entry.name!==entry.name.normalize('NFC'))fail('SOURCE_PARSE_FAILED',`${dir}/${entry.name} non-NFC`);const child=norm(`${dir}/${entry.name}`);entry.isDirectory()?out.push(...walk(child)):out.push(child)}return out.sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)))}

export {
  ROOT, GovernanceError, fail, validGitObjectId, bytes, utf8, text, sha,
  norm, repositoryPaths, walk,
};
