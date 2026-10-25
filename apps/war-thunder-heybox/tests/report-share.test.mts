import test from 'node:test';import assert from 'node:assert/strict';
import {shareReportPoster} from '../src/report-share.ts';
globalThis.document={fonts:{ready:Promise.resolve()}} as any;
const rect={left:10,top:100,width:350,height:600,right:360,bottom:700};
function target(overrides={},reserve=64,imageOK=true){return {querySelectorAll:()=>[{decode:()=>imageOK?Promise.resolve():Promise.reject(Error('broken'))}],getBoundingClientRect:()=>({...rect,...overrides}),querySelector:()=>({getBoundingClientRect:()=>({height:reserve,bottom:700})})} as any;}
function host(){const calls:any[]=[];return {calls,sdk:{viewport:{getWindowInfo:async()=>({windowWidth:412,windowHeight:915})},share:{screenshot:async(opts:unknown)=>{calls.push(opts);return false;}}} as any};}
test('visible logical-pixel crop reserves watermark and exposes save-to-album without claiming an opaque result',async()=>{const {sdk,calls}=host();assert.equal(await shareReportPoster(sdk,target(),()=>true),undefined);assert.equal(calls.length,1);assert.deepEqual(calls[0].rect,{left:10,top:100,width:350,height:600});assert.equal(calls[0].saveToAlbum,true);assert.equal(calls[0].watermarkTheme,'dark');assert.equal(Object.hasOwn(calls[0],'url'),false);});
test('offscreen crops, missing watermark room, failed images and closed screens never invoke native capture',async()=>{for(const [el,live] of [[target({bottom:1000}),()=>true],[target({},40),()=>true],[target({},64,false),()=>true],[target(),()=>false]] as any){const {sdk,calls}=host();await assert.rejects(shareReportPoster(sdk,el,live));assert.equal(calls.length,0);}});
