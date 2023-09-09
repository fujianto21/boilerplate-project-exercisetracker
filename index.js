require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');

app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// GET: Homepage
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// START: Database
const MONGO_URI = process.env['MONGO_URI'];
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const UserSchema = mongoose.Schema({
  username: String,
  count: Number,
  log: [Object]
});
const UserModel = mongoose.model('User', UserSchema, 'et_user');
// END: Database

// Date Formatted (EX: 2023-09-09)
const dateFormatted = (date) => {
  return date.toJSON().slice(0, 10);
}

// POST: Create User
app.post("/api/users", (req, res) => {
  const { username } = req.body;

  const userData = new UserModel({
    username: username,
    count: 0,
    log: []
  });

  userData.save((err, data) => {
    if (err) return res.json({ error: "Failed to save in database" });
    const { username, _id } = data;
    res.json({ username, _id });
  });
});

// GET: List User
app.get("/api/users", (req, res) => {
  UserModel.find({}, (err, data) => {
    if (err) return console.error(err);
    const result = data.map((item) => {
      return { '_id': item._id, 'username': item.username };
    });
    res.json(result);
  });
});

// POST: Create Exercises by UserId
app.post("/api/users/:_id/exercises", (req, res) => {
  const idUser = req.params._id;
  const { description, duration, date } = req.body;
  const durationInt = Number(duration);
  let dateInsert = new Date(date);
  if (dateInsert == "Invalid Date") dateInsert = new Date(Date.now());
  const dateString = dateInsert.toDateString();
  dateInsert = dateFormatted(dateInsert);

  UserModel.findById(idUser, function (err, data) {
    if (data == null) return res.json({ error: "id not found" });
    if (err) return console.error(err);

    data.log.push({ description, duration: durationInt, date: dateInsert });
    data.count = data.log.length;
    data.save(function (err, dataSaved) {
      if (err) return console.error(err);
      const { _id, username } = dataSaved;
      const exercisesResult = {
        username: username,
        description: description,
        duration: durationInt,
        date: dateString,
        _id: _id
      }
      res.json(exercisesResult);
    });
  });
});

// GET: List Exercises by UserId
app.get("/api/users/:_id/logs", (req, res) => {
  const idUser = req.params._id;
  let { from, to, limit } = req.query;

  let whereClause = {};
  if (from && to) {
    whereClause = {
      _id: idUser,
      'log.date': {
        $gte: from,
        $lte: to,
      },
    };
  } else {
    whereClause = { _id: idUser };
  }

  UserModel.find(whereClause)
    .select({})
    .exec(function (err, data) {
      if (err) return console.error(err);
      const { username, count, _id, log } = data[0];
      const logFormatted = log.map(({ description, duration, date }) => {
        const dateString = new Date(date).toDateString();
        return { description, duration, 'date': dateString }
      });
      let logResult = logFormatted;
      if (limit > 0) {
        logResult = [];
        for (let i = 0; i < limit; i++) {
          if (i < limit && i < logFormatted.length) logResult.push(logFormatted[i]);
        }
      }
      const result = { _id, username, count, 'log': logResult };
      res.json(result);
    });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
