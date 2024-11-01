//Quick IQ classic.js
function MyQuickIQ() {

  // public
  this.postingStatus = null;
  this.postingDate = null;
  this.errorArray = [];
  this.eBranchLogin = null;

  // private
  var pendingItems = null;
  var preauthHolds = [];
  var depositHolds = [];
  var loanPledges = [];

  var loginChannelDescription = 'eBranch';
//  var loginChannelDescription = 'Internet Banking With Passwords';

  // display close button (if doing script development only)
  var centerPanelTools = null;
  if (CR.Script.debug) {
    centerPanelTools = [];
    centerPanelTools.push({
      id: 'close',
      handler: function(event, toolEl, panel) {
        panel.ownerCt.remove(panel);
      }
    });
  }

  this.centerPanel = new CR.Panel({
    region: 'center',
    //title: 'MyQuickIQ',
    html: 'Loading...',
    buttons: [
    ],
    autoScroll: true,
    tools: centerPanelTools,
    bodyStyle: 'padding:10px;',
    listeners: {
      render: function() {
        // hack to display in top viewport (testing only)
        if (CR.Script.debug) {
          this.getEl().setStyle('z-index', '1000');
        }
      }
    }
  });

  this.getPostingStatus = function(personSerial) {
    var scope = this;

    var xml = new CR.XML();
    var sequence = xml.addContainer(xml.getRootElement(),'sequence');
    var transaction = xml.addContainer(sequence,'transaction');
    var step = xml.addContainer(transaction,'step');
    var postingStatus = xml.addContainer(step,'postingStatus');
    xml.addText(postingStatus, 'tableName', 'PERSON');
    xml.addText(postingStatus, 'targetSerial', personSerial);
    xml.addOption(postingStatus, 'includePayroll', 'Y');
    xml.addOption(postingStatus, 'includeDistribution', 'Y');
    CR.Core.ajaxRequest({
      url: 'DirectXMLPostJSON',
      xmlData: xml.getXMLDocument(),
      scope: scope,
      success: function(response) {
        this.renderData();
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
                  this.postingDate = transaction[j].postingDate;
                  var step = transaction[j].step;
                  if (step){
                    for (var k = 0; k < step.length; k++) {
                      var postingStatus = step[k].postingStatus;
                      if (step[k].tranResult && step[k].tranResult.category &&
                        step[k].tranResult.category.option &&
                        step[k].tranResult.category.option === 'E') {
                        errorArray.push(step[k].tranResult.description);
                      } else if (postingStatus) {
                        this.postingStatus = postingStatus;
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
          this.processPostingStatus(this.postingStatus);
        }
      }
    });
  };

  this.processPostingStatus = function(postingStatus) {
    var scope = this;
    var accounts = postingStatus.account;
    if (accounts) {
      this.accountSerials = [];
      var loanTypeSerials = [];
      var allLoans = [];
      var allProducts = [];

      for (var accountIndex = 0; accountIndex < accounts.length; accountIndex++) {
        var account = accounts[accountIndex];
        this.accountSerials.push(account.serial);

        var shares = accounts[accountIndex].share;
        if (shares) {
          for(var shareIndex = 0; shareIndex < shares.length; shareIndex++) {
            var share = shares[shareIndex];
            share.type = 'S';
            share.accountNumber = account.accountNumber;
            this.processHolds(account, share, share.hold);
            allProducts.push(share);
          }
        }

        var loans = accounts[accountIndex].loan;
        if (loans) {
          for(var loanIndex = 0; loanIndex < loans.length; loanIndex++) {
            var loan = loans[loanIndex];
            loan.type = 'L';
            loan.accountNumber = account.accountNumber;
            allLoans.push(loan);
            loanTypeSerials.push(loan.typeSerial);
            this.processHolds(account, loan, loan.hold);
            if (loan.shareSecuredOption && loan.shareSecuredOption.option !== 'N') {
              this.processShareSecuredLoan(account, loan);
            }
            allProducts.push(loan);
          }
        }
      }

      this.processPendingItems(allProducts);

      this.getLoginInfo(CR.Script.personSerial);

      // get loan type descriptions
      var xml = new CR.XML();
      var sequence = xml.addContainer(xml.getRootElement(),'sequence');
      var transaction = xml.addContainer(sequence,'transaction');
      var step = xml.addContainer(transaction,'step');
      for (var loanTypeSerialIndex = 0; loanTypeSerialIndex < loanTypeSerials.length; loanTypeSerialIndex++) {
        this.addRecordStep(xml, transaction, 'LN_TYPE', loanTypeSerials[loanTypeSerialIndex], [ {
          columnName: 'DESCRIPTION'
        } ]);
      }
      CR.Core.ajaxRequest({
        url: 'DirectXMLPostJSON',
        xmlData: xml.getXMLDocument(),
        scope: scope,
        success: function(response) {
          this.renderData();
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
                    this.postingDate = transaction[j].postingDate;
                    var step = transaction[j].step;
                    if (step){
                      for (var k = 0; k < step.length; k++) {
                        var record = step[k].record;
                        if (step[k].tranResult &&
                          step[k].tranResult.category &&
                          step[k].tranResult.category.option &&
                          step[k].tranResult.category.option === 'E') {
                          errorArray.push(step[k].tranResult.description);
                        } else if (record) {
                          for (var loanIndex = 0; loanIndex < allLoans.length; loanIndex++) {
                            var loan = allLoans[loanIndex];
                            if (loan.typeSerial === record.targetSerial) {
                              loan.typeDescription = record.field[0].newContents;
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
            this.renderData();
          }
        }
      });
    }
  };

  this.processHolds = function(account, product, holds) {
    if (holds) {
      for(var holdIndex = 0; holdIndex < holds.length; holdIndex++) {
        var hold = holds[holdIndex];
        if (!hold.expirationDate || hold.expirationDate > this.postingDate) {
          if (hold.category.option === 'PA') {
            preauthHolds.push({
              account: account,
              product: product,
              hold: hold
            });
          }
          if (hold.category.option === 'CK') {
            depositHolds.push({
              account: account,
              product: product,
              hold: hold
            });
          }
        }
      }
    }
  };

  this.processShareSecuredLoan = function(account, loan) {
    var collateralSerials = [];

    var scope = this;
    var xml = new CR.XML();
    var sequence = xml.addContainer(xml.getRootElement(),'sequence');
    var transaction = xml.addContainer(sequence,'transaction');
    var step = xml.addContainer(transaction, 'step');
    var search = xml.addContainer(step, 'search');
    xml.addText(search, 'tableName', 'COLLATERAL');
    xml.addText(search, 'filterName', 'BY_PARENT_SERIAL');
    xml.addOption(search, 'includeTotalHitCount', 'N');
    xml.addOption(search, 'includeSelectColumns', 'N');
    xml.addCount(search, 'returnLimit', '100');
    var parameter = xml.addContainer(search, 'parameter');
    xml.addText(parameter, 'columnName', 'PARENT_SERIAL');
    xml.addSerial(parameter, 'contents', loan.serial);
    CR.Core.ajaxRequest({
      url: 'DirectXMLPostJSON',
      xmlData: xml.getXMLDocument(),
      scope: scope,
      success: function(response) {
        this.renderData();
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
                  this.postingDate = transaction[j].postingDate;
                  var step = transaction[j].step;
                  if (step){
                    for (var k = 0; k < step.length; k++) {
                      var search = step[k].search;
                      if (step[k].tranResult &&
                        step[k].tranResult.category &&
                        step[k].tranResult.category.option &&
                        step[k].tranResult.category.option === 'E') {
                        errorArray.push(step[k].tranResult.description);
                      } else if (search && search.resultRow) {
                        if (search.resultRow) {
                          for (var resultRowIndex = 0; resultRowIndex < search.resultRow.length; resultRowIndex++) {
                            var collateralSerial = search.resultRow[resultRowIndex].serial;
                            collateralSerials.push(collateralSerial);
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
        if (tranResult !== 'posted') {
          CR.Core.displayExceptions({
            items: errorArray
          });
        } else {
          this.processLoanCollateral(account, loan, collateralSerials);
        }
      }
    });
  };

  this.processLoanCollateral = function(account, loan, collateralSerials) {
    var scope = this;
    var xml = new CR.XML();
    var sequence = xml.addContainer(xml.getRootElement(),'sequence');
    var transaction = xml.addContainer(sequence,'transaction');
    var step = xml.addContainer(transaction, 'step');
    for (var loanTypeSerialIndex = 0; loanTypeSerialIndex < collateralSerials.length; loanTypeSerialIndex++) {
      this.addRecordStep(xml, transaction, 'COLLATERAL', collateralSerials[loanTypeSerialIndex]);
    }
    CR.Core.ajaxRequest({
      url: 'DirectXMLPostJSON',
      xmlData: xml.getXMLDocument(),
      scope: scope,
      success: function(response) {
        this.renderData();
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
                  this.postingDate = transaction[j].postingDate;
                  var step = transaction[j].step;
                  if (step){
                    for (var k = 0; k < step.length; k++) {
                      var record = step[k].record;
                      if (step[k].tranResult &&
                        step[k].tranResult.category &&
                        step[k].tranResult.category.option &&
                        step[k].tranResult.category.option === 'E') {
                        errorArray.push(step[k].tranResult.description);
                      } else if (record && record.field) {
                        var collateral = {};
                        for (var fieldIndex = 0; fieldIndex < record.field.length; fieldIndex++) {
                          var field = record.field[fieldIndex];
                          collateral[field.columnName] = field.newContents;
                          if (field.newContentsDescription) {
                            collateral[field.columnName + '_DESCRIPTION'] = field.newContentsDescription;
                          }
                        }
                        if (collateral.CATEGORY === 'S' /*Share Secured Collateral*/) {
                          loanPledges.push({
                            account: account,
                            loan: loan,
                            collateral: collateral
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
        if (tranResult !== 'posted') {
          CR.Core.displayExceptions({
            items: errorArray
          });
        } else {
          this.renderData();
        }
      }
    });
  };

  this.processPendingItems = function(products) {
    var scope = this;
    var xml = new CR.XML();
    var sequence = xml.addContainer(xml.getRootElement(),'sequence');
    var transaction = xml.addContainer(sequence,'transaction');
    for (var productIndex = 0; productIndex < products.length; productIndex++) {
      var product = products[productIndex];
      var step = xml.addContainer(transaction, 'step');
      var loginTranPending = xml.addContainer(step, 'loginTranPending');
      xml.addText(loginTranPending, product.type === 'L' ? 'loanSerial' : 'shareSerial', product.serial);
    }
    CR.Core.ajaxRequest({
      url: 'DirectXMLPostJSON',
      xmlData: xml.getXMLDocument(),
      scope: scope,
      success: function(response) {
        this.renderData();
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
                  this.postingDate = transaction[j].postingDate;
                  var step = transaction[j].step;
                  if (step){
                    for (var k = 0; k < step.length; k++) {
                      var loginTranPending = step[k].loginTranPending;
                      if (step[k].tranResult &&
                        step[k].tranResult.category &&
                        step[k].tranResult.category.option &&
                        step[k].tranResult.category.option === 'E') {
                        errorArray.push(step[k].tranResult.description);
                      } else {
                        if (!pendingItems) {
                          pendingItems = [];
                        }
                        if (loginTranPending && loginTranPending.postingItem) {
                          var postingItems = loginTranPending.postingItem;
                          for (var productIndex = 0; productIndex < products.length; productIndex++) {
                            var product = products[productIndex];
                            if ((product.type === 'S' && loginTranPending.shareSerial === product.serial) ||
                              (product.type === 'L' && loginTranPending.loanSerial === product.serial)) {
                              Ext.each(postingItems, function(postingItem) {
                                postingItem.product = product;
                              });
                              // filter for ACH source only
                              postingItems = postingItems.filter(function (postingItem){
                                return postingItem.source && postingItem.source.option === 'a';
                              });
                              if (postingItems) {
                                pendingItems = pendingItems.concat(postingItems);
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
          }
        }
        if (tranResult !== 'posted') {
          CR.Core.displayExceptions({
            items: errorArray
          });
        } else {
          this.renderData();
        }
      }
    });
  };

  this.getLoginInfo = function(personSerial) {
    var scope = this;

    var searchLogins = function(personSerial) {
      var loginSerials = [];

      //var scope = this;
      var xml = new CR.XML();
      var sequence = xml.addContainer(xml.getRootElement(),'sequence');
      var transaction = xml.addContainer(sequence,'transaction');
      var step = xml.addContainer(transaction, 'step');
      var search = xml.addContainer(step, 'search');
      xml.addText(search, 'tableName', 'LOGIN');
      xml.addText(search, 'filterName', 'BY_PERSON_SERIAL');
      xml.addOption(search, 'includeTotalHitCount', 'N');
      xml.addOption(search, 'includeSelectColumns', 'Y');
      xml.addCount(search, 'returnLimit', '100');
      var parameter = xml.addContainer(search, 'parameter');
      xml.addText(parameter, 'columnName', 'PERSON_SERIAL');
      xml.addSerial(parameter, 'contents', personSerial);

      // added search by person's accounts
      Ext.each(this.accountSerials, function(accountSerial) {
        step = xml.addContainer(transaction, 'step');
        search = xml.addContainer(step, 'search');
        xml.addText(search, 'tableName', 'LOGIN');
        xml.addText(search, 'filterName', 'BY_ACCOUNT_SERIAL');
        xml.addOption(search, 'includeTotalHitCount', 'N');
        xml.addOption(search, 'includeSelectColumns', 'Y');
        xml.addCount(search, 'returnLimit', '100');
        parameter = xml.addContainer(search, 'parameter');
        xml.addText(parameter, 'columnName', 'ACCOUNT_SERIAL');
        xml.addSerial(parameter, 'contents', accountSerial);
      });

      CR.Core.ajaxRequest({
        url: 'DirectXMLPostJSON',
        xmlData: xml.getXMLDocument(),
        scope: scope,
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
                    this.postingDate = transaction[j].postingDate;
                    var step = transaction[j].step;
                    if (step){
                      for (var k = 0; k < step.length; k++) {
                        var search = step[k].search;
                        if (step[k].tranResult &&
                          step[k].tranResult.category &&
                          step[k].tranResult.category.option &&
                          step[k].tranResult.category.option === 'E') {
                          errorArray.push(step[k].tranResult.description);
                        } else if (search && search.resultRow) {
                          if (search.resultRow) {
                            for (var resultRowIndex = 0; resultRowIndex < search.resultRow.length; resultRowIndex++) {
                              var resultRow = search.resultRow[resultRowIndex];
                              var loginSerial = resultRow.serial;
                              //if (resultRow.selectColumn && resultRow.selectColumn.length > 0 && resultRow.selectColumn[0].contents && resultRow.selectColumn[0].contents.indexOf('eBranch') === 0) {
                              loginSerials.push(loginSerial);
                            //}
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
          if (tranResult !== 'posted') {
            CR.Core.displayExceptions({
              items: errorArray
            });
          } else {
            proccesLogins(loginSerials);
          }
        }
      });
    };

    var proccesLogins = function(loginSerials) {
      var xml = new CR.XML();
      var sequence = xml.addContainer(xml.getRootElement(),'sequence');
      var transaction = xml.addContainer(sequence,'transaction');
      var step = xml.addContainer(transaction,'step');
      for (var loginSerialIndex = 0; loginSerialIndex < loginSerials.length; loginSerialIndex++) {
        scope.addRecordStep(xml, transaction, 'LOGIN', loginSerials[loginSerialIndex]);
      }
      CR.Core.ajaxRequest({
        url: 'DirectXMLPostJSON',
        xmlData: xml.getXMLDocument(),
        scope: scope,
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
                    this.postingDate = transaction[j].postingDate;
                    var step = transaction[j].step;
                    if (step){
                      for (var k = 0; k < step.length; k++) {
                        var record = step[k].record;
                        if (step[k].tranResult &&
                          step[k].tranResult.category &&
                          step[k].tranResult.category.option &&
                          step[k].tranResult.category.option === 'E') {
                          errorArray.push(step[k].tranResult.description);
                        } else if (record && record.field) {
                          var login = {};
                          for (var fieldIndex = 0; fieldIndex < record.field.length; fieldIndex++) {
                            var field = record.field[fieldIndex];
                            login[field.columnName] = field.newContents;
                            if (field.newContentsDescription) {
                              login[field.columnName + '_DESCRIPTION'] = field.newContentsDescription;
                            }
                          }
                          if (login.CHANNEL_SERIAL_DESCRIPTION === loginChannelDescription) {
                            this.eBranchLogin = login;
                          }
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
          } else if (this.eBranchLogin) {
            searchLoginPassword(this.eBranchLogin);
          }
        }
      });
    };

    var searchLoginPassword = function(eBranchLogin) {
      var passwordSerials = [];

      var xml = new CR.XML();
      var sequence = xml.addContainer(xml.getRootElement(),'sequence');
      var transaction = xml.addContainer(sequence,'transaction');
      var step = xml.addContainer(transaction, 'step');
      var search = xml.addContainer(step, 'search');
      xml.addText(search, 'tableName', 'LOGIN_PASSWORD');
      xml.addText(search, 'filterName', 'BY_PARENT_SERIAL');
      xml.addOption(search, 'includeTotalHitCount', 'N');
      xml.addOption(search, 'includeSelectColumns', 'Y');
      xml.addCount(search, 'returnLimit', '100');
      var parameter = xml.addContainer(search, 'parameter');
      xml.addText(parameter, 'columnName', 'PARENT_SERIAL');
      xml.addSerial(parameter, 'contents', eBranchLogin.SERIAL);
      CR.Core.ajaxRequest({
        url: 'DirectXMLPostJSON',
        xmlData: xml.getXMLDocument(),
        scope: scope,
        success: function(response) {
          this.renderData();
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
                    this.postingDate = transaction[j].postingDate;
                    var step = transaction[j].step;
                    if (step){
                      for (var k = 0; k < step.length; k++) {
                        var search = step[k].search;
                        if (step[k].tranResult &&
                          step[k].tranResult.category &&
                          step[k].tranResult.category.option &&
                          step[k].tranResult.category.option === 'E') {
                          errorArray.push(step[k].tranResult.description);
                        } else if (search && search.resultRow) {
                          if (search.resultRow) {
                            for (var resultRowIndex = 0; resultRowIndex < search.resultRow.length; resultRowIndex++) {
                              var resultRow = search.resultRow[resultRowIndex];
                              var passwordSerial = resultRow.serial;
                              passwordSerials.push(passwordSerial);
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
          if (tranResult !== 'posted') {
            CR.Core.displayExceptions({
              items: errorArray
            });
          } else {
            getLoginPassword(passwordSerials);
          }
        }
      });
    };

    var getLoginPassword = function(passwordSerials) {
      var xml = new CR.XML();
      var sequence = xml.addContainer(xml.getRootElement(),'sequence');
      var transaction = xml.addContainer(sequence,'transaction');
      var step = xml.addContainer(transaction,'step');
      for (var serialIndex = 0; serialIndex < passwordSerials.length; serialIndex++) {
        scope.addRecordStep(xml, transaction, 'LOGIN_PASSWORD', passwordSerials[serialIndex]);
      }
      CR.Core.ajaxRequest({
        url: 'DirectXMLPostJSON',
        xmlData: xml.getXMLDocument(),
        scope: scope,
        success: function(response) {
          this.renderData();
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
                    this.postingDate = transaction[j].postingDate;
                    var step = transaction[j].step;
                    if (step){
                      for (var k = 0; k < step.length; k++) {
                        var record = step[k].record;
                        if (step[k].tranResult &&
                          step[k].tranResult.category &&
                          step[k].tranResult.category.option &&
                          step[k].tranResult.category.option === 'E') {
                          errorArray.push(step[k].tranResult.description);
                        } else if (record && record.field) {
                          var password = {};
                          for (var fieldIndex = 0; fieldIndex < record.field.length; fieldIndex++) {
                            var field = record.field[fieldIndex];
                            password[field.columnName] = field.newContents;
                            if (field.newContentsDescription) {
                              password[field.columnName + '_DESCRIPTION'] = field.newContentsDescription;
                            }
                          }
                          this.eBranchLogin.loginPassword = password;
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
            this.renderData();
          }
        }
      });
    };

    searchLogins.call(this, personSerial);
  };

  this.addRecordStep = function(xml, transaction, tableName, serial, fields) {
    var setFields = Ext.isArray(fields);
    var step = xml.addContainer(transaction, 'step');
    var record = xml.addContainer(step, 'record');
    xml.addOption(record, 'operation', 'V');
    xml.addOption(record, 'includeColumnMetadata', 'N');
    xml.addOption(record, 'includeAllColumns', setFields ? 'N' : 'Y');
    xml.addOption(record, 'includeRowDescriptions', 'Y');
    xml.addText(record, 'tableName', tableName);
    xml.addSerial(record, 'targetSerial', serial);
    if (setFields) {
      for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
        var field = fields[fieldIndex];
        var fieldContainer = xml.addContainer(record, 'field');
        xml.addText(fieldContainer, 'columnName', field.columnName);
      }
    }
  };

  this.setupTemplates = function() {

    this.achTemplate = new Ext.XTemplate([
      '<h2 class="subtitle">Current ACH Warehouse Items</h2>',
      '<div class="datagrid">',
      '<table class="ach-table">',
      '<thead>',
      '<tr>',
      '<th>Category</th>',
      '<th>Amount</th>',
      '<th>Settlement Date</th>',
      '<th>ACH Company Name</th>',
      '<th>ACH Company Entry Description</th>',
      '<th>ACH Name</th>',
      '<th>Target Share/Loan</th>',
      '</tr>',
      '</thead>',
      '<tbody>',
      '<tpl if="!pendingItems">',
      '<tr class="even"><td colspan="99">Loading...</td></tr>',
      '</tpl>',
      '<tpl if="pendingItems && pendingItems.length === 0">',
      '<tr class="even"><td colspan="99">No records found</td></tr>',
      '</tpl>',
      '<tpl if="pendingItems && pendingItems.length &gt; 0">',
      '<tpl for="pendingItems">',
      '<tr class="{[xindex % 2 === 0 ? "even" : "odd"]}">',
      '<td>{[values.category.text]}</td>',
      '<td>{[CR.Core.htmlText(CR.MoneyField.convertToDisplay(values.amount))]}</td>',
      '<td>{[CR.Core.htmlText(CR.DateField.convertToDisplay(values.settlementDate))]}</td>',
      '<td>{[values.achCompanyName]}</td>',
      '<td>{[values.achCompanyEntryDescription]}</td>',
      '<td>{[values.achName]}</td>',
      '<td>{[values.product.accountNumber + " " + values.product.type + " " + values.product.id + " " + values.product.description]}</td>',
      '</tr>',
      '</tpl>',
      '</tpl>',
      '</tbody>',
      '</table>',
      '</div>'
      ]);

    this.preauthTemplate = new Ext.XTemplate([
      '<h2 class="subtitle">Unexpired Pre-Auth Holds</h2>',
      '<div class="datagrid">',
      '<table class="hold-table">',
      '<thead>',
      '<tr>',
      '<th>Account</th>',
      '<th>Product</th>',
      '<th>Amount</th>',
      '<th>Payee</th>',
      '<th>Placement Time</th>',
      '<th>Expiration Date</th>',
      '</tr>',
      '</thead>',
      '<tbody>',
      '<tpl if="!preauthHolds">',
      '<tr class="even"><td colspan="99">Loading...</td></tr>',
      '</tpl>',
      '<tpl if="preauthHolds && preauthHolds.length === 0">',
      '<tr class="even"><td colspan="99">No records found</td></tr>',
      '</tpl>',
      '<tpl if="preauthHolds && preauthHolds.length &gt; 0">',
      '<tpl for="preauthHolds">',
      '<tr class="{[xindex % 2 === 0 ? "even" : "odd"]}">',
      '<td>{[values.account.accountNumber]}</td>',
      '<td>{[values.product.type + " " + values.product.id + " " + values.product.description]}</td>',
      '<td>{[CR.Core.htmlText(CR.MoneyField.convertToDisplay(values.hold.amount))]}</td>',
      '<td>{[values.hold.payee || ""]}</td>',
      '<td>{[CR.TimeField.convertToDisplay(values.hold.placementTime)]}</td>',
      '<td>{[CR.DateField.convertToDisplay(values.hold.expirationDate)]}</td>',
      '</tr>',
      '</tpl>',
      '</tpl>',
      '</tbody>',
      '</table>',
      '</div>'
      ]);

    this.depositTemplate = new Ext.XTemplate([
      '<h2 class="subtitle">Unexpired Deposit Holds</h2>',
      '<div class="datagrid">',
      '<table class="hold-table">',
      '<thead>',
      '<tr>',
      '<th>Account</th>',
      '<th>Product</th>',
      '<th>Amount</th>',
      '<th>Reason</th>',
      '<th>Placement Time</th>',
      '<th>Expiration Date</th>',
      '<th>Check Exception Hold Reason</th>',
      '<th>Hold Days</th>',
      '</tr>',
      '</thead>',
      '<tbody>',
      '<tpl if="!depositHolds">',
      '<tr class="even"><td colspan="99">Loading...</td></tr>',
      '</tpl>',
      '<tpl if="depositHolds && depositHolds.length === 0">',
      '<tr class="even"><td colspan="99">No records found</td></tr>',
      '</tpl>',
      '<tpl if="depositHolds && depositHolds.length &gt; 0">',
      '<tpl for="depositHolds">',
      '<tr class="{[xindex % 2 === 0 ? "even" : "odd"]}">',
      '<td>{[values.account.accountNumber]}</td>',
      '<td>{[values.product.type + " " + values.product.id + " " + values.product.description]}</td>',
      '<td>{[CR.Core.htmlText(CR.MoneyField.convertToDisplay(values.hold.amount))]}</td>',
      '<td>{[values.hold.reason || ""]}</td>',
      '<td>{[CR.TimeField.convertToDisplay(values.hold.placementTime)]}</td>',
      '<td>{[values.hold.expirationDate || ""]}</td>',
      '<td>{[values.hold.checkExceptionHoldReason ? values.hold.checkExceptionHoldReason.text : ""]}</td>',
      '<td>{[values.hold.checkHoldDays || ""]}</td>',
      '</tr>',
      '</tpl>',
      '</tpl>',
      '</tbody>',
      '</table>',
      '</div>'
      ]);

    this.pledgesTemplate = new Ext.XTemplate([
      '<h2 class="subtitle">Pledges for Loans</h2>',
      '<div class="datagrid">',
      '<table class="pledge-table">',
      '<thead>',
      '<tr>',
      '<th>Account</th>',
      '<th>Loan</th>',
      '<th>Loan Type</th>',
      '<th>Share</th>',
      '<th>Amount</th>',
      '</tr>',
      '</thead>',
      '<tbody>',
      '<tpl if="!loanPledges">',
      '<tr class="even"><td colspan="99">Loading...</td></tr>',
      '</tpl>',
      '<tpl if="loanPledges && loanPledges.length === 0">',
      '<tr class="even"><td colspan="99">No records found</td></tr>',
      '</tpl>',
      '<tpl if="loanPledges && loanPledges.length &gt; 0">',
      '<tpl for="loanPledges">',
      '<tr class="{[xindex % 2 === 0 ? "even" : "odd"]}">',
      '<td>{[values.account.accountNumber]}</td>',
      '<td>{["L " + values.loan.id + " " + values.loan.description]}</td>',
      '<td>{[values.loan.typeDescription]}</td>',
      '<td>{[values.collateral.SECURED_SHARE_SERIAL_DESCRIPTION]}</td>',
      '<td>{[CR.Core.htmlText(CR.MoneyField.convertToDisplay(values.collateral.AMOUNT))]}</td>',
      '</tr>',
      '</tpl>',
      '</tpl>',
      '</tbody>',
      '</table>',
      '</div>'
      ]);

    this.loginTemplate = new Ext.XTemplate([
      '<h2 class="subtitle">Last Login to eBranch</h2>',
      '<div class="datagrid" style="width:50%">',
      //                '<tpl if="!values.eBranchLogin">',
      //                    'Loading...',
      //                '</tpl>',
      '<tpl if="values.eBranchLogin">',
      '<table class="login-table">',
      '<tbody>',
      '<tr>',
      '<td>Last Login Time</td>',
      '<td>{[values.eBranchLogin.LAST_LOGIN_TIME ? CR.TimeField.convertToDisplay(values.eBranchLogin.LAST_LOGIN_TIME) : "Never"]}</td>',
      '</tr>',
      '<tr>',
      '<td>Last Unsuccessful login</td>',
      '<td>{[values.eBranchLogin.UNSUCCESSFUL_LOGIN_TIME ? CR.TimeField.convertToDisplay(values.eBranchLogin.UNSUCCESSFUL_LOGIN_TIME) : "Never"]}</td>',
      '</tr>',
      '<tr>',
      '<td>Login Lock status</td>',
      '<td>{[values.eBranchLogin.LOGIN_LOCK]}</td>',
      '</tr>',
      '<tr>',
      '<td>Last password change date</td>',
      '<td>{[values.eBranchLogin.loginPassword ? CR.TimeField.convertToDisplay(values.eBranchLogin.loginPassword.CHANGE_TIME) : "Password not set"]}</td>',
      '</tr>',
      '</tbody>',
      '</table>',
      '</tpl>',
      '</div>'
      ]);

    this.loadingTemplate = new Ext.XTemplate([
      '<h2 class="subtitle">{title}</h2>',
      '<div class="datagrid" style="width:50%">',
      'Loading...',
      '</div>'
      ]);
  };

  this.renderData = function() {
    this.setupTemplates();

    var holdData = {
      preauthHolds: preauthHolds,
      depositHolds: depositHolds,
      loanPledges: loanPledges
    };

    var style = [
    '<style scoped>',
    '.title { color: FireBrick;   }',
    '.subtitle { color: SaddleBrown; margin-top:8px; maring-bottom:6px }',
    ".datagrid table { border-collapse: collapse; text-align: left; width: 100%; } ",
    ".datagrid {font: normal 12px/150% Arial, Helvetica, sans-serif; background: #fff; overflow: hidden; border: 1px solid #006699; ",
    "-webkit-border-radius: 3px; -moz-border-radius: 3px; border-radius: 3px; }",
    ".datagrid table td, .datagrid table th { padding: 3px 10px; } ",
    ".datagrid table thead th {background:-webkit-gradient( linear, left top, left bottom, color-stop(0.05, #006699), color-stop(1, #00557F) ); ",
    "  background:-moz-linear-gradient( center top, #006699 5%, #00557F 100% ); ",
    "  background-color:#006699; color:#ffffff; font-size: 15px; font-weight: bold; border-left: 1px solid #0070A8; }  ",
    ".datagrid table thead th:first-child { border: none; }",
    ".datagrid table tbody td { color: #00496B; border-left: 1px solid #E1EEF4;font-size: 12px;font-weight: normal; } ",
    ".datagrid table tbody .even td { background: #E1EEF4; color: #00496B; } ",
    ".datagrid table tbody td:first-child { border: none; } ",
    ".datagrid table tfoot td div { border-top: 1px solid #006699;background: #E1EEF4;}  ",
    ".datagrid table tfoot td { padding: 0; font-size: 12px } ",
    ".datagrid table tfoot td div{ padding: 2px; } ",
    ".datagrid table tfoot td ul { margin: 0; padding:0; list-style: none; text-align: right; } ",
    ".datagrid table tfoot li { display: inline; } ",
    ".datagrid table tfoot li a { text-decoration: none; display: inline-block;  padding: 2px 8px; margin: 1px;color: #FFFFFF;",
    "  border: 1px solid #006699;-webkit-border-radius: 3px; -moz-border-radius: 3px; border-radius: 3px; ",
    "  background:-webkit-gradient( linear, left top, left bottom, color-stop(0.05, #006699), color-stop(1, #00557F) );",
    "  background:-moz-linear-gradient( center top, #006699 5%, #00557F 100% ); background-color:#006699; } ",
    ".datagrid table tfoot ul.active, ",
    ".datagrid table tfoot ul a:hover { text-decoration: none;border-color: #006699; color: #FFFFFF; background: none; background-color:#00557F;}",
    '</style>'
    ];

    var html = '<div style="max-width:800px">' + style.join('');

    if (this.postingStatus) {
      var person = this.postingStatus.person;
      html += '<h1 class="title">Person: ' + person.rowDescription + '</h1>';
    }
    //html += '<h2>Last 5 Direct Deposits</h2>';

    html += this.achTemplate.apply({
      pendingItems: pendingItems
    });
    html += this.preauthTemplate.apply(holdData);
    html += this.depositTemplate.apply(holdData);
    html += this.pledgesTemplate.apply(holdData);
    html += this.loginTemplate.apply({
      eBranchLogin: this.eBranchLogin
    });

    html += '</div>';

    this.centerPanel.body.update(html);
  };

  this.main = function() {
    if (CR.Script.debug) {
      debugger;
    }
    this.getPostingStatus(CR.Script.personSerial);
  };

  this.showInViewPort = function() {
    //create the browser window viewport
    var that = this;
    CR.Core.viewPort = new Ext.Viewport({
      layout: 'border',
      items: [
      this.centerPanel
      ],
      listeners: {
        render: function() {
          that.main();
        }
      }
    });
    CR.Core.viewPort.doLayout();
  };

  this.show = function(config) {
    var that = this;
    config.listeners = {
      render: function() {
        that.main();
      }
    };
    this.centerPanel.show(config);
  };
}

if (CR.Script) {
  new MyQuickIQ().showInViewPort();
}
