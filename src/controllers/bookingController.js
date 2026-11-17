const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Store = require("../models/Store");

const TIME_ZONE = "Asia/Kolkata";

// Convert a date into the store's local day and time.
const getLocalDateTime = (date) => {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    day: values.weekday.toLowerCase(),
    time: `${values.hour}:${values.minute} ${values.dayPeriod.toUpperCase()}`,
  };
};

// Convert a 12-hour time into minutes for comparison.
const getMinutes = (time) => {
  const match = time.match(/^(\d{2}):(\d{2}) (AM|PM)$/);

  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 1 || hours > 12 || minutes > 59) {
    return null;
  }

  if (match[3] === "AM" && hours === 12) hours = 0;
  if (match[3] === "PM" && hours !== 12) hours += 12;

  return hours * 60 + minutes;
};

// Create a Phone Charging booking.
const createPhoneChargingBooking = async (req, res) => {
  try {
    const { storeId, startAt } = req.body;

    if (
      typeof storeId !== "string" ||
      !mongoose.Types.ObjectId.isValid(storeId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID.",
      });
    }

    if (
      typeof startAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        startAt,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid start date and time with timezone.",
      });
    }

    const selectedStartAt = new Date(startAt);

    if (Number.isNaN(selectedStartAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking date and time.",
      });
    }

    // Require booking times to use exact minute precision.
    if (
      selectedStartAt.getUTCSeconds() !== 0 ||
      selectedStartAt.getUTCMilliseconds() !== 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Booking time must be selected in exact minutes.",
      });
    }

    // Reject booking times that have already passed.
    if (selectedStartAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Please select a future booking time.",
      });
    }

    // Find an active store that offers Phone Charging.
    const store = await Store.findOne({
      _id: storeId,
      services: "Phone Charging",
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }).select("weeklyTimings");

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found or Phone Charging is unavailable.",
      });
    }

    // Check the selected time against the store's weekly schedule.
    const localDateTime = getLocalDateTime(selectedStartAt);
    const dayTiming = store.weeklyTimings?.[localDateTime.day];

    if (!dayTiming || dayTiming.isClosed) {
      return res.status(400).json({
        success: false,
        message: "The store is closed on the selected day.",
      });
    }

    const openingMinutes = getMinutes(dayTiming.openTime);
    const closingMinutes = getMinutes(dayTiming.closeTime);
    const selectedMinutes = getMinutes(localDateTime.time);

    if (
      openingMinutes === null ||
      closingMinutes === null ||
      selectedMinutes === null ||
      closingMinutes <= openingMinutes
    ) {
      return res.status(400).json({
        success: false,
        message: "The store's operating hours are invalid.",
      });
    }

    if (selectedMinutes < openingMinutes || selectedMinutes >= closingMinutes) {
      return res.status(400).json({
        success: false,
        message: "Selected time is outside store operating hours.",
      });
    }

    // Save the booking; the database index prevents duplicate active times.
    const booking = await Booking.create({
      storeId: store._id,
      customerId: req.customer._id,
      service: "Phone Charging",
      startAt: selectedStartAt,
    });

    return res.status(201).json({
      success: true,
      message: "Phone Charging booking created successfully.",
      data: booking,
    });
  } catch (error) {
    // Handle simultaneous booking attempts for the same start time.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This start time is already booked. Please choose another time.",
      });
    }

    console.error("[Booking] Phone Charging booking failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create booking. Please try again.",
    });
  }
};

// Create a Pick Me Later storage booking.
const createPickMeLaterBooking = async (req, res) => {
  try {
    const { storeId, startAt } = req.body;

    if (
      typeof storeId !== "string" ||
      !mongoose.Types.ObjectId.isValid(storeId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID.",
      });
    }

    if (
      typeof startAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        startAt,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid storage date and time with timezone.",
      });
    }

    const selectedStartAt = new Date(startAt);

    if (Number.isNaN(selectedStartAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid storage date and time.",
      });
    }

    // Require booking times to use exact minute precision.
    if (
      selectedStartAt.getUTCSeconds() !== 0 ||
      selectedStartAt.getUTCMilliseconds() !== 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Booking time must be selected in exact minutes.",
      });
    }

    // Reject storage times that have already passed.
    if (selectedStartAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Please select a future storage time.",
      });
    }

    // Find an active store that offers Pick Me Later.
    const store = await Store.findOne({
      _id: storeId,
      services: "Pick Me Later",
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }).select("weeklyTimings");

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found or Pick Me Later is unavailable.",
      });
    }

    // Check the selected time against the store's weekly schedule.
    const localDateTime = getLocalDateTime(selectedStartAt);
    const dayTiming = store.weeklyTimings?.[localDateTime.day];

    if (!dayTiming || dayTiming.isClosed) {
      return res.status(400).json({
        success: false,
        message: "The store is closed on the selected day.",
      });
    }

    const openingMinutes = getMinutes(dayTiming.openTime);
    const closingMinutes = getMinutes(dayTiming.closeTime);
    const selectedMinutes = getMinutes(localDateTime.time);

    if (
      openingMinutes === null ||
      closingMinutes === null ||
      selectedMinutes === null ||
      closingMinutes <= openingMinutes
    ) {
      return res.status(400).json({
        success: false,
        message: "The store's operating hours are invalid.",
      });
    }

    if (selectedMinutes < openingMinutes || selectedMinutes >= closingMinutes) {
      return res.status(400).json({
        success: false,
        message: "Selected time is outside store operating hours.",
      });
    }

    // Save the storage booking.
    const booking = await Booking.create({
      storeId: store._id,
      customerId: req.customer._id,
      service: "Pick Me Later",
      startAt: selectedStartAt,
    });

    return res.status(201).json({
      success: true,
      message: "Pick Me Later storage booking created successfully.",
      data: booking,
    });
  } catch (error) {
    // Handle simultaneous booking attempts for the same Store and time.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This time is already booked. Please choose another time.",
      });
    }

    console.error("[Booking] Pick Me Later booking failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create storage booking. Please try again.",
    });
  }
};

