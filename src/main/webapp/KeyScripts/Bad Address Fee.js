var myRecordTree = null;
var myPostingStatus = null;
var myFeeSearch = null;
var myFeeSerial = '';
var myFeeAmount = '';
var myNoteSearch = null;
var myNoteTypeSerial = '';

function setup() {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var postingStatus = xml.addContainer(step, 'postingStatus');
  xml.setAttribute(postingStatus, 'label', 'postingStatus');
  xml.addText(postingStatus, 'tableName', 'PERSON');
  xml.addText(postingStatus, 'targetSerial', CR.Script.personSerial);
  step = xml.addContainer(transaction, 'step');
  var recordTree = xml.addContainer(step, 'recordTree');
  xml.setAttribute(recordTree, 'label', 'recordTree');
  xml.addText(recordTree, 'tableName', 'PERSON');
  xml.addText(recordTree, 'viewName', 'STANDARD');
  xml.addSerial(recordTree, 'targetSerial', CR.Script.personSerial);
  xml.addOption(recordTree, 'includeTableMetadata', 'N');
  xml.addOption(recordTree, 'includeColumnMetadata', 'N');
  step = xml.addContainer(transaction, 'step');
  var search = xml.addContainer(step, 'search');
  xml.setAttribute(search, 'label', 'feeSearch');
  xml.addText(search, 'tableName', 'FEE');
  xml.addText(search, 'filterName', 'BY_EXACT_DESCRIPTION');
  xml.addOption(search, 'includeSelectColumns', 'Y');
  xml.addOption(search, 'includeTotalHitCount', 'N');
  xml.addCount(search, 'returnLimit', '1');
  var parameter = xml.addContainer(search, 'parameter');
  xml.addText(parameter, 'columnName', 'DESCRIPTION');
  xml.addText(parameter, 'contents', 'Bad Address Fee');
  step = xml.addContainer(transaction, 'step');
  search = xml.addContainer(step, 'search');
  xml.setAttribute(search, 'label', 'noteSearch');
  xml.addText(search, 'tableName', 'NOTE_TYPE');
  xml.addText(search, 'filterName', 'BY_DESCRIPTION');
  xml.addOption(search, 'includeSelectColumns', 'Y');
  xml.addOption(search, 'includeTotalHitCount', 'Y');
  xml.addCount(search, 'returnLimit', '1');
  parameter = xml.addContainer(search, 'parameter');
  xml.addText(parameter, 'columnName', 'DESCRIPTION');
  xml.addText(parameter, 'contents', 'Bad Address Alert');
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    params: {},
    scope: this,
    success: function(response) {
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      var tranResult = 'failed';
      var errorArray = [];
      if (query) {
        Ext.each(query.sequence, function(sequence) {
          Ext.each(sequence.transaction, function(transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function(exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function(step) {
              if (step.tranResult &&
                      step.tranResult.category &&
                      step.tranResult.category.option &&
                      step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.postingStatus) {
                myPostingStatus = step.postingStatus;
              } else if (step.recordTree) {
                myRecordTree = step.recordTree;
              } else if (step.search &&
                      step.search.$attr &&
                      step.search.$attr.label === 'feeSearch') {
                myFeeSearch = step.search;
                if (!myFeeSearch.resultRow) {
                  errorArray.push('\'Bad Address Fee\' Fee record not found');
                }
              } else if (step.search &&
                      step.search.$attr &&
                      step.search.$attr.label === 'noteSearch') {
                myNoteSearch = step.search;
                if (!myNoteSearch.resultRow) {
                  errorArray.push('\'Bad Address Alert\' Note Type record not found');
                }
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({
          items: errorArray
        });
      } else {
        myFeeSerial = myFeeSearch.resultRow[0].serial;
        myFeeDescription = myFeeSearch.resultRow[0].selectColumn[0].contents;

        myNoteTypeSerial = myNoteSearch.resultRow[0].serial;

        getFeeAmount(myFeeSerial, function(feeAmount) {
          myFeeAmount = feeAmount;
          centerPanel.myRenderUI();
        });
      }
    }
  });
}

function getFeeAmount(feeSerial, callback) {
  var feeAmount = '0.00';
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var record = xml.addContainer(step, 'record');
  xml.setAttribute(record, 'label', 'Main');
  xml.addOption(record, 'operation', 'V');
  xml.addText(record, 'tableName', 'FEE');
  xml.addSerial(record, 'targetSerial', feeSerial);
  xml.addOption(record, 'includeColumnMetadata', 'N');
  xml.addOption(record, 'includeAllColumns', 'N');
  xml.addOption(record, 'includeRowDescriptions', 'N');
  var field = xml.addContainer(record, 'field');
  xml.addText(field, 'columnName', 'FEE_AMOUNT');
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    scope: this,
    crOverride: {},
    crMask: {},
    params: {},
    success: function(response) {
      var recordResponse = null;
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      var tranResult = 'failed';
      var errorArray = [];
      if (query) {
        Ext.each(query.sequence, function(sequence) {
          Ext.each(sequence.transaction, function(transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function(exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function(step) {
              if (step.tranResult &&
                      step.tranResult.category &&
                      step.tranResult.category.option &&
                      step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.record) {
                recordResponse = step.record;
                if (recordResponse.field) {
                  var field = recordResponse.field;
                  for (var index = 0; index < field.length; index++) {
                    if (field[index].columnName === 'FEE_AMOUNT') {
                      feeAmount = field[index].newContents;
                    }
                  }
                }
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({items: errorArray});
      } else {
        callback(feeAmount);
      }
    }
  });
}

var centerPanel = new CR.Panel({
  region: 'center',
  bodyStyle: 'padding:10px;',
  myRenderUI: function() {
    var html = '';
    var person = myPostingStatus.person;
    html += '<table><tr>';
    html += '<td>Name<br/>' + person.rowDescription;
    html += '</table>';
    var resultTree = myRecordTree.resultTree;
    var addresses = [];
    for (i = 0; i < resultTree.child.length; i++) {
      var child = resultTree.child[i];
      if (child.tableName === 'PERSON_ADDRESS_LINK') {
        addresses.push(child);
      }
    }
    var addressOptions = [];
    var checked = true;
    for (i = 0; i < addresses.length; i++) {
      var address = addresses[i];
      if (i !== 0) {
        checked = false;
      }
      addressOptions.push({
        boxLabel: CR.Core.htmlText(address.rowDescription),
        name: 'addressOption',
        inputValue: address.serial,
        checked: checked
      });
    }
    var addressOptionRadioGroup = new Ext.form.RadioGroup({
      fieldLabel: 'Select Address',
      columns: 1,
      items: addressOptions,
      myXMLTag: 'addressOption'
    });
    var addressFieldSet = new CR.FieldSet({
      crViewGroup: 'Addresses',
      crItems: addressOptionRadioGroup
    });
    this.add(addressFieldSet);

    if (myPostingStatus.account) {
      var account = myPostingStatus.account;
      var optionalShares = [];
      for (i = 0; i < account.length; i++) {
        var acct = account[i];
        if (acct.share) {
          var share = acct.share;
          for (j = 0; j < share.length; j++) {
            var sh = share[j];
            if (!sh.taxPlan) {
              if (sh.ownerPerson) {
                for (k = 0; k < sh.ownerPerson.length; k++) {
                  var owner = sh.ownerPerson[k];
                  if (owner.serial === CR.Script.personSerial) {
                    optionalShares.push([sh.serial, acct.accountNumber + ' S ' + sh.id + ' ' + sh.description]);
                  }
                }
              }
            }
          }
        }
      }
    }
    var shareOptions = [];
    checked = true;
    for (i = 0; i < optionalShares.length; i++) {
      var shareOpt = optionalShares[i];
      if (i !== 0) {
        checked = false;
      }
      shareOptions.push({
        boxLabel: CR.Core.htmlText(shareOpt[1]),
        name: 'shareOption',
        inputValue: shareOpt[0],
        checked: checked
      });
    }
    var shareOptionRadioGroup = new Ext.form.RadioGroup({
      fieldLabel: 'Select Share',
      columns: 1,
      items: shareOptions,
      myXMLTag: 'targetSerial'
    });
    var shareFieldSet = new CR.FieldSet({
      crViewGroup: 'Share',
      crItems: shareOptionRadioGroup
    });
    var postButton = new CR.Button({
      text: 'Post'
    });
    var feeInfo = new CR.Panel({
      html: '<font color="red">You will be posting a ' + 
              CR.Core.htmlText(myFeeDescription) + 
              ' for $' + myFeeAmount + ' to this share.</font>',
      buttonAlign: 'left',
      buttons: [postButton]
    });
    postButton.addListener('click', this.myPost, this);
    shareFieldSet.add(feeInfo);
    this.add(shareFieldSet);
    this.doLayout();
  },
  myPost: function() {
    var targetSerial;
    var addressDescription = '';

    this.cascade(function(cmp) {
      if (cmp.myXMLTag && cmp.myXMLTag === 'targetSerial') {
        targetSerial = cmp.getValue().inputValue;
        shareDescription = cmp.getValue().boxLabel;
      } else if (cmp.myXMLTag && cmp.myXMLTag === 'addressOption') {
        addressDescription = cmp.getValue().boxLabel;
      }
    });
    var xml = new CR.XML();
    var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
    var transaction = xml.addContainer(sequence, 'transaction');
    var step = xml.addContainer(transaction, 'step');
    var feeAssess = xml.addContainer(step, 'feeAssess');
    xml.addSerial(feeAssess, 'feeSerial', myFeeSerial);
    xml.addOption(feeAssess, 'targetCategory', 'S');
    xml.addSerial(feeAssess, 'targetSerial', targetSerial);
    xml.addMoney(feeAssess, 'specifiedFeeAmount', myFeeAmount);
    xml.addOption(feeAssess, 'specifiedFeeOption', 'Y');
    step = xml.addContainer(transaction, 'step');
    var record = xml.addContainer(step, 'record');
    xml.addOption(record, 'operation', 'I');
    xml.addText(record, 'tableName', 'PE_NOTE');
    xml.addSerial(record, 'targetParentSerial', CR.Script.personSerial);
    var field = xml.addContainer(record, 'field');
    xml.addText(field, 'columnName', 'TYPE_SERIAL');
    xml.addOption(field, 'operation', 'S');
    xml.addText(field, 'newContents', myNoteTypeSerial);
    field = xml.addContainer(record, 'field');
    xml.addText(field, 'columnName', 'EXPLANATION');
    xml.addOption(field, 'operation', 'S');
    xml.addText(field, 'newContents', 'Address: ' + addressDescription);

    CR.Core.ajaxRequest({
      url: 'DirectXMLPostJSON',
      xmlData: xml.getXMLDocument(),
      params: {},
      scope: this,
      success: function(response) {
        var responseJson = CR.JSON.parse(response.responseText);
        var query = responseJson.query;
        var tranResult = 'failed';
        var errorArray = [];
        if (responseJson.query) {
          var sequence = query.sequence;
          if (sequence) {
            for (var i = 0; i < sequence.length; i++) {
              var transaction = sequence[i].transaction;
              if (transaction) {
                for (var j = 0; j < transaction.length; j++) {
                  tranResult = transaction[j].$attr.result;
                  var step = transaction[j].step;
                  if (step) {
                    for (var k = 0; k < step.length; k++) {
                      if (step[k].tranResult && step[k].tranResult.category &&
                              step[k].tranResult.category.option && step[k].tranResult.category.option === 'E') {
                        errorArray.push(step[k].tranResult.description);
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
          Ext.MessageBox.show({
            title: 'Fee Posting',
            msg: 'The fee has successfully been posted.',
            buttons: Ext.MessageBox.OK,
            icon: Ext.MessageBox.INFO,
            fn: function() {
              CR.Script.messageKeyStone({
                refreshComponents: true,
                closeScriptPanel: true,
                scriptPanelId: CR.Script.scriptDefaultPanelId
              });
            }
          });
        }
      }
    });
  }
});

CR.Core.viewPort = new Ext.Viewport({
  layout: 'border',
  items: [
    centerPanel
  ],
  listeners: {
    afterrender: function() {
      setup();
    }
  }
});

CR.Core.viewPort.doLayout();