const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const buildCorsOptions = require('./config/cors');
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
const communityRoutes = require('./routes/community.routes');
const communityImageRoutes = require('./routes/communityImage.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes = require('./routes/admin.routes');
const publicRoutes = require('./routes/public.routes');
const accountRoutes = require('./routes/account.routes');
const aiRoutes = require('./routes/ai.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const chatbotRoutes = require('./routes/chatbot.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors(buildCorsOptions()));
app.use(express.json());

// Swagger UI - available at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'AI Study Hub API Docs',
  swaggerOptions: { persistAuthorization: true },
}));

app.use('/api/health', healthRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/upload-doc', uploadDocRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/community', communityImageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/chatbot', chatbotRoutes);

app.use(errorHandler);

module.exports = app;
