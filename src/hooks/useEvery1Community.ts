import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_COMMUNITY_QUERY_KEY,
  getCommunityBySlug
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";

interface UseEvery1CommunityOptions {
  profileId?: null | string;
  slug?: null | string;
}

const useEvery1Community = ({
  profileId,
  slug
}: UseEvery1CommunityOptions = {}) =>
  useQuery({
    enabled: hasSupabaseConfig() && Boolean(slug),
    queryFn: async () =>
      await getCommunityBySlug({
        profileId,
        slug: slug as string
      }),
    queryKey: [EVERY1_COMMUNITY_QUERY_KEY, slug || null, profileId || null]
  });

export default useEvery1Community;
