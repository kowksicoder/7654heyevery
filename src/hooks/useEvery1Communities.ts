import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_COMMUNITIES_QUERY_KEY,
  listProfileCommunities
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";

interface UseEvery1CommunitiesOptions {
  enabled?: boolean;
  feedType?: "discover" | "managed" | "member";
  limit?: number;
  profileId?: null | string;
  search?: null | string;
}

const useEvery1Communities = ({
  enabled = true,
  feedType = "discover",
  limit = 50,
  profileId,
  search
}: UseEvery1CommunitiesOptions = {}) =>
  useQuery({
    enabled:
      enabled &&
      hasSupabaseConfig() &&
      (feedType === "discover" || Boolean(profileId)),
    queryFn: () =>
      listProfileCommunities({
        feedType,
        limit,
        profileId,
        search
      }),
    queryKey: [
      EVERY1_COMMUNITIES_QUERY_KEY,
      feedType,
      profileId || null,
      search || "",
      limit
    ]
  });

export default useEvery1Communities;
