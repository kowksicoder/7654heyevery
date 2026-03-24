do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'special_event_delivery_kind'
  ) then
    create type public.special_event_delivery_kind as enum (
      'notification',
      'popup'
    );
  end if;
end
$$;

create table if not exists public.admin_creator_of_week_campaigns (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category text not null default 'Creators',
  banner_url text,
  featured_price_usd numeric(20, 4) not null default 0,
  creator_earnings_usd numeric(20, 4) not null default 0,
  note text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by_admin_id uuid references public.staff_admin_accounts (id) on delete set null,
  updated_by_admin_id uuid references public.staff_admin_accounts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_creator_of_week_campaigns_category_length check (
    char_length(trim(category)) between 1 and 64
  ),
  constraint admin_creator_of_week_campaigns_price_non_negative check (
    featured_price_usd >= 0
  ),
  constraint admin_creator_of_week_campaigns_earnings_non_negative check (
    creator_earnings_usd >= 0
  ),
  constraint admin_creator_of_week_campaigns_schedule_check check (
    ends_at is null or starts_at is null or ends_at >= starts_at
  )
);

create index if not exists admin_creator_of_week_campaigns_active_idx
  on public.admin_creator_of_week_campaigns (
    is_active,
    coalesce(starts_at, created_at) desc,
    created_at desc
  );

drop trigger if exists set_admin_creator_of_week_campaigns_updated_at on public.admin_creator_of_week_campaigns;
create trigger set_admin_creator_of_week_campaigns_updated_at
  before update on public.admin_creator_of_week_campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.admin_special_event_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  banner_url text,
  event_tag text,
  cta_label text,
  cta_url text,
  delivery_kind public.special_event_delivery_kind not null default 'notification',
  priority integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  triggered_at timestamptz,
  created_by_admin_id uuid references public.staff_admin_accounts (id) on delete set null,
  updated_by_admin_id uuid references public.staff_admin_accounts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_special_event_campaigns_title_length check (
    char_length(trim(title)) between 1 and 160
  ),
  constraint admin_special_event_campaigns_body_length check (
    char_length(trim(body)) between 1 and 500
  ),
  constraint admin_special_event_campaigns_event_tag_length check (
    event_tag is null or char_length(trim(event_tag)) between 1 and 48
  ),
  constraint admin_special_event_campaigns_schedule_check check (
    ends_at is null or starts_at is null or ends_at >= starts_at
  )
);

create index if not exists admin_special_event_campaigns_delivery_idx
  on public.admin_special_event_campaigns (
    delivery_kind,
    is_active,
    priority desc,
    created_at desc
  );

drop trigger if exists set_admin_special_event_campaigns_updated_at on public.admin_special_event_campaigns;
create trigger set_admin_special_event_campaigns_updated_at
  before update on public.admin_special_event_campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.profile_special_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.admin_special_event_campaigns (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  notification_id uuid references public.notifications (id) on delete set null,
  delivered_at timestamptz,
  popup_presented_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_special_event_deliveries_unique unique (campaign_id, profile_id)
);

create index if not exists profile_special_event_deliveries_profile_idx
  on public.profile_special_event_deliveries (
    profile_id,
    created_at desc
  );

create index if not exists profile_special_event_deliveries_campaign_idx
  on public.profile_special_event_deliveries (
    campaign_id,
    delivered_at desc
  );

drop trigger if exists set_profile_special_event_deliveries_updated_at on public.profile_special_event_deliveries;
create trigger set_profile_special_event_deliveries_updated_at
  before update on public.profile_special_event_deliveries
  for each row execute function public.set_updated_at();

