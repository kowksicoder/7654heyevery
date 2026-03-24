import { getProfile } from "@zoralabs/coins-sdk";
import dayjs from "dayjs";
import {
  type Address,
  createPublicClient,
  formatUnits,
  http,
  parseAbiItem,
  zeroAddress
} from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, DEFAULT_AVATAR } from "@/data/constants";
import formatAddress from "@/helpers/formatAddress";

export interface CoinHolder {
  address: Address;
  avatar: string;
  balance: number;
  balanceRaw: bigint;
  displayName: string;
  handle: string;
  percentage: number;
}

type ZoraProfile = NonNullable<
  NonNullable<Awaited<ReturnType<typeof getProfile>>["data"]>["profile"]
>;

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const BASE_BLOCK_TIME_SECONDS = 2;
const BLOCK_CHUNK_SIZE = 250_000n;
const BLOCK_BUFFER = 50_000n;
const MAX_HOLDER_ROWS = 50;
const MAX_PROFILE_LOOKUPS = 20;

const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL, { batch: { batchSize: 20 } })
});

const getEstimatedFromBlock = (
  createdAt?: null | string,
  latestBlock?: bigint
) => {
  if (!createdAt || latestBlock === undefined) {
    return 0n;
  }

  const ageSeconds = Math.max(0, dayjs().diff(dayjs(createdAt), "second"));
  const estimatedBlocks = BigInt(
    Math.ceil(ageSeconds / BASE_BLOCK_TIME_SECONDS)
  );

  if (estimatedBlocks + BLOCK_BUFFER >= latestBlock) {
    return 0n;
  }

  return latestBlock - estimatedBlocks - BLOCK_BUFFER;
};

const formatProfileHandle = (
  handle?: null | string,
  address?: null | string
) => {
  if (handle?.trim()) {
    return handle.startsWith("@") ? handle : `@${handle}`;
  }

  return formatAddress(address ?? "");
};

const getHolderDisplayBalance = (balanceRaw: bigint) =>
  Number.parseFloat(formatUnits(balanceRaw, 18));

const getCoinHolders = async ({
  address,
  createdAt,
  totalSupply
}: {
  address: Address;
  createdAt?: null | string;
  totalSupply?: null | string;
}) => {
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = getEstimatedFromBlock(createdAt, latestBlock);
  const balances = new Map<string, bigint>();

  for (
    let start = fromBlock;
    start <= latestBlock;
    start += BLOCK_CHUNK_SIZE + 1n
  ) {
    const end =
      start + BLOCK_CHUNK_SIZE > latestBlock
        ? latestBlock
        : start + BLOCK_CHUNK_SIZE;

    const logs = await publicClient.getLogs({
      address,
      event: TRANSFER_EVENT,
      fromBlock: start,
      toBlock: end
    });

    for (const log of logs) {
      const from = log.args.from?.toLowerCase();
      const to = log.args.to?.toLowerCase();
      const value = log.args.value;

      if (!value || typeof value !== "bigint") {
        continue;
      }

      if (from && from !== zeroAddress) {
        balances.set(from, (balances.get(from) ?? 0n) - value);
      }

      if (to && to !== zeroAddress) {
        balances.set(to, (balances.get(to) ?? 0n) + value);
      }
    }
  }

  const totalSupplyValue = Number.parseFloat(totalSupply ?? "");
  const holders = [...balances.entries()]
    .filter(([, balanceRaw]) => balanceRaw > 0n)
    .sort((left, right) =>
      left[1] === right[1] ? 0 : left[1] > right[1] ? -1 : 1
    )
    .slice(0, MAX_HOLDER_ROWS)
    .map(([holderAddress, balanceRaw]) => {
      const balance = getHolderDisplayBalance(balanceRaw);
      const percentage =
        Number.isFinite(totalSupplyValue) && totalSupplyValue > 0
          ? (balance / totalSupplyValue) * 100
          : 0;

      return {
        address: holderAddress as Address,
        avatar: DEFAULT_AVATAR,
        balance,
        balanceRaw,
        displayName: formatAddress(holderAddress),
        handle: formatAddress(holderAddress),
        percentage
      } satisfies CoinHolder;
    });

  const topHolders = holders.slice(0, MAX_PROFILE_LOOKUPS);
  const profiles = await Promise.allSettled(
    topHolders.map(async (holder) => {
      const response = await getProfile({ identifier: holder.address });
      return {
        address: holder.address,
        profile: response.data?.profile ?? null
      };
    })
  );

  const profileMap = new Map<string, ZoraProfile | null>();

  for (const result of profiles) {
    if (result.status === "fulfilled") {
      profileMap.set(result.value.address.toLowerCase(), result.value.profile);
    }
  }

  return holders.map((holder) => {
    const profile = profileMap.get(holder.address.toLowerCase());

    if (!profile) {
      return holder;
    }

    const displayName =
      profile.displayName?.trim() ||
      profile.username?.trim() ||
      formatAddress(holder.address);

    return {
      ...holder,
      avatar: profile.avatar?.medium || profile.avatar?.small || holder.avatar,
      displayName,
      handle: formatProfileHandle(profile.handle, holder.address)
    } satisfies CoinHolder;
  });
};

export default getCoinHolders;
