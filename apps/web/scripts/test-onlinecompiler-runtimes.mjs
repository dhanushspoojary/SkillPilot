const res = await fetch('https://api.onlinecompiler.io/api/v2/piston/runtimes');
console.log('Runtimes status:', res.status);
if (res.ok) {
  const data = await res.json();
  console.log('Total runtimes available:', data.length);
  const sample = data.map(r => ({ language: r.language, version: r.version, aliases: r.aliases }));
  console.log('Sample runtimes:', JSON.stringify(sample.filter(r => ['python', 'javascript', 'c', 'c++', 'cpp', 'java', 'sql', 'sqlite', 'sqlite3'].includes(r.language) || (r.aliases && r.aliases.some(a => ['python', 'javascript', 'c', 'cpp', 'java', 'sql', 'sqlite'].includes(a)))), null, 2));
} else {
  console.log('Failed to fetch runtimes:', await res.text());
}
