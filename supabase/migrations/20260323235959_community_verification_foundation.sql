do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'community_verification_kind'
  ) then
    create type public.community_verification_kind as enum (
      'official',
      'community_led'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'community_group_platform'
  ) then
    create type public.community_group_platform as enum (
      'whatsapp',
      'telegram',
      'other'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'community_verification_confirmation_status'
  ) then
    create type public.community_verification_confirmation_status as enum (
      'pending',
      'confirmed'
    );
  end if;
end
$$;

alter table public.communities
  add column if not exists verification_status public.profile_verification_status not null default 'unverified',
  add column if not exists verification_kind public.community_verification_kind,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by_admin_id uuid references public.staff_admin_accounts (id) on delete set null,
  add column if not exists verification_note text;

create table if not exists public.community_verification_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  requested_by_profile_id uuid not null references public.profiles (id) on delete cascade,
  verification_kind public.community_verification_kind not null,
  verification_code text not null unique,
  category text,
  group_platform public.community_group_platform,
  group_url text,
  note text,
  admin_note text,
  required_admin_count integer not null default 2,
  status public.profile_verification_status not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by_admin_id uuid references public.staff_admin_accounts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_verification_requests_required_admins check (required_admin_count between 2 and 5)
);

create index if not exists community_verification_requests_community_id_idx
  on public.community_verification_requests (community_id, created_at desc);

create index if not exists community_verification_requests_status_idx
  on public.community_verification_requests (status, created_at desc);

drop trigger if exists set_community_verification_requests_updated_at on public.community_verification_requests;
create trigger set_community_verification_requests_updated_at
  before update on public.community_verification_requests
  for each row execute function public.set_updated_at();

create table if not exists public.community_verification_confirmations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.community_verification_requests (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  invited_identifier text,
  role_label text,
  status public.community_verification_confirmation_status not null default 'pending',
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_verification_confirmations_unique unique (request_id, profile_id)
);

create index if not exists community_verification_confirmations_request_idx
  on public.community_verification_confirmations (request_id, status, created_at asc);

create index if not exists community_verification_confirmations_profile_idx
  on public.community_verification_confirmations (profile_id, status, created_at desc);

drop trigger if exists set_community_verification_confirmations_updated_at on public.community_verification_confirmations;
create trigger set_community_verification_confirmations_updated_at
  before update on public.community_verification_confirmations
  for each row execute function public.set_updated_at();

