import express from 'express';
import * as messageController from '../controllers/messagesController.js';

const router = express.Router();

router.post('/conversations', messageController.getOrCreateConversation);
router.get('/conversations/user/:userId', messageController.getUserConversations);
router.get('/conversations/:conversationId/messages', messageController.getMessages);
router.post('/messages', messageController.sendMessage);
router.put('/conversations/:conversationId/read', messageController.markMessagesAsRead);

export default router;