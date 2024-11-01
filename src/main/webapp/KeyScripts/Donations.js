// Donation script
// - prompts the user to select a share
// - transfers donation amount up to available share balance to donation GL
// - produces form to print
// - update custom table CU_PERSON_CMN with donation totals

var scriptScope = this;

var donationGLAccountNumber = '080104.0000.0000';
var donationRecipientName = 'Children\'s Miracle Network';
var donationDescription = donationRecipientName + ' Donation';
var postingMode = 'P';

var debug = false;
if (debug) {
  donationGLAccountNumber = '000001.0000.0000';
  postingMode = 'V';
}

var person = null;
var address = null;
var statementInquiryResult = null;
var cuPersonCMNSearch = null;
var cuPersonCMNRecords = [];
var currentCuPersonCMNRecord = null;
var donationYear = null;

function getInitData() {
  donationYear = '' + CR.DateField.convertToJavaScript(CR.Login.postingDate).getFullYear();

  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');

  var step = xml.addContainer(transaction, 'step');
  var statementInquiry = xml.addContainer(step, 'statementInquiry');
  xml.addText(statementInquiry, 'personSerial', CR.Script.personSerial);
  xml.addText(statementInquiry, 'beginningDate', CR.Login.postingDate);
  xml.addText(statementInquiry, 'endingDate', CR.Login.postingDate);

  step = xml.addContainer(transaction, 'step');
  var search = xml.addContainer(step, 'search');
  xml.addText(search, 'tableName', 'CU_PERSON_CMN');
  xml.addText(search, 'filterName', 'BY_PARENT_SERIAL');
  xml.addOption(search, 'includeSelectColumns', 'Y');
  xml.addOption(search, 'includeTotalHitCount', 'Y');
  xml.addCount(search, 'returnLimit', '1000');
  var parameter = xml.addContainer(search, 'parameter');
  xml.addText(parameter, 'columnName', 'PARENT_SERIAL');
  xml.addText(parameter, 'contents', CR.Script.personSerial);

  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    scope: scriptScope,
    success: function (response) {
      var responseJson = CR.JSON.parse(response.responseText);
      var tranResult = 'failed';
      var errorArray = [];
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            this.postingDate = transaction.postingDate;
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.statementInquiry) {
                statementInquiryResult = step.statementInquiry;
              } else if (step.search) {
                cuPersonCMNSearch = step.search;
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' && tranResult !== 'verified') {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        processStatement.call(this, statementInquiryResult);
        if (cuPersonCMNSearch.resultRow) {
          loadPersonDonationRecords.call(this, cuPersonCMNSearch);
        }
      }
    }
  });
}

function loadPersonDonationRecords(search) {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  Ext.each(search.resultRow, function (resultRow) {
    var step = xml.addContainer(transaction, 'step');
    var record = xml.addContainer(step, 'record');
    xml.addText(record, 'tableName', 'CU_PERSON_CMN');
    xml.addOption(record, 'operation', 'V');
    xml.addText(record, 'targetSerial', resultRow.serial);
    xml.addOption(record, 'includeTableMetadata', 'N');
    xml.addOption(record, 'includeColumnMetadata', 'N');
    xml.addOption(record, 'includeRowDescriptions', 'Y');
    xml.addOption(record, 'includeAllColumns', 'Y');
  });
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    scope: scriptScope,
    success: function (response) {
      var responseJson = CR.JSON.parse(response.responseText);
      var tranResult = 'failed';
      var errorArray = [];
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            this.postingDate = transaction.postingDate;
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.record) {
                var flatRecord = { record: step.record };
                Ext.each(step.record.field, function (field) {
                  flatRecord[field.columnName] = field.newContents || '';
                  if (field.newContentsDescription) {
                    flatRecord[field.columnName + '_DESCRIPTION'] = field.newContentsDescription;
                  }
                });
                if (flatRecord['TAX_YEAR'] === donationYear) {
                  currentCuPersonCMNRecord = flatRecord;
                }
                cuPersonCMNRecords.push(flatRecord);
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' && tranResult !== 'verified') {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        updatePersonPanel.call(this);
      }
    }
  });
}

