import test from 'node:test';
import assert from 'node:assert/strict';
import {createQueryHistory,readQueryRecords} from '../src/query-history.ts';
const row={uid:'1234',snapshotId:'snap_test',nickname:'never replay raw nickname',fetchedAt:'2026-10-25T00:00:00Z'};
test('history drops corrupt rows, deduplicates UID, bounds size and never replays stored nicknames',()=>{
 const rows=readQueryRecords([null,{},row,row,{...row,uid:'invalid'},{...row,uid:'5',snapshotId:'../bad'},{...row,uid:'6',fetchedAt:'bad'}]);
 assert.equal(rows.length,1);assert.equal(rows[0].nickname,'玩家 #1234');
 assert.equal(readQueryRecords(Array.from({length:30},(_,i)=>({...row,uid:String(i)}))).length,20);
});
test('serialized writes and clear cannot be reordered by storage latency',async()=>{
 let body:unknown=[]; const order:number[]=[];
 const history=createQueryHistory({getStorage:async()=>({data:body}),setStorage:async({data}:any)=>{await new Promise(r=>setTimeout(r,3));body=data;order.push(data.length);}} as any);
 const save=history.save([row]),clear=history.save([]);await Promise.all([save,clear]);
 assert.deepEqual(order,[1,0]);assert.deepEqual(await history.load(),[]);
});
test('late initial read cannot overwrite a newer query history write',async()=>{
 let release!:(x:any)=>void;
 const history=createQueryHistory({getStorage:()=>new Promise(r=>{release=r}),setStorage:async()=>{}} as any);
 const loading=history.load();await new Promise(r=>setTimeout(r,0));await history.save([row]);release({data:[]});
 assert.equal(await loading,null);
});
