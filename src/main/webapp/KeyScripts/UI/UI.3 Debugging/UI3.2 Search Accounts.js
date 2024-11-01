console.clear();
console.info('UI.2.1 Search Accounts.js');

var xml = new CR.XML();
var sequence = xml.addContainer(xml.getRootElement(),'sequence');
var transaction = xml.addContainer(sequence,'transaction');
var step = xml.addContainer(transaction, 'step');
var search = xml.addContainer(step, 'search');
xml.addText(search, 'tableName', 'ACCOUNT');
xml.addText(search, 'filterName', 'BY_PRIMARY_PERSON_SERIAL');
xml.addOption(search, 'includeSelectColumns', 'Y');
xml.addOption(search, 'includeTotalHitCount', 'N');
xml.addCount(search, 'returnLimit', '100');
var parameter = xml.addContainer(search, 'parameter');
xml.addText(parameter, 'columnName', 'PRIMARY_PERSON_SERIAL');
xml.addSerial(parameter, 'contents', CR.Script.personSerial);

console.info('request');
console.log(xml);

console.info('request.serialize()');
console.log(xml.serialize());

//    console.info('request.toJSON()');
//    console.log(request.toJSON());
//
//    console.info('JSON.stringify(request.toJSON(), null, 2)');
//    console.log(JSON.stringify(request.toJSON(), null, 2));

CR.Core.ajaxRequest({
  url: 'DirectXMLPostJSON',
  xmlData: xml.getXMLDocument(),
  success: function(response) {
    console.info('response', response);
    var responseJSON = CR.JSON.parse(response.responseText);
    console.info('responseJSON', responseJSON);
    var query = responseJSON.query;
    var transactionResult = 'failed';
    var errorArray = [];
    var resultRows = [];
    if (responseJSON.query){
      sequence = query.sequence;
      if (sequence){
        for (var i=0; i<sequence.length; i++) {
          transaction = sequence[i].transaction;
          if (transaction){
            for (var j=0; j<transaction.length; j++) {
              transactionResult = transaction[j].$attr.result;
              step = transaction[j].step;
              for (var k=0; k<step.length; k++) {
                if (step[k].search) {
                  if (step[k].search.resultRow) {
                    resultRows = step[k].search.resultRow;
                    console.log('resultRows', resultRows);
                  }
                }
                var tranResult = step[k].tranResult;
                if (tranResult && tranResult.category && tranResult.category.option === 'E') {
                  errorArray.push(tranResult.description);
                }
              }
            }
          }
        }
      }
    }
    if (transactionResult !== 'posted') {
      CR.Core.displayExceptions({
        items: errorArray
      });
    } else {
      getAccountRecords(resultRows);
    }
  }
});

function getAccountRecords(resultRows) {}