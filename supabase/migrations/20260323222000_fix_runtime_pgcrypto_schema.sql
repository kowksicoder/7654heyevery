create extension if not exists pgcrypto with schema extensions;

create or replace function public.ensure_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_code text;
  candidate_code text;
begin
  if exists (
    select 1
    from public.referral_codes code
    where code.profile_id = new.id
  ) then
    return new;
  end if;

  base_code := upper(
    regexp_replace(
      coalesce(new.username, split_part(new.id::text, '-', 1)),
      '[^a-zA-Z0-9]',
      '',
      'g'
    )
  );
  base_code := left(coalesce(nullif(base_code, ''), 'E1USER'), 8);
  candidate_code := base_code;

  while exists (
    select 1
    from public.referral_codes code
    where code.code = candidate_code
  ) loop
    candidate_code := left(base_code, 8)
      || upper(substr(encode(extensions.gen_random_bytes(2), 'hex'), 1, 4));
  end loop;

  insert into public.referral_codes (profile_id, code)
  values (new.id, candidate_code)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

create or replace function public.generate_profile_verification_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  loop
    generated_code :=
      'EV1-' ||
      substr(upper(encode(extensions.gen_random_bytes(4), 'hex')), 1, 8);

    exit when not exists (
      select 1
      from public.profile_verification_requests
      where verification_code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

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

  session_hash := encode(extensions.digest(normalized_token, 'sha256'), 'hex');

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
  select account.*
  into admin_record
  from public.staff_admin_accounts as account
  where account.email = lower(trim(coalesce(input_email, '')))
    and account.is_active = true
  limit 1;

  if not found then
    raise exception 'Invalid admin credentials.'
      using errcode = '28000';
  end if;

  if extensions.crypt(coalesce(input_password, ''), admin_record.password_hash) <> admin_record.password_hash then
    raise exception 'Invalid admin credentials.'
      using errcode = '28000';
  end if;

  plain_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.staff_admin_sessions (
    admin_id,
    token_hash,
    expires_at
  )
  values (
    admin_record.id,
    encode(extensions.digest(plain_token, 'sha256'), 'hex'),
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
  where token_hash = encode(extensions.digest(normalized_token, 'sha256'), 'hex')
    and revoked_at is null;

  get diagnostics revoked_count = row_count;

  return revoked_count > 0;
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
    extensions.crypt(input_password, extensions.gen_salt('bf')),
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
