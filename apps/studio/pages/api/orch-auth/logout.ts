import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Clear any server-side cookies
  res.setHeader('Set-Cookie', [
    'sb-access-token=; Path=/; HttpOnly; Max-Age=0',
    'sb-refresh-token=; Path=/; HttpOnly; Max-Age=0',
  ])

  // Return HTML that clears localStorage and redirects
  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(`<!DOCTYPE html>
<html><head><title>Logging out...</title></head>
<body>
<script>
  // Clear all Orchestra auth storage
  try {
    localStorage.removeItem('orchestra.studio.auth.token');
    localStorage.removeItem('orchestra.studio.auth.is_admin');
    // Clear any Supabase auth keys
    Object.keys(localStorage).forEach(function(key) {
      if (key.startsWith('sb-') || key.startsWith('supabase') || key.startsWith('orchestra')) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.clear();
  } catch(e) {}
  window.location.href = '/orch-sign-in';
</script>
<noscript><meta http-equiv="refresh" content="0;url=/orch-sign-in"></noscript>
</body></html>`)
}
