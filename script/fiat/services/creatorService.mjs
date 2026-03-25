import { getCoin, setApiKey } from "@zoralabs/coins-sdk";
import { isAddress } from "viem";
import { base } from "viem/chains";
import {
  asMoney,
  assert,
  isUuid,
  normalizePaginationLimit
} from "../utils.mjs";

const parseMetric = (value) => {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

const createLiveCoinSnapshot = (coin, ngnPerUsd) => {
  const marketCapUsd = parseMetric(coin?.marketCap);
  const totalSupply = parseMetric(coin?.totalSupply);
  const volume24hUsd = parseMetric(coin?.volume24h);
  const holdersCount = Number.parseInt(String(coin?.uniqueHolders ?? 0), 10);
  const priceUsd =
    marketCapUsd > 0 && totalSupply > 0 ? marketCapUsd / totalSupply : 0;
  const priceNaira = priceUsd > 0 ? priceUsd * ngnPerUsd : 0;

  return {
    holdersCount: Number.isFinite(holdersCount) ? holdersCount : 0,
    marketCapNaira: asMoney(Math.round(marketCapUsd * ngnPerUsd * 100)),
    marketCapUsd: Number(marketCapUsd.toFixed(4)),
    priceNaira: Number(priceNaira.toFixed(4)),
    priceUsd: Number(priceUsd.toFixed(8)),
    volume24hNaira: asMoney(Math.round(volume24hUsd * ngnPerUsd * 100)),
    volume24hUsd: Number(volume24hUsd.toFixed(4))
  };
};

const mapCoinRecord = (record, liveCoin, ngnPerUsd) => ({
  chainId: record.chain_id,
  coinAddress: record.coin_address,
  coverImageUrl: record.cover_image_url,
  createdAt: record.created_at,
  creator: {
    avatarUrl: record.creator_avatar_url,
    displayName: record.creator_display_name,
    id: record.created_by,
    username: record.creator_username,
    walletAddress: record.creator_wallet_address
  },
  description: record.description,
  id: record.id,
  launchedAt: record.launched_at,
  live: liveCoin
    ? {
        address: liveCoin.address,
        ...createLiveCoinSnapshot(liveCoin, ngnPerUsd),
        mediaContent: {
          image:
            liveCoin.mediaContent?.previewImage?.small ||
            liveCoin.mediaContent?.previewImage?.medium ||
            null
        },
        name: liveCoin.name || record.name,
        symbol: liveCoin.symbol || record.ticker,
        uniqueHolders: Number.parseInt(String(liveCoin.uniqueHolders ?? 0), 10)
      }
    : null,
  metadataUri: record.metadata_uri,
  name: record.name,
  postDestination: record.post_destination,
  status: record.status,
  supply: Number(record.supply || 0),
  ticker: record.ticker
});

const buildCoinQuery = (supabase) =>
  supabase
    .from("creator_launches")
    .select(
      `
        id,
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
        launched_at,
        created_at,
        profiles!creator_launches_created_by_fkey (
          id,
          username,
          display_name,
          avatar_url,
          wallet_address
        )
      `
    )
    .eq("status", "launched");

export const createCreatorService = ({ ngnPerUsd, supabase, zoraApiKey }) => {
  if (zoraApiKey) {
    setApiKey(zoraApiKey);
  }

  const fetchLiveCoin = async (coinAddress) => {
    if (!coinAddress) {
      return null;
    }

    const response = await getCoin({
      address: coinAddress,
      chain: base.id
    }).catch(() => null);

    return response?.data?.zora20Token || null;
  };

  const resolveCreator = async (identifier) => {
    let data = null;

    if (isUuid(identifier)) {
      const { data: byId, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, banner_url, bio, wallet_address"
        )
        .eq("id", identifier)
        .maybeSingle();

      if (error) {
        throw error;
      }

      data = byId;
    }

    if (!data && isAddress(identifier)) {
      const { data: byWallet, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, banner_url, bio, wallet_address"
        )
        .ilike("wallet_address", identifier)
        .maybeSingle();

      if (error) {
        throw error;
      }

      data = byWallet;
    }

    if (!data) {
      const { data: byUsername, error } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, banner_url, bio, wallet_address"
        )
        .ilike("username", identifier)
        .maybeSingle();

      if (error) {
        throw error;
      }

      data = byUsername;
    }

    assert(data, "Creator not found.", 404);

    const { count, error: coinCountError } = await supabase
      .from("creator_launches")
      .select("id", { count: "exact", head: true })
      .eq("created_by", data.id)
      .eq("status", "launched");

    if (coinCountError) {
      throw coinCountError;
    }

    return {
      avatarUrl: data.avatar_url,
      bannerUrl: data.banner_url,
      bio: data.bio,
      coinCount: count || 0,
      displayName: data.display_name,
      id: data.id,
      username: data.username,
      walletAddress: data.wallet_address
    };
  };

  const resolveCreatorCoin = async (identifier) => {
    let data = null;

    if (isUuid(identifier)) {
      const { data: byId, error } = await buildCoinQuery(supabase)
        .eq("id", identifier)
        .maybeSingle();

      if (error) {
        throw error;
      }

      data = byId;
    }

    if (!data && isAddress(identifier)) {
      const { data: byAddress, error } = await buildCoinQuery(supabase)
        .ilike("coin_address", identifier)
        .maybeSingle();

      if (error) {
        throw error;
      }

      data = byAddress;
    }

    if (!data) {
      const { data: byTicker, error } = await buildCoinQuery(supabase)
        .ilike("ticker", identifier)
        .maybeSingle();

      if (error) {
        throw error;
      }

      data = byTicker;
    }

    assert(data, "Creator coin not found.", 404);

    const liveCoin = await fetchLiveCoin(data.coin_address);

    return mapCoinRecord(
      {
        ...data,
        creator_avatar_url: data.profiles?.avatar_url || null,
        creator_display_name: data.profiles?.display_name || null,
        creator_username: data.profiles?.username || null,
        creator_wallet_address: data.profiles?.wallet_address || null
      },
      liveCoin,
      ngnPerUsd
    );
  };

  const listCreatorCoinActivity = async (identifier, limitInput) => {
    const coin = await resolveCreatorCoin(identifier);
    const limit = normalizePaginationLimit(limitInput, 25);

    const [supportRows, sellRows] = await Promise.all([
      supabase
        .from("support_transactions")
        .select(
          "id, profile_id, coin_symbol, naira_amount_kobo, status, completed_at, created_at, metadata"
        )
        .eq("coin_address", coin.coinAddress)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("sell_transactions")
        .select(
          "id, profile_id, coin_symbol, net_naira_return_kobo, status, completed_at, created_at, metadata"
        )
        .eq("coin_address", coin.coinAddress)
        .order("created_at", { ascending: false })
        .limit(limit)
    ]);

    if (supportRows.error) {
      throw supportRows.error;
    }

    if (sellRows.error) {
      throw sellRows.error;
    }

    const activity = [
      ...(supportRows.data || []).map((row) => ({
        actorProfileId: row.profile_id,
        amountNaira: asMoney(row.naira_amount_kobo),
        coinSymbol: row.coin_symbol,
        createdAt: row.created_at,
        id: row.id,
        kind: "support",
        metadata: row.metadata || {},
        status: row.status
      })),
      ...(sellRows.data || []).map((row) => ({
        actorProfileId: row.profile_id,
        amountNaira: asMoney(row.net_naira_return_kobo),
        coinSymbol: row.coin_symbol,
        createdAt: row.created_at,
        id: row.id,
        kind: "sell",
        metadata: row.metadata || {},
        status: row.status
      }))
    ]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);

    return {
      activity,
      coin
    };
  };

  return {
    listCreatorCoinActivity,
    resolveCreator,
    resolveCreatorCoin
  };
};
