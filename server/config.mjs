export function getSupabaseConfig(env) {
  let url;
  try {
    const parsed = new URL(env.SUPABASE_URL);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.search || parsed.hash || parsed.pathname !== '/') return null;
    url = parsed.origin;
  } catch { return null; }
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey || '')) return null;
  return { url, publishableKey };
}

export function publicConfig(env) {
  const config = getSupabaseConfig(env);
  return { configured: Boolean(config), url: config?.url ?? null, publishableKey: config?.publishableKey ?? null };
}
