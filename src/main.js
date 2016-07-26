// main entry point for index.html.
// important: make sure to coordinate variables and elements between the HTML and JS
'use strict';

/* eslint-env browser */
var TMDocumentController = require('./TMDocumentController'),
    DocumentMenu = require('./DocumentMenu'),
    examples = require('./examples'),
    toDocFragment = require('./util').toDocFragment;
var ace = require('ace-builds/src-min-noconflict');
var $ = require('jquery'); // for Bootstrap modal dialog events

// load up front so going offline doesn't break anything
// (for snippet placeholders, used by "New blank document")
ace.config.loadModule('ace/ext/language_tools');

function getId(id) { return document.getElementById(id); }

function addAlertPane(type, html) {
  getId('diagram-column').insertAdjacentHTML('afterbegin',
    '<div class="alert alert-'+type+' alert-dismissible" role="alert">' +
    '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">×</span></button>' +
    html +
    '</div>');
}


//////////////////////////
// Compatibility Checks //
//////////////////////////

(function () {
  // Warn when falling back to RAM-only storage
  // NB. This mainly covers local storage errors and Safari's Private Browsing.
  if (!require('./storage').canUseLocalStorage) {
    addAlertPane('info', '<p>Local storage is unavailable. ' +
      'Your browser could be in Private Browsing mode, or it might not support <a href="http://caniuse.com/#feat=namevalue-storage" target="_blank">local storage</a>.</p>' +
      '<strong>Any changes will be lost after leaving the webpage.</strong>');
  }

  /*
  Warn for IE 10 and under, which misbehave and lack certain features.
  Examples:
    • IE 9 and under don't support .classList.
    • IE 10's "storage event is fired even on the originating document where it occurred."
      http://caniuse.com/#feat=namevalue-storage
  */

  // Detect IE 10 and under (http://stackoverflow.com/a/16135889)
  var isIEUnder11 = new Function('/*@cc_on return @_jscript_version; @*/')() < 11;
  if (isIEUnder11) {
    addAlertPane('warning',
      '<p><strong>Your <a href="http://whatbrowser.org" target="_blank">web browser</a> is out of date</strong> and does not support some features used by this program.<br>' +
      '<em>The page may not work correctly, and data may be lost.</em></p>' +
      'Please update your browser, or use another browser such as <a href="http://www.google.com/chrome/browser/" target="_blank">Chrome</a> or <a href="http://getfirefox.com" target="_blank">Firefox</a>.');
  }

  // Warn about iOS local storage volatility
  $(function () {
    // Detect iOS (http://stackoverflow.com/a/9039885)
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      getId('misc-tips-list').insertAdjacentHTML('afterbegin',
        '<li><strong class="text-warning">Important note for iOS</strong>: ' +
        'iOS saves browser local storage in the cache folder, which is <strong>not backed up</strong>, and is ' +
        '<q cite="https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API#Browser_compatibility"><strong>subject to occasional clean up</strong>, ' +
        'at the behest of the OS, typically if space is short.</q></li>');
    }
  });
}());


/////////////////////
// Import & Export //
/////////////////////

function importDocument(obj) {
  // duplicate data into the menu, then open it.
  menu.duplicate(obj, {select: true, type: 'open'});
}

$(function () {
  // Enable buttons now that handlers are ready
  $('.tm-needsready').prop('disabled', false);

  // Run import from URL query (if any)
  var importArgs = {
    dialogNode: getId('importDialog'),
    importDocument: importDocument
  };
  require('./sharing/import').runImport(importArgs);
  // Init import dialog
  var $importPanel = $('#importPanel');
  $importPanel.one('show.bs.modal', function () {
    require('./sharing/import-panel').init({
      $dialog: $importPanel,
      gistIDForm: getId('gistIDForm'),
      importArgs: importArgs
    });
  });
  // Init export dialog
  var exportPanel = getId('exportPanel');
  require('./sharing/export-panel').init({
    $dialog: $(exportPanel),
    getCurrentDocument: function () {
      controller.save(); // IMPORTANT: save changes, otherwise data model is out of date
      return menu.currentDocument;
    },
    getIsSynced: controller.getIsSynced.bind(controller),
    gistContainer: getId('shareGistContainer'),
    downloadContainer: getId('exportDownloadContainer'),
    copyContentsButton: getId('copyContentsButton'),
    textarea: exportPanel.querySelector('textarea')
  });
});


