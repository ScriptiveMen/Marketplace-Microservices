const paymentModel = require("../models/payment.model");
const axios = require("axios");
require("dotenv").config();
const Razorpay = require("razorpay");
const { publishToQueue } = require("../broker/broker.js");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function createPayment(req, res) {
    const orderId = req.params.orderId;

    const token =
        req.cookies?.token || req.headers?.authorization?.split(" ")[1];

    try {
        const orderResponse = await axios(
            `http://localhost:3003/api/orders/${orderId}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        const price = orderResponse.data.order.totalPrice;

        const order = await razorpay.orders.create(price);

        const payment = await paymentModel.create({
            order: orderId,
            razorpayOrderId: order.id,
            user: req.user.id,
            price: {
                amount: order.amount,
                currency: order.currency,
            },
        });

        res.status(201).json({ message: "Payment initiated", payment });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
}

async function verifyPayment(req, res) {
    const { razorpayOrderId, paymentId, signature } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;

    try {
        const {
            validatePaymentVerification,
        } = require("../../node_modules/razorpay/dist/utils/razorpay-utils.js");

        const isValid = validatePaymentVerification(
            {
                order_id: razorpayOrderId,
                payment_id: paymentId,
            },
            signature,
            secret
        );

        if (!isValid) {
            return res.status(400).json({ message: "Invalid signature" });
        }

        const payment = paymentModel.findOne({
            razorpayOrderId,
            status: "PENDING",
        });

        if (!payment) {
            return res.status(400).json({ message: "Payment not found" });
        }

        payment.paymentId = paymentId;
        payment.signature = signature;
        payment.status = "COMPLETED";

        await payment.save();

        await publishToQueue("PAYMENT_NOTIFICATION.PAYMENT_COMPLETED", {
            email: req.user.email,
            fullName: req.user.fullName,
            orderId: payment.order,
            paymentId: payment.paymentId,
            amount: payment.price.amount / 100,
            currency: payment.price.currency,
        });

        res.staus(200).json({
            message: "Payment verified sucessfully",
            payment,
        });
    } catch (error) {
        await publishToQueue("PAYMENT_NOTIFICATION.PAYMENT_FAILED", {
            email: req.user.email,
            username: req.user.username,
            orderId: razorpayOrderId,
        });

        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = { createPayment, verifyPayment };