// Get bookings belonging to the authenticated Shop Owner's store.
const getShopOwnerBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      storeId: req.store._id,
    })
      .populate("customerId", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Store bookings fetched successfully.",
      data: {
        bookings,
      },
    });
  } catch (error) {
    console.error("[Booking] Failed to fetch store bookings:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch bookings.",
    });
  }
};

// Update a booking's status from the Shop Owner app.
const updatePhoneChargingBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    if (!["in_progress", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status.",
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      storeId: req.store._id,
      service: { $in: ["Phone Charging", "Pick Me Later"] },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (booking.service === "Phone Charging") {
      if (
        (booking.status === "confirmed" && status !== "in_progress") ||
        (booking.status === "in_progress" && status !== "completed") ||
        booking.status === "completed"
      ) {
        return res.status(409).json({
          success: false,
          message: "Invalid Phone Charging booking status transition.",
        });
      }
    }

    if (booking.service === "Pick Me Later") {
      if (booking.status !== "confirmed" || status !== "completed") {
        return res.status(409).json({
          success: false,
          message:
            "Pick Me Later booking can only be completed when the phone is collected.",
        });
      }
    }

    booking.status = status;
    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully.",
      data: {
        booking,
      },
    });
  } catch (error) {
    console.error("[Booking] Failed to update booking status:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update booking status.",
    });
  }
};

// Get booked Phone Charging start times for a selected date.
const getPhoneChargingAvailability = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID.",
      });
    }

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid date in YYYY-MM-DD format.",
      });
    }

    const [year, month, day] = date.split("-").map(Number);
    const dateCheck = new Date(Date.UTC(year, month - 1, day));

    if (
      year < 1000 ||
      dateCheck.getUTCFullYear() !== year ||
      dateCheck.getUTCMonth() !== month - 1 ||
      dateCheck.getUTCDate() !== day
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar date.",
      });
    }

    // Confirm the Store is active and offers Phone Charging.
    const store = await Store.findOne({
      _id: storeId,
      services: "Phone Charging",
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }).select("_id");

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found or Phone Charging is unavailable.",
      });
    }

    // Calculate the selected date boundaries in India time.
    const startOfDay = new Date(
      Date.UTC(year, month - 1, day) - 330 * 60 * 1000,
    );

    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const bookings = await Booking.find({
      storeId: store._id,
      service: "Phone Charging",
      status: { $in: ["confirmed", "in_progress"] },
      startAt: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    })
      .select("startAt -_id")
      .sort({ startAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Phone Charging availability fetched successfully.",
      data: {
        date,
        bookedTimes: bookings.map((booking) => booking.startAt),
      },
    });
  } catch (error) {
    console.error("[Booking] Failed to fetch availability:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch booking availability.",
    });
  }
};

// Get booking history for the authenticated Customer.
const getCustomerBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      customerId: req.customer._id,
    })
      .populate("storeId", "name addressLink image")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Customer bookings fetched successfully.",
      data: {
        bookings,
      },
    });
  } catch (error) {
    console.error(
      "[Booking] Failed to fetch Customer bookings:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch booking history.",
    });
  }
};

// Get booked Pick Me Later storage times for a selected date.
const getPickMeLaterAvailability = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID.",
      });
    }

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid date in YYYY-MM-DD format.",
      });
    }

    const [year, month, day] = date.split("-").map(Number);
    const dateCheck = new Date(Date.UTC(year, month - 1, day));

    if (
      year < 1000 ||
      dateCheck.getUTCFullYear() !== year ||
      dateCheck.getUTCMonth() !== month - 1 ||
      dateCheck.getUTCDate() !== day
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid calendar date.",
      });
    }

    // Confirm the Store is active and offers Pick Me Later.
    const store = await Store.findOne({
      _id: storeId,
      services: "Pick Me Later",
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }).select("_id");

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found or Pick Me Later is unavailable.",
      });
    }

    // Calculate the selected date boundaries in India time.
    const startOfDay = new Date(
      Date.UTC(year, month - 1, day) - 330 * 60 * 1000,
    );

    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const bookings = await Booking.find({
      storeId: store._id,
      service: "Pick Me Later",
      status: { $in: ["confirmed", "in_progress"] },
      startAt: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    })
      .select("startAt -_id")
      .sort({ startAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Pick Me Later availability fetched successfully.",
      data: {
        date,
        bookedTimes: bookings.map((booking) => booking.startAt),
      },
    });
  } catch (error) {
    console.error(
      "[Booking] Failed to fetch Pick Me Later availability:",
      error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch storage availability.",
    });
  }
};

module.exports = {
  createPhoneChargingBooking,
  getShopOwnerBookings,
  updatePhoneChargingBookingStatus,
  getPhoneChargingAvailability,
  getCustomerBookings,
  createPickMeLaterBooking,
  getPickMeLaterAvailability,
};
