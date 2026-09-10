import type { Settlement } from '../../api/types.js';
import { Stat } from '../../ui/primitives.js';
import { Money } from '../../ui/domain.js';

/** Section 4 of the settlement form — computed totals + the final position. */
export function SettlementSummary({ s }: { s: Settlement }) {
  const payable = Number(s.amountPayable);
  const recoverable = Number(s.amountRecoverable);

  return (
    <div className="u-col u-gap-4">
      <div className="grid-3">
        <Stat label="Net reimbursable" value={<Money value={s.netReimbursable} />} />
        <Stat label="Less: advance drawn" value={<Money value={s.advanceDrawn} />} />
        <Stat
          label={recoverable > 0 ? 'Recoverable from employee' : 'Payable to employee'}
          value={<Money value={recoverable > 0 ? s.amountRecoverable : s.amountPayable} />}
          tone={recoverable > 0 ? 'danger' : 'ok'}
        />
      </div>

      <div className="table-wrap">
        <table className="table">
          <tbody>
            <tr>
              <td>Total claimed — paid by employee</td>
              <td className="table__num">
                <Money value={s.totalEmployeePaid} />
              </td>
            </tr>
            <tr>
              <td>Paid by company (memo only, not reimbursed)</td>
              <td className="table__num">
                <Money value={s.totalCompanyPaidMemo} muted />
              </td>
            </tr>
            <tr>
              <td>Less: non-reimbursable / disallowed</td>
              <td className="table__num">
                <Money value={s.totalDisallowed} />
              </td>
            </tr>
            <tr>
              <td className="u-strong">Net reimbursable claim</td>
              <td className="table__num u-strong">
                <Money value={s.netReimbursable} />
              </td>
            </tr>
            <tr>
              <td>Less: travel advance drawn</td>
              <td className="table__num">
                <Money value={s.advanceDrawn} />
              </td>
            </tr>
            <tr>
              <td className="u-strong">
                {recoverable > 0 ? 'Amount recoverable from employee' : 'Amount payable to employee'}
              </td>
              <td className="table__num u-strong">
                <Money value={recoverable > 0 ? recoverable : payable} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
