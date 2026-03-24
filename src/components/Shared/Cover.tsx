import { BRAND_COLOR, STATIC_IMAGES_URL, TRANSFORMS } from "@/data/constants";
import imageKit from "@/helpers//imageKit";
import sanitizeDStorageUrl from "@/helpers//sanitizeDStorageUrl";
import cn from "@/helpers/cn";

interface CoverProps {
  className?: string;
  cover: string;
}

const Cover = ({ className, cover }: CoverProps) => {
  const isDefaultCover = cover.includes(STATIC_IMAGES_URL);
  const backgroundImage = isDefaultCover
    ? `${STATIC_IMAGES_URL}/patterns/2.svg`
    : imageKit(sanitizeDStorageUrl(cover), TRANSFORMS.COVER);

  const backgroundStyles = {
    backgroundColor: BRAND_COLOR,
    backgroundImage: `url(${backgroundImage})`,
    backgroundPosition: "center center",
    backgroundRepeat: isDefaultCover ? "repeat" : "no-repeat",
    backgroundSize: isDefaultCover ? "30%" : "cover"
  };

  return (
    <div className="mx-auto">
      <div
        className={cn("h-52 sm:h-64 md:rounded-xl", className)}
        style={backgroundStyles}
      />
    </div>
  );
};

export default Cover;
