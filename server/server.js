const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const bcrypt = require('bcryptjs');
var app = express();

const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.listen(port, () => {
    console.log(`Started on port ${port}`);
});

module.exports = {app};