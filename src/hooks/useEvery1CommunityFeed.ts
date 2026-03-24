import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_COMMUNITY_FEED_QUERY_KEY,
  listCommunityPosts
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";

interface UseEvery1CommunityFeedOptions {
  communityId?: null | string;
  limit?: number;
  profileId?: null | string;
}

const useEvery1CommunityFeed = ({
  communityId,
  limit = 50,
  profileId
}: UseEvery1CommunityFeedOptions = {}) =>
  useQuery({
    enabled: hasSupabaseConfig() && Boolean(communityId),
    queryFn: () =>
      listCommunityPosts({
        communityId: communityId as string,
        limit,
        profileId
      }),
    queryKey: [
      EVERY1_COMMUNITY_FEED_QUERY_KEY,
      communityId || null,
      profileId || null,
      limit
    ]
  });

export default useEvery1CommunityFeed;
