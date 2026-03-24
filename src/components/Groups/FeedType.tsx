import type { Dispatch, SetStateAction } from "react";
import { Tabs } from "@/components/Shared/UI";
import { GroupsFeedType } from "@/data/enums";

interface FeedTypeProps {
  feedType: GroupsFeedType;
  setFeedType: Dispatch<SetStateAction<GroupsFeedType>>;
}

const FeedType = ({ feedType, setFeedType }: FeedTypeProps) => {
  const tabs = [
    { name: "Discover", type: GroupsFeedType.Discover },
    { name: "Joined", type: GroupsFeedType.Member },
    { name: "Managed", type: GroupsFeedType.Managed }
  ];

  return (
    <Tabs
      active={feedType}
      className="mx-5 mb-5 md:mx-0"
      layoutId="groups_tab"
      setActive={(type) => {
        const nextType = type as GroupsFeedType;
        setFeedType(nextType);
      }}
      tabs={tabs}
    />
  );
};

export default FeedType;
