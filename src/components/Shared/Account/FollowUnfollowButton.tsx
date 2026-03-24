import stopEventPropagation from "@/helpers/stopEventPropagation";
import useEvery1AccountProfile from "@/hooks/useEvery1AccountProfile";
import useEvery1FollowRelationship from "@/hooks/useEvery1FollowRelationship";
import type { AccountFragment } from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";
import FollowWithRulesCheck from "./FollowWithRulesCheck";
import Unfollow from "./Unfollow";

interface FollowUnfollowButtonProps {
  buttonClassName?: string;
  hideFollowButton?: boolean;
  hideUnfollowButton?: boolean;
  account: AccountFragment;
  small?: boolean;
  unfollowTitle?: string;
}

const FollowUnfollowButton = ({
  buttonClassName = "",
  hideFollowButton = false,
  hideUnfollowButton = false,
  account,
  small = false,
  unfollowTitle = "Following"
}: FollowUnfollowButtonProps) => {
  const { currentAccount } = useAccountStore();
  const { profile } = useEvery1Store();
  const { profileId: targetProfileId } = useEvery1AccountProfile(account);
  const { relationship } = useEvery1FollowRelationship(targetProfileId);

  const isSelf =
    Boolean(profile?.id && targetProfileId && profile.id === targetProfileId) ||
    currentAccount?.address === account.address ||
    currentAccount?.owner === account.owner;

  if (isSelf) {
    return null;
  }

  const isFollowedByMe =
    relationship.isFollowedByMe || account.operations?.isFollowedByMe || false;

  return (
    <div className="contents" onClick={stopEventPropagation}>
      {!hideFollowButton &&
        (isFollowedByMe ? null : (
          <FollowWithRulesCheck
            account={account}
            buttonClassName={buttonClassName}
            small={small}
          />
        ))}
      {!hideUnfollowButton &&
        (isFollowedByMe ? (
          <Unfollow
            account={account}
            buttonClassName={buttonClassName}
            small={small}
            title={unfollowTitle}
          />
        ) : null)}
    </div>
  );
};

export default FollowUnfollowButton;
