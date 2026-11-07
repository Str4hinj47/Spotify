import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('cloud save migration enforces per-user RLS, column privileges and revisions', async()=>{
  const db=new PGlite();
  const alice='11111111-1111-4111-8111-111111111111', bob='22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create table auth.users(id uuid primary key); insert into auth.users values ('${alice}'), ('${bob}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261108000000_overtake_cloud_saves.sql',import.meta.url),'utf8'));
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}';`);
    const inserted=await db.query(`insert into public.overtake_cloud_saves(user_id,payload) values ($1,'{"schema":1}') returning revision`,[alice]);assert.equal(inserted.rows[0].revision,1);
    await assert.rejects(db.query(`insert into public.overtake_cloud_saves(user_id,payload) values ($1,'{}')`,[bob]));
    const update=await db.query(`update public.overtake_cloud_saves set payload='{"schema":1,"n":2}' where user_id=$1 and revision=1 returning revision`,[alice]);assert.equal(update.rows[0].revision,2);
    assert.equal((await db.query(`update public.overtake_cloud_saves set payload='{}' where user_id=$1 and revision=1 returning revision`,[alice])).rows.length,0);
    await assert.rejects(db.query(`update public.overtake_cloud_saves set revision=999 where user_id=$1`,[alice]));
    await assert.rejects(db.query(`update public.overtake_cloud_saves set payload=$1 where user_id=$2`,[JSON.stringify({huge:'x'.repeat(132000)}),alice]));
    await db.exec(`set request.jwt.claim.sub='${bob}';`);
    assert.equal((await db.query('select * from public.overtake_cloud_saves')).rows.length,0);
    assert.equal((await db.query(`update public.overtake_cloud_saves set payload='{}' where user_id=$1 returning *`,[alice])).rows.length,0);
    assert.equal((await db.query(`delete from public.overtake_cloud_saves where user_id=$1 returning *`,[alice])).rows.length,0);
    await db.exec('set role anon');await assert.rejects(db.query('select * from public.overtake_cloud_saves'));
    await db.exec(`reset role; delete from auth.users where id='${alice}';`);
    assert.equal((await db.query('select * from public.overtake_cloud_saves')).rows.length,0);
  } finally { await db.close(); }
});
