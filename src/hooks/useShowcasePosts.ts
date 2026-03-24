import { useQuery } from "@tanstack/react-query";
import {
  getPublicShowcasePosts,
  PUBLIC_SHOWCASE_QUERY_KEY
} from "@/helpers/staff";
import { hasSupabaseConfig } from "@/helpers/supabase";
import { showcaseFallbackPosts } from "@/components/Showcase/data";

const useShowcasePosts = () =>
  useQuery({
    queryFn: async () => {
      if (!hasSupabaseConfig()) {
        return showcaseFallbackPosts;
      }

      const posts = await getPublicShowcasePosts();
      return posts.length > 0 ? posts : showcaseFallbackPosts;
    },
    queryKey: [PUBLIC_SHOWCASE_QUERY_KEY],
    staleTime: 60_000
  });

export default useShowcasePosts;
