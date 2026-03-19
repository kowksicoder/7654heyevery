/** biome-ignore-all lint/a11y/noSvgWithoutTitle: <explanation> */
import {
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  CogIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from "@heroicons/react/24/solid";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/Shared/PageLayout";
import { Button, Card } from "@/components/Shared/UI";

type Coin = {
  handle: string;
  marketCap: number;
  name: string;
  symbol: string;
  priceNgn: number;
  percentChange: number;
  volume: number;
  holders: number;
  balanceNgn: number;
  balanceToken: number;
  avatarUrl: string;
};

const coins: Coin[] = [
  {
    avatarUrl: "https://i.pravatar.cc/100?u=wiz",
    balanceNgn: 2500,
    balanceToken: 30,
    handle: "@wizboy",
    holders: 450,
    marketCap: 327000,
    name: "WizCoin",
    percentChange: 4.2,
    priceNgn: 85,
    symbol: "WIZ",
    volume: 210000
  },
  {
    avatarUrl: "https://i.pravatar.cc/100?u=funmi",
    balanceNgn: 4300,
    balanceToken: 18,
    handle: "@funmi",
    holders: 310,
    marketCap: 298000,
    name: "FunmiCoin",
    percentChange: -1.8,
    priceNgn: 120,
    symbol: "FUN",
    volume: 320000
  },
  {
    avatarUrl: "https://i.pravatar.cc/100?u=yemi",
    balanceNgn: 2900,
    balanceToken: 26,
    handle: "@yemi",
    holders: 520,
    marketCap: 412000,
    name: "YemiCoin",
    percentChange: 3.5,
    priceNgn: 72,
    symbol: "YEM",
    volume: 185000
  },
  {
    avatarUrl: "https://i.pravatar.cc/100?u=aya",
    balanceNgn: 3150,
    balanceToken: 22,
    handle: "@aya",
    holders: 380,
    marketCap: 214000,
    name: "AyaCoin",
    percentChange: 1.2,
    priceNgn: 95,
    symbol: "AYA",
    volume: 154000
  },
  {
    avatarUrl: "https://i.pravatar.cc/100?u=nexa",
    balanceNgn: 2100,
    balanceToken: 14,
    handle: "@nexa",
    holders: 260,
    marketCap: 173000,
    name: "NexaCoin",
    percentChange: -0.9,
    priceNgn: 68,
    symbol: "NEX",
    volume: 112000
  }
];

type ChartPoint = { x: number; y: number };

const buildSmoothPath = (points: ChartPoint[]) => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const smoothing = 0.2;
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const previous = points[i - 1] ?? current;
    const nextNext = points[i + 2] ?? next;
    const cp1x = current.x + (next.x - previous.x) * smoothing;
    const cp1y = current.y + (next.y - previous.y) * smoothing;
    const cp2x = next.x - (nextNext.x - current.x) * smoothing;
    const cp2y = next.y - (nextNext.y - current.y) * smoothing;
    d.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${next.x} ${next.y}`);
  }
  return d.join(" ");
};

const generateChartData = (
  trend: number,
  volume: number,
  phase: number,
  priceBias: number
): { points: ChartPoint[]; linePath: string; areaPath: string } => {
  const positiveShape = [
    0.34, 0.36, 0.4, 0.46, 0.52, 0.58, 0.61, 0.6, 0.66, 0.7, 0.74, 0.72,
    0.77, 0.8, 0.84, 0.87, 0.9, 0.93
  ];
  const negativeShape = [
    0.88, 0.6, 0.52, 0.57, 0.51, 0.49, 0.48, 0.47, 0.46, 0.46, 0.45, 0.45,
    0.44, 0.43, 0.43, 0.42, 0.42, 0.41
  ];
  const shape = trend >= 0 ? positiveShape : negativeShape;
  const points: ChartPoint[] = [];
  const minY = 6;
  const maxY = 46;
  const maxJitter = Math.min(0.03, (volume / 1_000_000) * 0.03);
  const bias = Math.max(-0.12, Math.min(0.12, priceBias));

  shape.forEach((value, index) => {
    const x = (200 / (shape.length - 1)) * index;
    const jitter = Math.sin(index * 0.9 + phase) * maxJitter;
    const normalized = Math.min(0.97, Math.max(0.12, value + jitter + bias * 0.35));
    const y = maxY - (maxY - minY) * normalized;
    points.push({ x, y });
  });

  const linePath = buildSmoothPath(points);
  const baseline = 50;
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = `${linePath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
  return { areaPath, linePath, points };
};

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 1,
    notation: "compact"
  }).format(value);

