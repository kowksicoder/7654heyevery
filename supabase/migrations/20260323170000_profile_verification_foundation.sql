do $$
begin
  if not exists (
    select 1
    from pg_type notification_type
    inner join pg_enum notification_enum
      on notification_enum.enumtypid = notification_type.oid
    where notification_type.typname = 'notification_kind'
      and notification_enum.enumlabel = 'verification'
  ) then
    alter type public.notification_kind add value 'verification';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'profile_verification_status'
  ) then
    create type public.profile_verification_status as enum (
      'unverified',
      'pending',
      'verified',
      'flagged',
      'rejected'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'social_account_provider'
  ) then
    create type public.social_account_provider as enum (
      'x',
      'instagram',
      'youtube',
      'tiktok',
      'other'
    );
  end if;
end
$$;

alter table public.profiles
  add column if not exists verification_status public.profile_verification_status not null default 'unverified',
  add column if not exists verification_category text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by_admin_id uuid references public.staff_admin_accounts (id) on delete set null,
  add column if not exists verification_note text;

create table if not exists public.profile_social_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider public.social_account_provider not null,
  provider_user_id text,
  handle text not null,
  display_name text,
  profile_url text,
  is_primary boolean not null default true,
  is_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_social_accounts_handle_lowercase check (handle = lower(handle)),
  constraint profile_social_accounts_provider_handle_unique unique (provider, handle)
);

create index if not exists profile_social_accounts_profile_id_idx
  on public.profile_social_accounts (profile_id, provider, created_at desc);

drop trigger if exists set_profile_social_accounts_updated_at on public.profile_social_accounts;
create trigger set_profile_social_accounts_updated_at
  before update on public.profile_social_accounts
  for each row execute function public.set_updated_at();

create table if not exists public.profile_verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  social_account_id uuid references public.profile_social_accounts (id) on delete set null,
  provider public.social_account_provider not null,
  claimed_handle text not null,
  verification_code text not null unique,
  category text,
  note text,
  admin_note text,
  status public.profile_verification_status not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by_admin_id uuid references public.staff_admin_accounts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_verification_requests_handle_lowercase check (claimed_handle = lower(claimed_handle))
);

create index if not exists profile_verification_requests_profile_id_idx
  on public.profile_verification_requests (profile_id, created_at desc);

create index if not exists profile_verification_requests_status_idx
  on public.profile_verification_requests (status, created_at desc);