create or replace function public.generate_community_verification_code()
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
      'EV1-COMM-' || substr(upper(encode(extensions.gen_random_bytes(4), 'hex')), 1, 8);

    exit when not exists (
      select 1
      from public.community_verification_requests
      where verification_code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

create or replace function public.get_community_verification_context(
  input_community_id uuid,
  input_viewer_profile_id uuid default null
)
returns table (
  request_id uuid,
  community_id uuid,
  requested_by_profile_id uuid,
  requested_by_display_name text,
  requested_by_username text,
  verification_kind text,
  verification_code text,
  category text,
  group_platform text,
  group_url text,
  note text,
  admin_note text,
  status text,
  required_admin_count integer,
  confirmed_admin_count integer,
  pending_admin_count integer,
  created_at timestamptz,
  reviewed_at timestamptz,
  viewer_is_requester boolean,
  viewer_can_confirm boolean,
  viewer_confirmed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_request as (
    select request.*
    from public.community_verification_requests request
    where request.community_id = input_community_id
    order by
      case
        when request.status = 'pending' then 0
        when request.status = 'verified' then 1
        else 2
      end,
      request.created_at desc
    limit 1
  ),
  confirmation_counts as (
    select
      confirmation.request_id,
      count(*) filter (
        where confirmation.status = 'confirmed'
      )::integer as confirmed_admin_count,
      count(*) filter (
        where confirmation.status = 'pending'
      )::integer as pending_admin_count
    from public.community_verification_confirmations confirmation
    where confirmation.request_id = (select id from latest_request)
    group by confirmation.request_id
  ),
  viewer_confirmation as (
    select confirmation.*
    from public.community_verification_confirmations confirmation
    where confirmation.request_id = (select id from latest_request)
      and confirmation.profile_id = input_viewer_profile_id
    limit 1
  )
  select
    request.id as request_id,
    request.community_id,
    request.requested_by_profile_id,
    requester.display_name as requested_by_display_name,
    requester.username as requested_by_username,
    request.verification_kind::text,
    request.verification_code,
    request.category,
    request.group_platform::text,
    request.group_url,
    request.note,
    request.admin_note,
    request.status::text,
    request.required_admin_count,
    coalesce(counts.confirmed_admin_count, 0) as confirmed_admin_count,
    coalesce(counts.pending_admin_count, 0) as pending_admin_count,
    request.created_at,
    request.reviewed_at,
    request.requested_by_profile_id = input_viewer_profile_id
      as viewer_is_requester,
    (
      input_viewer_profile_id is not null
      and viewer.id is not null
      and viewer.status = 'pending'
      and request.status = 'pending'
    ) as viewer_can_confirm,
    (
      input_viewer_profile_id is not null
      and viewer.id is not null
      and viewer.status = 'confirmed'
    ) as viewer_confirmed
  from latest_request request
  inner join public.profiles requester
    on requester.id = request.requested_by_profile_id
  left join confirmation_counts counts
    on counts.request_id = request.id
  left join viewer_confirmation viewer
    on true;
$$;

create or replace function public.list_community_verification_confirmations(
  input_request_id uuid
)
returns table (
  id uuid,
  profile_id uuid,
  username text,
  display_name text,
  avatar_url text,
  wallet_address text,
  invited_identifier text,
  role_label text,
  status text,
  confirmed_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    confirmation.id,
    confirmation.profile_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    profile.wallet_address,
    confirmation.invited_identifier,
    confirmation.role_label,
    confirmation.status::text,
    confirmation.confirmed_at,
    confirmation.created_at
  from public.community_verification_confirmations confirmation
  inner join public.profiles profile
    on profile.id = confirmation.profile_id
  where confirmation.request_id = input_request_id
  order by
    case
      when confirmation.role_label = 'owner' then 0
      when confirmation.status = 'confirmed' then 1
      else 2
    end,
    confirmation.created_at asc;
$$;

create or replace function public.confirm_community_verification_admin(
  input_request_id uuid,
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.community_verification_requests%rowtype;
  target_confirmation public.community_verification_confirmations%rowtype;
  target_community public.communities%rowtype;
  actor_profile public.profiles%rowtype;
  confirmed_admin_count integer := 0;
begin
  if input_request_id is null or input_profile_id is null then
    raise exception 'Verification request and profile are required.'
      using errcode = '23502';
  end if;

  select *
  into target_request
  from public.community_verification_requests
  where id = input_request_id
  limit 1;

  if not found then
    raise exception 'Community verification request not found.'
      using errcode = 'P0002';
  end if;

  if target_request.status <> 'pending' then
    raise exception 'This community verification request is no longer awaiting confirmations.'
      using errcode = '22023';
  end if;

  select *
  into target_confirmation
  from public.community_verification_confirmations
  where request_id = input_request_id
    and profile_id = input_profile_id
  limit 1;

  if not found then
    raise exception 'You are not an invited community verification admin for this request.'
      using errcode = '42501';
  end if;

  if target_confirmation.status = 'confirmed' then
    select count(*)::integer
    into confirmed_admin_count
    from public.community_verification_confirmations confirmation
    where confirmation.request_id = input_request_id
      and confirmation.status = 'confirmed';

    return jsonb_build_object(
      'confirmed', true,
      'requestId', input_request_id,
      'communityId', target_request.community_id,
      'confirmedAdminCount', confirmed_admin_count,
      'requiredAdminCount', target_request.required_admin_count,
      'reason', null
    );
  end if;

  update public.community_verification_confirmations
  set
    status = 'confirmed',
    confirmed_at = timezone('utc', now())
  where id = target_confirmation.id
  returning *
  into target_confirmation;

  select *
  into target_community
  from public.communities
  where id = target_request.community_id
  limit 1;

  select *
  into actor_profile
  from public.profiles
  where id = input_profile_id
  limit 1;

  select count(*)::integer
  into confirmed_admin_count
  from public.community_verification_confirmations confirmation
  where confirmation.request_id = input_request_id
    and confirmation.status = 'confirmed';

  perform public.create_notification(
    target_request.requested_by_profile_id,
    input_profile_id,
    'community',
    'Verification admin confirmed',
    format(
      '%s confirmed the community verification request for %s.',
      coalesce(
        nullif(trim(actor_profile.display_name), ''),
        nullif(trim(actor_profile.username), ''),
        'An admin'
      ),
      target_community.name
    ),
    'community',
    target_request.community_id::text,
    jsonb_build_object(
      'communityId', target_request.community_id,
      'communitySlug', target_community.slug,
      'requestId', target_request.id,
      'eventType', 'community_verification_confirmation',
      'confirmedAdminCount', confirmed_admin_count,
      'requiredAdminCount', target_request.required_admin_count
    )
  );

  return jsonb_build_object(
    'confirmed', true,
    'requestId', input_request_id,
    'communityId', target_request.community_id,
    'confirmedAdminCount', confirmed_admin_count,
    'requiredAdminCount', target_request.required_admin_count,
    'reason', null
  );
end;
$$;

create or replace function public.list_staff_community_verification_requests(
  input_session_token text,
  input_status text default null,
  input_limit integer default 100,
  input_offset integer default 0
)
returns table (
  id uuid,
  community_id uuid,
  community_slug text,
  community_name text,
  community_avatar_url text,
  requested_by_profile_id uuid,
  requested_by_username text,
  requested_by_display_name text,
  verification_kind text,
  verification_code text,
  category text,
  group_platform text,
  group_url text,
  note text,
  admin_note text,
  status text,
  required_admin_count integer,
  confirmed_admin_count integer,
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
        raise exception 'Unsupported community verification status filter.'
          using errcode = '22P02';
    end;
  end if;

  return query
  with confirmation_counts as (
    select
      confirmation.request_id,
      count(*) filter (
        where confirmation.status = 'confirmed'
      )::integer as confirmed_admin_count
    from public.community_verification_confirmations confirmation
    group by confirmation.request_id
  )
  select
    request.id,
    request.community_id,
    community.slug as community_slug,
    community.name as community_name,
    community.avatar_url as community_avatar_url,
    request.requested_by_profile_id,
    requester.username as requested_by_username,
    requester.display_name as requested_by_display_name,
    request.verification_kind::text,
    request.verification_code,
    request.category,
    request.group_platform::text,
    request.group_url,
    request.note,
    request.admin_note,
    request.status::text,
    request.required_admin_count,
    coalesce(counts.confirmed_admin_count, 0) as confirmed_admin_count,
    request.created_at,
    request.reviewed_at,
    reviewer.display_name as reviewed_by_admin_name
  from public.community_verification_requests request
  inner join public.communities community
    on community.id = request.community_id
  inner join public.profiles requester
    on requester.id = request.requested_by_profile_id
  left join confirmation_counts counts
    on counts.request_id = request.id
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

create or replace function public.staff_review_community_verification_request(
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
  target_request public.community_verification_requests%rowtype;
  target_community public.communities%rowtype;
  requester_profile public.profiles%rowtype;
  normalized_status public.profile_verification_status;
  normalized_note text := nullif(trim(input_admin_note), '');
  confirmed_admin_count integer := 0;
begin
  select *
  into actor_record
  from public.get_staff_admin_session(input_session_token);

  if input_request_id is null then
    raise exception 'Community verification request is required.'
      using errcode = '23502';
  end if;

  begin
    normalized_status := lower(trim(coalesce(input_status, '')))::public.profile_verification_status;
  exception
    when others then
      raise exception 'Unsupported community verification review status.'
        using errcode = '22P02';
  end;

  if normalized_status not in ('verified', 'flagged', 'rejected') then
    raise exception 'Community verification requests can only be reviewed as verified, flagged, or rejected.'
      using errcode = '22023';
  end if;

  select *
  into target_request
  from public.community_verification_requests
  where id = input_request_id
  limit 1;

  if not found then
    raise exception 'Community verification request not found.'
      using errcode = 'P0002';
  end if;

  select *
  into target_community
  from public.communities
  where id = target_request.community_id
  limit 1;

  if not found then
    raise exception 'Target community not found.'
      using errcode = 'P0002';
  end if;

  select *
  into requester_profile
  from public.profiles
  where id = target_request.requested_by_profile_id
  limit 1;

  select count(*)::integer
  into confirmed_admin_count
  from public.community_verification_confirmations confirmation
  where confirmation.request_id = target_request.id
    and confirmation.status = 'confirmed';

  if normalized_status = 'verified'
    and confirmed_admin_count < target_request.required_admin_count then
    raise exception 'This community still needs % more admin confirmations before it can be verified.',
      target_request.required_admin_count - confirmed_admin_count
      using errcode = '22023';
  end if;

  update public.community_verification_requests
  set
    status = normalized_status,
    admin_note = coalesce(normalized_note, admin_note),
    reviewed_at = timezone('utc', now()),
    reviewed_by_admin_id = actor_record.admin_id
  where id = target_request.id
  returning *
  into target_request;

  update public.communities
  set
    verification_status = normalized_status,
    verification_kind = case
      when normalized_status = 'verified' then target_request.verification_kind
      else communities.verification_kind
    end,
    verified_at = case
      when normalized_status = 'verified' then timezone('utc', now())
      else null
    end,
    verified_by_admin_id = case
      when normalized_status = 'verified' then actor_record.admin_id
      else null
    end,
    verification_note = coalesce(normalized_note, target_request.note, verification_note)
  where id = target_request.community_id;

  perform public.create_notification(
    target_request.requested_by_profile_id,
    null,
    'community',
    case
      when normalized_status = 'verified' then 'Community verified'
      when normalized_status = 'flagged' then 'Community verification needs review'
      else 'Community verification was not approved'
    end,
    case
      when normalized_status = 'verified' then
        format('%s now has the verified community badge on Every1.', target_community.name)
      when normalized_status = 'flagged' then
        format('%s needs a little more review before it can be verified.', target_community.name)
      else
        format('%s was not approved for community verification yet.', target_community.name)
    end,
    'community',
    target_request.community_id::text,
    jsonb_build_object(
      'communityId', target_request.community_id,
      'communitySlug', target_community.slug,
      'requestId', target_request.id,
      'status', normalized_status::text,
      'eventType', 'community_verification_review'
    )
  );

  return jsonb_build_object(
    'communityId', target_request.community_id,
    'requestId', target_request.id,
    'status', normalized_status::text,
    'confirmedAdminCount', confirmed_admin_count,
    'requiredAdminCount', target_request.required_admin_count,
    'reason', null
  );
end;
$$;

drop function if exists public.list_profile_communities(uuid, text, text, integer);
create or replace function public.list_profile_communities(
  input_profile_id uuid default null,
  input_feed_type text default 'discover',
  input_search text default null,
  input_limit integer default 50
)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  avatar_url text,
  banner_url text,
  visibility public.community_visibility,
  status public.community_status,
  owner_id uuid,
  owner_display_name text,
  owner_username text,
  owner_avatar_url text,
  member_count bigint,
  post_count bigint,
  membership_role text,
  membership_status text,
  is_member boolean,
  is_owner boolean,
  joined_at timestamptz,
  verification_status text,
  verification_kind text,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with membership_lookup as (
    select
      membership.community_id,
      membership.role,
      membership.status,
      membership.updated_at
    from public.community_memberships membership
    where membership.profile_id = input_profile_id
  ),
  member_counts as (
    select
      membership.community_id,
      count(*)::bigint as member_count
    from public.community_memberships membership
    where membership.status = 'active'
    group by membership.community_id
  ),
  post_counts as (
    select
      post.community_id,
      count(*)::bigint as post_count
    from public.community_posts post
    group by post.community_id
  )
  select
    community.id,
    community.slug,
    community.name,
    community.description,
    community.avatar_url,
    community.banner_url,
    community.visibility,
    community.status,
    community.owner_id,
    owner_profile.display_name as owner_display_name,
    owner_profile.username as owner_username,
    owner_profile.avatar_url as owner_avatar_url,
    coalesce(member_counts.member_count, 0) as member_count,
    coalesce(post_counts.post_count, 0) as post_count,
    case
      when community.owner_id = input_profile_id then 'owner'
      else membership_lookup.role::text
    end as membership_role,
    case
      when community.owner_id = input_profile_id then 'active'
      else membership_lookup.status::text
    end as membership_status,
    (
      community.owner_id = input_profile_id
      or membership_lookup.status = 'active'
    ) as is_member,
    community.owner_id = input_profile_id as is_owner,
    membership_lookup.updated_at as joined_at,
    community.verification_status::text,
    community.verification_kind::text,
    community.verified_at
  from public.communities community
  inner join public.profiles owner_profile
    on owner_profile.id = community.owner_id
  left join membership_lookup
    on membership_lookup.community_id = community.id
  left join member_counts
    on member_counts.community_id = community.id
  left join post_counts
    on post_counts.community_id = community.id
  where community.status = 'active'
    and (
      input_search is null
      or input_search = ''
      or community.name ilike '%' || input_search || '%'
      or community.slug ilike '%' || input_search || '%'
      or coalesce(community.description, '') ilike '%' || input_search || '%'
      or coalesce(owner_profile.display_name, '') ilike '%' || input_search || '%'
      or coalesce(owner_profile.username, '') ilike '%' || input_search || '%'
    )
    and (
      input_feed_type is null
      or input_feed_type = 'discover'
      or (
        input_feed_type = 'member'
        and (
          community.owner_id = input_profile_id
          or membership_lookup.status = 'active'
        )
      )
      or (
        input_feed_type = 'managed'
        and (
          community.owner_id = input_profile_id
          or (
            membership_lookup.status = 'active'
            and membership_lookup.role in ('owner', 'moderator')
          )
        )
      )
    )
    and (
      community.visibility = 'public'
      or community.owner_id = input_profile_id
      or membership_lookup.status in ('active', 'requested')
    )
  order by
    case
      when input_feed_type = 'discover'
        and community.verification_status = 'verified' then 0
      when input_feed_type = 'discover' then 1
      else 2
    end asc,
    case when input_feed_type = 'discover' then coalesce(member_counts.member_count, 0) else 0 end desc,
    coalesce(membership_lookup.updated_at, community.created_at) desc
  limit greatest(coalesce(input_limit, 50), 1);
$$;

drop function if exists public.get_community_by_slug(text, uuid);
create or replace function public.get_community_by_slug(
  input_slug text,
  input_profile_id uuid default null
)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  avatar_url text,
  banner_url text,
  visibility public.community_visibility,
  status public.community_status,
  owner_id uuid,
  owner_display_name text,
  owner_username text,
  owner_avatar_url text,
  member_count bigint,
  post_count bigint,
  membership_role text,
  membership_status text,
  is_member boolean,
  is_owner boolean,
  joined_at timestamptz,
  verification_status text,
  verification_kind text,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with membership_lookup as (
    select
      membership.community_id,
      membership.role,
      membership.status,
      membership.updated_at
    from public.community_memberships membership
    where membership.profile_id = input_profile_id
  ),
  member_counts as (
    select
      membership.community_id,
      count(*)::bigint as member_count
    from public.community_memberships membership
    where membership.status = 'active'
    group by membership.community_id
  ),
  post_counts as (
    select
      post.community_id,
      count(*)::bigint as post_count
    from public.community_posts post
    group by post.community_id
  )
  select
    community.id,
    community.slug,
    community.name,
    community.description,
    community.avatar_url,
    community.banner_url,
    community.visibility,
    community.status,
    community.owner_id,
    owner_profile.display_name as owner_display_name,
    owner_profile.username as owner_username,
    owner_profile.avatar_url as owner_avatar_url,
    coalesce(member_counts.member_count, 0) as member_count,
    coalesce(post_counts.post_count, 0) as post_count,
    case
      when community.owner_id = input_profile_id then 'owner'
      else membership_lookup.role::text
    end as membership_role,
    case
      when community.owner_id = input_profile_id then 'active'
      else membership_lookup.status::text
    end as membership_status,
    (
      community.owner_id = input_profile_id
      or membership_lookup.status = 'active'
    ) as is_member,
    community.owner_id = input_profile_id as is_owner,
    membership_lookup.updated_at as joined_at,
    community.verification_status::text,
    community.verification_kind::text,
    community.verified_at
  from public.communities community
  inner join public.profiles owner_profile
    on owner_profile.id = community.owner_id
  left join membership_lookup
    on membership_lookup.community_id = community.id
  left join member_counts
    on member_counts.community_id = community.id
  left join post_counts
    on post_counts.community_id = community.id
  where lower(community.slug) = lower(input_slug)
    and community.status = 'active'
    and (
      community.visibility = 'public'
      or community.owner_id = input_profile_id
      or membership_lookup.status in ('active', 'requested')
    )
  limit 1;
$$;

create or replace function public.submit_community_verification_request(
  input_community_id uuid,
  input_requester_profile_id uuid,
  input_verification_kind text,
  input_category text default null,
  input_group_platform text default null,
  input_group_url text default null,
  input_note text default null,
  input_admin_identifiers text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community public.communities%rowtype;
  requester_profile public.profiles%rowtype;
  request_record public.community_verification_requests%rowtype;
  normalized_kind public.community_verification_kind;
  normalized_platform public.community_group_platform;
  normalized_category text := nullif(trim(input_category), '');
  normalized_group_url text := nullif(trim(input_group_url), '');
  normalized_note text := nullif(trim(input_note), '');
  normalized_identifier text;
  normalized_identifiers text[] := coalesce(input_admin_identifiers, array[]::text[]);
  resolved_profile_id uuid;
  resolved_profile_ids uuid[] := array[]::uuid[];
  unresolved_identifiers text[] := array[]::text[];
  required_admin_count integer;
  confirmed_admin_count integer;
  requester_label text;
begin
  if input_community_id is null or input_requester_profile_id is null then
    raise exception 'Community and requester are required.'
      using errcode = '23502';
  end if;

  select *
  into target_community
  from public.communities
  where id = input_community_id
  limit 1;

  if not found then
    raise exception 'Community not found.'
      using errcode = 'P0002';
  end if;

  if target_community.owner_id <> input_requester_profile_id then
    raise exception 'Only the community owner can start verification.'
      using errcode = '42501';
  end if;

  if target_community.verification_status = 'verified' then
    raise exception 'This community is already verified.'
      using errcode = '22023';
  end if;

  select *
  into requester_profile
  from public.profiles
  where id = input_requester_profile_id
  limit 1;

  if not found then
    raise exception 'Requester profile not found.'
      using errcode = 'P0002';
  end if;

  begin
    normalized_kind :=
      lower(trim(coalesce(input_verification_kind, '')))::public.community_verification_kind;
  exception
    when others then
      raise exception 'Unsupported community verification type.'
        using errcode = '22P02';
  end;

  if nullif(trim(coalesce(input_group_platform, '')), '') is not null then
    begin
      normalized_platform :=
        lower(trim(input_group_platform))::public.community_group_platform;
    exception
      when others then
        raise exception 'Unsupported community group platform.'
          using errcode = '22P02';
    end;
  else
    normalized_platform := null;
  end if;

  required_admin_count :=
    case
      when normalized_kind = 'official' then 3
      else 2
    end;

  foreach normalized_identifier in array normalized_identifiers loop
    normalized_identifier := lower(trim(coalesce(normalized_identifier, '')));
    normalized_identifier := regexp_replace(normalized_identifier, '^@+', '');
    normalized_identifier := regexp_replace(normalized_identifier, '\s+', '', 'g');

    if normalized_identifier = '' then
      continue;
    end if;

    select profile.id
    into resolved_profile_id
    from public.profiles profile
    where lower(coalesce(profile.username, '')) = normalized_identifier
      or lower(coalesce(profile.wallet_address, '')) = normalized_identifier
      or lower(coalesce(profile.zora_handle, '')) = normalized_identifier
    order by profile.created_at asc
    limit 1;

    if resolved_profile_id is null then
      unresolved_identifiers := array_append(
        unresolved_identifiers,
        normalized_identifier
      );
      continue;
    end if;

    if resolved_profile_id = input_requester_profile_id then
      continue;
    end if;

    if not resolved_profile_id = any(resolved_profile_ids) then
      resolved_profile_ids := array_append(resolved_profile_ids, resolved_profile_id);
    end if;
  end loop;

  if array_length(unresolved_identifiers, 1) > 0 then
    raise exception 'Some invited admins could not be found: %',
      array_to_string(unresolved_identifiers, ', ')
      using errcode = 'P0001';
  end if;

  if coalesce(array_length(resolved_profile_ids, 1), 0) + 1 < required_admin_count then
    raise exception 'You need at least % confirmed admins, including yourself, to request this verification.',
      required_admin_count
      using errcode = '22023';
  end if;

  update public.community_verification_requests
  set
    status = 'rejected',
    admin_note = coalesce(admin_note, 'Superseded by a newer verification request.'),
    reviewed_at = timezone('utc', now())
  where community_id = target_community.id
    and status = 'pending';

  insert into public.community_verification_requests (
    community_id,
    requested_by_profile_id,
    verification_kind,
    verification_code,
    category,
    group_platform,
    group_url,
    note,
    required_admin_count,
    status
  )
  values (
    target_community.id,
    input_requester_profile_id,
    normalized_kind,
    public.generate_community_verification_code(),
    normalized_category,
    normalized_platform,
    normalized_group_url,
    normalized_note,
    required_admin_count,
    'pending'
  )
  returning *
  into request_record;

  insert into public.community_verification_confirmations (
    request_id,
    profile_id,
    invited_identifier,
    role_label,
    status,
    confirmed_at
  )
  values (
    request_record.id,
    input_requester_profile_id,
    coalesce(requester_profile.username, requester_profile.wallet_address),
    'owner',
    'confirmed',
    timezone('utc', now())
  )
  on conflict (request_id, profile_id) do update
    set status = 'confirmed',
        confirmed_at = coalesce(
          public.community_verification_confirmations.confirmed_at,
          excluded.confirmed_at
        );

  if coalesce(array_length(resolved_profile_ids, 1), 0) > 0 then
    insert into public.community_verification_confirmations (
      request_id,
      profile_id,
      invited_identifier,
      role_label,
      status
    )
    select
      request_record.id,
      profile.id,
      coalesce(profile.username, profile.wallet_address),
      'admin',
      'pending'::public.community_verification_confirmation_status
    from public.profiles profile
    where profile.id = any(resolved_profile_ids)
    on conflict (request_id, profile_id) do nothing;
  end if;

  update public.communities
  set
    verification_status = 'pending',
    verification_kind = normalized_kind,
    verification_note = coalesce(normalized_note, verification_note)
  where id = target_community.id;

  requester_label := coalesce(
    nullif(trim(requester_profile.display_name), ''),
    nullif(trim(requester_profile.username), ''),
    'Community owner'
  );

  perform public.create_notification(
    input_requester_profile_id,
    null,
    'community',
    'Community verification submitted',
    format(
      'Your %s verification request for %s is now pending admin review.',
      case
        when normalized_kind = 'official' then 'official community'
        else 'community-led'
      end,
      target_community.name
    ),
    'community',
    target_community.id::text,
    jsonb_build_object(
      'communityId', target_community.id,
      'communitySlug', target_community.slug,
      'requestId', request_record.id,
      'verificationCode', request_record.verification_code
    )
  );

  if coalesce(array_length(resolved_profile_ids, 1), 0) > 0 then
    insert into public.notifications (
      profile_id,
      actor_profile_id,
      kind,
      title,
      body,
      target_type,
      target_key,
      data
    )
    select
      profile.id,
      input_requester_profile_id,
      'community',
      'Community verification invite',
      format(
        '%s added you as a verification admin for %s.',
        requester_label,
        target_community.name
      ),
      'community',
      target_community.id::text,
      jsonb_build_object(
        'communityId', target_community.id,
        'communitySlug', target_community.slug,
        'communityName', target_community.name,
        'requestId', request_record.id,
        'eventType', 'community_verification_invite'
      )
    from public.profiles profile
    where profile.id = any(resolved_profile_ids);
  end if;

  select count(*)::integer
  into confirmed_admin_count
  from public.community_verification_confirmations confirmation
  where confirmation.request_id = request_record.id
    and confirmation.status = 'confirmed';

  return jsonb_build_object(
    'id', request_record.id,
    'communityId', request_record.community_id,
    'verificationKind', request_record.verification_kind::text,
    'verificationCode', request_record.verification_code,
    'category', request_record.category,
    'groupPlatform', coalesce(request_record.group_platform::text, null),
    'groupUrl', request_record.group_url,
    'note', request_record.note,
    'status', request_record.status::text,
    'requiredAdminCount', request_record.required_admin_count,
    'confirmedAdminCount', confirmed_admin_count,
    'createdAt', request_record.created_at
  );
end;
$$;

grant execute on function public.generate_community_verification_code() to anon, authenticated;
grant execute on function public.submit_community_verification_request(uuid, uuid, text, text, text, text, text, text[]) to anon, authenticated;
grant execute on function public.get_community_verification_context(uuid, uuid) to anon, authenticated;
grant execute on function public.list_community_verification_confirmations(uuid) to anon, authenticated;
grant execute on function public.confirm_community_verification_admin(uuid, uuid) to anon, authenticated;
grant execute on function public.list_staff_community_verification_requests(text, text, integer, integer) to anon, authenticated;
grant execute on function public.staff_review_community_verification_request(text, uuid, text, text) to anon, authenticated;
grant execute on function public.list_profile_communities(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.get_community_by_slug(text, uuid) to anon, authenticated;
