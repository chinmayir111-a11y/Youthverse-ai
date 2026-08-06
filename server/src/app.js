const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const errorMiddleware = require('./middlewares/error.middleware');
const ApiError = require('./utils/ApiError');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const studyRoutes = require('./routes/study.routes');
const careerRoutes = require('./routes/career.routes');
const mentorshipRoutes = require('./routes/mentorship.routes');
const opportunityRoutes = require('./routes/opportunity.routes');
const forumRoutes = require('./routes/forum.routes');
const projectRoutes = require('./routes/project.routes');
const resourceRoutes = require('./routes/resource.routes');
const mentorRoutes = require('./routes/mentor.routes');
const wellbeingRoutes = require('./routes/wellbeing.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'youthverse-api',
    aiProvider: process.env.AI_PROVIDER || 'mock',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/mentorship', mentorshipRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/resources', resourceRoutes);
// Singular: the AI Mentor. "/api/mentorship" is the human one.
app.use('/api/mentor', mentorRoutes);
app.use('/api/wellbeing', wellbeingRoutes);
app.use('/api/notifications', notificationRoutes);

// Unmatched /api/* -> 404 in the same envelope as every other error.
app.use('/api', (req) => {
  throw new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`);
});

app.use(errorMiddleware);

module.exports = app;
