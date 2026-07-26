/**
 * Normalized position lifecycle, derived exclusively from on-chain events.
 *
 * Nothing in the UI may compute a number that did not come from one of these.
 *
 * Aqua event signatures (verified against `src/interfaces/IAqua.sol` in 1inch/aqua):
 *
 *   Shipped(address maker, address app, bytes32 strategyHash, bytes strategy)
 *   Docked (address maker, address app, bytes32 strategyHash)
 *   Pulled (address maker, address app, bytes32 strategyHash, address token, uint256 amount)
 *   Pushed (address maker, address app, bytes32 strategyHash, address token, uint256 amount)
 *
 * NOTE: none of these parameters are `indexed`. Logs can only be filtered by contract
 * address and topic0; filtering by maker or strategy requires decoding the data first.
 */

import type { Address, Hex } from './program.js';

export type AquaEventName = 'Shipped' | 'Docked' | 'Pulled' | 'Pushed';

export interface EventOrigin {
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
  readonly logIndex: number;
}

interface LifecycleEventBase {
  readonly origin: EventOrigin;
  readonly maker: Address;
  /** The app the strategy is registered against — for us, the SwapVM router. */
  readonly app: Address;
  readonly strategyHash: Hex;
}

/** Strategy registered with Aqua and funded with initial balances. */
export interface ShippedEvent extends LifecycleEventBase {
  readonly name: 'Shipped';
  /** Raw initialization data, abi-encoded. */
  readonly strategy: Hex;
}

/** Strategy revoked. Aqua requires docking to close *all* tokens at once. */
export interface DockedEvent extends LifecycleEventBase {
  readonly name: 'Docked';
}

/** Tokens leaving the maker — the outgoing side of a fill. */
export interface PulledEvent extends LifecycleEventBase {
  readonly name: 'Pulled';
  readonly token: Address;
  readonly amount: bigint;
}

/** Tokens arriving into the maker's balance — the incoming side of a fill. */
export interface PushedEvent extends LifecycleEventBase {
  readonly name: 'Pushed';
  readonly token: Address;
  readonly amount: bigint;
}

export type LifecycleEvent = ShippedEvent | DockedEvent | PulledEvent | PushedEvent;

export type PositionStatus = 'shipped' | 'partially-filled' | 'filled' | 'docked';

/**
 * A fill, reconstructed by pairing the `Pushed` and `Pulled` legs that share a
 * transaction. Aqua emits the two sides separately; a fill is the pair.
 */
export interface Fill {
  readonly transactionHash: Hex;
  readonly blockNumber: bigint;
  readonly tokenIn: Address;
  readonly amountIn: bigint;
  readonly tokenOut: Address;
  readonly amountOut: bigint;
}

/** Aggregate view the UI renders. Every field traces back to an event above. */
export interface PositionState {
  readonly strategyHash: Hex;
  readonly maker: Address;
  readonly app: Address;
  readonly status: PositionStatus;
  readonly fills: readonly Fill[];
  readonly events: readonly LifecycleEvent[];
}
