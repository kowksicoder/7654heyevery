import {
  CheckBadgeIcon,
  Squares2X2Icon,
  TrophyIcon
} from "@heroicons/react/24/solid";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import MetaTags from "@/components/Common/MetaTags";
import { Card, EmptyState, ErrorMessage, Image } from "@/components/Shared/UI";
import cn from "@/helpers/cn";
import {
  fetchTraderLeaderboardEntries,
  formatCompactMetric,
  formatUsdMetric,
  parseMetricNumber,
  type TraderLeaderboardEntry
} from "@/helpers/liveCreatorData";

const leaderboardQueryKey = "zora-trader-leaderboard-page";

const OverviewCard = ({
  label,
  value,
  valueClassName
}: {
  label: string;
  value: string;
  valueClassName: string;
}) => (
  <div className="min-w-[6.5rem] shrink-0 rounded-[1.3rem] bg-gray-100 px-3 py-2 text-center shadow-[0_14px_24px_-22px_rgba(15,23,42,0.16)] dark:bg-[#171717] dark:shadow-[0_18px_30px_-26px_rgba(0,0,0,0.95)]">
    <p className={cn("font-semibold text-base tracking-tight", valueClassName)}>
      {value}
    </p>
    <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#a4a4a8]">
      {label}
    </p>
  </div>
);

const RankBadge = ({
  featured,
  rank
}: {
  featured?: boolean;
  rank: number;
}) => (
  <div
    className={cn(
      "flex size-7 shrink-0 items-center justify-center rounded-full font-semibold text-xs",
      featured
        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-800/70"
        : "bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800"
    )}
  >
    {rank}
  </div>
);

const MetricCard = ({
  accent,
  label,
  value
}: {
  accent?: boolean;
  label: string;
  value: string;
}) => (
  <div className="min-w-0 rounded-2xl bg-gray-100 px-2 py-1.5 dark:bg-[#101011]">
    <p
      className={cn(
        "truncate font-semibold text-[12px] tracking-tight",
        accent ? "text-[#12c46b]" : "text-gray-900 dark:text-white"
      )}
    >
      {value}
    </p>
    <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8c8c92]">
      {label}
    </p>
  </div>
);

