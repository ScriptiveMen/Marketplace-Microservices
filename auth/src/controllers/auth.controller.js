const userModel = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("../db/redis");
const { publishToQueue } = require("../broker/broker");

async function registerUser(req, res) {
    const {
        username,
        email,
        password,
        fullName: { firstName, lastName },
        addresses,
        role,
    } = req.body;

    const isUserAlreadyExists = await userModel.findOne({
        $or: [{ username }, { email }],
    });

    if (isUserAlreadyExists) {
        return res.status(409).json({ message: "User already exists!" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await userModel.create({
        username,
        email,
        password: hash,
        fullName: {
            firstName,
            lastName,
        },
        addresses,
        role: role || "user",
    });

    // publish user created event to RabbitMQ
    await publishToQueue("AUTH_NOTIFICATION.USER_CREATED", {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
    });

    const token = jwt.sign(
        {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1d" }
    );

    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        maxAge: 24 * 60 * 60 * 1000, // 1day
    });

    res.status(201).json({
        message: "User registered sucessfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            addresses: user.addresses,
        },
    });
}

async function loginUser(req, res) {
    const { username, email, password } = req.body;

    const user = await userModel
        .findOne({
            $or: [{ username }, { email }],
        })
        .select("+password");

    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");

    if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
        {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1d" }
    );

    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
        message: "login successful",
        user: {
            id: user._id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            addresses: user.addresses,
        },
    });
}

async function authMe(req, res) {
    res.status(200).json({
        message: "User fetched sucessfully",
        user: req.user,
    });
}

async function logoutUser(req, res) {
    const { token } = req.cookies;

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (token) {
        await redis.set(`blacklist:${token}`, "true", "EX", 24 * 60 * 60); //expire 1day
    }

    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
    });

    res.status(200).json({
        message: "Logout Sucess",
    });
}

async function getUserAddresses(req, res) {
    const id = req.user.id;

    const user = await userModel.findById(id).select("addresses");

    if (!user) {
        return res.status(404).json({ message: "No user found" });
    }

    res.status(200).json({
        message: "User address fetched sucessfully",
        addresses: user.addresses,
    });
}

async function addUserAddresses(req, res) {
    const id = req.user.id;
    const { street, city, state, pincode, country, isDefault } = req.body;

    // Get user first to check if they have existing addresses
    const existingUser = await userModel.findById(id);
    if (!existingUser) {
        return res.status(401).json({ message: "User not found" });
    }

    // If this is the first address or isDefault is true, make it default
    // If it's not the first address and isDefault is not specified, set to false
    const shouldBeDefault =
        existingUser.addresses.length === 0 || isDefault === true;

    // If making this address default, set all other addresses to non-default
    if (shouldBeDefault && existingUser.addresses.length > 0) {
        await userModel.findByIdAndUpdate(id, {
            $set: { "addresses.$[].isDefault": false },
        });
    }

    const user = await userModel.findOneAndUpdate(
        { _id: id },
        {
            $push: {
                addresses: {
                    street,
                    city,
                    state,
                    pincode,
                    country,
                    isDefault: shouldBeDefault,
                },
            },
        },
        { new: true }
    );

    if (!user) {
        return res.status(401).json({ message: "User not found" });
    }

    const newAddress = user.addresses[user.addresses.length - 1];

    res.status(201).json({
        message: "Address added successfully", // Fixed typo: "sucessfully" -> "successfully"
        address: newAddress, // Changed from "addresses" to "address"
    });
}

async function deleteUserAddress(req, res) {
    const id = req.user.id;
    const { addressId } = req.params;

    try {
        // First, find the user and check if the address exists
        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: "No user found" });
        }

        // Check if the address exists and belongs to this user
        const addressIndex = user.addresses.findIndex(
            (addr) => addr._id.toString() === addressId
        );

        if (addressIndex === -1) {
            return res.status(404).json({ message: "Address not found" });
        }

        // Check if the address to be deleted is the default address
        const addressToDelete = user.addresses[addressIndex];
        const wasDefault = addressToDelete.isDefault;

        // Remove the address from the array
        user.addresses.splice(addressIndex, 1);

        // If the deleted address was default and there are remaining addresses,
        // make the first remaining address the new default
        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
        }

        // Save the updated user
        await user.save();

        // Return success response (without addresses array as tests don't expect it)
        res.status(200).json({
            message: "Address deleted successfully",
            addresses: user.addresses,
        });
    } catch (error) {
        console.error("Delete address error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = {
    registerUser,
    loginUser,
    authMe,
    logoutUser,
    getUserAddresses,
    addUserAddresses,
    deleteUserAddress,
};
