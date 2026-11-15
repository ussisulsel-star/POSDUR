import type { PoolClient } from 'pg';
import { query } from '../db';
import { ApiError } from '../errors';

export interface ActiveShiftInfo {
  id: string;
  outlet_id: string | null;
}

/**
 * Memastikan kasir/otorisator memiliki shift OPEN miliknya sendiri sebelum
 * melakukan operasi yang memindahkan kas (checkout, retur, void, koreksi,
 * kas masuk/keluar). Bila outletId diberikan, hanya shift pada cabang itu
 * (atau shift tanpa cabang) yang dihitung.
 *
 * @param client opsional — bila dipanggil di dalam transaksi, gunakan
 *               client yang sama agar konsisten dengan operasi lain.
 */
export async function requireActiveShift(
  companyId: string,
  cashierId: string,
  outletId?: string | null,
  client?: Pick<PoolClient, 'query'>
): Promise<ActiveShiftInfo> {
  const params: unknown[] = [companyId, cashierId];
  let outletCondition = '';
  if (outletId) {
    params.push(outletId);
    outletCondition = ` AND (outlet_id IS NULL OR outlet_id = $${params.length})`;
  }

  const result = await (client
    ? client.query(
        `SELECT id, outlet_id
           FROM pos_shifts
          WHERE company_id = $1 AND cashier_id = $2 AND status = 'OPEN'${outletCondition}
          ORDER BY start_time DESC
          LIMIT 1`,
        params as never
      )
    : query(
        `SELECT id, outlet_id
           FROM pos_shifts
          WHERE company_id = $1 AND cashier_id = $2 AND status = 'OPEN'${outletCondition}
          ORDER BY start_time DESC
          LIMIT 1`,
        params
      ));

  if (result.rows.length === 0) {
    throw new ApiError(
      422,
      'Belum ada shift aktif milik Anda. Buka shift kasir terlebih dahulu sebelum operasi kas.'
    );
  }

  return result.rows[0] as ActiveShiftInfo;
}