///////////////////
// Document List //
///////////////////

var menu = (function () {
  var select = document.getElementById('tm-doc-menu');
  // Group: Documents
  var docGroup = document.createElement('optgroup');
  docGroup.label = 'Documents';
  select.appendChild(docGroup);
  // Group: Examples
  var exampleGroup = document.createElement('optgroup');
  exampleGroup.label = 'Examples';
  exampleGroup.appendChild(toDocFragment(examples.list.map(
    DocumentMenu.prototype.optionFromDocument)));
  select.appendChild(exampleGroup);

  return new DocumentMenu({
    menu: select,
    group: docGroup,
    storagePrefix: 'tm.docs',
    firsttimeDocID: examples.firsttimeDocID
  });
})();


/////////////////
// "Edit" Menu //
/////////////////

(function () {
  menu.onChange = function (doc, opts) {
    switch (opts && opts.type) {
      case 'duplicate':
        controller.setBackingDocument(doc);
        break;
      case 'delete':
        controller.forceLoadDocument(doc);
        break;
      default:
        controller.openDocument(doc);
    }
    refreshEditMenu();
  };

  // Refresh the "Edit" menu items depending on document vs. example.
  var refreshEditMenu = (function () {
    var renameLink = document.querySelector('[data-target="#renameDialog"]');
    var deleteLink = document.querySelector('[data-target="#deleteDialog"]');
    var wasExample;
    function renameExample() {
      // duplicate, then rename the duplicate.
      // how it works: switch to duplicate document ->
      //   refreshEditMenu() enables rename dialog -> event bubbles up -> dialog opens.
      // this might be the simplest way; Event.stopPropagation leaves the dropdown hanging.
      duplicateDocument();
    }

    return function () {
      var isExample = menu.currentDocument.isExample;
      if (wasExample !== isExample) {
        if (!isExample) {
          renameLink.textContent = 'Rename…';
          renameLink.removeEventListener('click', renameExample);
          renameLink.setAttribute('data-toggle', 'modal');
          deleteLink.textContent = 'Delete…';
          deleteLink.setAttribute('data-target', '#deleteDialog');
        } else {
          renameLink.textContent = 'Rename a copy…';
          renameLink.addEventListener('click', renameExample);
          renameLink.removeAttribute('data-toggle');
          deleteLink.textContent = 'Reset this example…';
          deleteLink.setAttribute('data-target', '#resetExampleDialog');
        }
        wasExample = isExample;
      }
    };
  }());
  refreshEditMenu();

  // only swap out the storage backing; don't affect views or undo history
  function duplicateDocument() {
    controller.save();
    menu.duplicate(menu.currentDocument, {select: true});
  }

  function newBlankDocument() {
    menu.newDocument({select: true});
    // load up starter template
    if (controller.editor.insertSnippet) { // async loaded
      controller.editor.insertSnippet(examples.blankTemplate);
      controller.loadEditorSource();
    }
  }

  var $renameDialog = $(getId('renameDialog'));
  [{id: 'tm-doc-action-duplicate', callback: duplicateDocument},
  {id: 'tm-doc-action-newblank', callback: newBlankDocument}
  ].forEach(function (item) {
    document.getElementById(item.id).addEventListener('click', function (e) {
      e.preventDefault();
      item.callback(e);

      $renameDialog.modal({keyboard: false})
        .one('hidden.bs.modal', function () {
          controller.editor.focus();
        });
    });
  });
}());


/////////////
// Dialogs //
/////////////

