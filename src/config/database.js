const mongoose = require("mongoose");

const connectDB = async () => {
  await mongoose.connect("ADD YOUR CONNECTION STRING HERE/jobportal");
};

module.exports = { connectDB };
