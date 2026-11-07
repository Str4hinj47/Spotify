/// <reference types="vite/client" />
import type { SupabaseClient } from '@supabase/supabase-js';
import { CLOUD_BACKUP_KEY, captureSnapshot, normalizeSnapshot, restoreSnapshot, undoRestore } from './cloud-save.mjs';

const $ = (id: string) => document.getElementById(id)!;
const dialog = $('account-dialog') as HTMLDialogElement;
const form = $('account-form') as HTMLFormElement;
const email = $('account-email') as HTMLInputElement;
const signout = $('account-signout') as HTMLButtonElement;
const submit = $('account-submit') as HTMLButtonElement;
const status = $('account-status');

const cloudControls = $('cloud-controls');
const cloudStatus = $('cloud-status');
const cloudUndo = $('cloud-undo') as HTMLButtonElement;
const backupStatus = $('backup-status');
const backupImport = $('backup-import') as HTMLInputElement;
const cloudButtons = ['cloud-upload', 'cloud-restore', 'cloud-delete'].map(id => $(id) as HTMLButtonElement);
function refreshUndo() { try { cloudUndo.hidden = !localStorage.getItem(CLOUD_BACKUP_KEY); } catch { cloudUndo.hidden = true; } }
refreshUndo();
$('account-open').addEventListener('click', () => { refreshUndo(); dialog.showModal(); });
if (location.hash === '#account') dialog.showModal();
cloudUndo.addEventListener('click', () => {
  if (!confirm('Close all Overtake game tabs first. Swap this device’s current garage and personal records with its last pre-restore backup?')) return;
  try { undoRestore(localStorage); refreshUndo(); cloudStatus.textContent = 'Local restore undone. Reopen the game to use the restored data.'; status.textContent = cloudStatus.textContent; backupStatus.textContent = cloudStatus.textContent; }
  catch (e) { status.textContent = e instanceof Error ? e.message : 'Could not restore the local backup.'; }
});

