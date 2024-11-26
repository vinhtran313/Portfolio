const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  balance: Number,
  profit: Number,
  chatId: String,
});

const User = mongoose.model('User',userSchema);

module.exports = User;
