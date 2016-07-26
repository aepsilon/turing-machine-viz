'use strict';

/* global document */
var KeyValueStorage = require('./storage').KeyValueStorage;
var TMDocument = require('./TMDocument');
var d3 = require('d3');
var defaults = require('lodash/fp').defaults; // NB. 2nd arg takes precedence

/**
 * Document menu controller.
 *
 * The view is fully determined by a 3-tuple: ([ID], ID -> Name, currentID).
 * @constructor
 * @param {Object}  args                  argument object
 * @param {HTMLSelectElement}
 *                  args.menu
 * @param {?Node}  [args.group=args.menu] Node to add documents to.
 * @param {string}  args.storagePrefix
 * @param {?(TMDocument -> HTMLOptionElement)}
 *                  args.makeOption       Customize rendering for each document entry.
 * @param {?string} args.firsttimeDocID   Document to open on the first visit.
 */
function DocumentMenu(args) {
  var menu = args.menu,
      group = args.group || menu,
      storagePrefix = args.storagePrefix,
      firsttimeDocID = args.firsttimeDocID;

  if (!menu) {
    throw new TypeError('DocumentMenu: missing parameter: menu element');
  } else if (!storagePrefix) {
    throw new TypeError('DocumentMenu: missing parameter: storage prefix');
  }
  if (args.makeOption) {
    this.optionFromDocument = args.makeOption;
  }
  this.menu = menu;
  this.group = group;
  this.group.innerHTML = '';
  this.__storagePrefix = storagePrefix;

  // Load document entries (non-examples)
  this.doclist = new DocumentList(storagePrefix + '.list');
  this.render();
  // Re-open last-opened document
  this.selectDocID(this.getSavedCurrentDocID() || firsttimeDocID);

  // Listen for selection changes
  var self = this;
  this.menu.addEventListener('change', function () {
    self.onChange(self.currentDocument, {type: 'open'});
  });

  // Listen for storage changes in other tabs/windows
  KeyValueStorage.addStorageListener(function (e) {
    var docID;
    var option, newOption;

    if (e.key === self.doclist.storageKey) {
      // case: [ID] list changed
      self.doclist.readList();
      self.render();
    } else if ( (docID = TMDocument.IDFromNameStorageKey(e.key)) ) {
      // case: single document renamed: (ID -> Name) changed
      option = self.findOptionByDocID(docID);
      if (option) {
        // replace the whole <option>, to be consistent with .optionFromDocument
        option.parentNode.replaceChild(
          newOption = self.optionFromDocument(new TMDocument(docID)),
          option
        );
        newOption.selected = option.selected;
        d3.select(newOption).datum( d3.select(option).datum() );
      }
    }
  });
}

Object.defineProperties(DocumentMenu.prototype, {
  currentOption: {
    get: function () {
      return this.menu.options[this.menu.selectedIndex];
    },
    enumerable: true
  },
  currentDocument: {
    get: function () {
      var opt = this.currentOption;
      return opt ? new TMDocument(opt.value) : null;
    },
    enumerable: true
  }
});

DocumentMenu.prototype.render = function () {
  var currentDocID = this.currentOption ? this.currentOption.value : null;

  var option = d3.select(this.group).selectAll('option')
    .data(this.doclist.list, function (entry) { return entry.id; });

  option.exit().remove();

  var self = this;
  option.enter().insert(function (entry) {
    return self.optionFromDocument(new TMDocument(entry.id));
  });

  // If current document was deleted, switch to another document
  if (this.currentOption.value !== currentDocID) {
    // fallback 1: saved current docID
    if (!this.selectDocID(this.getSavedCurrentDocID(), {type: 'delete'})) {
      // fallback 2: whatever is now selected
      this.onChange(this.currentDocument, {type: 'delete'});
    }
  }
};

