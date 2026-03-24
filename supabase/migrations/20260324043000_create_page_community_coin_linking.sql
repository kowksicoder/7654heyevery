alter table public.communities
  add column if not exists linked_launch_id uuid references public.creator_launches (id) on delete set null,
  add column if not exists linked_coin_address text,
  add column if not exists linked_coin_name text,
  add column if not exists linked_coin_ticker text,
  add column if not exists linked_cover_image_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'communities_linked_coin_address_format'
  ) then
    alter table public.communities
      add constraint communities_linked_coin_address_format check (
        linked_coin_address is null
        or linked_coin_address ~ '^0x[a-fA-F0-9]{40}$'
      );
  end if;
end
$$;

create unique index if not exists communities_linked_launch_unique_idx
  on public.communities (linked_launch_id)
  where linked_launch_id is not null;

create unique index if not exists communities_linked_coin_address_unique_idx
  on public.communities (lower(linked_coin_address))
  where linked_coin_address is not null;

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
  input_post_destination text default 'every1_feed'
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

  if normalized_coin_address is not null
    and normalized_coin_address !~ '^0x[a-f0-9]{40}$' then
    raise exception 'Coin address must be a valid EVM address.'
      using errcode = '22P02';
  end if;

  insert into public.creator_launches (
    created_by,
    ticker,
    name,
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
    'launchId', created_launch.id,
    'coinAddress', created_launch.coin_address,
    'name', created_launch.name,
    'status', created_launch.status,
    'ticker', created_launch.ticker
  );
end;
$$;

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
  public.community_visibility
) to anon, authenticated;
