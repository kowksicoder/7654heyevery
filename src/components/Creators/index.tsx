import {
  CheckBadgeIcon,
  SparklesIcon,
  Squares2X2Icon
} from "@heroicons/react/24/solid";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import MetaTags from "@/components/Common/MetaTags";
import { Card, EmptyState, ErrorMessage, Image } from "@/components/Shared/UI";
import cn from "@/helpers/cn";
import {
  type FeaturedCreatorEntry,
  fetchFeaturedCreatorEntries,
  formatCompactMetric,
  formatDelta,
  formatUsdMetric,
  getCreatorTicker,
  getFeaturedCreatorAge,
  isPositiveDelta,
  parseMetricNumber
} from "@/helpers/liveCreatorData";

const creatorsQueryKey = "featured-creators-page";

const MobileOverviewCard = ({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName: string;
}) => (
  <div className="min-w-[5.4rem] shrink-0 rounded-[1.1rem] bg-gray-100 px-2.5 py-2 dark:bg-[#171717]">
    <p
      className={cn(
        "font-semibold text-[0.95rem] tracking-tight",
        valueClassName
      )}
    >
      {value}
    </p>
    <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#a4a4a8]">
      {label}
    </p>
  </div>
);

const MetricCell = ({
  accent,
  label,
  negative,
  value
}: {
  accent?: boolean;
  label: string;
  negative?: boolean;
  value: string;
}) => (
  <div className="min-w-0 rounded-2xl bg-gray-100 px-2.5 py-2 dark:bg-[#101011]">
    <p
      className={cn(
        "truncate font-semibold text-[13px] tracking-tight",
        accent
          ? negative
            ? "text-rose-500"
            : "text-[#12c46b]"
          : "text-gray-900 dark:text-white"
      )}
    >
      {value}
    </p>
    <p className="mt-1 font-medium text-[10px] text-gray-500 dark:text-[#8c8c92]">
      {label}
    </p>
  </div>
);

