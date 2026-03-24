import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Shared/UI";
import {
  EVERY1_COMMUNITIES_QUERY_KEY,
  EVERY1_COMMUNITY_FEED_QUERY_KEY,
  EVERY1_COMMUNITY_QUERY_KEY,
  EVERY1_NOTIFICATION_COUNT_QUERY_KEY,
  EVERY1_NOTIFICATIONS_QUERY_KEY,
  joinCommunity,
  leaveCommunity
} from "@/helpers/every1";
import stopEventPropagation from "@/helpers/stopEventPropagation";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import type {
  Every1CommunityDetails,
  Every1CommunitySummary
} from "@/types/every1";

interface JoinLeaveButtonProps {
  hideJoinButton?: boolean;
  hideLeaveButton?: boolean;
  community: Every1CommunityDetails | Every1CommunitySummary;
  small?: boolean;
}

const JoinLeaveButton = ({
  hideJoinButton = false,
  hideLeaveButton = false,
  community,
  small = false
}: JoinLeaveButtonProps) => {
  const queryClient = useQueryClient();
  const { profile } = useEvery1Store();

  const invalidateCommunity = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [EVERY1_COMMUNITIES_QUERY_KEY]
      }),
      queryClient.invalidateQueries({
        queryKey: [EVERY1_COMMUNITY_QUERY_KEY, community.slug]
      }),
      queryClient.invalidateQueries({
        queryKey: [EVERY1_COMMUNITY_FEED_QUERY_KEY, community.id]
      }),
      profile?.id
        ? queryClient.invalidateQueries({
            queryKey: [EVERY1_NOTIFICATIONS_QUERY_KEY, profile.id]
          })
        : Promise.resolve(),
      profile?.id
        ? queryClient.invalidateQueries({
            queryKey: [EVERY1_NOTIFICATION_COUNT_QUERY_KEY, profile.id]
          })
        : Promise.resolve()
    ]);
  };

  const joinCommunityMutation = useMutation({
    mutationFn: async () =>
      await joinCommunity(community.id, profile?.id as string),
    onError: (error) => {
      toast.error("Failed to join community", {
        description:
          error instanceof Error ? error.message : "Please try again."
      });
    },
    onSuccess: async (result) => {
      await invalidateCommunity();

      if (result.status === "requested") {
        toast.success("Request sent", {
          description: "The community owner has been notified."
        });
        return;
      }

      toast.success("Joined community", {
        description: `You're now part of ${community.name}.`
      });
    }
  });

  const leaveCommunityMutation = useMutation({
    mutationFn: async () =>
      await leaveCommunity(community.id, profile?.id as string),
    onError: (error) => {
      toast.error("Failed to leave community", {
        description:
          error instanceof Error ? error.message : "Please try again."
      });
    },
    onSuccess: async () => {
      await invalidateCommunity();
      toast.success("Left community", {
        description: `You left ${community.name}.`
      });
    }
  });

  if (!profile?.id || community.isOwner) {
    return null;
  }

  if (!hideLeaveButton && community.membershipStatus === "active") {
    return (
      <div className="contents" onClick={stopEventPropagation}>
        <Button
          loading={leaveCommunityMutation.isPending}
          onClick={() => leaveCommunityMutation.mutate()}
          outline
          size={small ? "sm" : "md"}
        >
          Leave
        </Button>
      </div>
    );
  }

  if (!hideJoinButton && community.membershipStatus === "requested") {
    return (
      <div className="contents" onClick={stopEventPropagation}>
        <Button disabled outline size={small ? "sm" : "md"}>
          Pending
        </Button>
      </div>
    );
  }

  if (hideJoinButton) {
    return null;
  }

  return (
    <div className="contents" onClick={stopEventPropagation}>
      <Button
        loading={joinCommunityMutation.isPending}
        onClick={() => joinCommunityMutation.mutate()}
        size={small ? "sm" : "md"}
      >
        Join
      </Button>
    </div>
  );
};

export default memo(JoinLeaveButton);
