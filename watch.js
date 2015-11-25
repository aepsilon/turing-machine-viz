'use strict';
/*
 * Lightweight property assignment observing, by overriding getters/setters.
 * 2015-11-21
 *
 * Inspired by https://gist.github.com/eligrey/384583 (only works for data properties).
 * This also works for accessor properties (getters/setters).
 */

// TODO: JSDoc
// TODO: module export
// TODO: for predictability, don't require/allow handler to modify value?
// watch for assignments to an own property
// when the object has a setter but no getter, oldval will be undefined.
function watch(thisArg, prop, handler) {
  var desc = Object.getOwnPropertyDescriptor(thisArg, prop);
  // check pre-conditions: existent, configurable, writable/settable
  if (desc === undefined) {
    throw new TypeError('Cannot watch nonexistent property \''+prop+'\'');
  } else if (!desc.configurable) {
    throw new TypeError('Cannot watch non-configurable property \''+prop+'\'');
  } else if (!desc.writable && desc.set === undefined) {
    return; // no-op since property can't change without reconfiguration
  }

  var accessors = (function() {
    if (desc.value === undefined) {
      // case: .get/.set
      return {
        get: desc.get,
        set: function(newval) {
          return desc.set.call(thisArg, handler.call(thisArg, prop, thisArg[prop], newval));
        }
      };
    } else {
      // case: .value
      var val = desc.value;
      return {
        get: function() {
          return val;
        },
        set: function(newval) {
          return val = handler.call(thisArg, prop, val, newval);
        }
      };
    }
  })();

  Object.defineProperty(thisArg, prop, {
    get: accessors.get,
    set: accessors.set
  });
}


// TODO: define unwatch

