create table if not exists public.community_chat_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint community_chat_messages_body_length check (
    char_length(trim(body)) between 1 and 400
  )
);

create index if not exists community_chat_messages_community_idx
  on public.community_chat_messages (community_id, created_at desc);

create index if not exists community_chat_messages_author_idx
  on public.community_chat_messages (author_profile_id, created_at desc);

alter table public.community_chat_messages enable row level security;

drop policy if exists "community_chat_messages_select_public" on public.community_chat_messages;
create policy "community_chat_messages_select_public"
  on public.community_chat_messages
  for select
  using (true);

drop policy if exists "community_chat_messages_insert_owner" on public.community_chat_messages;
create policy "community_chat_messages_insert_owner"
  on public.community_chat_messages
  for insert
  to authenticated
  with check (auth.uid() = author_profile_id);

create or replace function public.list_community_chat_messages(
  input_community_id uuid,
  input_viewer_profile_id uuid default null,
  input_limit integer default 150
)
returns table (
  id uuid,
  community_id uuid,
  author_profile_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  body text,
  created_at timestamptz
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
      community.visibility
    from public.communities community
    where community.id = input_community_id
  ),
  viewer_access as (
    select
      exists(
        select 1
        from target_community community
        where community.visibility = 'public'
          or community.owner_id = input_viewer_profile_id
      )
      or exists(
        select 1
        from public.community_memberships membership
        where membership.community_id = input_community_id
          and membership.profile_id = input_viewer_profile_id
          and membership.status = 'active'
      ) as can_view
  ),
  latest_messages as (
    select
      message.id,
      message.community_id,
      message.author_profile_id,
      message.body,
      message.created_at
    from public.community_chat_messages message
    where message.community_id = input_community_id
    order by message.created_at desc
    limit greatest(coalesce(input_limit, 150), 1)
  )
  select
    message.id,
    message.community_id,
    profile.id as author_profile_id,
    profile.username as author_username,
    profile.display_name as author_display_name,
    profile.avatar_url as author_avatar_url,
    message.body,
    message.created_at
  from latest_messages message
  inner join public.profiles profile
    on profile.id = message.author_profile_id
  where coalesce((select can_view from viewer_access), false)
  order by message.created_at asc;
$$;

create or replace function public.create_community_chat_message(
  input_community_id uuid,
  input_author_profile_id uuid,
  input_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_body text := nullif(trim(input_body), '');
  target_community public.communities%rowtype;
  can_chat boolean := false;
  created_message public.community_chat_messages%rowtype;
begin
  if input_author_profile_id is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'missing_profile'
    );
  end if;

  if input_community_id is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'missing_community'
    );
  end if;

  if normalized_body is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'empty_message'
    );
  end if;

  select *
  into target_community
  from public.communities
  where id = input_community_id;

  if target_community.id is null then
    return jsonb_build_object(
      'created', false,
      'reason', 'community_not_found'
    );
  end if;

  select exists(
    select 1
    from public.community_memberships membership
    where membership.community_id = input_community_id
      and membership.profile_id = input_author_profile_id
      and membership.status = 'active'
  )
  or target_community.owner_id = input_author_profile_id
  into can_chat;

  if not coalesce(can_chat, false) then
    return jsonb_build_object(
      'created', false,
      'reason', 'membership_required'
    );
  end if;

  insert into public.community_chat_messages (
    community_id,
    author_profile_id,
    body
  )
  values (
    input_community_id,
    input_author_profile_id,
    normalized_body
  )
  returning * into created_message;

  return jsonb_build_object(
    'communityId', created_message.community_id,
    'created', true,
    'messageId', created_message.id,
    'reason', null
  );
end;
$$;

grant select on public.community_chat_messages to anon, authenticated;
grant insert on public.community_chat_messages to authenticated;

grant execute on function public.list_community_chat_messages(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.create_community_chat_message(uuid, uuid, text) to anon, authenticated;

alter table public.community_chat_messages replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_chat_messages'
  ) then
    alter publication supabase_realtime add table public.community_chat_messages;
  end if;
end
$$;

comment on table public.community_chat_messages is
  'Every1 community chatroom messages with realtime presence and typing support.';
