/**
 * Program and order representation shared by the composer, the validator and the
 * execution layer.
 *
 * Encoding (verified against `src/libs/VM.sol` and `test/utils/ProgramBuilder.sol`):
 *
 *     [1 byte opcode][1 byte argsLength][argsLength bytes args]
 *
 * See docs/swapvm-opcodes.md.
 */

import type { OpcodeName, OpcodeValue } from './opcodes.js';

export type Hex = `0x${string}`;
export type Address = `0x${string}`;

/** A single decoded instruction. `args` is packed, unpadded, exactly as the VM reads it. */
export interface Instruction {
  readonly opcode: OpcodeValue;
  readonly args: Hex;
  /** Human-readable label for the UI program viewer. Never used for encoding. */
  readonly label?: string;
}

/**
 * A program as an ordered instruction list.
 *
 * This is intentionally *flat*, mirroring the byte stream. Note that three instructions
 * — `DynamicBalances`, `InvalidateTokenIn`, `InvalidateTokenOut` — are *wrapping*: at
 * runtime they call `ctx.runLoop()` and execute the remainder of the program nested,
 * then post-process. That is a semantic property the validator must know about
 * (it is why backward jumps into them are forbidden), not a structural one.
 */
export interface ProgramSpec {
  readonly instructions: readonly Instruction[];
}

/** Maker trait bit positions, from `src/libs/MakerTraits.sol`. */
export const MakerTraitBit = {
  ShouldUnwrapWeth: 255,
  /** The Aqua switch. Aqua-backed settlement is a trait, not a separate opcode set. */
  UseAquaInsteadOfSignature: 254,
  AllowZeroAmountIn: 253,
  HasPreTransferInHook: 252,
  HasPostTransferInHook: 251,
  HasPreTransferOutHook: 250,
  HasPostTransferOutHook: 249,
  PreTransferInHookHasTarget: 248,
  PostTransferInHookHasTarget: 247,
  PreTransferOutHookHasTarget: 246,
  PostTransferOutHookHasTarget: 245,
} as const;

/** Bit offset at which the four `uint16` order-data slice indexes are packed. */
export const ORDER_DATA_SLICES_INDEXES_BIT_OFFSET = 160;

/**
 * The order envelope that carries a program on-chain (`ISwapVM.Order`).
 *
 * `data` is `tokenA ‖ tokenB ‖ [hooks…] ‖ program`, and `tokenA < tokenB` is enforced
 * by `MakerTraitsLib.build` (`MakerTraitsTokensNotSorted`).
 */
export interface OrderSpec {
  readonly maker: Address;
  readonly receiver: Address;
  /** Sorted: `tokenA < tokenB`. */
  readonly tokenA: Address;
  readonly tokenB: Address;
  readonly useAquaInsteadOfSignature: boolean;
  readonly shouldUnwrapWeth: boolean;
  readonly allowZeroAmountIn: boolean;
  readonly program: ProgramSpec;
}

/** Encoded, ready-to-submit form. */
export interface EncodedOrder {
  readonly maker: Address;
  readonly traits: bigint;
  readonly data: Hex;
  /** The program slice alone, kept for the UI byte viewer and for fixture comparison. */
  readonly programBytes: Hex;
}

/** A validator finding. Severity `error` blocks submission; `warning` is shown but passes. */
export interface ValidationIssue {
  /** Stable rule id from docs/swapvm-opcodes.md §5, e.g. `'R2'`. */
  readonly rule: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  /** Index into `ProgramSpec.instructions`, when the issue is instruction-local. */
  readonly instructionIndex?: number;
  readonly opcode?: OpcodeName;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  /** Every rule that was evaluated, so the UI can show what was checked, not just failures. */
  readonly checkedRules: readonly string[];
}
