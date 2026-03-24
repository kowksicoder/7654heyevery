import type { Dispatch, SetStateAction } from "react";
import { Tabs } from "@/components/Shared/UI";
import { NotificationFeedType } from "@/data/enums";

interface FeedTypeProps {
  feedType: NotificationFeedType;
  setFeedType: Dispatch<SetStateAction<NotificationFeedType>>;
}

const FeedType = ({ feedType, setFeedType }: FeedTypeProps) => {
  const tabs = [
    { name: "All", type: NotificationFeedType.All },
    { name: "Activity", type: NotificationFeedType.Activity },
    { name: "Referrals", type: NotificationFeedType.Referrals },
    { name: "Rewards", type: NotificationFeedType.Rewards },
    { name: "System", type: NotificationFeedType.System }
  ];

  return (
    <Tabs
      active={feedType}
      className="mx-3 mb-3 md:mx-0 md:mb-4"
      itemClassName="px-3 py-1 text-[12px] md:px-3.5 md:py-1.5 md:text-sm"
      layoutId="notification_tab"
      mobileScrollable
      setActive={(type) => {
        const nextType = type as NotificationFeedType;
        setFeedType(nextType);
      }}
      tabs={tabs}
    />
  );
};

export default FeedType;
