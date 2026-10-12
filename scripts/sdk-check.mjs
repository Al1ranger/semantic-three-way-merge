import {abi} from 'genlayer-js';
import assert from 'node:assert/strict';
const c=abi.calldata;
for(const [method,args] of [['open_merge',['demo','Al1ranger','semantic-three-way-merge','a'.repeat(40),'base.json,left.json,right.json',Array(3).fill('b'.repeat(64)).join(','),1791810000]],['reconcile',['a'.repeat(64),0]],['get_record',['a'.repeat(64),'delivery']]]){
const encoded=c.encode(c.makeCalldataObject(method,args,{}));assert.deepEqual(c.encode(c.decode(encoded)),encoded);
}console.log('3 SDK calldata roundtrips passed; not contract execution validation');
