/**
 * Strategy parameters — the *only* surface the language model is allowed to touch.
 *
 * The model never orders opcodes. It fills the typed slots below; a deterministic,
 * human-authored template in `@aquapilot/strategy-core` turns them into a program.
 * This split is the project's core safety claim, so keep this module free of anything
 * resembling instruction composition.
 *
 * `docs/PROGRAMS.md` in swap-vm explicitly asks builders to "constrain dangerous
 * parameter ranges in instruction builders to prevent unsafe program construction" —
 * `PARAM_BOUNDS` below is that constraint, and the validator enforces it.
 */

import type { Address } from './program.js';

export type StrategyKind = 'conditional-ladder';

/**
 * One rung of the ladder: a fixed-rate leg priced by the ratio of two balances.
 *
 * `LimitSwap` derives price purely from `balanceOut / balanceIn`, so a rung is a
 * balance pair, not a price. Amounts are in each token's own decimals.
 *
 * Ordering follows the protocol convention: `a` is the `tokenA` side and `b` the
 * `tokenB` side, where `tokenA < tokenB`. `StaticBalances` re-maps these to in/out
 * itself based on the taker's direction — encoding them as (in, out) silently
 * produces an inverted price.
 */
export interface LadderStep {
  readonly balanceA: bigint;
  readonly balanceB: bigint;
}

export interface ConditionalLadderParams {
  readonly kind: 'conditional-ladder';
  /** Sorted: `tokenA < tokenB`, enforced by `MakerTraitsLib.build`. */
  readonly tokenA: Address;
  readonly tokenB: Address;
  readonly steps: readonly LadderStep[];
  /** Unix seconds. Encoded as `uint40`. */
  readonly deadline: number;
  /** `uint32` bitmap index for one-shot replay protection. */
  readonly invalidatorBitIndex: number;
  /** When true the ladder is fillable across multiple swaps via `InvalidateTokenOut`. */
  readonly partialFill: boolean;
}

export type StrategyParams = ConditionalLadderParams;

/**
 * Hard bounds on model-supplied parameters. These are refusal thresholds, not
 * suggestions: anything outside them is a validator error, never a clamp.
 */
export const PARAM_BOUNDS = {
  /** Enough rungs to be a ladder, few enough to stay inside the 255-byte arg cap. */
  minSteps: 2,
  maxSteps: 8,
  /** A program with no deadline is an open-ended obligation. */
  minDeadlineSeconds: 60,
  maxDeadlineSeconds: 7 * 24 * 60 * 60,
  /** `uint32` domain of the bit invalidator. */
  maxInvalidatorBitIndex: 0xffff_ffff,
} as const;

/**
 * What the extraction step returns.
 *
 * `confidence` and `unresolved` exist so the UI can refuse to submit rather than
 * guess: if the sentence did not pin a parameter down, that is a question for the
 * user, not a default for the model to invent.
 */
export interface ExtractionResult {
  readonly params: StrategyParams | null;
  readonly unresolved: readonly string[];
  readonly notes: readonly string[];
}
