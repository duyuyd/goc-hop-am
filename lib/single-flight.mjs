const pending=new Map();
export function singleFlight(key,task){
 if(pending.has(key))return pending.get(key);
 const promise=Promise.resolve().then(task).finally(()=>{if(pending.get(key)===promise)pending.delete(key)});
 if(pending.size<200)pending.set(key,promise);
 return promise;
}
