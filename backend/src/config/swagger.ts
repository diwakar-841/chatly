import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat App API',
      version: '1.0.0',
      description: 'REST API for the chat application',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: { type: 'object', properties: { message: { type: 'string' } } },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            avatar: { type: 'string' },
            bio: { type: 'string' },
            isPrivate: { type: 'boolean' },
            isOnline: { type: 'boolean' },
            lastSeen: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            chat: { type: 'string' },
            sender: { $ref: '#/components/schemas/User' },
            content: { type: 'string' },
            type: { type: 'string', enum: ['text', 'image', 'file'] },
            mediaUrl: { type: 'string' },
            readBy: { type: 'array', items: { type: 'string' } },
            isDeleted: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Chat: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            isGroup: { type: 'boolean' },
            members: { type: 'array', items: { $ref: '#/components/schemas/User' } },
            lastMessage: { $ref: '#/components/schemas/Message' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            recipient: { type: 'string' },
            sender: { $ref: '#/components/schemas/User' },
            type: { type: 'string', enum: ['message', 'request', 'request_accepted', 'group_add', 'system'] },
            message: { type: 'string' },
            isRead: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export default swaggerJsdoc(options);
