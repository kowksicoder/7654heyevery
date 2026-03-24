do $$
begin
  if not exists (
    select 1
    from pg_type notification_type
    join pg_enum notification_enum
      on notification_enum.enumtypid = notification_type.oid
    where notification_type.typname = 'notification_kind'
      and notification_enum.enumlabel = 'community'
  ) then
    alter type public.notification_kind add value 'community';
  end if;
end
$$;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  media_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint community_posts_body_length check (
    char_length(trim(body)) between 1 and 1600
  )
);

create index if not exists community_memberships_community_idx
  on public.community_memberships (community_id, status, updated_at desc);

create index if not exists community_posts_community_idx
  on public.community_posts (community_id, created_at desc);

create index if not exists community_posts_author_idx
  on public.community_posts (author_profile_id, created_at desc);

drop trigger if exists set_community_posts_updated_at on public.community_posts;
create trigger set_community_posts_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

alter table public.community_posts enable row level security;

drop policy if exists "community_posts_select_visible" on public.community_posts;
create policy "community_posts_select_visible"
  on public.community_posts
  for select
  using (
    exists (
      select 1
      from public.communities community
      where community.id = community_id
        and (
          (community.visibility = 'public' and community.status = 'active')
          or community.owner_id = auth.uid()
          or public.is_community_member(community.id)
        )
    )
  );

drop policy if exists "community_posts_insert_member" on public.community_posts;
create policy "community_posts_insert_member"
  on public.community_posts
  for insert
  to authenticated
  with check (
    auth.uid() = author_profile_id
    and exists (
      select 1
      from public.community_memberships membership
      where membership.community_id = community_id
        and membership.profile_id = author_profile_id
        and membership.status = 'active'
    )
  );

drop policy if exists "community_posts_update_author_or_admin" on public.community_posts;
create policy "community_posts_update_author_or_admin"
  on public.community_posts
  for update
  to authenticated
  using (
    auth.uid() = author_profile_id
    or public.is_community_admin(community_id)
  )
  with check (
    auth.uid() = author_profile_id
    or public.is_community_admin(community_id)
  );

drop policy if exists "community_posts_delete_author_or_admin" on public.community_posts;
create policy "community_posts_delete_author_or_admin"
  on public.community_posts
  for delete
  to authenticated
  using (
    auth.uid() = author_profile_id
    or public.is_community_admin(community_id)
  );