create or replace function public.get_public_creator_of_week_campaign()
returns table (
  campaign_id uuid,
  profile_id uuid,
  category text,
  banner_url text,
  featured_price_usd numeric,
  creator_earnings_usd numeric,
  display_name text,
  username text,
  wallet_address text,
  zora_handle text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    campaign.id as campaign_id,
    profile.id as profile_id,
    campaign.category,
    campaign.banner_url,
    campaign.featured_price_usd,
    campaign.creator_earnings_usd,
    coalesce(profile.display_name, profile.username, profile.wallet_address) as display_name,
    profile.username,
    lower(profile.wallet_address) as wallet_address,
    lower(profile.zora_handle) as zora_handle,
    profile.avatar_url
  from public.admin_creator_of_week_campaigns campaign
  inner join public.profiles profile
    on profile.id = campaign.profile_id
  where campaign.is_active = true
    and (campaign.starts_at is null or campaign.starts_at <= timezone('utc', now()))
    and (campaign.ends_at is null or campaign.ends_at >= timezone('utc', now()))
  order by coalesce(campaign.starts_at, campaign.updated_at, campaign.created_at) desc,
    campaign.created_at desc
  limit 1;
$$;

create or replace function public.list_staff_creator_of_week_campaigns(
  input_session_token text
)
returns table (
  id uuid,
  profile_id uuid,
  display_name text,
  username text,
  wallet_address text,
  avatar_url text,
  category text,
  banner_url text,
  featured_price_usd numeric,
  creator_earnings_usd numeric,
  note text,
  is_active boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
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
  select
    campaign.id,
    profile.id,
    coalesce(profile.display_name, profile.username, profile.wallet_address),
    profile.username,
    profile.wallet_address,
    profile.avatar_url,
    campaign.category,
    campaign.banner_url,
    campaign.featured_price_usd,
    campaign.creator_earnings_usd,
    campaign.note,
    campaign.is_active,
    campaign.starts_at,
    campaign.ends_at,
    campaign.created_at,
    campaign.updated_at
  from public.admin_creator_of_week_campaigns campaign
  inner join public.profiles profile
    on profile.id = campaign.profile_id
  order by campaign.is_active desc,
    coalesce(campaign.starts_at, campaign.updated_at, campaign.created_at) desc,
    campaign.created_at desc;
end;
$$;

create or replace function public.staff_upsert_creator_of_week_campaign(
  input_session_token text,
  input_id uuid default null,
  input_profile_id uuid default null,
  input_category text default null,
  input_banner_url text default null,
  input_featured_price_usd numeric default 0,
  input_creator_earnings_usd numeric default 0,
  input_note text default null,
  input_is_active boolean default true,
  input_starts_at timestamptz default null,
  input_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_record record;
  target_profile public.profiles%rowtype;
  result public.admin_creator_of_week_campaigns%rowtype;
begin
  select *
  into actor_record
  from public.get_staff_admin_session(input_session_token)
  limit 1;

  if input_profile_id is null then
    raise exception 'Creator profile is required.';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = input_profile_id;

  if not found then
    raise exception 'Profile % not found.', input_profile_id;
  end if;

  if coalesce(input_featured_price_usd, 0) < 0 or coalesce(input_creator_earnings_usd, 0) < 0 then
    raise exception 'Price and earnings must not be negative.';
  end if;

  if input_ends_at is not null and input_starts_at is not null and input_ends_at < input_starts_at then
    raise exception 'End date must be after the start date.';
  end if;

  insert into public.admin_creator_of_week_campaigns (
    id,
    profile_id,
    category,
    banner_url,
    featured_price_usd,
    creator_earnings_usd,
    note,
    is_active,
    starts_at,
    ends_at,
    created_by_admin_id,
    updated_by_admin_id
  )
  values (
    coalesce(input_id, gen_random_uuid()),
    input_profile_id,
    coalesce(nullif(trim(input_category), ''), 'Creators'),
    nullif(trim(input_banner_url), ''),
    coalesce(input_featured_price_usd, 0),
    coalesce(input_creator_earnings_usd, 0),
    nullif(trim(input_note), ''),
    coalesce(input_is_active, true),
    input_starts_at,
    input_ends_at,
    actor_record.admin_id,
    actor_record.admin_id
  )
  on conflict (id) do update
    set
      profile_id = excluded.profile_id,
      category = excluded.category,
      banner_url = excluded.banner_url,
      featured_price_usd = excluded.featured_price_usd,
      creator_earnings_usd = excluded.creator_earnings_usd,
      note = excluded.note,
      is_active = excluded.is_active,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      updated_by_admin_id = actor_record.admin_id
  returning * into result;

  if result.is_active then
    update public.admin_creator_of_week_campaigns
    set
      is_active = false,
      updated_by_admin_id = actor_record.admin_id
    where id <> result.id
      and is_active = true;
  end if;

  return jsonb_build_object(
    'id', result.id,
    'profileId', result.profile_id,
    'title', coalesce(target_profile.display_name, target_profile.username, target_profile.wallet_address),
    'category', result.category,
    'isActive', result.is_active
  );
end;
$$;

create or replace function public.staff_delete_creator_of_week_campaign(
  input_session_token text,
  input_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  delete from public.admin_creator_of_week_campaigns
  where id = input_id;

  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'deleted', deleted_count > 0,
    'id', input_id
  );
end;
$$;

create or replace function public.list_staff_special_event_campaigns(
  input_session_token text
)
returns table (
  id uuid,
  title text,
  body text,
  banner_url text,
  event_tag text,
  cta_label text,
  cta_url text,
  delivery_kind text,
  priority integer,
  is_active boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  triggered_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
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
  select
    campaign.id,
    campaign.title,
    campaign.body,
    campaign.banner_url,
    campaign.event_tag,
    campaign.cta_label,
    campaign.cta_url,
    campaign.delivery_kind::text,
    campaign.priority,
    campaign.is_active,
    campaign.starts_at,
    campaign.ends_at,
    campaign.triggered_at,
    campaign.created_at,
    campaign.updated_at
  from public.admin_special_event_campaigns campaign
  order by campaign.is_active desc,
    campaign.priority desc,
    coalesce(campaign.triggered_at, campaign.updated_at, campaign.created_at) desc;
end;
$$;

create or replace function public.staff_upsert_special_event_campaign(
  input_session_token text,
  input_id uuid default null,
  input_title text default null,
  input_body text default null,
  input_banner_url text default null,
  input_event_tag text default null,
  input_cta_label text default null,
  input_cta_url text default null,
  input_delivery_kind public.special_event_delivery_kind default 'notification',
  input_priority integer default 0,
  input_is_active boolean default true,
  input_starts_at timestamptz default null,
  input_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_record record;
  result public.admin_special_event_campaigns%rowtype;
begin
  select *
  into actor_record
  from public.get_staff_admin_session(input_session_token)
  limit 1;

  if nullif(trim(coalesce(input_title, '')), '') is null then
    raise exception 'Event title is required.';
  end if;

  if nullif(trim(coalesce(input_body, '')), '') is null then
    raise exception 'Event body is required.';
  end if;

  if input_ends_at is not null and input_starts_at is not null and input_ends_at < input_starts_at then
    raise exception 'End date must be after the start date.';
  end if;

  insert into public.admin_special_event_campaigns (
    id,
    title,
    body,
    banner_url,
    event_tag,
    cta_label,
    cta_url,
    delivery_kind,
    priority,
    is_active,
    starts_at,
    ends_at,
    created_by_admin_id,
    updated_by_admin_id
  )
  values (
    coalesce(input_id, gen_random_uuid()),
    trim(input_title),
    trim(input_body),
    nullif(trim(input_banner_url), ''),
    nullif(trim(input_event_tag), ''),
    nullif(trim(input_cta_label), ''),
    nullif(trim(input_cta_url), ''),
    coalesce(input_delivery_kind, 'notification'),
    coalesce(input_priority, 0),
    coalesce(input_is_active, true),
    input_starts_at,
    input_ends_at,
    actor_record.admin_id,
    actor_record.admin_id
  )
  on conflict (id) do update
    set
      title = excluded.title,
      body = excluded.body,
      banner_url = excluded.banner_url,
      event_tag = excluded.event_tag,
      cta_label = excluded.cta_label,
      cta_url = excluded.cta_url,
      delivery_kind = excluded.delivery_kind,
      priority = excluded.priority,
      is_active = excluded.is_active,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      updated_by_admin_id = actor_record.admin_id
  returning * into result;

  return jsonb_build_object(
    'id', result.id,
    'title', result.title,
    'deliveryKind', result.delivery_kind,
    'isActive', result.is_active
  );
end;
$$;

create or replace function public.staff_delete_special_event_campaign(
  input_session_token text,
  input_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  delete from public.admin_special_event_campaigns
  where id = input_id;

  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'deleted', deleted_count > 0,
    'id', input_id
  );
end;
$$;

create or replace function public.staff_trigger_special_event_campaign(
  input_session_token text,
  input_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_record record;
  campaign_record public.admin_special_event_campaigns%rowtype;
  delivered_count integer := 0;
begin
  select *
  into actor_record
  from public.get_staff_admin_session(input_session_token)
  limit 1;

  select *
  into campaign_record
  from public.admin_special_event_campaigns
  where id = input_id;

  if not found then
    raise exception 'Special event campaign % not found.', input_id;
  end if;

  update public.admin_special_event_campaigns
  set
    is_active = true,
    triggered_at = timezone('utc', now()),
    updated_by_admin_id = actor_record.admin_id
  where id = input_id
  returning * into campaign_record;

  if campaign_record.delivery_kind = 'notification' then
    with inserted_notifications as (
      insert into public.notifications (
        recipient_id,
        actor_id,
        kind,
        title,
        body,
        target_kind,
        target_key,
        data
      )
      select
        profile.id,
        null,
        'system',
        campaign_record.title,
        campaign_record.body,
        null,
        'special-event:' || campaign_record.id::text,
        jsonb_build_object(
          'campaignId', campaign_record.id,
          'bannerUrl', campaign_record.banner_url,
          'ctaLabel', campaign_record.cta_label,
          'ctaUrl', campaign_record.cta_url,
          'deliveryKind', campaign_record.delivery_kind,
          'eventTag', campaign_record.event_tag
        )
      from public.profiles profile
      left join public.profile_special_event_deliveries delivery
        on delivery.campaign_id = campaign_record.id
       and delivery.profile_id = profile.id
      where delivery.id is null
      returning id, recipient_id
    )
    insert into public.profile_special_event_deliveries (
      campaign_id,
      profile_id,
      notification_id,
      delivered_at
    )
    select
      campaign_record.id,
      inserted_notifications.recipient_id,
      inserted_notifications.id,
      timezone('utc', now())
    from inserted_notifications;

    get diagnostics delivered_count = row_count;
  end if;

  return jsonb_build_object(
    'id', campaign_record.id,
    'title', campaign_record.title,
    'deliveryKind', campaign_record.delivery_kind,
    'isActive', campaign_record.is_active,
    'deliveredCount', delivered_count,
    'triggeredAt', campaign_record.triggered_at
  );
end;
$$;

create or replace function public.get_active_special_event_popup(
  input_profile_id uuid
)
returns table (
  id uuid,
  title text,
  body text,
  banner_url text,
  event_tag text,
  cta_label text,
  cta_url text,
  priority integer,
  triggered_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_record public.admin_special_event_campaigns%rowtype;
begin
  if input_profile_id is null then
    return;
  end if;

  select campaign.*
  into campaign_record
  from public.admin_special_event_campaigns campaign
  left join public.profile_special_event_deliveries delivery
    on delivery.campaign_id = campaign.id
   and delivery.profile_id = input_profile_id
  where campaign.delivery_kind = 'popup'
    and campaign.is_active = true
    and campaign.triggered_at is not null
    and (campaign.starts_at is null or campaign.starts_at <= timezone('utc', now()))
    and (campaign.ends_at is null or campaign.ends_at >= timezone('utc', now()))
    and (delivery.dismissed_at is null)
  order by campaign.priority desc,
    coalesce(campaign.triggered_at, campaign.updated_at, campaign.created_at) desc
  limit 1;

  if not found then
    return;
  end if;

  insert into public.profile_special_event_deliveries (
    campaign_id,
    profile_id,
    popup_presented_at
  )
  values (
    campaign_record.id,
    input_profile_id,
    timezone('utc', now())
  )
  on conflict (campaign_id, profile_id) do update
    set
      popup_presented_at = coalesce(
        public.profile_special_event_deliveries.popup_presented_at,
        timezone('utc', now())
      );

  return query
  select
    campaign_record.id,
    campaign_record.title,
    campaign_record.body,
    campaign_record.banner_url,
    campaign_record.event_tag,
    campaign_record.cta_label,
    campaign_record.cta_url,
    campaign_record.priority,
    campaign_record.triggered_at;
end;
$$;

create or replace function public.dismiss_special_event_popup(
  input_profile_id uuid,
  input_campaign_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if input_profile_id is null or input_campaign_id is null then
    return false;
  end if;

  insert into public.profile_special_event_deliveries (
    campaign_id,
    profile_id,
    popup_presented_at,
    dismissed_at
  )
  values (
    input_campaign_id,
    input_profile_id,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (campaign_id, profile_id) do update
    set
      popup_presented_at = coalesce(
        public.profile_special_event_deliveries.popup_presented_at,
        timezone('utc', now())
      ),
      dismissed_at = timezone('utc', now());

  return true;
end;
$$;

grant execute on function public.get_public_creator_of_week_campaign() to anon, authenticated;
grant execute on function public.list_staff_creator_of_week_campaigns(text) to anon, authenticated;
grant execute on function public.staff_upsert_creator_of_week_campaign(text, uuid, uuid, text, text, numeric, numeric, text, boolean, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.staff_delete_creator_of_week_campaign(text, uuid) to anon, authenticated;
grant execute on function public.list_staff_special_event_campaigns(text) to anon, authenticated;
grant execute on function public.staff_upsert_special_event_campaign(text, uuid, text, text, text, text, text, text, public.special_event_delivery_kind, integer, boolean, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.staff_delete_special_event_campaign(text, uuid) to anon, authenticated;
grant execute on function public.staff_trigger_special_event_campaign(text, uuid) to anon, authenticated;
grant execute on function public.get_active_special_event_popup(uuid) to anon, authenticated;
grant execute on function public.dismiss_special_event_popup(uuid, uuid) to anon, authenticated;
