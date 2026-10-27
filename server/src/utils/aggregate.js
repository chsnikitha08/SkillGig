/** Sum of one numeric field over the documents matching `match` (0 if none). */
export async function sumField(Model, match, field) {
  const [r] = await Model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` } } }]);
  return r?.total ?? 0;
}
