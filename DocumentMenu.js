'use strict';
// Sub-controller that manages the document list (view) and document objects (model)

/* global document */
var TMDocument = require('./TMController').TMDocument;

// ({menu: HTMLSelectElement, ?group: Node}, DocumentList, ?number) -> void
function DocumentMenu(nodes, doclist, selectedIndex) {
  var menu = nodes.menu;
  var group = nodes.group || menu;
  if (!menu) {
    throw new TypeError('DocumentMenu: missing parameter: menu element');
  }
  if (!doclist) {
    throw new TypeError('DocumentMenu: missing parameter: document list');
  }
  var self = this;

  this.menu = menu;
  this.menu.selectedIndex = selectedIndex || 0;
  this.group = group;
  this.doclist = doclist;
  this.__refreshCurrent();
  // this.__currentDocument = (function () {
    // var option = self.menu.options[selectedIndex] || self.menu.options[0];
    // return option ? new TMDocument(option.value) : null;
    // var option = self.getCurrentOption();
    // return option ? new TMDocument(option.value) : null;
  // })();
  // Events
  this.menu.addEventListener('change', function () {
    self.__refreshCurrent();
    self.onChange(self.currentDocument);
  });
}

Object.defineProperties(DocumentMenu.prototype, {
  currentOption: {
    get: function () { return this.menu.selectedOptions[0]; },
    enumerable: true
  },
  currentDocument: {
    get: function () { return this.__currentDocument; },
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
DocumentMenu.prototype.__prepend = function (doc) {
  this.__refreshCurrent(doc);
  var option = this.optionFromDocument(doc);
  this.group.insertBefore(option, this.group.firstChild);
  option.selected = true;
  return doc;
};

// update .currentDocument
// ?TMDocument -> void
DocumentMenu.prototype.__refreshCurrent = function (doc) {
  doc = doc || new TMDocument(this.menu.value);
  this.__currentDocument = doc;
};

// Methods not about Current Document

DocumentMenu.prototype.newDocument = function () {
  return this.__prepend(this.doclist.newDocument());
};

// Methods about Current Document

DocumentMenu.prototype.duplicate = function () {
  return this.__prepend(this.doclist.duplicate(this.currentDocument));
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
    this.__refreshCurrent();
  }
  return status;
};

module.exports = DocumentMenu;
