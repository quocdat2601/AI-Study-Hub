const swaggerJsdoc = require('swagger-jsdoc');

const publicBaseUrl = process.env.API_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Study Hub API',
      version: '1.0.0',
      description: 'REST API documentation for AI Study Hub backend',
    },
    servers: [
      {
        url: publicBaseUrl,
        description: process.env.API_PUBLIC_BASE_URL ? 'Configured API server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Server and database health checks' },
      { name: 'Public', description: 'Public landing-page data' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Admin', description: 'Admin-only platform management' },
      { name: 'Documents', description: 'Document management' },
      { name: 'UploadDoc', description: 'Upload tài liệu' },
      { name: 'Subjects', description: 'Subject management' },
      { name: 'Dashboard', description: 'Dashboard data' },
      { name: 'Account', description: 'User account profile and settings' },
    ],
  },
  // Scan all route files for JSDoc @swagger annotations
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
