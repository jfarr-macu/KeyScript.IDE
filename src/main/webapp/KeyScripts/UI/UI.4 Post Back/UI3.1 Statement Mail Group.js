console.clear();
console.info('UI.3.3 Statement Mail Group.js');

// Array of shares that will get changed
var shareCheckboxes = [];

var centerPanel = new CR.FormPanel({
  region: 'center',
  title: 'Statement Mail Group - Update',
  frame: true,
  labelWidth: 150,
  bodyStyle: {
    padding: '5px',
    font: '12px arial,tahoma,helvetica,sans-serif'
  },
  buttons: [{
      text: 'Post',
      handler: doPost
    }, {
      text: 'Reset',
      handler: function() {
        centerPanel.getForm().reset();
      }
    }]
});

CR.Core.viewPort = new Ext.Viewport({
  layout: 'border',
  items: [centerPanel],
  listeners: {
    afterrender: function() {
      getPostingStatus();
    }
  }
});

function getPostingStatus() {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');

  var step = xml.addContainer(transaction, 'step');
  var postingStatus = xml.addContainer(step, 'postingStatus');
  xml.setAttribute(postingStatus, 'label', 'AAA');
  xml.addText(postingStatus, 'tableName', 'PERSON');
  xml.addText(postingStatus, 'targetSerial', CR.Script.personSerial);

  step = xml.addContainer(transaction, 'step');
  var search = xml.addContainer(step, 'search');
  xml.setAttribute(search, 'label', 'STMT_MAIL_GROUP');
  xml.addText(search, 'tableName', 'STMT_MAIL_GROUP');
  xml.addText(search, 'filterName', 'BY_DESCRIPTION_WITH_OPEN_STATUS');
  xml.addOption(search, 'includeSelectColumns', 'Y');
  xml.addOption(search, 'includeTotalHitCount', 'N');
  xml.addCount(search, 'returnLimit', '100');
//  var parameter = xml.addContainer(search, 'parameter');
//  xml.addText(parameter, 'columnName', 'DESCRIPTION');
//  xml.addSerial(parameter, 'contents', '');
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
        if (sequence) {
          for (var i = 0; i < sequence.length; i++) {
            var transaction = sequence[i].transaction;
            if (transaction) {
              for (var j = 0; j < transaction.length; j++) {
                tranResult = transaction[j].$attr.result;
                var postingDate = transaction[j].postingDate;
                var step = transaction[j].step;
                if (step) {
                  for (var k = 0; k < step.length; k++) {
                    if (step[k].tranResult &&
                        step[k].tranResult.category &&
                        step[k].tranResult.category.option &&
                        step[k].tranResult.category.option === 'E') {
                      errorArray.push(
                          step[k].tranResult.description);
                    } else if (step[k].postingStatus) {
                      postingStatus = step[k].postingStatus;
                    } else if (step[k].search && step[k].search.$attr &&
                        step[k].search.$attr.label === 'STMT_MAIL_GROUP') {
                      search = step[k].search;
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (tranResult !== 'posted') {
        CR.Core.displayExceptions({
          items: errorArray
        });
      } else {
        displayPage(postingStatus, search);
      }
    }
  });
}

function displayPage(postingStatus, search) {
  var html = '';
  html += '<p>This Script will change the Statement Mail Group for all Shares owned by the Person</p>';
  html += '<br/>';
  html += '<h2>Person: ' + postingStatus.person.rowDescription + ' </h2>';
  html += '<br/>';
  centerPanel.add(new CR.Panel({html: html}));

  var shareOptions = [];
  Ext.each(postingStatus.account, function(account) {
    Ext.each(account.share, function(share) {
      var isOwner = false;
      Ext.each(share.ownerPerson, function(ownerPerson) {
        isOwner |= ownerPerson.serial === CR.Script.personSerial;
      });
      if (isOwner) {
        shareOptions.push({
          boxLabel: CR.Core.htmlText('' + account.accountNumber + ' S' + share.id + ' ' + share.description),
          name: 'shareOption',
          inputValue: share.serial,
          checked: true
        });
      }
    });
  });
  var checkboxGroup = new Ext.form.CheckboxGroup({
    fieldLabel: '',
    columns: 2,
    items: shareOptions,
    myTag: 'shareOptions'
  });
  var sharesFieldSet = new CR.FieldSet({
    crViewGroup: 'Select Shares',
    crItems: [checkboxGroup]
  });
  centerPanel.add(sharesFieldSet);

  statementGroupSerialField = new CR.SerialField({
    crColumnDescription: 'Statement Mail Group',
    crTableName: 'STMT_MAIL_GROUP',
    crNullAllowed: true
  });
  centerPanel.add(statementGroupSerialField);

  centerPanel.doLayout();
}

function doPost() {
  var statementMailGroupSerial = statementGroupSerialField.crGetNewContents();
  var statementMailGroupDescription = statementGroupSerialField.crGetNewDisplayContents();

  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');

  var shareSerials = [];
  Ext.each(
      centerPanel.find('myTag', 'shareOptions'),
      function(checkboxGroup) {
        Ext.each(checkboxGroup.getValue(), function(checkbox) {
          shareSerials.push(checkbox.inputValue);
        });
      }
  );

  Ext.each(shareSerials, function(shareSerial) {
    var step = xml.addContainer(transaction, 'step');
    var record = xml.addContainer(step, 'record');
    xml.addOption(record, 'operation', 'U');
    xml.addOption(record, 'includeRowDescriptions', 'Y');
    xml.addText(record, 'tableName', 'SHARE');
    xml.addText(record, 'targetSerial', shareSerial);
    var field = xml.addContainer(record, 'field');
    xml.addText(field, 'columnName', 'STMT_MAIL_GROUP_SERIAL');
    xml.addOption(field, 'operation', 'S'); // default for newContents
    xml.addText(field, 'newContents', statementMailGroupSerial);
  });

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
        if (sequence) {
          for (var i = 0; i < sequence.length; i++) {
            var transaction = sequence[i].transaction;
            if (transaction) {
              for (var j = 0; j < transaction.length; j++) {
                tranResult = transaction[j].$attr.result;
                var postingDate = transaction[j].postingDate;
                var step = transaction[j].step;
                if (step) {
                  for (var k = 0; k < step.length; k++) {
                    if (step[k].tranResult &&
                        step[k].tranResult.category &&
                        step[k].tranResult.category.option &&
                        step[k].tranResult.category.option === 'E') {
                      errorArray.push(
                          step[k].tranResult.description);
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (tranResult !== 'posted') {
        CR.Core.displayExceptions({
          items: errorArray
        });
      } else {
        Ext.Msg.alert(
            'Statement Mail Group ',
            'Statement Mail Group set to \'' + statementMailGroupDescription + '\' on all Shares'
            );
      }
    }
  });
}