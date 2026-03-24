import { useMemo } from "react";
import { useSearchParams } from "react-router";
import PageLayout from "@/components/Shared/PageLayout";
import { default as SearchInput } from "@/components/Shared/Search";
import Accounts from "./Accounts";
import Coins from "./Coins";
import FeedType, { SearchTabFocus } from "./FeedType";
import Groups from "./Groups";
import SearchLanding from "./SearchLanding";

const normalizeSearchFeedType = (value?: null | string) => {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "accounts":
    case "creators":
      return SearchTabFocus.Creators;
    case "groups":
    case "communities":
      return SearchTabFocus.Communities;
    default:
      return SearchTabFocus.Coins;
  }
};

const Search = () => {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() || "";
  const type = searchParams.get("type");
  const feedType = useMemo(() => normalizeSearchFeedType(type), [type]);

  return (
    <PageLayout hideSearch title="Search" zeroTopMargin>
      <div className="space-y-4 px-3 pt-2.5 md:space-y-5 md:px-0 md:pt-0">
        <section className="rounded-[24px] bg-white/95 p-2.5 shadow-xs backdrop-blur md:rounded-[28px] md:p-3.5 dark:bg-[#060606]/95">
          <SearchInput
            inputClassName="px-3 py-2.5 text-[13px] md:px-4 md:py-3 md:text-[15px]"
            placeholder="Search creators, coins, communities..."
          />
        </section>

        {q ? (
          <section className="space-y-3 md:space-y-4">
            <div className="rounded-[20px] bg-gray-50/75 p-1.5 md:rounded-[24px] md:p-2.5 dark:bg-[#050505]">
              <FeedType feedType={feedType} />
            </div>

            {feedType === SearchTabFocus.Coins ? <Coins query={q} /> : null}
            {feedType === SearchTabFocus.Creators ? (
              <Accounts query={q} />
            ) : null}
            {feedType === SearchTabFocus.Communities ? (
              <Groups query={q} />
            ) : null}
          </section>
        ) : (
          <SearchLanding />
        )}
      </div>
    </PageLayout>
  );
};

export default Search;
