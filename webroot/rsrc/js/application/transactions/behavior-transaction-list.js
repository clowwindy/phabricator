/**
 * @provides javelin-behavior-phabricator-transaction-list
 * @requires javelin-behavior
 *           javelin-stratcom
 *           javelin-workflow
 *           javelin-dom
 *           javelin-fx
 *           javelin-util
 */

JX.behavior('phabricator-transaction-list', function(config) {

  var list = JX.$(config.listID);
  var xaction_nodes = null;
  var next_anchor = config.nextAnchor;

  function get_xaction_nodes() {
    if (xaction_nodes === null) {
      xaction_nodes = {};
      var xactions = JX.DOM.scry(list, 'div', 'transaction');
      for (var ii = 0; ii < xactions.length; ii++) {
        xaction_nodes[JX.Stratcom.getData(xactions[ii]).phid] = xactions[ii];
      }
    }
    return xaction_nodes;
  }

  function ontransactions(response) {
    var fade_in = [];
    var first_new = null;

    var nodes = get_xaction_nodes();
    for (var phid in response.xactions) {
      var new_node = JX.$H(response.xactions[phid]).getFragment().firstChild;
      fade_in.push(new_node);

      if (nodes[phid]) {
        JX.DOM.replace(nodes[phid], new_node);
      } else {
        if (first_new === null) {
          first_new = new_node;
        }
        list.appendChild(new_node);

        // Add a spacer after new transactions.
        var spacer = JX.$H(response.spacer).getFragment().firstChild;
        list.appendChild(spacer);
        fade_in.push(spacer);

        next_anchor++;
      }
      nodes[phid] = new_node;
    }

    // Scroll to the first new transaction, if transactions were added.
    if (first_new) {
      JX.DOM.scrollTo(first_new);
    }

    // Make any new or updated transactions fade in.
    for (var ii = 0; ii < fade_in.length; ii++) {
      new JX.FX(fade_in[ii]).setDuration(500).start({opacity: [0, 1]});
    }
  }

  function edittransaction(transaction, response) {
    // NOTE: this is for 1 transaction only
    for (var phid in response.xactions) {
      var new_node = JX.$H(response.xactions[phid]).getFragment().firstChild;
      var new_comment = JX.DOM.find(new_node, 'span', 'transaction-comment');
      var old_comments = JX.DOM.scry(
        transaction,
        'span',
        'transaction-comment');
      var old_comment = old_comments[0];
      JX.DOM.replace(old_comment, new_comment);
      var edit_history = JX.DOM.scry(
          transaction,
          'a',
          'transaction-edit-history');
      if (!edit_history.length) {
        var transaction_phid = JX.Stratcom.getData(new_comment).phid;
        var history_link = JX.$N(
          'a',
          { sigil : 'transaction-edit-history',
            href  : config.historyLink + transaction_phid + '/' },
          config.historyLinkText);
        JX.Stratcom.addSigil(history_link, 'workflow');
        var timeline_extra = JX.DOM.find(transaction, 'span', 'timeline-extra');
        var old_content = JX.$H(timeline_extra.innerHTML);
        JX.DOM.setContent(
          timeline_extra,
          [history_link, config.linkDelimiter, old_content]);
      }
      new JX.FX(transaction).setDuration(500).start({opacity: [0, 1]});
    }
  }

  JX.DOM.listen(list, 'click', 'transaction-edit', function(e) {
    if (!e.isNormalClick()) {
      return;
    }

    var transaction = e.getNode('transaction');

    JX.Workflow.newFromLink(e.getTarget())
      .setData({anchor: e.getNodeData('transaction').anchor})
      .setHandler(JX.bind(null, edittransaction, transaction))
      .start();

    e.kill();
  });

  JX.Stratcom.listen(
    ['submit', 'didSyntheticSubmit'],
    'transaction-append',
    function(e) {
      var form = e.getTarget();
      if (JX.Stratcom.getData(form).objectPHID != config.objectPHID) {
        // This indicates there are several forms on the page, and the user
        // submitted a different one than the one we're in control of.
        return;
      }

      e.kill();

      JX.DOM.invoke(form, 'willSubmit');

      JX.Workflow.newFromForm(form, { anchor : next_anchor })
        .setHandler(function(response) {
          ontransactions(response);

          var e = JX.DOM.invoke(form, 'willClear');
          if (!e.getPrevented()) {
            var ii;
            var textareas = JX.DOM.scry(form, 'textarea');
            for (ii = 0; ii < textareas.length; ii++) {
              textareas[ii].value = '';
            }

            var inputs = JX.DOM.scry(form, 'input');
            for (ii = 0; ii < inputs.length; ii++) {
            switch (inputs[ii].type) {
              case 'password':
              case 'text':
                inputs[ii].value = '';
                break;
              case 'checkbox':
              case 'radio':
                inputs[ii].checked = false;
                break;
              }
            }

            var selects = JX.DOM.scry(form, 'select');
            var jj;
            for (ii = 0; ii < selects.length; ii++) {
              if (selects[ii].type == 'select-one') {
                selects[ii].selectedIndex = 0;
              } else {
               for (jj = 0; jj < selects[ii].options.length; jj++) {
                 selects[ii].options[jj].selected = false;
               }
              }
            }
          }
        })
        .start();

    });
});