function updatePersonPanel() {

  var personInfoTemplate = new Ext.XTemplate([
    '<style scoped>',
    ".datagrid th { color: #000000; font-size: 11px;font-weight: bold; padding: 0 15px 0 0; } ",
    ".datagrid td { color: #00496B; font-size: 11px;font-weight: normal; padding: 0 15px 0 0; } ",
    '</style>',
    '<h1>Member: ' + person.fullName + '</h1>',
    '<br/>',
    '<h1>Previous Donations</h1>',
    '<table class="datagrid">',
    ' <thead>',
    '  <tr>',
    '   <th>Tax Year</th>',
    '   <th>Charity</th>',
    '   <th>Last Donation</th>',
    '   <th>Last Amount</th>',
    '   <th>YTD Total</th>',
    '  </tr>',
    ' </thead>',
    ' <tbody>',
    '  <tpl if="!cuPersonCMNRecords">',
    '   <tr class="even"><td colspan="99">Loading...</td></tr>',
    '  </tpl>',
    '  <tpl if="cuPersonCMNRecords && cuPersonCMNRecords.length === 0">',
    '   <tr class="even"><td colspan="99">No previous donations recorded</td></tr>',
    '  </tpl>',
    '  <tpl if="cuPersonCMNRecords && cuPersonCMNRecords.length &gt; 0">',
    '   <tpl for="cuPersonCMNRecords">',
    '    <tr class="{[xindex % 2 === 0 ? "even" : "odd"]}">',
    '     <td>{[values.TAX_YEAR]}</td>',
    '     <td>Children\'s Miracle Network</td>',
    '     <td>{[CR.DateField.convertToDisplay(values.LAST_CONTRIB_DATE)]}</td>',
    '     <td style="text-align:right">{[CR.MoneyField.convertToDisplay(values.LAST_CONTRIB_AMOUNT)]}</td>',
    '     <td style="text-align:right">{[CR.MoneyField.convertToDisplay(values.CONTRIB_YTD)]}</td>',
    '    </tr>',
    '   </tpl>',
    '  </tpl>',
    ' </tbody>',
    '</table>',
    '<br/>',
    '<p>Select a Share for the donation</p>'
  ]);

  var html = personInfoTemplate.apply({
    cuPersonCMNRecords: cuPersonCMNRecords
  });
  personPanel.body.update(html);
}

function processStatement(statementInquiry) {
  var products = [];
  Ext.each(statementInquiry.envelope, function (envelope) {
    address = envelope.address;
    person = envelope.person[0];
    person.fullName = person.lastName;
    if (person.firstName) {
      person.fullName += ', ' + person.firstName;
      if (person.middleName) {
        person.fullName += ' ' + person.middleName;
      }
      if (person.suffix) {
        person.fullName += ' ' + person.suffix;
      }
      //if (person.title) {
      //  person.fullName = person.title + ' ' + person.fullName;
      //}
    }
    updatePersonPanel.call(this);
    //personPanel.body.update('<h1>Member: ' + person.fullName + '</h1><br/><p>Select a Share for the donation</p>');
    Ext.each(envelope.statement, function (statement) {
      Ext.each(statement.account, function (account) {
        Ext.each(account.subAccount, function (subAccount) {
          if (subAccount.share) {
            var share = subAccount.share;
            share.accountNumber = account.accountNumber;
            share.productType = 'S';
            share.balance = share.ending.balance;
            products.push(share);
          }
        });
      });
    });
  });
  shareStore.loadData(products);
}

