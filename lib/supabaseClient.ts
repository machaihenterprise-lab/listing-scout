import { createClient } from '@supabase/supabase-js';

// Create the Supabase client if the public env vars are present.
// Wrap in a try/catch so module evaluation doesn't throw during build
// when environment variables are not yet available in the hosting env.
let supabase: any = null;
try {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (supabaseUrl && supabaseAnonKey) {
		supabase = createClient(supabaseUrl, supabaseAnonKey);
	} else {
		// leave supabase as null; callers should handle missing client at runtime
		supabase = null;
	}
} catch (err: unknown) {
	// swallow errors during build to avoid crashing the bundler; runtime
	// requests will surface a clearer error if the client is needed.
	// eslint-disable-next-line no-console
	const msg = err instanceof Error ? err.message : String(err);
	console.warn('Supabase client not created at build time:', msg);
	supabase = null;
}

export { supabase };
