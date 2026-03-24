import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Shared/UI";
import {
  EVERY1_FOLLOW_LIST_QUERY_KEY,
  EVERY1_FOLLOW_RELATIONSHIP_QUERY_KEY,
  EVERY1_FOLLOW_STATS_QUERY_KEY,
  EVERY1_PROFILE_QUERY_KEY,
  ensureEvery1ProfileForAccount,
  syncEvery1Profile,
  unfollowProfile
} from "@/helpers/every1";
import useOpenAuth from "@/hooks/useOpenAuth";
import type { AccountFragment } from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

interface UnfollowProps {
  buttonClassName: string;
  account: AccountFragment;
  small: boolean;
  title: string;
}

const Unfollow = ({
  buttonClassName,
  account,
  small,
  title
}: UnfollowProps) => {
  const queryClient = useQueryClient();
  const { currentAccount } = useAccountStore();
  const { profile, setProfile } = useEvery1Store();
  const openAuth = useOpenAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateUnfollow = async () => {
    if (!currentAccount) {
      return void openAuth("open_login");
    }

    setIsSubmitting(true);
    umami.track("unfollow");

    try {
      const viewerProfile =
        profile || (await syncEvery1Profile(currentAccount));
      const targetProfile = await ensureEvery1ProfileForAccount(account);

      if (!profile?.id || profile.id !== viewerProfile.id) {
        setProfile(viewerProfile);
      }

      await unfollowProfile(viewerProfile.id, targetProfile.id);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [EVERY1_PROFILE_QUERY_KEY]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_FOLLOW_RELATIONSHIP_QUERY_KEY]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_FOLLOW_STATS_QUERY_KEY]
        }),
        queryClient.invalidateQueries({
          queryKey: [EVERY1_FOLLOW_LIST_QUERY_KEY]
        })
      ]);
    } catch (error) {
      console.error("Failed to unfollow profile", error);
      toast.error("Couldn't unfollow this profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      aria-label={title}
      className={buttonClassName}
      disabled={isSubmitting}
      loading={isSubmitting}
      onClick={handleCreateUnfollow}
      size={small ? "sm" : "md"}
    >
      {title}
    </Button>
  );
};

export default Unfollow;