const MobileLeaderboardCard = ({
  entry,
  rank
}: {
  entry: TraderLeaderboardEntry;
  rank: number;
}) => {
  const featured = rank <= 3;

  return (
    <div
      className={cn(
        "rounded-[1.5rem] px-3.5 py-3 shadow-[0_18px_28px_-24px_rgba(15,23,42,0.12)]",
        featured
          ? "bg-amber-50 ring-1 ring-amber-200 dark:bg-[#191611] dark:ring-[#59411d]/60"
          : "bg-white ring-1 ring-gray-200/80 dark:bg-[#171717] dark:ring-white/[0.03]"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-2">
          <RankBadge featured={featured} rank={rank} />
          <Image
            alt={entry.displayName}
            className="size-10 rounded-full object-cover ring-1 ring-gray-200 dark:ring-white/10"
            height={40}
            src={entry.avatar}
            width={40}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate font-semibold text-[15px] text-gray-900 dark:text-white">
              {entry.displayName}
            </p>
            {entry.isOfficial ? (
              <CheckBadgeIcon className="size-4 shrink-0 text-brand-500" />
            ) : null}
          </div>
          <p className="truncate text-[11px] text-gray-500 dark:text-[#9f9fa5]">
            {entry.handle}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        <MetricCard
          accent
          label="Score"
          value={formatCompactMetric(entry.score)}
        />
        <MetricCard label="Vol" value={formatUsdMetric(entry.weekVolumeUsd)} />
        <MetricCard
          label="Trades"
          value={formatCompactMetric(entry.weekTradesCount)}
        />
        <MetricCard
          label="ZORA"
          value={formatCompactMetric(entry.grossVolumeZora)}
        />
        <MetricCard label="E1XP" value={formatCompactMetric(entry.e1xpTotal)} />
      </div>
    </div>
  );
};

const LeaderboardRow = ({
  entry,
  rank
}: {
  entry: TraderLeaderboardEntry;
  rank: number;
}) => {
  const featured = rank <= 3;

  return (
    <Card
      className={cn(
        "mx-5 px-3.5 py-3 transition-all md:mx-0",
        featured
          ? "border-amber-300 bg-amber-50/55 dark:border-amber-800/70 dark:bg-amber-500/5"
          : "hover:border-gray-300 hover:bg-gray-50/70 dark:hover:border-gray-600 dark:hover:bg-gray-950/60"
      )}
      forceRounded
    >
      <div className="grid items-center gap-3 md:grid-cols-[minmax(0,2.6fr)_0.8fr_1fr_0.85fr_1fr_0.95fr]">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <RankBadge featured={featured} rank={rank} />
            <Image
              alt={entry.displayName}
              className="size-10 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-white/10"
              height={40}
              src={entry.avatar}
              width={40}
            />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate font-semibold text-[14px] text-gray-950 dark:text-gray-50">
                  {entry.displayName}
                </p>
                {entry.isOfficial ? (
                  <CheckBadgeIcon className="size-4 shrink-0 text-brand-500" />
                ) : null}
              </div>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {entry.handle}
              </p>
            </div>
          </div>
        </div>

        <div className="text-center font-semibold text-emerald-600 text-sm dark:text-emerald-400">
          {formatCompactMetric(entry.score)}
        </div>

        <div className="text-center font-semibold text-gray-800 text-sm dark:text-gray-100">
          {formatUsdMetric(entry.weekVolumeUsd)}
        </div>

        <div className="text-center font-semibold text-gray-800 text-sm dark:text-gray-100">
          {formatCompactMetric(entry.weekTradesCount)}
        </div>

        <div className="text-center font-semibold text-gray-800 text-sm dark:text-gray-100">
          {formatCompactMetric(entry.grossVolumeZora)}
        </div>

        <div className="text-center font-semibold text-gray-800 text-sm dark:text-gray-100">
          {formatCompactMetric(entry.e1xpTotal)}
        </div>
      </div>
    </Card>
  );
};

const LoadingCard = () => (
  <div className="rounded-[1.5rem] bg-white px-3.5 py-3 ring-1 ring-gray-200/80 dark:bg-[#171717] dark:ring-white/[0.03]">
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center gap-2">
        <div className="size-7 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
        <div className="size-10 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
        <div className="h-3 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-white/10" />
      </div>
    </div>
    <div className="mt-3 grid grid-cols-5 gap-1.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          className="h-14 animate-pulse rounded-2xl bg-gray-100 dark:bg-[#101011]"
          key={index.toString()}
        />
      ))}
    </div>
  </div>
);

