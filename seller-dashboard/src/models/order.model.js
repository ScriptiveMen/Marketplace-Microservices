const mongoose = require("mongoose");

const addAddressSchema = new mongoose.Schema({
    street: String,
    city: String,
    state: String,
    pincode: { type: String, required: true, match: /^[1-9][0-9]{5}$/ },
    country: String,
});

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Types.ObjectId,
            required: true,
        },
        items: [
            {
                product: {
                    type: mongoose.Types.ObjectId,
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    default: 1,
                    min: 1,
                },

                price: {
                    amount: {
                        type: Number,
                        required: true,
                    },
                    currency: {
                        type: String,
                        enum: ["USD", "INR"],
                        default: "INR",
                    },
                },
            },
        ],

        status: {
            type: String,
            enum: ["PENDING", "CONFIRMED", "CANCELLED", "SHIPPED", "DELIVERED"],
        },

        totalPrice: {
            amount: {
                type: Number,
                required: true,
            },
            currency: {
                type: String,
                enum: ["USD", "INR"],
            },
        },

        shippingAddress: {
            type: addAddressSchema,
            required: true,
        },
    },
    { timestamps: true }
);

const orderModel = mongoose.model("order", orderSchema);

module.exports = orderModel;
