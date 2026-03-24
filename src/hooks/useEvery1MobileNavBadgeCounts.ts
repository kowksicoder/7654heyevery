import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_MOBILE_NAV_BADGE_COUNTS_QUERY_KEY,
  getMobileNavBadgeCounts
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const EMPTY_COUNTS = {
  creatorsCount: 0,
  exploreCount: 0,
  leaderboardCount: 0
};

const useEvery1MobileNavBadgeCounts = () => {
  const { profile } = useEvery1Store();

  const query = useQuery({
    enabled: Boolean(profile?.id) && hasSupabaseConfig(),
    queryFn: () => getMobileNavBadgeCounts(profile?.id as string),
    queryKey: [EVERY1_MOBILE_NAV_BADGE_COUNTS_QUERY_KEY, profile?.id],
    refetchInterval: 10000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  return query.data ?? EMPTY_COUNTS;
};

export default useEvery1MobileNavBadgeCounts;
