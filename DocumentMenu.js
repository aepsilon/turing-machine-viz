'use strict';

/* global document */
var TMDocument = require('./TMDocument'),
    toDocFragment = require('./util').toDocFragment;

/**
 * Document menu controller.
 * @constructor
 * @param {Object}  args argument object
 * @param {HTMLSelectElement}
 *                  args.menu
 * @param {?Node}  [args.group=args.menu] Node to add documents to.
 * @param {string}  args.storageKey
 * @param {number} [args.selectedIndex=0] Start with this item selected.
 * @param {?(TMDocument -> HTMLOptionElement)}
 *                  args.makeOption Customize rendering for each document entry.
 */
function DocumentMenu(args) {
  var menu = args.menu;
  var storageKey = args.storageKey;
  if (!menu) {
    throw new TypeError('DocumentMenu: missing parameter: menu element');
  } else if (!storageKey) {
    throw new TypeError('DocumentMenu: missing parameter: storage key');
  }
  var doclist = new DocumentList(storageKey);
  if (args.makeOption) {
    this.optionFromDocument = args.makeOption;
  }
  var group = args.group || menu;
  group.appendChild(toDocFragment(doclist.list.map(function (entry) {
    return this.optionFromDocument(new TMDocument(entry.id));
  }, this)));

  this.menu = menu;
  this.menu.selectedIndex = args.selectedIndex || 0;
  this.group = group;
  this.doclist = doclist;
  // Events
  var self = this;
  this.menu.addEventListener('change', function () {
    // TODO: put into refreshCurrent, rename to onSelectedChange
    self.onChange(self.currentDocument);
  });
}

Object.defineProperties(DocumentMenu.prototype, {
  currentOption: {
    get: function () { return this.menu.selectedOptions[0]; },
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

// Configurable methods

DocumentMenu.prototype.optionFromDocument = function (doc) {
  var option = document.createElement('option');
  option.value = doc.id;
  option.text = doc.name || 'untitled';
  return option;
};

// TODO: use an event system?
// called when user action triggers the 'change' event for the <select> menu.
// called with the new value of .currentDocument.
DocumentMenu.prototype.onChange = function () {
};

// Internal Helpers

// prepend then select
DocumentMenu.prototype.__prepend = function (doc, opts) {
  var option = this.optionFromDocument(doc);
  this.group.insertBefore(option, this.group.firstChild);
  if (opts && opts.select) {
    option.selected = true;
  }
  return doc;
};

// Methods not about Current Document

DocumentMenu.prototype.newDocument = function (opts) {
  return this.__prepend(this.doclist.newDocument(), opts);
};

// Methods about Current Document

DocumentMenu.prototype.duplicate = function (opts) {
  return this.__prepend(this.doclist.duplicate(this.currentDocument), opts);
};

DocumentMenu.prototype.rename = function (name) {
  this.currentDocument.name = name;
  this.currentOption.text = name;
};

// required invariant: one option is always selected.
// returns true if the current entry was removed from the list.
DocumentMenu.prototype.delete = function () {
  this.currentDocument.delete();
  var index = this.menu.selectedIndex;
  var status = this.doclist.deleteIndex(index);
  if (status) {
    this.currentOption.remove();
    this.menu.selectedIndex = index;
  }
  return status;
};

/////////////////////
// Document List   //
// (model/storage) //
/////////////////////

var Storage = require('./Storage');

// TODO: impl. transactions

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
  this.__list = JSON.parse(Storage.KeyValueStorage.read(this.storageKey)) || [];
};
DocumentList.prototype.writeList = function () {
  Storage.KeyValueStorage.write(this.storageKey, JSON.stringify(this.__list));
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
