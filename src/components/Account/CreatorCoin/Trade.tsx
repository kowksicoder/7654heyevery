import {
  BackspaceIcon,
  ChevronDownIcon,
  Cog6ToothIcon
} from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import type { GetCoinResponse } from "@zoralabs/coins-sdk";
import {
  createTradeCall,
  type TradeParameters,
  tradeCoin
} from "@zoralabs/coins-sdk";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Address } from "viem";
import {
  createPublicClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  parseEther,
  parseUnits
} from "viem";
import { base } from "viem/chains";
import { useAccount, useConfig, useWalletClient } from "wagmi";
import { getWalletClient } from "wagmi/actions";
import {
  Button,
  Image,
  Input,
  Spinner,
  Tabs,
  Tooltip
} from "@/components/Shared/UI";
import { BASE_RPC_URL } from "@/data/constants";
import {
  EVERY1_NOTIFICATION_COUNT_QUERY_KEY,
  EVERY1_NOTIFICATIONS_QUERY_KEY,
  EVERY1_REFERRAL_DASHBOARD_QUERY_KEY,
  recordReferralTradeReward
} from "@/helpers/every1";
import useHandleWrongNetwork from "@/hooks/useHandleWrongNetwork";
import { useEvery1Store } from "@/store/persisted/useEvery1Store";

interface TradeModalProps {
  coin: NonNullable<GetCoinResponse["zora20Token"]>;
  initialMode?: Mode;
  onClose?: () => void;
  variant?: "mobile" | "modal" | "page";
}

type Mode = "buy" | "sell";