$('backup-export').addEventListener('click', () => {
  try {
    const snapshot = captureSnapshot(localStorage);
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'overtake-save.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    backupStatus.textContent = 'Save file downloaded. Keep it somewhere safe; it is not encrypted.';
  } catch (e) { backupStatus.textContent = e instanceof Error ? e.message : 'Could not download a save file.'; }
});
backupImport.addEventListener('change', async () => {
  const file = backupImport.files?.[0];
  backupImport.value = '';
  if (!file) return;
  try {
    if (file.size > 100_000) throw new Error('Save file is too large.');
    let raw: unknown;
    try { raw = JSON.parse(await file.text()); } catch { throw new Error('Save file is not valid JSON.'); }
    const snapshot = normalizeSnapshot(raw);
    if (!confirm('Close all Overtake game tabs first. Importing replaces this device’s garage and personal records. One local undo backup will be kept. Continue?')) { backupStatus.textContent = 'No changes made.'; return; }
    restoreSnapshot(localStorage, snapshot); refreshUndo();
    backupStatus.textContent = 'Save imported. Reopen the game to use it. You can undo the last local restore below.';
  } catch (e) { backupStatus.textContent = e instanceof Error ? e.message : 'Could not import the save file.'; }
});

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
async function initAccount() {
  let client: SupabaseClient | null = null;
  try {
    if (url && key && publicKey(key)) {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
        const { createClient } = await import('@supabase/supabase-js');
        client = createClient(url, key);
      }
    }
  } catch { /* misconfiguration/network: account stays unavailable */ }
  if (!client) return;
  const auth = client;
  function update(userEmail?: string) {
    $('account-info').textContent = userEmail ? `Signed in as ${userEmail}` : 'Sign in with an email link. No password needed.';
    form.hidden = !!userEmail;
    signout.hidden = !userEmail;
    cloudControls.hidden = !userEmail;
    cloudStatus.textContent = '';
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

  type CloudRow = { save_id: string; revision: number; payload: unknown; updated_at: string };
  async function currentUser() {
    const { data, error } = await auth.auth.getUser();
    if (error || !data.user?.id) throw new Error('Please sign in again before using cloud saves.');
    return data.user.id;
  }
  async function readCloud(userId: string): Promise<CloudRow | null> {
    const { data, error } = await auth.from('overtake_cloud_saves').select('save_id,revision,payload,updated_at').eq('user_id', userId).maybeSingle();
    if (error) throw new Error('Cloud save unavailable. Check the project setup or try again later.');
    if (!data) return null;
    if (typeof data.save_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.save_id) || !Number.isSafeInteger(data.revision) || data.revision < 1 || typeof data.updated_at !== 'string') throw new Error('Cloud save has invalid metadata; nothing was changed.');
    return data as CloudRow;
  }
  async function sameUser(id: string) {
    if (await currentUser() !== id) throw new Error('Account changed. Please try again.');
  }
  function cloudBusy(busy: boolean) { for (const b of cloudButtons) b.disabled = busy; cloudUndo.disabled = busy; signout.disabled = busy; }
  async function perform(action: () => Promise<void>) {
    cloudBusy(true); cloudStatus.textContent = 'Checking cloud save…';
    try { await action(); }
    catch (e) { cloudStatus.textContent = e instanceof Error ? e.message : 'Cloud save unavailable. Please try again.'; }
    finally { cloudBusy(false); refreshUndo(); }
  }
  $('cloud-upload').addEventListener('click', () => void perform(async () => {
    const id = await currentUser(), existing = await readCloud(id);
    // Refuse to replace a future/incompatible schema; the older client must not destroy it.
    if (existing) normalizeSnapshot(existing.payload);
    const detail = existing ? `Replace cloud revision ${existing.revision} (saved ${existing.updated_at})?` : 'Create your first cloud save?';
    if (!confirm(`${detail} Close all game tabs first. This uploads this device’s garage and unverified personal records; it replaces the previous cloud snapshot.`)) { cloudStatus.textContent = 'No changes made.'; return; }
    const payload = captureSnapshot(localStorage);
    await sameUser(id);
    if (existing) {
      const { data, error } = await auth.from('overtake_cloud_saves').update({payload}).eq('user_id', id).eq('save_id', existing.save_id).eq('revision', existing.revision).select('revision').maybeSingle();
      if (error) throw new Error('Could not save to cloud. Check the project setup or try again.');
      if (!data) throw new Error('Cloud save changed on another device. Nothing was overwritten; try again.');
    } else {
      const { error } = await auth.from('overtake_cloud_saves').insert({ user_id: id, payload });
      if (error?.code === '23505') throw new Error('A cloud save was created on another device. Nothing was overwritten; try again.');
      if (error) throw new Error('Could not save to cloud. Check the project setup or try again.');
    }
    cloudStatus.textContent = 'Cloud save updated. Future changes are not saved automatically.';
  }));
  $('cloud-restore').addEventListener('click', () => void perform(async () => {
    const id = await currentUser(), existing = await readCloud(id);
    if (!existing) { cloudStatus.textContent = 'No cloud save exists for this account.'; return; }
    const payload = normalizeSnapshot(existing.payload);
    if (!confirm(`Restore cloud revision ${existing.revision} (saved ${existing.updated_at})? Close all game tabs first. This replaces this device’s garage and personal records. One local undo backup will be kept.`)) { cloudStatus.textContent = 'No changes made.'; return; }
    await sameUser(id);
    restoreSnapshot(localStorage, payload);
    cloudStatus.textContent = 'Cloud save restored to this device. Reopen the game to use it. You can undo the last local restore below.';
  }));
  $('cloud-delete').addEventListener('click', () => void perform(async () => {
    const id = await currentUser(), existing = await readCloud(id);
    if (!existing) { cloudStatus.textContent = 'No cloud save exists for this account.'; return; }
    if (!confirm(`Permanently delete cloud revision ${existing.revision}? Local game data is not deleted.`)) { cloudStatus.textContent = 'No changes made.'; return; }
    await sameUser(id);
    const { data, error } = await auth.from('overtake_cloud_saves').delete().eq('user_id', id).eq('save_id', existing.save_id).eq('revision', existing.revision).select('revision').maybeSingle();
    if (error) throw new Error('Could not delete the cloud save. Please try again.');
    if (!data) throw new Error('Cloud save changed on another device. Nothing was deleted; try again.');
    cloudStatus.textContent = 'Cloud save deleted. Local game data was not changed.';
  }));

  signout.addEventListener('click', async () => {
    signout.disabled = true;
    try {
      const { error } = await auth.auth.signOut();
      status.textContent = error ? 'Could not sign out. Please try again.' : 'Signed out.';
    } catch { status.textContent = 'Could not sign out. Please try again.'; }
    signout.disabled = false;
  });
}

void initAccount();
