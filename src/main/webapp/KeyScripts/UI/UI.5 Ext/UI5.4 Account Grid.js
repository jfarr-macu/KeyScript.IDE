Ext.onReady(function(){

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
          processPostingStatus(postingStatus);
        }
      }
    });
  }

  function processPostingStatus(postingStatus) {
    var products = [];
    if (postingStatus.account) {
      for (var ai = 0; ai < postingStatus.account.length; ai++) {
        var account = postingStatus.account[ai];
        if (account.share) {
          for (var si = 0; si < account.share.length; si++) {
            var share = account.share[si];
//            debugger;
            share.accountNumber = account.accountNumber;
            share.productType = 'S';
            products.push(share);
          }
        }
        if (account.loan) {
          for (var li = 0; li < account.loan.length; li++) {
            var loan = account.loan[li];
            loan.accountNumber = account.accountNumber;
            loan.productType = 'L';
            products.push(loan);
          }
        }
      }
    }
    store.loadData(products);
  }

  // create the data store
  var store = new Ext.data.JsonStore({
    fields: [
      { name: 'accountNumber' },
      { name: 'serial' },
      { name: 'productType' },
      { name: 'lastActivityDate' },
      { name: 'id' },
      { name: 'description' },
      { name: 'balance' },
      { name: 'minimumBalance' },
      { name: 'openDate' }
    ]
  });

  // create the Grid
  var grid = new CR.GridPanel({
    store: store,
    columns: [
      {
        header: 'Serial',
        dataIndex: 'serial',
        hidden: true
      },
      {
        header: 'Account',
        width: 60,
        sortable: true,
        dataIndex: 'accountNumber'
      },
      {
        header: 'S/L',
        width: 20,
        sortable: true,
        dataIndex: 'productType'
      },
      {
        header: 'ID',
        width: 60,
        sortable: true,
        dataIndex: 'id'
      },
      {
        header: 'Description',
        width: 160,
        sortable: true,
        dataIndex: 'description'
      },
      {
        header: 'Balance',
        width: 75,
        sortable: false,
        align: 'right',
        renderer: 'usMoney',
        dataIndex: 'balance'
      },
      {
        header: 'Min Balance',
        width: 75,
        sortable: true,
        align: 'right',
        renderer: CR.MoneyField.convertToDisplay,
        dataIndex: 'minimumBalance'
      },
      {
        header: 'Last Activity',
        width: 75,
        sortable: true,
        dataIndex: 'lastActivityDate',
        renderer: CR.DateField.convertToDisplay
      },
      {
        header: 'Open Date',
        width: 75,
        sortable: true,
        dataIndex: 'openDate',
        renderer: CR.DateField.convertToDisplay
      }
    ],
    stripeRows: true,
    autoExpandColumn: 'description',
    height: 350,
    width: 600,
    title: 'Account Grid'
  });

  grid.render(Ext.getBody());

  CR.Core.defer(function() {
    getPostingStatus();
  });
});