function confirmPost() {
  var selectedShare = shareSelectionModel.getSelected();
  var amountField = formPanel.find('crColumnName', 'amount').shift();
  var donationAmount = amountField.crGetNewContents();
  var closeShareField = formPanel.find('crColumnName', 'closeShare').shift();
  var closeShare = closeShareField.crGetNewContents() === 'Y';

  if (!selectedShare) {
    CR.Core.displayExceptions({ items: ['You must select a Share'] });
  } else if (donationAmount === '0.00' || parseFloat(donationAmount) > parseFloat(selectedShare.data.balance)) {
    CR.Core.displayExceptions({ items: ['Invalid donation amount'] });
  } else {
    var confirmTemplate = new Ext.XTemplate([
      '<p>Are you sure you want make a donation of <b>{amount}</b> ',
      '<br/>from the share <b>{share}</b>',
      '<br/>to the <b>' + donationRecipientName + '</b>?</p>',
      closeShare ? '<br/><p>Warning, this transaction will also close the share.</p>' : ''
    ]);
    var promptMessage = 'Are you sure you want make this donation?<table><tr><td>hello</td></tr></table>';

    promptMessage = confirmTemplate.apply({
      amount: CR.MoneyField.convertToDisplay(donationAmount),
      share: selectedShare.data.accountNumber + ' S ' + selectedShare.data.id + ' ' + selectedShare.data.description
    });
    Ext.MessageBox.show({
      title: 'Confirm Donation',
      msg: promptMessage,
      icon: Ext.MessageBox.INFO,
      buttons: Ext.MessageBox.OKCANCEL,
      scope: scriptScope,
      fn: function (button) {
        if (button === 'ok') {
          doPost.call(this);
        }
      }
    });
  }
}

function doPost() {
  var selectedShare = shareSelectionModel.getSelected();
  var amountField = formPanel.find('crColumnName', 'amount').shift();
  var donationAmount = amountField.crGetNewContents();

  var closeShareField = formPanel.find('crColumnName', 'closeShare').shift();
  var closeShare = closeShareField.crGetNewContents() === 'Y';

  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');

  xml.addOption(transaction, 'postingMode', postingMode);

  var step = xml.addContainer(transaction, 'step');
  var postingRequest = xml.addContainer(step, 'postingRequest');
  xml.addOption(postingRequest, 'category', 'W');
  xml.addText(postingRequest, 'targetSerial', selectedShare.data.serial);
  xml.addText(postingRequest, 'amount', donationAmount);
  xml.addText(postingRequest, 'description', donationDescription);

  step = xml.addContainer(transaction, 'step');
  postingRequest = xml.addContainer(step, 'postingRequest');
  xml.addOption(postingRequest, 'category', 'G');
  xml.addOption(postingRequest, 'targetGLCategory', 'DG');
  xml.addText(postingRequest, 'targetGLAccountNumber', donationGLAccountNumber);
  xml.addText(postingRequest, 'targetGLComment', donationDescription);
  //xml.addText(postingRequest, 'targetGLReference', 'Donation GL Reference');
  xml.addOption(postingRequest, 'targetGLEntryType', 'C');
  xml.addText(postingRequest, 'amount', donationAmount);

  if (closeShare) {
    step = xml.addContainer(transaction, 'step');
    var record = xml.addContainer(step, 'record');
    xml.addOption(record, 'operation', 'U');
    xml.addOption(record, 'includeRowDescriptions', 'Y');
    xml.addText(record, 'tableName', 'SHARE');
    xml.addText(record, 'targetSerial', selectedShare.data.serial);
    var field = xml.addContainer(record, 'field');
    xml.addText(field, 'columnName', 'CLOSE_DATE');
    xml.addOption(field, 'operation', 'S');
    xml.addText(field, 'newContents', CR.Login.postingDate);
  }

  step = xml.addContainer(transaction, 'step');
  record = xml.addContainer(step, 'record');
  xml.addText(record, 'tableName', 'CU_PERSON_CMN');
  if (currentCuPersonCMNRecord) {
    xml.addOption(record, 'operation', 'U');
    xml.addSerial(record, 'targetSerial', currentCuPersonCMNRecord['SERIAL']);
    var currentContributionsYTD = currentCuPersonCMNRecord['CONTRIB_YTD'] || '0.00';
    field = xml.addContainer(record, 'field');
    xml.addText(field, 'columnName', 'CONTRIB_YTD');
    xml.addOption(field, 'operation', 'S');
    xml.addText(field, 'newContents', CR.Core.addMoneyValues(currentContributionsYTD, donationAmount));
  } else {
    xml.addOption(record, 'operation', 'I');
    xml.addText(record, 'targetParentSerial', CR.Script.personSerial);
    field = xml.addContainer(record, 'field');
    xml.addText(field, 'columnName', 'TAX_YEAR');
    xml.addOption(field, 'operation', 'S');
    xml.addText(field, 'newContents', donationYear);
    field = xml.addContainer(record, 'field');
    xml.addText(field, 'columnName', 'CONTRIB_YTD');
    xml.addOption(field, 'operation', 'S');
    xml.addText(field, 'newContents', donationAmount);
  }
  field = xml.addContainer(record, 'field');
  xml.addText(field, 'columnName', 'LAST_CONTRIB_DATE');
  xml.addOption(field, 'operation', 'S');
  xml.addText(field, 'newContents', CR.Login.postingDate);
  field = xml.addContainer(record, 'field');
  xml.addText(field, 'columnName', 'LAST_CONTRIB_AMOUNT');
  xml.addOption(field, 'operation', 'S');
  xml.addText(field, 'newContents', donationAmount);

  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    scope: scriptScope,
    success: function (response) {
      var responseJson = CR.JSON.parse(response.responseText);
      var tranResult = 'failed';
      var errorArray = [];
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' && tranResult !== 'verified') {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        displayDocument.call(this, query);

        var responseMessage = {
          refreshComponents: true,
          closeScriptPanel: true,
          scriptPanelId: CR.Script.scriptDefaultPanelId
        };
        parent.postMessage(responseMessage, window.location.href);
      }
    }
  });
}

