const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/doctor-appointment';

const defaultDoctors = [
  {
    name: 'Dr. Rajesh Kumar',
    specialty: 'Cardiology',
    cabinNumber: 'Cabin 101',
    status: 'Available'
  },
  {
    name: 'Dr. Anita Sharma',
    specialty: 'Pediatrics',
    cabinNumber: 'Cabin 102',
    status: 'Available'
  },
  {
    name: 'Dr. Vikram Mehta',
    specialty: 'Orthopedics',
    cabinNumber: 'Cabin 103',
    status: 'Available'
  },
  {
    name: 'Dr. Priya Patel',
    specialty: 'Dermatology',
    cabinNumber: 'Cabin 104',
    status: 'Available'
  },
  {
    name: 'Dr. Sanjay Gupta',
    specialty: 'General Medicine',
    cabinNumber: 'Cabin 105',
    status: 'Available'
  }
];

async function seedDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to database for seeding...');

    // Clear existing doctors
    await Doctor.deleteMany({});
    console.log('Cleared existing doctors.');

    // Seed new doctors
    const doctors = await Doctor.insertMany(defaultDoctors);
    console.log(`Successfully seeded ${doctors.length} doctors.`);

    await mongoose.disconnect();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
