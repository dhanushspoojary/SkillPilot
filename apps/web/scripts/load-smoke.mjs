const base=process.env.SMOKE_URL||'http://127.0.0.1:3000';
const jobs=Array.from({length:100},()=>fetch(`${base}/api/health`,{cache:'no-store'}));
const results=await Promise.all(jobs);
if(results.some(r=>!r.ok)) throw new Error(`load smoke had ${results.filter(r=>!r.ok).length} failed requests`);
console.log('load smoke: PASS (100 concurrent health requests)');
