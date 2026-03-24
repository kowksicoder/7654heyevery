create table if not exists public.explore_listing_events (
  id uuid primary key default gen_random_uuid(),
  coin_address text not null,
  creator_address text,
  ticker text,
  name text,
  image_url text,
  source text not null default 'zora_explore',
  listed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists explore_listing_events_coin_address_key
  on public.explore_listing_events ((lower(coin_address)));

create index if not exists explore_listing_events_listed_at_idx
  on public.explore_listing_events (listed_at desc);

insert into public.explore_listing_events (
  coin_address,
  creator_address,
  ticker,
  name,
  listed_at,
  metadata,
  source
)
select
  lower(launch.coin_address),
  null,
  lower(launch.ticker),
  nullif(trim(launch.name), ''),
  coalesce(launch.launched_at, launch.created_at),
  jsonb_build_object(
    'chainId', launch.chain_id,
    'launchId', launch.id,
    'origin', 'creator_launches'
  ),
  'creator_launches'
from public.creator_launches launch
where launch.status = 'launched'
  and nullif(trim(coalesce(launch.coin_address, '')), '') is not null
on conflict ((lower(coin_address))) do nothing;

create or replace function public.sync_explore_listing_events(
  input_items jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  synced_count integer := 0;
begin
  if input_items is null or jsonb_typeof(input_items) <> 'array' then
    return 0;
  end if;

  with normalized as (
    select
      lower(nullif(trim(item ->> 'coinAddress'), '')) as coin_address,
      lower(nullif(trim(item ->> 'creatorAddress'), '')) as creator_address,
      nullif(trim(item ->> 'ticker'), '') as ticker,
      nullif(trim(item ->> 'name'), '') as name,
      nullif(trim(item ->> 'imageUrl'), '') as image_url,
      case
        when nullif(trim(item ->> 'listedAt'), '') is not null
          then (item ->> 'listedAt')::timestamptz
        else timezone('utc', now())
      end as listed_at,
      jsonb_strip_nulls(
        jsonb_build_object(
          'source', coalesce(nullif(trim(item ->> 'source'), ''), 'zora_explore'),
          'syncedAt', timezone('utc', now())
        )
      ) as metadata,
      coalesce(nullif(trim(item ->> 'source'), ''), 'zora_explore') as source
    from jsonb_array_elements(input_items) as item
  ),
  filtered as (
    select *
    from normalized
    where coin_address ~ '^0x[a-f0-9]{40}$'
  ),
  upserted as (
    insert into public.explore_listing_events (
      coin_address,
      creator_address,
      ticker,
      name,
      image_url,
      source,
      listed_at,
      metadata
    )
    select
      filtered.coin_address,
      filtered.creator_address,
      filtered.ticker,
      filtered.name,
      filtered.image_url,
      filtered.source,
      filtered.listed_at,
      filtered.metadata
    from filtered
    on conflict ((lower(coin_address))) do update
      set
        creator_address = coalesce(excluded.creator_address, public.explore_listing_events.creator_address),
        ticker = coalesce(excluded.ticker, public.explore_listing_events.ticker),
        name = coalesce(excluded.name, public.explore_listing_events.name),
        image_url = coalesce(excluded.image_url, public.explore_listing_events.image_url),
        source = coalesce(excluded.source, public.explore_listing_events.source),
        listed_at = least(public.explore_listing_events.listed_at, excluded.listed_at),
        metadata = public.explore_listing_events.metadata || excluded.metadata,
        updated_at = timezone('utc', now())
    returning 1
  )
  select count(*) into synced_count
  from upserted;

  return coalesce(synced_count, 0);
end;
$$;

create or replace function public.get_mobile_nav_badge_counts(
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  creators_last_seen timestamptz;
  explore_last_seen timestamptz;
  leaderboard_last_seen timestamptz;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  select badge_state.last_seen_at
  into creators_last_seen
  from public.mobile_nav_badge_states badge_state
  where badge_state.profile_id = input_profile_id
    and badge_state.badge_key = 'creators_new_profiles';

  select badge_state.last_seen_at
  into explore_last_seen
  from public.mobile_nav_badge_states badge_state
  where badge_state.profile_id = input_profile_id
    and badge_state.badge_key = 'explore_new_coins';

  select badge_state.last_seen_at
  into leaderboard_last_seen
  from public.mobile_nav_badge_states badge_state
  where badge_state.profile_id = input_profile_id
    and badge_state.badge_key = 'leaderboard_updates';

  return jsonb_build_object(
    'creatorsCount',
    coalesce(
      (
        select count(*)::integer
        from public.profiles profile
        where nullif(trim(coalesce(profile.display_name, profile.username, profile.zora_handle, '')), '') is not null
          and profile.created_at > coalesce(creators_last_seen, '-infinity'::timestamptz)
          and profile.id <> input_profile_id
      ),
      0
    ),
    'exploreCount',
    coalesce(
      (
        select count(*)::integer
        from public.explore_listing_events listing
        where listing.listed_at > coalesce(explore_last_seen, '-infinity'::timestamptz)
      ),
      0
    ),
    'leaderboardCount',
    coalesce(
      (
        select count(*)::integer
        from public.leaderboard_updates update_item
        where update_item.created_at > coalesce(leaderboard_last_seen, '-infinity'::timestamptz)
      ),
      0
    )
  );
end;
$$;

drop trigger if exists explore_listing_events_set_updated_at on public.explore_listing_events;
create trigger explore_listing_events_set_updated_at
  before update on public.explore_listing_events
  for each row execute function public.set_updated_at();

alter table public.explore_listing_events enable row level security;

drop policy if exists "explore_listing_events_select_visible" on public.explore_listing_events;
create policy "explore_listing_events_select_visible"
  on public.explore_listing_events
  for select
  using (true);

grant select on public.explore_listing_events to anon, authenticated;
grant execute on function public.sync_explore_listing_events(jsonb) to anon, authenticated;
grant execute on function public.get_mobile_nav_badge_counts(uuid) to anon, authenticated;

comment on table public.explore_listing_events is
  'Normalized external coin listing events used to power live Explore badge counts.';

comment on function public.sync_explore_listing_events(jsonb) is
  'Upserts the latest external Explore listings into a persistent event table for nav badge counts.';

comment on function public.get_mobile_nav_badge_counts(uuid) is
  'Returns live Explore, Creators, and Leaderboard badge counts based on synced external listings, new public creator profiles, and leaderboard updates since the profile last viewed each section.';
