import type { AccountFragment } from "@/indexer/generated";
import Follow from "./Follow";

interface FollowWithRulesCheckProps {
  buttonClassName: string;
  account: AccountFragment;
  small: boolean;
}

const FollowWithRulesCheck = ({
  buttonClassName,
  account,
  small
}: FollowWithRulesCheckProps) => {
  return (
    <Follow account={account} buttonClassName={buttonClassName} small={small} />
  );
};

export default FollowWithRulesCheck;
