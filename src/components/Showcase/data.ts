import {
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  SparklesIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import type { ShowcasePostRecord } from "@/types/staff";

export type ShowcaseIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const showcaseIconMap: Record<string, ShowcaseIconComponent> = {
  "device-phone-mobile": DevicePhoneMobileIcon,
  document: DocumentTextIcon,
  sparkles: SparklesIcon,
  "user-group": UserGroupIcon
};

export const getShowcaseIcon = (iconKey?: null | string) =>
  showcaseIconMap[iconKey || ""] || DocumentTextIcon;

export const showcaseFallbackPosts: ShowcasePostRecord[] = [
  {
    category: "Product",
    content: [
      "Every1's latest mobile pass is focused on speed, tighter layouts, and creator-first actions that feel natural on small screens.",
      "Across the feed, we cleaned up card density, improved grid browsing, and made discovery feel more alive with story rails, badge counts, and stronger signals for new listings.",
      "The mobile create flow is also becoming much more direct. Instead of dragging users through long setup steps, we are moving toward faster inputs, clearer preview states, and a cleaner path from idea to coin launch."
    ],
    coverClassName:
      "bg-[radial-gradient(circle_at_18%_24%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_36%,#059669_100%)]",
    coverImageUrl: null,
    description:
      "A quick look at the latest feed, mobile create flow, and creator-first UI updates shipping across Every1.",
    iconKey: "device-phone-mobile",
    id: "fallback-mobile-experience",
    pillClassName:
      "bg-white/12 text-white ring-1 ring-white/20 backdrop-blur dark:bg-white/12",
    publishedAt: "2026-03-20",
    readTime: "4 min read",
    slug: "inside-the-new-every1-mobile-experience",
    sortOrder: 10,
    title: "Inside the new Every1 mobile experience"
  },
  {
    category: "Creators",
    content: [
      "A strong creator experience needs more than a profile page. It needs distribution, identity, monetization loops, and a clear reason for fans to come back.",
      "On Every1, creator coins, curated discovery, and showcase storytelling are meant to support one another. A creator should be discoverable in the feed, visible in ranking surfaces, and legible through their coin, posts, and public presence.",
      "This is the direction we are pushing: fewer disconnected surfaces, better signals for quality, and a cleaner path from being noticed to being supported."
    ],
    coverClassName:
      "bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.26),transparent_24%),linear-gradient(140deg,#172554_0%,#1d4ed8_48%,#60a5fa_100%)]",
    coverImageUrl: null,
    description:
      "How creator coins, discovery rails, and showcase storytelling can work together across the platform.",
    iconKey: "sparkles",
    id: "fallback-creators",
    pillClassName:
      "bg-white/14 text-white ring-1 ring-white/20 backdrop-blur dark:bg-white/14",
    publishedAt: "2026-03-14",
    readTime: "3 min read",
    slug: "designing-a-better-home-for-creators",
    sortOrder: 20,
    title: "Designing a better home for creators"
  },
  {
    category: "Community",
    content: [
      "The next layer for Every1 is not just content. It is community behavior: referrals, missions, streaks, onboarding loops, and stronger reasons for users to keep showing up.",
      "We want the community layer to feel rewarding without becoming noisy. That means better routing for rewards, clearer surfaces for streaks and referrals, and tighter UX patterns that do not overload the core product.",
      "As the system grows, these loops should feel connected. Community should support creators, creators should support discovery, and rewards should reinforce the healthiest actions on the platform."
    ],
    coverClassName:
      "bg-[radial-gradient(circle_at_16%_76%,rgba(255,255,255,0.22),transparent_26%),linear-gradient(135deg,#3f2d20_0%,#a16207_42%,#f59e0b_100%)]",
    coverImageUrl: null,
    description:
      "A preview of the community loops we want to bring in next, from missions to streaks to better onboarding.",
    iconKey: "user-group",
    id: "fallback-community",
    pillClassName:
      "bg-white/16 text-white ring-1 ring-white/25 backdrop-blur dark:bg-white/16",
    publishedAt: "2026-03-07",
    readTime: "5 min read",
    slug: "whats-next-for-the-every1-community-layer",
    sortOrder: 30,
    title: "What's next for the Every1 community layer"
  }
];
