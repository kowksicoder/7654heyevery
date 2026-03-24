do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'profile_verification_proof_status'
  ) then
    create type public.profile_verification_proof_status as enum (
      'not_started',
      'failed',
      'verified'
    );
  end if;
end
$$;

alter table public.profile_social_accounts
  add column if not exists avatar_url text,
  add column if not exists linked_at timestamptz not null default timezone('utc', now()),
  add column if not exists last_verified_at timestamptz;

alter table public.profile_verification_requests
  add column if not exists proof_status public.profile_verification_proof_status not null default 'not_started',
  add column if not exists proof_post_url text,
  add column if not exists proof_post_id text,
  add column if not exists proof_posted_text text,
  add column if not exists proof_provider_user_id text,
  add column if not exists proof_handle text,
  add column if not exists proof_error text,
  add column if not exists proof_checked_at timestamptz,
  add column if not exists proof_verified_at timestamptz;

create unique index if not exists profile_social_accounts_provider_user_id_unique
  on public.profile_social_accounts (provider, provider_user_id)
  where provider_user_id is not null;

create or replace function public.list_profile_social_accounts(
  input_profile_id uuid
)
returns table (
  id uuid,
  provider text,
  provider_user_id text,
  handle text,
  display_name text,
  profile_url text,
  avatar_url text,
  is_primary boolean,
  is_verified boolean,
  linked_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if input_profile_id is null then
    return;
  end if;

  return query
  select
    account.id,
    account.provider::text,
    account.provider_user_id,
    account.handle,
    account.display_name,
    account.profile_url,
    account.avatar_url,
    account.is_primary,
    account.is_verified,
    account.linked_at,
    account.last_verified_at,
    account.created_at
  from public.profile_social_accounts account
  where account.profile_id = input_profile_id
  order by
    account.is_primary desc,
    account.is_verified desc,
    account.created_at desc;
end;
$$;

create or replace function public.sync_profile_social_account(
  input_profile_id uuid,
  input_provider text,
  input_handle text,
  input_provider_user_id text default null,
  input_display_name text default null,
  input_profile_url text default null,
  input_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.profiles%rowtype;
  target_account public.profile_social_accounts%rowtype;
  normalized_provider public.social_account_provider;
  normalized_handle text;
  normalized_provider_user_id text := nullif(trim(input_provider_user_id), '');
  normalized_display_name text := nullif(trim(input_display_name), '');
  normalized_profile_url text := nullif(trim(input_profile_url), '');
  normalized_avatar_url text := nullif(trim(input_avatar_url), '');
begin
  if input_profile_id is null then
    raise exception 'Profile is required.'
      using errcode = '23502';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = input_profile_id
  limit 1;

  if not found then
    raise exception 'Profile not found.'
      using errcode = 'P0002';
  end if;

  begin
    normalized_provider := lower(trim(coalesce(input_provider, '')))::public.social_account_provider;
  exception
    when others then
      raise exception 'Unsupported social provider.'
        using errcode = '22P02';
  end;

  normalized_handle := lower(trim(coalesce(input_handle, '')));
  normalized_handle := regexp_replace(normalized_handle, '^@+', '');
  normalized_handle := regexp_replace(normalized_handle, '\s+', '', 'g');

  if normalized_handle = '' then
    raise exception 'Social handle is required.'
      using errcode = '23502';
  end if;

  if normalized_provider_user_id is not null then
    select *
    into target_account
    from public.profile_social_accounts
    where provider = normalized_provider
      and provider_user_id = normalized_provider_user_id
    limit 1;
  end if;

  if target_account.id is null then
    select *
    into target_account
    from public.profile_social_accounts
    where provider = normalized_provider
      and handle = normalized_handle
    limit 1;
  end if;

  if target_account.id is not null and target_account.profile_id <> target_profile.id then
    raise exception 'This social account is already linked to another profile.'
      using errcode = '23505';
  end if;

  if target_account.id is null then
    insert into public.profile_social_accounts (
      profile_id,
      provider,
      provider_user_id,
      handle,
      display_name,
      profile_url,
      avatar_url,
      is_primary,
      metadata
    )
    values (
      target_profile.id,
      normalized_provider,
      normalized_provider_user_id,
      normalized_handle,
      coalesce(
        normalized_display_name,
        target_profile.display_name,
        target_profile.username,
        normalized_handle
      ),
      normalized_profile_url,
      normalized_avatar_url,
      true,
      jsonb_build_object(
        'linkedVia', 'privy',
        'oauthLinked', true
      )
    )
    returning *
    into target_account;
  else
    update public.profile_social_accounts
    set
      provider_user_id = coalesce(normalized_provider_user_id, provider_user_id),
      handle = normalized_handle,
      display_name = coalesce(
        normalized_display_name,
        target_profile.display_name,
        display_name
      ),
      profile_url = coalesce(normalized_profile_url, profile_url),
      avatar_url = coalesce(normalized_avatar_url, avatar_url),
      linked_at = timezone('utc', now()),
      is_primary = true,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'linkedVia', 'privy',
        'oauthLinked', true
      )
    where id = target_account.id
    returning *
    into target_account;
  end if;

  return jsonb_build_object(
    'id', target_account.id,
    'provider', target_account.provider::text,
    'providerUserId', target_account.provider_user_id,
    'handle', target_account.handle,
    'displayName', target_account.display_name,
    'profileUrl', target_account.profile_url,
    'avatarUrl', target_account.avatar_url,
    'isPrimary', target_account.is_primary,
    'isVerified', target_account.is_verified,
    'linkedAt', target_account.linked_at,
    'lastVerifiedAt', target_account.last_verified_at
  );
end;
$$;

drop function if exists public.list_profile_verification_requests(uuid);

create function public.list_profile_verification_requests(
  input_profile_id uuid
)
returns table (
  id uuid,
  provider text,
  claimed_handle text,
  verification_code text,
  category text,
  note text,
  admin_note text,
  status text,
  proof_status text,
  proof_post_url text,
  proof_post_id text,
  proof_posted_text text,
  proof_handle text,
  proof_error text,
  proof_checked_at timestamptz,
  proof_verified_at timestamptz,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if input_profile_id is null then
    return;
  end if;

  return query
  select
    request.id,
    request.provider::text,
    request.claimed_handle,
    request.verification_code,
    request.category,
    request.note,
    request.admin_note,
    request.status::text,
    request.proof_status::text,
    request.proof_post_url,
    request.proof_post_id,
    request.proof_posted_text,
    request.proof_handle,
    request.proof_error,
    request.proof_checked_at,
    request.proof_verified_at,
    request.created_at,
    request.reviewed_at
  from public.profile_verification_requests request
  where request.profile_id = input_profile_id
  order by request.created_at desc;
end;
$$;

drop function if exists public.list_staff_verification_requests(text, text, integer, integer);

create function public.list_staff_verification_requests(
  input_session_token text,
  input_status text default null,
  input_limit integer default 100,
  input_offset integer default 0
)
returns table (
  id uuid,
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  wallet_address text,
  provider text,
  claimed_handle text,
  verification_code text,
  category text,
  note text,
  admin_note text,
  status text,
  proof_status text,
  proof_post_url text,
  proof_post_id text,
  proof_posted_text text,
  proof_handle text,
  proof_error text,
  proof_checked_at timestamptz,
  proof_verified_at timestamptz,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_admin_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_record record;
  normalized_status public.profile_verification_status;
begin
  select *
  into actor_record
  from public.get_staff_admin_session(input_session_token);

  if nullif(trim(coalesce(input_status, '')), '') is not null then
    begin
      normalized_status := lower(trim(input_status))::public.profile_verification_status;
    exception
      when others then
        raise exception 'Unsupported verification status filter.'
          using errcode = '22P02';
    end;
  end if;

  return query
  select
    request.id,
    request.profile_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    profile.wallet_address,
    request.provider::text,
    request.claimed_handle,
    request.verification_code,
    request.category,
    request.note,
    request.admin_note,
    request.status::text,
    request.proof_status::text,
    request.proof_post_url,
    request.proof_post_id,
    request.proof_posted_text,
    request.proof_handle,
    request.proof_error,
    request.proof_checked_at,
    request.proof_verified_at,
    request.created_at,
    request.reviewed_at,
    reviewer.display_name
  from public.profile_verification_requests request
  inner join public.profiles profile
    on profile.id = request.profile_id
  left join public.staff_admin_accounts reviewer
    on reviewer.id = request.reviewed_by_admin_id
  where normalized_status is null
    or request.status = normalized_status
  order by
    case when request.status = 'pending' then 0 else 1 end,
    case when request.proof_status = 'verified' then 0 else 1 end,
    request.created_at desc
  limit greatest(coalesce(input_limit, 100), 1)
  offset greatest(coalesce(input_offset, 0), 0);
end;
$$;

create or replace function public.complete_profile_verification_proof(
  input_request_id uuid,
  input_provider_user_id text default null,
  input_proof_handle text default null,
  input_proof_post_url text default null,
  input_proof_post_id text default null,
  input_proof_post_text text default null,
  input_display_name text default null,
  input_profile_url text default null,
  input_avatar_url text default null,
  input_verified boolean default false,
  input_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.profile_verification_requests%rowtype;
  target_profile public.profiles%rowtype;
  target_social public.profile_social_accounts%rowtype;
  normalized_handle text := nullif(lower(trim(coalesce(input_proof_handle, ''))), '');
  normalized_provider_user_id text := nullif(trim(input_provider_user_id), '');
  normalized_post_url text := nullif(trim(input_proof_post_url), '');
  normalized_post_id text := nullif(trim(input_proof_post_id), '');
  normalized_post_text text := nullif(trim(input_proof_post_text), '');
  normalized_display_name text := nullif(trim(input_display_name), '');
  normalized_profile_url text := nullif(trim(input_profile_url), '');
  normalized_avatar_url text := nullif(trim(input_avatar_url), '');
  normalized_error text := nullif(trim(input_error), '');
  notification_id uuid;
begin
  if input_request_id is null then
    raise exception 'Verification request is required.'
      using errcode = '23502';
  end if;

  select *
  into target_request
  from public.profile_verification_requests
  where id = input_request_id
  limit 1;

  if not found then
    raise exception 'Verification request not found.'
      using errcode = 'P0002';
  end if;

  if target_request.status not in ('pending', 'verified') then
    raise exception 'Only pending verification requests can accept proof.'
      using errcode = '22023';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = target_request.profile_id
  limit 1;

  if normalized_handle is null then
    normalized_handle := target_request.claimed_handle;
  else
    normalized_handle := regexp_replace(normalized_handle, '^@+', '');
    normalized_handle := regexp_replace(normalized_handle, '\s+', '', 'g');
  end if;

  select *
  into target_social
  from public.profile_social_accounts
  where id = target_request.social_account_id
  limit 1;

  if target_social.id is null and normalized_provider_user_id is not null then
    select *
    into target_social
    from public.profile_social_accounts
    where provider = target_request.provider
      and provider_user_id = normalized_provider_user_id
    limit 1;
  end if;

  if target_social.id is null then
    select *
    into target_social
    from public.profile_social_accounts
    where provider = target_request.provider
      and handle = normalized_handle
    limit 1;
  end if;

  if target_social.id is not null and target_social.profile_id <> target_request.profile_id then
    raise exception 'This social account is already linked to another profile.'
      using errcode = '23505';
  end if;

  if target_social.id is null then
    insert into public.profile_social_accounts (
      profile_id,
      provider,
      provider_user_id,
      handle,
      display_name,
      profile_url,
      avatar_url,
      is_primary,
      is_verified,
      linked_at,
      last_verified_at,
      metadata
    )
    values (
      target_request.profile_id,
      target_request.provider,
      normalized_provider_user_id,
      normalized_handle,
      coalesce(normalized_display_name, target_profile.display_name, normalized_handle),
      normalized_profile_url,
      normalized_avatar_url,
      true,
      input_verified,
      timezone('utc', now()),
      case when input_verified then timezone('utc', now()) else null end,
      jsonb_build_object(
        'linkedVia', 'x-proof',
        'proofPostId', normalized_post_id
      )
    )
    returning *
    into target_social;
  else
    update public.profile_social_accounts
    set
      provider_user_id = coalesce(normalized_provider_user_id, provider_user_id),
      handle = coalesce(normalized_handle, handle),
      display_name = coalesce(normalized_display_name, display_name),
      profile_url = coalesce(normalized_profile_url, profile_url),
      avatar_url = coalesce(normalized_avatar_url, avatar_url),
      is_primary = true,
      is_verified = case when input_verified then true else is_verified end,
      linked_at = coalesce(linked_at, timezone('utc', now())),
      last_verified_at = case
        when input_verified then timezone('utc', now())
        else last_verified_at
      end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'linkedVia', 'x-proof',
        'proofPostId', normalized_post_id
      )
    where id = target_social.id
    returning *
    into target_social;
  end if;

  update public.profile_verification_requests
  set
    social_account_id = target_social.id,
    proof_status = case
      when input_verified then 'verified'::public.profile_verification_proof_status
      else 'failed'::public.profile_verification_proof_status
    end,
    proof_post_url = normalized_post_url,
    proof_post_id = normalized_post_id,
    proof_posted_text = normalized_post_text,
    proof_provider_user_id = normalized_provider_user_id,
    proof_handle = normalized_handle,
    proof_error = case when input_verified then null else normalized_error end,
    proof_checked_at = timezone('utc', now()),
    proof_verified_at = case
      when input_verified then timezone('utc', now())
      else null
    end,
    status = case
      when input_verified then 'verified'::public.profile_verification_status
      else status
    end,
    reviewed_at = case
      when input_verified then timezone('utc', now())
      else reviewed_at
    end,
    admin_note = case
      when input_verified then coalesce(admin_note, 'Verified automatically through linked X proof.')
      else admin_note
    end,
    reviewed_by_admin_id = case
      when input_verified then null
      else reviewed_by_admin_id
    end
  where id = target_request.id
  returning *
  into target_request;

  if input_verified then
    update public.profile_verification_requests
    set
      status = 'rejected',
      admin_note = coalesce(admin_note, 'Superseded after automated proof verification.'),
      reviewed_at = coalesce(reviewed_at, timezone('utc', now()))
    where profile_id = target_request.profile_id
      and id <> target_request.id
      and status = 'pending';

    update public.profiles
    set
      verification_status = 'verified',
      verification_category = coalesce(target_request.category, verification_category),
      verified_at = timezone('utc', now()),
      verified_by_admin_id = null,
      verification_note = coalesce(
        verification_note,
        'Verified automatically through linked X proof.'
      )
    where id = target_request.profile_id
    returning *
    into target_profile;

    notification_id := public.create_notification(
      target_request.profile_id,
      null,
      'verification',
      'Official creator approved',
      'Your account is now verified through your linked X proof post.',
      null,
      null,
      jsonb_build_object(
        'eventType', 'verification_auto_approved',
        'provider', target_request.provider::text,
        'proofPostId', normalized_post_id,
        'requestId', target_request.id
      )
    );
  end if;

  return jsonb_build_object(
    'id', target_request.id,
    'status', target_request.status::text,
    'proofStatus', target_request.proof_status::text,
    'proofPostUrl', target_request.proof_post_url,
    'proofPostId', target_request.proof_post_id,
    'proofPostedText', target_request.proof_posted_text,
    'proofHandle', target_request.proof_handle,
    'proofError', target_request.proof_error,
    'proofCheckedAt', target_request.proof_checked_at,
    'proofVerifiedAt', target_request.proof_verified_at,
    'notificationId', notification_id
  );
end;
$$;

grant execute on function public.list_profile_social_accounts(uuid) to anon, authenticated;
grant execute on function public.sync_profile_social_account(uuid, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.list_profile_verification_requests(uuid) to anon, authenticated;
grant execute on function public.list_staff_verification_requests(text, text, integer, integer) to anon, authenticated;
grant execute on function public.complete_profile_verification_proof(uuid, text, text, text, text, text, text, text, text, boolean, text) to service_role;
