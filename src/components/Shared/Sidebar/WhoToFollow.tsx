import { SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { useQuery } from "@tanstack/react-query";
import { memo, useState } from "react";
import { Link } from "react-router";
import Hero from "@/components/Home/Hero";
import Suggested from "@/components/Home/Suggested";
import DismissRecommendedAccount from "@/components/Shared/Account/DismissRecommendedAccount";
import SingleAccount from "@/components/Shared/Account/SingleAccount";
import SingleAccountShimmer from "@/components/Shared/Shimmer/SingleAccountShimmer";
import Skeleton from "@/components/Shared/Skeleton";
import { Card, ErrorMessage, H6, Image, Modal } from "@/components/Shared/UI";
import { DEFAULT_AVATAR } from "@/data/constants";
import { getPublicProfilePath } from "@/helpers/getAccount";
import {
  fetchCreatorOfWeekEntry,
  formatCompactMetric,
  formatDelta,
  formatUsdMetric,
  getCreatorTicker,
  isPositiveDelta
} from "@/helpers/liveCreatorData";
import { PUBLIC_CREATOR_OF_WEEK_QUERY_KEY } from "@/helpers/staff";
import {
  type AccountFragment,
  PageSize,
  useAccountRecommendationsQuery
} from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";

const RECOMMENDATION_LIMIT = 3;

const Title = memo(({ children }: { children: string }) => (
  <H6 className="text-[12px] text-gray-700 leading-none tracking-tight dark:text-gray-200">
    {children}
  </H6>
));

const CreatorOfWeek = () => {
  const { data: creator, isLoading } = useQuery({
    queryFn: async () => await fetchCreatorOfWeekEntry(),
    queryKey: [PUBLIC_CREATOR_OF_WEEK_QUERY_KEY],
    staleTime: 5 * 60 * 1000
  });

  if (isLoading) {
    return (
      <Card className="space-y-3 overflow-hidden p-0">
        <div className="h-20 bg-gray-100 dark:bg-[#101011]" />
        <div className="space-y-2.5 px-3.5 pt-6 pb-3.5">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-4 w-6/12 rounded-full" />
            <Skeleton className="h-2.5 w-4/12 rounded-full" />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from(
              { length: 4 },
              (_, index) => `creator-week-${index}`
            ).map((id) => (
              <Skeleton className="h-10 rounded-xl" key={id} />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!creator) {
    return null;
  }

  const creatorPath = getPublicProfilePath({
    address: creator.address,
    handle: creator.handle
  });
  const ticker = getCreatorTicker(creator.symbol);
  const positive = isPositiveDelta(creator.marketCapDelta24h);

  if (!creatorPath) {
    return null;
  }

  return (
    <Link className="block" to={creatorPath}>
      <Card className="group overflow-hidden p-0 transition-transform duration-200 hover:-translate-y-0.5">
        <div className="relative h-20 overflow-hidden bg-gray-100 dark:bg-[#101011]">
          <Image
            alt={creator.name}
            className="h-full w-full scale-110 object-cover opacity-40 transition-transform duration-300 group-hover:scale-[1.14] dark:opacity-30"
            src={creator.bannerUrl || creator.avatar || DEFAULT_AVATAR}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-white dark:via-black/20 dark:to-[#060606]" />
          <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.75 font-semibold text-[9px] text-gray-700 uppercase tracking-[0.12em] backdrop-blur dark:bg-black/45 dark:text-[#d9d9de]">
              <SparklesIcon className="size-3" />
              Creator of the week
            </div>
            {creator.category ? (
              <span className="rounded-full bg-emerald-500/90 px-1.5 py-0.75 font-semibold text-[9px] text-white uppercase tracking-[0.1em]">
                {creator.category}
              </span>
            ) : null}
          </div>
          <div className="absolute -bottom-4.5 left-3.5">
            <Image
              alt={creator.name}
              className="size-12 rounded-2xl border-2 border-white object-cover shadow-sm ring-1 ring-gray-200 dark:border-[#060606] dark:ring-white/10"
              src={creator.avatar || DEFAULT_AVATAR}
            />
          </div>
        </div>

        <div className="space-y-2.5 px-3.5 pt-5.5 pb-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold text-[14px] text-gray-900 dark:text-white">
                {creator.name}
              </p>
              {creator.isOfficial ? (
                <CheckBadgeIcon className="size-4 shrink-0 text-brand-500" />
              ) : null}
              {ticker ? (
                <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 font-semibold text-[9px] text-gray-600 dark:bg-[#101011] dark:text-[#cfcfd4]">
                  {ticker}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-[#9e9ea5]">
              {creator.handle}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
              <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
                {typeof creator.featuredPriceUsd === "number"
                  ? formatUsdMetric(creator.featuredPriceUsd)
                  : "--"}
              </p>
              <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
                Price
              </p>
            </div>
            <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
              <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
                {formatUsdMetric(creator.marketCap)}
              </p>
              <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
                MC
              </p>
            </div>
            <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
              <p className="truncate font-semibold text-[12px] text-gray-900 tracking-tight dark:text-white">
                {formatCompactMetric(creator.uniqueHolders)}
              </p>
              <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
                Holders
              </p>
            </div>
            <div className="rounded-xl bg-gray-100 px-1.5 py-1.5 dark:bg-[#101011]">
              <p
                className={`truncate font-semibold text-[12px] tracking-tight ${
                  positive ? "text-[#12c46b]" : "text-rose-500"
                }`}
              >
                {formatDelta(creator.marketCapDelta24h)}
              </p>
              <p className="mt-0.5 font-medium text-[9px] text-gray-500 dark:text-[#8f8f96]">
                24h
              </p>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

const WhoToFollow = () => {
  const { currentAccount } = useAccountStore();
  const [showMore, setShowMore] = useState(false);

  const { data, error, loading } = useAccountRecommendationsQuery({
    variables: {
      request: {
        account: currentAccount?.address,
        pageSize: PageSize.Fifty,
        shuffle: true
      }
    }
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Hero variant="sidebar" />
        <CreatorOfWeek />
        <Card className="space-y-2.5 p-3.5">
          <Title>Who to follow</Title>
          {Array.from(
            { length: RECOMMENDATION_LIMIT },
            (_, index) => `placeholder-${index}`
          ).map((id) => (
            <div className="flex items-center gap-x-3" key={id}>
              <div className="w-full">
                <SingleAccountShimmer showFollowUnfollowButton />
              </div>
              <XMarkIcon className="size-4 text-gray-500" />
            </div>
          ))}
          <div className="pt-0.5">
            <Skeleton className="h-3 w-5/12 rounded-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (!data?.mlAccountRecommendations.items.length) {
    return <CreatorOfWeek />;
  }

  const recommendedAccounts = data?.mlAccountRecommendations.items.filter(
    (account) =>
      !account.operations?.isBlockedByMe &&
      !account.operations?.isFollowedByMe &&
      !account.operations?.hasBlockedMe
  ) as AccountFragment[];

  if (!recommendedAccounts?.length) {
    return <CreatorOfWeek />;
  }

  return (
    <>
      <div className="space-y-4">
        <Hero variant="sidebar" />
        <CreatorOfWeek />
        <Card className="space-y-2.5 p-3.5">
          <Title>Who to follow</Title>
          <ErrorMessage error={error} title="Failed to load recommendations" />
          {recommendedAccounts
            ?.slice(0, RECOMMENDATION_LIMIT)
            .map((account) => (
              <div
                className="flex items-center gap-x-3 truncate"
                key={account?.address}
              >
                <div className="w-full">
                  <SingleAccount
                    account={account}
                    followButtonClassName="min-w-[4.5rem] px-2.5 py-0 text-[11px] leading-none"
                    hideFollowButton={
                      currentAccount?.address === account.address
                    }
                    hideUnfollowButton={
                      currentAccount?.address === account.address
                    }
                  />
                </div>
                <DismissRecommendedAccount account={account} />
              </div>
            ))}
          {recommendedAccounts.length > RECOMMENDATION_LIMIT && (
            <button
              className="pt-0.5 font-semibold text-[12px] text-gray-500 dark:text-gray-200"
              onClick={() => setShowMore(true)}
              type="button"
            >
              Show more
            </button>
          )}
        </Card>
      </div>
      <Modal
        onClose={() => setShowMore(false)}
        show={showMore}
        title="Suggested for you"
      >
        <Suggested accounts={recommendedAccounts} />
      </Modal>
    </>
  );
};

export default memo(WhoToFollow);
