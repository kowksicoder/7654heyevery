import { type ChangeEvent, useState } from "react";
import Loader from "@/components/Shared/Loader";
import { Card, Input } from "@/components/Shared/UI";
import { searchPublicEvery1Profiles } from "@/helpers/every1";
import { buildAccountFromEvery1Profile } from "@/helpers/privy";
import { hasSupabaseConfig } from "@/helpers/supabase";
import {
  type AccountFragment,
  AccountsOrderBy,
  type AccountsRequest,
  PageSize,
  useAccountsLazyQuery
} from "@/indexer/generated";
import SmallSingleAccount from "./SmallSingleAccount";

interface SearchAccountsProps {
  error?: boolean;
  hideDropdown?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAccountSelected: (account: AccountFragment) => void;
  placeholder?: string;
  value: string;
}

const SearchAccounts = ({
  error = false,
  hideDropdown = false,
  onChange,
  onAccountSelected,
  placeholder = "Search…",
  value
}: SearchAccountsProps) => {
  const hasConfiguredSupabase = hasSupabaseConfig();
  const [accounts, setAccounts] = useState<AccountFragment[]>([]);
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false);
  const [searchAccounts, { data, loading: loadingLensAccounts }] =
    useAccountsLazyQuery();
  const loading = hasConfiguredSupabase
    ? isSearchingProfiles
    : loadingLensAccounts;

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event);

    const keyword = event.target.value;

    if (!keyword.trim()) {
      setAccounts([]);
      setIsSearchingProfiles(false);
      return;
    }

    if (hasConfiguredSupabase) {
      setIsSearchingProfiles(true);

      void searchPublicEvery1Profiles(keyword, 7)
        .then((profiles) => {
          setAccounts(
            profiles.map((profile) => buildAccountFromEvery1Profile(profile))
          );
        })
        .catch(() => {
          setAccounts([]);
        })
        .finally(() => {
          setIsSearchingProfiles(false);
        });

      return;
    }

    const request: AccountsRequest = {
      filter: { searchBy: { localNameQuery: keyword } },
      orderBy: AccountsOrderBy.BestMatch,
      pageSize: PageSize.Fifty
    };

    searchAccounts({ variables: { request } });
  };

  const fallbackAccounts = data?.accounts?.items;
  const safeAccounts = hasConfiguredSupabase ? accounts : fallbackAccounts;

  return (
    <div className="relative w-full">
      <Input
        error={error}
        onChange={handleSearch}
        placeholder={placeholder}
        type="text"
        value={value}
      />
      {!hideDropdown && value.length > 0 && (
        <div className="absolute mt-2 flex w-[94%] max-w-md flex-col">
          <Card className="z-[2] max-h-[80vh] overflow-y-auto py-2">
            {loading ? (
              <Loader className="my-3" message="Searching users" small />
            ) : safeAccounts && safeAccounts.length > 0 ? (
              safeAccounts.slice(0, 7).map((account) => (
                <div
                  className="cursor-pointer px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                  key={account.address}
                  onClick={() => onAccountSelected(account)}
                >
                  <SmallSingleAccount account={account} />
                </div>
              ))
            ) : (
              <div className="px-4 py-2">No matching users</div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default SearchAccounts;
