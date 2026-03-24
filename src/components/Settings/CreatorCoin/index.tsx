import BackButton from "@/components/Shared/BackButton";
import NotLoggedIn from "@/components/Shared/NotLoggedIn";
import PageLayout from "@/components/Shared/PageLayout";
import { Card, CardHeader } from "@/components/Shared/UI";
import { useAccountStore } from "@/store/persisted/useAccountStore";

const CreatorCoinSettings = () => {
  const { currentAccount } = useAccountStore();

  if (!currentAccount) {
    return <NotLoggedIn />;
  }

  return (
    <PageLayout title="Creator Coin settings">
      <Card>
        <CardHeader
          icon={<BackButton path="/settings" />}
          title="Creator Coin"
        />
        <div className="space-y-3 p-5">
          <p className="font-medium text-gray-900 text-sm dark:text-gray-100">
            Creator coin settings are being rebuilt for the Privy migration.
          </p>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            The old Lens metadata controls are temporarily disabled while we
            move creator settings to Every1 + Privy.
          </p>
        </div>
      </Card>
    </PageLayout>
  );
};

export default CreatorCoinSettings;
