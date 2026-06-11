const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');
const Appointment = require('./models/Appointment');
const whatsappService = require('./services/whatsapp.service');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow any origin for ease of development
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Bind Socket.io instance to the WhatsApp service
whatsappService.setIoInstance(io);

// Middleware
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/doctor-appointment';
const JWT_SECRET = process.env.JWT_SECRET || 'doctor_super_secret_key_12345!';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- Socket.io Handlers ---
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper: Format Date as YYYY-MM-DD
function getFormattedDate(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- REST API ROUTES ---

// 1. Admin Authentication
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ success: true, token });
  }

  return res.status(401).json({ success: false, message: 'Invalid username or password' });
});

// 2. Fetch Doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await Doctor.find({});
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update Doctor Availability Status
app.put('/api/doctors/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(req.id || req.params.id, { status }, { new: true });
    io.emit('doctor-status-updated', doctor);
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Patient booking (requests)
app.post('/api/appointments/book', async (req, res) => {
  try {
    const { name, age, gender, phone, reason, doctorId, date, timeSlot } = req.body;

    // A. Check if patient exists, or create new
    let patient = await Patient.findOne({ phone });
    if (!patient) {
      // Generate unique patientId: PAT-YYYYMMDD-XXXX
      const todayStr = getFormattedDate().replace(/-/g, '');
      const count = await Patient.countDocuments({});
      const patientId = `PAT-${todayStr}-${String(count + 1).padStart(4, '0')}`;

      patient = new Patient({
        patientId,
        name,
        age,
        gender,
        phone
      });
      await patient.save();
    }

    // B. Get Doctor info
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // C. Create appointment (Pending)
    const appointment = new Appointment({
      patient: patient._id,
      doctor: doctor._id,
      date,
      timeSlot,
      reason,
      status: 'Pending'
    });
    await appointment.save();

    // D. WhatsApp message - Applied
    const whatsappBody = `Hi ${patient.name}, you have successfully applied for an appointment with ${doctor.name} (${doctor.specialty}) on ${date} at ${timeSlot}. Status: Pending Confirmation.`;
    await whatsappService.sendWhatsApp(patient.phone, whatsappBody, 'Applied', patient);

    // E. Broadcast Socket update for Receptionist
    const populated = await Appointment.findById(appointment._id).populate('patient').populate('doctor');
    io.emit('new-appointment-request', populated);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get Pending Appointments
app.get('/api/appointments/pending', async (req, res) => {
  try {
    const pending = await Appointment.find({ status: 'Pending' })
      .populate('patient')
      .populate('doctor')
      .sort({ createdAt: 1 });
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get Active Appointments for Today
app.get('/api/appointments/active', async (req, res) => {
  try {
    const today = getFormattedDate();
    const active = await Appointment.find({
      date: today,
      status: { $in: ['Confirmed', 'In Consultation', 'Rescheduled'] }
    })
    .populate('patient')
    .populate('doctor')
    .sort({ tokenNumber: 1 });
    res.json(active);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get Appointment History
app.get('/api/appointments/history', async (req, res) => {
  try {
    const history = await Appointment.find({
      status: { $in: ['Completed', 'Rejected'] }
    })
    .populate('patient')
    .populate('doctor')
    .sort({ updatedAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Accept Appointment (Generate Daily Token)
app.post('/api/appointments/:id/accept', async (req, res) => {
  try {
    const apptId = req.params.id;
    const appointment = await Appointment.findById(apptId).populate('patient').populate('doctor');
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Determine Daily Token Number for this doctor
    const today = appointment.date;
    const doctorId = appointment.doctor._id;

    // Get max token number assigned to this doctor today
    const countResult = await Appointment.find({
      doctor: doctorId,
      date: today,
      tokenNumber: { $ne: null }
    }).sort({ tokenNumber: -1 }).limit(1);

    let nextToken = 1;
    if (countResult.length > 0 && countResult[0].tokenNumber) {
      nextToken = countResult[0].tokenNumber + 1;
    }

    appointment.status = 'Confirmed';
    appointment.tokenNumber = nextToken;
    await appointment.save();

    // WhatsApp Notification - Confirmed
    const whatsappBody = `Hi ${appointment.patient.name}, your appointment with ${appointment.doctor.name} is CONFIRMED! Your Token number is #${nextToken}. Please proceed to ${appointment.doctor.cabinNumber} upon arrival.`;
    await whatsappService.sendWhatsApp(appointment.patient.phone, whatsappBody, 'Confirmed', appointment.patient);

    // Emit live update
    io.emit('queue-updated');

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Reject Appointment (Custom Message)
app.post('/api/appointments/:id/reject', async (req, res) => {
  try {
    const apptId = req.params.id;
    const { customReason } = req.body;

    const appointment = await Appointment.findById(apptId).populate('patient').populate('doctor');
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    appointment.status = 'Rejected';
    appointment.rejectionReason = customReason || 'No specific reason provided';
    await appointment.save();

    // WhatsApp Notification - Rejected
    const whatsappBody = `Hi ${appointment.patient.name}, your appointment request with ${appointment.doctor.name} has been declined. Receptionist Note: "${appointment.rejectionReason}". Please apply again or select another time.`;
    await whatsappService.sendWhatsApp(appointment.patient.phone, whatsappBody, 'Rejected', appointment.patient);

    // Emit live update
    io.emit('queue-updated');

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Call Token (Broadcasts to TV board + WhatsApp "Next Up")
app.post('/api/appointments/:id/call', async (req, res) => {
  try {
    const apptId = req.params.id;
    const appointment = await Appointment.findById(apptId).populate('patient').populate('doctor');
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Set status to In Consultation
    appointment.status = 'In Consultation';
    await appointment.save();

    // A. Broadcast token to TV screen via Socket.io
    const callData = {
      tokenNumber: appointment.tokenNumber,
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.name,
      specialty: appointment.doctor.specialty,
      cabinNumber: appointment.doctor.cabinNumber
    };
    io.emit('token-called', callData);

    // B. Trigger WhatsApp "Next Up" to the NEXT patient in line for this doctor
    const nextInLine = await Appointment.findOne({
      doctor: appointment.doctor._id,
      date: appointment.date,
      status: { $in: ['Confirmed', 'Rescheduled'] }
    })
    .populate('patient')
    .sort({ tokenNumber: 1 });

    if (nextInLine) {
      const whatsappBody = `Hi ${nextInLine.patient.name}, you are next in line for ${appointment.doctor.name}! Please get ready to enter ${appointment.doctor.cabinNumber} shortly.`;
      await whatsappService.sendWhatsApp(nextInLine.patient.phone, whatsappBody, 'NextUp', nextInLine.patient);
    }

    io.emit('queue-updated');

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Finished Consultation
app.post('/api/appointments/:id/finish', async (req, res) => {
  try {
    const apptId = req.params.id;
    const appointment = await Appointment.findById(apptId).populate('patient');
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    appointment.status = 'Completed';
    await appointment.save();

    // Inform the TV board that a token was finished/cleared
    io.emit('token-finished', { tokenNumber: appointment.tokenNumber });
    io.emit('queue-updated');

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Reschedule Appointment
app.post('/api/appointments/:id/reschedule', async (req, res) => {
  try {
    const apptId = req.params.id;
    const { newDate, newTimeSlot } = req.body;

    const appointment = await Appointment.findById(apptId).populate('patient').populate('doctor');
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update details and status back to Rescheduled (which acts as a confirmed booking)
    appointment.date = newDate;
    appointment.timeSlot = newTimeSlot;
    appointment.status = 'Rescheduled';
    await appointment.save();

    // WhatsApp Notification - Rescheduled
    const whatsappBody = `Hi ${appointment.patient.name}, your appointment with ${appointment.doctor.name} has been rescheduled to ${newDate} at ${newTimeSlot} due to emergency schedules. You will retain your Token #${appointment.tokenNumber}.`;
    await whatsappService.sendWhatsApp(appointment.patient.phone, whatsappBody, 'Rescheduled', appointment.patient);

    io.emit('queue-updated');

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Trigger Emergency Notification to waiting queue
app.post('/api/doctors/:id/emergency', async (req, res) => {
  try {
    const doctorId = req.params.id;
    const today = getFormattedDate();

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Find all patients currently waiting for this doctor today
    const waitingAppts = await Appointment.find({
      doctor: doctorId,
      date: today,
      status: { $in: ['Confirmed', 'Rescheduled'] }
    }).populate('patient');

    // Send emergency delays WhatsApp to all
    const messagePromises = waitingAppts.map(async (appt) => {
      const whatsappBody = `Alert: Hi ${appt.patient.name}, Dr. ${doctor.name} is attending to an emergency. Please expect a delay and wait for some time. We apologize for the inconvenience.`;
      return whatsappService.sendWhatsApp(appt.patient.phone, whatsappBody, 'Emergency', appt.patient);
    });

    await Promise.all(messagePromises);

    // Notify clients of emergency
    io.emit('emergency-triggered', { doctorId, doctorName: doctor.name });

    res.json({ success: true, alertedCount: waitingAppts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Fetch WhatsApp Messages for Simulation Tab
app.get('/api/whatsapp/messages', (req, res) => {
  res.json(whatsappService.getSimulatedMessages());
});

// Catch-all route
app.get('/', (req, res) => {
  res.send('Hospital Appointment & Queue API is running.');
});

// Start Server
server.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
