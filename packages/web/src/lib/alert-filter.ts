const FILTER_OP_MAP: Readonly<Record<string, '$gt' | '$lt' | '$gte' | '$lte' | '$eq'>> = {
  '>': '$gt',
  '<': '$lt',
  '>=': '$gte',
  '<=': '$lte',
  '=': '$eq',
};

/** Build the persisted worker filter shape shared by rule creation and preview. */
export function buildAlertFilter(
  filterArgName?: string,
  filterOp = '=',
  filterValue?: string,
): Record<string, Record<string, string>> | undefined {
  const argName = filterArgName?.trim();
  const value = filterValue?.trim();
  const mongoOp = FILTER_OP_MAP[filterOp];
  if (!argName || !value || !mongoOp) return undefined;
  return { [argName]: { [mongoOp]: value } };
}
