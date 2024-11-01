console.clear();
console.info('UI.2.1 Inquiry.js');

var centerPanel = new CR.Panel({
  region: 'center',
  html: 'Result Panel'
});

CR.Core.viewPort = new Ext.Viewport({
  layout: 'border',
  items: [ centerPanel ],
  listeners: {
    render: function() {
      getPostingStatus();
    }
  }
});

function getPostingStatus() {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(),'sequence');
  var transaction = xml.addContainer(sequence,'transaction');
  var step = xml.addContainer(transaction,'step');
  var postingStatus = xml.addContainer(step,'postingStatus');
  xml.addText(postingStatus, 'tableName', 'PERSON');
  xml.addText(postingStatus, 'targetSerial', CR.Script.personSerial);

  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    success: function(response) {
      var responseJson = CR.JSON.parse(response.responseText);
      var tranResult = 'failed';
      var errorArray = [];
      var query = responseJson.query;
      if (query) {
        var sequence = query.sequence;
        if (sequence){
          for (var i = 0; i < sequence.length; i++) {
            var transaction = sequence[i].transaction;
            if (transaction) {
              for (var j = 0; j < transaction.length; j++) {
                tranResult = transaction[j].$attr.result;
                var postingDate = transaction[j].postingDate;
                var step = transaction[j].step;
                if (step){
                  for (var k = 0; k < step.length; k++) {
                    if (step[k].tranResult &&
                      step[k].tranResult.category &&
                      step[k].tranResult.category.option &&
                      step[k].tranResult.category.option === 'E') {
                      errorArray.push(
                        step[k].tranResult.description);
                    } else if (step[k].postingStatus) {
                      postingStatus = step[k].postingStatus;
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (tranResult !== 'posted'){
        CR.Core.displayExceptions({
          items: errorArray
        });
      } else {
        displayPostingStatus(postingStatus);
      }
    }
  });
}

function displayPostingStatus(postingStatus) {
  var html = '';
  var person = postingStatus.person;
  html += '<h1>' + person.rowDescription + '</h1>';
  html += '<h2>Accounts</h2>';
  if (postingStatus.account) {
    for (var ai = 0; ai < postingStatus.account.length; ai++) {
      var account = postingStatus.account[ai];
      html += '<h3>Account ' + account.accountNumber + '</h3>';
      if (account.share) {
        for (var si = 0; si < account.share.length; si++) {
          var share = account.share[si];
          html += '<p>Share ' + share.id + ' ' + share.description + '</p>';
        }
      }
      if (account.loan) {
        for (var li = 0; li < account.loan.length; li++) {
          var loan = account.loan[li];
          html += '<p>Loan ' + loan.id + ' ' + loan.description + '</p>';
        }
      }
    }
  }
  centerPanel.body.update(html);
}

function displayPostingStatus2(postingStatus) {
  var html = '';
  var person = postingStatus.person;
  html += '<h1>' + person.rowDescription + '</h1>';
  html += '<h2>Accounts</h2>';
  Ext.each(postingStatus.account, function(account) {
    html += '<h3>Account ' + account.accountNumber + '</h3>';
    Ext.each(account.share, function(share) {
      html += '<p>Share ' + share.id + ' ' + share.description + '</p>';
    });
    Ext.each(account.loan, function(loan) {
      html += '<p>Loan ' + loan.id + ' ' + loan.description + '</p>';
    });
  });
  centerPanel.body.update(html);
}