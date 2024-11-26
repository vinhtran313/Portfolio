
const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  symbol: String,
  entryPrice: Number,
  closedPrice: Number,
  currentPrice: Number,
  volume: Number,
  type: String,
  timestamp: { type: Date, default: Date.now },
  closed: Boolean,
  profit: Number
});

const Trade = mongoose.model('Trade',tradeSchema);

module.exports = Trade;
