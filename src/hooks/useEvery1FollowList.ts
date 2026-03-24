import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_FOLLOW_LIST_QUERY_KEY,
  listProfileFollowers,
  listProfileFollowing
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";

interface UseEvery1FollowListOptions {
  limit?: number;
  mode: "followers" | "following";
  profileId?: null | string;
}

const useEvery1FollowList = ({
  limit = 100,
  mode,
  profileId
}: UseEvery1FollowListOptions) =>
  useQuery({
    enabled: hasSupabaseConfig() && Boolean(profileId),
    queryFn: async () =>
      mode === "followers"
        ? await listProfileFollowers(profileId as string, limit)
        : await listProfileFollowing(profileId as string, limit),
    queryKey: [EVERY1_FOLLOW_LIST_QUERY_KEY, mode, profileId || null, limit]
  });

export default useEvery1FollowList;
