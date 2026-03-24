do $$
begin
  if not exists (
    select 1
    from pg_type notification_type
    join pg_enum notification_enum
      on notification_enum.enumtypid = notification_type.oid
    where notification_type.typname = 'notification_kind'
      and notification_enum.enumlabel = 'nudge'
  ) then
    alter type public.notification_kind add value 'nudge';
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'engagement_nudge_kind'
  ) then
    create type public.engagement_nudge_kind as enum (
      'trending_creator',
      'hot_trading',
      'buy_activity',
      'leaderboard_rank',
      'new_drops',
      'new_missions',
      'new_perks',
      'mission_winners'
    );
  end if;
end
$$;

create table if not exists public.profile_engagement_nudges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  nudge_kind public.engagement_nudge_kind not null,
  source_key text not null,
  title text not null,
  body text,
  target_key text,
  data jsonb not null default '{}'::jsonb,
  notification_id uuid references public.notifications (id) on delete set null,
  delivered_at timestamptz not null default timezone('utc', now()),
  cooldown_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_engagement_nudges_source_key_length check (
    char_length(trim(source_key)) between 3 and 160
  ),
  constraint profile_engagement_nudges_title_length check (
    char_length(trim(title)) between 1 and 160
  ),
  constraint profile_engagement_nudges_unique unique (
    profile_id,
    nudge_kind,
    source_key
  )
);

create index if not exists profile_engagement_nudges_profile_idx
  on public.profile_engagement_nudges (profile_id, delivered_at desc);

create index if not exists profile_engagement_nudges_kind_idx
  on public.profile_engagement_nudges (nudge_kind, delivered_at desc);

drop trigger if exists set_profile_engagement_nudges_updated_at on public.profile_engagement_nudges;
create trigger set_profile_engagement_nudges_updated_at
  before update on public.profile_engagement_nudges
  for each row execute function public.set_updated_at();

alter table public.profile_engagement_nudges enable row level security;

drop policy if exists "profile_engagement_nudges_select_self" on public.profile_engagement_nudges;
create policy "profile_engagement_nudges_select_self"
  on public.profile_engagement_nudges
  for select
  to authenticated
  using (auth.uid() = profile_id);

grant select on public.profile_engagement_nudges to authenticated;

