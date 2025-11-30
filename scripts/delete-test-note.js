// Dev script: delete test note messages by body match
// Usage: node scripts/delete-test-note.js

(async () => {
  try {
    // dynamic import so this file works in CommonJS or ESM node setups
    const { createClient } = await import('@supabase/supabase-js');
    // Read .env.local manually so we don't need dotenv as a dependency
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync && !fs.existsSync(envPath)) {
      console.error('.env.local not found in project root');
      process.exit(1);
    }
    const raw = fs.readFileSync ? fs.readFileSync(envPath, 'utf8') : (await fs.promises.readFile(envPath, 'utf8'));
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        const key = m[1];
        let val = m[2] || '';
        // strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      console.error('Missing SUPABASE env vars in .env.local');
      process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const pattern = '🔒 Test note from temp API — using first lead';

    console.log('Searching for messages matching:', pattern);
    const { data, error } = await supabase.from('messages').select('id, body').ilike('body', `%${pattern}%`);
    if (error) {
      console.error('Error selecting messages:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('No matching messages found');
      process.exit(0);
    }

    console.log(`Found ${data.length} message(s). Deleting...`);
    const ids = data.map((r) => r.id);
    const { data: deleted, error: delErr } = await supabase.from('messages').delete().in('id', ids).select('id');
    if (delErr) {
      console.error('Error deleting messages:', delErr);
      process.exit(1);
    }

    console.log('Deleted messages:', deleted.map((d) => d.id));
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error running script:', e);
    process.exit(1);
  }
})();
