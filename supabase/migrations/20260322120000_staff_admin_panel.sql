create table if not exists public.admin_profile_moderation (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  is_hidden boolean not null default false,
  is_blocked boolean not null default false,
  note text,
  updated_by_wallet text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_profile_moderation_hidden_idx
  on public.admin_profile_moderation (is_hidden, is_blocked, updated_at desc);

create table if not exists public.admin_coin_launch_overrides (
  launch_id uuid primary key references public.creator_launches (id) on delete cascade,
  is_hidden boolean not null default false,
  pinned_slot integer,
  note text,
  updated_by_wallet text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_coin_launch_overrides_pinned_slot_check check (
    pinned_slot is null or pinned_slot between 1 and 2
  )
);

create unique index if not exists admin_coin_launch_overrides_pinned_slot_unique_idx
  on public.admin_coin_launch_overrides (pinned_slot)
  where pinned_slot is not null;

create table if not exists public.admin_creator_overrides (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  is_hidden boolean not null default false,
  featured_order integer,
  note text,
  updated_by_wallet text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_creator_overrides_featured_order_check check (
    featured_order is null or featured_order between 1 and 24
  )
);

create unique index if not exists admin_creator_overrides_featured_order_unique_idx
  on public.admin_creator_overrides (featured_order)
  where featured_order is not null;

create table if not exists public.showcase_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  title text not null,
  description text not null,
  read_time text not null default '3 min read',
  published_at date not null default current_date,
  content jsonb not null default '[]'::jsonb,
  cover_class_name text not null,
  pill_class_name text not null,
  icon_key text not null default 'document',
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint showcase_posts_slug_format check (
    slug ~ '^[a-z0-9-]{3,96}$'
  ),
  constraint showcase_posts_title_length check (
    char_length(trim(title)) between 1 and 140
  ),
  constraint showcase_posts_description_length check (
    char_length(trim(description)) between 1 and 500
  ),
  constraint showcase_posts_content_is_array check (
    jsonb_typeof(content) = 'array'
  )
);

create index if not exists showcase_posts_published_idx
  on public.showcase_posts (is_published, published_at desc, sort_order asc);

drop trigger if exists set_admin_profile_moderation_updated_at on public.admin_profile_moderation;
create trigger set_admin_profile_moderation_updated_at
  before update on public.admin_profile_moderation
  for each row execute function public.set_updated_at();

drop trigger if exists set_admin_coin_launch_overrides_updated_at on public.admin_coin_launch_overrides;
create trigger set_admin_coin_launch_overrides_updated_at
  before update on public.admin_coin_launch_overrides
  for each row execute function public.set_updated_at();

drop trigger if exists set_admin_creator_overrides_updated_at on public.admin_creator_overrides;
create trigger set_admin_creator_overrides_updated_at
  before update on public.admin_creator_overrides
  for each row execute function public.set_updated_at();

drop trigger if exists set_showcase_posts_updated_at on public.showcase_posts;
create trigger set_showcase_posts_updated_at
  before update on public.showcase_posts
  for each row execute function public.set_updated_at();

