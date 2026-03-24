import { LENS_NAMESPACE } from "@/data/constants";
import { Regex } from "@/data/regex";
import type { AccountFragment } from "@/indexer/generated";
import formatAddress from "./formatAddress";
import isAccountDeleted from "./isAccountDeleted";

interface AccountInfo {
  name: string;
  link: string;
  username: string;
}

const sanitizeHandle = (value?: null | string) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const withoutPrefix = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  const lastSegment = withoutPrefix.split("/").pop()?.trim() || withoutPrefix;

  return lastSegment || null;
};

export const getProfileHandle = (
  account?: Pick<AccountFragment, "username"> | null
) => {
  const usernameValue = account?.username?.value;
  const localName = account?.username?.localName;

  if (usernameValue?.includes(LENS_NAMESPACE)) {
    return sanitizeHandle(localName || usernameValue);
  }

  return sanitizeHandle(localName || usernameValue);
};

export const getPublicProfilePathByHandle = (handle?: null | string) => {
  const normalizedHandle = sanitizeHandle(handle);

  return normalizedHandle ? `/@${normalizedHandle}` : "";
};

export const getPublicProfilePath = (input: {
  address?: null | string;
  handle?: null | string;
}) => {
  const handlePath = getPublicProfilePathByHandle(input.handle);

  if (handlePath) {
    return handlePath;
  }

  return input.address ? `/account/${input.address}` : "";
};

const sanitizeDisplayName = (name?: null | string): null | string => {
  if (!name) {
    return null;
  }

  return name.replace(Regex.accountNameFilter, " ").trim().replace(/\s+/g, " ");
};

const UNKNOWN_ACCOUNT: AccountInfo = {
  link: "",
  name: "...",
  username: "..."
};

const DELETED_ACCOUNT: AccountInfo = {
  link: "",
  name: "Deleted Account",
  username: "deleted"
};

const getAccount = (account?: AccountFragment): AccountInfo => {
  if (!account) {
    return UNKNOWN_ACCOUNT;
  }

  if (isAccountDeleted(account)) {
    return DELETED_ACCOUNT;
  }

  const { address } = account;
  const handle = getProfileHandle(account);
  const usernamePrefix = handle ? "" : "#";
  const usernameValueOrAddress = handle || formatAddress(address);
  const link = getPublicProfilePath({ address, handle });

  return {
    link,
    name: sanitizeDisplayName(account.metadata?.name) || usernameValueOrAddress,
    username: `${usernamePrefix}${usernameValueOrAddress}`
  };
};

export default getAccount;
