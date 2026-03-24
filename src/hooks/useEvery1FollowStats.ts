import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_FOLLOW_STATS_QUERY_KEY,
  getProfileFollowStats
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import type { Every1FollowStats } from "@/types/every1";

const EMPTY_STATS: Every1FollowStats = {
  followers: 0,
  following: 0,
  profileId: null
};

const useEvery1FollowStats = (profileId?: null | string) => {
  const query = useQuery({
    enabled: hasSupabaseConfig() && Boolean(profileId),
    queryFn: async () => await getProfileFollowStats(profileId as string),
    queryKey: [EVERY1_FOLLOW_STATS_QUERY_KEY, profileId || null]
  });

  return {
    ...query,
    stats: query.data || EMPTY_STATS
  };
};

export default useEvery1FollowStats;
