import { MapPinIcon } from "@heroicons/react/24/outline";
import { BeakerIcon, CheckBadgeIcon } from "@heroicons/react/24/solid";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import FollowUnfollowButton from "@/components/Shared/Account/FollowUnfollowButton";
import TipButton from "@/components/Shared/Account/TipButton";
import Markup from "@/components/Shared/Markup";
import Slug from "@/components/Shared/Slug";
import { Button, H3, Image, LightBox, Tooltip } from "@/components/Shared/UI";
import { STATIC_IMAGES_URL, TRANSFORMS } from "@/data/constants";
import getAccount from "@/helpers//getAccount";
import getAvatar from "@/helpers//getAvatar";
import getAccountAttribute from "@/helpers/getAccountAttribute";
import getFavicon from "@/helpers/getFavicon";
import getMentions from "@/helpers/getMentions";
import { isEvery1OnlyAccount } from "@/helpers/privy";
import useEvery1AccountProfile from "@/hooks/useEvery1AccountProfile";
import useEvery1FollowRelationship from "@/hooks/useEvery1FollowRelationship";
import { useTheme } from "@/hooks/useTheme";
import type { AccountFragment } from "@/indexer/generated";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import ENSBadge from "../Shared/Account/ENSBadge";
import CreatorCoin from "./CreatorCoin";
import Followerings from "./Followerings";
import FollowersYouKnowOverview from "./FollowersYouKnowOverview";
import AccountMenu from "./Menu";
import MetaDetails from "./MetaDetails";

interface DetailsProps {
  isBlockedByMe: boolean;
  hasBlockedMe: boolean;
  account: AccountFragment;
}

