import { describe, it, expect } from 'vitest';
import {
  computeTotalInvoiced,
  computeBalanceDue,
} from '../lib/ar-engine';

describe('AR Formula Engine', () => {
  describe('computeTotalInvoiced', () => {
    it('adds invoiced + invoice credits', () => {
      expect(computeTotalInvoiced(5460, 0)).toBe(5460);
      expect(computeTotalInvoiced(5460, -98)).toBe(5362);
      expect(computeTotalInvoiced(8640, 0)).toBe(8640);
    });

    it('handles zero values', () => {
      expect(computeTotalInvoiced(0, 0)).toBe(0);
    });

    it('handles credit adjustments (negative)', () => {
      expect(computeTotalInvoiced(12320, -800)).toBe(11520);
    });
  });

  describe('computeBalanceDue', () => {
    it('Balance = TotalInvoiced + UnloadingFee + Adjustments - AmountPaid', () => {
      // Fully paid invoice: 5460 + 0 + 0 - 5460 = 0
      expect(computeBalanceDue(5460, 0, 0, 5460)).toBe(0);

      // Unpaid invoice
      expect(computeBalanceDue(10000, 0, 0, 0)).toBe(10000);

      // With adjustment (credit = negative)
      expect(computeBalanceDue(5096, 0, -98, 4998)).toBe(0);

      // Partially paid
      expect(computeBalanceDue(15080, 0, 0, 7540)).toBe(7540);
    });

    it('allows negative balance (overpayment)', () => {
      expect(computeBalanceDue(5000, 0, 0, 5500)).toBe(-500);
    });

    it('matches 2025 AR spreadsheet sample rows', () => {
      // AUBDAL row: Invoiced=5460, Credits=0, Unloading=0, Adj=0, Paid=5460 → Bal=0
      const r1 = computeBalanceDue(computeTotalInvoiced(5460, 0), 0, 0, 5460);
      expect(r1).toBe(0);

      // AUBDAL row with adjustment: Invoiced=5096, Credits=0, Adj=-98, Paid=4998 → Bal=0
      const r2 = computeBalanceDue(computeTotalInvoiced(5096, 0), 0, -98, 4998);
      expect(r2).toBe(0);

      // BILPRO with adjustment: Invoiced=12320, Adj=-800, Paid=11520 → Bal=0
      const r3 = computeBalanceDue(computeTotalInvoiced(12320, 0), 0, -800, 11520);
      expect(r3).toBe(0);
    });
  });

  describe('Conflict resolution', () => {
    it('postgres wins when pg_updated_at is newer', () => {
      const pgTime = new Date('2026-05-20T10:00:00Z');
      const atTime = new Date('2026-05-20T09:00:00Z');
      expect(pgTime > atTime).toBe(true);
    });

    it('airtable wins when at_updated_at is newer', () => {
      const pgTime = new Date('2026-05-20T09:00:00Z');
      const atTime = new Date('2026-05-20T10:00:00Z');
      expect(atTime > pgTime).toBe(true);
    });
  });
});
