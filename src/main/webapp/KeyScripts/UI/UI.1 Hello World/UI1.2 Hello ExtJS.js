//
// Show a dialog using config options:
Ext.Msg.show({
   title:'Save Changes?',
   msg: 'Would you like to save your changes?',
   buttons: Ext.Msg.YESNO,
   fn: function(selection) {
     Ext.Msg.alert('Your selection', selection);
   },
   animEl: 'elId',
   icon: Ext.MessageBox.QUESTION
});
