create table if not exists public.staff_admin_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  password_hash text not null,
  is_active boolean not null default true,
  created_by_admin_id uuid references public.staff_admin_accounts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint staff_admin_accounts_email_lowercase check (email = lower(email))
);

create table if not exists public.staff_admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.staff_admin_accounts (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists staff_admin_sessions_admin_id_idx
  on public.staff_admin_sessions (admin_id, created_at desc);

create index if not exists staff_admin_sessions_active_idx
  on public.staff_admin_sessions (expires_at desc)
  where revoked_at is null;

drop trigger if exists set_staff_admin_accounts_updated_at on public.staff_admin_accounts;
create trigger set_staff_admin_accounts_updated_at
  before update on public.staff_admin_accounts
  for each row execute function public.set_updated_at();

insert into public.staff_admin_accounts (
  email,
  display_name,
  password_hash,
  is_active
)
values
  (
    'bloombetgaming@gmail.com',
    'BloomBet Admin',
    crypt('@Admin1234', gen_salt('bf')),
    true
  ),
  (
    'oxplaymedia@gmail.com',
    'OxPlay Admin',
    crypt('@Admin1234', gen_salt('bf')),
    true
  )
on conflict (email) do nothing;

create or replace function public.get_staff_admin_session(
  input_session_token text
)
returns table (
  admin_id uuid,
  email text,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_token text := nullif(trim(input_session_token), '');
  session_hash text;
begin
  if normalized_token is null then
    raise exception 'Admin session required.'
      using errcode = '42501';
  end if;

  session_hash := encode(digest(normalized_token, 'sha256'), 'hex');

  update public.staff_admin_sessions
  set last_seen_at = timezone('utc', now())
  where token_hash = session_hash
    and revoked_at is null
    and expires_at > timezone('utc', now());

  return query
  select
    admin.id,
    admin.email,
    admin.display_name
  from public.staff_admin_sessions session
  inner join public.staff_admin_accounts admin
    on admin.id = session.admin_id
  where session.token_hash = session_hash
    and session.revoked_at is null
    and session.expires_at > timezone('utc', now())
    and admin.is_active = true
  limit 1;

  if not found then
    raise exception 'Invalid admin session.'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.staff_admin_sign_in(
  input_email text,
  input_password text
)
returns table (
  admin_id uuid,
  email text,
  display_name text,
  session_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record public.staff_admin_accounts%rowtype;
  plain_token text;
begin
  select *
  into admin_record
  from public.staff_admin_accounts
  where email = lower(trim(coalesce(input_email, '')))
    and is_active = true
  limit 1;

  if not found then
    raise exception 'Invalid admin credentials.'
      using errcode = '28000';
  end if;

  if crypt(coalesce(input_password, ''), admin_record.password_hash) <> admin_record.password_hash then
    raise exception 'Invalid admin credentials.'
      using errcode = '28000';
  end if;

  plain_token := encode(gen_random_bytes(32), 'hex');

  insert into public.staff_admin_sessions (
    admin_id,
    token_hash,
    expires_at
  )
  values (
    admin_record.id,
    encode(digest(plain_token, 'sha256'), 'hex'),
    timezone('utc', now()) + interval '30 days'
  );

  return query
  select
    admin_record.id,
    admin_record.email,
    admin_record.display_name,
    plain_token;
end;
$$;

create or replace function public.staff_admin_sign_out(
  input_session_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_token text := nullif(trim(input_session_token), '');
  revoked_count integer := 0;
begin
  if normalized_token is null then
    return false;
  end if;

  update public.staff_admin_sessions
  set revoked_at = timezone('utc', now())
  where token_hash = encode(digest(normalized_token, 'sha256'), 'hex')
    and revoked_at is null;

  get diagnostics revoked_count = row_count;

  return revoked_count > 0;
end;
$$;

create or replace function public.list_staff_admin_accounts(
  input_session_token text
)
returns table (
  id uuid,
  email text,
  display_name text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select
    admin.id,
    admin.email,
    admin.display_name,
    admin.is_active,
    admin.created_at
  from public.staff_admin_accounts admin
  order by admin.is_active desc, admin.created_at asc;
end;
$$;

create or replace function public.staff_add_admin_account(
  input_session_token text,
  input_email text,
  input_password text,
  input_display_name text default null
)
returns table (
  id uuid,
  email text,
  display_name text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_record record;
  normalized_email text := lower(trim(coalesce(input_email, '')));
begin
  select *
  into actor_record
  from public.get_staff_admin_session(input_session_token)
  limit 1;

  if normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'A valid admin email is required.';
  end if;

  if char_length(coalesce(input_password, '')) < 8 then
    raise exception 'Admin password must be at least 8 characters.';
  end if;

  insert into public.staff_admin_accounts (
    email,
    display_name,
    password_hash,
    is_active,
    created_by_admin_id
  )
  values (
    normalized_email,
    nullif(trim(input_display_name), ''),
    crypt(input_password, gen_salt('bf')),
    true,
    actor_record.admin_id
  )
  on conflict (email) do update
    set
      display_name = coalesce(excluded.display_name, public.staff_admin_accounts.display_name),
      password_hash = excluded.password_hash,
      is_active = true
  returning
    staff_admin_accounts.id,
    staff_admin_accounts.email,
    staff_admin_accounts.display_name,
    staff_admin_accounts.is_active,
    staff_admin_accounts.created_at;
end;
$$;

revoke execute on function public.get_staff_dashboard() from anon, authenticated;
revoke execute on function public.list_staff_users(text, integer, integer) from anon, authenticated;
revoke execute on function public.list_staff_profile_launches(uuid) from anon, authenticated;
revoke execute on function public.list_staff_coin_launches(text, integer, integer) from anon, authenticated;
revoke execute on function public.list_staff_referrals(integer, integer) from anon, authenticated;
revoke execute on function public.list_staff_earnings(integer, integer) from anon, authenticated;
revoke execute on function public.list_staff_e1xp_activity(integer, integer) from anon, authenticated;
revoke execute on function public.list_staff_missions() from anon, authenticated;
revoke execute on function public.list_staff_showcase_posts() from anon, authenticated;
revoke execute on function public.list_staff_creators(text, integer, integer) from anon, authenticated;
revoke execute on function public.staff_upsert_external_profile(text, text, text, text, text, text, text, text) from anon, authenticated;
revoke execute on function public.staff_set_profile_moderation(uuid, boolean, boolean, text, text) from anon, authenticated;
revoke execute on function public.staff_delete_profile(uuid) from anon, authenticated;
revoke execute on function public.staff_set_coin_launch_override(uuid, boolean, integer, text, text) from anon, authenticated;
revoke execute on function public.staff_set_creator_override(uuid, boolean, integer, text, text) from anon, authenticated;
revoke execute on function public.staff_grant_e1xp(uuid, integer, text, text, jsonb, uuid) from anon, authenticated;
revoke execute on function public.staff_upsert_showcase_post(uuid, text, text, text, text, text, date, jsonb, text, text, text, boolean, integer, uuid) from anon, authenticated;
revoke execute on function public.staff_delete_showcase_post(uuid) from anon, authenticated;

create or replace function public.get_staff_dashboard(
  input_session_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.get_staff_dashboard();
end;
$$;

create or replace function public.list_staff_users(
  input_session_token text,
  input_search text default null,
  input_limit integer default 40,
  input_offset integer default 0
)
returns table (
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  wallet_address text,
  zora_handle text,
  created_at timestamptz,
  launches_count bigint,
  referrals_count bigint,
  total_e1xp bigint,
  is_hidden boolean,
  is_blocked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_users(input_search, input_limit, input_offset);
end;
$$;

create or replace function public.list_staff_profile_launches(
  input_session_token text,
  input_profile_id uuid
)
returns table (
  launch_id uuid,
  ticker text,
  name text,
  status text,
  coin_address text,
  created_at timestamptz,
  launched_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_profile_launches(input_profile_id);
end;
$$;

create or replace function public.list_staff_coin_launches(
  input_session_token text,
  input_search text default null,
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  launch_id uuid,
  creator_id uuid,
  creator_name text,
  creator_username text,
  ticker text,
  name text,
  status text,
  coin_address text,
  cover_image_url text,
  created_at timestamptz,
  launched_at timestamptz,
  is_hidden boolean,
  pinned_slot integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_coin_launches(input_search, input_limit, input_offset);
end;
$$;

create or replace function public.list_staff_referrals(
  input_session_token text,
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  referral_event_id uuid,
  referrer_name text,
  referrer_username text,
  referred_name text,
  referred_username text,
  referred_wallet text,
  status text,
  reward_e1xp bigint,
  referred_trade_count bigint,
  joined_at timestamptz,
  rewarded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_referrals(input_limit, input_offset);
end;
$$;

create or replace function public.list_staff_earnings(
  input_session_token text,
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  item_kind text,
  item_id text,
  profile_name text,
  profile_username text,
  wallet_address text,
  amount numeric,
  currency text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_earnings(input_limit, input_offset);
end;
$$;

create or replace function public.list_staff_e1xp_activity(
  input_session_token text,
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  ledger_id uuid,
  profile_id uuid,
  profile_name text,
  profile_username text,
  wallet_address text,
  amount bigint,
  source text,
  description text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_e1xp_activity(input_limit, input_offset);
end;
$$;

create or replace function public.list_staff_missions(
  input_session_token text
)
returns table (
  mission_id uuid,
  slug text,
  title text,
  status text,
  reward_e1xp bigint,
  task_count bigint,
  participant_count bigint,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_missions();
end;
$$;

create or replace function public.list_staff_showcase_posts(
  input_session_token text
)
returns table (
  id uuid,
  slug text,
  category text,
  title text,
  description text,
  read_time text,
  published_at date,
  content jsonb,
  cover_class_name text,
  pill_class_name text,
  icon_key text,
  is_published boolean,
  sort_order integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_showcase_posts();
end;
$$;

create or replace function public.list_staff_creators(
  input_session_token text,
  input_search text default null,
  input_limit integer default 40,
  input_offset integer default 0
)
returns table (
  profile_id uuid,
  display_name text,
  username text,
  wallet_address text,
  avatar_url text,
  launches_count bigint,
  total_e1xp bigint,
  is_hidden boolean,
  featured_order integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select *
  from public.list_staff_creators(input_search, input_limit, input_offset);
end;
$$;

create or replace function public.staff_upsert_external_profile(
  input_session_token text,
  input_wallet_address text default null,
  input_lens_account_address text default null,
  input_username text default null,
  input_display_name text default null,
  input_bio text default null,
  input_avatar_url text default null,
  input_banner_url text default null,
  input_zora_handle text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.staff_upsert_external_profile(
    input_wallet_address,
    input_lens_account_address,
    input_username,
    input_display_name,
    input_bio,
    input_avatar_url,
    input_banner_url,
    input_zora_handle
  );
end;
$$;

create or replace function public.staff_set_profile_moderation(
  input_session_token text,
  input_profile_id uuid,
  input_is_hidden boolean default false,
  input_is_blocked boolean default false,
  input_note text default null,
  input_updated_by_wallet text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.staff_set_profile_moderation(
    input_profile_id,
    input_is_hidden,
    input_is_blocked,
    input_note,
    input_updated_by_wallet
  );
end;
$$;

create or replace function public.staff_delete_profile(
  input_session_token text,
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.staff_delete_profile(input_profile_id);
end;
$$;

create or replace function public.staff_set_coin_launch_override(
  input_session_token text,
  input_launch_id uuid,
  input_is_hidden boolean default false,
  input_pinned_slot integer default null,
  input_note text default null,
  input_updated_by_wallet text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.staff_set_coin_launch_override(
    input_launch_id,
    input_is_hidden,
    input_pinned_slot,
    input_note,
    input_updated_by_wallet
  );
end;
$$;

create or replace function public.staff_set_creator_override(
  input_session_token text,
  input_profile_id uuid,
  input_is_hidden boolean default false,
  input_featured_order integer default null,
  input_note text default null,
  input_updated_by_wallet text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.staff_set_creator_override(
    input_profile_id,
    input_is_hidden,
    input_featured_order,
    input_note,
    input_updated_by_wallet
  );
end;
$$;

create or replace function public.staff_grant_e1xp(
  input_session_token text,
  input_profile_id uuid,
  input_amount integer,
  input_description text default null,
  input_source_key text default null,
  input_metadata jsonb default '{}'::jsonb,
  input_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.staff_grant_e1xp(
    input_profile_id,
    input_amount,
    input_description,
    input_source_key,
    input_metadata,
    input_actor_profile_id
  );
end;
$$;

create or replace function public.staff_upsert_showcase_post(
  input_session_token text,
  input_id uuid default null,
  input_slug text default null,
  input_category text default null,
  input_title text default null,
  input_description text default null,
  input_read_time text default '3 min read',
  input_published_at date default current_date,
  input_content jsonb default '[]'::jsonb,
  input_cover_class_name text default null,
  input_pill_class_name text default null,
  input_icon_key text default 'document',
  input_is_published boolean default true,
  input_sort_order integer default 0,
  input_updated_by_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.staff_upsert_showcase_post(
    input_id,
    input_slug,
    input_category,
    input_title,
    input_description,
    input_read_time,
    input_published_at,
    input_content,
    input_cover_class_name,
    input_pill_class_name,
    input_icon_key,
    input_is_published,
    input_sort_order,
    input_updated_by_profile_id
  );
end;
$$;

create or replace function public.staff_delete_showcase_post(
  input_session_token text,
  input_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return public.staff_delete_showcase_post(input_id);
end;
$$;

grant execute on function public.staff_admin_sign_in(text, text) to anon, authenticated;
grant execute on function public.get_staff_admin_session(text) to anon, authenticated;
grant execute on function public.staff_admin_sign_out(text) to anon, authenticated;
grant execute on function public.list_staff_admin_accounts(text) to anon, authenticated;
grant execute on function public.staff_add_admin_account(text, text, text, text) to anon, authenticated;
grant execute on function public.get_staff_dashboard(text) to anon, authenticated;
grant execute on function public.list_staff_users(text, text, integer, integer) to anon, authenticated;
grant execute on function public.list_staff_profile_launches(text, uuid) to anon, authenticated;
grant execute on function public.list_staff_coin_launches(text, text, integer, integer) to anon, authenticated;
grant execute on function public.list_staff_referrals(text, integer, integer) to anon, authenticated;
grant execute on function public.list_staff_earnings(text, integer, integer) to anon, authenticated;
grant execute on function public.list_staff_e1xp_activity(text, integer, integer) to anon, authenticated;
grant execute on function public.list_staff_missions(text) to anon, authenticated;
grant execute on function public.list_staff_showcase_posts(text) to anon, authenticated;
grant execute on function public.list_staff_creators(text, text, integer, integer) to anon, authenticated;
grant execute on function public.staff_upsert_external_profile(text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.staff_set_profile_moderation(text, uuid, boolean, boolean, text, text) to anon, authenticated;
grant execute on function public.staff_delete_profile(text, uuid) to anon, authenticated;
grant execute on function public.staff_set_coin_launch_override(text, uuid, boolean, integer, text, text) to anon, authenticated;
grant execute on function public.staff_set_creator_override(text, uuid, boolean, integer, text, text) to anon, authenticated;
grant execute on function public.staff_grant_e1xp(text, uuid, integer, text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.staff_upsert_showcase_post(text, uuid, text, text, text, text, text, date, jsonb, text, text, text, boolean, integer, uuid) to anon, authenticated;
grant execute on function public.staff_delete_showcase_post(text, uuid) to anon, authenticated;
