import { UsersIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import SingleAccount from "@/components/Shared/Account/SingleAccount";
import SingleAccountsShimmer from "@/components/Shared/Shimmer/SingleAccountsShimmer";
import { Card, EmptyState, ErrorMessage } from "@/components/Shared/UI";
import {
  EVERY1_PROFILE_QUERY_KEY,
  searchPublicEvery1Profiles
} from "@/helpers/every1";
import { buildAccountFromEvery1Profile } from "@/helpers/privy";
import { hasSupabaseConfig } from "@/helpers/supabase";
import useLoadMoreOnIntersect from "@/hooks/useLoadMoreOnIntersect";
import {
  AccountsOrderBy,
  type AccountsRequest,
  PageSize,
  useAccountsQuery
} from "@/indexer/generated";

interface AccountsProps {
  query: string;
}

const Accounts = ({ query }: AccountsProps) => {
  const hasConfiguredSupabase = hasSupabaseConfig();
  const request: AccountsRequest = {
    filter: { searchBy: { localNameQuery: query } },
    orderBy: AccountsOrderBy.BestMatch,
    pageSize: PageSize.Fifty
  };

  const {
    data: every1Profiles,
    error: every1Error,
    isLoading: loadingEvery1Profiles
  } = useQuery({
    enabled: hasConfiguredSupabase && Boolean(query),
    queryFn: async () => await searchPublicEvery1Profiles(query, 50),
    queryKey: [EVERY1_PROFILE_QUERY_KEY, "search-page", query]
  });

  const { data, error, fetchMore, loading } = useAccountsQuery({
    skip: hasConfiguredSupabase || !query,
    variables: { request }
  });

  const accounts = hasConfiguredSupabase
    ? every1Profiles?.map((profile) => buildAccountFromEvery1Profile(profile))
    : data?.accounts?.items;
  const searchError = error ?? every1Error ?? undefined;
  const pageInfo = data?.accounts?.pageInfo;
  const hasMore = hasConfiguredSupabase ? false : pageInfo?.next;

  const handleEndReached = useCallback(async () => {
    if (hasMore) {
      await fetchMore({
        variables: { request: { ...request, cursor: pageInfo?.next } }
      });
    }
  }, [fetchMore, hasMore, pageInfo?.next, request]);

  const loadMoreRef = useLoadMoreOnIntersect(handleEndReached);

  if (loading || loadingEvery1Profiles) {
    return <SingleAccountsShimmer isBig />;
  }

  if (searchError) {
    return <ErrorMessage error={searchError} title="Failed to load creators" />;
  }

  if (!accounts?.length) {
    return (
      <EmptyState
        icon={<UsersIcon className="size-8" />}
        message={
          <span>
            No creators for <b>&ldquo;{query}&rdquo;</b>
          </span>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {accounts.map((account) => (
        <Card
          className="rounded-[28px] border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-[#090909]"
          forceRounded
          key={account.address}
        >
          <SingleAccount
            account={account}
            followButtonClassName="min-w-[4.5rem] px-2.5 py-0 text-[11px] leading-none"
            isBig
            showBio
          />
        </Card>
      ))}
      {hasMore ? <span className="col-span-full" ref={loadMoreRef} /> : null}
    </div>
  );
};

export default Accounts;
