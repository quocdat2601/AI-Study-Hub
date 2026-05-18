const swaggerJsdoc = require('swagger-jsdoc');

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
        url: 'http://localhost:{port}',
        description: 'Development server',
        variables: {
          port: { default: '5000' },
        },
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
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Admin', description: 'Admin-only platform management' },
      { name: 'Documents', description: 'Document management' },
      { name: 'Subjects', description: 'Subject management' },
      { name: 'Dashboard', description: 'Dashboard data' },
    ],
  },
  // Scan all route files for JSDoc @swagger annotations
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
