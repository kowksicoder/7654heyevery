import {
  type ExploreResponse,
  getCoinsLastTradedUnique,
  getCoinsMostValuable,
  getExploreNewAll,
  getExploreTopVolumeAll24h,
  setApiKey
} from "@zoralabs/coins-sdk";
import { DEFAULT_AVATAR } from "@/data/constants";
import getZoraApiKey from "@/helpers/getZoraApiKey";
import {
  fetchPlatformDiscoverCoins,
  mergePriorityItemsByAddress,
  type PlatformDiscoverCoin
} from "@/helpers/platformDiscovery";

const zoraApiKey = getZoraApiKey();

if (zoraApiKey) {
  setApiKey(zoraApiKey);
}

type ExploreCoinNode = NonNullable<
  NonNullable<
    NonNullable<ExploreResponse["data"]>["exploreList"]
  >["edges"][number]["node"]
>;

export interface SearchDiscoverCoin {
  address: string;
  creatorAddress?: null | string;
  creatorDisplayName?: null | string;
  creatorHandle?: null | string;
  imageUrl: string;
  isPlatformCreated?: boolean;
  marketCap?: null | string;
  marketCapDelta24h?: null | string;
  name: string;
  symbol: string;
  uniqueHolders?: null | number;
  volume24h?: null | string;
}

const normalizeText = (value?: null | string) =>
  value?.trim().toLowerCase().replace(/\s+/g, " ") || "";

const parseMetric = (value?: null | number | string) => {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));

  return Number.isFinite(parsed) ? parsed : 0;
};

const mapCoin = (
  item: ExploreCoinNode | PlatformDiscoverCoin,
  isPlatformCreated = false
): SearchDiscoverCoin => ({
  address: item.address,
  creatorAddress: item.creatorAddress,
  creatorDisplayName: item.creatorProfile?.handle || null,
  creatorHandle: item.creatorProfile?.handle || null,
  imageUrl:
    item.mediaContent?.previewImage?.medium ||
    item.mediaContent?.previewImage?.small ||
    item.creatorProfile?.avatar?.previewImage?.medium ||
    DEFAULT_AVATAR,
  isPlatformCreated,
  marketCap: item.marketCap,
  marketCapDelta24h: item.marketCapDelta24h,
  name: item.name || item.symbol || item.address,
  symbol: item.symbol,
  uniqueHolders: item.uniqueHolders,
  volume24h: item.volume24h
});

const dedupeCoins = (items: SearchDiscoverCoin[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.address.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const sortByDiscoveryWeight = (items: SearchDiscoverCoin[]) =>
  [...items].sort((a, b) => {
    if (a.isPlatformCreated !== b.isPlatformCreated) {
      return a.isPlatformCreated ? -1 : 1;
    }

    const aScore =
      parseMetric(a.volume24h) * 3 +
      parseMetric(a.marketCap) +
      parseMetric(a.uniqueHolders);
    const bScore =
      parseMetric(b.volume24h) * 3 +
      parseMetric(b.marketCap) +
      parseMetric(b.uniqueHolders);

    return bScore - aScore;
  });

const scoreCoin = (coin: SearchDiscoverCoin, normalizedQuery: string) => {
  const symbol = normalizeText(coin.symbol);
  const name = normalizeText(coin.name);
  const handle = normalizeText(coin.creatorHandle);
  const creatorName = normalizeText(coin.creatorDisplayName);
  const address = normalizeText(coin.address);

  let score = 0;

  if (symbol === normalizedQuery) {
    score += 400;
  }

  if (name === normalizedQuery) {
    score += 340;
  }

  if (handle === normalizedQuery) {
    score += 260;
  }

  if (symbol.startsWith(normalizedQuery)) {
    score += 220;
  }

  if (name.startsWith(normalizedQuery)) {
    score += 200;
  }

  if (
    handle.startsWith(normalizedQuery) ||
    creatorName.startsWith(normalizedQuery)
  ) {
    score += 170;
  }

  if (symbol.includes(normalizedQuery)) {
    score += 130;
  }

  if (name.includes(normalizedQuery)) {
    score += 120;
  }

  if (
    handle.includes(normalizedQuery) ||
    creatorName.includes(normalizedQuery) ||
    address.includes(normalizedQuery)
  ) {
    score += 100;
  }

  if (coin.isPlatformCreated) {
    score += 180;
  }

  return score;
};

const fetchDiscoveryPools = async (count = 36) => {
  const [platformCoins, ...responses] = await Promise.all([
    fetchPlatformDiscoverCoins({
      limit: Math.max(Math.min(count, 24), 12)
    }).catch(() => [] as PlatformDiscoverCoin[]),
    getExploreTopVolumeAll24h({ count }),
    getExploreNewAll({ count }),
    getCoinsLastTradedUnique({ count }),
    getCoinsMostValuable({ count })
  ]);
  const zoraCoins = responses
    .flatMap((response) => response.data?.exploreList?.edges ?? [])
    .map((edge) => edge.node)
    .filter(
      (item): item is ExploreCoinNode =>
        Boolean(item) &&
        !item.platformBlocked &&
        !item.creatorProfile?.platformBlocked
    )
    .map((item) => mapCoin(item));

  return mergePriorityItemsByAddress(
    platformCoins.map((item) => mapCoin(item, true)),
    zoraCoins
  );
};

export const fetchTrendingSearchCoins = async (limit = 3) => {
  const [platformCoins, response] = await Promise.all([
    fetchPlatformDiscoverCoins({
      limit: Math.max(Math.min(limit * 2, 12), 6)
    }).catch(() => [] as PlatformDiscoverCoin[]),
    getExploreTopVolumeAll24h({
      count: Math.max(limit, 6)
    })
  ]);
  const items =
    response.data?.exploreList?.edges
      ?.map((edge) => edge.node)
      .filter(
        (item): item is ExploreCoinNode =>
          Boolean(item) &&
          !item.platformBlocked &&
          !item.creatorProfile?.platformBlocked
      )
      .map((item) => mapCoin(item)) ?? [];

  return dedupeCoins(
    mergePriorityItemsByAddress(
      platformCoins.map((item) => mapCoin(item, true)),
      items
    )
  ).slice(0, limit);
};

export const searchDiscoverCoins = async (query: string, limit = 24) => {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return [] as SearchDiscoverCoin[];
  }

  const items = dedupeCoins(await fetchDiscoveryPools());
  const matches = items
    .map((item) => ({
      item,
      score: scoreCoin(item, normalizedQuery)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (a.item.isPlatformCreated !== b.item.isPlatformCreated) {
        return a.item.isPlatformCreated ? -1 : 1;
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        parseMetric(b.item.volume24h) +
        parseMetric(b.item.marketCap) -
        (parseMetric(a.item.volume24h) + parseMetric(a.item.marketCap))
      );
    })
    .map(({ item }) => item);

  return matches.slice(0, limit);
};

export const fetchSearchDiscoveryPools = async () =>
  sortByDiscoveryWeight(dedupeCoins(await fetchDiscoveryPools()));
