console.clear();
console.info('UI.3.3 Statement Mail Group.js');

// Array of shares that will get changed
var shareCheckboxes = [];

var centerPanel = new CR.FormPanel({
  region: 'center',
  title: 'Statement Mail Group - Update',
  frame: true,
  labelWidth: 300,
  autoScroll: true,
  bodyStyle: {
    padding: '5px',
    font: '12px arial,tahoma,helvetica,sans-serif'
  },
  bbar: [{
    text: 'Post',
    handler: doPost
  },'-',{
    text: 'Reset',
    handler: function(){
      centerPanel.getForm().reset();
    }
  }]
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
  xml.setAttribute(postingStatus, 'label', 'postingStatus');
  xml.addText(postingStatus, 'tableName', 'PERSON');
  xml.addText(postingStatus, 'targetSerial', CR.Script.personSerial);
  step = xml.addContainer(transaction, 'step');
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
                    } else if (step[k].postingStatus && step[k].postingStatus.$attr &&
                      step[k].postingStatus.$attr.label === 'postingStatus') {
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
        var xml = new CR.XML();
        sequence = xml.addContainer(xml.getRootElement(),'sequence');
        transaction = xml.addContainer(sequence,'transaction');
        console.log(postingStatus);
        var createSLRecordXML = function(sl,tableName){
          var isOwner = false;
          Ext.each(sl.ownerPerson, function(ownerPerson) {
            isOwner |= ownerPerson.serial === CR.Script.personSerial;
          });
          if (isOwner) {
            var step = xml.addContainer(transaction,'step');
            var record = xml.addContainer(step,'record');
            xml.addText(record, 'tableName', tableName);
            xml.addText(record, 'targetSerial', sl.serial);
            var field = xml.addContainer(record,'field');
            xml.addText(field,'columnName','STMT_MAIL_GROUP_SERIAL');
          }
        };
        Ext.each(postingStatus.account, function(account) {
          Ext.each(account.share, function(share) {
            createSLRecordXML(share,'SHARE');
          });
          Ext.each(account.loan, function(loan) {
            createSLRecordXML(loan,'LOAN');
          });
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
                          var record = step[k].record;
                          if (step[k].tranResult &&
                            step[k].tranResult.category &&
                            step[k].tranResult.category.option &&
                            step[k].tranResult.category.option === 'E') {
                            errorArray.push(
                              step[k].tranResult.description);
                          } else if (record) {
                            console.log(record);
                            var field = record.field;
                            if (field){
                              for (var l=0; l<field.length; l++){
                                var fld = field[l];
                                var appendToSL = function(sl){
                                  var isOwner = false;
                                  Ext.each(sl.ownerPerson, function(ownerPerson) {
                                    isOwner |= ownerPerson.serial === CR.Script.personSerial;
                                  });
                                  if (isOwner && record.targetSerialResult === sl.serial) {
                                    sl.statementMailGroup = fld.newContents;
                                    sl.statementMailGroupDescription = fld.newContentsDescription;
                                  }
                                };
                                Ext.each(postingStatus.account, function(account) {
                                  if (record.tableName === 'SHARE'){
                                    Ext.each(account.share, function(share) {
                                      appendToSL(share);
                                    });
                                  }else if (record.tableName === 'LOAN'){
                                    Ext.each(account.loan, function(loan) {
                                      appendToSL(loan);
                                    });
                                  }
                                });
                              }
                            }
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
              var test = postingStatus;
              displayPage(postingStatus);
            }
          }
        });
      }
    }
  });
}

