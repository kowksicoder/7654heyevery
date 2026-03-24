import { MotionConfig, motion } from "motion/react";
import { memo, type ReactNode } from "react";
import cn from "@/helpers/cn";

interface TabsProps {
  tabs: { name: string; type: string; suffix?: ReactNode }[];
  active: string;
  setActive: (type: string) => void;
  layoutId: string;
  className?: string;
  itemClassName?: string;
  desktopScrollable?: boolean;
  mobileScrollable?: boolean;
}

const Tabs = ({
  tabs,
  active,
  setActive,
  layoutId,
  className,
  itemClassName,
  desktopScrollable = false,
  mobileScrollable = false
}: TabsProps) => {
  return (
    <MotionConfig transition={{ bounce: 0, duration: 0.4, type: "spring" }}>
      <motion.ul
        className={cn(
          "mb-0 flex list-none gap-3",
          mobileScrollable || desktopScrollable
            ? cn(
                "no-scrollbar flex-nowrap overflow-x-auto pb-0.5",
                desktopScrollable
                  ? "md:flex-nowrap md:overflow-x-auto md:pb-0"
                  : "md:flex-wrap md:overflow-visible md:pb-0"
              )
            : "flex-wrap",
          className
        )}
        layout
      >
        {tabs.map((tab) => (
          <motion.li
            className={cn(
              "relative cursor-pointer px-3 py-1.5 text-sm outline-hidden transition-colors",
              (mobileScrollable || desktopScrollable) && "shrink-0",
              itemClassName
            )}
            key={tab.type}
            layout
            onClick={() => {
              umami.track(`switch_${layoutId}`, { tab: tab.type });
              setActive(tab.type);
            }}
            tabIndex={0}
          >
            {active === tab.type ? (
              <motion.div
                className="absolute inset-0 rounded-lg bg-gray-300 dark:bg-gray-300/20"
                layoutId={layoutId}
              />
            ) : null}
            <span className="relative flex items-center gap-2 text-inherit">
              {tab.name}
              {tab.suffix}
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </MotionConfig>
  );
};

export default memo(Tabs);
