
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
    {
        // 1. Store the customer's unique phone number.
        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: /^[0-9]{10}$/,
        },

        // 2. Store the customer's name when provided.
        name: {
            type: String,
            trim: true,
            minlength: 2,
            maxlength: 100,
            default: null,
        },
    },
    {
        timestamps: true,
        collection: "Customers",
    }
);

// 3. Create the Customer model.
const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
