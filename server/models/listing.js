const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const validator = require('validator');
const _ = require('lodash');

var Listing = mongoose.model("Listing", {
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        minlength: 1
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    active: {
        type: Boolean,
        required: true
    }
});

module.exports = {Listing};