function displayDocument(query) {

  var selectedShare = shareSelectionModel.getSelected();

  var scriptTagName = 'script';
  var documentTemplate = new Ext.XTemplate([
    '<html>',
    '  <head>',
    '    <meta http-equiv=Content-Type content="text/html; charset=windows-1252">',
    '    <title>Corelation Inc.</title>',
    '    <' + scriptTagName + ' type="text/javascript">',
    '      function crOnLoadFunctions() {',
    '        window.print();',
    '      }',
    '    </' + scriptTagName + '>',
    '  </head>',
    '  <body onload="javascript:crOnLoadFunctions();">',
    '    <div style="width:200px;margin:auto">',
    '      <img alt="" src="data:image/png;base64,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" />',
    '    </div>',
    '    <h3 style="text-align:center">',
    '      Thank you for your donation of {amount} to the<br/> ' + donationRecipientName + '<br/> on {date}',
    '    </h3>',
    '    <h3>{name}</h3>',
    '    <p>{addressLine1}<br/>',
    '    {addressLine2}</p>',
    '    <p>Donations may be tax deductible. Please consult your tax professional.</p>',
    '  </body>',
    '</html>'
  ]);

  var addressLine1 = '';
  var addressLine2 = '';
  if (address && address.street) {
    addressLine1 = address.street;
    if (address.city) {
      addressLine2 += address.city;
    }
    if (address.state) {
      if (address.city) {
        addressLine2 += ', ';
      }
      addressLine2 += address.state;
    }
    if (address.postalCode) {
      addressLine2 += ' ' + address.postalCode;
    }
  }
  var amountField = formPanel.find('crColumnName', 'amount').shift();

  var contents = documentTemplate.apply({
    amount: CR.MoneyField.convertToDisplay(amountField.crGetNewContents()),
    share: selectedShare.data.accountNumber + ' S ' + selectedShare.data.id + ' ' + selectedShare.data.description,
    name: person.fullName,
    date: CR.DateField.convertToDisplay(CR.Login.postingDate),
    addressLine1: addressLine1,
    addressLine2: addressLine2
  });
  var printWindow = window.open('', 'donationPrint', 'width=600,height=450,scrollbars=1,location=0,status=0,menubar=1,resizable=1');
  printWindow.document.write(contents);
  printWindow.document.close();
}

