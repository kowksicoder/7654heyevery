create or replace function public.list_verified_communities_by_owner_wallets(
  input_wallet_addresses text[]
)
returns table (
  wallet_address text,
  community_id uuid,
  community_slug text,
  community_name text,
  community_avatar_url text,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with normalized_wallets as (
    select distinct lower(trim(wallet)) as wallet_address
    from unnest(coalesce(input_wallet_addresses, array[]::text[])) as wallet
    where nullif(trim(wallet), '') is not null
  )
  select distinct on (wallet_lookup.wallet_address)
    owner_profile.wallet_address,
    community.id as community_id,
    community.slug as community_slug,
    community.name as community_name,
    coalesce(community.avatar_url, community.banner_url) as community_avatar_url,
    community.verified_at
  from normalized_wallets wallet_lookup
  inner join public.profiles owner_profile
    on lower(coalesce(owner_profile.wallet_address, '')) = wallet_lookup.wallet_address
  inner join public.communities community
    on community.owner_id = owner_profile.id
  where community.status = 'active'
    and community.verification_status = 'verified'
  order by
    wallet_lookup.wallet_address,
    community.verified_at desc nulls last,
    community.created_at desc;
$$;

grant execute on function public.list_verified_communities_by_owner_wallets(text[]) to anon, authenticated;
