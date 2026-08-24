import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';

const ROOT = process.cwd();
const GIT_EVIDENCE_MAX_BUFFER = 64 * 1024 * 1024;
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
function repositoryPaths(){const tracked=execFileSync('git',['ls-files','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean).map(norm);const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:ROOT}).toString().split('\0').filter(Boolean).map(norm);return[...new Set([...tracked,...untracked])].filter((path)=>existsSync(resolve(ROOT,path))&&!lstatSync(resolve(ROOT,path)).isDirectory()).sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)))}
function repositoryIdentity(remote:string){return remote.trim().replace(/^git@[^:]+:/u,'').replace(/^(?:https?|ssh):\/\/[^/]+\//u,'').replace(/\.git$/u,'')}
function walk(dir:string):string[]{if(!existsSync(resolve(ROOT,dir)))return[];const out:string[]=[];for(const entry of readdirSync(resolve(ROOT,dir),{withFileTypes:true})){if(entry.name!==entry.name.normalize('NFC'))fail('SOURCE_PARSE_FAILED',`${dir}/${entry.name} non-NFC`);const child=norm(`${dir}/${entry.name}`);entry.isDirectory()?out.push(...walk(child)):out.push(child)}return out.sort((left,right)=>Buffer.compare(Buffer.from(left),Buffer.from(right)))}

export {
  ROOT, GIT_EVIDENCE_MAX_BUFFER, GovernanceError, fail, validGitObjectId, bytes, utf8, text, sha,
  norm, repositoryPaths, repositoryIdentity, walk,
};

