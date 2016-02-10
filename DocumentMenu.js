'use strict';
// Sub-controller that manages the document list (view) and document objects (model)

/* global document */
var TMDocument = require('./TMController').TMDocument,
    toDocFragment = require('./util').toDocFragment;

// ({menu: HTMLSelectElement, ?group: Node}, DocumentList, ?number,
//    ?(TMDocument -> HTMLOptionElement)) -> void
function DocumentMenu(nodes, doclist, selectedIndex, makeOption) {
  var menu = nodes.menu;
  var group = nodes.group || menu;
  if (!menu) {
    throw new TypeError('DocumentMenu: missing parameter: menu element');
  }
  if (!doclist) {
    throw new TypeError('DocumentMenu: missing parameter: document list');
  }
  if (makeOption) {
    this.optionFromDocument = makeOption;
  }
  group.appendChild(toDocFragment(doclist.list.map(function (entry) {
    return this.optionFromDocument(new TMDocument(entry.id));
  }, this)));

  this.menu = menu;
  this.menu.selectedIndex = selectedIndex || 0;
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

module.exports = DocumentMenu;
