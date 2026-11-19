const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Store = require("../models/Store");
const { getIO } = require("../config/socket");
const Customer = require("../models/Customer");
const Notification = require("../models/Notification");

const notifyStoreBooking = (event, booking, customerName) => {
  try {
    getIO()
      .to(`store:${booking.storeId}`)
      .emit(event, {
        booking: {
          id: booking._id,
          service: booking.service,
          startAt: booking.startAt,
          status: booking.status,
          customerName: customerName || "Customer",
        },
      });
  } catch (error) {
    console.error("[Socket] Booking notification failed:", error.message);
  }
};

const createStoreNotification = async (event, booking, customerName) => {
  const name = customerName || "Customer";

  try {
    const isNewBooking = event === "new_booking";

    await Notification.create({
      storeId: booking.storeId,
      bookingId: booking._id,
      type: event,
      title: isNewBooking ? "New Booking" : "Booking Completed",
      message: isNewBooking
        ? `${name} booked ${booking.service}.`
        : `${name}'s ${booking.service} booking has been completed.`,
    });
  } catch (error) {
    console.error(
      "[Notifications] Failed to save notification:",
      error.message,
    );
  }

  notifyStoreBooking(event, booking, name);
};

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

// Validate the calendar date in a booking date-time string.
const isValidCalendarDate = (dateString) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
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

    if (!isValidCalendarDate(startAt.slice(0, 10))) {
      return res.status(400).json({
        success: false,
        message: "Invalid storage calendar date.",
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

    await createStoreNotification("new_booking", booking, req.customer.name);

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

    if (!isValidCalendarDate(startAt.slice(0, 10))) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking calendar date.",
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

    await createStoreNotification("new_booking", booking, req.customer.name);

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


// Get cursor-paginated bookings grouped by service for the authenticated Shop Owner's store.
const getShopOwnerBookings = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const service = req.query.service || "all";
    const cursor = req.query.cursor;

    // Validate pagination parameters.
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters.",
      });
    }

    // Validate service filter.
    if (!["all", "Phone Charging", "Pick Me Later"].includes(service)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking service filter.",
      });
    }

    const query = {
      storeId: req.store._id,
    };

    if (service !== "all") {
      query.service = service;
    }

    // Validate and apply the pagination cursor.
    if (cursor !== undefined) {
      if (typeof cursor !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid booking cursor.",
        });
      }

      const cursorParts = cursor.split("|");

      if (
        cursorParts.length !== 2 ||
        Number.isNaN(new Date(cursorParts[0]).getTime()) ||
        !mongoose.Types.ObjectId.isValid(cursorParts[1])
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking cursor.",
        });
      }

      const cursorDate = new Date(cursorParts[0]);
      const cursorId = new mongoose.Types.ObjectId(cursorParts[1]);

      query.$or = [
        { createdAt: { $lt: cursorDate } },
        {
          createdAt: cursorDate,
          _id: { $lt: cursorId },
        },
      ];
    }

    // Fetch one extra booking to determine whether another page exists.
    const [fetchedBookings, serviceCounts] = await Promise.all([
      Booking.find(query)
        .populate("customerId", "name")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean(),

      Booking.aggregate([
        {
          $match: {
            storeId: req.store._id,
            ...(service !== "all" ? { service } : {}),
          },
        },
        {
          $group: {
            _id: "$service",
            total: { $sum: 1 },
          },
        },
      ]),
    ]);

    const hasNextPage = fetchedBookings.length > limit;
    const bookings = fetchedBookings.slice(0, limit);

    // Calculate the next action on the backend.
    const bookingsWithActions = bookings.map((booking) => {
      let nextAction = null;

      if (
        booking.service === "Phone Charging" &&
        booking.status === "confirmed"
      ) {
        nextAction = {
          label: "Start Service",
          status: "in_progress",
        };
      } else if (
        booking.service === "Phone Charging" &&
        booking.status === "in_progress"
      ) {
        nextAction = {
          label: "Complete Service",
          status: "completed",
        };
      } else if (
        booking.service === "Pick Me Later" &&
        booking.status === "confirmed"
      ) {
        nextAction = {
          label: "Mark Collected",
          status: "completed",
        };
      }

      return {
        ...booking,
        customerName: booking.customerId?.name || "Customer",
        nextAction,
      };
    });

    const phoneChargingBookings = bookingsWithActions.filter(
      (booking) => booking.service === "Phone Charging"
    );

    const pickMeLaterBookings = bookingsWithActions.filter(
      (booking) => booking.service === "Pick Me Later"
    );

    const phoneChargingCount =
      serviceCounts.find((item) => item._id === "Phone Charging")?.total || 0;

    const pickMeLaterCount =
      serviceCounts.find((item) => item._id === "Pick Me Later")?.total || 0;

    const totalBookings = serviceCounts.reduce(
      (total, item) => total + item.total,
      0
    );

    // Build the cursor from the last booking returned.
    const lastBooking = bookings[bookings.length - 1];

    const nextCursor =
      hasNextPage && lastBooking
        ? `${lastBooking.createdAt.toISOString()}|${lastBooking._id}`
        : null;

    return res.status(200).json({
      success: true,
      message: "Store bookings fetched successfully.",
      data: {
        phoneCharging: {
          bookings: phoneChargingBookings,
          totalBookings: phoneChargingCount,
        },
        pickMeLater: {
          bookings: pickMeLaterBookings,
          totalBookings: pickMeLaterCount,
        },
        pagination: {
          totalBookings,
          limit,
          hasNextPage,
          nextCursor,
          service,
        },
      },
    });
  } catch (error) {
    console.error(
      "[Booking] Failed to fetch store bookings:",
      error.message
    );

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

    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        storeId: req.store._id,
        status: booking.status,
      },
      {
        $set: { status },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedBooking) {
      return res.status(409).json({
        success: false,
        message:
          "Booking status has already changed. Please refresh and try again.",
      });
    }

    if (status === "completed") {
      let customerName = "Customer";

      try {
        const customer = await Customer.findById(booking.customerId)
          .select("name")
          .lean();

        customerName = customer?.name || "Customer";
      } catch (error) {
        console.error("[Socket] Customer name lookup failed:", error.message);
      }

      await createStoreNotification(
        "booking_completed",
        updatedBooking,
        customerName,
      );
    }

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully.",
      data: {
        data: {
          booking: updatedBooking,
        },
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
