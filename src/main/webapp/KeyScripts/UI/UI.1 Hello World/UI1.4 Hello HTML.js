CR.Core.viewPort = new Ext.Viewport({
  layout: 'border',
  items: [{
      title: 'Panel title',
      region: 'center',
      xtype: 'panel', // see Ext.Component
//    padding: 5,
      buttons: [{
          text: 'button1',
          handler: function() {
            alert('You pressed button1');
          }
        }, {
          text: 'button2',
          handler: function() {
            alert('You pressed button2');
          }
        }],
      bodyStyle: {
        padding: '5px',
        font: '12px arial,tahoma,helvetica,sans-serif'
      },
      html:
          '<h1>Hello HTML!</h1>' +
          '<p>This is a paragraph</p>'
    }]
});