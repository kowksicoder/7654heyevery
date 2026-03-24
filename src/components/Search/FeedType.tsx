import { useSearchParams } from "react-router";
import { Tabs } from "@/components/Shared/UI";

export enum SearchTabFocus {
  Coins = "COINS",
  Creators = "CREATORS",
  Communities = "COMMUNITIES"
}

interface FeedTypeProps {
  feedType: SearchTabFocus;
}

const FeedType = ({ feedType }: FeedTypeProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabs = [
    { name: "Coins", type: SearchTabFocus.Coins },
    { name: "Creators", type: SearchTabFocus.Creators },
    { name: "Communities", type: SearchTabFocus.Communities }
  ];

  const updateQuery = (type?: string) => {
    if (!type) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("type", type.toLowerCase());
    setSearchParams(nextParams);
  };

  return (
    <Tabs
      active={feedType}
      className="mx-0 mb-0"
      itemClassName="rounded-xl border border-gray-200/80 bg-white px-2.5 py-1.5 font-medium text-[11px] text-gray-700 md:rounded-2xl md:px-3 md:py-1.75 md:text-[12px] dark:border-gray-800/80 dark:bg-[#090909] dark:text-gray-200"
      layoutId="search_tab"
      mobileScrollable
      setActive={updateQuery}
      tabs={tabs}
    />
  );
};

export default FeedType;