const Leaderboard = () => {
  const {
    data = [],
    error,
    isLoading
  } = useQuery({
    queryFn: () => fetchTraderLeaderboardEntries(20),
    queryKey: [leaderboardQueryKey],
    staleTime: 60_000
  });

  const overviewCards = useMemo(() => {
    const totalVolume = data.reduce(
      (sum, entry) => sum + parseMetricNumber(entry.weekVolumeUsd),
      0
    );
    const totalTrades = data.reduce(
      (sum, entry) => sum + entry.weekTradesCount,
      0
    );
    const totalZora = data.reduce(
      (sum, entry) => sum + entry.grossVolumeZora,
      0
    );
    const topScore =
      data.length > 0 ? Math.max(...data.map((entry) => entry.score)) : 0;

    return [
      {
        label: "Traders",
        value: data.length.toString(),
        valueClassName: "text-[#26dd86]"
      },
      {
        label: "Week Vol",
        value: formatUsdMetric(totalVolume),
        valueClassName: "text-[#26dd86]"
      },
      {
        label: "Trades",
        value: formatCompactMetric(totalTrades),
        valueClassName: "text-[#ffbf34]"
      },
      {
        label: "Top Score",
        value: formatCompactMetric(topScore),
        valueClassName: "text-gray-900 dark:text-white"
      },
      {
        label: "Gross ZORA",
        value: formatCompactMetric(totalZora),
        valueClassName: "text-[#26dd86]"
      }
    ];
  }, [data]);

  return (
    <>
      <MetaTags
        description="Track Zora's live weekly trader leaderboard with real score, volume, and trade totals."
        image={data[0]?.avatar || "/evlogo.jpg"}
        title="Leaderboard"
      />
      <main className="mt-0 mb-16 min-w-0 flex-1 md:mt-5 md:mb-5">
        <section className="bg-white px-4 pt-4 pb-8 text-gray-900 md:hidden dark:bg-[#0d0d0e] dark:text-white">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-gray-100 text-[#12c46b] dark:bg-[#171717]">
                <TrophyIcon className="size-4" />
              </span>
              <div>
                <p className="font-semibold text-[13px] text-gray-900 dark:text-white">
                  Trader leaderboard
                </p>
                <p className="text-[11px] text-gray-500 dark:text-[#9f9fa5]">
                  This week on Zora
                </p>
              </div>
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {overviewCards.map((card) => (
                <OverviewCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  valueClassName={card.valueClassName}
                />
              ))}
            </div>

            {error ? (
              <ErrorMessage error={error} title="Failed to load leaderboard" />
            ) : null}

            {!error && !isLoading && !data.length ? (
              <EmptyState
                icon={<Squares2X2Icon className="size-8" />}
                message="No weekly leaderboard data found right now."
              />
            ) : null}

            <div className="space-y-2.5">
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <LoadingCard key={index.toString()} />
                  ))
                : data.map((entry, index) => (
                    <MobileLeaderboardCard
                      entry={entry}
                      key={entry.id}
                      rank={index + 1}
                    />
                  ))}
            </div>
          </div>
        </section>

        <section className="hidden space-y-3.5 md:block">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-gray-100 text-[#12c46b] dark:bg-[#171717]">
                <TrophyIcon className="size-5" />
              </span>
              <div className="text-center">
                <p className="font-semibold text-gray-900 text-sm dark:text-white">
                  Trader leaderboard
                </p>
                <p className="text-[11px] text-gray-500 dark:text-[#a4a4a8]">
                  Weekly ranking from Zora
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="no-scrollbar flex flex-wrap justify-center gap-2.5 pb-1">
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
            <ErrorMessage error={error} title="Failed to load leaderboard" />
          ) : null}

          {!error && !isLoading ? (
            <div className="hidden px-4 font-semibold text-[10px] text-gray-500 uppercase tracking-[0.16em] md:grid md:grid-cols-[minmax(0,2.6fr)_0.8fr_1fr_0.85fr_1fr_0.95fr] md:items-center">
              <span>Name</span>
              <span className="text-center">Score</span>
              <span className="text-center">Week Vol</span>
              <span className="text-center">Trades</span>
              <span className="text-center">Gross ZORA</span>
              <span className="text-center">E1XP</span>
            </div>
          ) : null}

          {!error && !isLoading && !data.length ? (
            <EmptyState
              icon={<Squares2X2Icon className="size-8" />}
              message="No weekly leaderboard data found right now."
            />
          ) : null}

          <section className="space-y-2.5 pb-6">
            {isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <Card
                    className="px-5 py-5"
                    forceRounded
                    key={index.toString()}
                  >
                    <div className="grid animate-pulse gap-4 md:grid-cols-[minmax(0,2.6fr)_0.8fr_1fr_0.85fr_1fr_0.95fr]">
                      <div className="h-10 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                      <div className="h-6 rounded-full bg-gray-200 dark:bg-white/10" />
                    </div>
                  </Card>
                ))
              : data.map((entry, index) => (
                  <LeaderboardRow
                    entry={entry}
                    key={entry.id}
                    rank={index + 1}
                  />
                ))}
          </section>
        </section>
      </main>
    </>
  );
};

export default Leaderboard;
