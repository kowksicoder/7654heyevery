import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  MagnifyingGlassIcon
} from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Card, EmptyState, ErrorMessage, Image } from "@/components/Shared/UI";
import getCoinPath from "@/helpers/getCoinPath";
import {
  formatCompactMetric,
  formatDelta,
  formatUsdMetric,
  getCreatorTicker,
  isPositiveDelta
} from "@/helpers/liveCreatorData";
import {
  fetchTrendingSearchCoins,
  searchDiscoverCoins
} from "@/helpers/searchDiscoverCoins";

interface CoinsProps {
  query: string;
}

const CoinResultRow = ({
  item,
  showRank
}: {
  item: Awaited<ReturnType<typeof searchDiscoverCoins>>[number];
  showRank?: number;
}) => {
  const positive = isPositiveDelta(item.marketCapDelta24h);

  return (
    <Link to={getCoinPath(item.address)}>
      <Card
        className="group rounded-3xl border border-gray-200/80 bg-white p-3.5 transition-colors hover:border-gray-300 dark:border-gray-800/80 dark:bg-[#090909] dark:hover:border-gray-700"
        forceRounded
      >
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Image
              alt={item.name}
              className="size-12 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-white/10"
              height={48}
              src={item.imageUrl}
              width={48}
            />
            {showRank ? (
              <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-gray-900 font-bold text-[10px] text-white dark:bg-white dark:text-black">
                {showRank}
              </span>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold text-[15px] text-gray-900 dark:text-white">
                {item.name}
              </p>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 uppercase dark:bg-white/5 dark:text-gray-300">
                {getCreatorTicker(item.symbol)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
              <span className="truncate">
                {formatUsdMetric(item.marketCap)} MC
              </span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span>{formatCompactMetric(item.uniqueHolders)} holders</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-semibold text-[14px] text-gray-900 dark:text-white">
              {formatUsdMetric(item.volume24h)}
            </p>
            <p
              className={`mt-1 inline-flex items-center justify-end gap-1 font-semibold text-[12px] ${
                positive ? "text-[#12c46b]" : "text-rose-500"
              }`}
            >
              {positive ? (
                <ArrowTrendingUpIcon className="size-3" />
              ) : (
                <ArrowTrendingDownIcon className="size-3" />
              )}
              {formatDelta(item.marketCapDelta24h)}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export const TrendingCoinsCard = () => {
  const { data, error, isLoading } = useQuery({
    queryFn: async () => await fetchTrendingSearchCoins(3),
    queryKey: ["search-trending-coins"],
    staleTime: 30_000
  });

  if (isLoading) {
    return (
      <Card
        className="rounded-[28px] border border-gray-200/80 bg-white p-3.5 dark:border-gray-800/80 dark:bg-[#090909]"
        forceRounded
      >
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5"
              key={`trending-coin-${index}`}
            />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return <ErrorMessage error={error} title="Failed to load trending coins" />;
  }

  if (!data?.length) {
    return null;
  }

  return (
    <Card
      className="space-y-2 rounded-[28px] border border-gray-200/80 bg-white p-3.5 dark:border-gray-800/80 dark:bg-[#090909]"
      forceRounded
    >
      {data.map((item, index) => (
        <CoinResultRow item={item} key={item.address} showRank={index + 1} />
      ))}
    </Card>
  );
};

const Coins = ({ query }: CoinsProps) => {
  const { data, error, isLoading } = useQuery({
    enabled: Boolean(query.trim()),
    queryFn: async () => await searchDiscoverCoins(query, 24),
    queryKey: ["search-coins", query.trim().toLowerCase()],
    staleTime: 30_000
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="h-24 animate-pulse rounded-3xl bg-gray-100 dark:bg-white/5"
            key={`coin-search-${index}`}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorMessage error={error} title="Failed to load coins" />;
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon={<MagnifyingGlassIcon className="size-8" />}
        message={
          <span>
            No coins for <b>&ldquo;{query}&rdquo;</b>
          </span>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {data.map((item) => (
        <CoinResultRow item={item} key={item.address} />
      ))}
    </div>
  );
};

export default Coins;
