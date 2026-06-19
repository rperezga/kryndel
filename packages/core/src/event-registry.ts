/**
 * Standard EVM event registry — maps topic0 (keccak256 of event signature)
 * to a minimal ABI for decoding with viem's decodeEventLog.
 *
 * Scope: EVM Sidechain (XRPL). XLS-0101 native contracts are FUERA.
 * This registry is cascade level 2: used when no per-contract ABI was uploaded.
 *
 * topic0 values verified against EIP standards and Solidity docs.
 */
import type { Abi } from 'viem';

export interface RegistryEntry {
  name: string;
  abi:  Abi;   // minimal single-event ABI — enough for decodeEventLog
}

/**
 * Standard event registry keyed by topic0 (0x-prefixed, lowercase, 32 bytes).
 */
export const STANDARD_EVENT_REGISTRY = new Map<string, RegistryEntry>([

  // ── ERC-20 / ERC-721 shared ─────────────────────────────────────────────────
  // Transfer(address indexed from, address indexed to, uint256 value/tokenId)
  [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    {
      name: 'Transfer',
      abi: [{ type: 'event', name: 'Transfer', inputs: [
        { name: 'from',  type: 'address', indexed: true  },
        { name: 'to',    type: 'address', indexed: true  },
        { name: 'value', type: 'uint256', indexed: false },
      ]}] as Abi,
    },
  ],

  // Approval(address indexed owner, address indexed spender, uint256 value)
  [
    '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
    {
      name: 'Approval',
      abi: [{ type: 'event', name: 'Approval', inputs: [
        { name: 'owner',   type: 'address', indexed: true  },
        { name: 'spender', type: 'address', indexed: true  },
        { name: 'value',   type: 'uint256', indexed: false },
      ]}] as Abi,
    },
  ],

  // ── ERC-721 / ERC-1155 ──────────────────────────────────────────────────────
  // ApprovalForAll(address indexed account, address indexed operator, bool approved)
  [
    '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31',
    {
      name: 'ApprovalForAll',
      abi: [{ type: 'event', name: 'ApprovalForAll', inputs: [
        { name: 'account',  type: 'address', indexed: true  },
        { name: 'operator', type: 'address', indexed: true  },
        { name: 'approved', type: 'bool',    indexed: false },
      ]}] as Abi,
    },
  ],

  // ── ERC-1155 ────────────────────────────────────────────────────────────────
  // TransferSingle(address indexed operator, address indexed from, address indexed to,
  //                uint256 id, uint256 value)
  [
    '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62',
    {
      name: 'TransferSingle',
      abi: [{ type: 'event', name: 'TransferSingle', inputs: [
        { name: 'operator', type: 'address', indexed: true  },
        { name: 'from',     type: 'address', indexed: true  },
        { name: 'to',       type: 'address', indexed: true  },
        { name: 'id',       type: 'uint256', indexed: false },
        { name: 'value',    type: 'uint256', indexed: false },
      ]}] as Abi,
    },
  ],

  // TransferBatch(address indexed operator, address indexed from, address indexed to,
  //               uint256[] ids, uint256[] values)
  [
    '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb',
    {
      name: 'TransferBatch',
      abi: [{ type: 'event', name: 'TransferBatch', inputs: [
        { name: 'operator', type: 'address',   indexed: true  },
        { name: 'from',     type: 'address',   indexed: true  },
        { name: 'to',       type: 'address',   indexed: true  },
        { name: 'ids',      type: 'uint256[]', indexed: false },
        { name: 'values',   type: 'uint256[]', indexed: false },
      ]}] as Abi,
    },
  ],

  // ── Uniswap V2 ──────────────────────────────────────────────────────────────
  // Swap(address indexed sender, uint256 amount0In, uint256 amount1In,
  //      uint256 amount0Out, uint256 amount1Out, address indexed to)
  [
    '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
    {
      name: 'Swap',
      abi: [{ type: 'event', name: 'Swap', inputs: [
        { name: 'sender',     type: 'address', indexed: true  },
        { name: 'amount0In',  type: 'uint256', indexed: false },
        { name: 'amount1In',  type: 'uint256', indexed: false },
        { name: 'amount0Out', type: 'uint256', indexed: false },
        { name: 'amount1Out', type: 'uint256', indexed: false },
        { name: 'to',         type: 'address', indexed: true  },
      ]}] as Abi,
    },
  ],

  // Sync(uint112 reserve0, uint112 reserve1)
  [
    '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1',
    {
      name: 'Sync',
      abi: [{ type: 'event', name: 'Sync', inputs: [
        { name: 'reserve0', type: 'uint112', indexed: false },
        { name: 'reserve1', type: 'uint112', indexed: false },
      ]}] as Abi,
    },
  ],

  // Mint(address indexed sender, uint256 amount0, uint256 amount1)
  [
    '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f',
    {
      name: 'Mint',
      abi: [{ type: 'event', name: 'Mint', inputs: [
        { name: 'sender',  type: 'address', indexed: true  },
        { name: 'amount0', type: 'uint256', indexed: false },
        { name: 'amount1', type: 'uint256', indexed: false },
      ]}] as Abi,
    },
  ],

  // Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)
  [
    '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496',
    {
      name: 'Burn',
      abi: [{ type: 'event', name: 'Burn', inputs: [
        { name: 'sender',  type: 'address', indexed: true  },
        { name: 'amount0', type: 'uint256', indexed: false },
        { name: 'amount1', type: 'uint256', indexed: false },
        { name: 'to',      type: 'address', indexed: true  },
      ]}] as Abi,
    },
  ],

  // ── WETH ─────────────────────────────────────────────────────────────────────
  // Deposit(address indexed dst, uint256 wad)
  [
    '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
    {
      name: 'Deposit',
      abi: [{ type: 'event', name: 'Deposit', inputs: [
        { name: 'dst', type: 'address', indexed: true  },
        { name: 'wad', type: 'uint256', indexed: false },
      ]}] as Abi,
    },
  ],

  // Withdrawal(address indexed src, uint256 wad)
  [
    '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65',
    {
      name: 'Withdrawal',
      abi: [{ type: 'event', name: 'Withdrawal', inputs: [
        { name: 'src', type: 'address', indexed: true  },
        { name: 'wad', type: 'uint256', indexed: false },
      ]}] as Abi,
    },
  ],
]);

/** Look up a standard event by topic0 (0x-prefixed, lowercase). */
export function lookupByTopic0(topic0: string): RegistryEntry | undefined {
  return STANDARD_EVENT_REGISTRY.get(topic0.toLowerCase());
}

/** Sorted list of all standard event names (for UI suggestions). */
export const STANDARD_EVENT_NAMES: readonly string[] = [
  ...new Set([...STANDARD_EVENT_REGISTRY.values()].map((e) => e.name)),
].sort();