insert into public.showcase_posts (
  slug,
  category,
  title,
  description,
  read_time,
  published_at,
  content,
  cover_class_name,
  pill_class_name,
  icon_key,
  is_published,
  sort_order
)
values
  (
    'inside-the-new-every1-mobile-experience',
    'Product',
    'Inside the new Every1 mobile experience',
    'A quick look at the latest feed, mobile create flow, and creator-first UI updates shipping across Every1.',
    '4 min read',
    date '2026-03-20',
    '[
      "Every1''s latest mobile pass is focused on speed, tighter layouts, and creator-first actions that feel natural on small screens.",
      "Across the feed, we cleaned up card density, improved grid browsing, and made discovery feel more alive with story rails, badge counts, and stronger signals for new listings.",
      "The mobile create flow is also becoming much more direct. Instead of dragging users through long setup steps, we are moving toward faster inputs, clearer preview states, and a cleaner path from idea to coin launch."
    ]'::jsonb,
    'bg-[radial-gradient(circle_at_18%_24%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_36%,#059669_100%)]',
    'bg-white/12 text-white ring-1 ring-white/20 backdrop-blur dark:bg-white/12',
    'device-phone-mobile',
    true,
    10
  ),
  (
    'designing-a-better-home-for-creators',
    'Creators',
    'Designing a better home for creators',
    'How creator coins, discovery rails, and showcase storytelling can work together across the platform.',
    '3 min read',
    date '2026-03-14',
    '[
      "A strong creator experience needs more than a profile page. It needs distribution, identity, monetization loops, and a clear reason for fans to come back.",
      "On Every1, creator coins, curated discovery, and showcase storytelling are meant to support one another. A creator should be discoverable in the feed, visible in ranking surfaces, and legible through their coin, posts, and public presence.",
      "This is the direction we are pushing: fewer disconnected surfaces, better signals for quality, and a cleaner path from being noticed to being supported."
    ]'::jsonb,
    'bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.26),transparent_24%),linear-gradient(140deg,#172554_0%,#1d4ed8_48%,#60a5fa_100%)]',
    'bg-white/14 text-white ring-1 ring-white/20 backdrop-blur dark:bg-white/14',
    'sparkles',
    true,
    20
  ),
  (
    'whats-next-for-the-every1-community-layer',
    'Community',
    'What''s next for the Every1 community layer',
    'A preview of the community loops we want to bring in next, from missions to streaks to better onboarding.',
    '5 min read',
    date '2026-03-07',
    '[
      "The next layer for Every1 is not just content. It is community behavior: referrals, missions, streaks, onboarding loops, and stronger reasons for users to keep showing up.",
      "We want the community layer to feel rewarding without becoming noisy. That means better routing for rewards, clearer surfaces for streaks and referrals, and tighter UX patterns that do not overload the core product.",
      "As the system grows, these loops should feel connected. Community should support creators, creators should support discovery, and rewards should reinforce the healthiest actions on the platform."
    ]'::jsonb,
    'bg-[radial-gradient(circle_at_16%_76%,rgba(255,255,255,0.22),transparent_26%),linear-gradient(135deg,#3f2d20_0%,#a16207_42%,#f59e0b_100%)]',
    'bg-white/16 text-white ring-1 ring-white/25 backdrop-blur dark:bg-white/16',
    'user-group',
    true,
    30
  )
on conflict (slug) do update
  set
    category = excluded.category,
    title = excluded.title,
    description = excluded.description,
    read_time = excluded.read_time,
    published_at = excluded.published_at,
    content = excluded.content,
    cover_class_name = excluded.cover_class_name,
    pill_class_name = excluded.pill_class_name,
    icon_key = excluded.icon_key,
    is_published = excluded.is_published,
    sort_order = excluded.sort_order;

create or replace function public.get_public_showcase_posts()
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
  sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    post.id,
    post.slug,
    post.category,
    post.title,
    post.description,
    post.read_time,
    post.published_at,
    post.content,
    post.cover_class_name,
    post.pill_class_name,
    post.icon_key,
    post.sort_order
  from public.showcase_posts post
  where post.is_published = true
  order by post.published_at desc, post.sort_order asc, post.created_at desc;
$$;

