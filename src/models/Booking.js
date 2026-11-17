
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        // Link the booking to the selected Store.
        storeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Store",
            required: true,
        },

        // Link the booking to the Customer.
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },

        // Store the selected service.
        service: {
            type: String,
            enum: ["Phone Charging", "Pick Me Later"],
            required: true,
        },

        // Store the exact customer-selected start date and time.
        startAt: {
            type: Date,
            required: true,
        },

        // Track the booking and charging session status.
        status: {
            type: String,
            enum: ["confirmed", "in_progress", "completed"],
            default: "confirmed",
        },
    },
    {
        timestamps: true,
        collection: "Bookings",
    }
);

// Prevent duplicate active bookings for the same Store, service, and start time.
bookingSchema.index(
    {
        storeId: 1,
        service: 1,
        startAt: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            status: {
                $in: ["confirmed", "in_progress"],
            },
        },
    }
);

// Index Customer booking history.
bookingSchema.index({
    customerId: 1,
    createdAt: -1,
});

// Index Store booking management.
bookingSchema.index({
    storeId: 1,
    createdAt: -1,
});

// Create the Booking model.
const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
