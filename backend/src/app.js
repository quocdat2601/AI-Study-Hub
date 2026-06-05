const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const documentRoutes = require('./routes/document.routes');
const uploadDocRoutes = require('./routes/uploadDoc.routes');
const subjectRoutes = require('./routes/subject.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const userRoutes = require('./routes/user.routes');
const bookmarkRoutes = require('./routes/bookmark.routes');
const chatRoutes = require('./routes/chat.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes = require('./routes/admin.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Swagger UI — available at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'AI Study Hub API Docs',
  swaggerOptions: { persistAuthorization: true },
}));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/upload-doc', uploadDocRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

module.exports = app;