function displayPage(postingStatus) {
  console.log(postingStatus);
  var html = '';
  html += '<p>This Script will change the Statement Mail Group for all Shares and Loans owned by the Person</p>';
  html += '<br/>';
  html += '<h2>Person: ' + postingStatus.person.rowDescription + ' </h2>';
  html += '<br/>';
  centerPanel.add(new CR.Panel({
    html: html
  }));

  var shareOptions = [];
  var loanOptions = [];
  Ext.each(postingStatus.account, function(account) {
    Ext.each(account.share, function(share) {
      var isOwner = false;
      Ext.each(share.ownerPerson, function(ownerPerson) {
        isOwner |= ownerPerson.serial === CR.Script.personSerial;
      });
      if (isOwner) {
        shareOptions.push(new CR.SerialField({
          crColumnDescription: CR.Core.htmlText(account.accountNumber + ' S ' + share.id + ' ' + share.description),
          crTableName: 'STMT_MAIL_GROUP',
          crContents: share.statementMailGroup,
          crRowDescription: share.statementMailGroupDescription,
          myTargetSerial: share.serial,
          myTableName: 'SHARE',
          myIsStatementMailGroupPrompt: true,
          crNullAllowed: true
        }));
      }
    });
     Ext.each(account.loan, function(loan) {
      var isOwner = false;
      Ext.each(loan.ownerPerson, function(ownerPerson) {
        isOwner |= ownerPerson.serial === CR.Script.personSerial;
      });
      if (isOwner) {
        loanOptions.push(new CR.SerialField({
          crColumnDescription: CR.Core.htmlText(account.accountNumber + ' L ' + loan.id + ' ' + loan.description),
          crTableName: 'STMT_MAIL_GROUP',
          crContents: loan.statementMailGroup,
          crRowDescription: loan.statementMailGroupDescription,
          myTargetSerial: loan.serial,
          myTableName: 'LOAN',
          myIsStatementMailGroupPrompt: true,
          crNullAllowed: true
        }));
      }
    });
  });
  var sharesFieldSet = new CR.FieldSet({
    crViewGroup: 'Available Shares to Update',
    crItems: [ shareOptions ]
  });
  centerPanel.add(sharesFieldSet);
  var loansFieldSet = new CR.FieldSet({
    crViewGroup: 'Available Loans to Update',
    crItems: [ loanOptions ]
  });
  centerPanel.add(loansFieldSet);
  centerPanel.add(new CR.SerialField({
    crColumnDescription: 'Update all shares/loans to this Statement Mail Group',
    crTableName: 'STMT_MAIL_GROUP',
    crNullAllowed: true,
    crOnContentsChange: function(){
      var thisSerial = this.crGetNewContents();
      var thisRowDesc = this.crGetNewRowDescription();
      centerPanel.cascade(function(cmp){
        if (cmp.myIsStatementMailGroupPrompt){
          cmp.crSetSerial(thisSerial,thisRowDesc);
        }
      });
    }
  }));
  centerPanel.doLayout();
}


function doPost() {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(),'sequence');
  var transaction = xml.addContainer(sequence,'transaction');
  var sharesUpdated = [];
  centerPanel.cascade(function(cmp){
    if (cmp.myIsStatementMailGroupPrompt && (cmp.crGetNewContents() !== cmp.crGetOldContents())){
      sharesUpdated.push([cmp.crGetColumnDescription(),cmp.crGetNewRowDescription()]);
      var step = xml.addContainer(transaction, 'step');
      var record = xml.addContainer(step, 'record');
      xml.addOption(record, 'operation', 'U');
      xml.addOption(record, 'includeRowDescriptions', 'Y');
      xml.addText(record, 'tableName', cmp.myTableName);
      xml.addText(record, 'targetSerial', cmp.myTargetSerial);
      var field = xml.addContainer(record,'field');
      xml.addText(field, 'columnName', 'STMT_MAIL_GROUP_SERIAL');
      xml.addOption(field, 'operation', 'S'); // default for newContents
      xml.addText(field, 'newContents', cmp.crGetNewContents());
    }
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
        var message = '<table style="font-family: arial,tahoma,helvetica,sans-serif;font-size: 8pt;">';
        message += '<th style="font-weight:bold;">Share or Loan</th><th style="font-weight:bold;padding-left:10px;">New Statement Mail Group</th>';
        for (i=0; i<sharesUpdated.length; i++){
          var shareDesc = sharesUpdated[i][0];
          var statementMailGroupDesc = sharesUpdated[i][1];
          message += '<tr><td>' + CR.Core.htmlText(shareDesc);
          message += '</td><td style="padding-left:10px;">' + CR.Core.htmlText(statementMailGroupDesc);
          message += '</td></tr>';
        }
        message += '</table>';
        Ext.Msg.alert(
          'Updated Statement Mail Group(s) ',
          message,
          function(){
            var responseMessage = {
              refreshComponents: true,
              closeScriptPanel: true,
              scriptPanelId: CR.Script.scriptDefaultPanelId
            };
            parent.postMessage(responseMessage, window.location.href);
          }); 
      }
    }
  });
}