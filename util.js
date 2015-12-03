// misc. utilities

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

exports.nonNull = nonNull
exports.coalesce = coalesce
