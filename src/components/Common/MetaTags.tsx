import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router";
import { getAbsoluteUrl, getShareImageUrl } from "@/helpers/seo";

export interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  type?: "article" | "profile" | "website";
  url?: string;
}

const MetaTags = ({
  title = "Every1",
  description = "Every1 is a social network for the open web",
  image,
  type = "website",
  url
}: MetaTagsProps) => {
  const location = useLocation();
  const resolvedUrl = getAbsoluteUrl(
    url || `${location.pathname}${location.search}${location.hash}`
  );
  const resolvedImage = getShareImageUrl(image);
  const twitterCard = resolvedImage ? "summary_large_image" : "summary";

  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta content={description} name="description" />}
      <link href={resolvedUrl} rel="canonical" />
      <meta content="Every1" property="og:site_name" />
      <meta content={type} property="og:type" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={resolvedUrl} property="og:url" />
      <meta content={resolvedImage} property="og:image" />
      <meta content={twitterCard} name="twitter:card" />
      <meta content={title} name="twitter:title" />
      <meta content={description} name="twitter:description" />
      <meta content={resolvedImage} name="twitter:image" />
    </Helmet>
  );
};

export default MetaTags;
