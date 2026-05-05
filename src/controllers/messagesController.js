import supabase from '../supabase.js';

// Créer ou récupérer une conversation
export const getOrCreateConversation = async (req, res) => {
  const {guest_id, host_id, property_id } = req.body;

  try {
    // Vérifier si la conversation existe déjà
    let { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('guest_id', guest_id)
      .eq('host_id', host_id)
      .eq('property_id', property_id)
      .single();
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Si non, la créer
    if (!conversation) {
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert([{
          guest_id,
          host_id,
          property_id
        }])
        .select()
        .single();

      if (createError) throw createError;
      conversation = newConversation;
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error('Error getting/creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getUserConversations = async (req, res) => {
  const { userId } = req.params;

  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`guest_id.eq.${userId},host_id.eq.${userId}`);

    console.log("Supabase error:", error);
    console.log("Conversations:", conversations);

    if (error) throw error;
    if (!conversations) return res.json([]);

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId =
          conv.guest_id === userId ? conv.host_id : conv.guest_id;

        const { data: otherUser } = await supabase
          .from('users')
          .select('user_id, full_name, profile_image')
          .eq('user_id', otherUserId)
          .single();

        return {
          ...conv,
          other_user: otherUser,
          unread_count: 0,
        };
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error('FULL ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// Récupérer les messages d'une conversation
export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const { userId } = req.query;

  try {
    // Récupérer les messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
    //   .order('created_at', { ascending: true });

    if (error) throw error;

    // Marquer les messages non lus comme lus
    if (userId) {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('is_read', false);
    }

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
};

// Envoyer un message
export const sendMessage = async (req, res) => {
  const { conversation_id, sender_id, receiver_id, booking_id, message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  try {
    // Insérer le message
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id,
        sender_id,
        receiver_id,
        booking_id,
        message: message.trim()
      }])
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour la dernière activité de la conversation
    await supabase
      .from('conversations')
      .update({
        last_message: message.trim(),
        last_message_at: new Date(),
        updated_at: new Date()
      })
      .eq('conversation_id', conversation_id);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
};

// Marquer les messages comme lus
export const markMessagesAsRead = async (req, res) => {
  const { conversationId } = req.params;
  const { userId } = req.body;

  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: error.message });
  }
};