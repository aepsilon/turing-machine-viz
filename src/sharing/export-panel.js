'use strict';

/* eslint-env browser */
var format = require('./format');
var createGist = require('./gist').createGist;
var Clipboard = require('clipboard');
var $ = require('jquery'); // for bootstrap tooltip

// https://github.com/Modernizr/Modernizr/blob/master/feature-detects/a/download.js
var canUseDownloadAttribute =
  !window.externalHost && 'download' in document.createElement('a');

// can copy to clipboard programmatically?
var canUseCopyCommand = (function () {
  try {
    return document.queryCommandSupported('copy');
  } catch (e) {
    return false;
  }
}());

// Add event handlers to select an HTMLInputElement's text on focus.
function addSelectOnFocus(element) {
  element.addEventListener('focus', function selectAll(e) {
    e.target.select();
  });
  // Safari workaround
  element.addEventListener('mouseup', function (e) {
    e.preventDefault();
  });
}

// Show a one-time tooltip.
// NB. an existing title attribute overrides the tooltip options.
function showTransientTooltip($element, options) {
  $element.tooltip(options)
    .tooltip('show')
    .one('hidden.bs.tooltip', function () {
      $element.tooltip('destroy');
    });
}

function showCopiedTooltip(element) {
  showTransientTooltip($(element), {title: 'Copied!', placement: 'bottom'});
}


///////////////////////
// Share with GitHub //
///////////////////////

/**
 * Generate a new gist and display a shareable link.
 * @param  {HTMLElement} container  Container to use for displaying the link.
 * @param  {HTMLButtonElement} button
 * @param  {string} filename
 * @param  {string} contents  The file contents.
 * @return {Promise}          Cancellable promise to create the gist.
 */
function generateGist(container, button, filename, contents) {
  var oldButtonText = button.textContent;
  button.textContent = 'Loading…';
  button.disabled = true;

  var payload = {
    files: {},
    description: 'Turing machine for http://turingmachine.io',
    public: true
  };
  payload.files[filename] = {content: contents};

  return createGist(payload).then(function (response) {
    // Show link on success
    var id = response.id;
    showGeneratedGist(container, 'http://turingmachine.io/?import-gist=' + id);
  }).catch(function (reason) {
    // Alert error on failure
    var message = (function () {
      var xhr = reason.xhr;
      try {
        return 'Response from GitHub: “' + xhr.responseJSON.message + '”';
      } catch (e) {
        if (xhr.status > 0) {
          return 'HTTP status code: ' + xhr.status + ' ' + xhr.statusText;
        } else {
          return 'GitHub could not be reached.\nYour Internet connection may be offline.';
        }
      }
    }());
    alert('Could not create new gist.\n\n' + message);

    button.disabled = false;
    button.textContent = oldButtonText;
  });
}

function showGeneratedGist(container, url) {
  container.innerHTML =
    '<input id="sharedPermalink" type="url" class="form-control" readonly>' +
    '<button type="button" class="btn btn-default" data-clipboard-target="#sharedPermalink">' +
    '<span class="glyphicon glyphicon-copy" aria-hidden="true"></span>' +
    '</button>';
  var urlInput = container.querySelector('input');
  urlInput.value = url;
  urlInput.size = url.length + 2;
  addSelectOnFocus(urlInput);
  urlInput.focus();
}

function createGenerateGistButton(container) {
  container.innerHTML =
  '<button type="button" class="btn btn-default">Create permalink</button>' +
  '<p class="help-block">This will create and link to a new' +
    ' <a href="https://help.github.com/articles/creating-gists/#creating-an-anonymous-gist"' +
    ' target="_blank">read-only</a> GitHub gist.' +
  '</p>';
  return container.querySelector('button');
}


///////////////////
// Download file //
///////////////////

// Create a link button if canUseDownloadAttribute, otherwise a link with instructions.
function createDownloadLink(filename, contents) {
  var link = document.createElement('a');
  link.href = 'data:text/x-yaml;charset=utf-8,' + encodeURIComponent(contents);
  link.target = '_blank';
  link.download = filename;

  if (canUseDownloadAttribute) {
    link.textContent = 'Download document';
    link.className = 'btn btn-primary';
    return link;
  } else {
    link.textContent = 'Right-click here and choose “Save target as…” or “Download Linked File As…”';
    var p = document.createElement('p');
    p.innerHTML = ', <br>then name the file to end with <code>.yaml</code>';
    p.insertBefore(link, p.firstChild);
    return p;
  }
}


////////////
// Common //
////////////

function init(args) {
  var $dialog = args.$dialog,
      getCurrentDocument = args.getCurrentDocument,
      getIsSynced = args.getIsSynced,
      gistContainer = args.gistContainer,
      downloadContainer = args.downloadContainer,
      textarea = args.textarea;

  if (canUseDownloadAttribute) {
    $dialog.addClass('download-attr');
  }
  if (!canUseCopyCommand) {
    $dialog.addClass('no-copycommand');
  }
  gistContainer.className = 'form-group form-inline';
  addSelectOnFocus(textarea);

  function setupDialog() {
    var doc = getCurrentDocument();
    var filename = doc.name + '.yaml';
    var contents = format.stringifyDocument(doc);
    var gistPromise;

    // warn about unsynced changes
    var $alert;
    if (!getIsSynced()) {
      $alert = $(
        '<div class="alert alert-warning" role="alert">' +
        'The code editor has <strong>unsynced changes</strong> and might not correspond with the diagram.<br>' +
        'Click <q>Load machine</q> to try to sync them. Otherwise, two sets of code will be exported.' +
        '</div>'
      ).prependTo($dialog.find('.modal-body'));
    }

    createGenerateGistButton(gistContainer).addEventListener('click', function (e) {
      gistPromise = generateGist(gistContainer, e.target, filename, contents);
    });

    // "Download document" button link
    downloadContainer.appendChild(createDownloadLink(filename, contents));
    // <textarea> for document contents
    textarea.value = contents;

    var clipboard = new Clipboard('[data-clipboard-target]');
    clipboard.on('success', function (e) {
      showCopiedTooltip(e.trigger);
      e.clearSelection();
    });

    // return cleanup function
    return function () {
      if (gistPromise) {
        try { gistPromise.cancel(); } catch (e) {/* */}
      }
      if ($alert) { $alert.remove(); }
      gistContainer.textContent = '';
      downloadContainer.textContent = '';
      textarea.value = '';
      clipboard.destroy();
    };
  }

  $dialog.on('show.bs.modal', function () {
    var cleanup = setupDialog();
    $dialog.one('hidden.bs.modal', cleanup);
  });
  $dialog.on('shown.bs.modal', function () {
    // workaround "Copy to clipboard" .focus() scrolling down to <textarea>
    // note: doesn't work when <textarea> is completely out of view
    textarea.setSelectionRange(0,0);
  });
}

exports.init = init;
