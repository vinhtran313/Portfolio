const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();
const bodyParser = require("body-parser");
const app = express();
const cron = require("node-cron");
const User = require("./schema/user");
const Trade = require("./schema/trade");
const TelegramBot = require("node-telegram-bot-api");
const moment = require("moment-timezone");

const botToken = process.env.BOT_TOKEN;

const bot = new TelegramBot(botToken, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ name: "BabyMango" });
  user.chatId = chatId;
  await user.save();
  bot.sendMessage(chatId, "I saved your info");
});

app.use(bodyParser.json());
const connectionString = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}/${process.env.DB_NAME}`;

mongoose.connect(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.once("open", () => {
  console.log("Connected to DB");
});

const calculateProfit = async () => {
  const VNT = moment().tz("Asia/Ho_Chi_Minh");
  const currentHour = VNT.hour();

  if (currentHour >= 0 && currentHour < 8) {
    console.log("Không chạy trong giờ ngủ");
    return;
  } else {
    const trades = await Trade.find({ closed: false });
    const user = await User.findOne({ name: "BabyMango" });
    let totalProfit = 0;
    let portfolio = [];
    let message = "";
    if (trades.length) {
      for (let trade of trades) {
        try {
          const response = await axios.get(
            `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${trade.symbol}`
          );
          const currentPrice = parseFloat(response.data.markPrice);
          let profit = 0;

          if (trade.type == "long") {
            profit =
              ((currentPrice - trade.entryPrice) / trade.entryPrice) *
              trade.volume;
          } else if (trade.type == "short") {
            profit =
              ((trade.entryPrice - currentPrice) / trade.entryPrice) *
              trade.volume;
          }
          trade.currentPrice = currentPrice;
          trade.profit = profit.toFixed(2);
          totalProfit += trade.profit;
          await trade.save();
          portfolio.push({
            symbol: trade.symbol,
            price: currentPrice.toFixed(2),
            profit: trade.profit.toFixed(2),
          });
        } catch (error) {
          console.log(error);
        }
      }
    }
    user.profit = totalProfit;
    await user.save();
    message = `Profit hiện tại là: ${user.profit.toFixed(2)}
    \nTài sản ước tính: ${user.balance + user.profit.toFixed(2)}
    \nDanh mục đầu tư:\n`;
    portfolio.forEach((item) => {
      message += ` - ${item.symbol}: ${item.price} - Lợi nhuận: ${item.profit}\n`;
    });
    bot.sendMessage(user.chatId, message);
  }
};

const PORT = 3000;

cron.schedule("* * * * *", calculateProfit);

app.post("/api/tradeClose", async (req, res) => {
  try {
    const body = req.body;
    const trade = await Trade.findOne({ symbol: body.symbol, closed: false });
    const user = await User.findOne({ name: "BabyMango" });

    trade.closed = true;
    trade.closedPrice = body.closedPrice;
    let profit = 0;

    if (trade.type == "long") {
      profit =
        ((body.closedPrice - trade.entryPrice) / trade.entryPrice) *
        trade.volume;
    } else if (trade.type == "short") {
      profit =
        ((trade.entryPrice - body.closedPrice) / trade.entryPrice) *
        trade.volume;
    }

    trade.profit = profit.toFixed(2);
    await trade.save();
    user.balance += profit.toFixed(2);
    await user.save();
    res.status(200).send({ user, trade });
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.post("/api/tradeOpen", async (req, res) => {
  try {
    const body = req.body;
    const trade = new Trade({
      symbol: body.symbol,
      entryPrice: body.entryPrice,
      volume: body.volume * body.entryPrice,
      type: body.type,
      closed: false,
      closedPrice: 0,
      profit: 0
    })
    await trade.save()
    res.status(201).send(trade);
  } catch (error) {
    console.log(error)
    res.status(500).send(error)
  }
})

app.post("/api/ping", (req,res)=> {
  res.send('App is alive');
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