create or replace function public.get_public_explore_coin_overrides()
returns table (
  launch_id uuid,
  coin_address text,
  ticker text,
  is_hidden boolean,
  pinned_slot integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    launch.id,
    lower(launch.coin_address) as coin_address,
    lower(launch.ticker) as ticker,
    override.is_hidden,
    override.pinned_slot
  from public.admin_coin_launch_overrides override
  inner join public.creator_launches launch
    on launch.id = override.launch_id;
$$;

create or replace function public.get_public_creator_overrides()
returns table (
  profile_id uuid,
  wallet_address text,
  zora_handle text,
  lens_account_address text,
  is_hidden boolean,
  featured_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile.id,
    lower(profile.wallet_address) as wallet_address,
    lower(profile.zora_handle) as zora_handle,
    lower(profile.lens_account_address) as lens_account_address,
    override.is_hidden,
    override.featured_order
  from public.admin_creator_overrides override
  inner join public.profiles profile
    on profile.id = override.profile_id;
$$;

create or replace function public.get_staff_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with profile_counts as (
    select
      count(*)::bigint as total_users,
      count(*) filter (where coalesce(moderation.is_hidden, false) = true)::bigint as hidden_users,
      count(*) filter (where coalesce(moderation.is_blocked, false) = true)::bigint as blocked_users
    from public.profiles profile
    left join public.admin_profile_moderation moderation
      on moderation.profile_id = profile.id
  ),
  launch_counts as (
    select
      count(*)::bigint as total_launches,
      count(*) filter (where launch.status = 'launched')::bigint as launched_coins,
      count(*) filter (where coalesce(override.is_hidden, false) = true)::bigint as hidden_coins,
      count(*) filter (where override.pinned_slot is not null)::bigint as pinned_coins
    from public.creator_launches launch
    left join public.admin_coin_launch_overrides override
      on override.launch_id = launch.id
  ),
  creator_counts as (
    select
      count(*)::bigint as tracked_creators,
      count(*) filter (where coalesce(override.is_hidden, false) = true)::bigint as hidden_creators,
      count(*) filter (where override.featured_order is not null)::bigint as featured_creators
    from public.profiles profile
    left join public.admin_creator_overrides override
      on override.profile_id = profile.id
    where profile.wallet_address is not null
       or profile.zora_handle is not null
       or exists (
         select 1
         from public.creator_launches launch
         where launch.created_by = profile.id
       )
  ),
  referral_counts as (
    select
      count(*)::bigint as total_referrals,
      count(*) filter (where event.status = 'rewarded')::bigint as rewarded_referrals,
      coalesce(sum(event.reward_e1xp), 0)::bigint as referral_e1xp
    from public.referral_events event
  ),
  mission_counts as (
    select
      count(*)::bigint as total_missions,
      count(*) filter (where mission.status = 'active')::bigint as active_missions
    from public.missions mission
  ),
  e1xp_counts as (
    select
      coalesce(sum(ledger.amount), 0)::bigint as total_e1xp_issued,
      coalesce(
        sum(
          case
            when ledger.source in ('admin', 'manual_adjustment') then ledger.amount
            else 0
          end
        ),
        0
      )::bigint as manual_e1xp_issued
    from public.e1xp_ledger ledger
  ),
  payment_earnings as (
    select coalesce(sum(payment.amount), 0) as payment_volume
    from public.payment_transactions payment
    where payment.status = 'succeeded'
  ),
  referral_rewards as (
    select coalesce(sum(reward.reward_amount), 0) as referral_coin_rewards
    from public.referral_trade_rewards reward
  ),
  showcase_counts as (
    select
      count(*)::bigint as total_posts,
      count(*) filter (where is_published = true)::bigint as published_posts
    from public.showcase_posts
  )
  select jsonb_build_object(
    'users', to_jsonb(profile_counts.*),
    'launches', to_jsonb(launch_counts.*),
    'creators', to_jsonb(creator_counts.*),
    'referrals', to_jsonb(referral_counts.*),
    'missions', to_jsonb(mission_counts.*),
    'e1xp', to_jsonb(e1xp_counts.*),
    'earnings', jsonb_build_object(
      'paymentVolume', payment_earnings.payment_volume,
      'referralCoinRewards', referral_rewards.referral_coin_rewards
    ),
    'showcase', to_jsonb(showcase_counts.*)
  )
  from profile_counts,
       launch_counts,
       creator_counts,
       referral_counts,
       mission_counts,
       e1xp_counts,
       payment_earnings,
       referral_rewards,
       showcase_counts;
$$;

create or replace function public.list_staff_users(
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
language sql
stable
security definer
set search_path = public
as $$
  with launch_counts as (
    select created_by, count(*)::bigint as launches_count
    from public.creator_launches
    group by created_by
  ),
  referral_counts as (
    select referrer_id, count(*)::bigint as referrals_count
    from public.referral_events
    group by referrer_id
  )
  select
    profile.id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    profile.wallet_address,
    profile.zora_handle,
    profile.created_at,
    coalesce(launch_counts.launches_count, 0),
    coalesce(referral_counts.referrals_count, 0),
    coalesce(balance.total_e1xp, 0),
    coalesce(moderation.is_hidden, false),
    coalesce(moderation.is_blocked, false)
  from public.profiles profile
  left join launch_counts
    on launch_counts.created_by = profile.id
  left join referral_counts
    on referral_counts.referrer_id = profile.id
  left join public.profile_e1xp_balances balance
    on balance.profile_id = profile.id
  left join public.admin_profile_moderation moderation
    on moderation.profile_id = profile.id
  where input_search is null
     or input_search = ''
     or coalesce(profile.display_name, '') ilike '%' || input_search || '%'
     or coalesce(profile.username, '') ilike '%' || input_search || '%'
     or coalesce(profile.wallet_address, '') ilike '%' || input_search || '%'
     or coalesce(profile.zora_handle, '') ilike '%' || input_search || '%'
  order by profile.created_at desc
  limit greatest(coalesce(input_limit, 40), 1)
  offset greatest(coalesce(input_offset, 0), 0);
$$;

create or replace function public.list_staff_profile_launches(
  input_profile_id uuid
)
returns table (
  launch_id uuid,
  ticker text,
  name text,
  status public.creator_launch_status,
  coin_address text,
  created_at timestamptz,
  launched_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    launch.id,
    launch.ticker,
    launch.name,
    launch.status,
    launch.coin_address,
    launch.created_at,
    launch.launched_at
  from public.creator_launches launch
  where launch.created_by = input_profile_id
  order by coalesce(launch.launched_at, launch.created_at) desc;
$$;

create or replace function public.list_staff_coin_launches(
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
  status public.creator_launch_status,
  coin_address text,
  cover_image_url text,
  created_at timestamptz,
  launched_at timestamptz,
  is_hidden boolean,
  pinned_slot integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    launch.id,
    profile.id,
    coalesce(profile.display_name, profile.username, profile.wallet_address),
    profile.username,
    launch.ticker,
    launch.name,
    launch.status,
    launch.coin_address,
    launch.cover_image_url,
    launch.created_at,
    launch.launched_at,
    coalesce(override.is_hidden, false),
    override.pinned_slot
  from public.creator_launches launch
  inner join public.profiles profile
    on profile.id = launch.created_by
  left join public.admin_coin_launch_overrides override
    on override.launch_id = launch.id
  where input_search is null
     or input_search = ''
     or launch.ticker ilike '%' || input_search || '%'
     or launch.name ilike '%' || input_search || '%'
     or coalesce(profile.display_name, '') ilike '%' || input_search || '%'
     or coalesce(profile.username, '') ilike '%' || input_search || '%'
  order by coalesce(override.pinned_slot, 99), coalesce(launch.launched_at, launch.created_at) desc
  limit greatest(coalesce(input_limit, 50), 1)
  offset greatest(coalesce(input_offset, 0), 0);
$$;

create or replace function public.list_staff_referrals(
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
  status public.referral_status,
  reward_e1xp integer,
  referred_trade_count integer,
  joined_at timestamptz,
  rewarded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event.id,
    coalesce(referrer.display_name, referrer.username, referrer.wallet_address),
    referrer.username,
    coalesce(referred.display_name, referred.username, referred.wallet_address, event.referred_identifier),
    referred.username,
    referred.wallet_address,
    event.status,
    event.reward_e1xp,
    event.referred_trade_count,
    event.joined_at,
    event.rewarded_at
  from public.referral_events event
  inner join public.profiles referrer
    on referrer.id = event.referrer_id
  left join public.profiles referred
    on referred.id = event.referred_profile_id
  order by coalesce(event.rewarded_at, event.joined_at, event.created_at) desc
  limit greatest(coalesce(input_limit, 50), 1)
  offset greatest(coalesce(input_offset, 0), 0);
$$;

create or replace function public.list_staff_earnings(
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  item_kind text,
  item_id uuid,
  profile_name text,
  profile_username text,
  wallet_address text,
  amount numeric,
  currency text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with items as (
    select
      'payment'::text as item_kind,
      payment.id as item_id,
      coalesce(profile.display_name, profile.username, profile.wallet_address) as profile_name,
      profile.username as profile_username,
      profile.wallet_address,
      payment.amount,
      payment.currency,
      payment.status::text as status,
      payment.created_at
    from public.payment_transactions payment
    inner join public.profiles profile
      on profile.id = payment.profile_id

    union all

    select
      'referral_reward'::text as item_kind,
      reward.id as item_id,
      coalesce(profile.display_name, profile.username, profile.wallet_address) as profile_name,
      profile.username as profile_username,
      profile.wallet_address,
      reward.reward_amount,
      reward.coin_symbol,
      reward.trade_side,
      reward.created_at
    from public.referral_trade_rewards reward
    inner join public.profiles profile
      on profile.id = reward.referrer_id
  )
  select *
  from items
  order by created_at desc
  limit greatest(coalesce(input_limit, 50), 1)
  offset greatest(coalesce(input_offset, 0), 0);
$$;

create or replace function public.list_staff_e1xp_activity(
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  ledger_id uuid,
  profile_id uuid,
  profile_name text,
  profile_username text,
  wallet_address text,
  amount integer,
  source text,
  description text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ledger.id,
    profile.id,
    coalesce(profile.display_name, profile.username, profile.wallet_address),
    profile.username,
    profile.wallet_address,
    ledger.amount,
    ledger.source,
    ledger.description,
    ledger.created_at
  from public.e1xp_ledger ledger
  inner join public.profiles profile
    on profile.id = ledger.profile_id
  order by ledger.created_at desc
  limit greatest(coalesce(input_limit, 50), 1)
  offset greatest(coalesce(input_offset, 0), 0);
$$;

create or replace function public.list_staff_missions()
returns table (
  mission_id uuid,
  slug text,
  title text,
  status public.mission_status,
  reward_e1xp integer,
  task_count bigint,
  participant_count bigint,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mission.id,
    mission.slug,
    mission.title,
    mission.status,
    mission.reward_e1xp,
    count(distinct task.id)::bigint as task_count,
    count(distinct progress.profile_id)::bigint as participant_count,
    mission.starts_at,
    mission.ends_at
  from public.missions mission
  left join public.mission_tasks task
    on task.mission_id = mission.id
  left join public.mission_task_progress progress
    on progress.mission_task_id = task.id
  group by mission.id
  order by mission.created_at desc;
$$;

create or replace function public.list_staff_showcase_posts()
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
language sql
stable
security definer
set search_path = public
as $$
  select
    post.id,
    post.slug,
    post.category,
    post.title,
    post.description,
    post.read_time,
    post.published_at,
    post.content,
    post.cover_class_name,
    post.pill_class_name,
    post.icon_key,
    post.is_published,
    post.sort_order,
    post.created_at
  from public.showcase_posts post
  order by post.published_at desc, post.sort_order asc, post.created_at desc;
$$;

create or replace function public.list_staff_creators(
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
language sql
stable
security definer
set search_path = public
as $$
  with launch_counts as (
    select created_by, count(*)::bigint as launches_count
    from public.creator_launches
    group by created_by
  )
  select
    profile.id,
    coalesce(profile.display_name, profile.username, profile.wallet_address),
    profile.username,
    profile.wallet_address,
    profile.avatar_url,
    coalesce(launch_counts.launches_count, 0),
    coalesce(balance.total_e1xp, 0),
    coalesce(override.is_hidden, false),
    override.featured_order
  from public.profiles profile
  left join launch_counts
    on launch_counts.created_by = profile.id
  left join public.profile_e1xp_balances balance
    on balance.profile_id = profile.id
  left join public.admin_creator_overrides override
    on override.profile_id = profile.id
  where (
      profile.wallet_address is not null
      or profile.zora_handle is not null
      or coalesce(launch_counts.launches_count, 0) > 0
    )
    and (
      input_search is null
      or input_search = ''
      or coalesce(profile.display_name, '') ilike '%' || input_search || '%'
      or coalesce(profile.username, '') ilike '%' || input_search || '%'
      or coalesce(profile.wallet_address, '') ilike '%' || input_search || '%'
      or coalesce(profile.zora_handle, '') ilike '%' || input_search || '%'
    )
  order by coalesce(override.featured_order, 999), coalesce(launch_counts.launches_count, 0) desc, profile.created_at desc
  limit greatest(coalesce(input_limit, 40), 1)
  offset greatest(coalesce(input_offset, 0), 0);
$$;

create or replace function public.staff_upsert_external_profile(
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
language sql
security definer
set search_path = public
as $$
  select public.upsert_external_profile(
    input_wallet_address,
    input_lens_account_address,
    input_username,
    input_display_name,
    input_bio,
    input_avatar_url,
    input_banner_url,
    input_zora_handle
  );
$$;

create or replace function public.staff_set_profile_moderation(
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
declare
  target_profile public.profiles%rowtype;
  result jsonb;
begin
  select *
  into target_profile
  from public.profiles
  where id = input_profile_id;

  if not found then
    raise exception 'Profile % not found.', input_profile_id;
  end if;

  insert into public.admin_profile_moderation (
    profile_id,
    is_hidden,
    is_blocked,
    note,
    updated_by_wallet
  )
  values (
    input_profile_id,
    coalesce(input_is_hidden, false),
    coalesce(input_is_blocked, false),
    nullif(trim(input_note), ''),
    lower(nullif(trim(input_updated_by_wallet), ''))
  )
  on conflict (profile_id) do update
    set
      is_hidden = excluded.is_hidden,
      is_blocked = excluded.is_blocked,
      note = excluded.note,
      updated_by_wallet = excluded.updated_by_wallet
  returning jsonb_build_object(
    'profileId', profile_id,
    'isHidden', is_hidden,
    'isBlocked', is_blocked,
    'note', note
  ) into result;

  return result;
end;
$$;

create or replace function public.staff_delete_profile(
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.profiles
  where id = input_profile_id;

  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'deleted', deleted_count > 0,
    'profileId', input_profile_id
  );
end;
$$;

create or replace function public.staff_set_coin_launch_override(
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
declare
  target_launch public.creator_launches%rowtype;
  result jsonb;
begin
  select *
  into target_launch
  from public.creator_launches
  where id = input_launch_id;

  if not found then
    raise exception 'Launch % not found.', input_launch_id;
  end if;

  if input_pinned_slot is not null and input_pinned_slot not between 1 and 2 then
    raise exception 'Pinned slot must be 1, 2, or null.';
  end if;

  if input_pinned_slot is not null then
    update public.admin_coin_launch_overrides
    set pinned_slot = null
    where pinned_slot = input_pinned_slot
      and launch_id <> input_launch_id;
  end if;

  insert into public.admin_coin_launch_overrides (
    launch_id,
    is_hidden,
    pinned_slot,
    note,
    updated_by_wallet
  )
  values (
    input_launch_id,
    coalesce(input_is_hidden, false),
    input_pinned_slot,
    nullif(trim(input_note), ''),
    lower(nullif(trim(input_updated_by_wallet), ''))
  )
  on conflict (launch_id) do update
    set
      is_hidden = excluded.is_hidden,
      pinned_slot = excluded.pinned_slot,
      note = excluded.note,
      updated_by_wallet = excluded.updated_by_wallet
  returning jsonb_build_object(
    'launchId', launch_id,
    'isHidden', is_hidden,
    'pinnedSlot', pinned_slot,
    'note', note
  ) into result;

  return result;
end;
$$;

create or replace function public.staff_set_creator_override(
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
declare
  target_profile public.profiles%rowtype;
  result jsonb;
begin
  select *
  into target_profile
  from public.profiles
  where id = input_profile_id;

  if not found then
    raise exception 'Profile % not found.', input_profile_id;
  end if;

  if input_featured_order is not null and input_featured_order not between 1 and 24 then
    raise exception 'Featured order must be between 1 and 24 or null.';
  end if;

  if input_featured_order is not null then
    update public.admin_creator_overrides
    set featured_order = null
    where featured_order = input_featured_order
      and profile_id <> input_profile_id;
  end if;

  insert into public.admin_creator_overrides (
    profile_id,
    is_hidden,
    featured_order,
    note,
    updated_by_wallet
  )
  values (
    input_profile_id,
    coalesce(input_is_hidden, false),
    input_featured_order,
    nullif(trim(input_note), ''),
    lower(nullif(trim(input_updated_by_wallet), ''))
  )
  on conflict (profile_id) do update
    set
      is_hidden = excluded.is_hidden,
      featured_order = excluded.featured_order,
      note = excluded.note,
      updated_by_wallet = excluded.updated_by_wallet
  returning jsonb_build_object(
    'profileId', profile_id,
    'isHidden', is_hidden,
    'featuredOrder', featured_order,
    'note', note
  ) into result;

  return result;
end;
$$;

create or replace function public.staff_grant_e1xp(
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
declare
  target_profile public.profiles%rowtype;
  notification_id uuid;
  ledger_id uuid;
begin
  if coalesce(input_amount, 0) = 0 then
    raise exception 'E1XP amount must not be zero.';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = input_profile_id;

  if not found then
    raise exception 'Profile % not found.', input_profile_id;
  end if;

  insert into public.e1xp_ledger (
    profile_id,
    source,
    source_key,
    amount,
    description,
    metadata
  )
  values (
    input_profile_id,
    'admin',
    nullif(trim(input_source_key), ''),
    input_amount,
    coalesce(nullif(trim(input_description), ''), 'Manual E1XP grant'),
    coalesce(input_metadata, '{}'::jsonb)
  )
  returning id into ledger_id;

  notification_id := public.create_notification(
    input_profile_id,
    input_actor_profile_id,
    'reward',
    'Manual E1XP update',
    format('%s E1XP has been added to your account.', input_amount),
    null,
    null,
    jsonb_build_object(
      'amount', input_amount,
      'ledgerId', ledger_id,
      'source', 'admin'
    )
  );

  return jsonb_build_object(
    'ledgerId', ledger_id,
    'notificationId', notification_id,
    'profileId', input_profile_id,
    'amount', input_amount
  );
end;
$$;

create or replace function public.staff_upsert_showcase_post(
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
declare
  normalized_slug text := lower(
    regexp_replace(coalesce(input_slug, ''), '[^a-zA-Z0-9-]', '-', 'g')
  );
  result public.showcase_posts%rowtype;
begin
  normalized_slug := regexp_replace(normalized_slug, '-{2,}', '-', 'g');
  normalized_slug := trim(both '-' from normalized_slug);

  if normalized_slug = '' then
    raise exception 'Showcase slug is required.';
  end if;

  if jsonb_typeof(coalesce(input_content, '[]'::jsonb)) <> 'array' then
    raise exception 'Showcase content must be a JSON array of paragraphs.';
  end if;

  insert into public.showcase_posts (
    id,
    slug,
    category,
    title,
    description,
    read_time,
    published_at,
    content,
    cover_class_name,
    pill_class_name,
    icon_key,
    is_published,
    sort_order,
    created_by,
    updated_by
  )
  values (
    coalesce(input_id, gen_random_uuid()),
    normalized_slug,
    coalesce(nullif(trim(input_category), ''), 'Product'),
    coalesce(nullif(trim(input_title), ''), 'Untitled update'),
    coalesce(nullif(trim(input_description), ''), 'Every1 showcase update.'),
    coalesce(nullif(trim(input_read_time), ''), '3 min read'),
    coalesce(input_published_at, current_date),
    coalesce(input_content, '[]'::jsonb),
    coalesce(
      nullif(trim(input_cover_class_name), ''),
      'bg-[linear-gradient(135deg,#111827_0%,#1f2937_50%,#10b981_100%)]'
    ),
    coalesce(
      nullif(trim(input_pill_class_name), ''),
      'bg-white/12 text-white ring-1 ring-white/20 backdrop-blur dark:bg-white/12'
    ),
    coalesce(nullif(trim(input_icon_key), ''), 'document'),
    coalesce(input_is_published, true),
    coalesce(input_sort_order, 0),
    input_updated_by_profile_id,
    input_updated_by_profile_id
  )
  on conflict (id) do update
    set
      slug = excluded.slug,
      category = excluded.category,
      title = excluded.title,
      description = excluded.description,
      read_time = excluded.read_time,
      published_at = excluded.published_at,
      content = excluded.content,
      cover_class_name = excluded.cover_class_name,
      pill_class_name = excluded.pill_class_name,
      icon_key = excluded.icon_key,
      is_published = excluded.is_published,
      sort_order = excluded.sort_order,
      updated_by = excluded.updated_by
  returning * into result;

  return jsonb_build_object(
    'id', result.id,
    'slug', result.slug,
    'title', result.title,
    'isPublished', result.is_published
  );
end;
$$;

create or replace function public.staff_delete_showcase_post(
  input_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.showcase_posts
  where id = input_id;

  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'deleted', deleted_count > 0,
    'id', input_id
  );
end;
$$;

grant execute on function public.get_public_showcase_posts() to anon, authenticated;
grant execute on function public.get_public_explore_coin_overrides() to anon, authenticated;
grant execute on function public.get_public_creator_overrides() to anon, authenticated;
grant execute on function public.get_staff_dashboard() to anon, authenticated;
grant execute on function public.list_staff_users(text, integer, integer) to anon, authenticated;
grant execute on function public.list_staff_profile_launches(uuid) to anon, authenticated;
grant execute on function public.list_staff_coin_launches(text, integer, integer) to anon, authenticated;
grant execute on function public.list_staff_referrals(integer, integer) to anon, authenticated;
grant execute on function public.list_staff_earnings(integer, integer) to anon, authenticated;
grant execute on function public.list_staff_e1xp_activity(integer, integer) to anon, authenticated;
grant execute on function public.list_staff_missions() to anon, authenticated;
grant execute on function public.list_staff_showcase_posts() to anon, authenticated;
grant execute on function public.list_staff_creators(text, integer, integer) to anon, authenticated;
grant execute on function public.staff_upsert_external_profile(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.staff_set_profile_moderation(uuid, boolean, boolean, text, text) to anon, authenticated;
grant execute on function public.staff_delete_profile(uuid) to anon, authenticated;
grant execute on function public.staff_set_coin_launch_override(uuid, boolean, integer, text, text) to anon, authenticated;
grant execute on function public.staff_set_creator_override(uuid, boolean, integer, text, text) to anon, authenticated;
grant execute on function public.staff_grant_e1xp(uuid, integer, text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.staff_upsert_showcase_post(uuid, text, text, text, text, text, date, jsonb, text, text, text, boolean, integer, uuid) to anon, authenticated;
grant execute on function public.staff_delete_showcase_post(uuid) to anon, authenticated;