const Details = ({
  isBlockedByMe = false,
  hasBlockedMe = false,
  account
}: DetailsProps) => {
  const navigate = useNavigate();
  const { currentAccount } = useAccountStore();
  const [showLightBox, setShowLightBox] = useState<boolean>(false);
  const { theme } = useTheme();
  const supportsLegacyActions = !isEvery1OnlyAccount(account);
  const { profile: every1Profile, profileId } =
    useEvery1AccountProfile(account);
  const { relationship } = useEvery1FollowRelationship(profileId);
  const accountInfo = getAccount(account);
  const isCurrentProfile = currentAccount?.address === account.address;
  const creatorCoinAddress = getAccountAttribute(
    "creatorCoinAddress",
    account?.metadata?.attributes
  );
  const followsYou =
    relationship.isFollowingMe || account.operations?.isFollowingMe || false;
  const verificationStatus =
    every1Profile?.verificationStatus ||
    (account.hasSubscribed ? "verified" : "unverified");
  const isOfficial = verificationStatus === "verified" || account.hasSubscribed;

  const handleShowLightBox = useCallback(() => {
    setShowLightBox(true);
  }, []);

  const handleCloseLightBox = useCallback(() => {
    setShowLightBox(false);
  }, []);

  const renderAccountAttribute = (
    attribute: "location" | "website" | "x",
    icon: ReactNode
  ) => {
    if (isBlockedByMe || hasBlockedMe) return null;

    const value = getAccountAttribute(attribute, account?.metadata?.attributes);
    if (!value) return null;

    return (
      <MetaDetails icon={icon}>
        <Link
          rel="noreferrer noopener"
          target="_blank"
          to={
            attribute === "website"
              ? `https://${value.replace(/https?:\/\//, "")}`
              : `https://x.com/${value.replace("https://x.com/", "")}`
          }
        >
          {value.replace(/https?:\/\//, "")}
        </Link>
      </MetaDetails>
    );
  };

  const websiteMeta = renderAccountAttribute(
    "website",
    <img
      alt="Website"
      className="size-4 rounded-full"
      height={16}
      src={getFavicon(
        getAccountAttribute("website", account?.metadata?.attributes)
      )}
      width={16}
    />
  );
  const xMeta = renderAccountAttribute(
    "x",
    <Image
      alt="X Logo"
      className="size-4"
      height={16}
      src={`${STATIC_IMAGES_URL}/brands/${theme === "dark" ? "x-dark.png" : "x-light.png"}`}
      width={16}
    />
  );

  const metaItems = [
    !isBlockedByMe &&
    !hasBlockedMe &&
    getAccountAttribute("location", account?.metadata?.attributes) ? (
      <MetaDetails icon={<MapPinIcon className="size-4" />} key="location">
        {getAccountAttribute("location", account?.metadata?.attributes)}
      </MetaDetails>
    ) : null,
    websiteMeta ? <div key="website">{websiteMeta}</div> : null,
    xMeta ? <div key="x">{xMeta}</div> : null
  ].filter(Boolean);

  return (
    <div className="relative z-10 -mt-14 mb-4 px-4 sm:-mt-20 md:-mt-24 md:px-0">
      <div className="overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white/95 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <div className="flex justify-end px-4 pt-4 sm:px-6">
          <div className="flex items-center gap-2">
            {!isBlockedByMe && !hasBlockedMe ? (
              <TipButton account={account} />
            ) : null}
            <div className="rounded-full border border-gray-200/80 bg-white/85 dark:border-gray-800 dark:bg-gray-900/80">
              <AccountMenu account={account} />
            </div>
          </div>
        </div>

        <div className="-mt-12 flex flex-col items-center px-4 pb-5 text-center sm:-mt-18 sm:px-6">
          <button
            className="rounded-full"
            onClick={handleShowLightBox}
            type="button"
          >
            <Image
              alt={account.address}
              className="size-24 cursor-pointer rounded-full bg-gray-200 ring-4 ring-white sm:size-32 dark:bg-gray-700 dark:ring-gray-950"
              height={128}
              src={getAvatar(account, TRANSFORMS.AVATAR_BIG)}
              width={128}
            />
          </button>
          <LightBox
            images={[getAvatar(account, TRANSFORMS.EXPANDED_AVATAR)]}
            onClose={handleCloseLightBox}
            show={showLightBox}
          />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <H3 className="!text-3xl sm:!text-4xl truncate">
              {accountInfo.name}
            </H3>
            {isOfficial ? (
              <Tooltip content="Official creator" placement="right">
                <CheckBadgeIcon className="size-5 text-brand-500" />
              </Tooltip>
            ) : isCurrentProfile && verificationStatus === "pending" ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-[11px] text-blue-700 dark:border-blue-900/80 dark:bg-blue-950/40 dark:text-blue-300">
                Pending review
              </span>
            ) : isCurrentProfile ? (
              <button
                className="flex items-center gap-x-1 rounded-full border border-gray-200/80 bg-white/80 px-2.5 py-1 font-semibold text-xs dark:border-gray-700 dark:bg-gray-900/70"
                onClick={() => navigate("/settings/verification")}
                type="button"
              >
                <CheckBadgeIcon className="size-4 text-brand-500" />
                Claim Official
              </button>
            ) : null}
            {account.isBeta ? (
              <Tooltip content="Beta" placement="right">
                <BeakerIcon className="size-5 text-green-500" />
              </Tooltip>
            ) : null}
            <ENSBadge account={account} className="size-5" linkToDashboard />
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Slug
              className="text-gray-500 text-sm sm:text-base dark:text-gray-400"
              slug={accountInfo.username}
            />
            {followsYou ? (
              <div className="rounded-full bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700">
                Follows you
              </div>
            ) : null}
          </div>

          {!isBlockedByMe && !hasBlockedMe && account?.metadata?.bio ? (
            <div className="mt-3 max-w-2xl text-center text-gray-600 text-sm leading-6 dark:text-gray-300">
              <div className="markup linkify">
                <Markup mentions={getMentions(account?.metadata.bio)}>
                  {account?.metadata.bio}
                </Markup>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-2.5">
            {isCurrentProfile ? (
              <Button
                className="min-w-36 justify-center"
                onClick={() => navigate("/settings")}
                outline
              >
                Edit Profile
              </Button>
            ) : isBlockedByMe || hasBlockedMe ? null : (
              <FollowUnfollowButton
                account={account}
                buttonClassName="min-w-36 justify-center"
              />
            )}
          </div>

          <div className="mt-5 w-full max-w-3xl">
            <Followerings account={account} />
          </div>

          {metaItems.length > 0 ||
          (!isBlockedByMe && !hasBlockedMe && creatorCoinAddress) ? (
            <div className="mt-5 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2.5 rounded-[1.5rem] border border-gray-200/80 bg-gray-50/75 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/70">
              {metaItems.map((item, index) => (
                <div
                  className="rounded-full border border-gray-200/80 bg-white/90 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950/80"
                  key={index}
                >
                  {item}
                </div>
              ))}
              {!isBlockedByMe && !hasBlockedMe ? (
                <CreatorCoin account={account} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {!isBlockedByMe &&
      !hasBlockedMe &&
      !isCurrentProfile &&
      supportsLegacyActions ? (
        <div className="mt-4 px-1">
          <FollowersYouKnowOverview
            address={account.address}
            username={accountInfo.username}
          />
        </div>
      ) : null}
    </div>
  );
};

export default Details;