// Returns the <option> whose 'value' attribute is docID.
DocumentMenu.prototype.findOptionByDocID = function (docID) {
  return this.menu.querySelector('option[value="' + docID.replace(/"/g, '\\"') + '"]');
};

// Selects (switches the active item to) the given docID. Returns true on success.
DocumentMenu.prototype.selectDocID = function (docID, opts) {
  try {
    this.findOptionByDocID(docID).selected = true;
  } catch (e) {
    return false;
  }
  this.onChange(this.currentDocument, opts);
  return true;
};

// Saves the current (selected) docID to storage.
DocumentMenu.prototype.saveCurrentDocID = function () {
  var docID = this.currentOption && this.currentOption.value;
  if (docID) {
    KeyValueStorage.write(this.__storagePrefix + '.currentDocID', docID);
  }
};

// Returns the saved current docID, otherwise null.
DocumentMenu.prototype.getSavedCurrentDocID = function () {
  return KeyValueStorage.read(this.__storagePrefix + '.currentDocID');
};

// Configurable methods

DocumentMenu.prototype.optionFromDocument = function (doc) {
  var option = document.createElement('option');
  option.value = doc.id;
  option.text = doc.name || 'untitled';
  return option;
};

// Called when the current document ID changes
// through user action (<select>) or this class's API.
// The callback receives the new value of .currentDocument,
// along with the options object (whose .type
// is 'duplicate', 'delete', or 'open').
DocumentMenu.prototype.onChange = function () {
};

// Internal Helpers

// prepend then select
DocumentMenu.prototype.__prepend = function (doc, opts) {
  var option = this.optionFromDocument(doc);
  this.group.insertBefore(option, this.group.firstChild);
  if (opts && opts.select) {
    this.menu.selectedIndex = option.index;
    this.onChange(doc, opts);
  }
  return doc;
};

// Methods not about Current Document

DocumentMenu.prototype.newDocument = function (opts) {
  return this.__prepend(this.doclist.newDocument(), defaults({type: 'open'}, opts));
};

// Methods about Current Document

DocumentMenu.prototype.duplicate = function (doc, opts) {
  return this.__prepend(this.doclist.duplicate(doc), defaults({type: 'duplicate'}, opts));
};

DocumentMenu.prototype.rename = function (name) {
  this.currentDocument.name = name;
  this.currentOption.text = name;
};

// required invariant: one option is always selected.
// returns true if the current entry was removed from the list.
DocumentMenu.prototype.delete = function (opts) {
  this.currentDocument.delete();
  var index = this.menu.selectedIndex;
  var didDeleteEntry = this.doclist.deleteIndex(index);
  if (didDeleteEntry) {
    this.currentOption.remove();
    this.menu.selectedIndex = index;
    this.onChange(this.currentDocument, defaults({type: 'delete'}, opts));
  }
  return didDeleteEntry;
};

/////////////////////
// Document List   //
// (model/storage) //
/////////////////////


// for custom documents.
function DocumentList(storageKey) {
  this.storageKey = storageKey;
  this.readList();
}

// () -> string
DocumentList.newID = function () {
  return String(Date.now());
};

// internal methods.
DocumentList.prototype.add = function (docID) {
  this.__list.unshift({id: docID});
  this.writeList();
};
DocumentList.prototype.readList = function () {
  this.__list = JSON.parse(KeyValueStorage.read(this.storageKey)) || [];
};
DocumentList.prototype.writeList = function () {
  KeyValueStorage.write(this.storageKey, JSON.stringify(this.__list));
};

DocumentList.prototype.newDocument = function () {
  var newID = DocumentList.newID();
  this.add(newID);
  return new TMDocument(newID);
};

DocumentList.prototype.duplicate = function (doc) {
  return this.newDocument().copyFrom(doc);
};

/**
 * Behaves like list.splice(index, 1).
 * @param  {number} index index of the element to delete
 * @return {boolean} true if an element was removed, false otherwise (index out of bounds)
 */
DocumentList.prototype.deleteIndex = function (index) {
  var deleted = this.__list.splice(index, 1);
  this.writeList();
  return (deleted.length > 0);
};

Object.defineProperties(DocumentList.prototype, {
  list: {
    get: function () { return this.__list; },
    enumerable: true
  }
});

module.exports = DocumentMenu;
