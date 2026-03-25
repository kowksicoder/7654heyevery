alter table public.creator_launches
  add column if not exists category text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creator_launches_category_length'
  ) then
    alter table public.creator_launches
      add constraint creator_launches_category_length check (
        category is null
        or char_length(trim(category)) between 1 and 48
      );
  end if;
end
$$;

create index if not exists creator_launches_category_status_idx
  on public.creator_launches (category, status, launched_at desc);

update public.creator_launches
set category = case
  when post_destination = 'community' then 'Communities'
  when post_destination = 'collaboration' then 'Collaboration'
  else category
end
where category is null
  and post_destination in ('community', 'collaboration');

drop function if exists public.create_creator_coin_launch(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  bigint,
  text
);

create or replace function public.create_creator_coin_launch(
  input_created_by_profile_id uuid,
  input_ticker text,
  input_name text,
  input_description text default null,
  input_cover_image_url text default null,
  input_metadata_uri text default null,
  input_coin_address text default null,
  input_chain_id integer default 8453,
  input_supply bigint default 10000000,
  input_post_destination text default 'every1_feed',
  input_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_ticker text := lower(nullif(trim(input_ticker), ''));
  normalized_name text := nullif(trim(input_name), '');
  normalized_description text := nullif(trim(input_description), '');
  normalized_cover_image_url text := nullif(trim(input_cover_image_url), '');
  normalized_metadata_uri text := nullif(trim(input_metadata_uri), '');
  normalized_coin_address text := lower(nullif(trim(input_coin_address), ''));
  normalized_post_destination text := nullif(trim(input_post_destination), '');
  normalized_category text := nullif(trim(input_category), '');
  created_launch public.creator_launches%rowtype;
begin
  if input_created_by_profile_id is null then
    raise exception 'Creator profile is required.'
      using errcode = '23502';
  end if;

  if normalized_ticker is null then
    raise exception 'Ticker is required.'
      using errcode = '23502';
  end if;

  if normalized_name is null then
    raise exception 'Coin name is required.'
      using errcode = '23502';
  end if;

  if normalized_category is null then
    raise exception 'Category is required.'
      using errcode = '23502';
  end if;

  if normalized_coin_address is not null
    and normalized_coin_address !~ '^0x[a-f0-9]{40}$' then
    raise exception 'Coin address must be a valid EVM address.'
      using errcode = '22P02';
  end if;

  insert into public.creator_launches (
    created_by,
    ticker,
    name,
    category,
    description,
    cover_image_url,
    metadata_uri,
    coin_address,
    chain_id,
    supply,
    post_destination,
    status,
    launched_at
  )
  values (
    input_created_by_profile_id,
    normalized_ticker,
    normalized_name,
    normalized_category,
    normalized_description,
    normalized_cover_image_url,
    normalized_metadata_uri,
    normalized_coin_address,
    coalesce(input_chain_id, 8453),
    greatest(coalesce(input_supply, 10000000), 1),
    coalesce(normalized_post_destination, 'every1_feed'),
    'launched',
    timezone('utc', now())
  )
  returning * into created_launch;

  return jsonb_build_object(
    'category', created_launch.category,
    'launchId', created_launch.id,
    'coinAddress', created_launch.coin_address,
    'name', created_launch.name,
    'status', created_launch.status,
    'ticker', created_launch.ticker
  );
end;
$$;

drop function if exists public.create_community_coin_launch(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  bigint,
  text,
  text,
  text,
  public.community_visibility
);

create or replace function public.create_community_coin_launch(
  input_owner_profile_id uuid,
  input_ticker text,
  input_coin_name text,
  input_coin_description text default null,
  input_cover_image_url text default null,
  input_metadata_uri text default null,
  input_coin_address text default null,
  input_chain_id integer default 8453,
  input_supply bigint default 10000000,
  input_community_name text default null,
  input_community_slug text default null,
  input_community_description text default null,
  input_category text default 'Communities',
  input_visibility public.community_visibility default 'public'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_ticker text := lower(nullif(trim(input_ticker), ''));
  normalized_coin_name text := nullif(trim(input_coin_name), '');
  normalized_coin_description text := nullif(trim(input_coin_description), '');
  normalized_cover_image_url text := nullif(trim(input_cover_image_url), '');
  normalized_metadata_uri text := nullif(trim(input_metadata_uri), '');
  normalized_coin_address text := lower(nullif(trim(input_coin_address), ''));
  normalized_community_name text := nullif(
    trim(coalesce(input_community_name, input_coin_name)),
    ''
  );
  normalized_community_description text := nullif(
    trim(coalesce(input_community_description, input_coin_description)),
    ''
  );
  normalized_category text := coalesce(
    nullif(trim(input_category), ''),
    'Communities'
  );
  normalized_slug text;
  created_launch public.creator_launches%rowtype;
  created_community public.communities%rowtype;
begin
  if input_owner_profile_id is null then
    raise exception 'Community owner profile is required.'
      using errcode = '23502';
  end if;

  if normalized_ticker is null then
    raise exception 'Ticker is required.'
      using errcode = '23502';
  end if;

  if normalized_coin_name is null then
    raise exception 'Coin name is required.'
      using errcode = '23502';
  end if;

  if normalized_community_name is null then
    raise exception 'Community name is required.'
      using errcode = '23502';
  end if;

  if normalized_coin_address is not null
    and normalized_coin_address !~ '^0x[a-f0-9]{40}$' then
    raise exception 'Coin address must be a valid EVM address.'
      using errcode = '22P02';
  end if;

  normalized_slug := lower(
    regexp_replace(
      coalesce(nullif(trim(input_community_slug), ''), normalized_community_name),
      '[^a-zA-Z0-9-]',
      '-',
      'g'
    )
  );
  normalized_slug := regexp_replace(normalized_slug, '-{2,}', '-', 'g');
  normalized_slug := trim(both '-' from normalized_slug);

  if normalized_slug = '' then
    raise exception 'Community slug is required.'
      using errcode = '23502';
  end if;

  insert into public.creator_launches (
    created_by,
    ticker,
    name,
    category,
    description,
    cover_image_url,
    metadata_uri,
    coin_address,
    chain_id,
    supply,
    post_destination,
    status,
    launched_at
  )
  values (
    input_owner_profile_id,
    normalized_ticker,
    normalized_coin_name,
    normalized_category,
    normalized_coin_description,
    normalized_cover_image_url,
    normalized_metadata_uri,
    normalized_coin_address,
    coalesce(input_chain_id, 8453),
    greatest(coalesce(input_supply, 10000000), 1),
    'community',
    'launched',
    timezone('utc', now())
  )
  returning * into created_launch;

  insert into public.communities (
    owner_id,
    slug,
    name,
    description,
    avatar_url,
    banner_url,
    visibility,
    status,
    linked_launch_id,
    linked_coin_address,
    linked_coin_name,
    linked_coin_ticker,
    linked_cover_image_url
  )
  values (
    input_owner_profile_id,
    normalized_slug,
    normalized_community_name,
    normalized_community_description,
    normalized_cover_image_url,
    normalized_cover_image_url,
    coalesce(input_visibility, 'public'),
    'active',
    created_launch.id,
    created_launch.coin_address,
    created_launch.name,
    created_launch.ticker,
    created_launch.cover_image_url
  )
  returning * into created_community;

  return jsonb_build_object(
    'category', created_launch.category,
    'communityId', created_community.id,
    'coinAddress', created_launch.coin_address,
    'launchId', created_launch.id,
    'name', created_community.name,
    'slug', created_community.slug,
    'status', created_community.status,
    'ticker', created_launch.ticker,
    'visibility', created_community.visibility
  );
end;
$$;

drop function if exists public.create_collaboration_coin_invite(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  integer,
  bigint
);

create or replace function public.create_collaboration_coin_invite(
  input_owner_profile_id uuid,
  input_collaborator_profile_id uuid,
  input_ticker text,
  input_name text,
  input_category text default 'Collaboration',
  input_description text default null,
  input_cover_image_url text default null,
  input_metadata_uri text default null,
  input_creator_split numeric default 60,
  input_collaborator_split numeric default 40,
  input_invite_note text default null,
  input_chain_id integer default 8453,
  input_supply bigint default 10000000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_ticker text := lower(nullif(trim(input_ticker), ''));
  normalized_name text := nullif(trim(input_name), '');
  normalized_category text := coalesce(
    nullif(trim(input_category), ''),
    'Collaboration'
  );
  normalized_description text := nullif(trim(input_description), '');
  normalized_cover_image_url text := nullif(trim(input_cover_image_url), '');
  normalized_metadata_uri text := nullif(trim(input_metadata_uri), '');
  normalized_invite_note text := nullif(trim(input_invite_note), '');
  owner_profile public.profiles%rowtype;
  collaborator_profile public.profiles%rowtype;
  created_launch public.creator_launches%rowtype;
  created_collaboration public.creator_collaborations%rowtype;
  owner_display_label text;
  collaborator_display_label text;
  created_notification_id uuid;
begin
  if input_owner_profile_id is null then
    raise exception 'Creator profile is required.'
      using errcode = '23502';
  end if;

  if input_collaborator_profile_id is null then
    raise exception 'Collaborator profile is required.'
      using errcode = '23502';
  end if;

  if input_owner_profile_id = input_collaborator_profile_id then
    raise exception 'You cannot collaborate with yourself.'
      using errcode = '22023';
  end if;

  if normalized_ticker is null then
    raise exception 'Ticker is required.'
      using errcode = '23502';
  end if;

  if normalized_name is null then
    raise exception 'Coin name is required.'
      using errcode = '23502';
  end if;

  if normalized_ticker !~ '^[a-z0-9]{1,8}$' then
    raise exception 'Ticker must be 1 to 8 lowercase letters or numbers.'
      using errcode = '22P02';
  end if;

  if coalesce(input_creator_split, 0) <= 0
    or coalesce(input_collaborator_split, 0) <= 0 then
    raise exception 'Both collaboration splits must be greater than zero.'
      using errcode = '22023';
  end if;

  if round(coalesce(input_creator_split, 0) + coalesce(input_collaborator_split, 0), 2) <> 100 then
    raise exception 'Collaboration splits must add up to 100%%.'
      using errcode = '22023';
  end if;

  select *
  into owner_profile
  from public.profiles
  where id = input_owner_profile_id;

  if not found then
    raise exception 'Creator profile was not found.'
      using errcode = 'P0002';
  end if;

  select *
  into collaborator_profile
  from public.profiles
  where id = input_collaborator_profile_id;

  if not found then
    raise exception 'Collaborator profile was not found.'
      using errcode = 'P0002';
  end if;

  insert into public.creator_launches (
    created_by,
    ticker,
    name,
    category,
    description,
    cover_image_url,
    metadata_uri,
    chain_id,
    supply,
    post_destination,
    status
  )
  values (
    input_owner_profile_id,
    normalized_ticker,
    normalized_name,
    normalized_category,
    normalized_description,
    normalized_cover_image_url,
    normalized_metadata_uri,
    coalesce(input_chain_id, 8453),
    greatest(coalesce(input_supply, 10000000), 1),
    'collaboration',
    'draft'
  )
  returning * into created_launch;

  insert into public.creator_collaborations (
    owner_id,
    launch_id,
    title,
    description,
    status,
    max_members
  )
  values (
    input_owner_profile_id,
    created_launch.id,
    normalized_name,
    normalized_description,
    'draft',
    2
  )
  returning * into created_collaboration;

  update public.creator_collaboration_members
  set role = 'owner',
      status = 'active',
      split_percent = round(coalesce(input_creator_split, 0), 2),
      joined_at = coalesce(joined_at, timezone('utc', now())),
      accepted_terms_at = coalesce(accepted_terms_at, timezone('utc', now())),
      declined_at = null,
      invite_expires_at = null
  where collaboration_id = created_collaboration.id
    and profile_id = input_owner_profile_id;

  insert into public.creator_collaboration_members (
    collaboration_id,
    profile_id,
    role,
    status,
    note,
    split_percent,
    invite_expires_at
  )
  values (
    created_collaboration.id,
    input_collaborator_profile_id,
    'contributor',
    'invited',
    normalized_invite_note,
    round(coalesce(input_collaborator_split, 0), 2),
    timezone('utc', now()) + interval '24 hours'
  )
  on conflict (collaboration_id, profile_id) do update
    set role = excluded.role,
        status = 'invited',
        note = excluded.note,
        split_percent = excluded.split_percent,
        invite_expires_at = excluded.invite_expires_at,
        joined_at = null,
        accepted_terms_at = null,
        declined_at = null;

  owner_display_label := coalesce(
    nullif(trim(owner_profile.display_name), ''),
    nullif(trim(owner_profile.username), ''),
    'A creator'
  );
  collaborator_display_label := coalesce(
    nullif(trim(collaborator_profile.display_name), ''),
    nullif(trim(collaborator_profile.username), ''),
    'Collaborator'
  );

  created_notification_id := public.create_notification(
    input_collaborator_profile_id,
    input_owner_profile_id,
    'system',
    'New collaboration invite',
    format(
      '%s invited you to collaborate on "%s". Your share is %s%%.',
      owner_display_label,
      normalized_name,
      trim(to_char(round(coalesce(input_collaborator_split, 0), 2), 'FM999990.##'))
    ),
    null,
    created_collaboration.id::text,
    jsonb_build_object(
      'category', normalized_category,
      'collaborationId', created_collaboration.id,
      'collaboratorProfileId', input_collaborator_profile_id,
      'collaboratorShare', round(coalesce(input_collaborator_split, 0), 2),
      'creatorShare', round(coalesce(input_creator_split, 0), 2),
      'launchId', created_launch.id,
      'name', normalized_name,
      'ticker', normalized_ticker
    )
  );

  return jsonb_build_object(
    'category', created_launch.category,
    'collaborationId', created_collaboration.id,
    'collaboratorDisplayName', collaborator_display_label,
    'launchId', created_launch.id,
    'notificationId', created_notification_id,
    'status', created_collaboration.status,
    'ticker', created_launch.ticker,
    'title', created_collaboration.title
  );
end;
$$;

grant execute on function public.create_creator_coin_launch(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  bigint,
  text,
  text
) to anon, authenticated;

grant execute on function public.create_community_coin_launch(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  bigint,
  text,
  text,
  text,
  text,
  public.community_visibility
) to anon, authenticated;

grant execute on function public.create_collaboration_coin_invite(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  integer,
  bigint
) to anon, authenticated;
