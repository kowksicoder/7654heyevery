import { memo } from "react";
import { Button, Card, Image } from "@/components/Shared/UI";
import { STATIC_IMAGES_URL } from "@/data/constants";
import useOpenAuth from "@/hooks/useOpenAuth";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import WhoToFollow from "./WhoToFollow";

const SignupBanner = () => {
  const openAuth = useOpenAuth();

  const handleSignupClick = () => {
    void openAuth("open_signup");
  };

  return (
    <Card
      className="relative overflow-hidden border-transparent bg-gradient-to-br from-orange-50 via-white to-pink-50 p-3.5 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950"
      forceRounded
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-8 -right-6 size-20 rounded-full bg-orange-200/55 blur-2xl dark:bg-orange-500/12" />
        <div className="absolute -bottom-8 -left-4 size-16 rounded-full bg-pink-200/45 blur-2xl dark:bg-pink-500/12" />
      </div>

      <div className="relative space-y-3">
        <div className="flex items-center gap-3">
          <Image
            alt="Dizzy emoji"
            className="size-10 shrink-0"
            height={40}
            src={`${STATIC_IMAGES_URL}/emojis/dizzy.png`}
            width={40}
          />
          <div className="min-w-0">
            <p className="font-semibold text-gray-950 text-sm dark:text-gray-50">
              Get your Every1 account now!
            </p>
          </div>
        </div>
        <Button className="w-full" onClick={handleSignupClick} size="sm">
          Signup now
        </Button>
      </div>
    </Card>
  );
};

const Sidebar = () => {
  const { currentAccount } = useAccountStore();
  const loggedInWithAccount = Boolean(currentAccount);
  const loggedOut = !loggedInWithAccount;

  return (
    <>
      {loggedOut && <SignupBanner />}
      {loggedInWithAccount && <WhoToFollow />}
    </>
  );
};

export default memo(Sidebar);