const Swap = () => {
  const [fromFiat, setFromFiat] = useState("1000");
  const [toToken, setToToken] = useState("11.76");
  const [direction, setDirection] = useState<"fiatToToken" | "tokenToFiat">(
    "fiatToToken"
  );
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      setPhase((p) => (p + 0.03) % (Math.PI * 2));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const [selectedCoin, setSelectedCoin] = useState<Coin>(coins[0]);
  const parsedFiat = Number(fromFiat);
  const trendUp = selectedCoin.percentChange >= 0;
  const trendColor = trendUp ? "#16a34a" : "#db2777";
  const gradientId = `swap-chart-${selectedCoin.symbol}`;

  const computed = useMemo(() => {
    if (!Number.isFinite(parsedFiat) || parsedFiat < 0) {
      return { fiat: "0", token: "0.00" };
    }
    if (direction === "fiatToToken") {
      const tokenCalc = parsedFiat / selectedCoin.priceNgn;
      return {
        fiat: parsedFiat.toLocaleString("en-NG"),
        token: tokenCalc.toFixed(2)
      };
    }
    const parsedToken = Number(toToken);
    if (!Number.isFinite(parsedToken) || parsedToken < 0)
      return { fiat: "0", token: "0.00" };
    const fiatCalc = parsedToken * selectedCoin.priceNgn;
    return {
      fiat: fiatCalc.toLocaleString("en-NG"),
      token: parsedToken.toFixed(2)
    };
  }, [direction, parsedFiat, toToken, selectedCoin]);
  const fromIsFiat = direction === "fiatToToken";
  const [isCoinPickerOpen, setIsCoinPickerOpen] = useState(false);
  const [coinQuery, setCoinQuery] = useState("");
  const filteredCoins = useMemo(() => {
    const query = coinQuery.trim().toLowerCase();
    if (!query) return coins;
    return coins.filter(
      (coin) =>
        coin.name.toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query)
    );
  }, [coinQuery]);

  // Generate interactive chart points based on current price
  const animatedPrice = useMemo(() => {
    const wiggle = 0.012;
    const next = selectedCoin.priceNgn * (1 + Math.sin(phase) * wiggle);
    return Math.max(1, next);
  }, [phase, selectedCoin]);

  const priceBias = (animatedPrice - selectedCoin.priceNgn) / selectedCoin.priceNgn;
  const chartData = useMemo(
    () =>
      generateChartData(
        selectedCoin.percentChange,
        selectedCoin.volume,
        phase,
        priceBias
      ),
    [phase, priceBias, selectedCoin]
  );

  const [hover, setHover] = useState<null | {
    x: number;
    y: number;
    value: number;
  }>(null);

  const handleChartMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, x));

    // Find nearest point to hovered X
    const nearest = chartData.points.reduce((prev, point) => {
      const prevDiff = Math.abs(prev.x - (clampedX / rect.width) * 200);
      const currDiff = Math.abs(point.x - (clampedX / rect.width) * 200);
      return currDiff < prevDiff ? point : prev;
    }, chartData.points[0]);

    // Convert y back to a pseudo-price for display
    const priceFromY = Math.round(animatedPrice + (50 - nearest.y) * 0.35);

    setHover({
      value: priceFromY,
      x: nearest.x,
      y: nearest.y
    });
  };

  const handleChartMouseLeave = () => setHover(null);
  const handleCoinSelect = (coin: Coin) => {
    setSelectedCoin(coin);
    setIsCoinPickerOpen(false);
    setCoinQuery("");
  };
  const closeCoinPicker = () => {
    setIsCoinPickerOpen(false);
    setCoinQuery("");
  };

  const tokenOutput = direction === "fiatToToken" ? computed.token : toToken;
  const fiatOutput = direction === "fiatToToken" ? fromFiat : computed.fiat;

  return (
    <PageLayout description="A self-serve swap page for AyoCoin." title="Swap">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-3 md:gap-3 md:px-0">
        {/* Coin Header Card */}
        <Card
          className="overflow-hidden border-0 bg-[#0b0b0c] p-2.5 text-white md:border md:border-gray-200 md:bg-white md:text-gray-900 dark:md:border-gray-700 dark:md:bg-black dark:md:text-gray-100 md:p-4"
          forceRounded
        >
          <div className="flex items-center justify-between gap-1.5 md:gap-3">
            {/* Coin Info - Left */}
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <img
                alt={selectedCoin.name}
                className="h-9 w-9 rounded-full border-0 object-cover md:h-10 md:w-10 md:border md:border-gray-200"
                src={selectedCoin.avatarUrl}
              />
              <div>
                <p className="font-bold text-sm text-white md:text-base md:text-gray-900 dark:md:text-gray-100">
                  ₦{selectedCoin.symbol}
                </p>
                <p className="text-[10px] text-gray-400 md:text-xs md:text-gray-500">
                  {selectedCoin.handle}
                </p>
              </div>
            </div>

            {/* Chart - Middle */}
            <div className="h-10 w-20 flex-none md:h-16 md:w-auto md:flex-1">
              <svg
                className="h-full w-full cursor-crosshair"
                onMouseLeave={handleChartMouseLeave}
                onMouseMove={handleChartMouseMove}
                viewBox="0 0 200 50"
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trendColor} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={chartData.areaPath} fill={`url(#${gradientId})`} />
                <path
                  className="transition-all duration-200"
                  d={chartData.linePath}
                  fill="none"
                  stroke={trendColor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                />
                {chartData.points.length > 0 && (
                  <g>
                    <circle
                      cx={chartData.points[chartData.points.length - 1].x}
                      cy={chartData.points[chartData.points.length - 1].y}
                      fill={trendColor}
                      opacity="0.18"
                      r="6.5"
                    />
                    <circle
                      cx={chartData.points[chartData.points.length - 1].x}
                      cy={chartData.points[chartData.points.length - 1].y}
                      fill={trendColor}
                      r="3.5"
                      stroke="white"
                      strokeWidth="2"
                    />
                  </g>
                )}
                {hover && (
                  <g>
                    <circle
                      cx={hover.x}
                      cy={hover.y}
                      fill={trendColor}
                      opacity="0.25"
                      r="6"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <rect
                      fill="rgba(0,0,0,0.75)"
                      height="18"
                      rx="4"
                      width="44"
                      x={hover.x - 22}
                      y={hover.y - 28}
                    />
                    <text
                      fill="white"
                      fontFamily="sans-serif"
                      fontSize="9"
                      x={hover.x - 20}
                      y={hover.y - 14}
                    >
                      ₦{hover.value}
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Price Stats - Right */}
            <div className="flex flex-shrink-0 items-center gap-2">
              <div className="text-right">
                <p className="font-bold text-base text-white md:text-xl md:text-gray-900 dark:md:text-gray-100">
                  ₦{Math.round(animatedPrice).toLocaleString()}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-gray-300 md:text-xs md:text-gray-600">
                  <span>MC ₦{formatCompact(selectedCoin.marketCap)}</span>
                  <span className="text-gray-500">|</span>
                  <span className={trendUp ? "text-green-400 md:text-green-600" : "text-pink-400 md:text-pink-600"}>
                    {trendUp ? "▲" : "▼"} {Math.abs(selectedCoin.percentChange).toFixed(1)}
                  </span>
                </div>
              </div>
              <button className="hidden text-gray-400 hover:text-gray-600 md:inline-flex">
                <CogIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </Card>

        {/* Swap Card - Main Swap Interface */}
        <Card className="overflow-hidden border-0 bg-[#111217] p-3 text-white shadow-none md:p-4" forceRounded>
          <div className="relative space-y-3">
            <div className="rounded-2xl border-0 bg-[#1a1c22] p-3 shadow-none ring-0 md:p-3.5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b8b95]">
                <span>From</span>
                <span>
                  Balance:{" "}
                  {fromIsFiat
                    ? `₦${selectedCoin.balanceNgn.toLocaleString()}`
                    : `${selectedCoin.balanceToken.toFixed(0)} ${selectedCoin.symbol}`}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  aria-label="Amount to swap"
                  className="w-full bg-transparent text-2xl font-semibold text-white placeholder:text-[#6b6b73] outline-none"
                  onChange={(event) => {
                    const next = event.target.value.replace(/[^0-9.]/g, "");
                    if (fromIsFiat) {
                      setFromFiat(next);
                    } else {
                      setToToken(next);
                    }
                  }}
                  placeholder={fromIsFiat ? "1,000" : "11.36"}
                  value={fromIsFiat ? fiatOutput : tokenOutput}
                />
                {fromIsFiat ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#242733] px-3 py-2 text-sm font-semibold text-white">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0c0d12] text-[11px] font-semibold">
                      ₦
                    </span>
                    NGN
                  </div>
                ) : (
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-[#242733] px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => setIsCoinPickerOpen(true)}
                    type="button"
                  >
                    <img
                      alt={selectedCoin.name}
                      className="h-6 w-6 rounded-full"
                      src={selectedCoin.avatarUrl}
                    />
                    {selectedCoin.symbol}
                    <ChevronDownIcon className="h-4 w-4 text-gray-300" />
                  </button>
                )}
              </div>
            </div>

            <button
              className="absolute left-1/2 top-[50%] z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#2c303b] bg-[#111217] p-2 text-gray-200 shadow-sm"
              onClick={() =>
                setDirection((prev) =>
                  prev === "fiatToToken" ? "tokenToFiat" : "fiatToToken"
                )
              }
              type="button"
            >
              <ArrowsRightLeftIcon className="h-4 w-4" />
            </button>

            <div className="rounded-2xl border-0 bg-[#1a1c22] p-3 shadow-none ring-0 md:p-3.5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b8b95]">
                <span>To</span>
                <span>
                  Balance:{" "}
                  {fromIsFiat
                    ? `${selectedCoin.balanceToken.toFixed(0)} ${selectedCoin.symbol}`
                    : `₦${selectedCoin.balanceNgn.toLocaleString()}`}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  aria-label="Amount received"
                  className="w-full bg-transparent text-2xl font-semibold text-white placeholder:text-[#6b6b73] outline-none"
                  placeholder={fromIsFiat ? "11.36" : "1,000"}
                  readOnly
                  value={fromIsFiat ? tokenOutput : fiatOutput}
                />
                {fromIsFiat ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-[#242733] px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => setIsCoinPickerOpen(true)}
                    type="button"
                  >
                    <img
                      alt={selectedCoin.name}
                      className="h-6 w-6 rounded-full"
                      src={selectedCoin.avatarUrl}
                    />
                    {selectedCoin.symbol}
                    <ChevronDownIcon className="h-4 w-4 text-gray-300" />
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#242733] px-3 py-2 text-sm font-semibold text-white">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0c0d12] text-[11px] font-semibold">
                      ₦
                    </span>
                    NGN
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-[#9a9aa2]">
            <span>
              {fromIsFiat
                ? `≈ ${Number(computed.token).toFixed(2)} ${selectedCoin.symbol}`
                : `≈ ₦${computed.fiat}`}
            </span>
            <span>
              Rate: ₦{selectedCoin.priceNgn.toLocaleString()} / {selectedCoin.symbol}
            </span>
          </div>

          {/* Primary CTA Button */}
          <Button className="mt-3 w-full rounded-2xl border-none bg-green-600 py-3 text-base font-semibold text-white hover:bg-green-700">
            Buy {selectedCoin.name}
          </Button>
          <p className="mt-1 text-center text-xs text-[#8e8e95]">
            Instant transaction. No crypto needed.
          </p>
        </Card>

        {/* Creator Coins (coin selection) */}
        <Card className="overflow-hidden p-3 md:p-3.5" forceRounded>
          <div className="mb-1 flex items-center justify-between md:mb-2">
            <p className="font-semibold text-gray-900 text-xs dark:text-gray-100 md:text-sm">
              Select coin
            </p>
            <span className="text-gray-500 text-[10px] md:text-xs">
              Tap a coin to swap
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-2">
            {coins.map((entry) => {
              const active = entry.symbol === selectedCoin.symbol;
              return (
                <button
                  className={
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition md:gap-2 md:px-3 md:py-1.5 md:text-xs" +
                    (active
                      ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-200"
                      : "bg-white text-gray-900 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800")
                  }
                  key={entry.symbol}
                  onClick={() => setSelectedCoin(entry)}
                >
                  <img
                    alt={entry.name}
                    className="h-7 w-7 rounded-full md:h-8 md:w-8"
                    src={entry.avatarUrl}
                  />
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {entry.symbol}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {isCoinPickerOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
            <button
              aria-label="Close coin picker"
              className="absolute inset-0"
              onClick={closeCoinPicker}
              type="button"
            />
            <div
              className="relative w-full max-w-md rounded-3xl bg-[#141418] p-4 text-white shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Trade From</h3>
                <button
                  aria-label="Close"
                  className="rounded-full p-1 text-gray-400 hover:text-gray-200"
                  onClick={closeCoinPicker}
                  type="button"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#23232b] px-3 py-2 text-sm">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                <input
                  className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
                  onChange={(event) => setCoinQuery(event.target.value)}
                  placeholder="Search"
                  value={coinQuery}
                />
              </div>

              <div className="mt-3 space-y-1">
                {filteredCoins.map((coin) => (
                  <button
                    className="flex w-full items-center justify-between rounded-2xl px-2.5 py-2 text-left transition hover:bg-[#1f1f26]"
                    key={coin.symbol}
                    onClick={() => handleCoinSelect(coin)}
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        alt={coin.name}
                        className="h-10 w-10 rounded-full"
                        src={coin.avatarUrl}
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {coin.name}
                        </p>
                        <p className="text-xs text-[#9a9aa2]">₦{coin.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        ₦{coin.priceNgn.toLocaleString()}
                      </p>
                      <p
                        className={
                          coin.percentChange >= 0
                            ? "text-xs text-green-400"
                            : "text-xs text-pink-400"
                        }
                      >
                        {coin.percentChange >= 0 ? "▲" : "▼"}{" "}
                        {Math.abs(coin.percentChange)}%
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
};

export default Swap;
