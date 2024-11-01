var myTextField = new CR.TextField({
  crColumnDescription: 'My Field',
  crColumnName: 'cuTextField2',
  crContents: 'Some text from the script'
});

var myOptionField = new CR.OptionField({
  crColumnDescription: 'Option Field HERE',
  crColumnName: 'myOptionFiled',
  crOptions: [
    ["A", "Option A"],
    ["B", "Option B"],
    ["C", "Option C"],
    ["D", "Option DDDDD"],
    ["E", "Option E"]
  ]
});

var moneyField2 = new CR.MoneyField({
  //xtype: 'crMoneyField',
  crColumnDescription: 'Money Field 2',
  crColumnName: 'BALANCE',
  crContents: '1999.99'
});

var myFormPanel = new CR.FormPanel({
  labelWidth: 175,
//    frame: true,
  title: 'Sample Corelation Data Types',
  bodyStyle: 'padding:5px 5px 0',
//    width: 450,
  defaults: {
    width: 230
  },
  items: [
    new CR.OptionField({
      xtype: 'crOptionField',
      crColumnDescription: 'Option Field',
      crColumnName: 'myOptionFiled',
      crOptions: [
        ["A", "Option A"],
        ["B", "Option B"],
        ["C", "Option C"],
        ["D", "Option DDDDD"]
      ]
    }),
    myTextField,
    moneyField2,
    myOptionField,
    {
      xtype: 'crTextField',
      crColumnDescription: 'Text Field Example',
      crColumnName: 'cuTextField'
    }, {
      xtype: 'crMoneyField',
      crColumnDescription: 'Money Field',
      crColumnName: 'myMoneyFiled'
    }, {
      xtype: 'crDateField',
      crColumnDescription: 'Date Field',
      crColumnName: 'myDateFiled'
    }, {
      xtype: 'crRateField',
      crColumnDescription: 'Rate Field',
      crColumnName: 'myRateFiled'
    }, {
      xtype: 'crOptionField',
      crColumnDescription: 'Option Field',
      crColumnName: 'myOptionFiled',
      crOptions: [
        ["A", "Option A"],
        ["B", "Option B"],
        ["C", "Option C"],
        ["D", "Option DDDDD"]
      ]
    }, {
      xtype: 'crCheckbox',
      crColumnDescription: 'Checkbox Field',
      crColumnName: 'myCheckbox'
    }, {
      xtype: 'crCountField',
      crColumnDescription: 'Count Field',
      crColumnName: 'myCountField'
    }, {
      xtype: 'crSerialField',
      crColumnDescription: 'Account',
      crTableName: 'ACCOUNT',
      crColumnName: 'SERIAL'
    }
  ],

  buttons: [{
      text: 'Log Values',
      listeners: {
        click: function(button, event) {
          var logValue = function(fieldName) {
            var field = myFormPanel.find('crColumnName', fieldName).shift();          var fields = myFormPanel.find('crColumnName', fieldName);
            if (field) {
              console.log(fieldName, field.crGetNewContents());
            } else {
              console.warn(fieldName, 'does not exist')
            }
          };
          console.clear();
          console.info('Current field values:');
          logValue('myTextField');
          logValue('myMoneyFiled');
          logValue('myDateFiled');
          logValue('myRateFiled');
          logValue('myOptionFiled');
          logValue('myCheckbox');
          logValue('myCountField');
          logValue('myCountFieldXXXX');
        }
      }
    }],
  buttonAlign: 'left'

});


CR.Core.viewPort = new Ext.Viewport({
  layout: 'fit',
  items: [ myFormPanel ],
  listeners: {
    render: function() {
      //getPostingStatus();
    }
  }
});
