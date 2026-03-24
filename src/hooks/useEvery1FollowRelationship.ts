import { useQuery } from "@tanstack/react-query";
import {
  EVERY1_FOLLOW_RELATIONSHIP_QUERY_KEY,
  getFollowRelationship
} from "@/helpers/every1";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import type { Every1FollowRelationship } from "@/types/every1";

const EMPTY_RELATIONSHIP: Every1FollowRelationship = {
  isFollowedByMe: false,
  isFollowingMe: false
};

const useEvery1FollowRelationship = (targetProfileId?: null | string) => {
  const { profile } = useEvery1Store();

  const query = useQuery({
    enabled:
      hasSupabaseConfig() &&
      Boolean(profile?.id) &&
      Boolean(targetProfileId) &&
      profile?.id !== targetProfileId,
    queryFn: async () =>
      await getFollowRelationship(
        profile?.id as string,
        targetProfileId as string
      ),
    queryKey: [
      EVERY1_FOLLOW_RELATIONSHIP_QUERY_KEY,
      profile?.id || null,
      targetProfileId || null
    ]
  });

  return {
    ...query,
    relationship: query.data || EMPTY_RELATIONSHIP
  };
};

export default useEvery1FollowRelationship;