const Trade = ({
  coin,
  initialMode = "buy",
  onClose,
  variant = "modal"
}: TradeModalProps) => {
  const { address } = useAccount();
  const config = useConfig();
  const queryClient = useQueryClient();
  const { profile } = useEvery1Store();
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL, { batch: { batchSize: 30 } })
      }),
    []
  );
  const handleWrongNetwork = useHandleWrongNetwork();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [ethBalance, setEthBalance] = useState<bigint>(0n);
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);
  const [estimatedOut, setEstimatedOut] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!address) return;
      try {
        const [eth, token] = await Promise.all([
          publicClient.getBalance({ address }),
          publicClient.readContract({
            abi: erc20Abi,
            address: coin.address as Address,
            args: [address],
            functionName: "balanceOf"
          })
        ]);
        setEthBalance(eth);
        setTokenBalance(token as bigint);
      } catch {}
    })();
  }, [address, coin.address, publicClient]);

  const tokenDecimals = 18;
  const isPageVariant = variant === "page";
  const isMobileVariant = variant === "mobile";

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const setPercentAmount = (pct: number) => {
    const decimals = 6;
    if (mode === "buy") {
      const available = Number(formatEther(ethBalance));
      const gasReserve = 0.0002;
      const baseAmt = (available * pct) / 100;
      const amt = pct === 100 ? Math.max(baseAmt - gasReserve, 0) : baseAmt;
      setAmount(amt.toFixed(decimals));
    } else {
      const available = Number(formatUnits(tokenBalance, tokenDecimals));
      const amt = Math.max((available * pct) / 100, 0);
      setAmount(amt.toFixed(decimals));
    }
  };

  const makeParams = (address: Address): TradeParameters | null => {
    if (!amount || Number(amount) <= 0) return null;

    if (mode === "buy") {
      return {
        amountIn: parseEther(amount),
        buy: { address: coin.address as Address, type: "erc20" },
        sell: { type: "eth" },
        sender: address,
        slippage: 0.1
      };
    }

    return {
      amountIn: parseUnits(amount, tokenDecimals),
      buy: { type: "eth" },
      sell: { address: coin.address as Address, type: "erc20" },
      sender: address,
      slippage: 0.1
    };
  };

  const handleSubmit = async () => {
    if (!address) {
      return toast.error("Connect a wallet to trade");
    }

    const params = makeParams(address);
    if (!params) return;

    try {
      setLoading(true);
      umami.track("trade_creator_coin", { mode });
      await handleWrongNetwork({ chainId: base.id });
      const client =
        (await getWalletClient(config, { chainId: base.id })) || walletClient;
      if (!client) {
        setLoading(false);
        return toast.error("Please switch to Base network");
      }

      const receipt = await tradeCoin({
        account: client.account,
        publicClient,
        tradeParameters: params,
        validateTransaction: false,
        walletClient: client
      });

      toast.success("Trade completed");

      if (profile?.id) {
        try {
          const quotedAmountOut = estimatedOut
            ? mode === "buy"
              ? Number(formatUnits(BigInt(estimatedOut), tokenDecimals))
              : Number(formatEther(BigInt(estimatedOut)))
            : 0;

          const rewardResult = await recordReferralTradeReward({
            chainId: base.id,
            coinAddress: coin.address,
            coinSymbol: coin.symbol || coin.name || "COIN",
            profileId: profile.id,
            tradeAmountIn: Number(amount),
            tradeAmountOut: quotedAmountOut,
            tradeSide: mode,
            txHash: receipt.transactionHash
          });

          if (rewardResult.rewardGranted) {
            toast.success("Referral reward unlocked", {
              description: `+${Number(rewardResult.rewardAmount || 0).toFixed(
                4
              )} ${rewardResult.rewardSymbol} and +${
                rewardResult.e1xpAwarded || 50
              } E1XP`
            });

            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: [EVERY1_REFERRAL_DASHBOARD_QUERY_KEY, profile.id]
              }),
              queryClient.invalidateQueries({
                queryKey: [EVERY1_NOTIFICATIONS_QUERY_KEY, profile.id]
              }),
              queryClient.invalidateQueries({
                queryKey: [EVERY1_NOTIFICATION_COUNT_QUERY_KEY, profile.id]
              })
            ]);
          }
        } catch (rewardError) {
          console.error("Failed to record referral reward", rewardError);
        }
      }

      onClose?.();
    } catch {
      toast.error("Trade failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      const sender = (address as Address) || undefined;
      if (!sender || !amount) {
        setEstimatedOut("");
        return;
      }

      const params: TradeParameters =
        mode === "buy"
          ? {
              amountIn: parseEther(amount),
              buy: { address: coin.address as Address, type: "erc20" },
              sell: { type: "eth" },
              sender,
              slippage: 0.1
            }
          : {
              amountIn: parseUnits(amount, tokenDecimals),
              buy: { type: "eth" },
              sell: { address: coin.address as Address, type: "erc20" },
              sender,
              slippage: 0.1
            };

      try {
        const q = await createTradeCall(params);
        if (!cancelled) {
          const out = q.quote.amountOut || "0";
          setEstimatedOut(out);
        }
      } catch {
        if (!cancelled) setEstimatedOut("");
      }
    };

    timeoutId = setTimeout(() => {
      void run();
    }, 300);

    intervalId = setInterval(() => {
      void run();
    }, 8000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [address, amount, coin.address, mode]);

  const symbol = coin.symbol || "";
  const formattedEthBalance = Number(formatEther(ethBalance));
  const formattedTokenBalance = Number(
    formatUnits(tokenBalance, tokenDecimals)
  );

  const balanceLabel =
    mode === "buy"
      ? `Balance ${formattedEthBalance.toFixed(4)} ETH`
      : `Balance ${formattedTokenBalance.toFixed(3)} ${symbol || "TOKEN"}`;

  const quickTradeOptions =
    mode === "buy"
      ? [
          { label: "0.001 ETH", onClick: () => setAmount("0.001") },
          { label: "0.01 ETH", onClick: () => setAmount("0.01") },
          { label: "0.1 ETH", onClick: () => setAmount("0.1") },
          { label: "Max", onClick: () => setPercentAmount(100) }
        ]
      : [
          { label: "25%", onClick: () => setPercentAmount(25) },
          { label: "50%", onClick: () => setPercentAmount(50) },
          { label: "75%", onClick: () => setPercentAmount(75) },
          { label: "Max", onClick: () => setPercentAmount(100) }
        ];

  const mobileQuickTradeOptions = [
    { label: "10%", onClick: () => setPercentAmount(10) },
    { label: "25%", onClick: () => setPercentAmount(25) },
    { label: "50%", onClick: () => setPercentAmount(50) },
    { label: "Max", onClick: () => setPercentAmount(100) }
  ];

  const handleMobileKeypadInput = (key: "." | "backspace" | `${number}`) => {
    if (key === "backspace") {
      setAmount((previous) => previous.slice(0, -1));
      return;
    }

    if (key === ".") {
      setAmount((previous) => {
        if (previous.includes(".")) {
          return previous;
        }

        return previous ? `${previous}.` : "0.";
      });
      return;
    }

    setAmount((previous) => {
      if (previous === "0") {
        return key;
      }

      return `${previous}${key}`;
    });
  };

  if (isMobileVariant) {
    const displayAmount = amount || "0";
    const mobileBalanceLabel =
      mode === "buy"
        ? `${formattedEthBalance.toFixed(formattedEthBalance >= 1 ? 3 : 4)} ETH available`
        : `${formattedTokenBalance.toFixed(formattedTokenBalance >= 1 ? 2 : 4)} ${
            symbol || "TOKEN"
          } available`;
    const mobilePadKeys: Array<"." | "backspace" | `${number}`> = [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      ".",
      "0",
      "backspace"
    ];

    return (
      <div className="flex h-full flex-col bg-white text-gray-950 dark:bg-[#111111] dark:text-white">
        <div className="flex items-center justify-between px-3.5 pt-2 pb-1">
          <div className="w-9" />
          <p className="font-semibold text-lg capitalize">{mode}</p>
          <button
            className="inline-flex size-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
            type="button"
          >
            <Cog6ToothIcon className="size-4" />
          </button>
        </div>

        <div className="px-3.5 pt-1 pb-2">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Image
                alt={coin.name}
                className="size-9 rounded-full object-cover"
                height={36}
                src={
                  coin.mediaContent?.previewImage?.medium ||
                  coin.mediaContent?.previewImage?.small
                }
                width={36}
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-[1.15rem] text-gray-950 dark:text-white">
                  {coin.name}
                </p>
                <p className="truncate text-[10px] text-gray-500 dark:text-white/55">
                  {symbol || "COIN"} ·{" "}
                  {mode === "buy" ? "Buy with ETH" : "Sell from your wallet"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-[1.15rem] text-gray-950 dark:text-white">
                {Number.parseFloat(coin.marketCap ?? "0") > 0 &&
                Number.parseFloat(coin.totalSupply ?? "0") > 0
                  ? `$${(
                      Number.parseFloat(coin.marketCap ?? "0") /
                        Number.parseFloat(coin.totalSupply ?? "1")
                    ).toFixed(4)}`
                  : "$0.00"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col px-3.5">
          <div className="pt-2 pb-1.5 text-center">
            <p className="font-semibold text-[2.8rem] text-gray-950 leading-none tracking-tight dark:text-white">
              {mode === "buy" ? `$${displayAmount}` : displayAmount}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1.5 pb-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] text-gray-700 dark:bg-white/5 dark:text-white/85"
              type="button"
            >
              {mode === "sell" ? (
                <Image
                  alt={coin.name}
                  className="size-3.5 rounded-full"
                  height={14}
                  src={coin.mediaContent?.previewImage?.small}
                  width={14}
                />
              ) : (
                <span className="inline-flex items-center justify-center rounded-full bg-gray-900 px-1.5 py-0.5 font-semibold text-[9px] text-white dark:bg-white/85 dark:text-[#111111]">
                  Ξ
                </span>
              )}
              <span>{mobileBalanceLabel}</span>
              <ChevronDownIcon className="size-3 text-gray-500 dark:text-white/55" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5 pb-3">
            {mobileQuickTradeOptions.map((option) => (
              <button
                className="rounded-[0.85rem] bg-gray-100 px-1.5 py-2 font-semibold text-[#7C5CFA] text-[15px] transition-colors hover:bg-gray-200 dark:bg-white/6 dark:text-[#9E85FF] dark:hover:bg-white/10"
                key={option.label}
                onClick={option.onClick}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-x-2 gap-y-2.5 pb-3">
            {mobilePadKeys.map((key) => (
              <button
                className="flex h-11 items-center justify-center rounded-[0.85rem] font-medium text-[1.85rem] text-gray-950 transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-white/5"
                key={key}
                onClick={() => handleMobileKeypadInput(key)}
                type="button"
              >
                {key === "backspace" ? (
                  <BackspaceIcon className="size-6" />
                ) : (
                  key
                )}
              </button>
            ))}
          </div>

          <button
            className="mt-auto mb-4 flex h-11 w-full items-center justify-center rounded-[1rem] bg-gray-950 font-semibold text-[15px] text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:bg-white/8 dark:text-white dark:disabled:bg-white/6 dark:disabled:text-white/45 dark:hover:bg-white/12"
            disabled={!amount || !address || loading}
            onClick={handleSubmit}
            type="button"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="xs" />
                <span>{mode === "buy" ? "Buying" : "Selling"}</span>
              </span>
            ) : amount ? (
              mode === "buy" ? (
                "Buy"
              ) : (
                "Sell"
              )
            ) : (
              "Enter an amount"
            )}
          </button>
        </div>
      </div>
    );
  }

  if (isPageVariant) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2.5">
            <div className="inline-flex rounded-full bg-gray-100 p-1 dark:bg-gray-900">
              {(
                [
                  { label: "Buy", value: "buy" },
                  { label: "Sell", value: "sell" }
                ] as const
              ).map((tab) => (
                <button
                  className={
                    mode === tab.value
                      ? "rounded-full bg-emerald-500 px-2.5 py-1 font-semibold text-[10px] text-white"
                      : "rounded-full px-2.5 py-1 font-semibold text-[10px] text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  }
                  key={tab.value}
                  onClick={() => setMode(tab.value)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {balanceLabel}
            </p>
          </div>

          <div className="rounded-[0.9rem] border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between gap-3">
              <input
                className="w-full bg-transparent font-semibold text-[1.45rem] text-gray-950 leading-none outline-hidden placeholder:text-gray-400 dark:text-gray-50 dark:placeholder:text-gray-500"
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.000111"
                value={amount}
              />

              <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-1.25 font-semibold text-[11px] text-gray-950 dark:border-gray-700 dark:bg-black dark:text-gray-50">
                {mode === "buy" ? (
                  <span>ETH</span>
                ) : (
                  <>
                    <Image
                      alt={coin.name}
                      className="size-4 rounded-full"
                      height={16}
                      src={coin.mediaContent?.previewImage?.small}
                      width={16}
                    />
                    <span>{symbol || "TOKEN"}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {quickTradeOptions.map((option) => (
              <button
                className="rounded-[0.75rem] border border-gray-200 bg-white px-1 py-1.5 font-semibold text-[10px] text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-950 dark:border-gray-800 dark:bg-black dark:text-gray-300 dark:hover:border-gray-700 dark:hover:text-gray-50"
                key={option.label}
                onClick={option.onClick}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="rounded-[0.85rem] border border-gray-200 bg-white px-2.5 py-1.75 dark:border-gray-800 dark:bg-black">
            <input
              className="w-full bg-transparent text-[11px] text-gray-700 outline-hidden placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500"
              placeholder="Add a comment..."
              type="text"
            />
          </div>
        </div>

        <button
          className="mt-auto flex h-10 w-full items-center justify-center rounded-[0.85rem] bg-emerald-500 font-semibold text-[14px] text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300 dark:disabled:bg-emerald-900"
          disabled={!amount || !address || loading}
          onClick={handleSubmit}
          type="button"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" />
              <span>{mode === "buy" ? "Buying" : "Selling"}</span>
            </span>
          ) : mode === "buy" ? (
            "Buy"
          ) : (
            "Sell"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="p-5">
      <Tabs
        active={mode}
        className="mb-4"
        layoutId="trade-mode"
        setActive={(t) => setMode(t as Mode)}
        tabs={[
          { name: "Buy", type: "buy" },
          { name: "Sell", type: "sell" }
        ]}
      />
      <div className="relative mb-2">
        <Input
          inputMode="decimal"
          label="Amount"
          onChange={(e) => setAmount(e.target.value)}
          placeholder={mode === "buy" ? "0.01" : "0"}
          prefix={
            mode === "buy" ? (
              "ETH"
            ) : (
              <Tooltip content={`$${symbol}`}>
                <Image
                  alt={coin.name}
                  className="size-5 rounded-full"
                  height={20}
                  src={coin.mediaContent?.previewImage?.small}
                  width={20}
                />
              </Tooltip>
            )
          }
          value={amount}
        />
      </div>
      <div className="mb-3 flex items-center justify-between text-gray-500 text-xs dark:text-gray-400">
        <div>
          Estimated amount:{" "}
          {estimatedOut
            ? mode === "buy"
              ? `${Number(
                  formatUnits(BigInt(estimatedOut), tokenDecimals)
                ).toFixed(0)}`
              : `${Number(formatEther(BigInt(estimatedOut))).toFixed(6)} ETH`
            : "-"}
        </div>
        <div>{balanceLabel}</div>
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[25, 50, 75].map((p) => (
          <Button key={p} onClick={() => setPercentAmount(p)} outline>
            {p}%
          </Button>
        ))}
        <Button onClick={() => setPercentAmount(100)} outline>
          Max
        </Button>
      </div>
      <Button
        className="mt-4 w-full"
        disabled={!amount || !address}
        loading={loading}
        onClick={handleSubmit}
        size="lg"
      >
        {mode === "buy" ? "Buy" : "Sell"}
      </Button>
    </div>
  );
};

export default Trade;
