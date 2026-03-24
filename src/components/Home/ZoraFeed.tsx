import {
  ArrowTrendingUpIcon,
  FireIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";
import { useInfiniteQuery } from "@tanstack/react-query";
import { setApiKey } from "@zoralabs/coins-sdk";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorMessage, Spinner } from "@/components/Shared/UI";
import { HomeFeedSort, HomeFeedType, HomeFeedView } from "@/data/enums";
import cn from "@/helpers/cn";
import getZoraApiKey from "@/helpers/getZoraApiKey";
import useLoadMoreOnIntersect from "@/hooks/useLoadMoreOnIntersect";
import { useHomeTabStore } from "@/store/persisted/useHomeTabStore";
import WhoToFollowFeedBlock from "./WhoToFollowFeedBlock";
import ZoraFeedShimmer from "./ZoraFeedShimmer";
import ZoraPostCard from "./ZoraPostCard";
import ZoraPostMobileViewer from "./ZoraPostMobileViewer";
import {
  ZORA_HOME_FEED_QUERY_KEY,
  type ZoraFeedItem,
  zoraHomeFeedConfig
} from "./zoraHomeFeedConfig";

const zoraApiKey = getZoraApiKey();

if (zoraApiKey) {
  setApiKey(zoraApiKey);
}

interface ZoraFeedPage {
  items: ZoraFeedItem[];
  nextCursor?: string;
}

const getEmptyIcon = (feedType: HomeFeedType) => {
  if (
    feedType === HomeFeedType.HIGHLIGHTS ||
    feedType === HomeFeedType.POP_CULTURE ||
    feedType === HomeFeedType.PHOTOGRAPHY ||
    feedType === HomeFeedType.COMEDIANS
  ) {
    return <SparklesIcon className="size-8" />;
  }

  if (
    feedType === HomeFeedType.FORYOU ||
    feedType === HomeFeedType.LIFESTYLE ||
    feedType === HomeFeedType.PODCASTS ||
    feedType === HomeFeedType.FOOD ||
    feedType === HomeFeedType.WRITERS
  ) {
    return <ArrowTrendingUpIcon className="size-8" />;
  }

  return <FireIcon className="size-8" />;
};

const ZoraFeed = () => {
  const { feedType, sortMode, toggleViewMode, viewMode } = useHomeTabStore();
  const currentFeed = zoraHomeFeedConfig[feedType];
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(
    null
  );
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const isGridView = viewMode === HomeFeedView.GRID;
  const shouldRenderMobileReel = isMobileViewport && !isGridView;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();

    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery<ZoraFeedPage, Error>({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!zoraApiKey) {
        throw new Error("Missing Zora API key for the Zora feed.");
      }

      const response = await currentFeed.query({
        after: pageParam as string | undefined,
        count: 20
      });
      const edges = response.data?.exploreList?.edges ?? [];
      const pageInfo = response.data?.exploreList?.pageInfo;

      return {
        items: edges
          .map((edge) => edge.node)
          .filter(
            (item) =>
              !item.platformBlocked && !item.creatorProfile?.platformBlocked
          ),
        nextCursor: pageInfo?.hasNextPage ? pageInfo.endCursor : undefined
      };
    },
    queryKey: [ZORA_HOME_FEED_QUERY_KEY, feedType],
    staleTime: 30_000
  });

  const items = useMemo(
    () =>
      [...(data?.pages.flatMap((page) => page.items) ?? [])].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

        return sortMode === HomeFeedSort.OLDEST ? aTime - bTime : bTime - aTime;
      }),
    [data?.pages, sortMode]
  );

  const suggestions = useMemo(() => {
    const seen = new Set<string>();

    return items.filter((item) => {
      const key =
        item.creatorProfile?.handle?.toLowerCase() ||
        item.creatorAddress?.toLowerCase() ||
        item.address.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return Boolean(
        item.creatorProfile?.avatar?.previewImage?.medium ||
          item.mediaContent?.previewImage?.medium
      );
    });
  }, [items]);

  const getSuggestionStartIndex = useCallback(
    (index: number) => {
      if (!suggestions.length) {
        return 0;
      }

      return (Math.floor(index / 3) * 4) % suggestions.length;
    },
    [suggestions.length]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const loadMoreRef = useLoadMoreOnIntersect(handleLoadMore);
  const handleOpenMobileView = useCallback((index: number) => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 767px)").matches
    ) {
      return;
    }

    setSelectedPostIndex(index);
  }, []);

  if (isLoading) {
    return <ZoraFeedShimmer viewMode={viewMode} />;
  }

  if (error) {
    return <ErrorMessage error={error} title={currentFeed.errorTitle} />;
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={getEmptyIcon(feedType)}
        message={currentFeed.emptyMessage}
      />
    );
  }

  if (shouldRenderMobileReel) {
    return (
      <ZoraPostMobileViewer
        hasNextPage={Boolean(hasNextPage)}
        initialIndex={0}
        isFetchingMore={isFetchingNextPage}
        items={items}
        onClose={toggleViewMode}
        onRequestMore={handleLoadMore}
        variant="embedded"
      />
    );
  }

  return (
    <>
      <section
        className={cn(
          "min-w-0 overflow-x-hidden pb-5",
          isGridView
            ? "grid grid-cols-2 gap-2 px-3 md:grid-cols-4 md:gap-2.5 md:px-0 lg:grid-cols-6"
            : "space-y-3"
        )}
      >
        {isGridView
          ? items.map((item, index) => (
              <ZoraPostCard
                item={item}
                key={item.id}
                onOpenMobileView={
                  isGridView ? undefined : () => handleOpenMobileView(index)
                }
                viewMode={viewMode}
              />
            ))
          : items.map((item, index) => (
              <Fragment key={item.id}>
                <ZoraPostCard
                  item={item}
                  onOpenMobileView={() => handleOpenMobileView(index)}
                  viewMode={viewMode}
                />
                {(index + 1) % 3 === 0 && suggestions.length >= 4 ? (
                  <WhoToFollowFeedBlock
                    startIndex={getSuggestionStartIndex(index)}
                    suggestions={suggestions}
                  />
                ) : null}
              </Fragment>
            ))}

        {hasNextPage ? (
          <div
            className={cn(
              "flex justify-center py-4",
              isGridView ? "col-span-full px-0" : "px-5 md:px-0"
            )}
          >
            <span ref={loadMoreRef} />
            {isFetchingNextPage ? <Spinner size="sm" /> : null}
          </div>
        ) : null}
      </section>

      <ZoraPostMobileViewer
        hasNextPage={Boolean(hasNextPage)}
        initialIndex={selectedPostIndex ?? 0}
        isFetchingMore={isFetchingNextPage}
        items={selectedPostIndex !== null ? items : []}
        onClose={() => setSelectedPostIndex(null)}
        onRequestMore={handleLoadMore}
      />
    </>
  );
};

export default ZoraFeed;