const MobileCreatorCard = ({ creator }: { creator: FeaturedCreatorEntry }) => {
  const positive = isPositiveDelta(creator.marketCapDelta24h);
  const ticker = getCreatorTicker(creator.symbol);

  return (
    <div className="rounded-[1.65rem] bg-white px-3.5 py-3 shadow-[0_18px_28px_-24px_rgba(15,23,42,0.12)] ring-1 ring-gray-200/80 dark:bg-[#171717] dark:shadow-[0_22px_32px_-28px_rgba(0,0,0,0.98)] dark:ring-white/[0.03]">
      <div className="flex items-center gap-3">
        <Image
          alt={creator.name}
          className="size-11 rounded-full object-cover ring-1 ring-gray-200 dark:ring-white/10"
          height={44}
          src={creator.avatar}
          width={44}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-semibold text-[15px] text-gray-900 dark:text-white">
              {creator.name}
            </p>
            {creator.isOfficial ? (
              <CheckBadgeIcon className="size-4 shrink-0 text-brand-500" />
            ) : null}
            {ticker ? (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 dark:bg-[#101011] dark:text-[#c9c9cf]">
                {ticker}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-gray-500 dark:text-[#9f9fa5]">
            {creator.handle}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <MetricCell
          label="Holders"
          value={formatCompactMetric(creator.uniqueHolders)}
        />
        <MetricCell label="MC" value={formatUsdMetric(creator.marketCap)} />
        <MetricCell label="Vol" value={formatUsdMetric(creator.volume24h)} />
        <MetricCell
          accent
          label="24h"
          negative={!positive}
          value={formatDelta(creator.marketCapDelta24h)}
        />
      </div>
    </div>
  );
};

const CreatorRow = ({ creator }: { creator: FeaturedCreatorEntry }) => {
  const positive = isPositiveDelta(creator.marketCapDelta24h);
  const ticker = getCreatorTicker(creator.symbol);

  return (
    <Card
      className="mx-5 px-4 py-4 shadow-none transition-colors hover:border-gray-300 hover:bg-gray-50/60 md:mx-0 md:px-5 dark:hover:border-gray-600 dark:hover:bg-gray-950/60"
      forceRounded
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,2.5fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.65fr)_minmax(0,0.8fr)] md:items-center">
        <div className="flex items-center gap-3">
          <Image
            alt={creator.name}
            className="size-12 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-white/10"
            height={48}
            src={creator.avatar}
            width={48}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate font-semibold text-gray-950 text-lg dark:text-gray-50">
                {creator.name}
              </p>
              {creator.isOfficial ? (
                <CheckBadgeIcon className="size-4 shrink-0 text-brand-500" />
              ) : null}
              {ticker ? (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-[10px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                  {ticker}
                </span>
              ) : null}
            </div>
            <p className="truncate text-base text-gray-500 dark:text-gray-400">
              {creator.handle}
            </p>
          </div>
        </div>

        <div>
          <p className="font-semibold text-[11px] text-gray-500 uppercase tracking-[0.18em] md:hidden">
            Market cap
          </p>
          <p className="font-semibold text-base text-gray-950 dark:text-gray-50">
            {formatUsdMetric(creator.marketCap)}
          </p>
        </div>

        <div>
          <p className="font-semibold text-[11px] text-gray-500 uppercase tracking-[0.18em] md:hidden">
            24h vol
          </p>
          <p className="font-semibold text-base text-gray-950 dark:text-gray-50">
            {formatUsdMetric(creator.volume24h)}
          </p>
        </div>

        <div>
          <p className="font-semibold text-[11px] text-gray-500 uppercase tracking-[0.18em] md:hidden">
            Holders
          </p>
          <p className="font-semibold text-base text-gray-950 dark:text-gray-50">
            {formatCompactMetric(creator.uniqueHolders)}
          </p>
        </div>

        <div>
          <p className="font-semibold text-[11px] text-gray-500 uppercase tracking-[0.18em] md:hidden">
            Age
          </p>
          <p className="text-base text-gray-500 dark:text-gray-400">
            {getFeaturedCreatorAge(creator.createdAt)}
          </p>
        </div>

        <div>
          <p className="font-semibold text-[11px] text-gray-500 uppercase tracking-[0.18em] md:hidden">
            24h
          </p>
          <p
            className={cn(
              "font-semibold text-base",
              positive ? "text-emerald-500" : "text-rose-500"
            )}
          >
            {formatDelta(creator.marketCapDelta24h)}
          </p>
        </div>
      </div>
    </Card>
  );
};

const LoadingCard = () => (
  <div className="rounded-[1.65rem] bg-white px-3.5 py-3 ring-1 ring-gray-200/80 dark:bg-[#171717] dark:ring-white/[0.03]">
    <div className="flex items-center gap-3">
      <div className="size-11 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
        <div className="h-3 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
      </div>
    </div>
    <div className="mt-3 grid grid-cols-4 gap-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="h-14 animate-pulse rounded-2xl bg-gray-100 dark:bg-[#101011]"
          key={index.toString()}
        />
      ))}
    </div>
  </div>
);

const Creators = () => {
  const {
    data = [],
    error,
    isLoading
  } = useQuery({
    queryFn: () => fetchFeaturedCreatorEntries(12),
    queryKey: [creatorsQueryKey],
    staleTime: 60_000
  });

  const overviewCards = useMemo(() => {
    const totalMarketCap = data.reduce(
      (sum, creator) => sum + parseMetricNumber(creator.marketCap),
      0
    );
    const totalVolume = data.reduce(
      (sum, creator) => sum + parseMetricNumber(creator.volume24h),
      0
    );
    const averageHolders =
      data.reduce((sum, creator) => sum + creator.uniqueHolders, 0) /
      Math.max(data.length, 1);

    return [
      {
        label: "Featured",
        value: data.length.toString(),
        valueClassName: "text-[#26dd86]"
      },
      {
        label: "Market Cap",
        value: formatUsdMetric(totalMarketCap),
        valueClassName: "text-[#26dd86]"
      },
      {
        label: "24h Vol",
        value: formatUsdMetric(totalVolume),
        valueClassName: "text-[#26dd86]"
      },
      {
        label: "Avg. Holders",
        value: formatCompactMetric(averageHolders),
        valueClassName: "text-gray-900 dark:text-white"
      }
    ];
  }, [data]);

  return (
    <>
      <MetaTags
        description="Track Zora's weekly featured creators with live creator coin market caps, volume, holders, and 24 hour movement."
        image={data[0]?.avatar || "/evlogo.jpg"}
        title="Creators"
      />
      <main className="mt-0 mb-16 min-w-0 flex-1 md:mt-5 md:mb-5">
        <section className="bg-white px-3 pt-2.5 pb-6 text-gray-900 md:hidden dark:bg-[#0d0d0e] dark:text-white">
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-gray-100 text-[#12c46b] dark:bg-[#171717]">
                <SparklesIcon className="size-4" />
              </span>
              <div>
                <p className="font-semibold text-[13px] text-gray-900 dark:text-white">
                  Featured creators
                </p>
                <p className="text-[11px] text-gray-500 dark:text-[#9f9fa5]">
                  This week on Zora
                </p>
              </div>
            </div>

            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
              {overviewCards.map((card) => (
                <MobileOverviewCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  valueClassName={card.valueClassName}
                />
              ))}
            </div>

            {error ? (
              <ErrorMessage error={error} title="Failed to load creators" />
            ) : null}

            {!error && !isLoading && !data.length ? (
              <EmptyState
                icon={<Squares2X2Icon className="size-8" />}
                message="No featured creators found this week."
              />
            ) : null}

            <div className="space-y-2.5">
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <LoadingCard key={index.toString()} />
                  ))
                : data.map((creator) => (
                    <MobileCreatorCard
                      creator={creator}
                      key={creator.address}
                    />
                  ))}
            </div>
          </div>
        </section>

        <section className="hidden space-y-4 md:block">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-gray-100 text-[#12c46b] dark:bg-[#171717]">
                <SparklesIcon className="size-5" />
              </span>
              <div className="text-center">
                <p className="font-semibold text-gray-900 text-sm dark:text-white">
                  Featured creators
                </p>
                <p className="text-[11px] text-gray-500 dark:text-[#a4a4a8]">
                  Weekly list from Zora
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="no-scrollbar flex flex-wrap justify-center gap-3 pb-1">
                {overviewCards.map((card) => (
                  <div
                    className="min-w-[7.2rem] shrink-0 rounded-[1.3rem] bg-gray-100 px-3 py-2.5 text-center dark:bg-[#171717]"
                    key={card.label}
                  >
                    <p
                      className={cn(
                        "font-semibold text-lg tracking-tight",
                        card.valueClassName
                      )}
                    >
                      {card.value}
                    </p>
                    <p className="mt-0.5 font-medium text-[10px] text-gray-500 dark:text-[#a4a4a8]">
                      {card.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error ? (
            <ErrorMessage error={error} title="Failed to load creators" />
          ) : null}

          {!error && !isLoading ? (
            <div className="hidden px-4 font-semibold text-gray-500 text-xs uppercase tracking-[0.18em] md:grid md:grid-cols-[minmax(0,2.5fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.65fr)_minmax(0,0.8fr)] md:items-center md:px-5">
              <span>Creator</span>
              <span>Market cap</span>
              <span>24h vol</span>
              <span>Holders</span>
              <span>Age</span>
              <span>24h</span>
            </div>
          ) : null}

          {!error && !isLoading && !data.length ? (
            <EmptyState
              icon={<Squares2X2Icon className="size-8" />}
              message="No featured creators found this week."
            />
          ) : null}

          <section className="space-y-3 pb-6">
            {isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <Card
                    className="px-5 py-5"
                    forceRounded
                    key={index.toString()}
                  >
                    <div className="grid animate-pulse gap-4 md:grid-cols-[minmax(0,2.5fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.65fr)_minmax(0,0.8fr)]">
                      <div className="h-10 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                    </div>
                  </Card>
                ))
              : data.map((creator) => (
                  <CreatorRow creator={creator} key={creator.address} />
                ))}
          </section>
        </section>
      </main>
    </>
  );
};

export default Creators;
