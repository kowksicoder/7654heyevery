do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'push_delivery_status'
  ) then
    create type public.push_delivery_status as enum (
      'pending',
      'sent',
      'failed'
    );
  end if;
end
$$;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint push_subscriptions_endpoint_length check (
    char_length(trim(endpoint)) between 20 and 500
  ),
  constraint push_subscriptions_key_length check (
    char_length(trim(p256dh)) between 16 and 512
    and char_length(trim(auth)) between 8 and 512
  )
);

create index if not exists push_subscriptions_profile_idx
  on public.push_subscriptions (profile_id, is_active, updated_at desc);

create table if not exists public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  status public.push_delivery_status not null default 'pending',
  error_message text,
  response_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_push_deliveries_unique unique (
    notification_id,
    subscription_id
  )
);

create index if not exists notification_push_deliveries_pending_idx
  on public.notification_push_deliveries (status, created_at asc);

create index if not exists notification_push_deliveries_notification_idx
  on public.notification_push_deliveries (notification_id, status, created_at desc);

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists set_notification_push_deliveries_updated_at on public.notification_push_deliveries;
create trigger set_notification_push_deliveries_updated_at
  before update on public.notification_push_deliveries
  for each row execute function public.set_updated_at();

create or replace function public.enqueue_notification_push_deliveries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind not in (
    'community',
    'follow',
    'mission',
    'nudge',
    'payment',
    'referral',
    'reward',
    'streak',
    'system',
    'toast',
    'welcome'
  ) then
    return new;
  end if;

  insert into public.notification_push_deliveries (
    notification_id,
    subscription_id,
    status
  )
  select
    new.id,
    subscription.id,
    'pending'
  from public.push_subscriptions subscription
  where subscription.profile_id = new.recipient_id
    and subscription.is_active = true
  on conflict (notification_id, subscription_id) do nothing;

  return new;
end;
$$;

drop trigger if exists notifications_enqueue_push_deliveries on public.notifications;
create trigger notifications_enqueue_push_deliveries
  after insert on public.notifications
  for each row execute function public.enqueue_notification_push_deliveries();

alter table public.push_subscriptions enable row level security;
alter table public.notification_push_deliveries enable row level security;

grant select on public.push_subscriptions to authenticated;
grant select on public.notification_push_deliveries to authenticated;

comment on table public.push_subscriptions is
  'Browser push subscriptions bound to Every1 profiles for real device notifications.';

comment on table public.notification_push_deliveries is
  'Queued, sent, and failed web-push delivery attempts for Every1 notifications.';
