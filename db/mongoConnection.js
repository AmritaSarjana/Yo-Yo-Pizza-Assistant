const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect('c+srv://Amrita:wH9gbcIbNddFVWXx@cluster0-oeilr.mongodb.net/test?retryWrites=true&w=majority', { useNewUrlParser: true });
module.exports = mongoose;