var shareStore = new Ext.data.JsonStore({
  fields: [
    { name: 'accountNumber' },
    { name: 'serial' },
    { name: 'productType' },
    { name: 'id' },
    { name: 'description' },
    { name: 'balance' },
    { name: 'openDate' }
  ]
});

var shareSelectionModel = new Ext.grid.CheckboxSelectionModel({
  checkOnly: false,
  singleSelect: true
});

shareSelectionModel.on('selectionchange', function (selectionModel) {
  var record = selectionModel.getSelected();
  var accountField = formPanel.find('crColumnName', 'account').shift();
  var amountField = formPanel.find('crColumnName', 'amount').shift();
  var closeShareField = formPanel.find('crColumnName', 'closeShare').shift();
  if (record) {
    accountField.crSetContents(record.data.accountNumber + ' ' + record.data.productType + ' ' + record.data.id + ' ' + record.data.description);
    amountField.crSetContents(record.data.balance);
    closeShareField.crSetContents('Y');
    closeShareField.setDisabled(false);
  } else {
    accountField.crSetContents('');
    amountField.crSetContents('0.00');
    closeShareField.crSetContents('N');
    closeShareField.setDisabled(false);
  }
});

var shareGrid = new CR.GridPanel({
  region: 'center',
  store: shareStore,
  sm: shareSelectionModel,
  columns: [
    shareSelectionModel,
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
    //    {
    //      header: 'S/L',
    //      width: 20,
    //      sortable: true,
    //      dataIndex: 'productType'
    //    },
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
      //sortable: true,
      align: 'right',
      renderer: 'usMoney',
      dataIndex: 'balance',
      sortType: Ext.data.SortTypes.asFloat
    },
    {
      header: 'Open Date',
      width: 75,
      sortable: true,
      dataIndex: 'openDate',
      renderer: function (value) {
        return CR.DateField.convertToDisplay(value);
      }
    }
  ],
  stripeRows: true,
  autoExpandColumn: 'description',
  height: 350,
  width: 600,
  title: 'Select a Share'
});

var personPanel = new CR.Panel({
  region: 'north',
  resizable: 'true',
  autoScroll: true,
  height: 150,
  split: true,
  html: ''
});

var formPanel = new CR.FormPanel({
  region: 'south',
  title: 'Donation Information',
  frame: true,
  autoHeight: true,
  //defaultType: 'textfield',
  defaults: { width: 230 },
  items: [{
    xtype: 'crOptionField',
    crColumnDescription: 'Charity',
    crColumnName: 'charity',
    editable: false,
    crOptions: [[donationGLAccountNumber, donationRecipientName]]
  }, {
    xtype: 'crTextField',
    crColumnDescription: 'Share',
    crColumnName: 'account',
    disabled: true
  }, {
    xtype: 'crMoneyField',
    crColumnDescription: 'Amount',
    crNegativeAllowed: false,
    crColumnName: 'amount'
  }, {
    xtype: 'crCheckbox',
    crColumnDescription: 'Close Share',
    crColumnName: 'closeShare'
  }
  ]
});

var amountField = formPanel.find('crColumnName', 'amount').shift();
amountField.on('blur', function (field) {
  var selectedShare = shareSelectionModel.getSelected();
  var closeShareField = formPanel.find('crColumnName', 'closeShare').shift();
  closeShareField.setDisabled(false);
  if (selectedShare) {
    if (field.crGetNewContents() !== selectedShare.data.balance) {
      closeShareField.crSetContents('N');
      closeShareField.setDisabled(true);
    }
  }
});

var centerPanel = new CR.Panel({
  region: 'center',
  title: 'Charity Donations',
  frame: true,
  layout: 'border',
  //labelWidth: 150,
  items: [personPanel, shareGrid, formPanel],
  buttons: [{
    text: 'Post',
    handler: confirmPost,
    scope: scriptScope
  }]
});

CR.Core.viewPort = new Ext.Viewport({
  layout: 'border',
  items: [centerPanel],
  listeners: {
    render: function () {
      getInitData.call(scriptScope);
    }
  }
});
