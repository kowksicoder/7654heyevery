import { usePrivy } from "@privy-io/react-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { isAddress } from "viem";
import { useWalletClient } from "wagmi";
import Loader from "@/components/Shared/Loader";
import { ErrorMessage, Modal } from "@/components/Shared/UI";
import {
  getFiatWallet,
  getFiatWalletTransactions,
  initiateFiatDeposit,
  withdrawFiat
} from "@/helpers/fiat";
import { getPrivyDisplayName } from "@/helpers/privy";
import { useAccountStore } from "@/store/persisted/useAccountStore";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

const formatNaira = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(Math.max(0, value || 0));

const formatRelativeDate = (value?: null | string) => {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(date);
};

const FiatWalletPanel = () => {
  const { user } = usePrivy();
  const { profile } = useEvery1Store();
  const { currentAccount } = useAccountStore();
  const { data: walletClient } = useWalletClient();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [depositAmount, setDepositAmount] = useState("1000");
  const [depositEmail, setDepositEmail] = useState(user?.email?.address || "");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedBankId, setSelectedBankId] = useState<null | string>(null);
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const walletAddress = useMemo(() => {
    const candidate =
      walletClient?.account?.address ||
      currentAccount?.owner ||
      currentAccount?.address ||
      profile?.walletAddress ||
      null;

    return candidate && isAddress(candidate) ? candidate : null;
  }, [
    currentAccount?.address,
    currentAccount?.owner,
    profile?.walletAddress,
    walletClient?.account?.address
  ]);
  const authReady = Boolean(
    profile?.id && walletAddress && walletClient?.account?.address
  );
  const getAuthenticatedRequestContext = () => {
    if (!profile?.id || !walletAddress || !walletClient) {
      throw new Error("Fiat wallet authentication is not ready yet.");
    }

    return {
      profileId: profile.id,
      walletAddress: walletAddress as `0x${string}`,
      walletClient
    };
  };

  const walletQuery = useQuery({
    enabled: authReady,
    queryFn: async () =>
      await getFiatWallet({
        ...getAuthenticatedRequestContext()
      }),
    queryKey: ["fiat-wallet", profile?.id || null, walletAddress]
  });

  const transactionsQuery = useQuery({
    enabled: authReady && showHistory,
    queryFn: async () =>
      await getFiatWalletTransactions({
        limit: 8,
        ...getAuthenticatedRequestContext()
      }),
    queryKey: ["fiat-wallet-transactions", profile?.id || null, walletAddress]
  });

  const depositMutation = useMutation({
    mutationFn: async () =>
      await initiateFiatDeposit({
        amountNaira: Number(depositAmount),
        email: depositEmail.trim(),
        name:
          getPrivyDisplayName(user) || profile?.displayName || "Every1 user",
        ...getAuthenticatedRequestContext()
      }),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to start this deposit right now."
      );
    },
    onSuccess: (response) => {
      toast.success(response.message);
      setShowDepositModal(false);
      void walletQuery.refetch();

      if (response.transaction.checkoutUrl) {
        window.open(
          response.transaction.checkoutUrl,
          "_blank",
          "noopener,noreferrer"
        );
      }
    }
  });

  const withdrawMutation = useMutation({
    mutationFn: async () =>
      await withdrawFiat({
        accountName: selectedBankId
          ? undefined
          : accountName.trim() || undefined,
        accountNumber: selectedBankId ? undefined : accountNumber.trim(),
        amountNaira: Number(withdrawAmount),
        bankAccountId: selectedBankId || undefined,
        bankCode: selectedBankId ? undefined : bankCode.trim(),
        bankName: selectedBankId ? undefined : bankName.trim(),
        makeDefault: true,
        ...getAuthenticatedRequestContext()
      }),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to process this withdrawal right now."
      );
    },
    onSuccess: (response) => {
      toast.success(response.message);
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      void walletQuery.refetch();

      if (showHistory) {
        void transactionsQuery.refetch();
      }
    }
  });

  const banks = walletQuery.data?.banks || [];
  const openDepositModal = () => {
    setDepositEmail(
      (currentValue) => currentValue || user?.email?.address || ""
    );
    setShowDepositModal(true);
  };
  const openWithdrawModal = () => {
    const defaultBankId =
      banks.find((bank) => bank.isDefault)?.id || banks[0]?.id || null;

    setSelectedBankId(defaultBankId);
    setShowWithdrawModal(true);
  };

  const submitDeposit = () => {
    if (!Number.isFinite(Number(depositAmount)) || Number(depositAmount) <= 0) {
      toast.error("Enter a valid deposit amount.");
      return;
    }

    if (!depositEmail.trim()) {
      toast.error("Add an email for this deposit.");
      return;
    }

    depositMutation.mutate();
  };

  const submitWithdraw = () => {
    if (
      !Number.isFinite(Number(withdrawAmount)) ||
      Number(withdrawAmount) <= 0
    ) {
      toast.error("Enter a valid withdrawal amount.");
      return;
    }

    if (
      !selectedBankId &&
      (!bankCode.trim() || !bankName.trim() || !accountNumber.trim())
    ) {
      toast.error("Add the bank details for this withdrawal.");
      return;
    }

    withdrawMutation.mutate();
  };

  return (
    <>
      <section className="mb-4 overflow-hidden rounded-[1.6rem] border border-gray-200/70 bg-white text-gray-900 dark:border-white/10 dark:bg-[#111111] dark:text-white">
        <div className="px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-lg md:text-xl">
                Every1 Naira Wallet
              </p>
              <p className="mt-1 text-gray-500 text-xs md:text-sm dark:text-gray-400">
                Trade creator coins, settle payouts, and withdraw to bank
                without leaving the app flow.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-full bg-gray-100 px-3 py-2 font-semibold text-[11px] text-gray-900 transition hover:bg-gray-200 dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
                onClick={openDepositModal}
                type="button"
              >
                Deposit
              </button>
              <button
                className="rounded-full bg-gray-950 px-3 py-2 font-semibold text-[11px] text-white transition hover:bg-gray-800 dark:bg-white dark:text-[#111111] dark:hover:bg-white/90"
                onClick={openWithdrawModal}
                type="button"
              >
                Withdraw
              </button>
            </div>
          </div>

          {authReady ? (
            walletQuery.isLoading ? (
              <Loader className="my-8" />
            ) : walletQuery.error ? (
              <ErrorMessage
                className="mt-4"
                error={walletQuery.error as { message?: string }}
                title="Failed to load Naira wallet"
              />
            ) : walletQuery.data?.wallet ? (
              <>
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {[
                    {
                      label: "Available",
                      value: formatNaira(
                        walletQuery.data.wallet.availableBalance
                      )
                    },
                    {
                      label: "Pending",
                      value: formatNaira(walletQuery.data.wallet.pendingBalance)
                    },
                    {
                      label: "Locked",
                      value: formatNaira(walletQuery.data.wallet.lockedBalance)
                    }
                  ].map((item) => (
                    <div
                      className="rounded-[1.15rem] bg-gray-50 px-3.5 py-3 dark:bg-[#181a20]"
                      key={item.label}
                    >
                      <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em] dark:text-gray-500">
                        {item.label}
                      </p>
                      <p className="mt-2 font-semibold text-xl">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-[1.2rem] bg-gray-50 px-3.5 py-3 dark:bg-[#181a20]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm md:text-base">
                        Recent Naira activity
                      </p>
                      <p className="mt-1 text-gray-500 text-xs dark:text-gray-400">
                        Deposits, buys, sells, and bank withdrawals.
                      </p>
                    </div>
                    <button
                      className="rounded-full bg-white px-3 py-1.5 font-semibold text-[11px] text-gray-900 transition hover:bg-gray-100 dark:bg-white/10 dark:text-white dark:hover:bg-white/14"
                      onClick={() => {
                        setShowHistory(true);
                        void transactionsQuery.refetch();
                      }}
                      type="button"
                    >
                      {showHistory ? "Refresh" : "Load"}
                    </button>
                  </div>

                  {showHistory ? (
                    transactionsQuery.isLoading ? (
                      <Loader className="my-6" />
                    ) : transactionsQuery.error ? (
                      <ErrorMessage
                        className="mt-3"
                        error={transactionsQuery.error as { message?: string }}
                        title="Failed to load Naira activity"
                      />
                    ) : transactionsQuery.data?.transactions?.length ? (
                      <div className="mt-3 space-y-2">
                        {transactionsQuery.data.transactions.map(
                          (transaction) => (
                            <div
                              className="flex items-center justify-between gap-3 rounded-[1rem] bg-white px-3 py-2.5 dark:bg-[#111111]"
                              key={transaction.id}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-sm">
                                  {transaction.title}
                                </p>
                                <p className="truncate text-gray-500 text-xs dark:text-gray-400">
                                  {transaction.subtitle || transaction.type}
                                </p>
                                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500">
                                  {[
                                    transaction.status,
                                    formatRelativeDate(transaction.createdAt)
                                  ]
                                    .filter(Boolean)
                                    .join(" - ")}
                                </p>
                              </div>
                              <p className="shrink-0 font-semibold text-sm">
                                {transaction.direction === "credit" ? "+" : "-"}
                                {formatNaira(transaction.netAmountNaira)}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-gray-500 text-sm dark:text-gray-400">
                        No Naira activity yet.
                      </p>
                    )
                  ) : (
                    <p className="mt-3 text-gray-500 text-sm dark:text-gray-400">
                      Load your recent activity when you need it.
                    </p>
                  )}
                </div>
              </>
            ) : null
          ) : (
            <div className="mt-4 rounded-[1.2rem] border border-gray-200 border-dashed px-4 py-4 text-gray-500 text-sm dark:border-white/10 dark:text-gray-400">
              Connect the wallet linked to your Every1 profile to load the Naira
              wallet.
            </div>
          )}
        </div>
      </section>

      <Modal
        onClose={() => setShowDepositModal(false)}
        show={showDepositModal}
        size="xs"
        title="Add funds"
      >
        <div className="space-y-3 bg-white p-4 text-gray-900 dark:bg-[#111111] dark:text-white">
          <label className="block">
            <span className="text-gray-500 text-xs dark:text-gray-400">
              Amount
            </span>
            <input
              className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none transition focus:border-gray-300 dark:border-white/10 dark:bg-[#181a20] dark:focus:border-white/20"
              inputMode="decimal"
              onChange={(event) => setDepositAmount(event.target.value)}
              value={depositAmount}
            />
          </label>
          <label className="block">
            <span className="text-gray-500 text-xs dark:text-gray-400">
              Email
            </span>
            <input
              className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none transition focus:border-gray-300 dark:border-white/10 dark:bg-[#181a20] dark:focus:border-white/20"
              onChange={(event) => setDepositEmail(event.target.value)}
              type="email"
              value={depositEmail}
            />
          </label>
          <button
            className="w-full rounded-2xl bg-gray-950 px-4 py-3 font-semibold text-sm text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-[#111111] dark:hover:bg-white/90"
            disabled={depositMutation.isPending}
            onClick={submitDeposit}
            type="button"
          >
            {depositMutation.isPending ? "Starting deposit..." : "Continue"}
          </button>
        </div>
      </Modal>

      <Modal
        onClose={() => setShowWithdrawModal(false)}
        show={showWithdrawModal}
        size="sm"
        title="Withdraw to bank"
      >
        <div className="space-y-3 bg-white p-4 text-gray-900 dark:bg-[#111111] dark:text-white">
          <label className="block">
            <span className="text-gray-500 text-xs dark:text-gray-400">
              Amount
            </span>
            <input
              className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none transition focus:border-gray-300 dark:border-white/10 dark:bg-[#181a20] dark:focus:border-white/20"
              inputMode="decimal"
              onChange={(event) => setWithdrawAmount(event.target.value)}
              placeholder="5000"
              value={withdrawAmount}
            />
          </label>

          {banks.length ? (
            <div>
              <p className="text-gray-500 text-xs dark:text-gray-400">
                Saved banks
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {banks.map((bank) => (
                  <button
                    className={`rounded-full px-3 py-2 font-semibold text-[11px] transition ${
                      selectedBankId === bank.id
                        ? "bg-gray-950 text-white dark:bg-white dark:text-[#111111]"
                        : "bg-gray-100 text-gray-900 dark:bg-white/8 dark:text-white"
                    }`}
                    key={bank.id}
                    onClick={() => setSelectedBankId(bank.id)}
                    type="button"
                  >
                    {bank.bankName} ****{bank.accountNumber.slice(-4)}
                  </button>
                ))}
                <button
                  className="rounded-full bg-gray-100 px-3 py-2 font-semibold text-[11px] text-gray-900 transition dark:bg-white/8 dark:text-white"
                  onClick={() => setSelectedBankId(null)}
                  type="button"
                >
                  Add new
                </button>
              </div>
            </div>
          ) : null}

          {selectedBankId ? null : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-gray-500 text-xs dark:text-gray-400">
                  Bank name
                </span>
                <input
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none transition focus:border-gray-300 dark:border-white/10 dark:bg-[#181a20] dark:focus:border-white/20"
                  onChange={(event) => setBankName(event.target.value)}
                  value={bankName}
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs dark:text-gray-400">
                  Bank code
                </span>
                <input
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none transition focus:border-gray-300 dark:border-white/10 dark:bg-[#181a20] dark:focus:border-white/20"
                  onChange={(event) => setBankCode(event.target.value)}
                  value={bankCode}
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs dark:text-gray-400">
                  Account number
                </span>
                <input
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none transition focus:border-gray-300 dark:border-white/10 dark:bg-[#181a20] dark:focus:border-white/20"
                  onChange={(event) => setAccountNumber(event.target.value)}
                  value={accountNumber}
                />
              </label>
              <label className="block">
                <span className="text-gray-500 text-xs dark:text-gray-400">
                  Account name
                </span>
                <input
                  className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none transition focus:border-gray-300 dark:border-white/10 dark:bg-[#181a20] dark:focus:border-white/20"
                  onChange={(event) => setAccountName(event.target.value)}
                  value={accountName}
                />
              </label>
            </div>
          )}

          <button
            className="w-full rounded-2xl bg-gray-950 px-4 py-3 font-semibold text-sm text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-[#111111] dark:hover:bg-white/90"
            disabled={withdrawMutation.isPending}
            onClick={submitWithdraw}
            type="button"
          >
            {withdrawMutation.isPending ? "Submitting..." : "Withdraw"}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default FiatWalletPanel;
