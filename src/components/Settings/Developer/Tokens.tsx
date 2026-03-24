import { CheckCircleIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { usePrivy } from "@privy-io/react-auth";
import BackButton from "@/components/Shared/BackButton";
import { Button, Card, CardHeader, H6 } from "@/components/Shared/UI";
import formatAddress from "@/helpers/formatAddress";
import { getPrivyDisplayName, getPrivyWalletAddress } from "@/helpers/privy";
import useCopyToClipboard from "@/hooks/useCopyToClipboard";

const Tokens = () => {
  const { authenticated, ready, user } = usePrivy();
  const displayName = getPrivyDisplayName(user) || "Every1 user";
  const walletAddress = getPrivyWalletAddress(user);
  const emailAddress = user?.email?.address || null;
  const copyWallet = useCopyToClipboard(walletAddress ?? "", "Wallet copied");
  const copyEmail = useCopyToClipboard(emailAddress ?? "", "Email copied");
  const copyUserId = useCopyToClipboard(user?.id ?? "", "User ID copied");

  return (
    <Card>
      <CardHeader icon={<BackButton path="/settings" />} title="Developer" />
      <div className="space-y-5 p-5">
        <div className="space-y-2">
          <p className="font-semibold text-gray-900 text-sm dark:text-gray-100">
            Lens developer tokens are no longer used in the active auth flow.
          </p>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            Every1 now authenticates through Privy. This screen shows the live
            Privy session details instead.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-gray-500 text-xs dark:text-gray-400">
              Session
            </div>
            <div className="mt-1 flex items-center gap-2 font-medium text-gray-900 text-sm dark:text-gray-100">
              <CheckCircleIcon className="size-4 text-green-600 dark:text-green-400" />
              {ready ? (authenticated ? "Active" : "Signed out") : "Loading"}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-gray-500 text-xs dark:text-gray-400">
              Profile
            </div>
            <div className="mt-1 font-medium text-gray-900 text-sm dark:text-gray-100">
              {displayName}
            </div>
          </div>
        </div>

        {walletAddress ? (
          <button
            className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 p-3 text-left dark:border-gray-800 dark:bg-gray-900"
            onClick={copyWallet}
            type="button"
          >
            <div className="text-gray-500 text-xs dark:text-gray-400">
              Wallet
            </div>
            <H6>{formatAddress(walletAddress, 6)}</H6>
          </button>
        ) : null}

        {emailAddress ? (
          <button
            className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left dark:border-gray-800 dark:bg-gray-900"
            onClick={copyEmail}
            type="button"
          >
            <EnvelopeIcon className="mt-0.5 size-4 shrink-0 text-gray-500 dark:text-gray-400" />
            <div className="min-w-0">
              <div className="text-gray-500 text-xs dark:text-gray-400">
                Email
              </div>
              <H6 className="truncate">{emailAddress}</H6>
            </div>
          </button>
        ) : null}

        {user?.id ? (
          <div className="space-y-2">
            <div className="text-gray-500 text-xs dark:text-gray-400">
              Privy user ID
            </div>
            <button
              className="w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 p-3 text-left dark:border-gray-800 dark:bg-gray-900"
              onClick={copyUserId}
              type="button"
            >
              <H6>{user.id}</H6>
            </button>
          </div>
        ) : null}

        <Button
          className="w-full"
          disabled={!walletAddress}
          onClick={copyWallet}
        >
          Copy active wallet
        </Button>
      </div>
    </Card>
  );
};

export default Tokens;
