// The page Stripe sends people back to after onboarding or paying.

const MESSAGES: Record<string, string> = {
  paid: 'Payment received. Thank you! You can go back to the app.',
  cancelled: 'Payment cancelled. You can go back to the app and try again.',
  onboarding: 'Thanks! Go back to the app and tap "Set up card payments" to check your status.',
  'onboarding-retry': 'That link expired. Go back to the app and tap "Set up card payments" again.',
};

Deno.serve((req) => {
  const kind = new URL(req.url).searchParams.get('kind') ?? '';
  const message = MESSAGES[kind] ?? 'You can go back to the app.';
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Farrier App</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.4rem">Farrier App</h1><p>${message}</p></body>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
