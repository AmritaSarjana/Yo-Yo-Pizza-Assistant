const mongoose = require('../mongoConnection');

const order = new mongoose.Schema({
    itemNumber: {
        type: Number
    },
    name: {
        type: String
    },
    age: { type: Number },
    address: { type: String }
});

module.exports = mongoose.model('order', order);
