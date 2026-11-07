/// <reference types="vite/client" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const $ = (id: string) => document.getElementById(id)!;
const dialog = $('account-dialog') as HTMLDialogElement;
const form = $('account-form') as HTMLFormElement;
const email = $('account-email') as HTMLInputElement;
const signout = $('account-signout') as HTMLButtonElement;
const submit = $('account-submit') as HTMLButtonElement;
const status = $('account-status');

$('account-open').addEventListener('click', () => dialog.showModal());

// Only public, browser-safe keys belong in VITE_ variables. Never put a service key here.
function publicKey(key: string): boolean {
  if (!key || key.startsWith('sb_secret_')) return false;
  if (key.startsWith('sb_publishable_')) return true;
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'anon';
  } catch { return false; }
}
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let client: SupabaseClient | null = null;
try {
  if (url && key && publicKey(key)) {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) client = createClient(url, key);
  }
} catch { /* misconfiguration: account stays unavailable */ }

if (client) {
  const auth = client;
  function update(userEmail?: string) {
    $('account-info').textContent = userEmail ? `Signed in as ${userEmail}` : 'Sign in with an email link. No password needed.';
    form.hidden = !!userEmail;
    signout.hidden = !userEmail;
  }
  update();
  auth.auth.getSession().then(({ data }) => update(data.session?.user.email));
  auth.auth.onAuthStateChange((_event, session) => update(session?.user.email));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = 'Sending…';
    try {
      const { error } = await auth.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: `${location.origin}/` } });
      status.textContent = error ? 'Could not send a sign-in link. Please try again later.' : 'Check your email for a sign-in link.';
    } catch { status.textContent = 'Could not send a sign-in link. Please try again later.'; }
    submit.disabled = false;
  });
  signout.addEventListener('click', async () => {
    signout.disabled = true;
    try {
      const { error } = await auth.auth.signOut();
      status.textContent = error ? 'Could not sign out. Please try again.' : 'Signed out.';
    } catch { status.textContent = 'Could not sign out. Please try again.'; }
    signout.disabled = false;
  });
}
