import { GovernanceError, fail, text } from './governance-runtime.js';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const sortedUnique = (items:string[]) => items.length === new Set(items).size && items.every((v,i)=>i===0||Buffer.compare(Buffer.from(items[i-1]!),Buffer.from(v))<0);
const exactKeys = (value: object, keys:string[]) => JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());
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
const cleanString = (value:unknown): value is string => typeof value==='string' && value.length>0 && value===value.normalize('NFC') && !/[\0-\x1f\x7f]/u.test(value);
const pathPatternValid = (value:string) => {
  if(!cleanString(value)||value.startsWith('/')||value.includes('\\')||value.includes('//')||/(?:^|\/)\.\.?(?:\/|$)/u.test(value)||/[?\[\]{}()!+@]/u.test(value))return false;
  if(value==='**/*')return true;
  const segment='[^/*?\\[\\]{}()!+@]+';
  return new RegExp(`^(?:${segment}\\/)*${segment}(?:\\/\\*\\*|\\/\\*\\*\\/\\*\\.[A-Za-z0-9]+)?$`,'u').test(value);
};
const pathPatternContains = (parent:string,child:string) => parent==='**/*' || parent===child || (parent.endsWith('/**') && (child===parent.slice(0,-3) || child.startsWith(`${parent.slice(0,-3)}/`)));


export {
  sortedUnique, exactKeys, canonicalValue, canonicalBytes, parseJson, isStringArray, cleanString,
  pathPatternValid, pathPatternContains,
};
export type { Json };
