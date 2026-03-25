import { HomeFeedType } from "@/data/enums";

export const CREATOR_CREATE_CATEGORY_OPTIONS = [
  "Music",
  "Movies",
  "Art",
  "Sports",
  "Lifestyle",
  "Pop-Culture",
  "Podcasts",
  "Photography",
  "Food",
  "Writers",
  "Comedians"
] as const;

export const COMMUNITY_LAUNCH_CATEGORY = "Communities";
export const COLLABORATION_LAUNCH_CATEGORY = "Collaboration";

export const PLATFORM_LAUNCH_CATEGORY_OPTIONS = [
  ...CREATOR_CREATE_CATEGORY_OPTIONS,
  COMMUNITY_LAUNCH_CATEGORY,
  COLLABORATION_LAUNCH_CATEGORY
] as const;

export type PlatformLaunchCategory =
  (typeof PLATFORM_LAUNCH_CATEGORY_OPTIONS)[number];

const normalizedCategoryEntries = PLATFORM_LAUNCH_CATEGORY_OPTIONS.map(
  (category) => [category.toLowerCase(), category] as const
);

const normalizedCategoryMap = new Map<string, PlatformLaunchCategory>(
  normalizedCategoryEntries
);

export const normalizePlatformLaunchCategory = (
  value?: null | string
): null | PlatformLaunchCategory => {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  return normalizedCategoryMap.get(normalizedValue) || null;
};

export const getPlatformLaunchCategoryForFeedType = (
  feedType: HomeFeedType
): null | PlatformLaunchCategory => {
  switch (feedType) {
    case HomeFeedType.FOLLOWING:
      return "Music";
    case HomeFeedType.HIGHLIGHTS:
      return "Movies";
    case HomeFeedType.FORYOU:
      return "Art";
    case HomeFeedType.SPORTS:
      return "Sports";
    case HomeFeedType.LIFESTYLE:
      return "Lifestyle";
    case HomeFeedType.POP_CULTURE:
      return "Pop-Culture";
    case HomeFeedType.PODCASTS:
      return "Podcasts";
    case HomeFeedType.PHOTOGRAPHY:
      return "Photography";
    case HomeFeedType.FOOD:
      return "Food";
    case HomeFeedType.WRITERS:
      return "Writers";
    case HomeFeedType.COMMUNITIES:
      return COMMUNITY_LAUNCH_CATEGORY;
    case HomeFeedType.COLLABORATIONS:
      return COLLABORATION_LAUNCH_CATEGORY;
    case HomeFeedType.COMEDIANS:
      return "Comedians";
    default:
      return null;
  }
};
