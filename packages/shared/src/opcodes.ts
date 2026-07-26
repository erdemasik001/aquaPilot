/**
 * SwapVM opcode table.
 *
 * Mirrors `src/libs/OpcodeList.sol` in 1inch/swap-vm. The enum position IS the opcode
 * byte, so these values are authoritative and must not be reordered.
 *
 * Only *allocated* opcodes are listed. The `0xf0-0xff` bank is reserved by the protocol
 * as a potential two-byte escape prefix and must never be emitted.
 *
 * See docs/swapvm-opcodes.md for the full derivation.
 */

export const Opcode = {
  // 0x00-0x0f | core control flow
  Stop: 0x00,
  Revert: 0x01,
  Salt: 0x02,
  Jump: 0x03,
  Extruction: 0x04,

  // 0x20-0x3f | conditions & access guards
  Deadline: 0x20,
  OnlyTakerTokenBalanceNonZero: 0x23,
  OnlyTakerTokenBalanceGte: 0x24,
  OnlyTakerTokenSupplyShareGte: 0x25,
  OnlyTxOriginTokenBalanceNonZero: 0x26,
  PrivateOrder: 0x2b,
  WhitelistCoequal: 0x2c,
  WhitelistSequential: 0x2d,
  JumpIfDirection: 0x30,
  JumpIfTokenIn: 0x31,
  JumpIfTokenOut: 0x32,

  // 0x40-0x4f | invalidators & epochs
  InvalidateBit: 0x40,
  InvalidateTokenIn: 0x41,
  InvalidateTokenOut: 0x42,
  ValidateSeriesEpoch: 0x48,

  // 0x50-0x6f | swap curves
  XYCSwap: 0x50,
  XYCConcentrateSwap: 0x51,
  LimitSwap: 0x53,
  LimitSwapFullAmount: 0x54,
  PeggedSwap: 0x58,

  // 0x70-0x8f | fees
  FlatFeeAmountIn: 0x70,
  ProtocolFeeAmountIn: 0x71,
  AquaProtocolFeeAmountIn: 0x72,
  ProgressiveFeeIn: 0x73,
  DynamicProtocolFeeAmountIn: 0x74,
  AquaDynamicProtocolFeeAmountIn: 0x75,
  FlatFeeAmountOut: 0x80,
  ProtocolFeeAmountOut: 0x81,
  AquaProtocolFeeAmountOut: 0x82,
  ProgressiveFeeOut: 0x83,

  // 0x90-0xaf | balance tuning
  StaticBalances: 0x90,
  DynamicBalances: 0x91,
  DutchAuctionBalanceIn: 0x94,
  DutchAuctionBalanceOut: 0x95,
  PiecewiseLinearScaleBalanceIn: 0x98,
  PiecewiseLinearScaleBalanceOut: 0x99,
  Decay: 0x9c,
  TWAPSwap: 0x9d,

  // 0xb0-0xcf | rate tuning
  RequireMinRate: 0xb0,
  AdjustMinRate: 0xb1,
  BaseFeeAdjuster: 0xb4,
} as const;

export type OpcodeName = keyof typeof Opcode;
export type OpcodeValue = (typeof Opcode)[OpcodeName];

/** Reverse lookup for decoding and for human-readable program dumps in the UI. */
export const OPCODE_NAMES: ReadonlyMap<number, OpcodeName> = new Map(
  (Object.entries(Opcode) as ReadonlyArray<readonly [OpcodeName, OpcodeValue]>).map(
    ([name, value]) => [value as number, name],
  ),
);

/**
 * Which opcode set — and therefore which deployed router — dispatches a given opcode.
 *
 * An opcode absent from the selected router's set reverts with `UnknownOpcode(opcode)`
 * at execution time, so this is a *pre-flight* check, not an optimisation.
 *
 * AquaPilot targets `SwapVMRouter` (the `Opcodes` set) combined with the
 * `useAquaInsteadOfSignature` maker trait, because `AquaOpcodes` dispatches neither
 * `LimitSwap` nor `StaticBalances` nor the invalidators.
 */
export type OpcodeSet = 'Opcodes' | 'LimitOpcodes' | 'AquaOpcodes';

export const ROUTER_BY_OPCODE_SET: Readonly<Record<OpcodeSet, string>> = {
  Opcodes: 'SwapVMRouter',
  LimitOpcodes: 'LimitSwapVMRouter',
  AquaOpcodes: 'AquaSwapVMRouter',
};

/** Opcodes dispatched by `AquaOpcodes` / `AquaSwapVMRouter`. Deliberately narrow. */
export const AQUA_OPCODE_SET: ReadonlySet<number> = new Set<number>([
  Opcode.Jump,
  Opcode.JumpIfTokenIn,
  Opcode.JumpIfTokenOut,
  Opcode.Deadline,
  Opcode.OnlyTakerTokenBalanceNonZero,
  Opcode.OnlyTakerTokenBalanceGte,
  Opcode.OnlyTakerTokenSupplyShareGte,
  Opcode.OnlyTxOriginTokenBalanceNonZero,
  Opcode.XYCSwap,
  Opcode.XYCConcentrateSwap,
  Opcode.Decay,
  Opcode.Salt,
  Opcode.FlatFeeAmountIn,
  Opcode.ProtocolFeeAmountIn,
  Opcode.AquaProtocolFeeAmountIn,
  Opcode.DynamicProtocolFeeAmountIn,
  Opcode.AquaDynamicProtocolFeeAmountIn,
  Opcode.PeggedSwap,
  Opcode.Extruction,
]);

/**
 * Expected argument byte length per opcode, where the layout is fixed.
 *
 * `undefined` means variable-length (`Revert`, `Salt`, `Extruction`) or not yet derived
 * from source — see docs/swapvm-opcodes.md §4 for what is verified.
 */
export const OPCODE_ARG_LENGTH: Readonly<Partial<Record<OpcodeName, number>>> = {
  Stop: 0,
  Jump: 2,
  Deadline: 5,
  OnlyTakerTokenBalanceNonZero: 20,
  OnlyTxOriginTokenBalanceNonZero: 20,
  OnlyTakerTokenBalanceGte: 52,
  OnlyTakerTokenSupplyShareGte: 28,
  JumpIfDirection: 3,
  JumpIfTokenIn: 22,
  JumpIfTokenOut: 22,
  InvalidateBit: 4,
  InvalidateTokenIn: 0,
  InvalidateTokenOut: 0,
  StaticBalances: 64,
  DynamicBalances: 64,
  LimitSwap: 1,
  LimitSwapFullAmount: 1,
};

/** `argsLength` is encoded in a single byte. */
export const MAX_INSTRUCTION_ARGS_BYTES = 255;

/** Jump targets are `uint16`, so anything beyond this is unreachable by `Jump`. */
export const MAX_JUMP_ADDRESSABLE_PROGRAM_BYTES = 65_535;