(function () {
  // Rename
  var $renameDialog = $(getId('renameDialog'));
  var renameBox = getId('renameDialogInput');
  $renameDialog
    .on('show.bs.modal', function () {
      renameBox.value = menu.currentOption.text;
    })
    .on('shown.bs.modal', function () {
      renameBox.select();
    })
    // NB. remember data-keyboard="false" on the triggering element,
    // to prevent closing with Esc and causing a save.
    // remark: an exception thrown on 'hide' prevents the dialog from closing,
    // so save during 'hidden' instead.
    .on('hidden.bs.modal', function () {
      var newName = renameBox.value;
      if (menu.currentOption.text !== newName) {
        menu.rename(newName);
      }
      renameBox.value = '';
    });
  document.getElementById('renameDialogForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $renameDialog.modal('hide');
  });

  // Delete
  function deleteDocument() {
    menu.delete();
  }
  document.getElementById('tm-doc-action-delete').addEventListener('click', deleteDocument);

  // Reset Example
  function discardReset() {
    menu.delete();
    // load manually since example stays and selection doesn't change
    controller.forceLoadDocument(menu.currentDocument);
  }
  function saveReset() {
    menu.duplicate(menu.currentDocument, {select: false});
    discardReset();
  }
  document.getElementById('tm-doc-action-resetdiscard').addEventListener('click', discardReset);
  document.getElementById('tm-doc-action-resetsave').addEventListener('click', saveReset);
}());

////////////////
// Controller //
////////////////

var controller = (function () {
  function getButton(container, type) {
    return container.querySelector('button.tm-' + type);
  }
  var editor = document.getElementById('editor-container');
  // button containers
  var sim = document.getElementById('controls-container');
  var ed = editor.parentNode;

  return new TMDocumentController({
    simulator: document.getElementById('machine-container'),
    editorAlerts: document.getElementById('editor-alerts-container'),
    editor: editor
  }, {
    simulator: {
      run: getButton(sim, 'run'),
      step: getButton(sim, 'step'),
      reset: getButton(sim, 'reset')
    },
    editor: {
      load: getButton(ed, 'editor-load'),
      revert: getButton(ed, 'editor-revert')
    }
  }, menu.currentDocument);
}());

controller.editor.setTheme('ace/theme/chrome');
controller.editor.commands.addCommand({
  name: 'save',
  bindKey: { mac: 'Cmd-S', win: 'Ctrl-S' },
  exec: function () {
    controller.loadEditorSource();
  }
});
controller.editor.session.setUseWrapMode(true);
$(function () {
  try {
    require('./kbdshortcuts').main(controller.editor.commands,
      getId('kbdShortcutTable')
    );
  } catch (e) {
    /* */
  }
});

window.addEventListener('beforeunload', function (ev) {
  try {
    controller.save();
    menu.saveCurrentDocID();
  } catch (error) {
    addAlertPane('warning',
      '<h4>The current document could not be saved.</h4>'+
      '<p>It’s likely that the <a href="https://en.wikipedia.org/wiki/Web_storage#Storage_size" target="_blank">local storage quota</a> was exceeded. ' +
      'Try downloading a copy of this document, then deleting other documents to make space.</p>');
    return (ev || window.event).returnValue =
      'There is not enough space left to save the current document.';
  }
});

// Keep the current document in sync across tabs/windows
window.addEventListener('blur', function () {
  // One tab saves the data...
  controller.save();
});
(function () {
  // ...and the other tab loads it.
  var isReloading = false;
  require('./TMDocument').addOutsideChangeListener(function (docID, prop) {
    if (docID === controller.getDocument().id && prop !== 'name' && !isReloading) {
      // Batch together property changes into one reload
      isReloading = true;
      setTimeout(function () {
        isReloading = false;
        // Preserve undo history
        controller.forceLoadDocument(controller.getDocument(), true);

      }, 100);
    }
  });
}());

// For interaction/debugging
exports.controller = controller;
