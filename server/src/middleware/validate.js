import { badRequest } from '../utils/AppError.js';

/**
 * Validates req[source] against a Zod schema and replaces it with the parsed
 * (typed, trimmed, defaulted) value. Unknown keys are stripped, which also blocks
 * operator injection such as {"email": {"$ne": null}}.
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join('.');
    return next(badRequest(field ? `${field}: ${issue.message}` : issue.message, 'VALIDATION_ERROR'));
  }
  // req.query is a getter in Express 5, so parsed values go on req.valid instead.
  req.valid = { ...req.valid, [source]: result.data };
  next();
};
