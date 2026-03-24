do $$
begin
  if not exists (
    select 1
    from pg_type notification_type
    join pg_enum notification_enum
      on notification_enum.enumtypid = notification_type.oid
    where notification_type.typname = 'notification_kind'
      and notification_enum.enumlabel = 'follow'
  ) then
    alter type public.notification_kind add value 'follow';
  end if;
end
$$;

create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, followed_id),
  constraint profile_follows_distinct_profiles check (
    follower_id <> followed_id
  )
);

create index if not exists profile_follows_followed_idx
  on public.profile_follows (followed_id, created_at desc);

create index if not exists profile_follows_follower_idx
  on public.profile_follows (follower_id, created_at desc);

create or replace function public.get_profile_follow_stats(
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_count bigint := 0;
  following_count bigint := 0;
begin
  if input_profile_id is null then
    return jsonb_build_object(
      'profileId', null,
      'followers', 0,
      'following', 0
    );
  end if;

  select count(*)::bigint
  into follower_count
  from public.profile_follows profile_follow
  where profile_follow.followed_id = input_profile_id;

  select count(*)::bigint
  into following_count
  from public.profile_follows profile_follow
  where profile_follow.follower_id = input_profile_id;

  return jsonb_build_object(
    'profileId', input_profile_id,
    'followers', coalesce(follower_count, 0),
    'following', coalesce(following_count, 0)
  );
end;
$$;

create or replace function public.get_follow_relationship(
  input_viewer_profile_id uuid,
  input_target_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  followed_by_me boolean := false;
  following_me boolean := false;
begin
  if input_viewer_profile_id is null or input_target_profile_id is null then
    return jsonb_build_object(
      'isFollowedByMe', false,
      'isFollowingMe', false
    );
  end if;

  if input_viewer_profile_id = input_target_profile_id then
    return jsonb_build_object(
      'isFollowedByMe', false,
      'isFollowingMe', false
    );
  end if;

  select exists(
    select 1
    from public.profile_follows profile_follow
    where profile_follow.follower_id = input_viewer_profile_id
      and profile_follow.followed_id = input_target_profile_id
  )
  into followed_by_me;

  select exists(
    select 1
    from public.profile_follows profile_follow
    where profile_follow.follower_id = input_target_profile_id
      and profile_follow.followed_id = input_viewer_profile_id
  )
  into following_me;

  return jsonb_build_object(
    'isFollowedByMe', coalesce(followed_by_me, false),
    'isFollowingMe', coalesce(following_me, false)
  );
end;
$$;

create or replace function public.list_profile_followers(
  input_profile_id uuid,
  input_limit integer default 100
)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  wallet_address text,
  lens_account_address text,
  zora_handle text,
  followed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    follower_profile.id,
    follower_profile.username,
    follower_profile.display_name,
    follower_profile.bio,
    follower_profile.avatar_url,
    follower_profile.banner_url,
    follower_profile.wallet_address,
    follower_profile.lens_account_address,
    follower_profile.zora_handle,
    profile_follow.created_at as followed_at
  from public.profile_follows profile_follow
  join public.profiles follower_profile
    on follower_profile.id = profile_follow.follower_id
  where profile_follow.followed_id = input_profile_id
  order by profile_follow.created_at desc
  limit greatest(coalesce(input_limit, 100), 1);
$$;

create or replace function public.list_profile_following(
  input_profile_id uuid,
  input_limit integer default 100
)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  wallet_address text,
  lens_account_address text,
  zora_handle text,
  followed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    followed_profile.id,
    followed_profile.username,
    followed_profile.display_name,
    followed_profile.bio,
    followed_profile.avatar_url,
    followed_profile.banner_url,
    followed_profile.wallet_address,
    followed_profile.lens_account_address,
    followed_profile.zora_handle,
    profile_follow.created_at as followed_at
  from public.profile_follows profile_follow
  join public.profiles followed_profile
    on followed_profile.id = profile_follow.followed_id
  where profile_follow.follower_id = input_profile_id
  order by profile_follow.created_at desc
  limit greatest(coalesce(input_limit, 100), 1);
$$;

create or replace function public.follow_profile(
  input_follower_profile_id uuid,
  input_followed_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_profile public.profiles%rowtype;
  followed_profile public.profiles%rowtype;
  inserted_count integer := 0;
  actor_label text;
  created_notification_id uuid;
begin
  if input_follower_profile_id is null or input_followed_profile_id is null then
    return jsonb_build_object(
      'created', false,
      'following', false,
      'reason', 'missing_profile'
    );
  end if;

  if input_follower_profile_id = input_followed_profile_id then
    return jsonb_build_object(
      'created', false,
      'following', false,
      'reason', 'self_follow'
    );
  end if;

  select *
  into follower_profile
  from public.profiles
  where id = input_follower_profile_id;

  select *
  into followed_profile
  from public.profiles
  where id = input_followed_profile_id;

  if follower_profile.id is null or followed_profile.id is null then
    return jsonb_build_object(
      'created', false,
      'following', false,
      'reason', 'profile_not_found'
    );
  end if;

  insert into public.profile_follows (
    follower_id,
    followed_id
  )
  values (
    input_follower_profile_id,
    input_followed_profile_id
  )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    actor_label := coalesce(
      nullif(follower_profile.display_name, ''),
      nullif(follower_profile.username, ''),
      'A creator'
    );

    created_notification_id := public.create_notification(
      input_followed_profile_id,
      input_follower_profile_id,
      'follow',
      'New follower',
      format('%s started following you.', actor_label),
      null,
      input_follower_profile_id::text,
      jsonb_build_object(
        'followerProfileId',
        input_follower_profile_id
      )
    );
  end if;

  return jsonb_build_object(
    'created', inserted_count > 0,
    'following', true,
    'notificationId', created_notification_id,
    'targetProfileId', input_followed_profile_id
  );
end;
$$;

create or replace function public.unfollow_profile(
  input_follower_profile_id uuid,
  input_followed_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if input_follower_profile_id is null or input_followed_profile_id is null then
    return jsonb_build_object(
      'deleted', false,
      'following', false,
      'reason', 'missing_profile'
    );
  end if;

  delete from public.profile_follows profile_follow
  where profile_follow.follower_id = input_follower_profile_id
    and profile_follow.followed_id = input_followed_profile_id;

  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'deleted', deleted_count > 0,
    'following', false,
    'targetProfileId', input_followed_profile_id
  );
end;
$$;

alter table public.profile_follows enable row level security;

drop policy if exists "profile_follows_select_visible" on public.profile_follows;
create policy "profile_follows_select_visible"
  on public.profile_follows
  for select
  using (true);

grant execute on function public.get_profile_follow_stats(uuid) to anon, authenticated;
grant execute on function public.get_follow_relationship(uuid, uuid) to anon, authenticated;
grant execute on function public.list_profile_followers(uuid, integer) to anon, authenticated;
grant execute on function public.list_profile_following(uuid, integer) to anon, authenticated;
grant execute on function public.follow_profile(uuid, uuid) to anon, authenticated;
grant execute on function public.unfollow_profile(uuid, uuid) to anon, authenticated;

comment on table public.profile_follows is
  'Every1 follow graph for creator and friend discovery, powering follow buttons, profile counts, and follow notifications.';
