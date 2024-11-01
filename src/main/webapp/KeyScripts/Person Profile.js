var centerPanel = new CR.Panel({
  region: 'center',
  //title: 'Center Panel',
  html: 'This is the Center Panel.',
  buttons: [
  ],
  listeners: {
    render: function() {
    }
  }
});
//create the browser window viewport
CR.Core.viewPort = new Ext.Viewport({
  layout: 'border',
  items: [
    centerPanel
  ],
  listeners: {
    render: function() {
      var xml = new CR.XML();
      var sequence = xml.addContainer(xml.getRootElement(), 'sequence');
      var transaction = xml.addContainer(sequence, 'transaction');
      var step = xml.addContainer(transaction, 'step');
      var postingStatus = xml.addContainer(step, 'postingStatus');
      xml.addText(postingStatus, 'tableName', 'PERSON');
      xml.addText(postingStatus, 'targetSerial', CR.Script.personSerial);
      CR.Core.ajaxRequest({
        url: 'DirectXMLPostJSON',
        xmlData: xml.getXMLDocument(),
        params: {
        },
        scope: this,
        success: function(response) {
          var responseJson = CR.JSON.parse(response.responseText);
          var query = responseJson.query;
          var tranResult = 'failed';
          var errorArray = [];
          var postingStatus = null;
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
                        if (step[k].postingStatus) {
                          postingStatus = step[k].postingStatus;
                        } else if (step[k].tranResult && step[k].tranResult.category &&
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
          } else if (postingStatus) {
            var html = '';
            var person = postingStatus.person;
            html += '<table><tr>';
            html += '<td>Hello <br />' + person.rowDescription;
            html += '</table>';
            centerPanel.body.update(html);
          }
        }
      });
    }
  }
});
CR.Core.viewPort.doLayout();