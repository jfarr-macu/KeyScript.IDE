console.clear();
console.log('Hello console');

console.debug('my debug message');
console.info('my info message');
console.warn('my warn message');
console.error('my error message');

console.info('console.log(CR.Script)');

var myVariable = {
  my: 'object',
  value: 1,
  myArray: [1,2,3],
  otherObject: {
    hello: 'world'
  }
};
console.log('myVariable', myVariable);


//
console.log('CR.Login', CR.Login);
//
//
//
//console.info('console.dir(CR.Script)');
//console.dir(CR.Script);
//
//console.info('console.log(CR.Login)');
//console.log('CR.Login', CR.Login);
//console.log('CR', CR);

var simple = new Ext.FormPanel({
  labelWidth: 75, // label settings here cascade unless overridden
  url: 'save-form.php',
  frame: true,
  title: 'Simple Form',
  bodyStyle: 'padding:5px 5px 0',
  width: 350,
  defaults: {width: 230},
  defaultType: 'textfield',

  items: [{
      fieldLabel: 'First Name',
      name: 'first',
      allowBlank: false
    }, {
      fieldLabel: 'Last Name',
      name: 'last'
    }, {
      fieldLabel: 'Company',
      name: 'company'
    }, {
      fieldLabel: 'Email',
      name: 'email',
      vtype: 'email'
    }, new Ext.form.TimeField({
      fieldLabel: 'Time',
      name: 'time',
      minValue: '8:00am',
      maxValue: '6:00pm'
    })
  ],

  buttons: [{
      text: 'Save'
    }, {
      text: 'Cancel'
    }]
});