drop trigger if exists set_profile_verification_requests_updated_at on public.profile_verification_requests;
create trigger set_profile_verification_requests_updated_at
  before update on public.profile_verification_requests
  for each row execute function public.set_updated_at();

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
      'EV1-' || substr(upper(encode(gen_random_bytes(4), 'hex')), 1, 8);

    exit when not exists (
      select 1
      from public.profile_verification_requests
      where verification_code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

create or replace function public.list_profile_verification_requests(
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
    request.created_at,
    request.reviewed_at
  from public.profile_verification_requests request
  where request.profile_id = input_profile_id
  order by request.created_at desc;
end;
$$;

create or replace function public.submit_profile_verification_request(
  input_profile_id uuid,
  input_provider text,
  input_claimed_handle text,
  input_category text default null,
  input_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.profiles%rowtype;
  social_account public.profile_social_accounts%rowtype;
  request_record public.profile_verification_requests%rowtype;
  normalized_provider public.social_account_provider;
  normalized_handle text;
  normalized_category text := nullif(trim(input_category), '');
  normalized_note text := nullif(trim(input_note), '');
  normalized_code text;
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

  normalized_handle := lower(trim(coalesce(input_claimed_handle, '')));
  normalized_handle := regexp_replace(normalized_handle, '^@+', '');
  normalized_handle := regexp_replace(normalized_handle, '\s+', '', 'g');

  if normalized_handle = '' then
    raise exception 'Social handle is required.'
      using errcode = '23502';
  end if;

  normalized_code := public.generate_profile_verification_code();

  insert into public.profile_social_accounts (
    profile_id,
    provider,
    handle,
    display_name,
    is_primary,
    is_verified,
    metadata
  )
  values (
    target_profile.id,
    normalized_provider,
    normalized_handle,
    coalesce(target_profile.display_name, target_profile.username, normalized_handle),
    true,
    false,
    jsonb_build_object('claimed', true)
  )
  on conflict (provider, handle) do nothing
  returning *
  into social_account;

  if social_account.id is null then
    select *
    into social_account
    from public.profile_social_accounts
    where provider = normalized_provider
      and handle = normalized_handle
    limit 1;

    if social_account.id is null then
      raise exception 'Unable to prepare the claimed social account.'
        using errcode = 'P0001';
    end if;

    if social_account.profile_id <> target_profile.id then
      raise exception 'This social handle is already linked to another profile.'
        using errcode = '23505';
    end if;

    update public.profile_social_accounts
    set
      display_name = coalesce(target_profile.display_name, display_name),
      is_primary = true,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('claimed', true)
    where id = social_account.id
    returning *
    into social_account;
  end if;

  update public.profile_verification_requests
  set
    status = 'rejected',
    admin_note = coalesce(admin_note, 'Superseded by a newer verification request.'),
    reviewed_at = timezone('utc', now())
  where profile_id = target_profile.id
    and provider = normalized_provider
    and status = 'pending';

  insert into public.profile_verification_requests (
    profile_id,
    social_account_id,
    provider,
    claimed_handle,
    verification_code,
    category,
    note,
    status
  )
  values (
    target_profile.id,
    social_account.id,
    normalized_provider,
    normalized_handle,
    normalized_code,
    normalized_category,
    normalized_note,
    'pending'
  )
  returning *
  into request_record;

  if target_profile.verification_status <> 'verified' then
    update public.profiles
    set
      verification_status = 'pending',
      verification_category = coalesce(normalized_category, verification_category),
      verification_note = coalesce(normalized_note, verification_note)
    where id = target_profile.id
    returning *
    into target_profile;
  end if;

  perform public.create_notification(
    target_profile.id,
    null,
    'verification',
    'Verification request received',
    'Your official creator request is now pending admin review.',
    null,
    null,
    jsonb_build_object(
      'category', normalized_category,
      'eventType', 'verification_request_submitted',
      'provider', normalized_provider::text,
      'requestId', request_record.id,
      'verificationCode', request_record.verification_code
    )
  );

  return jsonb_build_object(
    'id', request_record.id,
    'provider', request_record.provider::text,
    'claimedHandle', request_record.claimed_handle,
    'verificationCode', request_record.verification_code,
    'category', request_record.category,
    'note', request_record.note,
    'status', request_record.status::text,
    'createdAt', request_record.created_at,
    'reviewedAt', request_record.reviewed_at
  );
end;
$$;

create or replace function public.list_staff_verification_requests(
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
    request.created_at desc
  limit greatest(coalesce(input_limit, 100), 1)
  offset greatest(coalesce(input_offset, 0), 0);
end;
$$;

create or replace function public.staff_review_profile_verification_request(
  input_session_token text,
  input_request_id uuid,
  input_status text,
  input_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_record record;
  target_request public.profile_verification_requests%rowtype;
  target_profile public.profiles%rowtype;
  normalized_status public.profile_verification_status;
  normalized_note text := nullif(trim(input_admin_note), '');
  notification_id uuid;
begin
  select *
  into actor_record
  from public.get_staff_admin_session(input_session_token);

  if input_request_id is null then
    raise exception 'Verification request is required.'
      using errcode = '23502';
  end if;

  begin
    normalized_status := lower(trim(coalesce(input_status, '')))::public.profile_verification_status;
  exception
    when others then
      raise exception 'Unsupported verification review status.'
        using errcode = '22P02';
  end;

  if normalized_status not in ('verified', 'flagged', 'rejected') then
    raise exception 'Verification requests can only be reviewed as verified, flagged, or rejected.'
      using errcode = '22023';
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

  update public.profile_verification_requests
  set
    status = normalized_status,
    admin_note = coalesce(normalized_note, admin_note),
    reviewed_at = timezone('utc', now()),
    reviewed_by_admin_id = actor_record.admin_id
  where id = target_request.id
  returning *
  into target_request;

  if normalized_status = 'verified' then
    update public.profile_social_accounts
    set
      is_primary = true,
      is_verified = true
    where id = target_request.social_account_id;

    update public.profile_verification_requests
    set
      status = 'rejected',
      admin_note = coalesce(admin_note, 'Superseded after verification approval.'),
      reviewed_at = coalesce(reviewed_at, timezone('utc', now())),
      reviewed_by_admin_id = coalesce(reviewed_by_admin_id, actor_record.admin_id)
    where profile_id = target_request.profile_id
      and id <> target_request.id
      and status = 'pending';

    update public.profiles
    set
      verification_status = 'verified',
      verification_category = coalesce(target_request.category, verification_category),
      verified_at = timezone('utc', now()),
      verified_by_admin_id = actor_record.admin_id,
      verification_note = coalesce(normalized_note, verification_note)
    where id = target_request.profile_id
    returning *
    into target_profile;

    notification_id := public.create_notification(
      target_request.profile_id,
      null,
      'verification',
      'Official creator approved',
      'Your account now carries the official creator badge on Every1.',
      null,
      null,
      jsonb_build_object(
        'eventType', 'verification_approved',
        'provider', target_request.provider::text,
        'requestId', target_request.id
      )
    );
  elsif normalized_status = 'flagged' then
    update public.profiles
    set
      verification_status = case
        when verification_status = 'verified' then verification_status
        else 'flagged'
      end,
      verification_category = coalesce(target_request.category, verification_category),
      verification_note = coalesce(normalized_note, verification_note)
    where id = target_request.profile_id
    returning *
    into target_profile;

    notification_id := public.create_notification(
      target_request.profile_id,
      null,
      'verification',
      'Verification needs more review',
      'Your official creator request was flagged for additional review.',
      null,
      null,
      jsonb_build_object(
        'eventType', 'verification_flagged',
        'requestId', target_request.id
      )
    );
  else
    update public.profile_social_accounts
    set
      is_verified = false
    where id = target_request.social_account_id;

    update public.profiles
    set
      verification_status = case
        when verification_status = 'verified' then verification_status
        else 'unverified'
      end,
      verification_category = coalesce(target_request.category, verification_category),
      verification_note = coalesce(normalized_note, verification_note)
    where id = target_request.profile_id
    returning *
    into target_profile;

    notification_id := public.create_notification(
      target_request.profile_id,
      null,
      'verification',
      'Verification request declined',
      'Your official creator request was reviewed but not approved yet.',
      null,
      null,
      jsonb_build_object(
        'eventType', 'verification_rejected',
        'requestId', target_request.id
      )
    );
  end if;

  return jsonb_build_object(
    'id', target_request.id,
    'notificationId', notification_id,
    'note', coalesce(normalized_note, target_request.admin_note),
    'profileId', target_request.profile_id,
    'status', target_request.status::text
  );
end;
$$;

create or replace function public.upsert_external_profile(
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
declare
  normalized_wallet text := lower(nullif(trim(input_wallet_address), ''));
  normalized_lens text := lower(nullif(trim(input_lens_account_address), ''));
  normalized_username text := lower(
    regexp_replace(coalesce(input_username, ''), '[^a-zA-Z0-9_]', '', 'g')
  );
  normalized_display_name text := nullif(trim(input_display_name), '');
  normalized_bio text := nullif(trim(input_bio), '');
  normalized_avatar text := nullif(trim(input_avatar_url), '');
  normalized_banner text := nullif(trim(input_banner_url), '');
  normalized_zora_handle text := lower(nullif(trim(input_zora_handle), ''));
  lens_profile public.profiles%rowtype;
  wallet_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  created_profile boolean := false;
  ensured_code text;
  total_e1xp bigint;
begin
  if normalized_wallet is null and normalized_lens is null then
    raise exception 'A wallet or lens account address is required.';
  end if;

  if normalized_username = '' or char_length(normalized_username) < 3 then
    normalized_username := null;
  end if;

  if normalized_lens is not null then
    select *
    into lens_profile
    from public.profiles
    where lower(lens_account_address) = normalized_lens
    limit 1;
  end if;

  if normalized_wallet is not null then
    select *
    into wallet_profile
    from public.profiles
    where lower(wallet_address) = normalized_wallet
    limit 1;
  end if;

  if lens_profile.id is not null
    and wallet_profile.id is not null
    and lens_profile.id <> wallet_profile.id then
    raise exception 'Conflicting profile records found for the supplied identity.';
  end if;

  target_profile := coalesce(lens_profile, wallet_profile);

  if target_profile.id is null then
    insert into public.profiles (
      username,
      display_name,
      bio,
      avatar_url,
      banner_url,
      wallet_address,
      lens_account_address,
      zora_handle
    )
    values (
      normalized_username,
      normalized_display_name,
      normalized_bio,
      normalized_avatar,
      normalized_banner,
      normalized_wallet,
      normalized_lens,
      normalized_zora_handle
    )
    returning *
    into target_profile;

    created_profile := true;
  else
    update public.profiles
    set
      username = coalesce(normalized_username, username),
      display_name = coalesce(normalized_display_name, display_name),
      bio = coalesce(normalized_bio, bio),
      avatar_url = coalesce(normalized_avatar, avatar_url),
      banner_url = coalesce(normalized_banner, banner_url),
      wallet_address = coalesce(normalized_wallet, wallet_address),
      lens_account_address = coalesce(normalized_lens, lens_account_address),
      zora_handle = coalesce(normalized_zora_handle, zora_handle)
    where id = target_profile.id
    returning *
    into target_profile;
  end if;

  ensured_code := public.ensure_referral_code_for_profile(target_profile.id);

  if created_profile then
    perform public.create_notification(
      target_profile.id,
      null,
      'welcome',
      'Welcome to Every1',
      'Your profile is live. Start discovering creators, coins, rewards, and communities.',
      null,
      null,
      jsonb_build_object(
        'eventType', 'welcome',
        'profileId', target_profile.id,
        'username', target_profile.username
      )
    );
  end if;

  select coalesce(sum(ledger.amount), 0)::bigint
  into total_e1xp
  from public.e1xp_ledger ledger
  where ledger.profile_id = target_profile.id;

  return jsonb_build_object(
    'id', target_profile.id,
    'username', target_profile.username,
    'displayName', target_profile.display_name,
    'bio', target_profile.bio,
    'avatarUrl', target_profile.avatar_url,
    'bannerUrl', target_profile.banner_url,
    'walletAddress', target_profile.wallet_address,
    'lensAccountAddress', target_profile.lens_account_address,
    'zoraHandle', target_profile.zora_handle,
    'referralCode', ensured_code,
    'e1xpTotal', coalesce(total_e1xp, 0),
    'verificationStatus', target_profile.verification_status,
    'verificationCategory', target_profile.verification_category,
    'verifiedAt', target_profile.verified_at
  );
end;
$$;

grant execute on function public.generate_profile_verification_code() to anon, authenticated;
grant execute on function public.list_profile_verification_requests(uuid) to anon, authenticated;
grant execute on function public.submit_profile_verification_request(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.list_staff_verification_requests(text, text, integer, integer) to anon, authenticated;
grant execute on function public.staff_review_profile_verification_request(text, uuid, text, text) to anon, authenticated;
grant execute on function public.upsert_external_profile(text, text, text, text, text, text, text, text) to anon, authenticated;
