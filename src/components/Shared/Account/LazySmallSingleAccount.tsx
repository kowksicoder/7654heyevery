import { useQuery } from "@tanstack/react-query";
import SmallSingleAccountShimmer from "@/components/Shared/Shimmer/SmallSingleAccountShimmer";
import {
  EVERY1_PROFILE_QUERY_KEY,
  getPublicEvery1Profile
} from "@/helpers/every1";
import { buildAccountFromEvery1Profile } from "@/helpers/privy";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useAccountQuery } from "@/indexer/generated";
import SmallSingleAccount from "./SmallSingleAccount";

interface LazySmallSingleAccountProps {
  hideSlug?: boolean;
  address: string;
  linkToAccount?: boolean;
}

const LazySmallSingleAccount = ({
  hideSlug = false,
  address,
  linkToAccount = false
}: LazySmallSingleAccountProps) => {
  const hasConfiguredSupabase = hasSupabaseConfig();
  const { data: every1Profile, isLoading: loadingEvery1Profile } = useQuery({
    enabled: hasConfiguredSupabase && Boolean(address),
    queryFn: async () => await getPublicEvery1Profile({ address }),
    queryKey: [EVERY1_PROFILE_QUERY_KEY, "lazy-account", address]
  });
  const { data, loading } = useAccountQuery({
    skip:
      !address ||
      Boolean(every1Profile) ||
      (hasConfiguredSupabase && loadingEvery1Profile),
    variables: { request: { address } }
  });
  const account = every1Profile
    ? buildAccountFromEvery1Profile(every1Profile, address)
    : data?.account;

  if (loading || loadingEvery1Profile) {
    return <SmallSingleAccountShimmer smallAvatar />;
  }

  if (!account) {
    return null;
  }

  return (
    <SmallSingleAccount
      account={account}
      hideSlug={hideSlug}
      linkToAccount={linkToAccount}
      smallAvatar
    />
  );
};

export default LazySmallSingleAccount;
