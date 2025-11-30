// Simple integration test for /api/messages
// Usage: ensure dev server is running on http://localhost:3000

if (typeof fetch === 'undefined') {
  console.error('Global fetch is not available. Run with Node 18+ or set up a fetch polyfill.');
  process.exit(2);
}

async function run() {
  const leadId = process.argv[2] || '';
  if (!leadId) {
    console.error('Usage: node scripts/test-messages-api.js <leadId>');
    process.exit(2);
  }

  try {
    const res = await fetch('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId }),
    });

    const json = await res.json();
    console.log('HTTP', res.status);
    console.log(JSON.stringify(json, null, 2));
    process.exit(res.ok ? 0 : 1);
  } catch (err) {
    console.error('Request failed:', err);
    process.exit(1);
  }
}

run();
