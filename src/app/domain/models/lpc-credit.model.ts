/**
 * Línea de crédito compatible con entradas devueltas por getAllCredits() del generador LPC.
 */
export interface LpcCreditLine {
  readonly fileName?: string;
  readonly file?: string;
  readonly license?: string;
  readonly authors?: string;
  readonly url?: string;
  readonly [key: string]: unknown;
}