create or replace function public.create_community(
  input_owner_profile_id uuid,
  input_name text,
  input_slug text default null,
  input_description text default null,
  input_avatar_url text default null,
  input_banner_url text default null,
  input_visibility public.community_visibility default 'public'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := nullif(trim(input_name), '');
  normalized_slug text;
  created_community public.communities%rowtype;
begin
  if input_owner_profile_id is null then
    raise exception 'Owner profile is required.';
  end if;

  if normalized_name is null then
    raise exception 'Community name is required.';
  end if;

  normalized_slug := lower(
    regexp_replace(
      coalesce(nullif(trim(input_slug), ''), normalized_name),
      '[^a-zA-Z0-9-]',
      '-',
      'g'
    )
  );
  normalized_slug := regexp_replace(normalized_slug, '-{2,}', '-', 'g');
  normalized_slug := trim(both '-' from normalized_slug);

  if normalized_slug = '' then
    raise exception 'Community slug is required.';
  end if;

  insert into public.communities (
    owner_id,
    slug,
    name,
    description,
    avatar_url,
    banner_url,
    visibility,
    status
  )
  values (
    input_owner_profile_id,
    normalized_slug,
    normalized_name,
    nullif(trim(input_description), ''),
    nullif(trim(input_avatar_url), ''),
    nullif(trim(input_banner_url), ''),
    coalesce(input_visibility, 'public'),
    'active'
  )
  returning * into created_community;

  return jsonb_build_object(
    'communityId', created_community.id,
    'name', created_community.name,
    'slug', created_community.slug,
    'visibility', created_community.visibility,
    'status', created_community.status
  );
end;
$$;

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
  joined_at timestamptz
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
    membership_lookup.updated_at as joined_at
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
    case when input_feed_type = 'discover' then coalesce(member_counts.member_count, 0) else 0 end desc,
    coalesce(membership_lookup.updated_at, community.created_at) desc
  limit greatest(coalesce(input_limit, 50), 1);
$$;

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
  joined_at timestamptz
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
    membership_lookup.updated_at as joined_at
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

create or replace function public.list_community_members(
  input_community_id uuid,
  input_limit integer default 24
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  wallet_address text,
  role text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile.id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    profile.wallet_address,
    membership.role::text,
    membership.updated_at as joined_at
  from public.community_memberships membership
  inner join public.profiles profile
    on profile.id = membership.profile_id
  where membership.community_id = input_community_id
    and membership.status = 'active'
  order by
    case membership.role
      when 'owner' then 0
      when 'moderator' then 1
      else 2
    end asc,
    membership.updated_at asc
  limit greatest(coalesce(input_limit, 24), 1);
$$;

create or replace function public.join_community(
  input_community_id uuid,
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community public.communities%rowtype;
  target_membership public.community_memberships%rowtype;
  actor_profile public.profiles%rowtype;
  next_status public.community_member_status;
  created_notification_id uuid;
  actor_label text;
begin
  if input_community_id is null or input_profile_id is null then
    return jsonb_build_object(
      'communityId', input_community_id,
      'isMember', false,
      'reason', 'missing_profile',
      'status', null
    );
  end if;

  select *
  into target_community
  from public.communities
  where id = input_community_id
    and status = 'active';

  if target_community.id is null then
    return jsonb_build_object(
      'communityId', input_community_id,
      'isMember', false,
      'reason', 'community_not_found',
      'status', null
    );
  end if;

  if target_community.owner_id = input_profile_id then
    return jsonb_build_object(
      'communityId', input_community_id,
      'isMember', true,
      'reason', 'owner',
      'status', 'active'
    );
  end if;

  select *
  into actor_profile
  from public.profiles
  where id = input_profile_id;

  select *
  into target_membership
  from public.community_memberships membership
  where membership.community_id = input_community_id
    and membership.profile_id = input_profile_id;

  if target_membership.status = 'blocked' then
    return jsonb_build_object(
      'communityId', input_community_id,
      'isMember', false,
      'reason', 'blocked',
      'status', target_membership.status
    );
  end if;

  if target_membership.status = 'active' then
    return jsonb_build_object(
      'communityId', input_community_id,
      'isMember', true,
      'reason', 'already_member',
      'status', target_membership.status
    );
  end if;

  if target_membership.status = 'requested' then
    return jsonb_build_object(
      'communityId', input_community_id,
      'isMember', false,
      'reason', 'already_requested',
      'status', target_membership.status
    );
  end if;

  next_status := case
    when target_community.visibility = 'private' then 'requested'::public.community_member_status
    else 'active'::public.community_member_status
  end;

  insert into public.community_memberships (
    community_id,
    profile_id,
    role,
    status
  )
  values (
    input_community_id,
    input_profile_id,
    'member',
    next_status
  )
  on conflict (community_id, profile_id) do update
    set
      role = 'member',
      status = excluded.status
  returning * into target_membership;

  actor_label := coalesce(
    nullif(actor_profile.display_name, ''),
    nullif(actor_profile.username, ''),
    'A member'
  );

  if target_community.owner_id <> input_profile_id then
    created_notification_id := public.create_notification(
      target_community.owner_id,
      input_profile_id,
      'community',
      case
        when next_status = 'requested' then 'New community request'
        else 'New community member'
      end,
      case
        when next_status = 'requested' then format('%s requested to join %s.', actor_label, target_community.name)
        else format('%s joined %s.', actor_label, target_community.name)
      end,
      'community',
      input_community_id::text,
      jsonb_build_object(
        'communityId', input_community_id,
        'communitySlug', target_community.slug,
        'communityName', target_community.name,
        'eventType', case when next_status = 'requested' then 'join_request' else 'member_joined' end
      )
    );
  end if;

  return jsonb_build_object(
    'communityId', input_community_id,
    'isMember', next_status = 'active',
    'notificationId', created_notification_id,
    'reason', null,
    'status', next_status
  );
end;
$$;

create or replace function public.leave_community(
  input_community_id uuid,
  input_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community public.communities%rowtype;
  target_membership public.community_memberships%rowtype;
begin
  if input_community_id is null or input_profile_id is null then
    return jsonb_build_object(
      'communityId', input_community_id,
      'left', false,
      'reason', 'missing_profile'
    );
  end if;

  select *
  into target_community
  from public.communities
  where id = input_community_id;

  if target_community.id is null then
    return jsonb_build_object(
      'communityId', input_community_id,
      'left', false,
      'reason', 'community_not_found'
    );
  end if;

  if target_community.owner_id = input_profile_id then
    return jsonb_build_object(
      'communityId', input_community_id,
      'left', false,
      'reason', 'owner_cannot_leave'
    );
  end if;

  select *
  into target_membership
  from public.community_memberships membership
  where membership.community_id = input_community_id
    and membership.profile_id = input_profile_id;

  if target_membership.community_id is null then
    return jsonb_build_object(
      'communityId', input_community_id,
      'left', false,
      'reason', 'not_member'
    );
  end if;

  update public.community_memberships
  set status = 'left'
  where community_id = input_community_id
    and profile_id = input_profile_id;

  return jsonb_build_object(
    'communityId', input_community_id,
    'left', true,
    'reason', null,
    'status', 'left'
  );
end;
$$;

create or replace function public.list_community_posts(
  input_community_id uuid,
  input_profile_id uuid default null,
  input_limit integer default 50
)
returns table (
  id uuid,
  community_id uuid,
  author_profile_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  body text,
  media_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with target_community as (
    select
      community.id,
      community.owner_id,
      community.slug,
      community.name,
      community.visibility,
      community.status
    from public.communities community
    where community.id = input_community_id
      and community.status = 'active'
  )
  select
    post.id,
    post.community_id,
    author_profile.id as author_profile_id,
    author_profile.username as author_username,
    author_profile.display_name as author_display_name,
    author_profile.avatar_url as author_avatar_url,
    post.body,
    post.media_url,
    post.created_at,
    post.updated_at
  from public.community_posts post
  inner join target_community community
    on community.id = post.community_id
  inner join public.profiles author_profile
    on author_profile.id = post.author_profile_id
  where
    community.visibility = 'public'
    or community.owner_id = input_profile_id
    or exists (
      select 1
      from public.community_memberships membership
      where membership.community_id = post.community_id
        and membership.profile_id = input_profile_id
        and membership.status = 'active'
    )
  order by post.created_at desc
  limit greatest(coalesce(input_limit, 50), 1);
$$;

create or replace function public.create_community_post(
  input_community_id uuid,
  input_author_profile_id uuid,
  input_body text,
  input_media_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_community public.communities%rowtype;
  actor_profile public.profiles%rowtype;
  created_post public.community_posts%rowtype;
  actor_label text;
begin
  if input_community_id is null or input_author_profile_id is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'missing_profile'
    );
  end if;

  if nullif(trim(input_body), '') is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'empty_post'
    );
  end if;

  select *
  into target_community
  from public.communities
  where id = input_community_id
    and status = 'active';

  if target_community.id is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'community_not_found'
    );
  end if;

  if not exists (
    select 1
    from public.community_memberships membership
    where membership.community_id = input_community_id
      and membership.profile_id = input_author_profile_id
      and membership.status = 'active'
  ) and target_community.owner_id <> input_author_profile_id then
    return jsonb_build_object(
      'created', false,
      'reason', 'not_member'
    );
  end if;

  select *
  into actor_profile
  from public.profiles
  where id = input_author_profile_id;

  insert into public.community_posts (
    community_id,
    author_profile_id,
    body,
    media_url
  )
  values (
    input_community_id,
    input_author_profile_id,
    trim(input_body),
    nullif(trim(input_media_url), '')
  )
  returning * into created_post;

  actor_label := coalesce(
    nullif(actor_profile.display_name, ''),
    nullif(actor_profile.username, ''),
    'A member'
  );

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
    membership.profile_id,
    input_author_profile_id,
    'community',
    format('New post in %s', target_community.name),
    format('%s posted in %s.', actor_label, target_community.name),
    'community',
    input_community_id::text,
    jsonb_build_object(
      'communityId', input_community_id,
      'communitySlug', target_community.slug,
      'communityName', target_community.name,
      'eventType', 'new_post',
      'postId', created_post.id
    )
  from public.community_memberships membership
  where membership.community_id = input_community_id
    and membership.status = 'active'
    and membership.profile_id <> input_author_profile_id;

  if target_community.owner_id <> input_author_profile_id
    and not exists (
      select 1
      from public.community_memberships membership
      where membership.community_id = input_community_id
        and membership.profile_id = target_community.owner_id
        and membership.status = 'active'
    ) then
    perform public.create_notification(
      target_community.owner_id,
      input_author_profile_id,
      'community',
      format('New post in %s', target_community.name),
      format('%s posted in %s.', actor_label, target_community.name),
      'community',
      input_community_id::text,
      jsonb_build_object(
        'communityId', input_community_id,
        'communitySlug', target_community.slug,
        'communityName', target_community.name,
        'eventType', 'new_post',
        'postId', created_post.id
      )
    );
  end if;

  return jsonb_build_object(
    'created', true,
    'communityId', input_community_id,
    'postId', created_post.id,
    'reason', null
  );
end;
$$;

grant select on public.community_posts to anon, authenticated;
grant insert, update, delete on public.community_posts to authenticated;

grant execute on function public.create_community(uuid, text, text, text, text, text, public.community_visibility) to anon, authenticated;
grant execute on function public.list_profile_communities(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.get_community_by_slug(text, uuid) to anon, authenticated;
grant execute on function public.list_community_members(uuid, integer) to anon, authenticated;
grant execute on function public.join_community(uuid, uuid) to anon, authenticated;
grant execute on function public.leave_community(uuid, uuid) to anon, authenticated;
grant execute on function public.list_community_posts(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.create_community_post(uuid, uuid, text, text) to anon, authenticated;

comment on table public.community_posts is
  'Every1 off-chain community posts that power the new group feed and member discussion surfaces.';
