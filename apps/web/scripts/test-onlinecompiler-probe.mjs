const res = await fetch('https://api.onlinecompiler.io/api/v2/piston/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'test-key-probe'
  },
  body: JSON.stringify({
    language: 'python',
    version: '*',
    files: [{ name: 'main.py', content: 'print(1)' }]
  })
});

console.log('Status:', res.status);
console.log('Headers:', Object.fromEntries(res.headers.entries()));
console.log('Body:', await res.text());
