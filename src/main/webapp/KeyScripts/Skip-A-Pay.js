if (!CR.Script.personSerial && !CR.Script.accountSerial) {
  CR.Core.displayExceptions({
    items: ['No Person or Account Specified']
  });
} else {
  getPostingStatus();
}
var personSerial;
var accounts;
var accountIndex = 0;
var loansIndex = 0;
var loans = [];
var shares = [];
/*
 * Gets posting status of Person or Account based on if they are on a Person or
 * Account
 */
function getPostingStatus() {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var postingStatus = xml.addContainer(step, 'postingStatus');
  if (CR.Script.personSerial) {
    xml.addText(postingStatus, 'tableName', 'PERSON');
    xml.addText(postingStatus, 'targetSerial', CR.Script.personSerial);
  } else if (CR.Script.accountSerial) {
    xml.addText(postingStatus, 'tableName', 'ACCOUNT');
    xml.addText(postingStatus, 'targetSerial', CR.Script.accountSerial);
  }
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSONSteps',
    xmlData: xml.getXMLDocument(),
    success: function (response) {
      var rjson = JSON.parse(response.responseText);
      var excps = rjson.exceptions;
      if (excps &&
        excps.length) {
        CR.Core.displayExceptions({
          items: excps.map(function (item) {
            return item.message;
          })
        });
      } else if (rjson.steps.length) {
        var step = rjson.steps;
        for (var k = 0; k < step.length; k++) {
          if (step[k].postingStatus) {
            personSerial = step[k].postingStatus.person.serial;
            getAccounts(personSerial);
            break;
          }
        }
      }
    }
  });
}
function getAccounts(personSerial) {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var search = xml.addContainer(step, 'search');
  xml.setAttribute(search, 'label', 'ACCOUNT_search');
  xml.addText(search, 'tableName', 'ACCOUNT');
  xml.addText(search, 'filterName', 'BY_PRIMARY_PERSON_SERIAL');
  xml.addOption(search, 'includeSelectColumns', 'Y');
  xml.addOption(search, 'includeTotalHitCount', 'Y');
  xml.addCount(search, 'returnLimit', '99');
  var parameter = xml.addContainer(search, 'parameter');
  xml.addText(parameter, 'columnName', 'PRIMARY_PERSON_SERIAL');
  xml.addText(parameter, 'contents', personSerial);
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    success: function (response) {
      var searchResponse = null;
      var tranResult = 'failed';
      var errorArray = [];
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function (exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.search &&
                step.search.$attr &&
                step.search.$attr.label === 'ACCOUNT_search') {
                searchResponse = step.search;
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        if (searchResponse.resultRow) {
          accounts = searchResponse.resultRow;
          getLoanSerialsFromAccount();
        }
      }
    }
  });
}
function getLoanSerialsFromAccount() {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var search = xml.addContainer(step, 'search');
  xml.setAttribute(search, 'label', 'LOAN_search');
  xml.addText(search, 'tableName', 'LOAN');
  xml.addText(search, 'filterName', 'BY_PARENT_SERIAL');
  xml.addOption(search, 'includeSelectColumns', 'Y');
  xml.addOption(search, 'includeTotalHitCount', 'Y');
  xml.addCount(search, 'returnLimit', '100');
  var parameter = xml.addContainer(search, 'parameter');
  xml.addText(parameter, 'columnName', 'PARENT_SERIAL');
  xml.addText(parameter, 'contents', accounts[accountIndex].serial);
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    success: function (response) {
      var searchResponse = null;
      var tranResult = 'failed';
      var errorArray = [];
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function (exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.search &&
                step.search.$attr &&
                step.search.$attr.label === 'LOAN_search') {
                searchResponse = step.search;
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        if (searchResponse.resultRow) {
          var accountLoans = searchResponse.resultRow;
          for (var j = 0; j < accountLoans.length; j++) {
            // don't get closed loans
            if (!(accountLoans[j].rowStatus && accountLoans[j].rowStatus.option === "C")) {
              loans.push(accountLoans[j]);
            }
          }
        }
        accountIndex++;
        if (accountIndex === accounts.length) {
          accountIndex = 0;
          populateLoansField();
          getShareSerialsFromAccount()
        } else {
          getLoanSerialsFromAccount();
        }
      }
    }
  });
}
function getShareSerialsFromAccount() {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var search = xml.addContainer(step, 'search');
  xml.setAttribute(search, 'label', 'SHARE_search');
  xml.addText(search, 'tableName', 'SHARE');
  xml.addText(search, 'filterName', 'BY_PARENT_SERIAL');
  xml.addOption(search, 'includeSelectColumns', 'Y');
  xml.addOption(search, 'includeTotalHitCount', 'Y');
  xml.addCount(search, 'returnLimit', '100');
  var parameter = xml.addContainer(search, 'parameter');
  xml.addText(parameter, 'columnName', 'PARENT_SERIAL');
  xml.addText(parameter, 'contents', accounts[accountIndex].serial);
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    success: function (response) {
      var searchResponse = null;
      var tranResult = 'failed';
      var errorArray = [];
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function (exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.search &&
                step.search.$attr &&
                step.search.$attr.label === 'SHARE_search') {
                searchResponse = step.search;
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        if (searchResponse.resultRow) {
          var accountShares = searchResponse.resultRow;
          for (var i = 0; i < accountShares.length; i++) {
            // don't get closed shares //TODO - relevant here?
            if (!(accountShares[i].rowStatus && accountShares[i].rowStatus.option === "C")) {
              shares.push(accountShares[i]);
            }
          }
        }
        accountIndex++;
        if (accountIndex === accounts.length) {
          accountIndex = 0;
          populateSharesField();
        } else {
          getShareSerialsFromAccount();
        }
      }
    }
  });
}
function populateLoansField() {
  var options = [];
  for (var i = 0; i < loans.length; i++) {
    var loan = loans[i];
    var serial = loan.serial;
    var contents = loan.selectColumn[0].contents;
    var description = '';
    if (contents) {
      description = contents.substr(13) + ' - ' + contents.substr(0, 10);
    }
    options.push([serial, description]);
  }
  loanList.crAddOptions(options);
}
function populateSharesField() {
  var options = [];
  for (var i = 0; i < shares.length; i++) {
    var share = shares[i];
    var serial = share.serial;
    var contents = share.selectColumn[0].contents;
    var description = '';
    if (contents) {
      description = contents.substr(13) + ' - ' + contents.substr(0, 10);
    }
    options.push([serial, description]);
  }
  shareList.crAddOptions(options);
}
function checkLoanEligibility() {
  // get Loan Note from Loan
  var selectedLoanSerial = loanList.crGetNewContents();
  CR.Core.recordSearch({
    search: {
      tableName: 'LN_NOTE',
      filterName: 'BY_PARENT_SERIAL',
      returnLimit: '100',
      parameter: [{
        columnName: 'PARENT_SERIAL',
        contents: selectedLoanSerial
      }]
    },
    callbackFunction: function (loanNoteSearchResult) {
      if (loanNoteSearchResult.records) {
        var activeNoteRecords = loanNoteSearchResult.records.filter((noteRecord) => {
          return !noteRecord.EXPIRATION_DATE || noteRecord.EXPIRATION_DATE > CR.Login.postingDate;
        });
        var skipAPayNote = activeNoteRecords.find((noteRecord) => {
          return noteRecord.TYPE_SERIAL_DESCRIPTION === 'Skip-A-Pay';
        });
        var processedSkipAPayNote = activeNoteRecords.find((noteRecord) => {
          return noteRecord.TYPE_SERIAL_DESCRIPTION === 'Skip-A-Pay Processed';
        });
        var ineligibleSkipAPayNote = activeNoteRecords.find((noteRecord) => {
          return noteRecord.TYPE_SERIAL_DESCRIPTION === 'Skip-A-Pay Ineligible';
        });
        if (skipAPayNote && !processedSkipAPayNote && !ineligibleSkipAPayNote) {
          // Check Share for adequate balance
          checkShareBalanceAfterFee();
        } else {
          var msg = 'The selected Loan does not have a Loan Note needed for the Skip A Pay Program.';
          if (processedSkipAPayNote) {
            msg = 'The selected loan has already been processed for the Skip A Pay Program.';
          } else if (ineligibleSkipAPayNote) {
            msg = 'The selected loan has been marked as ineligible for the Skip A Pay Program.';
          }
          Ext.MessageBox.show({
            title: 'Skip A Pay',
            msg: msg,
            buttons: Ext.MessageBox.OK,
            icon: Ext.MessageBox.WARNING
          });
        }
      } else {
        // No Loan Note. (this should not happen, but just in case)
        Ext.MessageBox.show({
          title: 'Skip A Pay',
          msg: 'The selected Loan does not have a Loan Note needed for the Skip A Pay Program.',
          buttons: Ext.MessageBox.OK,
          icon: Ext.MessageBox.WARNING
        });
      }
    }
  });
}
function checkShareBalanceAfterFee() {
  var selectedShareSerial = shareList.crGetNewContents();
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var record = xml.addContainer(step, 'record');
  xml.setAttribute(record, 'label', 'SHARE_record');
  xml.addText(record, 'tableName', 'SHARE');
  xml.addOption(record, 'operation', 'V');
  xml.addText(record, 'targetSerial', selectedShareSerial);
  xml.addOption(record, 'includeTableMetadata', 'N');
  xml.addOption(record, 'includeColumnMetadata', 'N');
  xml.addOption(record, 'includeRowDescriptions', 'Y');
  xml.addOption(record, 'includeAllColumns', 'Y');
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    success: function (response) {
      var recordResponse = null;
      var tranResult = 'failed';
      var errorArray = [];
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function (exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.record &&
                step.record.$attr &&
                step.record.$attr.label === 'SHARE_record') {
                recordResponse = step.record;
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        if (recordResponse.field) {
          for (var i = 0; i < recordResponse.field.length; i++) {
            if (recordResponse.field[i].columnName === 'BALANCE') {
              var balanceStr = recordResponse.field[i].newContents;
              var balance = parseFloat(balanceStr);
              if (balance - 50 < 0) {
                Ext.MessageBox.show({
                  title: 'Skip A Pay',
                  msg: 'The selected Share does not have an adequate balance for the Skip A Pay Program fee.',
                  buttons: Ext.MessageBox.OK,
                  icon: Ext.MessageBox.WARNING
                });
              } else {
                // process the LE transaction
                getLoanExtensionType();
              }
            }
          }
        } else {
          // not able to find share (should't happen but this is backup)
          Ext.MessageBox.show({
            title: 'Skip A Pay',
            msg: 'The selected Share could not be processed.',
            buttons: Ext.MessageBox.OK,
            icon: Ext.MessageBox.WARNING
          });
        }
      }
    }
  });
}
function getLoanExtensionType() {
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var search = xml.addContainer(step, 'search');
  xml.setAttribute(search, 'label', 'LN_EXTENSION_TYPE_search');
  xml.addText(search, 'tableName', 'LN_EXTENSION_TYPE');
  xml.addText(search, 'filterName', 'BY_DESCRIPTION');
  xml.addOption(search, 'includeSelectColumns', 'Y');
  xml.addOption(search, 'includeTotalHitCount', 'Y');
  xml.addCount(search, 'returnLimit', '10');
  var parameter = xml.addContainer(search, 'parameter');
  xml.addText(parameter, 'columnName', 'DESCRIPTION');
  xml.addText(parameter, 'contents', 'Skip-A-Pay');
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    success: function (response) {
      var searchResponse = null;
      var tranResult = 'failed';
      var errorArray = [];
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function (exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.search &&
                step.search.$attr &&
                step.search.$attr.label === 'LN_EXTENSION_TYPE_search') {
                searchResponse = step.search;
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        if (searchResponse.resultRow) {
          var loanExtensionTypeSerial = searchResponse.resultRow[0].serial;
          loanExtension(loanExtensionTypeSerial);
        } else {
          // catch case of not fiding type (shouldn't happen but back up)
          Ext.MessageBox.show({
            title: 'Skip A Pay',
            msg: 'Could not find Loan Extension Type: Skip-A-Pay.',
            buttons: Ext.MessageBox.OK,
            icon: Ext.MessageBox.WARNING
          });
        }
      }
    }
  });
}
// process the LE transaction
function loanExtension(loanExtensionTypeSerial) {
  var selectedLoanSerial = loanList.crGetNewContents();
  var selectedShareSerial = shareList.crGetNewContents();
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var loanExtension = xml.addContainer(step, 'loanExtension');
  xml.setAttribute(loanExtension, 'label', '0');
  xml.addText(loanExtension, 'loanSerial', selectedLoanSerial);
  xml.addText(loanExtension, 'typeSerial', loanExtensionTypeSerial);
  xml.addText(loanExtension, 'feeShareSerial', selectedShareSerial);
  xml.addMoney(loanExtension, 'specifiedFeeAmount', '50.00');
  xml.addOption(loanExtension, 'feeLoanOption', 'N');
  xml.addOption(loanExtension, 'specifiedFeeOption', 'Y');
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    success: function (response) {
      var searchResponse = null;
      var tranResult = 'failed';
      var errorArray = [];
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function (exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              }
              // currently not using the response (assuming it works if errorArray is empty) 
              //else if (step.record &&
              //           step.record.$attr &&
              //           step.record.$attr.label === 'LN_EXTENSION_record') {
              //  recordResponse = step.record;
              //}
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        getLoanModificationInfo();
      }
    }
  });
}
function getLoanModificationInfo() {
  var selectedLoanSerial = loanList.crGetNewContents();
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var search = xml.addContainer(step, 'search');
  xml.setAttribute(search, 'label', 'CU_LN_MOD_search');
  xml.addText(search, 'tableName', 'CU_LN_MOD');
  xml.addText(search, 'filterName', 'BY_PARENT_SERIAL');
  xml.addOption(search, 'includeSelectColumns', 'Y');
  xml.addOption(search, 'includeTotalHitCount', 'Y');
  xml.addCount(search, 'returnLimit', '10');
  var parameter = xml.addContainer(search, 'parameter');
  xml.addText(parameter, 'columnName', 'PARENT_SERIAL');
  xml.addText(parameter, 'contents', selectedLoanSerial);
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    success: function (response) {
      var searchResponse = null;
      var tranResult = 'failed';
      var errorArray = [];
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function (exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.search &&
                step.search.$attr &&
                step.search.$attr.label === 'CU_LN_MOD_search') {
                searchResponse = step.search;
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        if (searchResponse.resultRow) {
          var loadModSerial = searchResponse.resultRow[0].serial; //TODO check if right
          editLoanModificationInfo(loadModSerial);
        } else {
          editLoanModificationInfo(null);
        }
      }
    }
  });
}
function editLoanModificationInfo(loanModSerial) {
  var selectedLoanSerial = loanList.crGetNewContents();
  var xml = new CR.XML();
  var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
  var transaction = xml.addContainer(sequence, 'transaction');
  var step = xml.addContainer(transaction, 'step');
  var record = xml.addContainer(step, 'record');
  xml.setAttribute(record, 'label', 'CU_LN_MOD_record');
  xml.addText(record, 'tableName', 'CU_LN_MOD');
  // check for insert of update operation
  if (loanModSerial) {
    xml.addOption(record, 'operation', 'U');
    xml.addText(record, 'targetSerial', loanModSerial);
  } else {
    xml.addOption(record, 'operation', 'I');
    xml.addText(record, 'targetParentSerial', selectedLoanSerial);
  }
  xml.addOption(record, 'includeTableMetadata', 'N');
  xml.addOption(record, 'includeColumnMetadata', 'N');
  xml.addOption(record, 'includeRowDescriptions', 'Y');
  var field = null;
  field = xml.addContainer(record, 'field');
  xml.addText(field, 'columnName', 'SKIP_A_PAY_MOD_OPTION');
  xml.addOption(field, 'operation', 'S');
  xml.addText(field, 'newContents', 'Y');
  field = xml.addContainer(record, 'field');
  xml.addText(field, 'columnName', 'SKIP_A_PAY_DATE');
  xml.addOption(field, 'operation', 'S');
  xml.addText(field, 'newContents', getCurrentDate());
  CR.Core.ajaxRequest({
    url: 'DirectXMLPostJSON',
    xmlData: xml.getXMLDocument(),
    success: function (response) {
      var recordResponse = null;
      var tranResult = 'failed';
      var errorArray = [];
      var responseJson = CR.JSON.parse(response.responseText);
      var query = responseJson.query;
      if (query) {
        Ext.each(query.sequence, function (sequence) {
          Ext.each(sequence.transaction, function (transaction) {
            tranResult = transaction.$attr.result;
            Ext.each(transaction.exception, function (exception) {
              errorArray.push(exception.message);
            });
            Ext.each(transaction.step, function (step) {
              if (step.tranResult &&
                step.tranResult.category &&
                step.tranResult.category.option &&
                step.tranResult.category.option === 'E') {
                errorArray.push(step.tranResult.description);
              } else if (step.record &&
                step.record.$attr &&
                step.record.$attr.label === 'CU_LN_MOD_record') {
                recordResponse = step.record;
              }
            });
          });
        });
      }
      if (tranResult !== 'posted' || errorArray.length > 0) {
        CR.Core.displayExceptions({ items: errorArray });
      } else {
        Ext.MessageBox.show({
          title: 'Update Confirmation',
          msg: 'The Skip A Pay transaction was processed successfully. \n\
            The Loan Modification Info record was updated successfully.',
          buttons: Ext.MessageBox.OK,
          icon: Ext.MessageBox.CONFIRMATION
        });
      }
    }
  });
}
function getCurrentDate() {
  return CR.Login.postingDate;
}
var loanList = new CR.OptionField({
  crColumnDescription: 'Loan',
  crOptions: [
    ['X', 'SELECT']
  ],
  crContents: 'X'
});
var shareList = new CR.OptionField({
  crColumnDescription: 'Share (for fee)',
  crOptions: [
    ['X', 'SELECT']
  ],
  crContents: 'X'
});
var postButton = new CR.ToolbarButton({
  text: 'Post',
  handler: function (button) {
    var selectedLoanSerial = loanList.crGetNewContents();
    var selectedShareSerial = shareList.crGetNewContents();
    if (selectedShareSerial === 'X') {
      Ext.MessageBox.show({
        title: 'Skip A Pay',
        msg: 'Share has not been selected.',
        buttons: Ext.MessageBox.OK,
        icon: Ext.MessageBox.WARNING
      });
    } else if (selectedLoanSerial === 'X') {
      Ext.MessageBox.show({
        title: 'Skip A Pay',
        msg: 'Loan has not been selected.',
        buttons: Ext.MessageBox.OK,
        icon: Ext.MessageBox.WARNING
      });
    } else {
      checkLoanEligibility();
    }
  }
});
var skipAPayPanel = new CR.FormPanel({
  labelWidth: 75,
  frame: true,
  title: 'Skip A Pay',
  bodyStyle: 'padding:5px',
  autoHeight: true,
  buttonAlign: 'left',
  style: {
    width: '100%'
  },
  bbar: [postButton],
  items: [
    loanList,
    shareList
  ]
});
CR.Core.viewPort = new Ext.Viewport({
  autoScroll: true,
  items: [skipAPayPanel],
  listeners: {
    render: function () {
    }
  }
});