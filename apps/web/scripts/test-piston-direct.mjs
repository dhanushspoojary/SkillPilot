const testPayload = {
  language: 'python',
  version: '*',
  files: [{ content: 'print("hello from piston")' }]
};

console.log('Sending test request to https://emkc.org/api/v2/piston/execute ...');
try {
  const res = await fetch('https://emkc.org/api/v2/piston/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  });
  console.log(`HTTP Status: ${res.status}`);
  const json = await res.json();
  console.log('Response JSON:', JSON.stringify(json, null, 2));
} catch (e) {
  console.error('Fetch error:', e);
}
