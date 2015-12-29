// misc. utilities

// ** Null/Undefined Utilities **
// Assert non-null.
// Return the value if it is not null or undefined; otherwise, throw an error.
function nonNull(value) {
  if (value == null) {
    throw new Error('expected a non-null defined value, but got: ' + String(value));
  }
  return value;
}

// Null coalescing: iff the first argument is null or undefined, return the second.
function coalesce(a, b) {
  return (a == null) ? b : a;
}

// Apply a function to a value if non-null, otherwise return the value.
// monadic bind for maybe (option) type
// ((a -> b), ?a) -> ?b
function applyMaybe(f, x) {
  return (x != null) ? f(x) : x;
}

exports.nonNull = nonNull;
exports.coalesce = coalesce;
exports.applyMaybe = applyMaybe;
