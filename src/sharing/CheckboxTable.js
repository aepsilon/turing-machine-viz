'use strict';

// var d3 = require('d3');
var $ = require('jquery'); // for event delegation

function identity(x) { return x; }
function head(array) { return array[0]; }

/**
 * A <table> that includes a checkbox in front of each row,
 * and a header checkbox to (de)select all rows.
 * @param {D3Selection<HTMLTableElement>} args.table empty table to use
 * @param {[string]}    [args.headers] column headers
 * @param {[[string]]}  [args.data]    table data
 */
function CheckboxTable(args) {
  this.table = args.table;
  this.headerRow = this.table.append('thead').append('tr');
  this.tbody = this.table.append('tbody');
  // header checkbox (selects/deselects all checkboxes)
  var self = this;
  this.headerCheckbox = this.headerRow
    .append('th')
      .attr('class', 'checkbox-cell')
    .append('input')
      .attr('type', 'checkbox')
      .on('click', /* @this checkbox */ function () {
        self.getCheckboxes().property('checked', this.checked);
        self.onChange();
      });
  $(this.tbody.node()).on('click', 'tr', /* @this tr */ function (e) {
    // treat whole <tr> as click zone
    if (e.target.tagName !== 'INPUT') {
      var box = this.querySelector('input[type="checkbox"]');
      box.checked = !box.checked;
    }
    // update header checkbox
    self.refresh();
    self.onChange();
  });
  // content
  args.headers && this.setHeaders(args.headers);
  args.data && this.setData(args.data);
}

/**
 * Set the column headers.
 * @param {[string]} headers
 */
CheckboxTable.prototype.setHeaders = function (headers) {
  var th = this.headerRow
    .selectAll('th:not(.checkbox-cell)')
      .data(headers);
  th.exit().remove();
  th.enter().append('th');
  th.text(identity);
};

/**
 * Set the table body data.
 *
 * Each row begins with a checkbox whose .value is the first cell.
 * Rows are keyed by the first cell when updating data.
 * @param {[[string]]} data
 * @return this
 */
CheckboxTable.prototype.setData = function (data) {
  var tr = this.tbody.selectAll('tr')
      .data(data, head);
  tr.exit().remove();
  tr.enter()
    .append('tr')
  // checkbox at the start of each row
    .append('td')
      .attr('class', 'checkbox-cell')
    .append('input')
      .attr({
        type: 'checkbox',
        value: head
      });
  tr.order();
  // row cells
  var td = tr.selectAll('td:not(.checkbox-cell)')
      .data(identity);
  td.exit().remove();
  td.enter().append('td');
  td.text(identity);

  return this;
};

CheckboxTable.prototype.getCheckboxes = function () {
  return this.tbody.selectAll('input[type="checkbox"]');
};

CheckboxTable.prototype.getCheckedValues = function () {
  return this.tbody.selectAll('input[type="checkbox"]:checked')[0]
    .map(function (x) { return x.value; });
};

CheckboxTable.prototype.isCheckedEmpty = function () {
  var headerBox = this.headerCheckbox.node();
  return !(headerBox.checked || headerBox.indeterminate);
};

/**
 * Refresh the header checkbox (called after a row checkbox is toggled).
 */
CheckboxTable.prototype.refresh = function () {
  var headerBox = this.headerCheckbox.node();
  var boxes = this.getCheckboxes();

  var total = boxes.size();
  var checked = boxes.filter(':checked').size();
  if (checked === 0) {
    headerBox.checked = false;
  } else if (checked === total) {
    headerBox.checked = true;
  }
  headerBox.indeterminate = (0 < checked && checked < total);
};

// configurable. called after a click toggles a row or header checkbox.
CheckboxTable.prototype.onChange = function () {
};

module.exports = CheckboxTable;
