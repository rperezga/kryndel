/**
 * fieldcodes.ts — Map of XRPL field IDs to field names.
 *
 * Field IDs used by otxn_field() follow the XRPL binary codec format:
 * the field_id passed by the hook is the canonical SField code.
 * See: https://xrpl.org/serialization.html#field-ids
 */

// Common XRPL transaction field names keyed by their canonical field ID
// Field ID = (type_code << 16) | field_code  (simplified for MVP)
// For MVP we use the string name directly as the key from xrpl.js field maps.

export const FIELD_ID_TO_NAME: Record<number, string> = {
  // UInt16 (type 1)
  0x10002: 'TransactionType',
  0x10003: 'SignerEntries',
  // UInt32 (type 2)
  0x20002: 'Flags',
  0x20003: 'SourceTag',
  0x20004: 'Sequence',
  0x20005: 'TransferRate',
  0x2000b: 'OfferSequence',
  0x2000e: 'FirstLedgerSequence',
  0x2000f: 'LastLedgerSequence',
  0x20016: 'DestinationTag',
  0x20019: 'HighQualityIn',
  0x2001a: 'HighQualityOut',
  0x20026: 'QualityIn',
  0x20027: 'QualityOut',
  0x20033: 'OwnerCount',
  0x20034: 'TicketCount',
  // Amount (type 6)
  0x60001: 'Amount',
  0x60002: 'Balance',
  0x60003: 'LimitAmount',
  0x60004: 'TakerPays',
  0x60005: 'TakerGets',
  0x60006: 'LowLimit',
  0x60007: 'HighLimit',
  0x60008: 'Fee',
  0x60009: 'SendMax',
  0x6000a: 'DeliverMin',
  // VL / Blob (type 7)
  0x70001: 'PublicKey',
  0x70002: 'MessageKey',
  0x70003: 'SigningPubKey',
  0x70004: 'TxnSignature',
  0x70006: 'Domain',
  0x70007: 'FundCode',
  0x70008: 'RemoveCode',
  0x70009: 'ExpireCode',
  0x7000a: 'CreateCode',
  // AccountID (type 8)
  0x80001: 'Account',
  0x80002: 'Owner',
  0x80003: 'Destination',
  0x80004: 'Issuer',
  0x80005: 'Authorize',
  0x80006: 'Unauthorize',
  // STObject (type 14)
  // STArray (type 15)
};

// Transaction type codes
export const TX_TYPE_CODES: Record<string, number> = {
  Payment: 0,
  EscrowCreate: 1,
  EscrowFinish: 2,
  AccountSet: 3,
  EscrowCancel: 4,
  SetRegularKey: 5,
  OfferCreate: 7,
  OfferCancel: 8,
  TicketCreate: 10,
  PaymentChannelCreate: 11,
  PaymentChannelFund: 12,
  PaymentChannelClaim: 13,
  CheckCreate: 16,
  CheckCash: 17,
  CheckCancel: 18,
  AccountDelete: 19,
  SetHook: 22,
  NFTokenMint: 25,
  NFTokenBurn: 26,
  NFTokenCreateOffer: 27,
  NFTokenCancelOffer: 28,
  NFTokenAcceptOffer: 29,
};

export function getFieldName(fieldId: number): string | undefined {
  return FIELD_ID_TO_NAME[fieldId];
}

export function getTxTypeCode(txType: string): number {
  return TX_TYPE_CODES[txType] ?? -1;
}