create or replace function public.get_profile_engagement_nudge_signals(
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  last_nudge_at timestamptz;
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  select nudge.delivered_at
  into last_nudge_at
  from public.profile_engagement_nudges nudge
  where nudge.profile_id = input_profile_id
  order by nudge.delivered_at desc
  limit 1;

  return jsonb_build_object(
    'cooldownUntil',
    case
      when last_nudge_at is null then null
      else last_nudge_at + interval '45 minutes'
    end,
    'newDropsCount',
    coalesce(
      (
        select count(*)::integer
        from public.explore_listing_events listing
        where coalesce(listing.listed_at, listing.created_at) >=
          timezone('utc', now()) - interval '24 hours'
      ),
      0
    ),
    'latestLeaderboardUpdate',
    coalesce(
      (
        select jsonb_build_object(
          'id', update_item.id,
          'title', update_item.title,
          'body', update_item.body,
          'targetKey',
          coalesce(update_item.metadata ->> 'coinAddress', '/leaderboard')
        )
        from public.leaderboard_updates update_item
        where update_item.created_at >= timezone('utc', now()) - interval '72 hours'
        order by update_item.created_at desc
        limit 1
      ),
      'null'::jsonb
    ),
    'activeMissionCount',
    coalesce(
      (
        select count(*)::integer
        from public.missions mission
        where mission.status = 'active'
          and (mission.starts_at is null or mission.starts_at <= timezone('utc', now()))
          and (mission.ends_at is null or mission.ends_at >= timezone('utc', now()))
      ),
      0
    ),
    'latestMission',
    coalesce(
      (
        select jsonb_build_object(
          'id', mission.id,
          'slug', mission.slug,
          'title', mission.title,
          'rewardE1xp', mission.reward_e1xp
        )
        from public.missions mission
        where mission.status = 'active'
          and coalesce(mission.starts_at, mission.created_at) >=
            timezone('utc', now()) - interval '7 days'
          and (mission.starts_at is null or mission.starts_at <= timezone('utc', now()))
          and (mission.ends_at is null or mission.ends_at >= timezone('utc', now()))
        order by coalesce(mission.starts_at, mission.created_at) desc
        limit 1
      ),
      'null'::jsonb
    ),
    'topPerkMission',
    coalesce(
      (
        select jsonb_build_object(
          'id', mission.id,
          'slug', mission.slug,
          'title', mission.title,
          'rewardE1xp', mission.reward_e1xp
        )
        from public.missions mission
        where mission.status = 'active'
          and (mission.starts_at is null or mission.starts_at <= timezone('utc', now()))
          and (mission.ends_at is null or mission.ends_at >= timezone('utc', now()))
        order by mission.reward_e1xp desc, coalesce(mission.starts_at, mission.created_at) desc
        limit 1
      ),
      'null'::jsonb
    ),
    'missionWinners24h',
    coalesce(
      (
        select count(distinct progress.profile_id)::integer
        from public.mission_task_progress progress
        join public.mission_tasks task
          on task.id = progress.mission_task_id
        join public.missions mission
          on mission.id = task.mission_id
        where progress.claimed_at >= timezone('utc', now()) - interval '24 hours'
          and mission.status in ('active', 'completed', 'archived')
      ),
      0
    ),
    'activeCreatorOfWeek',
    coalesce(
      (
        select jsonb_build_object(
          'campaignId', campaign.id,
          'category', campaign.category,
          'creatorEarningsUsd', campaign.creator_earnings_usd,
          'displayName', profile.display_name,
          'featuredPriceUsd', campaign.featured_price_usd,
          'profileId', campaign.profile_id,
          'username', profile.username,
          'walletAddress', profile.wallet_address
        )
        from public.admin_creator_of_week_campaigns campaign
        join public.profiles profile
          on profile.id = campaign.profile_id
        where campaign.is_active = true
          and (campaign.starts_at is null or campaign.starts_at <= timezone('utc', now()))
          and (campaign.ends_at is null or campaign.ends_at >= timezone('utc', now()))
        order by coalesce(campaign.starts_at, campaign.created_at) desc
        limit 1
      ),
      'null'::jsonb
    )
  );
end;
$$;

create or replace function public.create_profile_engagement_nudge(
  input_profile_id uuid,
  input_nudge_kind text,
  input_source_key text,
  input_title text,
  input_body text default null,
  input_target_key text default null,
  input_data jsonb default '{}'::jsonb,
  input_cooldown_minutes integer default 45
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cooldown_minutes integer := greatest(coalesce(input_cooldown_minutes, 45), 5);
  existing_nudge public.profile_engagement_nudges%rowtype;
  inserted_notification public.notifications%rowtype;
  last_nudge_at timestamptz;
  normalized_kind public.engagement_nudge_kind;
  normalized_source_key text := trim(coalesce(input_source_key, ''));
  normalized_title text := trim(coalesce(input_title, ''));
begin
  if input_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  if normalized_source_key = '' then
    raise exception 'source_key is required';
  end if;

  if normalized_title = '' then
    raise exception 'title is required';
  end if;

  begin
    normalized_kind := lower(trim(input_nudge_kind))::public.engagement_nudge_kind;
  exception
    when others then
      raise exception 'unsupported nudge kind: %', input_nudge_kind;
  end;

  select nudge.delivered_at
  into last_nudge_at
  from public.profile_engagement_nudges nudge
  where nudge.profile_id = input_profile_id
  order by nudge.delivered_at desc
  limit 1;

  if last_nudge_at is not null
    and last_nudge_at > timezone('utc', now()) - make_interval(mins => cooldown_minutes) then
    return jsonb_build_object(
      'created', false,
      'reason', 'cooldown'
    );
  end if;

  select *
  into existing_nudge
  from public.profile_engagement_nudges nudge
  where nudge.profile_id = input_profile_id
    and nudge.nudge_kind = normalized_kind
    and nudge.source_key = normalized_source_key
  limit 1;

  if found then
    return jsonb_build_object(
      'created', false,
      'notificationId', existing_nudge.notification_id,
      'reason', 'duplicate'
    );
  end if;

  insert into public.notifications (
    recipient_id,
    kind,
    title,
    body,
    target_key,
    data,
    delivered_at
  )
  values (
    input_profile_id,
    'nudge',
    normalized_title,
    nullif(trim(coalesce(input_body, '')), ''),
    nullif(trim(coalesce(input_target_key, '')), ''),
    jsonb_build_object(
      'nudgeKind',
      normalized_kind::text,
      'sourceKey',
      normalized_source_key
    ) || coalesce(input_data, '{}'::jsonb),
    timezone('utc', now())
  )
  returning *
  into inserted_notification;

  insert into public.profile_engagement_nudges (
    profile_id,
    nudge_kind,
    source_key,
    title,
    body,
    target_key,
    data,
    notification_id,
    delivered_at,
    cooldown_until
  )
  values (
    input_profile_id,
    normalized_kind,
    normalized_source_key,
    normalized_title,
    nullif(trim(coalesce(input_body, '')), ''),
    nullif(trim(coalesce(input_target_key, '')), ''),
    coalesce(input_data, '{}'::jsonb),
    inserted_notification.id,
    inserted_notification.created_at,
    inserted_notification.created_at + make_interval(mins => cooldown_minutes)
  );

  return jsonb_build_object(
    'body', inserted_notification.body,
    'created', true,
    'createdAt', inserted_notification.created_at,
    'data', inserted_notification.data,
    'id', inserted_notification.id,
    'kind', inserted_notification.kind::text,
    'reason', null,
    'targetKey', inserted_notification.target_key,
    'title', inserted_notification.title
  );
end;
$$;

grant execute on function public.get_profile_engagement_nudge_signals(uuid) to anon, authenticated;
grant execute on function public.create_profile_engagement_nudge(uuid, text, text, text, text, text, jsonb, integer) to anon, authenticated;

comment on table public.profile_engagement_nudges is
  'Per-profile record of automated FOMO and engagement nudges that were delivered into the inbox to prevent spam and duplicate prompts.';
